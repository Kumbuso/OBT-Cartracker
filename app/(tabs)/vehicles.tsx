import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import VehicleCard from '../../components/VehicleCard';
import type { Vehicle, VehicleStatus } from '../../types';
import { Colors, Spacing, FontSize, Radius } from '../../constants/theme';
import { useFleet } from '../../context/FleetContext';

const FILTERS: { label: string; value: VehicleStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Idle', value: 'idle' },
  { label: 'Offline', value: 'offline' },
  { label: 'Maintenance', value: 'maintenance' },
];

const MAKES = ['Toyota', 'Ford', 'Isuzu', 'Mercedes-Benz', 'Nissan', 'Mitsubishi', 'Hino', 'MAN', 'Scania', 'DAF', 'Volvo', 'Other'];
const CURRENT_YEAR = new Date().getFullYear();

// ── Add Vehicle Sheet ──────────────────────────────────────────────────────────

function AddVehicleSheet({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (v: Omit<Vehicle, 'id'>) => void;
}) {
  const [plate,       setPlate]       = useState('');
  const [make,        setMake]        = useState('');
  const [model,       setModel]       = useState('');
  const [year,        setYear]        = useState(String(CURRENT_YEAR));
  const [group,       setGroup]       = useState('');
  const [deviceImei,  setDeviceImei]  = useState('');
  const [deviceSerial,setDeviceSerial]= useState('');
  const [saving,      setSaving]      = useState(false);
  const [errors,      setErrors]      = useState<Record<string, string>>({});

  const reset = () => {
    setPlate(''); setMake(''); setModel(''); setYear(String(CURRENT_YEAR));
    setGroup(''); setDeviceImei(''); setDeviceSerial(''); setErrors({});
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!plate.trim())  e.plate  = 'Registration plate is required';
    if (!make.trim())   e.make   = 'Make is required';
    if (!model.trim())  e.model  = 'Model is required';
    const y = parseInt(year, 10);
    if (!year || isNaN(y) || y < 1900 || y > CURRENT_YEAR + 2)
      e.year = `Enter a valid year (1900–${CURRENT_YEAR + 2})`;
    if (deviceImei && !/^\d{15,17}$/.test(deviceImei.replace(/\s/g, '')))
      e.deviceImei = 'IMEI must be 15–17 digits';
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setSaving(true);
    await new Promise((r) => setTimeout(r, 400));

    onSave({
      plate:        plate.trim().toUpperCase(),
      make:         make.trim(),
      model:        model.trim(),
      year:         parseInt(year, 10),
      status:       'offline',
      driver:       null,
      location:     { latitude: 0, longitude: 0 },
      lastSeen:     new Date().toISOString(),
      odometer:     0,
      fuelLevel:    100,
      speed:        0,
      engineOn:     false,
      groupId:      group.trim() || 'default',
      imei:         deviceImei.trim().replace(/\s/g, '') || null,
      deviceSerial: deviceSerial.trim().toUpperCase() || null,
    });

    setSaving(false);
    reset();
    onClose();
  };

  const Field = ({
    label, value, onChange, placeholder, keyboard, error, autoCap, hint,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    keyboard?: 'default' | 'numeric' | 'phone-pad';
    error?: string;
    autoCap?: 'none' | 'words' | 'characters' | 'sentences';
    hint?: string;
  }) => (
    <View style={styles.addField}>
      <Text style={styles.addLabel}>{label}</Text>
      {hint && <Text style={styles.addHint}>{hint}</Text>}
      <View style={[styles.inputRow, !!error && styles.inputRowError]}>
        <TextInput
          style={styles.inputText}
          value={value}
          onChangeText={(v) => { onChange(v); setErrors((prev) => ({ ...prev, [label]: '' })); }}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          keyboardType={keyboard ?? 'default'}
          autoCapitalize={autoCap ?? 'sentences'}
          autoCorrect={false}
        />
      </View>
      {!!error && <Text style={styles.fieldError}>{error}</Text>}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={() => { reset(); onClose(); }}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={styles.overlayBg} activeOpacity={1} onPress={() => { reset(); onClose(); }} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetTopRow}>
            <Ionicons name="car-sport-outline" size={22} color={Colors.primary} />
            <Text style={[styles.sheetTitle, { flex: 1 }]}>Add Vehicle</Text>
            <TouchableOpacity onPress={() => { reset(); onClose(); }}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* ── Vehicle info ───────────────────────────────────────── */}
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: Colors.primary }]} />
              <Text style={styles.sectionTitle}>Vehicle Information</Text>
            </View>

            <Field
              label="Registration Plate *"
              value={plate}
              onChange={setPlate}
              placeholder="e.g. ZMB 001A"
              autoCap="characters"
              error={errors.plate}
            />

            {/* Make picker */}
            <View style={styles.addField}>
              <Text style={styles.addLabel}>Make *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 2 }}>
                {MAKES.map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.chip, make === m && styles.chipActive]}
                    onPress={() => { setMake(m); setErrors((prev) => ({ ...prev, make: '' })); }}
                  >
                    <Text style={[styles.chipText, make === m && styles.chipTextActive]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {!!errors.make && <Text style={styles.fieldError}>{errors.make}</Text>}
            </View>

            <Field
              label="Model *"
              value={model}
              onChange={setModel}
              placeholder="e.g. Hilux, Transit, NPR"
              autoCap="words"
              error={errors.model}
            />

            <Field
              label="Year *"
              value={year}
              onChange={setYear}
              placeholder={String(CURRENT_YEAR)}
              keyboard="numeric"
              error={errors.year}
            />

            <Field
              label="Group / Fleet  (optional)"
              value={group}
              onChange={setGroup}
              placeholder="e.g. Logistics, Executive"
              autoCap="words"
            />

            {/* ── Device assignment ──────────────────────────────────── */}
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: '#3E92CC' }]} />
              <Text style={styles.sectionTitle}>Assign GPS Device</Text>
            </View>

            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={16} color="#3E92CC" />
              <Text style={styles.infoText}>
                Enter the IMEI and Serial Number of the GPS tracker installed in this vehicle.
                These must match the details registered in Device Management for the tracker to report location.
              </Text>
            </View>

            <Field
              label="Device Serial Number  (optional)"
              value={deviceSerial}
              onChange={setDeviceSerial}
              placeholder="e.g. OBT-GPS-005"
              autoCap="characters"
            />

            <Field
              label="Device IMEI  (optional)"
              value={deviceImei}
              onChange={setDeviceImei}
              placeholder="15-digit IMEI, e.g. 356307042441013"
              keyboard="numeric"
              error={errors.deviceImei}
              hint="Find the IMEI on the tracker label or by sending *#06# on the SIM."
            />

            {deviceImei.replace(/\s/g, '').length > 0 && /^\d{15,17}$/.test(deviceImei.replace(/\s/g, '')) && (
              <View style={styles.imeiValidRow}>
                <Ionicons name="checkmark-circle" size={15} color="#2DC653" />
                <Text style={styles.imeiValidText}>Valid IMEI format</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#FFF" size="small" />
                : <><Ionicons name="checkmark-circle" size={18} color="#FFF" /><Text style={styles.saveBtnText}>Add Vehicle</Text></>}
            </TouchableOpacity>
            <View style={{ height: 32 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────

export default function VehiclesScreen() {
  const { vehicles, addVehicle } = useFleet();
  const [search,   setSearch]   = useState('');
  const [filter,   setFilter]   = useState<VehicleStatus | 'all'>('all');
  const [showAdd,  setShowAdd]  = useState(false);

  const filtered = vehicles.filter((v) => {
    const matchesSearch =
      v.plate.toLowerCase().includes(search.toLowerCase()) ||
      v.make.toLowerCase().includes(search.toLowerCase()) ||
      v.model.toLowerCase().includes(search.toLowerCase()) ||
      (v.driver?.name.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchesFilter = filter === 'all' || v.status === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.header}>
        {/* Search + Add button row */}
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by plate, model, driver..."
              placeholderTextColor={Colors.textMuted}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
            <Ionicons name="add" size={22} color={Colors.textLight} />
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.value}
              style={[styles.filterChip, filter === f.value && styles.filterChipActive]}
              onPress={() => setFilter(f.value)}
            >
              <Text style={[styles.filterLabel, filter === f.value && styles.filterLabelActive]}>
                {f.label}
              </Text>
              <Text style={[styles.filterCount, filter === f.value && styles.filterLabelActive]}>
                {f.value === 'all'
                  ? vehicles.length
                  : vehicles.filter((v) => v.status === f.value).length}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        style={{ flex: 1 }}
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <VehicleCard vehicle={item} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="car-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No vehicles match your search</Text>
            <TouchableOpacity style={styles.emptyAddBtn} onPress={() => setShowAdd(true)}>
              <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
              <Text style={styles.emptyAddText}>Add your first vehicle</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <AddVehicleSheet
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onSave={(v) => { addVehicle(v); setShowAdd(false); }}
      />
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundLight },

  header: {
    backgroundColor: Colors.cardBackground,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundLight,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  filters: { flexDirection: 'row' },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.backgroundLight,
    marginRight: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive:  { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterLabel:       { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  filterLabelActive: { color: Colors.textLight },
  filterCount:       { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '700' },

  list:  { padding: Spacing.md, paddingBottom: Spacing.xxl },
  empty: { alignItems: 'center', paddingTop: 80, gap: Spacing.sm },
  emptyText: { fontSize: FontSize.md, color: Colors.textSecondary },
  emptyAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  emptyAddText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },

  // Sheet
  overlay:   { flex: 1, justifyContent: 'flex-end' },
  overlayBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: Colors.cardBackground,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.md,
    maxHeight: '92%',
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center', marginTop: 10, marginBottom: 8,
  },
  sheetTopRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: Spacing.sm, marginBottom: 4,
  },
  sheetTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textPrimary },

  // Section headers inside the sheet
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: Spacing.sm, marginTop: Spacing.md,
  },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Info box
  infoBox: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: '#EBF5FB', borderRadius: Radius.sm,
    padding: 10, marginBottom: Spacing.md, borderWidth: 1, borderColor: '#AED6F1',
  },
  infoText: { flex: 1, fontSize: FontSize.xs, color: '#1A5276', lineHeight: 16 },

  // IMEI valid indicator
  imeiValidRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: -8, marginBottom: Spacing.sm },
  imeiValidText: { fontSize: FontSize.xs, color: '#2DC653', fontWeight: '600' },

  // Form fields
  addField:     { marginBottom: Spacing.md },
  addLabel:     { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary, marginBottom: 4 },
  addHint:      { fontSize: 11, color: Colors.textMuted, marginBottom: 5, lineHeight: 15 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.sm,
    paddingHorizontal: 12, height: 44, backgroundColor: Colors.backgroundLight,
  },
  inputRowError: { borderColor: Colors.danger },
  inputText: { flex: 1, fontSize: FontSize.md, color: Colors.textPrimary },
  fieldError: { fontSize: FontSize.xs, color: Colors.danger, marginTop: 3 },

  // Chip picker (Make)
  chip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.backgroundLight,
  },
  chipActive:     { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText:       { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  chipTextActive: { color: Colors.textLight },

  // Save button
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.md, height: 50, marginTop: Spacing.sm,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: FontSize.md, fontWeight: '800', color: Colors.textLight },
});
