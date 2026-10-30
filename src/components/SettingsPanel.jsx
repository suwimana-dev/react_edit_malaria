import React, { useState } from 'react';
import { store, useStore } from '../store';
import { setWeight, currentMonth } from '../lib/weights';
import { GUESSED_MONTHS, MONTHS } from '../lib/scoring';
import { setProfile, rescoreAll, saveWeightVersion, applyWeightVersion } from '../actions';
import NumField from './NumField.jsx';

export default function SettingsPanel() {
  const open = useStore((s) => s.ui.settingsOpen), pw = useStore((s) => s.profileWeights);
  const active = useStore((s) => s.activeProfile), vegMode = useStore((s) => s.vegMode);
  const labels = useStore((s) => s.habitatLabels), versions = useStore((s) => s.weightVersions);
  const flight = useStore((s) => s.flightDate);
  const [saving, setSaving] = useState(false), [name, setName] = useState(''), [reason, setReason] = useState('');
  if (!open || !pw || !pw[active]) return null;
  const w = pw[active], m = currentMonth();
  const F = (label, path, props = {}) => (
    <>
      <label>{label}</label>
      <NumField label={label} value={path.reduce((o, k) => o?.[k], w)} onChange={(v) => setWeight(path, v)} {...props} />
    </>
  );
  return (
    <div id="panel" className="card">
      <h2>Risk scoring</h2>
      <p className="lead">Survey weights score detected water inside eligible habitats. Scores are points out of 100, not verified probabilities. NDVI estimates are provisional substitutes for field observations.</p>
      <div className="g">
        <label htmlFor="w_profile">Profile</label>
        <select id="w_profile" value={active} onChange={(e) => setProfile(e.target.value)}>
          <option value="any_larvae">Any larvae</option><option value="malaria">Malaria vector priority</option>
        </select>
        <label htmlFor="w_month">Flight month</label>
        <select id="w_month" disabled value={m} onChange={() => {}}>{MONTHS.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}</select>
        {F('Month points', ['month', String(m)])}
        {F('Positive threshold (points)', ['threshold'])}
      </div>
      <p className="lead" id="monthNote">
        {GUESSED_MONTHS.includes(m) ? 'Month weight guessed: no survey data yet.' : 'Month weight supplied from the survey.'}
        {!flight && ' Set the flight date to pick the month.'}
      </p>

      <h3>Water &amp; vegetation</h3>
      <div className="g">
        <label>Water gate</label><span>No water → 0; water adds 0 points</span>
        <label htmlFor="w_veg_mode">Observation method</label>
        <select id="w_veg_mode" value={vegMode} onChange={(e) => store.set({ vegMode: e.target.value })}>
          <option value="edge_proxy">2 m water-edge estimate (provisional)</option>
          <option value="ndvi_proxy">Legacy region NDVI estimate</option>
          <option value="observed_only">Field observations required</option>
        </select>
        {F('Vegetation: none', ['vegetation_points', 'none'])}
        {F('Vegetation: sparse', ['vegetation_points', 'sparse'])}
        {F('Vegetation: dense', ['vegetation_points', 'dense'])}
        {F('NDVI: none below', ['ndvi_none_max'], { step: 0.05 })}
        {F('NDVI: dense from', ['ndvi_dense_min'], { step: 0.05 })}
        {F('Rice: flooded', ['rice_points', 'flooded'])}
        {F('Rice: tillering', ['rice_points', 'tillering'])}
        {F('Rice: canopy', ['rice_points', 'canopy'])}
        {F('Rice: mature', ['rice_points', 'mature'])}
      </div>
      <p className="lead">Water-edge vegetation estimates and rice-stage estimates are provisional. The edge estimate uses NDVI &gt;0.4 within a 2 m exterior band around each detected wet footprint: &lt;10% none, 10–50% sparse, &gt;50% dense. The two editable NDVI cutoffs apply only to legacy region-mean mode. Field observations override estimates.</p>

      <h3>Survey habitat points</h3>
      <div className="g">
        {Object.entries(labels).map(([h, label]) => (
          <React.Fragment key={h}>
            <label>{label}{h === 'human_settlement' ? ' (guessed)' : ''}</label>
            <NumField label={label} min={0} value={w.habitat_points?.[h]} onChange={(v) => setWeight(['habitat_points', h], v)} />
          </React.Fragment>
        ))}
      </div>

      <details>
        <summary>Reported survey results</summary>
        <p className="lead">Supplied results from the same survey used to fit the weights; not independent validation of this NDVI-based implementation.</p>
        <table>
          <thead><tr><th>Profile / cutoff</th><th>Flagged</th><th>Target larvae among flagged</th><th>Sites caught</th></tr></thead>
          <tbody>
            <tr><td>Any larvae / 50</td><td>72%</td><td>63%</td><td>84%</td></tr>
            <tr><td>Any larvae / 60</td><td>51%</td><td>67%</td><td>64%</td></tr>
            <tr><td>Malaria / 30</td><td>23%</td><td>30%</td><td>75%</td></tr>
            <tr><td>Malaria / 40</td><td>20%</td><td>32%</td><td>71%</td></tr>
          </tbody>
        </table>
        <p className="lead">Malaria vector priority refers to Anopheles-related breeding prioritization, not a person's chance of malaria.</p>
      </details>

      <div className="btns">
        <button id="applyBtn" className="b-amber" onClick={rescoreAll}>Apply &amp; re-score</button>
        <button id="saveWeightsBtn" onClick={() => setSaving(!saving)}>Save named weight version</button>
      </div>
      {saving && (
        <div className="save-form">
          <input type="text" placeholder="Version name" aria-label="Weight version name" value={name} onChange={(e) => setName(e.target.value)} />
          <input type="text" placeholder="Reason for this version" aria-label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button className="b-go" onClick={async () => { if (await saveWeightVersion(name, reason)) { setSaving(false); setName(''); setReason(''); } }}>Save version</button>
        </div>
      )}
      <div className="field">
        <select id="weightVersions" aria-label="Load a saved weight version" value="" onChange={(e) => applyWeightVersion(Number(e.target.value))}>
          <option value="">Load a saved weight version</option>
          {versions.map((v, i) => <option key={i} value={i}>{v.name} · {v.team}</option>)}
        </select>
      </div>
    </div>
  );
}
