import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(<App />);

// Console/test hook: open the page with ?debug to reach the store and the map controller.
if (location.search.includes('debug')) {
  Promise.all([import('./store'), import('./mapController')]).then(([s, m]) => { window.__viewer = { store: s.store, controller: m.controller }; });
}
