import React, { useEffect, useRef } from 'react';
import MapView, { Circle, Polygon, Polyline, Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { StyleSheet, View, Text } from 'react-native';
import { Colors } from '../constants/theme';
import type { Geofence, Coordinates, Vehicle } from '../types';

// ── Shared types (also read by TypeScript for the web sibling) ────────────────
export interface CameraTarget {
  coords?: Coordinates[];
  bounds?: [[number, number], [number, number]]; // used by web only
  center?: Coordinates;
  zoom?: number;
}

export interface GeofenceMapProps {
  zones: Geofence[];
  drawnPoints: Coordinates[];
  isDrawing: boolean;
  vehicles: Vehicle[];
  userLocation: Coordinates | null;
  onMapPress: (coord: Coordinates) => void;
  cameraTarget: CameraTarget | null;
  onMapReady?: (ref: MapView) => void;
}

function getStatusColor(status: string) {
  switch (status) {
    case 'active': return Colors.statusActive;
    case 'idle': return Colors.statusIdle;
    case 'maintenance': return Colors.statusMaintenance;
    default: return Colors.statusOffline;
  }
}

const INITIAL_REGION = {
  latitude: 6.52,
  longitude: 3.42,
  latitudeDelta: 0.28,
  longitudeDelta: 0.38,
};

export default function GeofenceMap({
  zones,
  drawnPoints,
  isDrawing,
  vehicles,
  userLocation,
  onMapPress,
  cameraTarget,
  onMapReady,
}: GeofenceMapProps) {
  const mapRef = useRef<MapView>(null);

  // Apply camera targets imperatively
  useEffect(() => {
    if (!cameraTarget || !mapRef.current) return;
    if (cameraTarget.coords && cameraTarget.coords.length > 0) {
      mapRef.current.fitToCoordinates(
        cameraTarget.coords.map((c) => ({ latitude: c.latitude, longitude: c.longitude })),
        { edgePadding: { top: 60, right: 60, bottom: 60, left: 60 }, animated: true },
      );
    } else if (cameraTarget.center) {
      mapRef.current.animateToRegion(
        {
          latitude: cameraTarget.center.latitude,
          longitude: cameraTarget.center.longitude,
          latitudeDelta: 0.02 * (cameraTarget.zoom ? Math.max(0.5, 14 - cameraTarget.zoom) : 1),
          longitudeDelta: 0.02 * (cameraTarget.zoom ? Math.max(0.5, 14 - cameraTarget.zoom) : 1),
        },
        600,
      );
    }
  }, [cameraTarget]);

  const handleReady = () => {
    if (mapRef.current && onMapReady) onMapReady(mapRef.current);
    // If user location available, fly there
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion(
        { latitude: userLocation.latitude, longitude: userLocation.longitude, latitudeDelta: 0.12, longitudeDelta: 0.15 },
        800,
      );
    }
  };

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      initialRegion={
        userLocation
          ? { latitude: userLocation.latitude, longitude: userLocation.longitude, latitudeDelta: 0.12, longitudeDelta: 0.15 }
          : INITIAL_REGION
      }
      onPress={(e) => onMapPress({ latitude: e.nativeEvent.coordinate.latitude, longitude: e.nativeEvent.coordinate.longitude })}
      onMapReady={handleReady}
      showsUserLocation={!!userLocation}
      showsMyLocationButton={false}
      toolbarEnabled={false}
    >
      {/* Circle geofences */}
      {zones.filter((z) => z.active && !z.polygon).map((z) => (
        <Circle
          key={z.id}
          center={{ latitude: z.center.latitude, longitude: z.center.longitude }}
          radius={z.radiusKm * 1000}
          fillColor={z.color + '28'}
          strokeColor={z.color}
          strokeWidth={2}
        />
      ))}

      {/* Polygon geofences */}
      {zones.filter((z) => z.active && z.polygon).map((z) => (
        <Polygon
          key={z.id}
          coordinates={z.polygon!.map((p) => ({ latitude: p.latitude, longitude: p.longitude }))}
          fillColor={z.color + '28'}
          strokeColor={z.color}
          strokeWidth={2.5}
        />
      ))}

      {/* Drawing: completed segment line */}
      {drawnPoints.length >= 2 && (
        <Polyline
          coordinates={drawnPoints.map((p) => ({ latitude: p.latitude, longitude: p.longitude }))}
          strokeColor={Colors.accent}
          strokeWidth={3}
        />
      )}

      {/* Drawing: closing dashed preview */}
      {drawnPoints.length >= 3 && isDrawing && (
        <Polyline
          coordinates={[
            { latitude: drawnPoints[drawnPoints.length - 1].latitude, longitude: drawnPoints[drawnPoints.length - 1].longitude },
            { latitude: drawnPoints[0].latitude, longitude: drawnPoints[0].longitude },
          ]}
          strokeColor={Colors.accent}
          strokeWidth={2}
          lineDashPattern={[6, 6]}
        />
      )}

      {/* Drawing: fill preview */}
      {drawnPoints.length >= 3 && (
        <Polygon
          coordinates={drawnPoints.map((p) => ({ latitude: p.latitude, longitude: p.longitude }))}
          fillColor={Colors.accent + '22'}
          strokeColor="transparent"
          strokeWidth={0}
        />
      )}

      {/* Vertex markers */}
      {drawnPoints.map((pt, i) => (
        <Marker
          key={`v${i}`}
          coordinate={{ latitude: pt.latitude, longitude: pt.longitude }}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}
        >
          <View style={[styles.vertex, i === 0 && styles.vertexFirst]}>
            {i === 0 && <Text style={styles.vertexLabel}>Start</Text>}
          </View>
        </Marker>
      ))}

      {/* Vehicle markers (hidden in draw mode to reduce clutter) */}
      {!isDrawing &&
        vehicles.map((v) => (
          <Marker
            key={v.id}
            coordinate={{ latitude: v.location.latitude, longitude: v.location.longitude }}
            title={v.plate}
            description={`${v.make} ${v.model} · ${v.status}`}
            tracksViewChanges={false}
          >
            <View style={[styles.vehiclePin, { borderColor: getStatusColor(v.status) }]}>
              <View style={[styles.vehiclePinDot, { backgroundColor: getStatusColor(v.status) }]} />
              <Text style={styles.vehiclePinText}>{v.plate.split('-')[1]}</Text>
            </View>
          </Marker>
        ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  vertex: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.accent,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  vertexFirst: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.primary,
  },
  vertexLabel: {
    position: 'absolute',
    top: -18,
    left: -8,
    fontSize: 9,
    fontWeight: '800',
    color: Colors.primary,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 3,
    borderRadius: 3,
  },
  vehiclePin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFF',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 99,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  vehiclePinDot: { width: 6, height: 6, borderRadius: 3 },
  vehiclePinText: { fontSize: 9, fontWeight: '800', color: Colors.textPrimary },
});
