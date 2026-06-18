import React from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import { Colors } from '../constants/theme';
import type { TripWaypoint } from '../types';

let MapView: any = null;
let Polyline: any = null;
let Marker: any   = null;

if (Platform.OS !== 'web') {
  const RNMaps = require('react-native-maps');
  MapView  = RNMaps.default;
  Polyline = RNMaps.Polyline;
  Marker   = RNMaps.Marker;
}

export interface TripReplayMapProps {
  waypoints: TripWaypoint[];
  currentIndex: number;
}

export default function TripReplayMap({ waypoints, currentIndex }: TripReplayMapProps) {
  if (!waypoints.length) return null;

  const coords     = waypoints.map((w) => ({ latitude: w.latitude, longitude: w.longitude }));
  const played     = coords.slice(0, currentIndex + 1);
  const currentPos = coords[currentIndex];

  const lats = coords.map((c) => c.latitude);
  const lngs = coords.map((c) => c.longitude);
  const pad  = 1.4;
  const initialRegion = {
    latitude:       (Math.min(...lats) + Math.max(...lats)) / 2,
    longitude:      (Math.min(...lngs) + Math.max(...lngs)) / 2,
    latitudeDelta:  (Math.max(...lats) - Math.min(...lats)) * pad || 0.05,
    longitudeDelta: (Math.max(...lngs) - Math.min(...lngs)) * pad || 0.05,
  };

  return (
    <MapView style={StyleSheet.absoluteFill} initialRegion={initialRegion} showsCompass showsScale>
      {/* Full route — dashed grey */}
      <Polyline
        coordinates={coords}
        strokeColor={Colors.border}
        strokeWidth={3}
        lineDashPattern={[6, 4]}
      />

      {/* Played portion — solid blue */}
      {played.length > 1 && (
        <Polyline
          coordinates={played}
          strokeColor={Colors.accent}
          strokeWidth={5}
        />
      )}

      {/* Start pin */}
      <Marker coordinate={coords[0]} pinColor={Colors.statusActive} title="Start" />

      {/* End pin */}
      {coords.length > 1 && (
        <Marker coordinate={coords[coords.length - 1]} pinColor={Colors.danger} title="End" />
      )}

      {/* Moving vehicle */}
      <Marker coordinate={currentPos} tracksViewChanges={false}>
        <View style={s.vehiclePin}>
          <Text style={s.vehiclePinText}>{waypoints[currentIndex].speed}</Text>
          <Text style={s.vehiclePinUnit}>km/h</Text>
        </View>
      </Marker>
    </MapView>
  );
}

const s = StyleSheet.create({
  vehiclePin: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    borderWidth: 2.5,
    borderColor: Colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 5,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  vehiclePinText: { fontSize: 12, fontWeight: '900', color: '#FFF', lineHeight: 14 },
  vehiclePinUnit: { fontSize: 8,  fontWeight: '600', color: 'rgba(255,255,255,0.75)', lineHeight: 9 },
});
