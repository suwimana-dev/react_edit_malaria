import React, { useMemo, useState } from 'react';
import { store, useStore } from '../store';
import { scoreOf, fmt, downloadBlob } from '../lib/scoring';
import { controller } from '../mapController';
import { openParcelPopup } from '../actions';

const profileLabel = (k) => (k === 'malaria' ? 'Malaria vector priority' : 'Any larvae');

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
      <div className="kpis">
        <div className="kpi"><b>{fmt(rows.length)}</b><small>Parcels</small></div>
        <div className="kpi"><b>{fmt(flagged.length)}</b><small>Flagged</small></div>
        <div className="kpi"><b>{rows.length ? Math.round((100 * flagged.length) / rows.length) : 0}%</b><small>Share</small></div>
        <div className="kpi"><b>{fmt(wet)}</b><small>Wet m²</small></div>
      </div>
      <h4>Score distribution</h4>
      <div className="hist" aria-label="Score distribution">
        {bins.map((n, i) => <i key={i} className={i * 10 + 10 <= thr ? 'below' : ''} style={{ height: `${Math.max(2, (100 * n) / maxBin)}%` }} title={`${i * 10}-${i * 10 + 10}: ${n} parcels`} />)}
      </div>
      <div className="hist-ax"><span>0</span><span>threshold {thr}</span><span>100</span></div>
      <h4>Flagged by habitat</h4>
      {hab.length ? hab.map(([h, n]) => (
        <div className="bar-row" key={h}><span>{h}</span><div className="track"><div className="fill" style={{ width: `${(100 * n) / maxHab}%` }} /></div><span>{n}</span></div>
      )) : <div className="empty">No parcel reaches the threshold.</div>}
    </>
  );
}

function ToCheck({ rows, profile }) {
  const [q, setQ] = useState(''), [sort, setSort] = useState('score'), [min, setMin] = useState(0);
  const prio = (r) => (typeof r.p.inspection_priority === 'number' ? r.p.inspection_priority : 99);
  const out = useMemo(() => {
    const t = q.trim().toLowerCase();
    const by = { score: (a, b) => b.score - a.score, priority: (a, b) => prio(a) - prio(b) || b.score - a.score, wet: (a, b) => b.wet - a.wet, habitat: (a, b) => a.habitat.localeCompare(b.habitat) };
    return rows.filter((r) => r.flagged && r.score >= min && (!t || [r.habitat, r.p.site_id, r.stem, r.p.id].join(' ').toLowerCase().includes(t))).sort(by[sort]);
  }, [rows, q, sort, min]);
  const csv = () => {
    const head = ['tile', 'region_id', 'site_id', 'habitat', 'profile', 'score', 'inspection_priority', 'wet_area_m2', 'area_m2', 'lat', 'lon'];
    const quote = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [head.join(',')].concat(out.map((r) => [r.stem, r.p.id, r.p.site_id, r.habitat, profile, r.score, r.p.inspection_priority, r.wet, r.area, r.p.lat, r.p.lon].map(quote).join(',')));
    downloadBlob(lines.join('\n'), `parcels-to-check-${profile}.csv`, 'text/csv');
  };
  return (
    <>
      <div className="ctl" style={{ marginTop: 12 }}>
        <input type="search" placeholder="Search site, habitat, tile" aria-label="Search parcels" value={q} onChange={(e) => setQ(e.target.value)} />
        <select aria-label="Sort parcels" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="score">Highest score</option><option value="priority">Inspection priority</option>
          <option value="wet">Largest wet area</option><option value="habitat">Habitat A–Z</option>
        </select>
      </div>
      <div className="minrow">Min score <input type="range" min="0" max="100" step="5" value={min} onChange={(e) => setMin(+e.target.value)} /><b>{min}</b></div>
      <div className="rows">
        {!out.length && <div className="empty">Nothing matches. Lower the minimum score or clear the search.</div>}
        {out.slice(0, 200).map((r) => (
          <button className="rowbtn" key={`${r.stem}:${r.p.id}`} onClick={() => zoomTo(r)}>
            <span className="sc">{r.score}</span><span>{r.p.site_id || `Region ${r.p.id}`} · {r.habitat}</span><small>{fmt(r.wet)} m²</small>
          </button>
        ))}
        {out.length > 200 && <div className="empty">Showing 200 of {out.length}. Use the CSV for the full list.</div>}
      </div>
      <button style={{ marginTop: 8 }} onClick={csv}>Download list (CSV)</button>
    </>
  );
}

// The backend's own combined inspection list (priority numbers or "pending").
function Inspection({ rows }) {
  const incl = useStore((s) => s.includeMalaria);
  const list = rows.filter((r) => r.p.inspection_priority !== null && r.p.inspection_priority !== undefined)
    .sort((a, b) => (typeof a.p.inspection_priority === 'number' ? a.p.inspection_priority : 9) - (typeof b.p.inspection_priority === 'number' ? b.p.inspection_priority : 9));
  return (
    <>
      <p className="hint" style={{ marginTop: 12 }}>Inspection list · {incl ? 'both profiles' : 'Any larvae only'}</p>
      <div className="rows">
        {!list.length && <div className="empty">No qualifying regions in this batch.</div>}
        {list.map((r) => {
          const sc = r.p.scores || {};
          return (
            <button className="rowbtn" key={`${r.stem}:${r.p.id}`} style={{ gridTemplateColumns: '1fr' }} onClick={() => zoomTo(r)}>
              {r.p.inspection_priority === 'pending' ? 'Pending' : `Priority ${r.p.inspection_priority}`} · {r.p.site_id || `Region ${r.p.id}`} · Any {sc.any_larvae?.score ?? 'N/A'}{incl ? ` / Malaria ${sc.malaria?.score ?? 'N/A'}` : ''}
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
    <div id="sp" className="card">
      <button className="sp-head" aria-expanded={ui.summaryOpen} onClick={() => set({ summaryOpen: !ui.summaryOpen })}>
        <b>Risk summary</b><span>{profileLabel(profile)}</span>
      </button>
      {ui.summaryOpen && (
        <div className="sp-body">
          <div className="tabs" role="tablist">
            {[['overview', 'Overview'], ['check', 'To check'], ['inspection', 'Inspection']].map(([k, label]) => (
              <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => set({ summaryTab: k })}>{label}</button>
            ))}
          </div>
          {tab === 'overview' && <Overview rows={rows} thr={thr} />}
          {tab === 'check' && <ToCheck rows={rows} profile={profile} />}
          {tab === 'inspection' && <Inspection rows={rows} />}
        </div>
      )}
    </div>
  );
}
