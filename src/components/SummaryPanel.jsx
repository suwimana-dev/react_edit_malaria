import React, { useMemo, useState } from 'react';
import { store, useStore } from '../store';
import { scoreOf, fmt, downloadBlob, riskColor } from '../lib/scoring';
import { controller } from '../mapController';
import { openParcelPopup, setProfile } from '../actions';
import Seg from './Seg.jsx';
import { Button, Card, Input, Select, cx } from '../ui';

const PROFILES = [['any_larvae', 'Any larvae'], ['malaria', 'Malaria vector']];

function useRows() {
  const parcelData = useStore((s) => s.parcelData), profile = useStore((s) => s.activeProfile);
  const thr = useStore((s) => s.profileWeights?.[s.activeProfile]?.threshold ?? 50);
  return useMemo(() => {
    const rows = [];
    for (const [stem, parcels] of Object.entries(parcelData)) {
      for (const p of parcels) {
        const score = scoreOf(p, profile);
        rows.push({ stem, p, score, flagged: score != null && score >= thr, habitat: p.habitat_label || p.lulc_name || 'Unknown', wet: Number(p.wet_area_m2) || 0, area: Number(p.area_m2) || 0 });
      }
    }
    return { rows, profile, thr };
  }, [parcelData, profile, thr]);
}

const zoomTo = (r) => {
  if (r.p.lat == null) return;
  controller.flyTo(r.p.lat, r.p.lon);
  openParcelPopup(r.stem, r.p.id, [r.p.lat, r.p.lon]);
};
const H4 = ({ children }) => <h4 className="mb-2 mt-4 text-[13px] font-semibold uppercase tracking-wide text-muted">{children}</h4>;
const Empty = ({ children }) => <div className="p-4 text-center text-sm text-muted">{children}</div>;
const Pill = ({ score, thr }) => <span className="pill inline-grid h-8 min-w-[46px] place-items-center rounded-full font-mono text-[15px] font-semibold text-white" style={{ background: score == null ? 'var(--muted)' : riskColor(score, thr) }}>{score ?? '–'}</span>;

function Overview({ rows, thr }) {
  const flagged = rows.filter((r) => r.flagged);
  const wet = flagged.reduce((a, r) => a + r.wet, 0);
  const bins = new Array(10).fill(0);
  rows.forEach((r) => { if (r.score != null) bins[Math.min(9, Math.floor(r.score / 10))]++; });
  const maxBin = Math.max(1, ...bins);
  const byHab = {};
  flagged.forEach((r) => { byHab[r.habitat] = (byHab[r.habitat] || 0) + 1; });
  const hab = Object.entries(byHab).sort((a, b) => b[1] - a[1]).slice(0, 6), maxHab = Math.max(1, ...hab.map((h) => h[1]));
  return (
    <>
      <div className="kpis my-3 grid grid-cols-2 gap-2.5">
        <div className="rounded-md bg-wash px-3 py-2.5"><b className="block font-mono text-2xl leading-tight">{fmt(flagged.length)}</b><small className="text-[13px] font-semibold text-muted">flagged of {fmt(rows.length)} parcels</small></div>
        <div className="rounded-md bg-wash px-3 py-2.5"><b className="block font-mono text-2xl leading-tight">{rows.length ? Math.round((100 * flagged.length) / rows.length) : 0}%</b><small className="text-[13px] font-semibold text-muted">of parcels flagged</small></div>
        <div className="rounded-md bg-wash px-3 py-2.5"><b className="block font-mono text-2xl leading-tight">{fmt(wet)}</b><small className="text-[13px] font-semibold text-muted">m² wet area in flagged parcels</small></div>
        <div className="rounded-md bg-wash px-3 py-2.5"><b className="block font-mono text-2xl leading-tight">{thr}</b><small className="text-[13px] font-semibold text-muted">points needed to flag</small></div>
      </div>
      <H4>How scores are spread</H4>
      <div className="flex h-[60px] items-end gap-[3px]" role="img" aria-label="Number of parcels by score">
        {bins.map((n, i) => <i key={i} className={cx('min-h-[3px] flex-1 rounded-t-[3px]', i * 10 + 10 <= thr ? 'bg-line' : 'bg-pine')} style={{ height: `${Math.max(5, (100 * n) / maxBin)}%` }} title={`${i * 10}-${i * 10 + 10}: ${n} parcels`} />)}
      </div>
      <div className="mt-1 flex justify-between font-mono text-xs text-muted"><span>0</span><span>flag from {thr}</span><span>100</span></div>
      <H4>Flagged parcels by habitat</H4>
      {hab.length ? hab.map(([h, n]) => (
        <div className="my-1.5 grid grid-cols-[minmax(80px,120px)_1fr_32px] items-center gap-2 text-sm" key={h}><span>{h}</span><div className="h-3 overflow-hidden rounded-[5px] bg-wash"><div className="h-full bg-amber" style={{ width: `${(100 * n) / maxHab}%` }} /></div><span className="text-right font-mono">{n}</span></div>
      )) : <Empty>No parcel reaches the threshold.</Empty>}
    </>
  );
}

function ToCheck({ rows, profile, thr }) {
  const [q, setQ] = useState(''), [sort, setSort] = useState('score'), [min, setMin] = useState(0), [habs, setHabs] = useState([]);
  const prio = (r) => (typeof r.p.inspection_priority === 'number' ? r.p.inspection_priority : 99);
  const habitats = useMemo(() => [...new Set(rows.filter((r) => r.flagged).map((r) => r.habitat))].sort(), [rows]);
  const out = useMemo(() => {
    const t = q.trim().toLowerCase();
    const by = { score: (a, b) => b.score - a.score, priority: (a, b) => prio(a) - prio(b) || b.score - a.score, wet: (a, b) => b.wet - a.wet, habitat: (a, b) => a.habitat.localeCompare(b.habitat) };
    return rows.filter((r) => r.flagged && r.score >= min && (!habs.length || habs.includes(r.habitat)) &&
      (!t || [r.habitat, r.p.site_id, r.stem, r.p.id].join(' ').toLowerCase().includes(t))).sort(by[sort]);
  }, [rows, q, sort, min, habs]);
  const csv = () => {
    const head = ['tile', 'region_id', 'site_id', 'habitat', 'profile', 'score', 'inspection_priority', 'wet_area_m2', 'area_m2', 'lat', 'lon'];
    const quote = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [head.join(',')].concat(out.map((r) => [r.stem, r.p.id, r.p.site_id, r.habitat, profile, r.score, r.p.inspection_priority, r.wet, r.area, r.p.lat, r.p.lon].map(quote).join(',')));
    downloadBlob(lines.join('\n'), `parcels-to-check-${profile}.csv`, 'text/csv');
  };
  return (
    <>
      <div className="my-2.5 grid grid-cols-2 gap-2.5">
        <Input type="search" placeholder="Search site or habitat" aria-label="Search parcels" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select aria-label="Sort parcels" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="score">Highest score first</option><option value="priority">Inspection priority</option>
          <option value="wet">Largest wet area</option><option value="habitat">Habitat A to Z</option>
        </Select>
      </div>
      {habitats.length > 1 && (
        <div className="mb-2.5 flex flex-wrap gap-2" role="group" aria-label="Filter by habitat">
          {habitats.map((h) => <button key={h} type="button" aria-pressed={habs.includes(h)} className={cx('min-h-[38px] rounded-full border transition-colors duration-150 border-line px-3.5 text-sm font-medium', habs.includes(h) ? 'border-ink bg-ink text-surface' : 'bg-surface text-ink hover:bg-wash')} onClick={() => setHabs(habs.includes(h) ? habs.filter((x) => x !== h) : [...habs, h])}>{h}</button>)}
        </div>
      )}
      <label className="mb-2 mt-0.5 flex items-center gap-2.5 text-sm text-muted">Minimum score <input type="range" className="flex-1" min="0" max="100" step="5" value={min} onChange={(e) => setMin(+e.target.value)} /><b className="font-mono">{min}</b></label>
      <div className="max-h-[260px] overflow-auto rounded-md border border-line-soft">
        {!out.length && <Empty>Nothing matches. Lower the minimum score or clear the filters.</Empty>}
        {out.slice(0, 200).map((r) => (
          <button type="button" className="rowbtn grid min-h-[54px] w-full items-center gap-2.5 border-b border-line-soft bg-surface px-2.5 py-1.5 text-left text-[15px] font-medium text-ink last:border-b-0 hover:bg-pine-50 grid-cols-[54px_1fr_auto]" key={`${r.stem}:${r.p.id}`} onClick={() => zoomTo(r)}>
            <Pill score={r.score} thr={thr} />
            <span>{r.p.site_id || `Region ${r.p.id}`}<span className="block text-[13px] text-muted">{r.habitat}</span></span>
            <small className="font-mono text-[13px] text-muted">{fmt(r.wet)} m²</small>
          </button>
        ))}
        {out.length > 200 && <Empty>Showing 200 of {out.length}. The CSV has the full list.</Empty>}
      </div>
      <Button className="mt-2.5 w-full" onClick={csv}>Download this list (CSV)</Button>
    </>
  );
}

// The backend's own combined inspection list (priority numbers or "pending").
function Inspection({ rows, thr }) {
  const incl = useStore((s) => s.includeMalaria);
  const list = rows.filter((r) => r.p.inspection_priority !== null && r.p.inspection_priority !== undefined)
    .sort((a, b) => (typeof a.p.inspection_priority === 'number' ? a.p.inspection_priority : 9) - (typeof b.p.inspection_priority === 'number' ? b.p.inspection_priority : 9));
  return (
    <>
      <p className="mt-1.5 text-sm text-muted">Order to visit sites · {incl ? 'both profiles' : 'Any larvae only'}</p>
      <div className="mt-2.5 max-h-[260px] overflow-auto rounded-md border border-line-soft">
        {!list.length && <Empty>No parcel needs inspection in this batch.</Empty>}
        {list.map((r) => {
          const sc = r.p.scores || {};
          return (
            <button type="button" className="rowbtn grid min-h-[54px] w-full items-center gap-2.5 border-b border-line-soft bg-surface px-2.5 py-1.5 text-left text-[15px] font-medium text-ink last:border-b-0 hover:bg-pine-50 grid-cols-[54px_1fr_auto]" key={`${r.stem}:${r.p.id}`} style={{ gridTemplateColumns: '1fr auto' }} onClick={() => zoomTo(r)}>
              <span><span className="font-semibold text-amber">{r.p.inspection_priority === 'pending' ? 'Pending' : `Priority ${r.p.inspection_priority}`}</span>
                {' · '}{r.p.site_id || `Region ${r.p.id}`}<span className="block text-[13px] text-muted">{r.habitat}</span></span>
              <small className="font-mono text-[13px] text-muted">Any {sc.any_larvae?.score ?? 'N/A'}{incl ? ` · Malaria ${sc.malaria?.score ?? 'N/A'}` : ''}</small>
            </button>
          );
        })}
      </div>
    </>
  );
}

export default function SummaryPanel() {
  const { rows, profile, thr } = useRows();
  const ui = useStore((s) => s.ui);
  if (!rows.length) return null;
  const tab = ui.summaryTab, set = (patch) => store.set({ ui: { ...ui, ...patch } });
  return (
    <Card id="sp" className={cx('absolute bottom-4 right-3 z-[1000] flex max-h-[64%] w-[min(380px,calc(100%-24px))] flex-col',
      'max-sm:bottom-[calc(76px+env(safe-area-inset-bottom,0px))] max-sm:left-3 max-sm:right-3 max-sm:max-h-[52%] max-sm:w-auto', !ui.barCollapsed && 'max-sm:hidden')}>
      <button type="button" className="sp-head flex min-h-[52px] w-full items-center justify-between rounded-card border-0 bg-surface px-4 font-normal text-ink hover:bg-wash"
        aria-expanded={ui.summaryOpen} onClick={() => set({ summaryOpen: !ui.summaryOpen })}>
        <b className="text-[17px]">Results</b><span className="text-[13px] font-semibold text-muted">{ui.summaryOpen ? 'Hide ▾' : 'Show ▴'}</span>
      </button>
      {ui.summaryOpen && (
        <div className="overflow-auto border-t border-line-soft px-4 pb-4">
          <div className="mt-3"><Seg label="Scoring profile" value={profile} onChange={setProfile} options={PROFILES} /></div>
          <div className="mb-1 mt-3 grid grid-cols-3 gap-1.5" role="tablist">
            {[['overview', 'Overview'], ['check', 'To check'], ['inspection', 'Visit order']].map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => set({ summaryTab: k })}
                className="min-h-[44px] rounded-md border transition-colors duration-150 border-line bg-surface px-1 text-sm font-medium text-muted hover:bg-wash aria-selected:border-ink aria-selected:bg-ink aria-selected:text-surface">{label}</button>
            ))}
          </div>
          {tab === 'overview' && <Overview rows={rows} thr={thr} />}
          {tab === 'check' && <ToCheck rows={rows} profile={profile} thr={thr} />}
          {tab === 'inspection' && <Inspection rows={rows} thr={thr} />}
        </div>
      )}
    </Card>
  );
}
