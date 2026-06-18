import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Colors } from '../constants/theme';
import type { Vehicle } from '../types';
import type { FleetMapProps, MapStyle } from './FleetMap';

export type { FleetMapProps };

if (typeof document !== 'undefined' && !document.getElementById('leaflet-css')) {
  const link = document.createElement('link');
  link.id   = 'leaflet-css';
  link.rel  = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(link);
}

const TILES: Record<MapStyle, { url: string; attribution: string; labelsUrl?: string }> = {
  standard: {
    url:         'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  satellite: {
    url:         'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Esri, USDA, USGS, AEX, GeoEye, IGN',
  },
  hybrid: {
    url:         'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    labelsUrl:   'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png',
  },
};

function statusColor(status: string): string {
  switch (status) {
    case 'active':      return Colors.statusActive;
    case 'idle':        return Colors.statusIdle;
    case 'maintenance': return Colors.statusMaintenance;
    default:            return Colors.statusOffline;
  }
}

function makeIcon(v: Vehicle, selected: boolean, showLabels: boolean, showPlate: boolean): L.DivIcon {
  const c          = statusColor(v.status);
  const bg         = selected ? c : '#FFF';
  const fg         = selected ? '#FFF' : c;
  const label      = showPlate ? v.plate : (v.driver ? v.driver.name.split(' ')[0] : v.plate);
  const labelBg    = selected ? c : 'rgba(255,255,255,0.97)';
  const labelColor = selected ? '#FFF' : '#0D1B2A';

  const labelHtml = showLabels
    ? `<div style="
        background:${labelBg};color:${labelColor};
        font-family:system-ui,-apple-system,sans-serif;
        font-size:9px;font-weight:700;line-height:1;
        padding:2px 5px;border-radius:5px;
        box-shadow:0 1px 3px rgba(0,0,0,0.2);
        white-space:nowrap;max-width:58px;
        overflow:hidden;text-overflow:ellipsis;
        border:1px solid ${c}40;">
      ${label}
    </div>`
    : '';

  return L.divIcon({
    className: '',
    html: `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
      <div style="
          width:24px;height:24px;border-radius:50%;
          background:${bg};border:2px solid ${c};
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 1px 5px rgba(0,0,0,0.28);
          transform:${selected ? 'scale(1.18)' : 'scale(1)'};
          transition:transform 0.15s;">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="${fg}">
          <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
        </svg>
      </div>
      ${labelHtml}
    </div>`,
    iconSize:    [64, showLabels ? 42 : 24],
    iconAnchor:  [32, 12],
    popupAnchor: [0, -18],
  });
}

function PanTo({ vehicle }: { vehicle: Vehicle | null }) {
  const map = useMap();
  useEffect(() => {
    if (vehicle) {
      map.flyTo([vehicle.location.latitude, vehicle.location.longitude], 13, { duration: 0.8 });
    }
  }, [vehicle?.id]);
  return null;
}

export default function FleetMap({
  vehicles, selected, onSelect, onOpenVehicle,
  mapStyle = 'standard', showLabels = true, showPlate = false,
}: FleetMapProps) {
  const tile = TILES[mapStyle];
  return (
    <MapContainer
      center={[-14.5, 28.4]}
      zoom={6}
      zoomControl
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as any}
    >
      <TileLayer key={mapStyle} url={tile.url} attribution={tile.attribution} />
      {tile.labelsUrl && (
        <TileLayer url={tile.labelsUrl} attribution="" opacity={0.8} />
      )}
      <PanTo vehicle={selected} />
      {vehicles.map((v) => (
        <Marker
          key={v.id}
          position={[v.location.latitude, v.location.longitude]}
          icon={makeIcon(v, selected?.id === v.id, showLabels, showPlate)}
          eventHandlers={{ click: () => onSelect(selected?.id === v.id ? null : v) }}
        >
          <Popup>
            <div style={{ minWidth: 160, fontFamily: 'system-ui,sans-serif' }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: '#0D1B2A' }}>{v.plate}</div>
              <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{v.make} {v.model}</div>
              {v.location.address && (
                <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 3 }}>{v.location.address}</div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 5 }}>
                <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: statusColor(v.status) }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: statusColor(v.status) }}>
                  {v.status.charAt(0).toUpperCase() + v.status.slice(1)}
                </span>
                {v.speed > 0 && (
                  <span style={{ fontSize: 11, color: '#64748B' }}> · {v.speed} km/h</span>
                )}
              </div>
              {v.driver && (
                <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 3 }}>
                  👤 {v.driver.name}
                </div>
              )}
              <button
                onClick={() => onOpenVehicle(v)}
                style={{ marginTop: 8, fontSize: 11, color: '#2563EB', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                Open details →
              </button>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
