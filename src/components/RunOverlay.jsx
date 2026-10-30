import React from 'react';
import { useStore } from '../store';

export default function RunOverlay() {
  const o = useStore((s) => s.overlay);
  if (!o.active) return null;
  return (
    <div id="run-overlay" role="alert" aria-live="polite">
      <div className="spinner" />
      <div className="ov-msg">{o.msg || 'Processing…'}</div>
      {o.pct >= 0 && <div className="ov-wrap"><div className="ov-bar" style={{ width: `${o.pct}%` }} /></div>}
      {o.pct >= 0 && <div className="ov-pct">{Math.round(o.pct)}%</div>}
      <div className="ov-hint">Please wait — do not close this tab.<br />Refresh the page to cancel.</div>
    </div>
  );
}
