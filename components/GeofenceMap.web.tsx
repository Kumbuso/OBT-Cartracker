/**
 * Web-only geofence map using react-leaflet + OpenStreetMap tiles.
 * Metro automatically picks this file on web instead of GeofenceMap.tsx.
 */
import React, { useEffect, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  Circle,
  Polygon,
  Polyline,
  Marker,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import { Colors } from '../constants/theme';
import type { Geofence, Coordinates, Vehicle } from '../types';
import type { CameraTarget, GeofenceMapProps } from './GeofenceMap';

export { CameraTarget, GeofenceMapProps };

// ── Inject Leaflet CSS once (browser only) ───────────────────────────────────
if (typeof document !== 'undefined') {
  if (!document.getElementById('leaflet-css')) {
    const link = document.createElement('link');
    link.id = 'leaflet-css';
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getStatusColor(status: string) {
  switch (status) {
    case 'active': return Colors.statusActive;
    case 'idle': return Colors.statusIdle;
    case 'maintenance': return Colors.statusMaintenance;
    default: return Colors.statusOffline;
  }
}

/** Create a pure-CSS div icon (avoids missing leaflet default icon issue). */
function makeDivIcon(
  bgColor: string,
  size = 12,
  label?: string,
  border = '#FFF',
): L.DivIcon {
  const labelHtml = label
    ? `<span style="position:absolute;top:-18px;left:50%;transform:translateX(-50%);font-size:9px;font-weight:800;white-space:nowrap;background:rgba(255,255,255,0.92);padding:1px 4px;border-radius:3px;color:#0A2463;">${label}</span>`
    : '';
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:${size}px;height:${size}px;border-radius:50%;background:${bgColor};border:2px solid ${border};box-shadow:0 1px 4px rgba(0,0,0,0.3);">${labelHtml}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function makeVehicleIcon(status: string, plateSuffix: string): L.DivIcon {
  const color = getStatusColor(status);
  return L.divIcon({
    className: '',
    html: `<div style="display:flex;align-items:center;gap:3px;background:#fff;border:1.5px solid ${color};border-radius:999px;padding:2px 7px 2px 5px;font-size:9px;font-weight:800;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.2);">
      <span style="width:6px;height:6px;border-radius:50%;background:${color};flex-shrink:0;"></span>${plateSuffix}
    </div>`,
    iconSize: [52, 22],
    iconAnchor: [26, 11],
  });
}

const USER_ICON = makeDivIcon('#3E92CC', 16, undefined, '#fff');

// ── Internal child components (must be inside MapContainer) ───────────────────

/** Fires onPress callback when map is clicked in drawing mode. */
function DrawClickHandler({
  isDrawing,
  onPress,
}: {
  isDrawing: boolean;
  onPress: (c: Coordinates) => void;
}) {
  useMapEvents({
    click(e) {
      if (!isDrawing) return;
      onPress({ latitude: e.latlng.lat, longitude: e.latlng.lng });
    },
  });
  return null;
}

/** Changes cursor to crosshair while drawing. */
function DrawCursor({ isDrawing }: { isDrawing: boolean }) {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    el.style.cursor = isDrawing ? 'crosshair' : '';
  }, [isDrawing, map]);
  return null;
}

/** Applies camera targets imperatively. */
function CameraController({ target }: { target: CameraTarget | null }) {
  const map = useMap();
  const prev = useRef<CameraTarget | null>(null);

  useEffect(() => {
    if (!target || target === prev.current) return;
    prev.current = target;

    if (target.bounds) {
      map.fitBounds(target.bounds, { padding: [50, 50], animate: true });
    } else if (target.coords && target.coords.length > 0) {
      const lb = L.latLngBounds(
        target.coords.map((c) => [c.latitude, c.longitude] as [number, number]),
      );
      map.fitBounds(lb, { padding: [50, 50], animate: true });
    } else if (target.center) {
      map.setView(
        [target.center.latitude, target.center.longitude],
        target.zoom ?? 13,
        { animate: true },
      );
    }
  }, [target, map]);

  return null;
}

/** Centers map on user location once when it first becomes available. */
function UserLocationFly({ userLocation }: { userLocation: Coordinates | null }) {
  const map = useMap();
  const flown = useRef(false);

  useEffect(() => {
    if (!userLocation || flown.current) return;
    flown.current = true;
    map.flyTo([userLocation.latitude, userLocation.longitude], 13, { animate: true, duration: 1.2 });
  }, [userLocation, map]);

  return null;
}

// ── Main web map component ────────────────────────────────────────────────────

export default function GeofenceMap({
  zones,
  drawnPoints,
  isDrawing,
  vehicles,
  userLocation,
  onMapPress,
  cameraTarget,
}: GeofenceMapProps) {
  const defaultCenter: [number, number] = userLocation
    ? [userLocation.latitude, userLocation.longitude]
    : [6.52, 3.42];

  return (
    <MapContainer
      center={defaultCenter}
      zoom={12}
      style={{ width: '100%', height: '100%' }}
      zoomControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Internal controllers */}
      <DrawClickHandler isDrawing={isDrawing} onPress={onMapPress} />
      <DrawCursor isDrawing={isDrawing} />
      <CameraController target={cameraTarget} />
      <UserLocationFly userLocation={userLocation} />

      {/* Circle geofences */}
      {zones
        .filter((z) => z.active && !z.polygon)
        .map((z) => (
          <Circle
            key={z.id}
            center={[z.center.latitude, z.center.longitude]}
            radius={z.radiusKm * 1000}
            pathOptions={{
              fillColor: z.color,
              fillOpacity: 0.15,
              color: z.color,
              weight: 2,
            }}
          />
        ))}

      {/* Polygon geofences */}
      {zones
        .filter((z) => z.active && z.polygon)
        .map((z) => (
          <Polygon
            key={z.id}
            positions={z.polygon!.map((p) => [p.latitude, p.longitude] as [number, number])}
            pathOptions={{
              fillColor: z.color,
              fillOpacity: 0.15,
              color: z.color,
              weight: 2.5,
            }}
          />
        ))}

      {/* Drawing: segment line */}
      {drawnPoints.length >= 2 && (
        <Polyline
          positions={drawnPoints.map((p) => [p.latitude, p.longitude] as [number, number])}
          pathOptions={{ color: Colors.accent, weight: 3 }}
        />
      )}

      {/* Drawing: closing dashed preview line */}
      {drawnPoints.length >= 3 && isDrawing && (
        <Polyline
          positions={[
            [drawnPoints[drawnPoints.length - 1].latitude, drawnPoints[drawnPoints.length - 1].longitude],
            [drawnPoints[0].latitude, drawnPoints[0].longitude],
          ]}
          pathOptions={{ color: Colors.accent, weight: 2, dashArray: '8 6' }}
        />
      )}

      {/* Drawing: fill preview */}
      {drawnPoints.length >= 3 && (
        <Polygon
          positions={drawnPoints.map((p) => [p.latitude, p.longitude] as [number, number])}
          pathOptions={{
            fillColor: Colors.accent,
            fillOpacity: 0.12,
            color: 'transparent',
            weight: 0,
          }}
        />
      )}

      {/* Vertex markers */}
      {drawnPoints.map((pt, i) => (
        <Marker
          key={`v${i}`}
          position={[pt.latitude, pt.longitude]}
          icon={makeDivIcon(
            i === 0 ? Colors.primary : Colors.accent,
            i === 0 ? 18 : 13,
            i === 0 ? 'Start' : undefined,
          )}
        />
      ))}

      {/* Vehicle markers (hidden in draw mode) */}
      {!isDrawing &&
        vehicles.map((v) => (
          <Marker
            key={v.id}
            position={[v.location.latitude, v.location.longitude]}
            icon={makeVehicleIcon(v.status, v.plate.split('-')[1])}
          />
        ))}

      {/* User location marker */}
      {userLocation && (
        <Marker position={[userLocation.latitude, userLocation.longitude]} icon={USER_ICON} />
      )}
    </MapContainer>
  );
}
