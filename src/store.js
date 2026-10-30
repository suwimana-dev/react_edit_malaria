// Tiny external store (zustand-style). Actions read store.get() so async code never sees stale React state.
import { useSyncExternalStore } from 'react';

export function createStore(initial) {
  let state = initial;
  const listeners = new Set();
  return {
    get: () => state,
    set: (patch) => {
      const next = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...next };
      listeners.forEach((l) => l());
    },
    subscribe: (l) => { listeners.add(l); return () => listeners.delete(l); },
  };
}

export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const store = createStore({
  backendLine: 'checking backend…', backendOk: false,
  status: { msg: '', kind: '' },
  overlay: { active: false, msg: '', pct: -1 },
  running: false, goEnabled: false,

  classNames: {}, classColors: {}, legendItems: [], visibleClasses: new Set(),
  profileDefaults: {}, habitatLabels: {}, profileWeights: null, activeProfile: 'any_larvae', vegMode: 'edge_proxy',
  weightVersions: [], storageError: null,

  flightDate: '', assessmentDate: todayStr(), observer: '', includeMalaria: false, sensitivity: 0,
  stackFiles: [], rgbFiles: [],

  riskStems: [], parcelData: {}, overrides: {}, observations: {},

  editMode: false, reshapeOn: false, selected: [], popup: null,
  ui: { barCollapsed: false, settingsOpen: false, summaryOpen: true, summaryTab: 'overview', legendCollapsed: false },
});

export function useStore(selector) {
  return useSyncExternalStore(store.subscribe, () => selector(store.get()));
}
