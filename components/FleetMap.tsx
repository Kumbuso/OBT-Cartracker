import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Vehicle } from '../types';
import { Colors, Radius } from '../constants/theme';

let MapView: any = null;
let Marker: any  = null;
let Callout: any = null;

if (Platform.OS !== 'web') {
  const RNMaps = require('react-native-maps');
  MapView = RNMaps.default;
  Marker  = RNMaps.Marker;
  Callout = RNMaps.Callout;
}

const ZAMBIA = { latitude: -14.5, longitude: 28.4, latitudeDelta: 8, longitudeDelta: 8 };

export function vehicleStatusColor(status: string): string {
  switch (status) {
    case 'active':      return Colors.statusActive;
    case 'idle':        return Colors.statusIdle;
    case 'maintenance': return Colors.statusMaintenance;
    default:            return Colors.statusOffline;
  }
}

export type MapStyle = 'standard' | 'satellite' | 'hybrid';

export interface FleetMapProps {
  vehicles: Vehicle[];
  selected: Vehicle | null;
  onSelect: (v: Vehicle | null) => void;
  onOpenVehicle: (v: Vehicle) => void;
  showUserLocation?: boolean;
  mapRef?: React.RefObject<any>;
  mapStyle?: MapStyle;
  showLabels?: boolean;
  showPlate?: boolean;
  showTraffic?: boolean;
}

function Pin({ v, sel, showLabels, showPlate }: { v: Vehicle; sel: boolean; showLabels: boolean; showPlate: boolean }) {
  const c     = vehicleStatusColor(v.status);
  const label = showPlate ? v.plate : (v.driver ? v.driver.name.split(' ')[0] : v.plate);
  return (
    <View style={s.pinWrap}>
      <View style={[s.pinBubble, { backgroundColor: sel ? c : '#FFF', borderColor: c }]}>
        <Ionicons name="car" size={10} color={sel ? '#FFF' : c} />
      </View>
      {showLabels && (
        <View style={[s.pinLabel, {
          backgroundColor: sel ? c : 'rgba(255,255,255,0.97)',
          borderColor: sel ? 'transparent' : c + '50',
        }]}>
          <Text style={[s.pinLabelText, { color: sel ? '#FFF' : '#0D1B2A' }]} numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function FleetMap({
  vehicles, selected, onSelect, onOpenVehicle, showUserLocation, mapRef,
  mapStyle, showLabels = true, showPlate = false, showTraffic = false,
}: FleetMapProps) {
  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      initialRegion={ZAMBIA}
      showsUserLocation={showUserLocation}
      showsMyLocationButton={false}
      showsCompass
      showsScale
      mapType={mapStyle ?? 'standard'}
      showsTraffic={showTraffic}
    >
      {vehicles.map((v) => (
        <Marker
          key={v.id}
          coordinate={{ latitude: v.location.latitude, longitude: v.location.longitude }}
          onPress={() => onSelect(selected?.id === v.id ? null : v)}
          tracksViewChanges={false}
        >
          <Pin v={v} sel={selected?.id === v.id} showLabels={showLabels} showPlate={showPlate} />
          <Callout tooltip onPress={() => onOpenVehicle(v)}>
            <View style={s.callout}>
              <View style={[s.calloutBar, { backgroundColor: vehicleStatusColor(v.status) }]} />
              <View style={s.calloutBody}>
                <Text style={s.plate}>{v.plate}</Text>
                <Text style={s.model}>{v.make} {v.model}</Text>
                {v.location.address && (
                  <Text style={s.addr} numberOfLines={2}>{v.location.address}</Text>
                )}
                <View style={s.row}>
                  <View style={[s.dot, { backgroundColor: vehicleStatusColor(v.status) }]} />
                  <Text style={[s.statusTxt, { color: vehicleStatusColor(v.status) }]}>
                    {v.status.charAt(0).toUpperCase() + v.status.slice(1)}
                  </Text>
                  {v.speed > 0 && <Text style={s.speed}> · {v.speed} km/h</Text>}
                </View>
                {v.driver && (
                  <View style={s.row}>
                    <Ionicons name="person-outline" size={11} color={Colors.textMuted} />
                    <Text style={s.driverName}>{v.driver.name}</Text>
                  </View>
                )}
                <View style={[s.row, { marginTop: 4 }]}>
                  <Text style={s.tapHint}>Open details</Text>
                  <Ionicons name="arrow-forward" size={11} color={Colors.accent} />
                </View>
              </View>
            </View>
          </Callout>
        </Marker>
      ))}
    </MapView>
  );
}

const s = StyleSheet.create({
  pinWrap:      { alignItems: 'center', gap: 2 },
  pinBubble:    { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 3, elevation: 3 },
  pinLabel:     { borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2, borderWidth: 1, maxWidth: 64, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 2, elevation: 2 },
  pinLabelText: { fontSize: 9, fontWeight: '700', lineHeight: 11 },
  callout:     { flexDirection: 'row', width: 200, backgroundColor: '#FFF', borderRadius: Radius.md, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8 },
  calloutBar:  { width: 4 },
  calloutBody: { flex: 1, padding: 10, gap: 3 },
  plate:       { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  model:       { fontSize: 11, color: Colors.textSecondary },
  addr:        { fontSize: 10.5, color: Colors.textMuted, lineHeight: 14 },
  row:         { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot:         { width: 7, height: 7, borderRadius: 3.5 },
  statusTxt:   { fontSize: 11, fontWeight: '700' },
  speed:       { fontSize: 11, color: Colors.textSecondary },
  driverName:  { fontSize: 10.5, color: Colors.textMuted },
  tapHint:     { fontSize: 10, color: Colors.accent, fontWeight: '600' },
});
