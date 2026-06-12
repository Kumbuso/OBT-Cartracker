import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
  StatusBar,
  Dimensions,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import StatusBadge from '../../components/StatusBadge';
import { mockVehicles } from '../../data/mockData';
import type { Vehicle } from '../../types';
import { Colors, Spacing, Radius, FontSize, Shadow } from '../../constants/theme';

// Platform-safe import — react-native-maps doesn't support web
let MapView: any   = null;
let Marker: any    = null;
let Callout: any   = null;

if (Platform.OS !== 'web') {
  /* eslint-disable @typescript-eslint/no-var-requires */
  const RNMaps  = require('react-native-maps');
  MapView  = RNMaps.default;
  Marker   = RNMaps.Marker;
  Callout  = RNMaps.Callout;
}

const { width } = Dimensions.get('window');

// Initial region centered over Zambia
const ZAMBIA_REGION = {
  latitude:      -14.5,
  longitude:      28.4,
  latitudeDelta:  8.0,
  longitudeDelta: 8.0,
};

// Tighter region when focusing a vehicle
const VEHICLE_DELTA = { latitudeDelta: 0.04, longitudeDelta: 0.04 };

function statusColor(status: Vehicle['status']): string {
  switch (status) {
    case 'active':      return Colors.statusActive;
    case 'idle':        return Colors.statusIdle;
    case 'offline':     return Colors.statusOffline;
    case 'maintenance': return Colors.statusMaintenance;
  }
}

// ─── Custom map marker ────────────────────────────────────────────────────────

function VehicleMarkerPin({ vehicle, selected }: { vehicle: Vehicle; selected: boolean }) {
  const color = statusColor(vehicle.status);
  return (
    <View style={styles.pinWrap}>
      <View style={[
        styles.pinBubble,
        { backgroundColor: selected ? color : '#FFF', borderColor: color },
      ]}>
        <Ionicons name="car" size={13} color={selected ? '#FFF' : color} />
      </View>
      <View style={[styles.pinTail, { borderTopColor: color }]} />
    </View>
  );
}

// ─── Map screen ───────────────────────────────────────────────────────────────

export default function MapScreen() {
  const router   = useRouter();
  const mapRef   = useRef<any>(null);

  const [selected,        setSelected]        = useState<Vehicle | null>(null);
  const [locationGranted, setLocationGranted] = useState(false);
  const [locationDenied,  setLocationDenied]  = useState(false);

  // Request location permission on mount
  useEffect(() => {
    if (Platform.OS === 'web') return;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationGranted(true);
      } else {
        setLocationDenied(true);
      }
    })();
  }, []);

  const focusVehicle = useCallback((v: Vehicle) => {
    const next = selected?.id === v.id ? null : v;
    setSelected(next);
    if (next && mapRef.current && Platform.OS !== 'web') {
      mapRef.current.animateToRegion(
        { latitude: v.location.latitude, longitude: v.location.longitude, ...VEHICLE_DELTA },
        500,
      );
    }
  }, [selected]);

  const callDriver = async (v: Vehicle) => {
    if (!v.driver?.phone) return;
    const url = `tel:${v.driver.phone.replace(/\s/g, '')}`;
    const ok = await Linking.canOpenURL(url);
    if (ok) Linking.openURL(url);
  };

  // ── Web fallback ─────────────────────────────────────────────────────────────

  if (Platform.OS === 'web') {
    return <WebMapFallback selected={selected} onSelect={setSelected} router={router} />;
  }

  // ── Native map ───────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />

      {/* Full-screen MapView */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={ZAMBIA_REGION}
        showsUserLocation={locationGranted}
        showsMyLocationButton={false}
        showsCompass
        showsScale
        mapType="standard"
      >
        {mockVehicles.map((v) => (
          <Marker
            key={v.id}
            coordinate={{ latitude: v.location.latitude, longitude: v.location.longitude }}
            onPress={() => focusVehicle(v)}
            tracksViewChanges={false}
          >
            <VehicleMarkerPin vehicle={v} selected={selected?.id === v.id} />

            <Callout tooltip onPress={() => router.push(`/vehicle/${v.id}` as any)}>
              <View style={styles.callout}>
                <View style={[styles.calloutAccent, { backgroundColor: statusColor(v.status) }]} />
                <View style={styles.calloutBody}>
                  <Text style={styles.calloutPlate}>{v.plate}</Text>
                  <Text style={styles.calloutModel}>{v.make} {v.model}</Text>
                  {v.location.address ? (
                    <Text style={styles.calloutAddr} numberOfLines={2}>{v.location.address}</Text>
                  ) : null}
                  <View style={styles.calloutFooter}>
                    <View style={[styles.calloutDot, { backgroundColor: statusColor(v.status) }]} />
                    <Text style={[styles.calloutStatus, { color: statusColor(v.status) }]}>
                      {v.status.charAt(0).toUpperCase() + v.status.slice(1)}
                    </Text>
                    {v.speed > 0 && (
                      <Text style={styles.calloutSpeed}> · {v.speed} km/h</Text>
                    )}
                  </View>
                  {v.driver && (
                    <View style={styles.calloutDriver}>
                      <Ionicons name="person-outline" size={11} color={Colors.textMuted} />
                      <Text style={styles.calloutDriverName}>{v.driver.name}</Text>
                    </View>
                  )}
                  <View style={styles.calloutTapRow}>
                    <Text style={styles.calloutTap}>Open details</Text>
                    <Ionicons name="arrow-forward" size={11} color={Colors.accent} />
                  </View>
                </View>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {/* Top overlay — stats bar */}
      <SafeAreaView style={styles.topOverlay} edges={['top']} pointerEvents="box-none">
        <View style={styles.topBar}>
          <View style={styles.topBarCard}>
            <View style={styles.topBarStat}>
              <View style={[styles.topBarDot, { backgroundColor: Colors.statusActive }]} />
              <Text style={styles.topBarStatText}>
                {mockVehicles.filter((v) => v.status === 'active').length} Active
              </Text>
            </View>
            <View style={styles.topBarDivider} />
            <View style={styles.topBarStat}>
              <View style={[styles.topBarDot, { backgroundColor: Colors.statusIdle }]} />
              <Text style={styles.topBarStatText}>
                {mockVehicles.filter((v) => v.status === 'idle').length} Idle
              </Text>
            </View>
            <View style={styles.topBarDivider} />
            <View style={styles.topBarStat}>
              <View style={[styles.topBarDot, { backgroundColor: Colors.statusOffline }]} />
              <Text style={styles.topBarStatText}>
                {mockVehicles.filter((v) => v.status === 'offline').length} Offline
              </Text>
            </View>
          </View>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>

        {locationDenied && (
          <View style={styles.locationBanner}>
            <Ionicons name="location-outline" size={14} color={Colors.warning} />
            <Text style={styles.locationBannerText}>
              Location access denied — your position won't show on map.
            </Text>
          </View>
        )}
      </SafeAreaView>

      {/* My location button (custom) */}
      {locationGranted && (
        <TouchableOpacity
          style={styles.myLocBtn}
          onPress={() => {
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then((loc) => {
              mapRef.current?.animateToRegion({
                latitude:      loc.coords.latitude,
                longitude:     loc.coords.longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }, 600);
            });
          }}
        >
          <Ionicons name="locate" size={22} color={Colors.primary} />
        </TouchableOpacity>
      )}

      {/* Selected vehicle quick card */}
      {selected && (
        <View style={styles.selectedCard}>
          <TouchableOpacity
            style={styles.selectedMain}
            onPress={() => router.push(`/vehicle/${selected.id}` as any)}
            activeOpacity={0.85}
          >
            <View style={[styles.selectedAccentBar, { backgroundColor: statusColor(selected.status) }]} />
            <View style={styles.selectedInfo}>
              <Text style={styles.selectedPlate}>{selected.plate}</Text>
              <Text style={styles.selectedModel}>
                {selected.year} {selected.make} {selected.model}
              </Text>
              {selected.location.address ? (
                <Text style={styles.selectedAddr} numberOfLines={1}>
                  {selected.location.address}
                </Text>
              ) : null}
            </View>
            <View style={styles.selectedRight}>
              {selected.speed > 0 && (
                <View style={[styles.speedBadge, { backgroundColor: Colors.statusActive + '18' }]}>
                  <Text style={[styles.speedText, { color: Colors.statusActive }]}>
                    {selected.speed} km/h
                  </Text>
                </View>
              )}
              <StatusBadge status={selected.status} size="sm" />
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            </View>
          </TouchableOpacity>

          {/* Quick call button on the selected card */}
          {selected.driver && (
            <TouchableOpacity
              style={styles.quickCallBtn}
              onPress={() => callDriver(selected)}
            >
              <Ionicons name="call" size={18} color="#FFF" />
              <Text style={styles.quickCallText}>Call {selected.driver.name.split(' ')[0]}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Bottom vehicle chip strip */}
      <SafeAreaView style={styles.bottomStrip} edges={['bottom']}>
        <FlatList
          data={mockVehicles}
          keyExtractor={(v) => v.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.chip, selected?.id === item.id && styles.chipActive]}
              onPress={() => focusVehicle(item)}
            >
              <View style={[styles.chipDot, { backgroundColor: statusColor(item.status) }]} />
              <Text style={[styles.chipText, selected?.id === item.id && styles.chipTextActive]}>
                {item.plate}
              </Text>
            </TouchableOpacity>
          )}
        />
      </SafeAreaView>
    </View>
  );
}

// ─── Web fallback (Vercel / browser) ─────────────────────────────────────────

function WebMapFallback({
  selected, onSelect, router,
}: { selected: Vehicle | null; onSelect: (v: Vehicle | null) => void; router: any }) {
  return (
    <SafeAreaView style={styles.webRoot} edges={['bottom']}>
      {/* Pseudo-map backdrop */}
      <View style={styles.webMap}>
        {mockVehicles.map((v) => (
          <TouchableOpacity
            key={v.id}
            style={[
              styles.webPin,
              { left: `${((v.location.longitude - 25) / 7) * 70 + 10}%` as any,
                top:  `${((v.location.latitude + 18) / 8) * 80 + 5}%` as any },
              selected?.id === v.id && styles.webPinSelected,
            ]}
            onPress={() => onSelect(selected?.id === v.id ? null : v)}
          >
            <Ionicons name="car" size={13} color={selected?.id === v.id ? '#FFF' : statusColor(v.status)} />
          </TouchableOpacity>
        ))}
        <View style={styles.webOverlayHint} pointerEvents="none">
          <Ionicons name="map" size={36} color="rgba(255,255,255,0.2)" />
          <Text style={styles.webHintText}>GPS Map — native app only</Text>
          <Text style={styles.webHintSub}>{mockVehicles.length} vehicles · Zambia</Text>
        </View>
        {/* Legend */}
        <View style={styles.legend}>
          {['active','idle','offline','maintenance'].map((s) => (
            <View key={s} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: statusColor(s as Vehicle['status']) }]} />
              <Text style={styles.legendLabel}>{s.charAt(0).toUpperCase() + s.slice(1)}</Text>
            </View>
          ))}
        </View>
      </View>

      {selected && (
        <TouchableOpacity
          style={styles.webSelectedCard}
          onPress={() => router.push(`/vehicle/${selected.id}`)}
          activeOpacity={0.9}
        >
          <View style={styles.selectedInfo}>
            <Text style={styles.selectedPlate}>{selected.plate}</Text>
            <Text style={styles.selectedModel}>{selected.year} {selected.make} {selected.model}</Text>
            {selected.location.address ? (
              <Text style={styles.selectedAddr} numberOfLines={1}>{selected.location.address}</Text>
            ) : null}
          </View>
          <View style={styles.selectedRight}>
            <StatusBadge status={selected.status} size="sm" />
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </View>
        </TouchableOpacity>
      )}

      <View style={styles.webChipStrip}>
        <FlatList
          data={mockVehicles}
          keyExtractor={(v) => v.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.chip, selected?.id === item.id && styles.chipActive]}
              onPress={() => onSelect(selected?.id === item.id ? null : item)}
            >
              <View style={[styles.chipDot, { backgroundColor: statusColor(item.status) }]} />
              <Text style={[styles.chipText, selected?.id === item.id && styles.chipTextActive]}>
                {item.plate}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.backgroundDark },
  webRoot: { flex: 1, backgroundColor: Colors.backgroundLight },

  // Pin marker
  pinWrap:   { alignItems: 'center' },
  pinBubble: {
    width: 34, height: 34, borderRadius: 17, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 4, elevation: 4,
  },
  pinTail: {
    width: 0, height: 0,
    borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 7,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    marginTop: -1,
  },

  // Callout
  callout: {
    flexDirection: 'row', width: 200,
    backgroundColor: '#FFF',
    borderRadius: Radius.md, overflow: 'hidden',
    ...Shadow.lg,
  },
  calloutAccent: { width: 4 },
  calloutBody:   { flex: 1, padding: 10, gap: 3 },
  calloutPlate:  { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  calloutModel:  { fontSize: 11, color: Colors.textSecondary },
  calloutAddr:   { fontSize: 10.5, color: Colors.textMuted, lineHeight: 14 },
  calloutFooter: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  calloutDot:    { width: 7, height: 7, borderRadius: 3.5 },
  calloutStatus: { fontSize: 11, fontWeight: '700' },
  calloutSpeed:  { fontSize: 11, color: Colors.textSecondary },
  calloutDriver: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  calloutDriverName: { fontSize: 10.5, color: Colors.textMuted },
  calloutTapRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  calloutTap:    { fontSize: 10, color: Colors.accent, fontWeight: '600' },

  // Top overlay
  topOverlay:  { position: 'absolute', top: 0, left: 0, right: 0 },
  topBar:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 6, paddingBottom: 4 },
  topBarCard:  {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.97)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7, gap: 10, ...Shadow.sm,
  },
  topBarStat:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  topBarDot:     { width: 7, height: 7, borderRadius: 3.5 },
  topBarStatText:{ fontSize: 11.5, fontWeight: '700', color: Colors.textPrimary },
  topBarDivider: { width: 1, height: 12, backgroundColor: Colors.border },

  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.primary, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  liveDot:  { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.statusActive },
  liveText: { fontSize: 9.5, fontWeight: '800', color: '#FFF', letterSpacing: 1 },

  // Location denied banner
  locationBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: 14, marginTop: 6, backgroundColor: Colors.warning + '18',
    borderRadius: Radius.sm, padding: 9, borderWidth: 1, borderColor: Colors.warning + '40',
  },
  locationBannerText: { fontSize: FontSize.xs, color: Colors.warning, flex: 1 },

  // My location FAB
  myLocBtn: {
    position: 'absolute', right: 14, bottom: 170,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center',
    ...Shadow.md,
  },

  // Selected vehicle card
  selectedCard: {
    position: 'absolute', bottom: 100,
    left: 14, right: 14,
    backgroundColor: '#FFF', borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.lg,
  },
  selectedMain:      { flexDirection: 'row', alignItems: 'center' },
  selectedAccentBar: { width: 4, alignSelf: 'stretch' },
  selectedInfo:      { flex: 1, padding: 12 },
  selectedPlate:     { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textPrimary },
  selectedModel:     { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  selectedAddr:      { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  selectedRight:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 12 },
  speedBadge:        { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  speedText:         { fontSize: 11, fontWeight: '700' },

  quickCallBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: Colors.statusActive,
    paddingVertical: 10,
  },
  quickCallText: { fontSize: 13, fontWeight: '700', color: '#FFF' },

  // Bottom chip strip
  bottomStrip: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  chipList: { paddingHorizontal: Spacing.md, paddingVertical: 10, gap: 8 },
  chip:     {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.backgroundLight,
    borderWidth: 1, borderColor: Colors.border,
  },
  chipActive:     { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipDot:        { width: 7, height: 7, borderRadius: 3.5 },
  chipText:       { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: '600' },
  chipTextActive: { color: '#FFF' },

  // Web map
  webMap: {
    flex: 1, backgroundColor: Colors.backgroundDark,
    position: 'relative',
  },
  webPin: {
    position: 'absolute',
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  webPinSelected: { backgroundColor: Colors.accent, borderColor: Colors.accent, transform: [{ scale: 1.2 }] },
  webOverlayHint: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', gap: 6,
    pointerEvents: 'none' as any,
  },
  webHintText: { color: 'rgba(255,255,255,0.4)', fontSize: FontSize.lg, fontWeight: '700' },
  webHintSub:  { color: 'rgba(255,255,255,0.25)', fontSize: FontSize.sm },
  legend:      { position: 'absolute', bottom: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: Radius.md, padding: 8, gap: 5 },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:   { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { color: 'rgba(255,255,255,0.8)', fontSize: FontSize.xs },
  webSelectedCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.cardBackground, margin: Spacing.sm,
    borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.sm, ...Shadow.md,
  },
  webChipStrip: {
    backgroundColor: Colors.cardBackground,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
});
