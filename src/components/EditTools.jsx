import React, { useState } from 'react';
import { useStore } from '../store';
import { deleteSelected, mergeSelected, reclassSelected, toggleReshape, setEditMode } from '../actions';
import { Button, Select, Lbl } from '../ui';

export default function EditTools() {
  const names = useStore((s) => s.classNames), reshapeOn = useStore((s) => s.reshapeOn), count = useStore((s) => s.selected.length);
  const [cls, setCls] = useState('');
  const ids = Object.keys(names).sort((a, b) => a - b);
  return (
    <div id="edittools" className="mt-3 rounded-md border border-line-soft bg-wash p-3.5">
      <h3 className="mb-1.5 text-base font-semibold">Edit borders</h3>
      <p className="text-sm leading-normal text-muted"><b className="text-ink">{count} selected.</b> Tap parcels to select them. Merge joins them into one plot, Delete removes them, Reshape lets you drag a parcel’s corners. Every edit re-measures and re-scores.</p>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <Button id="mergeBtn" variant="primary" onClick={mergeSelected}>Merge selected</Button>
        <Button id="delBtn" variant="danger" onClick={deleteSelected}>Delete selected</Button>
        <Button id="reshapeBtn" variant="blue" aria-pressed={reshapeOn} onClick={toggleReshape}>{reshapeOn ? 'Reshape is on: tap a parcel' : 'Reshape corners'}</Button>
        <Button id="editDone" onClick={() => setEditMode(false)}>Done</Button>
      </div>
      <div className="mt-3 grid gap-2.5 border-t border-line pt-3">
        <Lbl htmlFor="reclassSelect" className="m-0">Change the class of the selected parcels</Lbl>
        <Select id="reclassSelect" value={cls || ids[0] || ''} onChange={(e) => setCls(e.target.value)}>
          {ids.map((id) => <option key={id} value={id}>{id} {names[id]}</option>)}
        </Select>
        <Button id="reclassBtn" variant="amber" onClick={() => reclassSelected(cls || ids[0])}>Apply class to selected</Button>
      </div>
    </div>
  );
}
