import React from 'react';
import { store, useStore } from '../store';
import {
  run, setFiles, setFlightDate, setAssessmentDate, setIncludeMalaria, setEditMode, exportFieldRecords, setStatus,
} from '../actions';
import { BUILD_ID } from '../config';
import EditTools from './EditTools.jsx';

const tif = (f) => /\.tiff?$/i.test(f.name);

function UploadCheck() {
  const stack = useStore((s) => s.stackFiles), rgb = useStore((s) => s.rgbFiles);
  const all = [...stack, ...rgb];
  if (!all.length) return null;
  const st = stack.filter(tif), rg = rgb.filter(tif), bad = all.filter((f) => !tif(f));
  const mb = [...st, ...rg].reduce((a, f) => a + f.size, 0) / 1048576;
  const msgs = [`${st.length} stack + ${rg.length} RGB files · ${mb.toFixed(0)} MB`];
  let warn = false;
  if (bad.length) { msgs.push(`${bad.length} non-.tif file(s) will be skipped (${bad.slice(0, 2).map((f) => f.name).join(', ')}${bad.length > 2 ? '…' : ''})`); warn = true; }
  if (stack.length && rgb.length && st.length !== rg.length) { msgs.push('Stack and RGB counts differ: some tiles will have no land cover or no water layer.'); warn = true; }
  if (!stack.length || !rgb.length) { msgs.push(!stack.length ? 'No stack files: NDVI/NDWI and water will be missing.' : 'No RGB files: land cover and risk will be missing.'); warn = true; }
  return <div className={`sp-check ${warn ? 'warn' : 'ok'}`}>{msgs.join(' — ')}</div>;
}

export default function ControlBar() {
  const s = useStore((x) => x);
  const ui = s.ui;
  const setUi = (patch) => store.set({ ui: { ...ui, ...patch } });
  return (
    <div id="bar" className={`card${ui.barCollapsed ? ' collapsed' : ''}`}>
      <div className="bar-head">
        <div className="bar-head-titles">
          <h1>Breeding-risk viewer</h1>
          <span className="coord-readout">{s.cursor || '−1.94°, 29.87°'}</span>
        </div>
        <button className="icon-btn" aria-label={ui.barCollapsed ? 'Expand panel' : 'Collapse panel'} aria-expanded={!ui.barCollapsed}
          title={ui.barCollapsed ? 'Expand' : 'Collapse'} onClick={() => setUi({ barCollapsed: !ui.barCollapsed })}>▾</button>
      </div>
      {!ui.barCollapsed && (
        <div>
          <p className="sub">Rwanda drone survey — water, NDVI, land cover &amp; parcel risk</p>
          <p className={`sub${s.backendOk ? '' : ' err'}`} id="buildStatus">
            {s.backendOk ? s.backendLine : `Viewer ${BUILD_ID} · ${s.backendLine}`}
          </p>

          <div className="field">
            <label htmlFor="stack">4-band stack files (.tif)</label>
            <input type="file" id="stack" accept=".tif,.tiff" multiple onChange={(e) => setFiles('stack', e.target.files)} />
          </div>
          <div className="field">
            <label htmlFor="rgb">RGB files (.tif) — for land cover &amp; risk</label>
            <input type="file" id="rgb" accept=".tif,.tiff" multiple onChange={(e) => setFiles('rgb', e.target.files)} />
          </div>
          <UploadCheck />

          <div className="field">
            <label htmlFor="flightDate">Flight acquisition date (all files in this batch)</label>
            <input type="date" id="flightDate" value={s.flightDate} onChange={(e) => setFlightDate(e.target.value)} />
            <details>
              <summary>Field visit and inspection options</summary>
              <label htmlFor="assessmentDate">Assessment / field visit date</label>
              <input type="date" id="assessmentDate" value={s.assessmentDate} onChange={(e) => setAssessmentDate(e.target.value)} />
              <label htmlFor="observer">Team / observer</label>
              <input type="text" id="observer" placeholder="Your name or team" value={s.observer} onChange={(e) => store.set({ observer: e.target.value })} />
              <label><input type="checkbox" id="includeMalaria" checked={s.includeMalaria} onChange={(e) => setIncludeMalaria(e.target.checked)} style={{ width: 'auto', marginRight: 6 }} />
                Include malaria profile in the combined inspection list</label>
            </details>
          </div>

          <div className="field">
            <label htmlFor="thr">Water sensitivity — lower catches more</label>
            <div className="thr">
              <input type="range" id="thr" min="-0.15" max="0.15" step="0.01" value={s.sensitivity} onChange={(e) => store.set({ sensitivity: +e.target.value })} />
              <span className="thr-val">{(+s.sensitivity).toFixed(2)}</span>
            </div>
          </div>

          <div className="btns">
            <button id="go" className="b-go" disabled={!s.goEnabled || s.running} onClick={run}>Run</button>
            <button id="settingsBtn" onClick={() => setUi({ settingsOpen: !ui.settingsOpen })}>Risk settings</button>
            <button id="editBtn" className="b-blue" onClick={() => setEditMode(!s.editMode)}>
              {s.editMode ? 'Editing — click Done' : 'Edit borders'}
            </button>
            <button id="inspectionBtn" onClick={() => (Object.keys(s.parcelData).length ? setUi({ summaryOpen: true, summaryTab: 'inspection' }) : setStatus('No qualifying regions yet: run a batch first.', 'err'))}>Inspection list</button>
            <button id="exportBtn" onClick={exportFieldRecords}>Export field records</button>
          </div>

          <div className="hint" id="storageStatus" style={{ marginTop: 10 }}>
            {s.storageError ? `Field records are NOT being saved: ${s.storageError}` : 'Field storage available. Use Save field visit to retain observations.'}
          </div>
          {s.editMode && <EditTools />}
          <div id="status" className={s.status.kind}>{s.status.msg}</div>
        </div>
      )}
    </div>
  );
}
