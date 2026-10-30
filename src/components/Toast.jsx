import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import { cx } from '../ui';

// Confirmations and errors that must be seen even when the side panel is collapsed (phones, popups).
export default function Toast() {
  const status = useStore((s) => s.status), seq = useStore((s) => s.statusSeq), running = useStore((s) => s.running);
  const [shown, setShown] = useState(null);
  useEffect(() => {
    if (!status.msg || !status.kind || running) return undefined;
    setShown({ ...status, seq });
    if (status.kind === 'err') return undefined;           // errors stay until dismissed
    const t = setTimeout(() => setShown(null), 4500);
    return () => clearTimeout(t);
  }, [seq]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!shown) return null;
  const err = shown.kind === 'err';
  const short = shown.msg.length > 220 ? `${shown.msg.slice(0, 220)}…` : shown.msg;
  return (
    <div id="toast" role={err ? 'alert' : 'status'}
      className={cx('fixed left-1/2 z-[100000] flex max-w-[min(560px,calc(100%-32px))] -translate-x-1/2 items-start gap-3 whitespace-pre-wrap rounded-card px-4 py-3.5 text-[15px] font-semibold shadow-card',
        'bottom-[calc(24px+env(safe-area-inset-bottom,0px))] max-sm:bottom-auto max-sm:top-3', err ? 'bg-danger text-white' : 'bg-ink text-surface')}>
      <span>{short}</span>
      <button type="button" onClick={() => setShown(null)} aria-label="Dismiss message" className="min-h-8 rounded-md border border-current px-2.5 text-[13px]">OK</button>
    </div>
  );
}
