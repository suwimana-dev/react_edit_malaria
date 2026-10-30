// All Leaflet work lives here. React owns the UI and the data; this class only paints and reports clicks.
import L from './leafletGlobal';
import 'leaflet/dist/leaflet.css';
// Geoman (vertex editing for Reshape) must be loaded BEFORE the map and layers are created: it adds itself through init hooks.
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import { store } from './store';
import { api } from './api';
import { classCss, riskColor, riskEligible } from './lib/scoring';
import { collectWeights } from './lib/weights';

const HIDDEN = { opacity: 0, fillOpacity: 0, weight: 0 };

class MapController {
  constructor() {
    this.map = null;
    this.handlers = { select: () => {}, popup: () => {}, reshapeClick: () => {} };
    this.lulc = {}; this.risk = {}; this.boundary = {};     // per-tile L.geoJSON layers
    this.byId = {};                                         // stem -> { parcelId: sublayer } for selection styling
    this.reshapeLayer = null; this.reshapeStem = null;
    this.popup = null;
  }

  bind(handlers) { Object.assign(this.handlers, handlers); }

  init(el) {
    if (this.map) return;
    const map = this.map = L.map(el, { maxZoom: 24, zoomSnap: 0.5, zoomDelta: 0.5, preferCanvas: true }).setView([-1.94, 29.87], 9);
    // Esri's latest mosaic by default; Sentinel-2 cloudless as an alternative (bump the year in the URL if it shows blank).
    const esri = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxNativeZoom: 19, maxZoom: 24, attribution: 'Imagery &copy; Esri' });
    const s2 = L.tileLayer('https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg',
      { maxNativeZoom: 16, maxZoom: 24, attribution: 'Sentinel-2 cloudless &copy; EOX' });
    esri.addTo(map);
    L.control.scale({ metric: true, imperial: false }).addTo(map);

    this.g = {
      rgb: L.layerGroup(), lulc: L.layerGroup(), fc: L.layerGroup(), ndvi: L.layerGroup(), ndwi: L.layerGroup(),
      water: L.layerGroup().addTo(map), risk: L.layerGroup().addTo(map), lulcEdit: L.layerGroup(), boundary: L.layerGroup(),
    };
    L.control.layers({ 'Esri imagery (latest)': esri, 'Sentinel-2 cloudless (EOX)': s2 }, {
      'Breeding risk': this.g.risk, 'Water (click)': this.g.water, 'LULC editable (click to fix)': this.g.lulcEdit,
      'Class boundaries': this.g.boundary, 'RGB (true colour)': this.g.rgb, 'LULC pixel': this.g.lulc,
      'False-colour': this.g.fc, 'NDVI': this.g.ndvi, 'NDWI (water index)': this.g.ndwi,
    }, { collapsed: true }).addTo(map);

    let t = 0;
    map.on('mousemove', (e) => {                              // live coordinate readout, throttled
      const now = Date.now(); if (now - t < 80) return; t = now;
      store.set({ cursor: `${e.latlng.lat.toFixed(4)}°, ${e.latlng.lng.toFixed(4)}°` });
    });
    map.on('popupclose', (e) => { if (e.popup === this.popup) { this.popup = null; store.set({ popup: null }); } });
  }

  destroy() { if (this.map) { this.map.remove(); this.map = null; } }

  // ---------------------------------------------------------------- styles (read live from the store)
  classStyle(cid, baseOpacity) {
    const s = store.get();
    if (!s.visibleClasses.has(cid)) return HIDDEN;
    return { color: '#5a6a68', weight: 0.5, fillColor: classCss(s.classColors, cid), fillOpacity: baseOpacity, opacity: 1 };
  }
  riskStyle(f) {
    const s = store.get();
    if (!s.visibleClasses.has(f.properties.lulc_class)) return HIDDEN;
    const lower = collectWeights(s).threshold || 0;
    return { color: '#800', weight: 0.6, fillColor: riskColor(f.properties.score, lower), fillOpacity: 0.55, opacity: 1 };
  }
  restyle() {                                                 // class ticks or threshold changed: no refetch needed
    Object.values(this.lulc).forEach((l) => l.setStyle((f) => this.classStyle(f.properties.lulc_class, 0.5)));
    Object.values(this.risk).forEach((l) => l.setStyle((f) => this.riskStyle(f)));
    this.syncSelection();
  }
  ensureClassLayerVisible() {
    if (this.map && !this.map.hasLayer(this.g.lulcEdit)) this.g.lulcEdit.addTo(this.map);
  }

  // ---------------------------------------------------------------- overlays from /run
  reset() {
    Object.values(this.g).forEach((g) => g.clearLayers());
    this.lulc = {}; this.risk = {}; this.boundary = {}; this.byId = {};
    this.closePopup();
  }
  overlay(group, url, bounds, opacity) { L.imageOverlay(url, bounds, { opacity }).addTo(this.g[group]); }
  async addWater(url) {
    const res = await fetch(url); if (!res.ok) return;
    const gj = await res.json();
    L.geoJSON(gj, {
      style: { color: '#0066ff', weight: 0.6, fillColor: '#0a84ff', fillOpacity: 0.5 },
      onEachFeature: (f, l) => {
        const p = f.properties;
        l.bindPopup(`<b>Detected water candidate</b><br>Area: ${Number(p.area_m2).toLocaleString()} m²<br>Centre: ${Number(p.lat).toFixed(5)}, ${Number(p.lon).toFixed(5)}`);
      },
    }).addTo(this.g.water);
  }
  fit(boundsList) {
    if (!boundsList.length) return;
    const s = Math.min(...boundsList.map((x) => x[0][0])), w = Math.min(...boundsList.map((x) => x[0][1]));
    const n = Math.max(...boundsList.map((x) => x[1][0])), e = Math.max(...boundsList.map((x) => x[1][1]));
    // leave room on the left so parcels are not hidden under the control bar
    const left = window.innerWidth > 640 ? 430 : 20;
    this.map.fitBounds([[s, w], [n, e]], { maxZoom: 21, paddingTopLeft: [left, 20] });
  }
  flyTo(lat, lon, minZoom = 20) { this.map.setView([lat, lon], Math.max(this.map.getZoom(), minZoom)); }

  // ---------------------------------------------------------------- parcels
  drawParcels(stem, gj) {
    [[this.risk, this.g.risk], [this.lulc, this.g.lulcEdit], [this.boundary, this.g.boundary]].forEach(([store_, group]) => {
      if (store_[stem]) group.removeLayer(store_[stem]);
    });
    this.byId[stem] = {};
    this.lulc[stem] = L.geoJSON(gj, {
      style: (f) => this.classStyle(f.properties.lulc_class, 0.5),
      onEachFeature: (f, l) => {
        this.byId[stem][f.properties.id] = l;
        l.on('click', (ev) => {
          const s = store.get(), p = f.properties;
          if (s.editMode) {
            L.DomEvent.stopPropagation(ev);
            if (s.reshapeOn) this.handlers.reshapeClick(stem, l);
            else this.handlers.select(stem, p.id);
          } else this.handlers.popup(stem, p.id, ev.latlng);
        });
      },
    }).addTo(this.g.lulcEdit);
    this.boundary[stem] = L.geoJSON(gj, { style: { color: '#5a5a5a', weight: 0.6, fill: false } }).addTo(this.g.boundary);
    // Risk is drawn from the wet-only geometry, so the red follows detected water inside rice regions.
    const pos = {
      type: 'FeatureCollection',
      features: gj.features.filter((f) => riskEligible(f.properties)).map((f) => ({ ...f, geometry: f.properties.risk_geometry })),
    };
    this.risk[stem] = L.geoJSON(pos, {
      style: (f) => this.riskStyle(f),
      onEachFeature: (f, l) => l.on('click', (ev) => this.handlers.popup(stem, f.properties.id, ev.latlng)),
    }).addTo(this.g.risk);
    this.syncSelection();
  }

  // ---------------------------------------------------------------- popup host (content is rendered by React into the div)
  openPopup(stem, id, latlng) {
    this.closePopup();
    const container = L.DomUtil.create('div', 'popup-host');
    this.popup = L.popup({ maxWidth: 340, minWidth: 240 }).setLatLng(latlng).setContent(container).openOn(this.map);
    store.set({ popup: { stem, id, container } });
  }
  refreshPopup() { if (this.popup) this.popup.update(); }   // React changed the content size
  closePopup() {
    if (this.popup && this.map) this.map.closePopup(this.popup);
    this.popup = null;
    if (store.get().popup) store.set({ popup: null });
  }

  // ---------------------------------------------------------------- selection / edit mode
  syncSelection() {
    const sel = store.get().selected;
    const key = new Set(sel.map((s) => `${s.stem}:${s.id}`));
    for (const [stem, byId] of Object.entries(this.byId)) {
      for (const [id, layer] of Object.entries(byId)) {
        if (key.has(`${stem}:${id}`)) layer.setStyle({ color: '#ffcc00', weight: 3, fillOpacity: 0.7, opacity: 1 });
        else layer.setStyle(this.classStyle(layer.feature.properties.lulc_class, 0.5));
      }
    }
  }
  setEditMode(on) {
    if (on) {                                                 // clear overlapping click targets, show the editable parcels
      this.map.removeLayer(this.g.risk); this.map.removeLayer(this.g.water);
      if (!this.map.hasLayer(this.g.lulcEdit)) this.map.addLayer(this.g.lulcEdit);
      this.closePopup();
    } else {
      if (!this.map.hasLayer(this.g.risk)) this.map.addLayer(this.g.risk);
      if (!this.map.hasLayer(this.g.water)) this.map.addLayer(this.g.water);
    }
  }

  // ---------------------------------------------------------------- reshape (one parcel at a time; Geoman loads lazily)
  async ensureGeoman() { return !!(this.map && this.map.pm); }
  startReshape(stem, layer) {
    if (!this.map.pm || !layer.pm) return false;
    this.reshapeLayer = layer; this.reshapeStem = stem;
    layer.pm.enable({ allowSelfIntersection: false });
    return layer.feature.properties.id;
  }
  hasReshape() { return !!this.reshapeLayer; }
  finishReshape() {                                           // returns what the backend needs, or null
    const l = this.reshapeLayer, stem = this.reshapeStem;
    this.reshapeLayer = null; this.reshapeStem = null;
    if (!l || !l.pm) return null;
    const id = l.feature.properties.id, geom = l.toGeoJSON().geometry;
    try { l.pm.disable(); } catch (_) { /* layer already gone */ }
    return { stem, id, geom };
  }
}

export const controller = new MapController();
