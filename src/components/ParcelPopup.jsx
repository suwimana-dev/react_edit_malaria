import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store';
import { controller } from '../mapController';
import { observe, reclass, saveVisit } from '../actions';
import Seg from './Seg.jsx';
import { Button, Input, Select, Lbl, Summary, cx } from '../ui';

const RICE = { flooded: 'Flooded / transplanting', tillering: 'Tillering', canopy: 'Canopy / flowering', mature: 'Mature / post-harvest', fallow_or_dry: 'Fallow / dry' };
const DET = 'mt-2.5 border-t border-line-soft pt-1';
const ESTIMATE = ['', 'Estimate'];
const triState = [['', 'Not recorded'], ['yes', 'Found'], ['no', 'None']];

function ObsSelect({ stem, p, k, options, value, label }) {
  return (
    <Select aria-label={label || k} value={value ?? ''} onChange={(e) => observe(stem, p.id, k, e.target.value)}>
      <option value="">Use model estimate</option>
      {Object.entries(options).map(([v, text]) => <option key={v} value={v}>{text}</option>)}
    </Select>
  );
}

function Score({ label, value, thr }) {
  const flagged = value != null && value >= thr;
  return (
    <div className={cx('score rounded-md border px-2.5 py-2', flagged ? 'flag border-danger bg-danger-100' : 'low border-line')}>
      <small className="block text-xs font-semibold text-muted">{label}</small>
      <b className="font-mono text-2xl leading-tight">{value == null ? '–' : value}</b>{value != null && <span className="text-muted"> /100</span>}
      <em className={cx('block text-xs font-semibold not-italic', flagged ? 'text-danger' : 'text-muted')}>{value == null ? 'Waiting for an observation' : flagged ? 'Flagged for inspection' : 'Below the threshold'}</em>
    </div>
  );
}

function VisitForm({ stem, p }) {
  const [f, setF] = useState({ site: p.site_id || '', dips: 0, larvae: '', anopheles: '', pupae: '', treatment: '', notes: '' });
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const pick = (k) => (v) => setF({ ...f, [k]: v });
  return (
    <details data-section="visit" className={DET}>
      <Summary>Record a field visit</Summary>
      <Lbl htmlFor={`site_${p.id}`}>Permanent site ID (reuse it on every flight)</Lbl>
      <Input id={`site_${p.id}`} type="text" value={f.site} placeholder="e.g. KAB-001" onChange={set('site')} />
      <Lbl htmlFor={`dips_${p.id}`}>Dips taken</Lbl>
      <Input id={`dips_${p.id}`} type="number" min="0" step="1" value={f.dips} onChange={set('dips')} />
      <Lbl>Larvae</Lbl><Seg label="Larvae" value={f.larvae} onChange={pick('larvae')} options={triState} />
      <Lbl>Anopheles</Lbl><Seg label="Anopheles" value={f.anopheles} onChange={pick('anopheles')} options={triState} />
      <Lbl>Pupae</Lbl><Seg label="Pupae" value={f.pupae} onChange={pick('pupae')} options={triState} />
      <Lbl htmlFor={`treat_${p.id}`}>Treatment</Lbl>
      <Input id={`treat_${p.id}`} type="text" value={f.treatment} onChange={set('treatment')} />
      <Lbl htmlFor={`notes_${p.id}`}>Notes</Lbl>
      <Input id={`notes_${p.id}`} type="text" value={f.notes} onChange={set('notes')} />
      <Button variant="primary" className="mt-3 w-full" disabled={busy}
        onClick={async () => { setBusy(true); setErr(''); try { await saveVisit(stem, p.id, f); } catch (e) { setErr(e.message); setBusy(false); } }}>
        {busy ? 'Saving…' : 'Save field visit'}
      </Button>
      {err && <div className="mt-2 rounded-md bg-danger-100 px-2.5 py-2 text-sm font-semibold text-danger" role="alert">Not saved: {err}</div>}
      <p className="mt-1.5 text-sm leading-normal text-muted">Uses the field visit date and team from the control panel.</p>
    </details>
  );
}

function Body({ stem, p }) {
  const names = useStore((s) => s.classNames), labels = useStore((s) => s.habitatLabels), pw = useStore((s) => s.profileWeights);
  useEffect(() => { controller.refreshPopup(); });           // content size changed: let Leaflet re-fit the popup
  const bd = p.breakdown || {}, sc = p.scores || {};
  const thr = (k) => pw?.[k]?.threshold ?? 50;
  const ids = Object.keys(names).sort((a, b) => a - b);
  return (
    <div className="popup px-4 pb-4 pt-3.5">
      <h3 className="pr-8 text-lg leading-tight">{p.habitat_label || p.lulc_name}</h3>
      <div className="meta mt-0.5 text-[13px] text-muted">{p.site_id ? `Site ${p.site_id}` : `Region ${p.id}`} · {Number(p.area_m2 || 0).toLocaleString()} m² · {Number(p.wet_area_m2 || 0).toLocaleString()} m² wet</div>
      <div className="my-3 grid grid-cols-2 gap-2.5">
        <Score label="Any larvae" value={sc.any_larvae?.score} thr={thr('any_larvae')} />
        <Score label="Malaria vector" value={sc.malaria?.score} thr={thr('malaria')} />
      </div>
      <div className="meta mt-0.5 text-[13px] text-muted">Priority: {p.inspection_priority ?? 'no action this cycle'} · Last visit: {p.last_visit?.visit_date || 'none recorded'}</div>
      {p.field_water_without_geometry && <p className="mt-1.5 text-sm leading-normal text-muted">Water confirmed in the field counts, but there is no wet footprint to draw.</p>}
      {bd.reason && <p className="mt-1.5 text-sm leading-normal text-muted"><b>{bd.reason}</b></p>}

      <details data-section="why" className={DET}>
        <Summary>Why this score</Summary>
        <table className="my-1 mb-2 w-full border-collapse text-sm [&_td:first-child]:pr-3 [&_td:first-child]:text-muted [&_td:last-child]:text-right [&_td:last-child]:font-mono [&_td]:py-1"><tbody>
          <tr><td>Habitat</td><td>{bd.lulc}</td></tr>
          <tr><td>Month{bd.guessed_month ? ' (guessed)' : ''}</td><td>{bd.month}</td></tr>
          <tr><td>Water gate</td><td>{bd.gate || 'unknown'}; 0 points</td></tr>
          <tr><td>Vegetation ({bd.vegetation_category || 'unknown'})</td><td>{bd.ndvi}</td></tr>
          <tr><td>Rice ({bd.stage || 'unknown'})</td><td>{bd.rice}</td></tr>
          <tr><td>Previous-visit bonus</td><td>{bd.bonus || 0}</td></tr>
          <tr className="tot font-semibold [&_td]:border-t [&_td]:border-line [&_td]:pt-1.5 [&_td:first-child]:text-ink"><td>Active total</td><td>{bd.total} points</td></tr>
        </tbody></table>
        <p className="mt-1.5 text-sm leading-normal text-muted">Vegetation: {bd.vegetation_source || 'not assessed'}. Rice stage: {bd.stage_source || 'not applicable'}.{bd.guessed_habitat ? ' The habitat weight is a guess.' : ''}</p>
      </details>

      <details data-section="corrections" className={DET}>
        <Summary>Correct what the model got wrong</Summary>
        <Lbl>Land cover class (the model said: {p.lulc_name})</Lbl>
        <Select aria-label="Model class" value={p.lulc_class} onChange={(e) => reclass(stem, p.id, e.target.value)}>
          {ids.map((id) => <option key={id} value={id}>{id} {names[id]}</option>)}
        </Select>
        <Lbl>Habitat seen in the field</Lbl>
        <ObsSelect stem={stem} p={p} k="habitat_observed" label="Observed habitat" options={labels} value={p.habitat_observed} />
        <Lbl>Vegetation at the water edge</Lbl>
        <Seg label="Vegetation" value={p.vegetation_observed} onChange={(v) => observe(stem, p.id, 'vegetation_observed', v)}
          options={[ESTIMATE, ['none', 'None'], ['sparse', 'Sparse'], ['dense', 'Dense']]} />
        <Lbl>Rice stage (rice only)</Lbl>
        <ObsSelect stem={stem} p={p} k="rice_stage_observed" label="Observed rice stage" options={RICE} value={p.rice_stage_observed} />
        <Lbl>Is there water?</Lbl>
        <Seg label="Water observed" value={p.water_observed === true ? 'yes' : p.water_observed === false ? 'no' : ''} onChange={(v) => observe(stem, p.id, 'water_observed', v)}
          options={[ESTIMATE, ['yes', 'Water'], ['no', 'No water']]} />
      </details>

      <VisitForm key={`${stem}:${p.id}`} stem={stem} p={p} />
    </div>
  );
}

// The Leaflet popup is just a container; React renders into it, so form state survives re-scoring.
export default function ParcelPopup() {
  const popup = useStore((s) => s.popup), data = useStore((s) => s.parcelData);
  if (!popup) return null;
  const p = (data[popup.stem] || []).find((q) => String(q.id) === String(popup.id));
  if (!p) return null;
  return createPortal(<Body stem={popup.stem} p={p} />, popup.container);
}
