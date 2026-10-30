import React, { useEffect, useRef } from 'react';
import { controller } from '../mapController';

// The map element; Leaflet is created once and then driven by actions through the controller.
export default function MapView() {
  const ref = useRef(null);
  useEffect(() => { controller.init(ref.current); return () => controller.destroy(); }, []);
  return <div id="map" ref={ref} />;
}
