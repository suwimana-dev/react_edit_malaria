import React, { useState } from 'react';
import { useStore } from '../store';
import { deleteSelected, mergeSelected, reclassSelected, toggleReshape, setEditMode } from '../actions';

export default function EditTools() {
  const names = useStore((s) => s.classNames), reshapeOn = useStore((s) => s.reshapeOn), count = useStore((s) => s.selected.length);
  const [cls, setCls] = useState('');
  const ids = Object.keys(names).sort((a, b) => a - b);
  return (
    <div id="edittools">
      <h3>Border editing</h3>
      <div className="hint">
        Click parcels to select ({count} selected). <b>Merge</b> joins them into one plot; <b>Delete</b> removes them; <b>Reshape</b> lets you drag a parcel’s corners.
        Every edit re-measures and re-scores. Risk shows detected water within survey habitats; scores are points, not probabilities.
      </div>
      <div className="btns" style={{ marginTop: 10 }}>
        <button id="mergeBtn" className="b-go" onClick={mergeSelected}>Merge selected</button>
        <button id="delBtn" className="b-danger" onClick={deleteSelected}>Delete selected</button>
        <button id="reshapeBtn" className="b-violet" onClick={toggleReshape}>{reshapeOn ? 'Reshape: ON — click a parcel' : 'Reshape (drag corners)'}</button>
        <button id="editDone" onClick={() => setEditMode(false)}>Done</button>
      </div>
      <div className="reclass-row">
        <select id="reclassSelect" aria-label="Class to assign" value={cls || ids[0] || ''} onChange={(e) => setCls(e.target.value)}>
          {ids.map((id) => <option key={id} value={id}>{id} {names[id]}</option>)}
        </select>
        <button id="reclassBtn" className="b-amber" onClick={() => reclassSelected(cls || ids[0])}>Reclassify selected</button>
      </div>
    </div>
  );
}
