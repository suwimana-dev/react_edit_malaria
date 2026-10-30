import React from 'react';
import { useStore } from '../store';

export default function RunOverlay() {
  const o = useStore((s) => s.overlay);
  if (!o.active) return null;
  return (
    <div id="run-overlay" role="alert" aria-live="polite" className="fixed inset-0 z-[99999] flex flex-col items-center justify-center gap-6 bg-[rgba(8,20,18,.72)] p-6 text-center">
      <div className="size-16 animate-spin rounded-full border-[6px] border-white/25 border-t-[#8fe0c6]" />
      <div className="max-w-[360px] whitespace-pre-wrap text-lg font-semibold text-white">{o.msg || 'Processing…'}</div>
      {o.pct >= 0 && <div className="h-2.5 w-[min(320px,100%)] overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-[#8fe0c6] transition-[width] duration-200" style={{ width: `${o.pct}%` }} /></div>}
      {o.pct >= 0 && <div className="-mt-3 font-mono text-[15px] text-white">{Math.round(o.pct)}%</div>}
      <div className="text-sm text-white/75">Please wait — do not close this tab.<br />Refresh the page to cancel.</div>
    </div>
  );
}
