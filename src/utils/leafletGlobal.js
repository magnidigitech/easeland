import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default Leaflet marker icon asset URLs in React Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

if (typeof window !== 'undefined') {
  window.L = L;
}

export default L;
