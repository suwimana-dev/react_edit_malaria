export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const GUESSED_MONTHS = [1, 9, 10, 11, 12];

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmt = (n) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });

export function riskColor(score, lower) {
  const t = Math.max(0, Math.min(1, (score - lower) / Math.max(1, 100 - lower)));
  return `rgb(200,${Math.round(160 * (1 - t))},0)`;
}

// Parcels drawn as risk: eligible, positive, scored, and carrying the wet-only geometry.
export function riskEligible(p) {
  return p.risk_eligible === true && p.positive === true && Number(p.score) > 0 &&
    Number(p.risk_area_m2) > 0 && !!p.risk_geometry;
}

export function classCss(colors, cid) {
  const c = colors[cid] || [150, 150, 150];
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export function scoreOf(p, profile) {
  const s = p.scores && p.scores[profile];
  return s && s.score != null ? s.score : null;
}

export const downloadBlob = (text, name, type) => {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
};
