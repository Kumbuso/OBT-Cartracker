import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, FontSize, Shadow } from '../constants/theme';
import { useFleet } from '../context/FleetContext';

// ── Types ──────────────────────────────────────────────────────────────────────

type DeviceType   = 'gps' | 'fuel' | 'obd' | 'dashcam' | 'temp';
type DeviceStatus = 'online' | 'offline' | 'fault' | 'low_battery';

interface Device {
  id: string;
  serial: string;
  type: DeviceType;
  status: DeviceStatus;
  vehiclePlate: string | null;
  lastSeen: string;
  battery: number | null;
  signal: number | null;
  firmware: string;
  sim: string | null;
  fault: string | null;
  notes: string;
}

type NewDevice = Omit<Device, 'id' | 'lastSeen' | 'battery' | 'signal' | 'firmware' | 'fault'>;

// ── Config ─────────────────────────────────────────────────────────────────────

const TYPE_META: Record<DeviceType, { label: string; icon: string; color: string }> = {
  gps:     { label: 'GPS Tracker',   icon: 'radio-outline',           color: '#3E92CC' },
  fuel:    { label: 'Fuel Sensor',   icon: 'water-outline',           color: '#2DC653' },
  obd:     { label: 'OBD-II Dongle', icon: 'hardware-chip-outline',   color: '#F4A261' },
  dashcam: { label: 'Dashcam',       icon: 'videocam-outline',        color: '#9B59B6' },
  temp:    { label: 'Temp. Sensor',  icon: 'thermometer-outline',     color: '#E63946' },
};

const STATUS_META: Record<DeviceStatus, { label: string; color: string; bg: string }> = {
  online:      { label: 'Online',      color: '#2DC653', bg: '#F0FBF4' },
  offline:     { label: 'Offline',     color: '#9CA3AF', bg: '#F3F4F6' },
  fault:       { label: 'Fault',       color: '#E63946', bg: '#FEF2F2' },
  low_battery: { label: 'Low Battery', color: '#F4A261', bg: '#FFF7ED' },
};

const DEVICE_TYPES: DeviceType[] = ['gps', 'fuel', 'obd', 'dashcam', 'temp'];

const FILTER_OPTIONS: Array<{ key: DeviceType | 'all'; label: string }> = [
  { key: 'all',     label: 'All' },
  { key: 'gps',     label: 'GPS' },
  { key: 'fuel',    label: 'Fuel' },
  { key: 'obd',     label: 'OBD-II' },
  { key: 'dashcam', label: 'Dashcam' },
  { key: 'temp',    label: 'Temp' },
];

// ── Seed Data ──────────────────────────────────────────────────────────────────

const SEED_DEVICES: Device[] = [
  { id: 'd1', serial: 'OBT-GPS-001',  type: 'gps',     status: 'online',      vehiclePlate: 'ZMB 001A', lastSeen: '2026-06-12T10:48:00Z', battery: 87,   signal: 4, firmware: '3.2.1', sim: '+260 95 1234 001', fault: null,                           notes: '' },
  { id: 'd2', serial: 'OBT-GPS-002',  type: 'gps',     status: 'online',      vehiclePlate: 'ZMB 002A', lastSeen: '2026-06-12T10:45:00Z', battery: 65,   signal: 3, firmware: '3.2.1', sim: '+260 95 1234 002', fault: null,                           notes: '' },
  { id: 'd3', serial: 'OBT-GPS-003',  type: 'gps',     status: 'fault',       vehiclePlate: 'ZMB 004A', lastSeen: '2026-06-12T09:31:00Z', battery: 12,   signal: 0, firmware: '3.1.8', sim: '+260 95 1234 003', fault: 'GPS module not responding',    notes: '' },
  { id: 'd4', serial: 'OBT-GPS-004',  type: 'gps',     status: 'offline',     vehiclePlate: null,       lastSeen: '2026-06-11T18:00:00Z', battery: 45,   signal: null, firmware: '3.2.1', sim: null,                 fault: null,                       notes: 'Spare unit' },
  { id: 'd5', serial: 'OBT-FUEL-001', type: 'fuel',    status: 'online',      vehiclePlate: 'ZMB 001A', lastSeen: '2026-06-12T10:47:00Z', battery: null, signal: null, firmware: '1.4.0', sim: null,                 fault: null,                       notes: '' },
  { id: 'd6', serial: 'OBT-FUEL-002', type: 'fuel',    status: 'online',      vehiclePlate: 'ZMB 003A', lastSeen: '2026-06-12T10:44:00Z', battery: null, signal: null, firmware: '1.4.0', sim: null,                 fault: null,                       notes: '' },
  { id: 'd7', serial: 'OBT-OBD-001',  type: 'obd',     status: 'online',      vehiclePlate: 'ZMB 002A', lastSeen: '2026-06-12T10:46:00Z', battery: null, signal: null, firmware: '2.1.3', sim: null,                 fault: null,                       notes: '' },
  { id: 'd8', serial: 'OBT-CAM-001',  type: 'dashcam', status: 'online',      vehiclePlate: 'ZMB 005A', lastSeen: '2026-06-12T10:48:00Z', battery: null, signal: null, firmware: '1.1.0', sim: null,                 fault: null,                       notes: '' },
  { id: 'd9', serial: 'OBT-TEMP-001', type: 'temp',    status: 'low_battery', vehiclePlate: 'ZMB 003A', lastSeen: '2026-06-12T10:30:00Z', battery: 8,    signal: null, firmware: '1.0.5', sim: null,                 fault: null,                       notes: '' },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Signal Bars ────────────────────────────────────────────────────────────────

function SignalBars({ level }: { level: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
      {[1, 2, 3, 4].map((b) => (
        <View
          key={b}
          style={{
            width: 4,
            height: b * 4 + 2,
            borderRadius: 1,
            backgroundColor: b <= level ? '#2DC653' : '#E5E7EB',
          }}
        />
      ))}
    </View>
  );
}

// ── Battery Pill ───────────────────────────────────────────────────────────────

function BatteryPill({ level }: { level: number }) {
  const color = level <= 15 ? '#E63946' : level <= 30 ? '#F4A261' : '#2DC653';
  return (
    <View style={[styles.battPill, { borderColor: color + '55' }]}>
      <Ionicons name="battery-half-outline" size={11} color={color} />
      <Text style={[styles.battText, { color }]}>{level}%</Text>
    </View>
  );
}

// ── Device Card ────────────────────────────────────────────────────────────────

function DeviceCard({ device, onPress }: { device: Device; onPress: () => void }) {
  const typeMeta   = TYPE_META[device.type];
  const statusMeta = STATUS_META[device.status];

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.cardAccent, { backgroundColor: statusMeta.color }]} />

      <View style={styles.cardBody}>
        <View style={styles.cardRow}>
          {/* Type icon */}
          <View style={[styles.typeIcon, { backgroundColor: typeMeta.color + '1A' }]}>
            <Ionicons name={typeMeta.icon as any} size={20} color={typeMeta.color} />
          </View>

          {/* Info */}
          <View style={styles.cardInfo}>
            {/* Title row */}
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardSerial} numberOfLines={1}>{device.serial}</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusMeta.bg }]}>
                <View style={[styles.statusDot, { backgroundColor: statusMeta.color }]} />
                <Text style={[styles.statusLabel, { color: statusMeta.color }]}>{statusMeta.label}</Text>
              </View>
            </View>

            {/* Subtitle */}
            <Text style={styles.cardSubtitle}>
              {typeMeta.label}
              {device.vehiclePlate ? `  ·  ${device.vehiclePlate}` : '  ·  Unassigned'}
            </Text>

            {/* Meta row */}
            <View style={styles.cardMeta}>
              {device.signal !== null && (
                <View style={styles.metaChip}>
                  <SignalBars level={device.signal} />
                </View>
              )}
              {device.battery !== null && (
                <View style={styles.metaChip}>
                  <BatteryPill level={device.battery} />
                </View>
              )}
              {device.signal === null && device.battery === null && (
                <View style={styles.metaChip}>
                  <Ionicons name="flash" size={11} color="#9CA3AF" />
                  <Text style={styles.metaText}>Wired</Text>
                </View>
              )}
              <View style={{ flex: 1 }} />
              <Text style={styles.metaTime}>{timeAgo(device.lastSeen)}</Text>
            </View>

            {/* Fault message */}
            {!!device.fault && (
              <View style={styles.faultRow}>
                <Ionicons name="warning" size={11} color="#E63946" />
                <Text style={styles.faultText} numberOfLines={1}>{device.fault}</Text>
              </View>
            )}
          </View>

          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Device Detail Sheet ────────────────────────────────────────────────────────

function DeviceDetailSheet({
  device, visible, onClose, onRemove,
}: {
  device: Device | null;
  visible: boolean;
  onClose: () => void;
  onRemove: (id: string) => void;
}) {
  if (!device) return null;
  const typeMeta   = TYPE_META[device.type];
  const statusMeta = STATUS_META[device.status];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.overlayBg} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />

          {/* Sheet header */}
          <View style={styles.sheetTopRow}>
            <View style={[styles.typeIcon, { backgroundColor: typeMeta.color + '1A' }]}>
              <Ionicons name={typeMeta.icon as any} size={22} color={typeMeta.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle}>{device.serial}</Text>
              <Text style={styles.sheetSub}>{typeMeta.label}</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Status banner */}
            <View style={[styles.statusBanner, { backgroundColor: statusMeta.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: statusMeta.color, width: 10, height: 10, borderRadius: 5 }]} />
              <Text style={[styles.bannerStatus, { color: statusMeta.color }]}>{statusMeta.label}</Text>
              {!!device.fault && <Text style={styles.bannerFault} numberOfLines={2}>{device.fault}</Text>}
            </View>

            {/* Detail rows */}
            <View style={styles.detailCard}>
              <DetailRow label="Serial Number"    value={device.serial} />
              <DetailRow label="Type"             value={typeMeta.label} />
              <DetailRow label="Firmware"         value={`v${device.firmware}`} />
              <DetailRow label="Assigned To"      value={device.vehiclePlate ?? 'Unassigned'} />
              <DetailRow label="Last Seen"        value={timeAgo(device.lastSeen)} last />
            </View>

            {(device.sim || device.battery !== null || device.signal !== null) && (
              <View style={styles.detailCard}>
                {!!device.sim            && <DetailRow label="SIM Card"         value={device.sim} />}
                {device.signal  !== null && <DetailRow label="Signal Strength"  value={`${device.signal}/4 bars`} />}
                {device.battery !== null && <DetailRow label="Battery Level"    value={`${device.battery}%`} last />}
              </View>
            )}

            {!!device.notes && (
              <View style={styles.detailCard}>
                <DetailRow label="Notes" value={device.notes} last />
              </View>
            )}

            {/* Remove button */}
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => { onRemove(device.id); onClose(); }}
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={16} color={Colors.danger} />
              <Text style={styles.removeBtnText}>Remove Device</Text>
            </TouchableOpacity>
            <View style={{ height: 32 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function DetailRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.detailRow, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

// ── Add Device Sheet ───────────────────────────────────────────────────────────

function AddDeviceSheet({
  visible, onClose, onSave, vehiclePlates,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (d: NewDevice) => void;
  vehiclePlates: string[];
}) {
  const [type,   setType]   = useState<DeviceType>('gps');
  const [serial, setSerial] = useState('');
  const [plate,  setPlate]  = useState<string | null>(null);
  const [sim,    setSim]    = useState('');
  const [notes,  setNotes]  = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const reset = () => {
    setType('gps'); setSerial(''); setPlate(null);
    setSim(''); setNotes(''); setErrors({});
  };

  const handleSave = async () => {
    const e: Record<string, string> = {};
    if (!serial.trim()) e.serial = 'Serial number is required';
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setSaving(true);
    await new Promise((r) => setTimeout(r, 500));
    onSave({
      serial: serial.trim().toUpperCase(),
      type,
      status: 'offline',
      vehiclePlate: plate,
      sim: type === 'gps' ? (sim.trim() || null) : null,
      notes: notes.trim(),
    });
    setSaving(false);
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={() => { reset(); onClose(); }}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={styles.overlayBg} activeOpacity={1} onPress={() => { reset(); onClose(); }} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetTopRow}>
            <Text style={[styles.sheetTitle, { flex: 1 }]}>Add Device</Text>
            <TouchableOpacity onPress={() => { reset(); onClose(); }}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* Device type */}
            <View style={styles.addField}>
              <Text style={styles.addLabel}>Device Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 2 }}>
                {DEVICE_TYPES.map((k) => {
                  const meta = TYPE_META[k];
                  const active = type === k;
                  return (
                    <TouchableOpacity
                      key={k}
                      style={[styles.typeChip, active && { backgroundColor: meta.color, borderColor: meta.color }]}
                      onPress={() => setType(k)}
                    >
                      <Ionicons name={meta.icon as any} size={13} color={active ? '#FFF' : meta.color} />
                      <Text style={[styles.typeChipText, active && { color: '#FFF' }]}>{meta.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Serial */}
            <View style={styles.addField}>
              <Text style={styles.addLabel}>Serial Number *</Text>
              <View style={[styles.inputRow, !!errors.serial && styles.inputRowError]}>
                <Ionicons name="barcode-outline" size={16} color={Colors.textMuted} />
                <TextInput
                  style={styles.inputText}
                  value={serial}
                  onChangeText={(v) => { setSerial(v); setErrors((e) => ({ ...e, serial: '' })); }}
                  placeholder="e.g. OBT-GPS-005"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
              </View>
              {!!errors.serial && <Text style={styles.fieldError}>{errors.serial}</Text>}
            </View>

            {/* Assign to vehicle */}
            <View style={styles.addField}>
              <Text style={styles.addLabel}>Assign to Vehicle  (optional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 2 }}>
                <TouchableOpacity
                  style={[styles.plateChip, plate === null && styles.plateChipActive]}
                  onPress={() => setPlate(null)}
                >
                  <Text style={[styles.plateChipText, plate === null && styles.plateChipTextActive]}>Unassigned</Text>
                </TouchableOpacity>
                {vehiclePlates.map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.plateChip, plate === p && styles.plateChipActive]}
                    onPress={() => setPlate(p)}
                  >
                    <Text style={[styles.plateChipText, plate === p && styles.plateChipTextActive]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* SIM card — GPS only */}
            {type === 'gps' && (
              <View style={styles.addField}>
                <Text style={styles.addLabel}>SIM Card Number  (optional)</Text>
                <View style={styles.inputRow}>
                  <Ionicons name="cellular-outline" size={16} color={Colors.textMuted} />
                  <TextInput
                    style={styles.inputText}
                    value={sim}
                    onChangeText={setSim}
                    placeholder="+260 95 1234 567"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>
            )}

            {/* Notes */}
            <View style={styles.addField}>
              <Text style={styles.addLabel}>Notes  (optional)</Text>
              <View style={styles.inputRow}>
                <Ionicons name="create-outline" size={16} color={Colors.textMuted} />
                <TextInput
                  style={styles.inputText}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="e.g. Installed 2026-06-12, spare unit"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#FFF" size="small" />
                : <><Ionicons name="checkmark-circle" size={18} color="#FFF" /><Text style={styles.saveBtnText}>Add Device</Text></>}
            </TouchableOpacity>
            <View style={{ height: 32 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────

export default function DevicesScreen() {
  const router = useRouter();
  const { vehicles } = useFleet();

  const [devices,    setDevices]    = useState<Device[]>(SEED_DEVICES);
  const [filter,     setFilter]     = useState<DeviceType | 'all'>('all');
  const [selected,   setSelected]   = useState<Device | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showAdd,    setShowAdd]    = useState(false);

  const filtered  = filter === 'all' ? devices : devices.filter((d) => d.type === filter);
  const onlineN   = devices.filter((d) => d.status === 'online').length;
  const issuesN   = devices.filter((d) => d.status === 'fault' || d.status === 'low_battery').length;
  const offlineN  = devices.filter((d) => d.status === 'offline').length;

  const vehiclePlates = vehicles.map((v) => v.plate);

  const handleAdd = (data: NewDevice) => {
    setDevices((prev) => [...prev, {
      ...data,
      id:        `d${Date.now()}`,
      lastSeen:  new Date().toISOString(),
      battery:   data.type === 'gps' ? 100 : null,
      signal:    data.type === 'gps' ? 0   : null,
      firmware:  '1.0.0',
      fault:     null,
    }]);
  };

  const handleRemove = (id: string) => {
    setDevices((prev) => prev.filter((d) => d.id !== id));
  };

  return (
    <View style={styles.root}>
      {/* Header — SafeAreaView handles status bar inset */}
      <SafeAreaView style={styles.headerSafe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={Colors.textLight} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Device Management</Text>
          <TouchableOpacity style={styles.addIconBtn} onPress={() => setShowAdd(true)}>
            <Ionicons name="add" size={22} color={Colors.textLight} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Stats strip */}
        <View style={styles.statsStrip}>
          <StatItem value={String(devices.length)} label="Total" />
          <View style={styles.statDiv} />
          <StatItem value={String(onlineN)}  label="Online"  color="#2DC653" />
          <View style={styles.statDiv} />
          <StatItem value={String(issuesN)}  label="Issues"  color={issuesN  > 0 ? '#E63946' : Colors.textMuted} />
          <View style={styles.statDiv} />
          <StatItem value={String(offlineN)} label="Offline" color={Colors.textMuted} />
        </View>

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar} contentContainerStyle={styles.filterContent}>
          {FILTER_OPTIONS.map((f) => {
            const count  = f.key === 'all' ? devices.length : devices.filter((d) => d.type === f.key).length;
            const active = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setFilter(f.key as DeviceType | 'all')}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{f.label}</Text>
                <View style={[styles.filterCount, active && styles.filterCountActive]}>
                  <Text style={[styles.filterCountText, active && styles.filterCountTextActive]}>{count}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Device list */}
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="hardware-chip-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No devices in this category</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {filtered.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                onPress={() => { setSelected(device); setShowDetail(true); }}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <SafeAreaView edges={['bottom']} />

      <DeviceDetailSheet
        device={selected}
        visible={showDetail}
        onClose={() => setShowDetail(false)}
        onRemove={handleRemove}
      />
      <AddDeviceSheet
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onSave={handleAdd}
        vehiclePlates={vehiclePlates}
      />
    </View>
  );
}

function StatItem({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, color ? { color } : {}]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.backgroundLight },

  // Header
  headerSafe: { backgroundColor: Colors.primary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn:     { padding: 4, marginRight: 4 },
  headerTitle: { flex: 1, fontSize: FontSize.lg, fontWeight: '800', color: Colors.textLight },
  addIconBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },

  content: { padding: Spacing.md, paddingBottom: 40 },

  // Stats
  statsStrip: {
    flexDirection: 'row',
    backgroundColor: Colors.cardBackground,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadow.sm,
  },
  statItem:  { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textPrimary },
  statLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  statDiv:   { width: 1, backgroundColor: Colors.border, marginVertical: 4 },

  // Filters
  filterBar:     { marginBottom: Spacing.md },
  filterContent: { gap: 8, paddingHorizontal: 2 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: Radius.full, borderWidth: 1.5,
    borderColor: Colors.border, backgroundColor: Colors.cardBackground,
  },
  filterChipActive:     { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipText:       { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  filterChipTextActive: { color: Colors.textLight },
  filterCount: {
    minWidth: 20, height: 18, paddingHorizontal: 5, borderRadius: 9,
    backgroundColor: Colors.backgroundLight,
    alignItems: 'center', justifyContent: 'center',
  },
  filterCountActive:     { backgroundColor: 'rgba(255,255,255,0.2)' },
  filterCountText:       { fontSize: 10, fontWeight: '700', color: Colors.textSecondary },
  filterCountTextActive: { color: Colors.textLight },

  // List
  list:      { gap: 10 },
  empty:     { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyText: { fontSize: FontSize.md, color: Colors.textMuted },

  // Device card
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.cardBackground,
    borderRadius: Radius.md,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  cardAccent: { width: 4 },
  cardBody:   { flex: 1, padding: 12 },
  cardRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },

  typeIcon: {
    width: 40, height: 40, borderRadius: Radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },

  cardInfo:     { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 2 },
  cardSerial:   { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary, flex: 1 },

  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radius.full,
  },
  statusDot:   { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontSize: 10, fontWeight: '700' },

  cardSubtitle: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 6 },
  cardMeta:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaChip:     { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText:     { fontSize: 10, color: Colors.textMuted },
  metaTime:     { fontSize: 10, color: Colors.textMuted },

  faultRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  faultText: { fontSize: 10, color: Colors.danger, flex: 1 },

  battPill: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingHorizontal: 5, paddingVertical: 2,
    borderRadius: Radius.full, borderWidth: 1,
  },
  battText: { fontSize: 10, fontWeight: '700' },

  // Modal / Sheet
  overlay:   { flex: 1, justifyContent: 'flex-end' },
  overlayBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: Colors.cardBackground,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: Spacing.md,
    maxHeight: '90%',
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center', marginTop: 10, marginBottom: 8,
  },
  sheetTopRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: Spacing.sm, marginBottom: 4,
  },
  sheetTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textPrimary },
  sheetSub:   { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },

  // Status banner
  statusBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    borderRadius: Radius.sm, padding: 12, marginBottom: 12,
  },
  bannerStatus: { fontSize: FontSize.md, fontWeight: '700' },
  bannerFault:  { fontSize: FontSize.sm, color: Colors.danger, flex: 1, marginTop: 1 },

  // Detail rows
  detailCard: {
    backgroundColor: Colors.backgroundLight,
    borderRadius: Radius.md, overflow: 'hidden', marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 11, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  detailLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500' },
  detailValue: {
    fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: '600',
    textAlign: 'right', flex: 1, marginLeft: 12,
  },

  removeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: Colors.danger, borderRadius: Radius.md, height: 46, marginBottom: 8,
  },
  removeBtnText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.danger },

  // Add device fields
  addField: { marginBottom: Spacing.md },
  addLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary, marginBottom: 6 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.sm,
    paddingHorizontal: 12, height: 44, backgroundColor: Colors.backgroundLight,
  },
  inputRowError: { borderColor: Colors.danger },
  inputText: { flex: 1, fontSize: FontSize.md, color: Colors.textPrimary },
  fieldError: { fontSize: FontSize.xs, color: Colors.danger, marginTop: 3 },

  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.backgroundLight,
  },
  typeChipText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },

  plateChip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.backgroundLight,
  },
  plateChipActive:     { backgroundColor: Colors.primary, borderColor: Colors.primary },
  plateChipText:       { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  plateChipTextActive: { color: Colors.textLight },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.md, height: 50, marginTop: Spacing.sm,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText:     { fontSize: FontSize.md, fontWeight: '800', color: Colors.textLight },
});
