import React, { useEffect, useState } from 'react';
import { Input } from '../ui';

// Number input that lets you type freely ("0.", "-") and commits the parsed value on every keystroke.
export default function NumField({ value, onChange, step, min, id, label }) {
  const [draft, setDraft] = useState(null);
  // the value changed from outside (profile switch, loaded version): drop the half-typed text
  useEffect(() => { if (draft !== null && (parseFloat(draft) || 0) !== (value ?? 0)) setDraft(null); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Input id={id} aria-label={label} type="number" step={step} min={min} className="text-right"
      value={draft !== null ? draft : value ?? 0}
      onChange={(e) => { setDraft(e.target.value); onChange(parseFloat(e.target.value) || 0); }}
      onBlur={() => setDraft(null)} />
  );
}
