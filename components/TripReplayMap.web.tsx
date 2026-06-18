import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Colors } from '../constants/theme';
import type { TripReplayMapProps } from './TripReplayMap';

export type { TripReplayMapProps };

if (typeof document !== 'undefined' && !document.getElementById('leaflet-css')) {
  const link = document.createElement('link');
  link.id   = 'leaflet-css';
  link.rel  = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(link);
}

// ── Map-layer icons ────────────────────────────────────────────────────────────

function dotIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:14px;height:14px;border-radius:50%;
      background:${color};border:2.5px solid #FFF;
      box-shadow:0 1px 5px rgba(0,0,0,0.45);"></div>`,
    iconSize:   [14, 14],
    iconAnchor: [7, 7],
  });
}

function vehicleIcon(speed: number): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="
      background:${Colors.primary};border:2.5px solid ${Colors.accent};
      border-radius:50%;width:40px;height:40px;
      display:flex;flex-direction:column;
      align-items:center;justify-content:center;
      box-shadow:0 2px 10px rgba(0,0,0,0.4);">
      <span style="font-size:12px;font-weight:900;color:#FFF;line-height:14px;">${speed}</span>
      <span style="font-size:8px;font-weight:600;color:rgba(255,255,255,0.7);line-height:9px;">km/h</span>
    </div>`,
    iconSize:   [40, 40],
    iconAnchor: [20, 20],
  });
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 1) {
      try {
        map.fitBounds(L.latLngBounds(positions), { padding: [48, 48], maxZoom: 15 });
      } catch { /* empty bounds */ }
    }
  }, []);
  return null;
}

function PanTo({ pos }: { pos: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.panTo(pos, { animate: true, duration: 0.25 });
  }, [pos[0], pos[1]]);
  return null;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function TripReplayMap({ waypoints, currentIndex }: TripReplayMapProps) {
  if (!waypoints.length) return null;

  const all:    [number, number][] = waypoints.map((w) => [w.latitude, w.longitude]);
  const played: [number, number][] = all.slice(0, currentIndex + 1);
  const currentPos = all[currentIndex];

  return (
    <MapContainer
      center={all[Math.floor(all.length / 2)]}
      zoom={11}
      zoomControl
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as any}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <FitBounds positions={all} />
      <PanTo pos={currentPos} />

      {/* Full route — dashed grey */}
      <Polyline
        positions={all}
        pathOptions={{ color: '#CBD5E1', weight: 3, dashArray: '7 5' }}
      />

      {/* Played portion — solid accent */}
      {played.length > 1 && (
        <Polyline
          positions={played}
          pathOptions={{ color: Colors.accent, weight: 5 }}
        />
      )}

      {/* Start dot */}
      <Marker position={all[0]} icon={dotIcon(Colors.statusActive)} />

      {/* End dot */}
      {all.length > 1 && (
        <Marker position={all[all.length - 1]} icon={dotIcon(Colors.danger)} />
      )}

      {/* Moving vehicle */}
      <Marker position={currentPos} icon={vehicleIcon(waypoints[currentIndex].speed)} />
    </MapContainer>
  );
}
