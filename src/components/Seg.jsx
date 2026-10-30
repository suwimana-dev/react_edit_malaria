import React from 'react';
import { cx } from '../ui';

// Big segmented choice (Yes / No / Not assessed...). Use an explicit "clear" option rather than toggling off.
export default function Seg({ value, onChange, options, label }) {
  return (
    <div className="flex overflow-hidden rounded-md border border-line" role="group" aria-label={label}>
      {options.map(([v, text]) => {
        const on = (value ?? '') === v;
        return (
          <button key={v} type="button" aria-pressed={on} onClick={() => onChange(v)}
            className={cx('min-h-[44px] flex-1 transition-colors duration-150 border-r-2 border-line px-2 text-[15px] last:border-r-0',
              on ? 'bg-ink font-medium text-surface' : 'bg-surface text-ink hover:bg-wash')}>{text}</button>
        );
      })}
    </div>
  );
}
