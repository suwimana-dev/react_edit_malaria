import React, { useEffect } from 'react';
import { loadDefaults, setStatus } from './actions';
import MapView from './components/MapView.jsx';
import ControlBar from './components/ControlBar.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import Legend from './components/Legend.jsx';
import SummaryPanel from './components/SummaryPanel.jsx';
import ParcelPopup from './components/ParcelPopup.jsx';
import RunOverlay from './components/RunOverlay.jsx';

export default function App() {
  useEffect(() => { loadDefaults().catch((e) => setStatus(e.message, 'err')); }, []);
  return (
    <>
      <MapView />
      <div id="left">
        <ControlBar />
        <Legend />
      </div>
      <SettingsPanel />
      <SummaryPanel />
      <ParcelPopup />
      <RunOverlay />
    </>
  );
}
