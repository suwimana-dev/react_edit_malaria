import React, { useEffect } from 'react';
import { loadDefaults, setStatus } from './actions';
import MapView from './components/MapView.jsx';
import ControlBar from './components/ControlBar.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import Legend from './components/Legend.jsx';
import SummaryPanel from './components/SummaryPanel.jsx';
import ParcelPopup from './components/ParcelPopup.jsx';
import RunOverlay from './components/RunOverlay.jsx';
import Toast from './components/Toast.jsx';

export default function App() {
  useEffect(() => { loadDefaults().catch((e) => setStatus(e.message, 'err')); }, []);
  return (
    <>
      <MapView />
      <div id="left" className="pointer-events-none absolute bottom-4 left-[60px] top-3.5 z-[1000] flex w-[min(420px,calc(100%-72px))] flex-col gap-2.5 max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:top-auto max-sm:max-h-[78%] max-sm:w-auto max-sm:gap-0 [&>*]:pointer-events-auto">
        <ControlBar />
        <Legend />
      </div>
      <SettingsPanel />
      <SummaryPanel />
      <ParcelPopup />
      <RunOverlay />
      <Toast />
    </>
  );
}
