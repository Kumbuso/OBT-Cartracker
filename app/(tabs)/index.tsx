import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Animated,
  Platform,
  StatusBar,
  Linking,
  Modal,
  Switch,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useAuth } from '../../context/AuthContext';
import { mockVehicles } from '../../data/mockData';
import { Colors, Radius, Shadow, FontSize, Spacing } from '../../constants/theme';
import type { Vehicle } from '../../types';
import FleetMap from '../../components/FleetMap';
import type { MapStyle } from '../../components/FleetMap';

interface MapSettings {
  style:       MapStyle;
  showLabels:  boolean;
  showPlate:   boolean;
  showTraffic: boolean;
}

const MAP_STYLES: { key: MapStyle; label: string; icon: string; desc: string }[] = [
  { key: 'standard',  label: 'Street',    icon: 'map-outline',       desc: 'Default road map' },
  { key: 'satellite', label: 'Satellite', icon: 'globe-outline',     desc: 'Aerial imagery' },
  { key: 'hybrid',    label: 'Hybrid',    icon: 'layers-outline',    desc: 'Imagery + labels' },
];

const STATUS_COLOR: Record<string, string> = {
  active:      Colors.statusActive,
  idle:        Colors.statusIdle,
  offline:     Colors.statusOffline,
  maintenance: Colors.statusMaintenance,
};

const LEGEND_ITEMS = [
  { label: 'Active',      color: Colors.statusActive,      desc: 'Engine on, moving'   },
  { label: 'Idle',        color: Colors.statusIdle,        desc: 'Engine on, stationary'},
  { label: 'Offline',     color: Colors.statusOffline,     desc: 'No GPS signal'        },
  { label: 'Maintenance', color: Colors.statusMaintenance, desc: 'Out of service'       },
];

function greet() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const router   = useRouter();
  const mapRef   = useRef<any>(null);

  const [selected,        setSelected]        = useState<Vehicle | null>(null);
  const [locationGranted, setLocationGranted] = useState(false);
  const [showSettings,    setShowSettings]    = useState(false);
  const [legendOpen,      setLegendOpen]      = useState(true);
  const [mapSettings,     setMapSettings]     = useState<MapSettings>({
    style: 'standard', showLabels: true, showPlate: false, showTraffic: false,
  });

  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.8, duration: 800, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 1,   duration: 800, useNativeDriver: false }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status === 'granted') setLocationGranted(true);
    });
  }, []);

  const focusVehicle = useCallback((v: Vehicle) => {
    const next = selected?.id === v.id ? null : v;
    setSelected(next);
    if (next && mapRef.current && Platform.OS !== 'web') {
      mapRef.current.animateToRegion(
        { latitude: v.location.latitude, longitude: v.location.longitude, latitudeDelta: 0.04, longitudeDelta: 0.04 },
        500,
      );
    }
  }, [selected]);

  const callDriver = async (v: Vehicle) => {
    if (!v.driver?.phone) return;
    const url = `tel:${v.driver.phone.replace(/\s/g, '')}`;
    if (await Linking.canOpenURL(url)) Linking.openURL(url);
  };

  const vehicles = mockVehicles;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Full-screen map */}
      <FleetMap
        vehicles={vehicles}
        selected={selected}
        onSelect={setSelected}
        onOpenVehicle={(v) => router.push(`/vehicle/${v.id}` as any)}
        showUserLocation={locationGranted}
        mapRef={mapRef}
        mapStyle={mapSettings.style}
        showLabels={mapSettings.showLabels}
        showPlate={mapSettings.showPlate}
        showTraffic={mapSettings.showTraffic}
      />

      {/* Top greeting + LIVE pill */}
      <SafeAreaView style={styles.topOverlay} edges={['top']}>
        <View style={styles.greetingCard}>
          <Text style={styles.greetingText}>
            {greet()}, {user?.name?.split(' ')[0] ?? 'there'}
          </Text>
          <View style={styles.topRight}>
            <View style={styles.livePill}>
              <Animated.View style={[styles.liveDot, { transform: [{ scale: pulse }] }]} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
            <TouchableOpacity style={styles.settingsBtn} onPress={() => setShowSettings(true)}>
              <Ionicons name="settings-outline" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {/* Map settings sheet */}
      <Modal
        visible={showSettings}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSettings(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowSettings(false)}
        />
        <View style={styles.settingsSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View style={styles.sheetTitleRow}>
              <Ionicons name="map" size={20} color={Colors.primary} />
              <Text style={styles.sheetTitle}>Map Settings</Text>
            </View>
            <TouchableOpacity onPress={() => setShowSettings(false)}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Map style */}
          <Text style={styles.settingsSectionLabel}>MAP STYLE</Text>
          <View style={styles.styleGrid}>
            {MAP_STYLES.map((opt) => {
              const active = mapSettings.style === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.styleCard, active && styles.styleCardActive]}
                  onPress={() => setMapSettings((s) => ({ ...s, style: opt.key }))}
                  activeOpacity={0.8}
                >
                  <View style={[styles.styleIconWrap, { backgroundColor: active ? Colors.primary : Colors.backgroundLight }]}>
                    <Ionicons name={opt.icon as any} size={20} color={active ? '#FFF' : Colors.textSecondary} />
                  </View>
                  <Text style={[styles.styleLabel, active && styles.styleLabelActive]}>{opt.label}</Text>
                  <Text style={styles.styleDesc}>{opt.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Overlays */}
          <Text style={styles.settingsSectionLabel}>OVERLAYS</Text>
          <View style={styles.togglesCard}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleLeft}>
                <View style={[styles.toggleIcon, { backgroundColor: Colors.accent + '14' }]}>
                  <Ionicons name="person-outline" size={15} color={Colors.accent} />
                </View>
                <View>
                  <Text style={styles.toggleLabel}>Driver Labels</Text>
                  <Text style={styles.toggleDesc}>Show driver names on map pins</Text>
                </View>
              </View>
              <Switch
                value={mapSettings.showLabels}
                onValueChange={(v) => setMapSettings((s) => ({ ...s, showLabels: v }))}
                trackColor={{ false: Colors.border, true: Colors.primary + '60' }}
                thumbColor={mapSettings.showLabels ? Colors.primary : Colors.textMuted}
              />
            </View>
            <View style={styles.toggleDivider} />
            <View style={styles.toggleRow}>
              <View style={styles.toggleLeft}>
                <View style={[styles.toggleIcon, { backgroundColor: '#8B5CF6' + '14' }]}>
                  <Ionicons name="card-outline" size={15} color="#8B5CF6" />
                </View>
                <View>
                  <Text style={styles.toggleLabel}>Show Plate Number</Text>
                  <Text style={styles.toggleDesc}>Display registration plate on map tags</Text>
                </View>
              </View>
              <Switch
                value={mapSettings.showPlate}
                onValueChange={(v) => setMapSettings((s) => ({ ...s, showPlate: v }))}
                trackColor={{ false: Colors.border, true: '#8B5CF6' + '60' }}
                thumbColor={mapSettings.showPlate ? '#8B5CF6' : Colors.textMuted}
              />
            </View>
            <View style={styles.toggleDivider} />
            <View style={styles.toggleRow}>
              <View style={styles.toggleLeft}>
                <View style={[styles.toggleIcon, { backgroundColor: Colors.danger + '14' }]}>
                  <Ionicons name="car-outline" size={15} color={Colors.danger} />
                </View>
                <View>
                  <Text style={styles.toggleLabel}>Traffic Layer</Text>
                  <Text style={styles.toggleDesc}>Live traffic overlay {Platform.OS === 'web' ? '(mobile only)' : ''}</Text>
                </View>
              </View>
              <Switch
                value={mapSettings.showTraffic}
                onValueChange={(v) => setMapSettings((s) => ({ ...s, showTraffic: v }))}
                disabled={Platform.OS === 'web'}
                trackColor={{ false: Colors.border, true: Colors.danger + '60' }}
                thumbColor={mapSettings.showTraffic ? Colors.danger : Colors.textMuted}
              />
            </View>
          </View>

          <View style={{ height: Spacing.xl }} />
        </View>
      </Modal>

      {/* My-location FAB */}
      {locationGranted && (
        <TouchableOpacity
          style={[styles.locFab, { bottom: selected ? 170 : 76 }]}
          onPress={async () => {
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            mapRef.current?.animateToRegion(
              { latitude: loc.coords.latitude, longitude: loc.coords.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 },
              600,
            );
          }}
        >
          <Ionicons name="locate" size={22} color={Colors.primary} />
        </TouchableOpacity>
      )}

      {/* Selected vehicle card */}
      {selected && (
        <View style={styles.selectedCard}>
          <TouchableOpacity
            style={styles.selectedMain}
            onPress={() => router.push(`/vehicle/${selected.id}` as any)}
            activeOpacity={0.85}
          >
            <View style={[styles.selectedAccent, { backgroundColor: STATUS_COLOR[selected.status] }]} />
            <View style={styles.selectedInfo}>
              <Text style={styles.selectedPlate}>{selected.plate}</Text>
              <Text style={styles.selectedModel}>{selected.year} {selected.make} {selected.model}</Text>
              {selected.location.address && (
                <Text style={styles.selectedAddr} numberOfLines={1}>{selected.location.address}</Text>
              )}
            </View>
            <View style={styles.selectedRight}>
              {selected.speed > 0 && (
                <View style={[styles.speedBadge, { backgroundColor: Colors.statusActive + '1A' }]}>
                  <Text style={[styles.speedText, { color: Colors.statusActive }]}>{selected.speed} km/h</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={15} color={Colors.textMuted} />
            </View>
          </TouchableOpacity>
          {selected.driver && (
            <TouchableOpacity style={styles.callBtn} onPress={() => callDriver(selected)}>
              <Ionicons name="call" size={14} color="#FFF" />
              <Text style={styles.callBtnText}>Call {selected.driver.name.split(' ')[0]}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Map legend */}
      {legendOpen ? (
        <View style={styles.legend}>
          <View style={styles.legendHeader}>
            <Ionicons name="information-circle" size={13} color={Colors.primary} />
            <Text style={styles.legendTitle}>Map Legend</Text>
            <TouchableOpacity onPress={() => setLegendOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="chevron-back" size={14} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
          <View style={styles.legendDivider} />
          {LEGEND_ITEMS.map((item) => (
            <View key={item.label} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <View style={styles.legendText}>
                <Text style={styles.legendLabel}>{item.label}</Text>
                <Text style={styles.legendDesc}>{item.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <TouchableOpacity style={styles.legendTab} onPress={() => setLegendOpen(true)}>
          <Ionicons name="information-circle-outline" size={16} color={Colors.primary} />
          <Text style={styles.legendTabText}>Legend</Text>
        </TouchableOpacity>
      )}

      {/* Bottom vehicle chip strip */}
      <SafeAreaView style={styles.chipStrip} edges={['bottom']}>
        <FlatList
          data={vehicles}
          keyExtractor={(v) => v.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.chip, selected?.id === item.id && styles.chipActive]}
              onPress={() => focusVehicle(item)}
            >
              <View style={[styles.chipDot, { backgroundColor: STATUS_COLOR[item.status] }]} />
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

const styles = StyleSheet.create({
  root: { flex: 1 },

  topOverlay: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 14, paddingTop: 6, zIndex: 1000 },
  greetingCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: Radius.lg,
    paddingHorizontal: 14, paddingVertical: 10,
    ...Shadow.md,
  },
  greetingText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary, flex: 1, marginRight: 8 },
  topRight:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  livePill:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.primary + '12', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  liveDot:      { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.statusActive },
  liveText:     { fontSize: 10, fontWeight: '800', color: Colors.primary, letterSpacing: 0.8 },
  settingsBtn:  { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.backgroundLight, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },

  // Settings modal
  modalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  settingsSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.cardBackground,
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.md, paddingBottom: Spacing.md,
    ...Shadow.lg,
  },
  sheetHandle:   { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  sheetHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm },
  sheetTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sheetTitle:    { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textPrimary },

  settingsSectionLabel: { fontSize: 10.5, fontWeight: '800', color: Colors.textMuted, letterSpacing: 0.8, marginTop: Spacing.md, marginBottom: Spacing.sm },

  // Style grid
  styleGrid:      { flexDirection: 'row', gap: 10 },
  styleCard: {
    flex: 1, alignItems: 'center', gap: 6, padding: 12,
    backgroundColor: Colors.backgroundLight, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  styleCardActive:  { borderColor: Colors.primary, backgroundColor: Colors.primary + '08' },
  styleIconWrap:    { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  styleLabel:       { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  styleLabelActive: { color: Colors.primary },
  styleDesc:        { fontSize: 10, color: Colors.textMuted, textAlign: 'center' },

  // Toggle rows
  togglesCard:  { backgroundColor: Colors.backgroundLight, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  toggleRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md },
  toggleLeft:   { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  toggleIcon:   { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  toggleLabel:  { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  toggleDesc:   { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  toggleDivider:{ height: 1, backgroundColor: Colors.border },

  locFab: {
    position: 'absolute', right: 14, zIndex: 1000,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center',
    ...Shadow.md,
  },

  selectedCard: {
    position: 'absolute', left: 12, right: 12, bottom: 72, zIndex: 1000,
    backgroundColor: '#FFF', borderRadius: Radius.lg, overflow: 'hidden',
    ...Shadow.lg,
  },
  selectedMain:   { flexDirection: 'row', alignItems: 'center' },
  selectedAccent: { width: 4, alignSelf: 'stretch' },
  selectedInfo:   { flex: 1, paddingVertical: 10, paddingHorizontal: 10 },
  selectedPlate:  { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  selectedModel:  { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  selectedAddr:   { fontSize: 10.5, color: Colors.textMuted, marginTop: 2 },
  selectedRight:  { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 10 },
  speedBadge:     { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3 },
  speedText:      { fontSize: 11, fontWeight: '700' },
  callBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: Colors.statusActive, paddingVertical: 8 },
  callBtnText:    { fontSize: 12.5, fontWeight: '700', color: '#FFF' },

  // Legend
  legend: {
    position: 'absolute', left: 12, top: '20%', zIndex: 999,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: Radius.md, paddingHorizontal: 11, paddingVertical: 10,
    minWidth: 148,
    ...Shadow.md,
  },
  legendHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 7,
  },
  legendTitle: { flex: 1, fontSize: 11, fontWeight: '800', color: Colors.textPrimary, letterSpacing: 0.2 },
  legendDivider: { height: 1, backgroundColor: Colors.border, marginBottom: 8 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  legendDot: { width: 11, height: 11, borderRadius: 5.5, flexShrink: 0 },
  legendText: { flex: 1 },
  legendLabel: { fontSize: 11.5, fontWeight: '700', color: Colors.textPrimary, lineHeight: 14 },
  legendDesc:  { fontSize: 9.5, color: Colors.textMuted, lineHeight: 12 },
  legendTab: {
    position: 'absolute', left: 12, top: '20%', zIndex: 999,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: Radius.md,
    paddingHorizontal: 10, paddingVertical: 7,
    ...Shadow.md,
  },
  legendTabText: { fontSize: 11, fontWeight: '700', color: Colors.primary },

  chipStrip: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 1000,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  chipList:       { paddingHorizontal: 12, paddingVertical: 9, gap: 8 },
  chip:           { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: Colors.backgroundLight, borderWidth: 1, borderColor: Colors.border },
  chipActive:     { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipDot:        { width: 7, height: 7, borderRadius: 3.5 },
  chipText:       { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: '600' },
  chipTextActive: { color: '#FFF' },
});
