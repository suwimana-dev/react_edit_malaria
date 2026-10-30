// Geoman looks for the global L when it loads, so this module must be evaluated first.
import L from 'leaflet';
window.L = L;
export default L;
