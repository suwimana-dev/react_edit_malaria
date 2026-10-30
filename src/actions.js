// Everything the viewer does: talk to the backend, update the store, tell the map controller what to paint.
import { store } from './store';
import { api, checkBuild, getJson, postJson, uploadChunked } from './api';
import { BUILD_ID } from './config';
import { controller } from './mapController';
import { collectWeights, allProfileWeights, dateContext, validDates, currentMonth, clone } from './lib/weights';
import { riskEligible, downloadBlob } from './lib/scoring';

const tif = (f) => /\.tiff?$/i.test(f.name);

export function setStatus(msg, kind = '') {
  const s = store.get();
  store.set({ status: { msg, kind }, overlay: s.overlay.active ? { ...s.overlay, msg } : s.overlay });
}
const setOverlay = (patch) => store.set((s) => ({ overlay: { ...s.overlay, ...patch } }));

function datesOk() {
  if (validDates()) return true;
  setStatus('Enter the imagery acquisition date and an assessment date on or after it.', 'err');
  return false;
}

// ------------------------------------------------------------------ backend handshake
let verifiedAt = 0;
export async function verifyBackend(force = false) {
  if (!force && Date.now() - verifiedAt < 30000) return true;      // one ping per 30 s is plenty
  try {
    const r = await fetch(api('/ping'), { cache: 'no-store' });
    if (!r.ok) throw new Error('Backend version check failed');
    const data = await r.json(); checkBuild(data);
    const o = data.configured_band_order;
    store.set({ backendOk: true, backendLine: `Viewer ${BUILD_ID} · backend ${data.build_id} · matched${o ? ` · Red=${o[0]} Green=${o[1]} NIR=${o[2]}` : ''}` });
    verifiedAt = Date.now();
    return true;
  } catch (e) {
    store.set({ backendOk: false, backendLine: e.message });
    setStatus(e.message, 'err');
    return false;
  }
}

export async function loadDefaults() {
  if (!await verifyBackend(true)) return;
  const data = await getJson('/risk/defaults'); checkBuild(data);
  const active = store.get().activeProfile;
  store.set({
    classNames: data.class_names, profileDefaults: data.profiles, habitatLabels: data.habitat_labels,
    profileWeights: clone(data.profiles), vegMode: data.profiles[active]?.vegetation_mode || 'edge_proxy', goEnabled: true,
  });
  await loadWeightVersions();
}

// ------------------------------------------------------------------ inputs that trigger a re-score
export async function setFlightDate(v) {
  store.set({ flightDate: v });
  const s = store.get();
  if (v && s.riskStems.length && validDates()) { store.set({ observations: {} }); await rescoreAll(); }
}
export async function setAssessmentDate(v) {
  store.set({ assessmentDate: v });
  if (store.get().riskStems.length && datesOk()) await rescoreAll();
}
export async function setIncludeMalaria(v) {
  store.set({ includeMalaria: v });
  if (store.get().riskStems.length && datesOk()) await rescoreAll();
}
export async function setProfile(key) {
  store.set({ activeProfile: key });
  if (store.get().riskStems.length) await rescoreAll();
}

// ------------------------------------------------------------------ parcels
function applyGeojson(stem, gj) {
  checkBuild(gj);
  store.set((s) => ({
    storageError: gj.storage_error || null,
    parcelData: { ...s.parcelData, [stem]: gj.features.map((f) => ({ ...f.properties, geometry: f.geometry })) },
  }));
  controller.drawParcels(stem, gj);
}

export async function rescoreTile(stem) {
  try {
    if (!await verifyBackend()) return 0;
    const s = store.get();
    const gj = await postJson('/rescore', {
      ...dateContext(s), stem, month: currentMonth(s), weights: collectWeights(s),
      overrides: s.overrides[stem] || {}, observations: s.observations[stem] || {}, parcels_data: s.parcelData[stem],
    });
    if (gj.error) { setStatus(gj.error, 'err'); return 0; }
    applyGeojson(stem, gj);
    return gj.features.filter((f) => riskEligible(f.properties)).length;
  } catch (e) { setStatus(String(e.message || e), 'err'); return 0; }
}

export async function rescoreAll() {
  if (!datesOk()) return;
  // Tiles are independent (each call touches only its own stem), so they run concurrently.
  const stems = store.get().riskStems;
  const counts = await Promise.all(stems.map(rescoreTile));
  if (!store.get().editMode) setStatus(`Re-scored: ${counts.reduce((a, b) => a + b, 0)} positive parcels across ${stems.length} tile(s).`, 'ok');
}

async function editTile(stem, edits) {
  try {
    if (!await verifyBackend()) return false;
    const s = store.get();
    const gj = await postJson('/edit', {
      ...dateContext(s), stem, edits, month: currentMonth(s), weights: collectWeights(s),
      overrides: s.overrides[stem] || {}, observations: s.observations[stem] || {},
    });
    if (gj.error) { setStatus(gj.error, 'err'); return false; }
    applyGeojson(stem, gj);
    return true;
  } catch (e) { setStatus(String(e.message || e), 'err'); return false; }
}

// ------------------------------------------------------------------ popup actions
export function openParcelPopup(stem, id, latlng) { controller.openPopup(stem, id, latlng); }

export async function observe(stem, id, key, value) {
  const obs = clone(store.get().observations);
  obs[stem] = obs[stem] || {}; obs[stem][id] = obs[stem][id] || {};
  obs[stem][id][key] = key === 'water_observed' ? (value === '' ? null : value === 'yes') : (value || null);
  store.set({ observations: obs });
  await rescoreTile(stem);
  setStatus(`Region ${id}: observation updated and re-scored. Save field visit to retain it.`, 'ok');
}

export async function reclass(stem, id, cls) {
  const ov = clone(store.get().overrides);
  ov[stem] = ov[stem] || {}; ov[stem][id] = parseInt(cls, 10);
  store.set({ overrides: ov });
  await rescoreTile(stem);
  controller.closePopup();
  setStatus(`Parcel ${id} reclassified to ${cls} (${store.get().classNames[cls]}); re-scored.`, 'ok');
}

const requestIds = {};
export async function saveVisit(stem, id, form) {
  if (!datesOk()) return;
  const s = store.get();
  const p = (s.parcelData[stem] || []).find((q) => String(q.id) === String(id));
  if (!p) return;
  const tri = (v) => (v === 'yes' ? true : v === 'no' ? false : null);
  const visitObs = {};
  for (const k of ['habitat_observed', 'vegetation_observed', 'rice_stage_observed', 'water_observed']) visitObs[k] = p[k] ?? null;
  const key = `${stem}:${id}:${s.assessmentDate}`;
  const body = {
    ...dateContext(s), request_id: requestIds[key] || (requestIds[key] = crypto.randomUUID()),
    visit_date: s.assessmentDate, site_id: form.site, team: s.observer, geometry: p.geometry, parcel: p,
    weights: collectWeights(s), observations: visitObs, scores: p.scores, dips_taken: Number(form.dips),
    larvae_found: tri(form.larvae), anopheles_found: tri(form.anopheles), pupae_found: tri(form.pupae),
    treatment: form.treatment, notes: form.notes,
  };
  try {
    const result = await postJson('/field/save', body);
    if (result.error) throw new Error(result.error);
    delete requestIds[key];
    const obs = clone(store.get().observations);
    obs[stem] = obs[stem] || {}; obs[stem][id] = { ...visitObs, site_id: result.site_id };
    store.set({ observations: obs });
    await rescoreTile(stem);
    setStatus(`Field visit saved for ${result.site_id}.`, 'ok');
    controller.closePopup();
  } catch (e) {
    setStatus(`Field visit NOT saved: ${e.message}`, 'err');
    throw e;
  }
}

export async function exportFieldRecords() {
  try {
    const payload = await getJson('/field/export');
    downloadBlob(JSON.stringify(payload, null, 2), `field-records-${store.get().assessmentDate}.json`, 'application/json');
  } catch (e) { setStatus(e.message, 'err'); }
}

// ------------------------------------------------------------------ weight versions
export async function loadWeightVersions() {
  try {
    const data = await getJson('/weights/versions');
    store.set({ weightVersions: data.versions || [] });
  } catch (_) { /* optional feature: the storage line in the UI explains when it is unavailable */ }
}
export async function saveWeightVersion(name, reason) {
  const s = store.get();
  if (!name || !reason) { setStatus('Give the weight version a name and a reason.', 'err'); return false; }
  if (!s.observer) { setStatus('Enter the team / observer before saving weights.', 'err'); return false; }
  const r = await postJson('/weights/version', { name, reason, team: s.observer, settings: allProfileWeights(s) });
  if (r.error) { setStatus(`Weights NOT saved: ${r.error}`, 'err'); return false; }
  setStatus(`Weight version saved: ${name}`, 'ok');
  await loadWeightVersions();
  return true;
}
export async function applyWeightVersion(index) {
  const v = store.get().weightVersions[index]; if (!v) return;
  const s = store.get();
  const merged = { ...clone(s.profileDefaults), ...clone(v.new_settings) };
  store.set({ profileWeights: merged, vegMode: merged[s.activeProfile]?.vegetation_mode || s.vegMode });
  if (s.riskStems.length && validDates()) await rescoreAll();
  setStatus(`Loaded weight version: ${v.name}`, 'ok');
}

// ------------------------------------------------------------------ class legend
export function setClassVisible(cid, on) {
  const next = new Set(store.get().visibleClasses);
  on ? next.add(cid) : next.delete(cid);
  store.set({ visibleClasses: next });
  if (next.size < store.get().legendItems.length) controller.ensureClassLayerVisible();
  controller.restyle();
}
export function setAllVisible(on) {
  const s = store.get();
  store.set({ visibleClasses: new Set(on ? s.legendItems.map((i) => i.id) : []) });
  if (!on) controller.ensureClassLayerVisible();
  controller.restyle();
}

// ------------------------------------------------------------------ border editing
export function setEditMode(on) {
  if (!on && store.get().reshapeOn) commitReshape();
  store.set({ editMode: on, reshapeOn: false, selected: [] });
  controller.setEditMode(on);
  controller.syncSelection();
  setStatus(on ? 'Edit mode: click parcels to select.' : store.get().status.msg, on ? 'ok' : store.get().status.kind);
}

export function toggleSelect(stem, id) {
  let sel = store.get().selected;
  if (sel.length && sel[0].stem !== stem) sel = [];                // one tile at a time
  const i = sel.findIndex((x) => x.id === id);
  sel = i >= 0 ? sel.filter((_, j) => j !== i) : [...sel, { stem, id }];
  store.set({ selected: sel });
  controller.syncSelection();
  setStatus(`${sel.length} selected on ${stem}.`, 'ok');
}
function takeSelection() {
  const sel = store.get().selected;
  store.set({ selected: [] }); controller.syncSelection();
  return sel;
}
export async function deleteSelected() {
  if (!store.get().selected.length) return setStatus('Select parcel(s) to delete first.', 'err');
  const sel = takeSelection(), stem = sel[0].stem, ids = sel.map((x) => x.id);
  if (await editTile(stem, { deleted: ids })) setStatus(`Deleted ${ids.length} parcel(s) on ${stem}.`, 'ok');
}
export async function mergeSelected() {
  if (store.get().selected.length < 2) return setStatus('Select 2+ parcels on the same tile to merge.', 'err');
  const sel = takeSelection(), stem = sel[0].stem, ids = sel.map((x) => x.id);
  if (await editTile(stem, { merged: [ids] })) setStatus(`Merged ${ids.length} parcels into one plot on ${stem}.`, 'ok');
}
// Reclassify is a scoring change, not a shape change: same overrides + /rescore path as the single-parcel popup.
export async function reclassSelected(cls) {
  if (!store.get().selected.length) return setStatus('Select parcel(s) to reclassify first.', 'err');
  const sel = takeSelection(), stem = sel[0].stem;
  const ov = clone(store.get().overrides);
  ov[stem] = ov[stem] || {};
  sel.forEach((x) => { ov[stem][x.id] = parseInt(cls, 10); });
  store.set({ overrides: ov });
  await rescoreTile(stem);
  setStatus(`Reclassified ${sel.length} parcel(s) on ${stem} to ${store.get().classNames[cls]}.`, 'ok');
}

export async function toggleReshape() {
  if (!await controller.ensureGeoman()) {
    return setStatus('Reshape needs the Geoman library, which did not load (check the internet connection). Delete & Merge still work.', 'err');
  }
  const on = !store.get().reshapeOn;
  store.set({ reshapeOn: on });
  if (on) {
    store.set({ selected: [] }); controller.syncSelection();
    setStatus('Reshape on: click ONE parcel to edit its corners; drag them, then click the parcel again (or Done) to apply.', 'ok');
  } else commitReshape();
}
export async function reshapeClick(stem, layer) {
  if (controller.hasReshape()) return commitReshape();
  const id = controller.startReshape(stem, layer);
  if (id === false) setStatus('Reshape needs Geoman, which did not load.', 'err');
  else setStatus(`Editing corners of parcel ${id}. Drag them, then click the parcel again (or Done) to apply.`, 'ok');
}
async function commitReshape() {
  const r = controller.finishReshape(); if (!r) return;
  if (await editTile(r.stem, { reshaped: { [r.id]: r.geom } })) setStatus(`Reshaped parcel ${r.id} on ${r.stem}; re-measured & re-scored.`, 'ok');
}

// ------------------------------------------------------------------ the Run button
export function setFiles(kind, files) { store.set({ [kind === 'stack' ? 'stackFiles' : 'rgbFiles']: Array.from(files) }); }

export async function run() {
  if (!datesOk()) return;
  const s0 = store.get();
  if (!s0.stackFiles.length && !s0.rgbFiles.length) return setStatus('Choose a stack folder and/or an RGB folder.', 'err');
  store.set({ running: true, overlay: { active: true, msg: 'Verifying backend…', pct: -1 } });
  const finish = () => store.set({ running: false, overlay: { active: false, msg: '', pct: -1 } });
  if (!await verifyBackend(true)) return finish();
  if (s0.editMode) setEditMode(false);

  controller.reset();
  store.set({ riskStems: [], overrides: {}, observations: {}, parcelData: {}, selected: [], legendItems: [], visibleClasses: new Set() });
  setOverlay({ msg: 'Uploading files…', pct: -1 });

  const stackTifs = s0.stackFiles.filter(tif), rgbTifs = s0.rgbFiles.filter(tif);
  const totalFiles = stackTifs.length + rgbTifs.length;
  const totalBytes = [...stackTifs, ...rgbTifs].reduce((a, f) => a + f.size, 0);
  const sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2);
  let uploaded = 0, n = 0;
  const stackPaths = [], rgbPaths = [];
  const onBytes = (b) => { uploaded += b; setOverlay({ pct: totalBytes ? (uploaded / totalBytes) * 100 : 0 }); };
  try {
    for (const f of stackTifs) { setStatus(`Uploading stack file ${++n}/${totalFiles}: ${f.name}`); stackPaths.push(await uploadChunked(f, 'stack', sessionId, onBytes)); }
    for (const f of rgbTifs) { setStatus(`Uploading RGB file ${++n}/${totalFiles}: ${f.name}`); rgbPaths.push(await uploadChunked(f, 'rgb', sessionId, onBytes)); }
  } catch (e) { finish(); return setStatus(`Upload failed: ${e}`, 'err'); }

  setOverlay({ pct: -1 });
  setStatus('Processing…');
  const s = store.get();
  const fd = new FormData();
  fd.append('stack_gcs_paths', JSON.stringify(stackPaths));
  fd.append('rgb_gcs_paths', JSON.stringify(rgbPaths));
  fd.append('session_id', sessionId);
  fd.append('ndwi_margin', s.sensitivity);
  fd.append('flight_month', currentMonth(s));
  fd.append('flight_date', s.flightDate); fd.append('assessment_date', s.assessmentDate);
  fd.append('include_malaria', String(s.includeMalaria));
  fd.append('profile_weights_json', JSON.stringify(allProfileWeights(s)));
  fd.append('weights_json', JSON.stringify(collectWeights(s)));

  const poll = setInterval(async () => {                          // the backend reports its stage while /run is in flight
    try {
      const p = await (await fetch(api(`/progress/${sessionId}`))).json();
      setOverlay({ pct: p.total > 0 ? Math.round((p.step / p.total) * 100) : 0, msg: p.message || 'Processing…' });
    } catch (_) { /* next tick */ }
  }, 2000);

  let data;
  try {
    const res = await fetch(api('/run'), { method: 'POST', body: fd });
    clearInterval(poll);
    const text = await res.text();
    if (!text) { finish(); return setStatus('Empty response (check the backend log).', 'err'); }
    try { data = JSON.parse(text); } catch (_) { finish(); return setStatus(`Bad response:\n${text.slice(0, 300)}`, 'err'); }
    if (data.error) { finish(); return setStatus(data.error, 'err'); }
    checkBuild(data);
  } catch (e) { clearInterval(poll); finish(); return setStatus(`Request failed: ${e}`, 'err'); }

  try { await showResults(data); } catch (e) { setStatus(String(e.message || e), 'err'); }
  finish();
}

async function showResults(data) {
  // legend first, so parcels are drawn with their class colours and visibility already known
  const items = data.lulc_legend || [];
  const names = { ...store.get().classNames }, colors = {};
  items.forEach((it) => { names[it.id] = it.name; colors[it.id] = it.color; });
  store.set({ legendItems: items, classNames: names, classColors: colors, visibleClasses: new Set(items.map((i) => i.id)) });

  const bust = `?t=${Date.now()}`, files = api('/files/'), all = [], stems = new Set(), highWater = [], water = [];
  for (const t of data.stack || []) {
    controller.overlay('fc', files + t.falsecolor + bust, t.bounds, 1.0);
    controller.overlay('ndvi', files + t.ndvi + bust, t.bounds, 0.9);
    if (t.ndwi) controller.overlay('ndwi', files + t.ndwi + bust, t.bounds, 0.9);
    water.push(controller.addWater(files + t.water_geojson + bust));
    if (t.risk_stem) stems.add(t.risk_stem);
    // No universal safe cutoff for water share: 30% is a nudge to inspect the NDWI layer, not a failure.
    if (t.water_pct > 30) highWater.push(`${t.name} (${t.water_pct}%)`);
    all.push(t.bounds);
  }
  await Promise.all(water);
  for (const t of data.rgb || []) {
    controller.overlay('rgb', files + t.rgb + bust, t.bounds, 1.0);
    if (t.lulc) controller.overlay('lulc', files + t.lulc + bust, t.bounds, 0.8);
    if (t.risk_stem) stems.add(t.risk_stem);
    if (t.regions_geojson) applyGeojson(t.risk_stem, t.regions_geojson);
    all.push(t.bounds);
  }
  store.set({ riskStems: [...stems] });
  controller.fit(all);
  if (stems.size) await rescoreAll();
  else {
    const errs = data.errors || [];
    setStatus(`Loaded. ${errs.length ? `Some skipped:\n${errs.join('\n')}` : ''}`, errs.length ? 'err' : 'ok');
  }
  if (highWater.length) {
    const cur = store.get().status.msg;
    setStatus(`${cur}\n⚠ water_pct > 30% on: ${highWater.join(', ')} — check the NDWI (water index) layer against NDVI/false-colour for these tiles before trusting the water mask.`, 'err');
  }
}

controller.bind({ select: toggleSelect, popup: openParcelPopup, reshapeClick });
