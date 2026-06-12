import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { mockVehicles, mockFuelEvents } from '../../data/mockData';
import { Colors, Spacing, Radius, FontSize, Shadow } from '../../constants/theme';
import type { FuelEvent } from '../../types';

type SortMode = 'level' | 'plate';
type FilterMode = 'all' | 'low' | 'active';

const LOW_FUEL_THRESHOLD = 30;

function fuelColor(level: number) {
  if (level < 25) return Colors.danger;
  if (level < 50) return Colors.warning;
  return Colors.statusActive;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (d >= 1) return `${d}d ago`;
  if (h >= 1) return `${h}h ago`;
  return 'Just now';
}

function formatNaira(n: number) {
  return `K${n.toLocaleString()}`;
}

// ─── Log Refuel Modal ─────────────────────────────────────────────────────────

interface LogRefuelModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (event: Omit<FuelEvent, 'id'>) => void;
  preselectedVehicleId?: string;
}

function LogRefuelModal({ visible, onClose, onSave, preselectedVehicleId }: LogRefuelModalProps) {
  const [vehicleId, setVehicleId] = useState(preselectedVehicleId ?? mockVehicles[0].id);
  const [liters, setLiters] = useState('');
  const [cost, setCost] = useState('');
  const [station, setStation] = useState('');

  const vehicle = mockVehicles.find((v) => v.id === vehicleId)!;

  const handleSave = () => {
    const l = parseFloat(liters);
    if (!l || l <= 0) return;
    onSave({
      vehicleId,
      vehiclePlate: vehicle.plate,
      type: 'refuel',
      liters: l,
      cost: cost ? parseFloat(cost) : undefined,
      odometer: vehicle.odometer,
      timestamp: new Date().toISOString(),
      station: station || undefined,
    });
    setLiters('');
    setCost('');
    setStation('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Log Refuel</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Vehicle Picker */}
          <Text style={styles.fieldLabel}>Vehicle</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.vehiclePicker}>
            {mockVehicles.map((v) => (
              <TouchableOpacity
                key={v.id}
                style={[styles.vehicleChip, vehicleId === v.id && styles.vehicleChipActive]}
                onPress={() => setVehicleId(v.id)}
              >
                <Text style={[styles.vehicleChipText, vehicleId === v.id && styles.vehicleChipTextActive]}>
                  {v.plate}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.selectedVehicleInfo}>
            <Ionicons name="car" size={14} color={Colors.textSecondary} />
            <Text style={styles.selectedVehicleText}>
              {vehicle.make} {vehicle.model} · {vehicle.fuelLevel}% current · {vehicle.odometer.toLocaleString()} km
            </Text>
          </View>

          <Text style={styles.fieldLabel}>Liters Added *</Text>
          <TextInput
            style={styles.input}
            value={liters}
            onChangeText={setLiters}
            keyboardType="decimal-pad"
            placeholder="e.g. 40"
            placeholderTextColor={Colors.textMuted}
          />

          <Text style={styles.fieldLabel}>Cost (K) — optional</Text>
          <TextInput
            style={styles.input}
            value={cost}
            onChangeText={setCost}
            keyboardType="decimal-pad"
            placeholder="e.g. 34000"
            placeholderTextColor={Colors.textMuted}
          />

          <Text style={styles.fieldLabel}>Station — optional</Text>
          <TextInput
            style={styles.input}
            value={station}
            onChangeText={setStation}
            placeholder="e.g. Total Energies, Victoria Island"
            placeholderTextColor={Colors.textMuted}
          />

          <TouchableOpacity
            style={[styles.saveBtn, !liters && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!liters}
          >
            <Ionicons name="checkmark-circle" size={18} color="#FFF" />
            <Text style={styles.saveBtnText}>Save Refuel</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Vehicle Fuel Card ────────────────────────────────────────────────────────

function VehicleFuelCard({
  vehicle,
  events,
  onLogRefuel,
}: {
  vehicle: (typeof mockVehicles)[0];
  events: FuelEvent[];
  onLogRefuel: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const lastRefuel = events.find((e) => e.type === 'refuel');
  const totalConsumed = events
    .filter((e) => e.type === 'consumption')
    .reduce((s, e) => s + e.liters, 0);
  const totalRefueled = events
    .filter((e) => e.type === 'refuel')
    .reduce((s, e) => s + e.liters, 0);
  const color = fuelColor(vehicle.fuelLevel);

  return (
    <View style={styles.fuelCard}>
      <TouchableOpacity
        style={styles.fuelCardHeader}
        onPress={() => setExpanded((x) => !x)}
        activeOpacity={0.8}
      >
        <View style={styles.fuelCardLeft}>
          <View style={[styles.fuelIcon, { backgroundColor: color + '18' }]}>
            <Ionicons name="water" size={20} color={color} />
          </View>
          <View>
            <View style={styles.fuelCardTitleRow}>
              <Text style={styles.fuelCardPlate}>{vehicle.plate}</Text>
              {vehicle.fuelLevel < LOW_FUEL_THRESHOLD && (
                <View style={styles.lowFuelBadge}>
                  <Ionicons name="warning" size={10} color={Colors.danger} />
                  <Text style={styles.lowFuelBadgeText}>Low</Text>
                </View>
              )}
            </View>
            <Text style={styles.fuelCardModel}>{vehicle.make} {vehicle.model}</Text>
          </View>
        </View>

        <View style={styles.fuelCardRight}>
          <Text style={[styles.fuelLevelPct, { color }]}>{vehicle.fuelLevel}%</Text>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={Colors.textMuted}
          />
        </View>
      </TouchableOpacity>

      {/* Level Bar */}
      <View style={styles.fuelBarTrack}>
        <View style={[styles.fuelBarFill, { width: `${vehicle.fuelLevel}%` as any, backgroundColor: color }]} />
      </View>

      {/* Quick stats */}
      <View style={styles.fuelQuickStats}>
        <FuelStat icon="navigate-outline" label="Range" value={`~${Math.round(vehicle.fuelLevel * 5.2)} km`} />
        <FuelStat icon="leaf-outline" label="Efficiency" value={totalConsumed > 0 ? `${(totalConsumed > 0 ? 24 / totalConsumed * 10 : 0).toFixed(1)} km/L` : '—'} />
        <FuelStat icon="time-outline" label="Last Fill" value={lastRefuel ? timeAgo(lastRefuel.timestamp) : '—'} />
        <TouchableOpacity style={styles.logRefuelBtn} onPress={onLogRefuel}>
          <Ionicons name="add" size={14} color={Colors.primary} />
          <Text style={styles.logRefuelText}>Log</Text>
        </TouchableOpacity>
      </View>

      {/* Expanded: event history */}
      {expanded && events.length > 0 && (
        <View style={styles.eventHistory}>
          <Text style={styles.eventHistoryTitle}>Fuel History</Text>
          {events.slice(0, 5).map((ev) => (
            <View key={ev.id} style={styles.eventRow}>
              <View style={[styles.eventDot, { backgroundColor: ev.type === 'refuel' ? Colors.statusActive : Colors.textMuted }]} />
              <View style={styles.eventInfo}>
                <Text style={styles.eventType}>
                  {ev.type === 'refuel' ? `+${ev.liters}L refuel` : `-${ev.liters}L consumed`}
                  {ev.cost ? `  ·  ${formatNaira(ev.cost)}` : ''}
                </Text>
                {ev.station && <Text style={styles.eventStation}>{ev.station}</Text>}
                <Text style={styles.eventTime}>{timeAgo(ev.timestamp)} · {ev.odometer.toLocaleString()} km</Text>
              </View>
            </View>
          ))}
        </View>
      )}
      {expanded && events.length === 0 && (
        <View style={styles.eventHistory}>
          <Text style={styles.noHistoryText}>No fuel events recorded</Text>
        </View>
      )}
    </View>
  );
}

function FuelStat({ icon, label, value }: { icon: string; value: string; label: string }) {
  return (
    <View style={styles.fuelStat}>
      <Ionicons name={icon as any} size={12} color={Colors.textMuted} />
      <Text style={styles.fuelStatValue}>{value}</Text>
      <Text style={styles.fuelStatLabel}>{label}</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function FuelScreen() {
  const [sortMode, setSortMode] = useState<SortMode>('level');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [showModal, setShowModal] = useState(false);
  const [logForVehicle, setLogForVehicle] = useState<string | undefined>();
  const [fuelEvents, setFuelEvents] = useState<FuelEvent[]>(mockFuelEvents);

  const lowFuelVehicles = mockVehicles.filter((v) => v.fuelLevel < LOW_FUEL_THRESHOLD);
  const avgLevel = Math.round(mockVehicles.reduce((s, v) => s + v.fuelLevel, 0) / mockVehicles.length);
  const totalRefuels = fuelEvents.filter((e) => e.type === 'refuel').length;

  const filtered = mockVehicles.filter((v) => {
    if (filterMode === 'low') return v.fuelLevel < LOW_FUEL_THRESHOLD;
    if (filterMode === 'active') return v.status === 'active';
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortMode === 'level') return a.fuelLevel - b.fuelLevel;
    return a.plate.localeCompare(b.plate);
  });

  const handleLogRefuel = (vehicleId?: string) => {
    setLogForVehicle(vehicleId);
    setShowModal(true);
  };

  const handleSaveRefuel = (ev: Omit<FuelEvent, 'id'>) => {
    setFuelEvents((prev) => [{ id: `f${Date.now()}`, ...ev }, ...prev]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Summary */}
      <View style={styles.summaryBar}>
        <SummaryChip
          icon="water"
          value={`${avgLevel}%`}
          label="Fleet Avg"
          color={fuelColor(avgLevel)}
        />
        <View style={styles.summaryDivider} />
        <SummaryChip
          icon="warning"
          value={String(lowFuelVehicles.length)}
          label="Low Fuel"
          color={lowFuelVehicles.length > 0 ? Colors.danger : Colors.statusActive}
        />
        <View style={styles.summaryDivider} />
        <SummaryChip
          icon="reload"
          value={String(totalRefuels)}
          label="Refuels"
          color={Colors.accent}
        />
        <TouchableOpacity style={styles.logAllBtn} onPress={() => handleLogRefuel()}>
          <Ionicons name="add-circle" size={16} color="#FFF" />
          <Text style={styles.logAllBtnText}>Log Refuel</Text>
        </TouchableOpacity>
      </View>

      {/* Controls */}
      <View style={styles.controlBar}>
        <View style={styles.filterChips}>
          {([['all', 'All'], ['low', 'Low Fuel'], ['active', 'Active']] as [FilterMode, string][]).map(([f, label]) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, filterMode === f && styles.filterChipActive]}
              onPress={() => setFilterMode(f)}
            >
              <Text style={[styles.filterChipText, filterMode === f && styles.filterChipTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={styles.sortBtn}
          onPress={() => setSortMode((m) => (m === 'level' ? 'plate' : 'level'))}
        >
          <Ionicons name="swap-vertical" size={14} color={Colors.textSecondary} />
          <Text style={styles.sortBtnText}>{sortMode === 'level' ? 'By Level' : 'By Plate'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {lowFuelVehicles.length > 0 && filterMode === 'all' && (
          <View style={styles.alertBanner}>
            <Ionicons name="warning" size={16} color={Colors.danger} />
            <Text style={styles.alertBannerText}>
              {lowFuelVehicles.length} vehicle{lowFuelVehicles.length > 1 ? 's' : ''} below {LOW_FUEL_THRESHOLD}% — schedule refuels
            </Text>
          </View>
        )}

        {sorted.map((vehicle) => (
          <VehicleFuelCard
            key={vehicle.id}
            vehicle={vehicle}
            events={fuelEvents.filter((e) => e.vehicleId === vehicle.id)}
            onLogRefuel={() => handleLogRefuel(vehicle.id)}
          />
        ))}

        {sorted.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="water-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No vehicles match this filter</Text>
          </View>
        )}
        <View style={{ height: Spacing.xxl }} />
      </ScrollView>

      <LogRefuelModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleSaveRefuel}
        preselectedVehicleId={logForVehicle}
      />
    </SafeAreaView>
  );
}

function SummaryChip({ icon, value, label, color }: { icon: string; value: string; label: string; color: string }) {
  return (
    <View style={styles.summaryChip}>
      <Ionicons name={icon as any} size={16} color={color} />
      <Text style={[styles.summaryChipValue, { color }]}>{value}</Text>
      <Text style={styles.summaryChipLabel}>{label}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundLight },

  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.xs,
  },
  summaryChip: { flex: 1, alignItems: 'center', gap: 2 },
  summaryChipValue: { fontSize: FontSize.md, fontWeight: '800' },
  summaryChipLabel: { fontSize: 10, color: Colors.textMuted },
  summaryDivider: { width: 1, height: 32, backgroundColor: Colors.divider },
  logAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 7,
    borderRadius: Radius.md,
  },
  logAllBtnText: { fontSize: FontSize.xs, fontWeight: '700', color: '#FFF' },

  controlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  filterChips: { flexDirection: 'row', gap: Spacing.xs, flex: 1 },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.backgroundLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary },
  filterChipTextActive: { color: Colors.textLight },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: Radius.md,
    backgroundColor: Colors.backgroundLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sortBtnText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary },

  scroll: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.xxl },

  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.danger + '15',
    borderRadius: Radius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.danger + '30',
  },
  alertBannerText: { fontSize: FontSize.sm, color: Colors.danger, fontWeight: '600', flex: 1 },

  fuelCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: Radius.md,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  fuelCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  fuelCardLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  fuelIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  fuelCardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  fuelCardPlate: { fontSize: FontSize.md, fontWeight: '800', color: Colors.textPrimary },
  fuelCardModel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },
  fuelCardRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fuelLevelPct: { fontSize: FontSize.lg, fontWeight: '800' },
  lowFuelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: Colors.danger + '15',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  lowFuelBadgeText: { fontSize: 9, fontWeight: '800', color: Colors.danger },

  fuelBarTrack: {
    height: 6,
    backgroundColor: Colors.divider,
    marginHorizontal: Spacing.md,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  fuelBarFill: { height: '100%', borderRadius: Radius.full },

  fuelQuickStats: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    marginTop: Spacing.sm,
    gap: 2,
  },
  fuelStat: { flex: 1, alignItems: 'center', gap: 2 },
  fuelStatValue: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textPrimary },
  fuelStatLabel: { fontSize: 10, color: Colors.textMuted },
  logRefuelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  logRefuelText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },

  eventHistory: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    paddingTop: Spacing.sm,
    gap: Spacing.xs,
  },
  eventHistoryTitle: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textMuted, marginBottom: 4 },
  eventRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  eventDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  eventInfo: { flex: 1 },
  eventType: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  eventStation: { fontSize: FontSize.xs, color: Colors.textSecondary },
  eventTime: { fontSize: FontSize.xs, color: Colors.textMuted },
  noHistoryText: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', paddingVertical: Spacing.sm },

  empty: { alignItems: 'center', paddingTop: 60, gap: Spacing.sm },
  emptyText: { fontSize: FontSize.md, color: Colors.textSecondary },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalSheet: {
    backgroundColor: Colors.cardBackground,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
    gap: Spacing.xs,
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textPrimary },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary, marginTop: Spacing.sm },
  vehiclePicker: { marginBottom: Spacing.xs },
  vehicleChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.backgroundLight,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: Spacing.xs,
  },
  vehicleChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  vehicleChipText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  vehicleChipTextActive: { color: Colors.textLight },
  selectedVehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing.xs,
  },
  selectedVehicleText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    backgroundColor: Colors.backgroundLight,
    marginTop: 4,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginTop: Spacing.md,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontSize: FontSize.md, fontWeight: '700', color: '#FFF' },
});
