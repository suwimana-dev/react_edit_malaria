import { store } from '../store';

export const clone = (o) => JSON.parse(JSON.stringify(o));

export const currentMonth = (s = store.get()) => (s.flightDate ? Number(s.flightDate.slice(5, 7)) : 1);

// Weights of the active profile exactly as the backend expects them.
export function collectWeights(s = store.get()) {
  const w = clone(s.profileWeights[s.activeProfile]);
  w.profile = s.activeProfile;
  w.vegetation_mode = s.vegMode;
  w.ndwi_points = 0; w.require_water = true; w.rice_only = false;
  return w;
}

export function allProfileWeights(s = store.get()) {
  const values = clone(s.profileWeights);
  for (const v of Object.values(values)) v.vegetation_mode = s.vegMode;
  values[s.activeProfile] = collectWeights(s);
  return values;
}

export function dateContext(s = store.get()) {
  return {
    flight_date: s.flightDate, assessment_date: s.assessmentDate,
    include_malaria: s.includeMalaria, profile_weights: allProfileWeights(s),
  };
}

export function validDates(s = store.get()) {
  return !!s.flightDate && !!s.assessmentDate && s.assessmentDate >= s.flightDate;
}

// Immutable update of one numeric/string weight inside the active profile. path e.g. ['habitat_points','rice'].
export function setWeight(path, value) {
  const s = store.get();
  const next = clone(s.profileWeights);
  let node = next[s.activeProfile];
  for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
  node[path[path.length - 1]] = value;
  store.set({ profileWeights: next });
}
