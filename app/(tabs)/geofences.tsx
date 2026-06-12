import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { mockGeofences, mockVehicles, mockGeofenceStatuses } from '../../data/mockData';
import { Colors, Spacing, Radius, FontSize, Shadow } from '../../constants/theme';
import type { Geofence, GeofenceType, Coordinates } from '../../types';
import GeofenceMap from '../../components/GeofenceMap';
import type { CameraTarget } from '../../components/GeofenceMap';

// ── Constants ─────────────────────────────────────────────────────────────────
const SCREEN_H = Dimensions.get('window').height;
const MAP_H_NORMAL = Math.round(SCREEN_H * 0.44);
const MAP_H_DRAW = Math.round(SCREEN_H * 0.74);

const ZONE_COLORS = ['#3E92CC', '#2DC653', '#F4A261', '#E63946', '#9B5DE5', '#F15BB5'];

// ── Nominatim types ───────────────────────────────────────────────────────────
interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  class: string;
  boundingbox: string[]; // [minLat, maxLat, minLng, maxLng]
  geojson?: {
    type: 'Point' | 'Polygon' | 'MultiPolygon' | 'LineString';
    coordinates: any;
  };
  address?: {
    country?: string;
    country_code?: string;
    state?: string;
    city?: string;
    town?: string;
  };
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

function computeCentroid(pts: Coordinates[]): Coordinates {
  const lat = pts.reduce((s, p) => s + p.latitude, 0) / pts.length;
  const lng = pts.reduce((s, p) => s + p.longitude, 0) / pts.length;
  return { latitude: lat, longitude: lng };
}

/** Sample a GeoJSON ring ([lng, lat][]) to ≤120 points and convert to Coordinates. */
function geoJSONRingToCoords(ring: number[][], max = 120): Coordinates[] {
  const open = ring.slice(0, -1); // GeoJSON rings repeat first point at end
  const step = Math.ceil(open.length / max);
  return open
    .filter((_, i) => i % step === 0)
    .map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
}

/** Extract the best polygon from a Nominatim GeoJSON response. */
function extractPolygon(geojson: NominatimResult['geojson']): Coordinates[] | null {
  if (!geojson) return null;
  if (geojson.type === 'Polygon') {
    return geoJSONRingToCoords(geojson.coordinates[0]);
  }
  if (geojson.type === 'MultiPolygon') {
    // Pick the ring with the most points (largest polygon)
    const rings: number[][][] = (geojson.coordinates as number[][][][]).map((p) => p[0]);
    const largest = rings.reduce((a, b) => (b.length > a.length ? b : a), rings[0]);
    return geoJSONRingToCoords(largest);
  }
  return null;
}

function placeTypeLabel(result: NominatimResult) {
  const t = result.type;
  if (t === 'administrative') return 'Region / Admin';
  if (t === 'city' || t === 'town' || t === 'village') return t.charAt(0).toUpperCase() + t.slice(1);
  if (t === 'state' || t === 'province') return 'Province / State';
  if (t === 'country') return 'Country';
  if (result.class === 'boundary') return 'Boundary';
  return result.class || t;
}

// ── Location Permission Modal ─────────────────────────────────────────────────
function LocationPermModal({
  visible,
  onAllow,
  onSkip,
}: {
  visible: boolean;
  onAllow: () => void;
  onSkip: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.permOverlay}>
        <View style={styles.permCard}>
          <View style={styles.permIconWrap}>
            <Ionicons name="location" size={32} color={Colors.accent} />
          </View>
          <Text style={styles.permTitle}>Allow Location Access</Text>
          <Text style={styles.permBody}>
            OBT MobileTracker wants to use your location to center the map and help define
            accurate geofence zones around your current area.
          </Text>
          <TouchableOpacity style={styles.permAllow} onPress={onAllow}>
            <Ionicons name="location" size={16} color="#FFF" />
            <Text style={styles.permAllowText}>Allow Location</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.permSkip} onPress={onSkip}>
            <Text style={styles.permSkipText}>Skip — use default map</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Place Search Overlay ──────────────────────────────────────────────────────
interface SearchOverlayProps {
  query: string;
  results: NominatimResult[];
  isSearching: boolean;
  importBoundary: Coordinates[] | null;
  onChangeQuery: (q: string) => void;
  onSelectResult: (r: NominatimResult) => void;
  onImportBoundary: () => void;
  onClose: () => void;
}

function SearchOverlay({
  query,
  results,
  isSearching,
  importBoundary,
  onChangeQuery,
  onSelectResult,
  onImportBoundary,
  onClose,
}: SearchOverlayProps) {
  return (
    <View style={styles.searchOverlay}>
      {/* Search input */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color={Colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={onChangeQuery}
          placeholder="Search city, town, province, country…"
          placeholderTextColor={Colors.textMuted}
          autoFocus
          returnKeyType="search"
        />
        {isSearching ? (
          <ActivityIndicator size="small" color={Colors.accent} />
        ) : (
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Import boundary banner */}
      {importBoundary && (
        <TouchableOpacity style={styles.importBanner} onPress={onImportBoundary}>
          <Ionicons name="git-merge-outline" size={16} color={Colors.primary} />
          <Text style={styles.importBannerText}>
            Boundary found — tap to use it as geofence ({importBoundary.length} pts)
          </Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
        </TouchableOpacity>
      )}

      {/* Results list */}
      {results.length > 0 && (
        <View style={styles.resultsList}>
          {results.map((r) => (
            <TouchableOpacity
              key={r.place_id}
              style={styles.resultRow}
              onPress={() => onSelectResult(r)}
            >
              <Ionicons
                name={
                  r.type === 'country' ? 'flag-outline'
                  : r.type === 'city' || r.type === 'town' ? 'business-outline'
                  : 'map-outline'
                }
                size={18}
                color={Colors.accent}
              />
              <View style={styles.resultInfo}>
                <Text style={styles.resultName} numberOfLines={1}>
                  {r.display_name.split(',')[0]}
                </Text>
                <Text style={styles.resultSub} numberOfLines={1}>
                  {placeTypeLabel(r)} · {r.display_name.split(',').slice(1, 3).join(',').trim()}
                </Text>
              </View>
              {extractPolygon(r.geojson) && (
                <View style={styles.hasBoundaryBadge}>
                  <Ionicons name="git-merge-outline" size={10} color={Colors.primary} />
                  <Text style={styles.hasBoundaryText}>Boundary</Text>
                </View>
              )}
              <Ionicons name="navigate-outline" size={14} color={Colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {!isSearching && query.length >= 2 && results.length === 0 && (
        <View style={styles.noResults}>
          <Text style={styles.noResultsText}>No places found — try a different name</Text>
        </View>
      )}
    </View>
  );
}

// ── Save Zone Sheet ───────────────────────────────────────────────────────────
interface SaveSheetProps {
  visible: boolean;
  pointCount: number;
  prefilledName?: string;
  onSave: (name: string, type: GeofenceType, color: string, exit: boolean, enter: boolean) => void;
  onRedraw: () => void;
  onCancel: () => void;
}

function SaveZoneSheet({ visible, pointCount, prefilledName, onSave, onRedraw, onCancel }: SaveSheetProps) {
  const [name, setName] = useState(prefilledName ?? '');
  const [type, setType] = useState<GeofenceType>('allowed');
  const [color, setColor] = useState(ZONE_COLORS[0]);
  const [alertExit, setAlertExit] = useState(true);
  const [alertEnter, setAlertEnter] = useState(false);

  useEffect(() => {
    if (prefilledName) setName(prefilledName);
  }, [prefilledName]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(name.trim(), type, color, alertExit, alertEnter);
    setName(''); setType('allowed'); setColor(ZONE_COLORS[0]); setAlertExit(true); setAlertEnter(false);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <KeyboardAvoidingView style={styles.sheetOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Save Geofence Zone</Text>
              <Text style={styles.sheetSub}>{pointCount} boundary points</Text>
            </View>
            <TouchableOpacity style={styles.redrawBtn} onPress={onRedraw}>
              <Ionicons name="refresh" size={14} color={Colors.accent} />
              <Text style={styles.redrawText}>Redraw</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.fieldLabel}>Zone Name *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Warehouse Alpha, Lagos State"
            placeholderTextColor={Colors.textMuted}
            autoFocus={!prefilledName}
          />

          <Text style={styles.fieldLabel}>Zone Type</Text>
          <View style={styles.typeRow}>
            {(['allowed', 'restricted'] as GeofenceType[]).map((t) => (
              <TouchableOpacity
                key={t}
                style={[
                  styles.typeChip,
                  type === t && { backgroundColor: t === 'allowed' ? Colors.statusActive : Colors.danger, borderColor: 'transparent' },
                ]}
                onPress={() => setType(t)}
              >
                <Ionicons name={t === 'allowed' ? 'checkmark-circle' : 'ban'} size={14} color={type === t ? '#FFF' : Colors.textSecondary} />
                <Text style={[styles.typeChipText, type === t && { color: '#FFF' }]}>
                  {t === 'allowed' ? 'Allowed' : 'Restricted'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Color</Text>
          <View style={styles.colorRow}>
            {ZONE_COLORS.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.colorSwatch, { backgroundColor: c }, color === c && styles.colorSwatchActive]}
                onPress={() => setColor(c)}
              >
                {color === c && <Ionicons name="checkmark" size={14} color="#FFF" />}
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.toggleGroup}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleLabel}>
                <Ionicons name="log-out-outline" size={15} color={Colors.textSecondary} />
                <Text style={styles.toggleText}>Alert when vehicle exits</Text>
              </View>
              <Switch value={alertExit} onValueChange={setAlertExit} trackColor={{ false: Colors.border, true: Colors.accent + '80' }} thumbColor={alertExit ? Colors.accent : '#eee'} />
            </View>
            <View style={styles.toggleRow}>
              <View style={styles.toggleLabel}>
                <Ionicons name="log-in-outline" size={15} color={Colors.textSecondary} />
                <Text style={styles.toggleText}>Alert when vehicle enters</Text>
              </View>
              <Switch value={alertEnter} onValueChange={setAlertEnter} trackColor={{ false: Colors.border, true: Colors.accent + '80' }} thumbColor={alertEnter ? Colors.accent : '#eee'} />
            </View>
          </View>

          <TouchableOpacity style={[styles.saveBtn, !name.trim() && styles.saveBtnOff]} onPress={handleSave} disabled={!name.trim()}>
            <Ionicons name="save" size={18} color="#FFF" />
            <Text style={styles.saveBtnText}>Create Zone</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelLink} onPress={onCancel}>
            <Text style={styles.cancelLinkText}>Discard and cancel</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Zone Card ─────────────────────────────────────────────────────────────────
function ZoneCard({ zone, onToggle, onFocus }: { zone: Geofence; onToggle: () => void; onFocus: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const assigned = mockVehicles.filter((v) => zone.assignedVehicleIds.includes(v.id));
  const inside = mockGeofenceStatuses.filter((s) => s.geofenceId === zone.id && s.inside).length;
  const isPolygon = !!zone.polygon;

  return (
    <View style={[styles.zoneCard, !zone.active && styles.zoneCardOff]}>
      <TouchableOpacity style={styles.zoneCardRow} onPress={() => setExpanded((x) => !x)} activeOpacity={0.8}>
        <View style={[styles.zoneColorBar, { backgroundColor: zone.color }]} />
        <View style={styles.zoneInfo}>
          <View style={styles.zoneNameRow}>
            <Text style={styles.zoneName} numberOfLines={1}>{zone.name}</Text>
            <View style={[styles.zoneBadge, zone.type === 'restricted' ? styles.zoneBadgeR : styles.zoneBadgeA]}>
              <Text style={[styles.zoneBadgeText, { color: zone.type === 'restricted' ? Colors.danger : Colors.statusActive }]}>
                {zone.type === 'restricted' ? 'Restricted' : 'Allowed'}
              </Text>
            </View>
          </View>
          <Text style={styles.zoneMeta}>
            {isPolygon ? `Polygon · ${zone.polygon!.length} pts` : `Circle · ${zone.radiusKm} km`}
            {assigned.length > 0 ? ` · ${assigned.length} vehicles` : ''}
            {inside > 0 ? ` · ${inside} inside` : ''}
          </Text>
        </View>
        <View style={styles.zoneRight}>
          <TouchableOpacity onPress={onFocus} style={styles.focusBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="locate" size={16} color={Colors.accent} />
          </TouchableOpacity>
          <Switch value={zone.active} onValueChange={onToggle} trackColor={{ false: Colors.border, true: zone.color + '60' }} thumbColor={zone.active ? zone.color : '#eee'} style={styles.zoneSwitch} />
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.textMuted} />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.zoneExpanded}>
          <View style={styles.expandedRow}>
            <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.expandedText} numberOfLines={2}>
              {zone.center.address || `${zone.center.latitude.toFixed(5)}, ${zone.center.longitude.toFixed(5)}`}
            </Text>
          </View>
          <View style={styles.flagRow}>
            {[
              { on: zone.alertOnExit, icon: 'log-out-outline', label: 'Exit' },
              { on: zone.alertOnEnter, icon: 'log-in-outline', label: 'Enter' },
            ].map((f) => (
              <View key={f.label} style={[styles.flag, f.on ? styles.flagOn : styles.flagOff]}>
                <Ionicons name={f.icon as any} size={10} color={f.on ? Colors.warning : Colors.textMuted} />
                <Text style={[styles.flagText, { color: f.on ? Colors.warning : Colors.textMuted }]}>
                  {f.label} {f.on ? 'alert' : 'silent'}
                </Text>
              </View>
            ))}
          </View>
          {assigned.length > 0 && (
            <View style={styles.chipRow}>
              {assigned.map((v) => (
                <View key={v.id} style={styles.vChip}>
                  <View style={[styles.vChipDot, { backgroundColor: getStatusColor(v.status) }]} />
                  <Text style={styles.vChipText}>{v.plate}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ── Vehicle Status List ───────────────────────────────────────────────────────
function VehicleStatusList({ zones }: { zones: Geofence[] }) {
  return (
    <>
      {mockVehicles.map((v) => {
        const myZones = zones.filter((z) => z.assignedVehicleIds.includes(v.id));
        const violation = myZones.some(
          (z) => z.type === 'restricted' && mockGeofenceStatuses.some((s) => s.vehicleId === v.id && s.geofenceId === z.id && s.inside),
        );
        return (
          <View key={v.id} style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <View>
                <Text style={styles.statusPlate}>{v.plate}</Text>
                <Text style={styles.statusModel}>{v.make} {v.model}</Text>
              </View>
              {violation ? (
                <View style={styles.violBadge}><Ionicons name="warning" size={11} color={Colors.danger} /><Text style={styles.violText}>Violation</Text></View>
              ) : myZones.length > 0 ? (
                <View style={styles.okBadge}><Ionicons name="shield-checkmark" size={11} color={Colors.statusActive} /><Text style={styles.okText}>Compliant</Text></View>
              ) : null}
            </View>
            {myZones.length === 0 ? (
              <Text style={styles.noZone}>Not assigned to any zone</Text>
            ) : (
              <View style={{ gap: 5 }}>
                {myZones.map((z) => {
                  const ins = mockGeofenceStatuses.some((s) => s.vehicleId === v.id && s.geofenceId === z.id && s.inside);
                  const isViol = z.type === 'restricted' && ins;
                  return (
                    <View key={z.id} style={styles.zoneRow}>
                      <View style={[styles.zoneDot, { backgroundColor: z.color }]} />
                      <Text style={styles.zoneRowName}>{z.name}</Text>
                      <View style={[styles.inBadge, isViol ? styles.inBadgeDanger : ins ? styles.inBadgeOk : styles.inBadgeOut]}>
                        <Text style={[styles.inBadgeText, { color: isViol ? Colors.danger : ins ? Colors.statusActive : Colors.textMuted }]}>
                          {ins ? (isViol ? 'INSIDE (!)' : 'Inside') : 'Outside'}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
    </>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function GeofencesScreen() {
  // State
  const [zones, setZones] = useState<Geofence[]>(mockGeofences);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawnPoints, setDrawnPoints] = useState<Coordinates[]>([]);
  const [showSave, setShowSave] = useState(false);
  const [savePrefilledName, setSavePrefilledName] = useState<string | undefined>();
  const [listTab, setListTab] = useState<'zones' | 'status'>('zones');

  // Location
  const [showPermModal, setShowPermModal] = useState(false);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);

  // Search
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<CameraTarget | null>(null);
  const [importBoundary, setImportBoundary] = useState<Coordinates[] | null>(null);

  const searchTimer = useRef<any>(null);

  // ── Location permission on mount ──────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'undetermined') {
        setShowPermModal(true);
      } else if (status === 'granted') {
        fetchLocation();
      }
    })();
  }, []);

  const fetchLocation = async () => {
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    } catch (_) {}
  };

  const handleAllowLocation = async () => {
    setShowPermModal(false);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') fetchLocation();
  };

  // ── Drawing ───────────────────────────────────────────────────────────────
  const startDrawing = () => { setDrawnPoints([]); setIsDrawing(true); setShowSearch(false); };
  const cancelDrawing = () => { setDrawnPoints([]); setIsDrawing(false); };
  const undoLast = () => setDrawnPoints((p) => p.slice(0, -1));
  const finishDrawing = () => { if (drawnPoints.length >= 3) { setSavePrefilledName(undefined); setShowSave(true); } };

  const handleMapPress = useCallback((coord: Coordinates) => {
    if (!isDrawing) return;
    setDrawnPoints((prev) => [...prev, coord]);
  }, [isDrawing]);

  const handleSaveZone = (name: string, type: GeofenceType, color: string, exit: boolean, enter: boolean) => {
    const centroid = computeCentroid(drawnPoints);
    const newZone: Geofence = {
      id: `z${Date.now()}`,
      name,
      type,
      center: centroid,
      radiusKm: 0,
      polygon: drawnPoints,
      assignedVehicleIds: [],
      active: true,
      alertOnExit: exit,
      alertOnEnter: enter,
      color,
    };
    setZones((prev) => [newZone, ...prev]);
    setDrawnPoints([]);
    setIsDrawing(false);
    setShowSave(false);
    // Zoom to new zone
    setCameraTarget({ coords: drawnPoints });
  };

  const focusZone = (zone: Geofence) => {
    if (zone.polygon) {
      setCameraTarget({ coords: zone.polygon });
    } else {
      setCameraTarget({
        center: zone.center,
        zoom: Math.max(11, 16 - zone.radiusKm * 2),
      });
    }
  };

  // ── Place search ──────────────────────────────────────────────────────────
  const handleSearchInput = (text: string) => {
    setSearchQuery(text);
    setImportBoundary(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (text.trim().length < 2) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(() => doSearch(text), 500);
  };

  const doSearch = async (q: string) => {
    setIsSearching(true);
    try {
      const url =
        `https://nominatim.openstreetmap.org/search` +
        `?q=${encodeURIComponent(q)}&format=json&polygon_geojson=1&limit=6&addressdetails=1`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'OBT-MobileTracker/1.0 (soomalubi@gmail.com)', 'Accept-Language': 'en' },
      });
      const data: NominatimResult[] = await res.json();
      setSearchResults(data);
    } catch (_) {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectResult = (r: NominatimResult) => {
    // Fly to bounding box
    const bb = r.boundingbox; // [minLat, maxLat, minLng, maxLng]
    const bounds: [[number, number], [number, number]] = [
      [parseFloat(bb[0]), parseFloat(bb[2])],
      [parseFloat(bb[1]), parseFloat(bb[3])],
    ];
    setCameraTarget({
      bounds,
      // also pass coords so native can use fitToCoordinates
      coords: [
        { latitude: parseFloat(bb[0]), longitude: parseFloat(bb[2]) },
        { latitude: parseFloat(bb[1]), longitude: parseFloat(bb[3]) },
      ],
    });

    // Check for importable polygon boundary
    const polygon = extractPolygon(r.geojson);
    setImportBoundary(polygon);

    // Close results but keep search bar + import banner visible
    setSearchResults([]);
    setSearchQuery(r.display_name.split(',')[0]);
  };

  const handleImportBoundary = () => {
    if (!importBoundary) return;
    setDrawnPoints(importBoundary);
    setIsDrawing(false); // not in manual draw mode — points come from boundary
    setImportBoundary(null);
    setShowSearch(false);
    setSearchQuery('');
    // Pre-fill name from the last search query
    setSavePrefilledName(searchQuery);
    setShowSave(true);
  };

  const closeSearch = () => {
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
    setImportBoundary(null);
  };

  const mapHeight = isDrawing ? MAP_H_DRAW : MAP_H_NORMAL;
  const canFinish = drawnPoints.length >= 3;
  const totalActive = zones.filter((z) => z.active).length;
  const violations = mockGeofenceStatuses.filter(
    (s) => s.inside && zones.some((z) => z.id === s.geofenceId && z.type === 'restricted'),
  ).length;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* ── Summary bar ── */}
      <View style={styles.summaryBar}>
        <SummaryPill icon="map" value={String(zones.length)} label="Zones" color={Colors.accent} />
        <View style={styles.summDiv} />
        <SummaryPill icon="radio-button-on" value={String(totalActive)} label="Active" color={Colors.statusActive} />
        <View style={styles.summDiv} />
        <SummaryPill icon="warning" value={String(violations)} label="Violations" color={violations > 0 ? Colors.danger : Colors.textMuted} />
        {userLocation && (
          <>
            <View style={styles.summDiv} />
            <View style={styles.locatedPill}>
              <Ionicons name="locate" size={12} color={Colors.statusActive} />
              <Text style={styles.locatedText}>Located</Text>
            </View>
          </>
        )}
        <View style={{ flex: 1 }} />
        {!isDrawing && (
          <>
            <TouchableOpacity style={styles.searchBtn} onPress={() => { setShowSearch(true); setSearchResults([]); }}>
              <Ionicons name="search" size={15} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.drawBtn} onPress={startDrawing}>
              <Ionicons name="create" size={15} color="#FFF" />
              <Text style={styles.drawBtnText}>Draw Zone</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* ── Map container ── */}
      <View style={[styles.mapWrap, { height: mapHeight }]}>
        <GeofenceMap
          zones={zones}
          drawnPoints={drawnPoints}
          isDrawing={isDrawing}
          vehicles={mockVehicles}
          userLocation={userLocation}
          onMapPress={handleMapPress}
          cameraTarget={cameraTarget}
        />

        {/* Search overlay — rendered on top of the map */}
        {showSearch && (
          <View style={styles.searchWrap}>
            <SearchOverlay
              query={searchQuery}
              results={searchResults}
              isSearching={isSearching}
              importBoundary={importBoundary}
              onChangeQuery={handleSearchInput}
              onSelectResult={handleSelectResult}
              onImportBoundary={handleImportBoundary}
              onClose={closeSearch}
            />
          </View>
        )}

        {/* Draw mode overlays */}
        {isDrawing && (
          <>
            <View style={styles.drawBanner}>
              <Ionicons name="finger-print" size={16} color={Colors.accent} />
              <Text style={styles.drawBannerText}>
                {drawnPoints.length === 0
                  ? 'Tap the map to place the first point'
                  : drawnPoints.length < 3
                  ? `${drawnPoints.length} point${drawnPoints.length > 1 ? 's' : ''} — add ${3 - drawnPoints.length} more`
                  : `${drawnPoints.length} points — tap Done to finish`}
              </Text>
            </View>

            <View style={styles.drawControls}>
              <TouchableOpacity style={styles.drawCtrl} onPress={cancelDrawing}>
                <Ionicons name="close" size={18} color={Colors.danger} />
                <Text style={[styles.drawCtrlText, { color: Colors.danger }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.drawCtrl, drawnPoints.length === 0 && styles.drawCtrlOff]} onPress={undoLast} disabled={drawnPoints.length === 0}>
                <Ionicons name="arrow-undo" size={18} color={drawnPoints.length > 0 ? Colors.warning : Colors.textMuted} />
                <Text style={[styles.drawCtrlText, { color: drawnPoints.length > 0 ? Colors.warning : Colors.textMuted }]}>Undo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.drawCtrlPrimary, !canFinish && styles.drawCtrlOff]} onPress={finishDrawing} disabled={!canFinish}>
                <Ionicons name="checkmark" size={18} color={canFinish ? '#FFF' : Colors.textMuted} />
                <Text style={[styles.drawCtrlText, { color: canFinish ? '#FFF' : Colors.textMuted }]}>Done</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* ── Bottom list panel (hidden while drawing) ── */}
      {!isDrawing && (
        <>
          <View style={styles.tabBar}>
            {(['zones', 'status'] as const).map((t) => (
              <TouchableOpacity key={t} style={[styles.tab, listTab === t && styles.tabActive]} onPress={() => setListTab(t)}>
                <Ionicons name={t === 'zones' ? 'layers-outline' : 'car-outline'} size={14} color={listTab === t ? Colors.primary : Colors.textSecondary} />
                <Text style={[styles.tabText, listTab === t && styles.tabTextActive]}>
                  {t === 'zones' ? `Zones (${zones.length})` : 'Vehicle Status'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
            {listTab === 'zones' ? (
              zones.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="map-outline" size={40} color={Colors.textMuted} />
                  <Text style={styles.emptyText}>No zones yet — draw one or search for a place</Text>
                </View>
              ) : (
                zones.map((z) => (
                  <ZoneCard key={z.id} zone={z} onToggle={() => setZones((p) => p.map((x) => x.id === z.id ? { ...x, active: !x.active } : x))} onFocus={() => focusZone(z)} />
                ))
              )
            ) : (
              <VehicleStatusList zones={zones} />
            )}
            <View style={{ height: Spacing.xxl }} />
          </ScrollView>
        </>
      )}

      {/* ── Modals ── */}
      <LocationPermModal visible={showPermModal} onAllow={handleAllowLocation} onSkip={() => setShowPermModal(false)} />

      <SaveZoneSheet
        visible={showSave}
        pointCount={drawnPoints.length}
        prefilledName={savePrefilledName}
        onSave={handleSaveZone}
        onRedraw={() => { setShowSave(false); setDrawnPoints([]); setIsDrawing(true); }}
        onCancel={() => { setShowSave(false); cancelDrawing(); }}
      />
    </SafeAreaView>
  );
}

function SummaryPill({ icon, value, label, color }: { icon: string; value: string; label: string; color: string }) {
  return (
    <View style={styles.summPill}>
      <Ionicons name={icon as any} size={13} color={color} />
      <Text style={[styles.summVal, { color }]}>{value}</Text>
      <Text style={styles.summLabel}>{label}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundLight },

  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.xs,
  },
  summPill: { alignItems: 'center', gap: 1 },
  summVal: { fontSize: FontSize.sm, fontWeight: '800' },
  summLabel: { fontSize: 9, color: Colors.textMuted },
  summDiv: { width: 1, height: 24, backgroundColor: Colors.divider },
  locatedPill: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  locatedText: { fontSize: 9, fontWeight: '700', color: Colors.statusActive },
  searchBtn: { padding: 7, borderRadius: Radius.md, backgroundColor: Colors.backgroundLight, borderWidth: 1, borderColor: Colors.border },
  drawBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary, paddingHorizontal: Spacing.sm, paddingVertical: 7, borderRadius: Radius.md },
  drawBtnText: { fontSize: FontSize.xs, fontWeight: '700', color: '#FFF' },

  mapWrap: { position: 'relative', overflow: 'hidden', backgroundColor: '#D6E4EE' },

  // Search overlay
  searchWrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  searchOverlay: { backgroundColor: Colors.cardBackground, ...Shadow.md },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  searchInput: { flex: 1, fontSize: FontSize.md, color: Colors.textPrimary, height: 36 },
  importBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: Colors.accent + '12',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  importBannerText: { flex: 1, fontSize: FontSize.sm, fontWeight: '600', color: Colors.primary },
  resultsList: { maxHeight: 240 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  resultInfo: { flex: 1 },
  resultName: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  resultSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },
  hasBoundaryBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: Colors.primary + '15', paddingHorizontal: 5, paddingVertical: 2, borderRadius: Radius.full },
  hasBoundaryText: { fontSize: 9, fontWeight: '800', color: Colors.primary },
  noResults: { padding: Spacing.md },
  noResultsText: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },

  // Draw overlays
  drawBanner: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: Radius.lg,
    ...Shadow.md,
  },
  drawBannerText: { flex: 1, fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  drawControls: { position: 'absolute', bottom: 14, left: 12, right: 12, flexDirection: 'row', gap: Spacing.sm },
  drawCtrl: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: Radius.md,
    paddingVertical: 11,
    ...Shadow.sm,
  },
  drawCtrlPrimary: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 11,
    ...Shadow.sm,
  },
  drawCtrlText: { fontSize: FontSize.sm, fontWeight: '700' },
  drawCtrlOff: { opacity: 0.4 },

  // Bottom list
  tabBar: { flexDirection: 'row', backgroundColor: Colors.cardBackground, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: Colors.primary },
  tabText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: Colors.primary },
  listContent: { padding: Spacing.sm, gap: Spacing.xs },

  // Zone cards
  zoneCard: { backgroundColor: Colors.cardBackground, borderRadius: Radius.md, overflow: 'hidden', ...Shadow.sm },
  zoneCardOff: { opacity: 0.55 },
  zoneCardRow: { flexDirection: 'row', alignItems: 'center' },
  zoneColorBar: { width: 5, alignSelf: 'stretch' },
  zoneInfo: { flex: 1, paddingVertical: 10, paddingLeft: Spacing.sm },
  zoneNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  zoneName: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  zoneBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.full },
  zoneBadgeA: { backgroundColor: Colors.statusActive + '18' },
  zoneBadgeR: { backgroundColor: Colors.danger + '15' },
  zoneBadgeText: { fontSize: 9, fontWeight: '800' },
  zoneMeta: { fontSize: 10, color: Colors.textSecondary, marginTop: 2 },
  zoneRight: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: Spacing.sm },
  focusBtn: { padding: 4 },
  zoneSwitch: { transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }] },
  zoneExpanded: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.divider, paddingTop: Spacing.xs, gap: 6 },
  expandedRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5 },
  expandedText: { fontSize: 10, color: Colors.textSecondary, flex: 1 },
  flagRow: { flexDirection: 'row', gap: Spacing.sm },
  flag: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: Radius.full },
  flagOn: { backgroundColor: Colors.warning + '18' },
  flagOff: { backgroundColor: Colors.backgroundLight },
  flagText: { fontSize: 9, fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  vChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, backgroundColor: Colors.backgroundLight, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border },
  vChipDot: { width: 6, height: 6, borderRadius: 3 },
  vChipText: { fontSize: 10, fontWeight: '600', color: Colors.textSecondary },

  // Status tab
  statusCard: { backgroundColor: Colors.cardBackground, borderRadius: Radius.md, padding: Spacing.sm, ...Shadow.sm, gap: 6 },
  statusHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusPlate: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.textPrimary },
  statusModel: { fontSize: 10, color: Colors.textSecondary },
  violBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.danger + '15', paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radius.full },
  violText: { fontSize: 10, fontWeight: '700', color: Colors.danger },
  okBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.statusActive + '15', paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radius.full },
  okText: { fontSize: 10, fontWeight: '700', color: Colors.statusActive },
  noZone: { fontSize: 10, color: Colors.textMuted, fontStyle: 'italic' },
  zoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  zoneDot: { width: 8, height: 8, borderRadius: 4 },
  zoneRowName: { flex: 1, fontSize: 10, color: Colors.textSecondary },
  inBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.full },
  inBadgeOk: { backgroundColor: Colors.statusActive + '15' },
  inBadgeDanger: { backgroundColor: Colors.danger + '15' },
  inBadgeOut: { backgroundColor: Colors.backgroundLight },
  inBadgeText: { fontSize: 9, fontWeight: '800' },

  // Empty
  emptyState: { alignItems: 'center', paddingTop: 40, gap: Spacing.sm },
  emptyText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },

  // Location permission modal
  permOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  permCard: { backgroundColor: Colors.cardBackground, borderRadius: Radius.xl, padding: Spacing.lg, width: '100%', maxWidth: 340, alignItems: 'center', gap: Spacing.sm, ...Shadow.lg },
  permIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.accent + '18', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xs },
  permTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  permBody: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  permAllow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, marginTop: Spacing.sm, width: '100%', justifyContent: 'center' },
  permAllowText: { fontSize: FontSize.md, fontWeight: '700', color: '#FFF' },
  permSkip: { paddingVertical: Spacing.sm },
  permSkipText: { fontSize: FontSize.sm, color: Colors.textMuted },

  // Save sheet
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: { backgroundColor: Colors.cardBackground, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.md, paddingBottom: Spacing.xxl, gap: 4 },
  sheetHandle: { width: 36, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.sm },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: Spacing.xs },
  sheetTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textPrimary },
  sheetSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  redrawBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 },
  redrawText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.accent },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary, marginTop: Spacing.sm },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm, fontSize: FontSize.md, color: Colors.textPrimary, backgroundColor: Colors.backgroundLight, marginTop: 4 },
  typeRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  typeChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: Radius.md, backgroundColor: Colors.backgroundLight, borderWidth: 1, borderColor: Colors.border },
  typeChipText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary },
  colorRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  colorSwatch: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  colorSwatchActive: { borderWidth: 2.5, borderColor: Colors.textPrimary },
  toggleGroup: { marginTop: Spacing.sm, gap: 2 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  toggleLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toggleText: { fontSize: FontSize.sm, color: Colors.textPrimary },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, backgroundColor: Colors.primary, borderRadius: Radius.md, padding: Spacing.sm, marginTop: Spacing.md },
  saveBtnOff: { opacity: 0.4 },
  saveBtnText: { fontSize: FontSize.md, fontWeight: '700', color: '#FFF' },
  cancelLink: { alignItems: 'center', paddingVertical: Spacing.xs },
  cancelLinkText: { fontSize: FontSize.sm, color: Colors.textMuted },
});
