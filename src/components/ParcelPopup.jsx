import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store';
import { controller } from '../mapController';
import { observe, reclass, saveVisit } from '../actions';

const RICE = { flooded: 'Flooded / transplanting', tillering: 'Tillering', canopy: 'Canopy / flowering', mature: 'Mature / post-harvest', fallow_or_dry: 'Fallow / dry' };
const VEG = { none: 'None', sparse: 'Sparse', dense: 'Dense' };

function ObsSelect({ stem, p, k, options, value }) {
  return (
    <select aria-label={k} value={value ?? ''} onChange={(e) => observe(stem, p.id, k, e.target.value)}>
      <option value="">Use model / NDVI estimate</option>
      {Object.entries(options).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
    </select>
  );
}

function VisitForm({ stem, p }) {
  const [f, setF] = useState({ site: p.site_id || '', dips: 0, larvae: '', anopheles: '', pupae: '', treatment: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const yn = (k, label, blank) => (
    <label>{label}: <select value={f[k]} onChange={set(k)}><option value="">{blank}</option><option value="yes">Yes</option><option value="no">No</option></select></label>
  );
  return (
    <details data-section="visit">
      <summary>Record a field visit (optional)</summary>
      <label>Permanent site ID: <input type="text" value={f.site} placeholder="e.g. KAB-001" onChange={set('site')} /></label>
      <label>Dips taken: <input type="number" min="0" step="1" value={f.dips} onChange={set('dips')} /></label>
      {yn('larvae', 'Larvae', 'Choose')}{yn('anopheles', 'Anopheles', 'Not assessed')}{yn('pupae', 'Pupae', 'Not assessed')}
      <label>Treatment: <input type="text" value={f.treatment} onChange={set('treatment')} /></label>
      <label>Notes: <input type="text" value={f.notes} onChange={set('notes')} /></label>
      <button style={{ marginTop: 8 }} className="b-go" disabled={busy}
        onClick={async () => { setBusy(true); try { await saveVisit(stem, p.id, f); } catch (_) { setBusy(false); } }}>Save field visit</button>
      <br /><small>Uses the assessment date and team under Field visit and inspection options. Reuse the same site ID on later flights.</small>
    </details>
  );
}

function Body({ stem, p }) {
  const names = useStore((s) => s.classNames), labels = useStore((s) => s.habitatLabels);
  useEffect(() => { controller.refreshPopup(); });           // content size changed: let Leaflet re-fit the popup
  const bd = p.breakdown || {}, sc = p.scores || {};
  const val = (v) => (v == null ? 'Pending observation' : `${v}/100`);
  const ids = Object.keys(names).sort((a, b) => a - b);
  return (
    <div className="popup">
      <b>{p.habitat_label || p.lulc_name}</b><br />
      Any larvae: {val(sc.any_larvae?.score)}<br />Malaria vector priority: {val(sc.malaria?.score)}<br />
      <small>Both profiles use their saved panel settings; the observation method is shared.</small>
      <table><tbody>
        <tr><td>Habitat</td><td>{bd.lulc}</td></tr>
        <tr><td>Month{bd.guessed_month ? ' (guessed)' : ''}</td><td>{bd.month}</td></tr>
        <tr><td>Water gate</td><td>{bd.gate || 'unknown'}; 0 points</td></tr>
        <tr><td>Vegetation ({bd.vegetation_category || 'unknown'})</td><td>{bd.ndvi}</td></tr>
        <tr><td>Rice ({bd.stage || 'unknown'})</td><td>{bd.rice}</td></tr>
        <tr><td>Previous-visit bonus</td><td>{bd.bonus || 0}</td></tr>
        <tr className="tot"><td>Active total</td><td>{bd.total} points</td></tr>
      </tbody></table>
      Vegetation: {bd.vegetation_source || 'not assessed'}<br />Rice stage: {bd.stage_source || 'not applicable'}<br />
      Site: {p.site_id || 'Assign a permanent site ID below'}<br />Priority: {p.inspection_priority ?? 'No action this cycle'}<br />
      Last prior visit: {p.last_visit?.visit_date || 'No record; bonus 0'}<br />
      {p.field_water_without_geometry && <>Field-confirmed water qualifies for the list; no wet footprint is available to highlight.<br /></>}
      {bd.reason && <><b>{bd.reason}</b><br /></>}
      {bd.guessed_habitat && <>Habitat weight is guessed.<br /></>}
      Model class: {p.lulc_name}<br />Region area: {Number(p.area_m2 || 0).toLocaleString()} m²<br />
      Detected wet area: {Number(p.wet_area_m2 || 0).toLocaleString()} m²<br />
      <br /><b>Rice missing? Correct model class:</b>{' '}
      <select aria-label="Model class" value={p.lulc_class} onChange={(e) => reclass(stem, p.id, e.target.value)}>
        {ids.map((id) => <option key={id} value={id}>{id} {names[id]}</option>)}
      </select>
      <details data-section="corrections">
        <summary>Correct observed habitat, water or vegetation</summary>
        Habitat: <ObsSelect stem={stem} p={p} k="habitat_observed" options={labels} value={p.habitat_observed} /><br />
        Vegetation: <ObsSelect stem={stem} p={p} k="vegetation_observed" options={VEG} value={p.vegetation_observed} /><br />
        Rice stage (rice only): <ObsSelect stem={stem} p={p} k="rice_stage_observed" options={RICE} value={p.rice_stage_observed} /><br />
        Water observed: <ObsSelect stem={stem} p={p} k="water_observed" options={{ yes: 'Yes', no: 'No' }} value={p.water_observed === true ? 'yes' : p.water_observed === false ? 'no' : null} />
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
