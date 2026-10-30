import React from 'react';
import { store, useStore } from '../store';
import {
  run, setFiles, setFlightDate, setAssessmentDate, setIncludeMalaria, setEditMode, exportFieldRecords,
} from '../actions';
import { BUILD_ID } from '../config';
import EditTools from './EditTools.jsx';
import { Button, Card, Input, Lbl, Summary, cx } from '../ui';

const tif = (f) => /\.tiff?$/i.test(f.name);

// One line of plain checks under the file pickers.
function useFileCheck(stack, rgb) {
  const all = [...stack, ...rgb];
  if (!all.length) return null;
  const st = stack.filter(tif), rg = rgb.filter(tif), bad = all.filter((f) => !tif(f));
  const mb = [...st, ...rg].reduce((a, f) => a + f.size, 0) / 1048576;
  const msgs = [`${rg.length} RGB + ${st.length} 4-band file(s), ${mb.toFixed(0)} MB`];
  let warn = false;
  if (bad.length) { msgs.push(`${bad.length} file(s) are not .tif and will be skipped (${bad.slice(0, 2).map((f) => f.name).join(', ')}${bad.length > 2 ? '…' : ''})`); warn = true; }
  if (stack.length && rgb.length && st.length !== rg.length) { msgs.push('The two lists have different counts: some tiles will miss land cover or water.'); warn = true; }
  if (!stack.length) { msgs.push('No 4-band files: NDVI, NDWI and water will be missing.'); warn = true; }
  if (!rgb.length) { msgs.push('No RGB files: land cover and risk will be missing.'); warn = true; }
  return { text: msgs.join('. '), warn };
}

// Why the Run button is off (null = ready).
function whyNot(s) {
  if (s.running) return 'Running…';
  if (!s.backendOk) return s.goEnabled ? 'The backend does not match this viewer. See the message at the top.' : 'Connecting to the backend…';
  if (!s.goEnabled) return 'Loading the scoring settings…';
  if (!s.stackFiles.length && !s.rgbFiles.length) return 'Step 1: add at least one .tif file.';
  if (!s.flightDate) return 'Step 2: enter the date the drone flew.';
  if (s.assessmentDate < s.flightDate) return 'Step 2: the field visit date cannot be before the flight date.';
  return null;
}

const NUM = { todo: 'border-line bg-surface text-muted', current: 'border-ink bg-ink text-surface', done: 'border-ok-100 bg-ok-100 text-ok' };
function Step({ n, title, state, children }) {
  return (
    <section data-state={state} aria-label={`Step ${n}: ${title}`} className="grid grid-cols-[34px_1fr] gap-x-3 border-b border-line-soft py-4 last-of-type:border-b-0">
      <div aria-hidden="true" className={cx('grid size-[34px] place-items-center rounded-full border text-[15px] font-semibold', NUM[state])}>{state === 'done' ? '✓' : n}</div>
      <h2 className={cx('text-base font-semibold leading-[34px]', state === 'todo' && 'text-muted')}>{title}</h2>
      <div className="col-start-2">{children}</div>
    </section>
  );
}

const file = 'w-full text-[15px] text-muted';

export default function ControlBar() {
  const s = useStore((x) => x);
  const ui = s.ui, hasResults = s.riskStems.length > 0;
  const setUi = (patch) => store.set({ ui: { ...ui, ...patch } });
  const check = useFileCheck(s.stackFiles, s.rgbFiles);
  const reason = whyNot(s);
  const filesDone = s.stackFiles.length + s.rgbFiles.length > 0;
  const datesDone = !!s.flightDate && s.assessmentDate >= s.flightDate;
  const cur = !filesDone ? 1 : !datesDone ? 2 : !hasResults ? 3 : 4;
  const st = (n, done) => (done ? 'done' : cur === n ? 'current' : 'todo');
  const collapsed = ui.barCollapsed;

  return (
    <Card id="bar" className={cx('min-h-0 flex-[0_1_auto] overflow-auto px-[18px] pb-[18px]',
      'max-sm:rounded-b-none max-sm:rounded-t-card max-sm:px-4 max-sm:pb-[calc(18px+env(safe-area-inset-bottom,0px))]', collapsed && 'collapsed max-sm:pb-[env(safe-area-inset-bottom,0px)]')}>
      <div className="sticky top-0 z-[2] flex items-center justify-between gap-2 border-b border-line-soft bg-surface pb-2.5 pt-3.5">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Breeding-risk viewer</h1>
          <span className="mt-0.5 block font-mono text-xs text-muted max-sm:hidden">{s.cursor || 'Rwanda drone survey'}</span>
        </div>
        <Button variant="ghost" aria-label={collapsed ? 'Open the control panel' : 'Collapse the control panel'} aria-expanded={!collapsed}
          onClick={() => setUi({ barCollapsed: !collapsed })}>{collapsed ? '▴' : '▾'}</Button>
      </div>
      {!collapsed && (
        <div>
          <div id="buildStatus" className="mb-0.5 mt-2.5 flex items-center gap-2 text-sm">
            <span className={cx('size-2.5 shrink-0 rounded-full', s.backendOk ? 'bg-ok' : s.goEnabled ? 'bg-danger' : 'bg-amber')} />
            <span className={s.backendOk ? 'text-muted' : 'text-danger'}>
              {s.backendOk ? 'Backend connected · UI v3' : `Viewer ${BUILD_ID} · ${s.backendLine}`}
            </span>
          </div>

          <Step n={1} title="Add drone images" state={st(1, filesDone)}>
            <Lbl htmlFor="rgb">RGB tiles (land cover and risk)</Lbl>
            <input type="file" id="rgb" className={file} accept=".tif,.tiff" multiple onChange={(e) => setFiles('rgb', e.target.files)} />
            <Lbl htmlFor="stack">4-band tiles (NDVI, NDWI and water)</Lbl>
            <input type="file" id="stack" className={file} accept=".tif,.tiff" multiple onChange={(e) => setFiles('stack', e.target.files)} />
            {check && <div className={cx('mt-2 rounded-md px-2.5 py-2 text-sm', check.warn ? 'warn bg-amber-100 text-amber' : 'ok bg-ok-100 text-ok')}>{check.text}</div>}
          </Step>

          <Step n={2} title="Set the dates" state={st(2, datesDone)}>
            <Lbl htmlFor="flightDate">Flight date (all files in this batch)</Lbl>
            <Input type="date" id="flightDate" value={s.flightDate} onChange={(e) => setFlightDate(e.target.value)} />
            <Lbl htmlFor="assessmentDate">Field visit date</Lbl>
            <Input type="date" id="assessmentDate" value={s.assessmentDate} onChange={(e) => setAssessmentDate(e.target.value)} />
            <Lbl htmlFor="observer">Team or observer</Lbl>
            <Input type="text" id="observer" placeholder="Your name or team" value={s.observer} onChange={(e) => store.set({ observer: e.target.value })} />
            <Lbl className="flex items-center gap-2.5 font-medium">
              <input type="checkbox" id="includeMalaria" checked={s.includeMalaria} onChange={(e) => setIncludeMalaria(e.target.checked)} />
              Include the malaria profile in the inspection list
            </Lbl>
          </Step>

          <Step n={3} title="Run" state={st(3, hasResults)}>
            <Button id="go" variant="primary" className="min-h-[54px] w-full text-lg" disabled={!!reason} onClick={run}>{s.running ? 'Running…' : hasResults ? 'Run again' : 'Run'}</Button>
            {reason && !s.running && <p className="whynot mt-2 text-sm font-semibold text-amber" role="status">{reason}</p>}
            <details className="mt-3">
              <Summary className="min-h-10 text-[15px] font-semibold">Advanced: water sensitivity</Summary>
              <Lbl htmlFor="thr">Lower finds more water, higher finds less</Lbl>
              <div className="flex items-center gap-2.5">
                <input type="range" id="thr" min="-0.15" max="0.15" step="0.01" value={s.sensitivity} onChange={(e) => store.set({ sensitivity: +e.target.value })} />
                <span className="w-12 text-right font-mono text-sm">{(+s.sensitivity).toFixed(2)}</span>
              </div>
            </details>
          </Step>

          <Step n={4} title="Review and correct" state={hasResults ? 'current' : 'todo'}>
            <div className="grid grid-cols-2 gap-2.5 [&>button]:min-h-[50px] [&>button]:text-[15px]">
              <Button id="inspectionBtn" disabled={!hasResults} onClick={() => setUi({ summaryOpen: true, summaryTab: 'inspection', barCollapsed: window.innerWidth <= 640 ? true : ui.barCollapsed })}>Inspection list</Button>
              <Button id="editBtn" variant="blue" disabled={!hasResults} onClick={() => setEditMode(!s.editMode)}>{s.editMode ? 'Finish editing' : 'Edit borders'}</Button>
              <Button id="settingsBtn" onClick={() => setUi({ settingsOpen: !ui.settingsOpen })}>Risk settings</Button>
              <Button id="exportBtn" onClick={exportFieldRecords}>Export field records</Button>
            </div>
            {!hasResults && <p className="mt-1.5 text-sm text-muted">These unlock after the first run.</p>}
            {s.editMode && <EditTools />}
          </Step>

          <div className={cx('mt-2.5 text-[13px]', s.storageError ? 'font-semibold text-danger' : 'text-muted')}>
            {s.storageError ? `Field records are NOT being saved: ${s.storageError}` : 'Field storage is available. Use "Save field visit" to keep observations.'}
          </div>
          <div id="status" role="status" aria-live="polite"
            className={cx('mt-3 whitespace-pre-wrap text-[15px] leading-normal', s.status.kind === 'err' ? 'err font-semibold text-danger' : s.status.kind === 'ok' ? 'ok font-semibold text-ok' : 'text-muted')}>{s.status.msg}</div>
        </div>
      )}
    </Card>
  );
}
