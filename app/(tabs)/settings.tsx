import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, FontSize, Shadow } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useFleet } from '../../context/FleetContext';
import type { Driver, Vehicle } from '../../types';

// ─── Add Driver Sheet ─────────────────────────────────────────────────────────

function AddDriverSheet({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (d: Omit<Driver, 'id'>) => void;
}) {
  const [name,    setName]    = useState('');
  const [phone,   setPhone]   = useState('+260 ');
  const [license, setLicense] = useState('ZPS-DL-');
  const [saving,  setSaving]  = useState(false);
  const [errors,  setErrors]  = useState<Record<string, string>>({});

  const reset = () => { setName(''); setPhone('+260 '); setLicense('ZPS-DL-'); setErrors({}); };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim())    e.name    = 'Full name is required';
    if (phone.trim() === '+260') e.phone = 'Phone number is required';
    if (license.trim() === 'ZPS-DL-') e.license = 'License number is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    await new Promise((r) => setTimeout(r, 500));
    onSave({ name: name.trim(), phone: phone.trim(), licenseNumber: license.trim() });
    setSaving(false);
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={styles.overlayBg} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Add New Driver</Text>
            <TouchableOpacity onPress={() => { reset(); onClose(); }}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <SheetField
              label="Full Name"
              icon="person-outline"
              value={name}
              onChangeText={(v) => { setName(v); setErrors((e) => ({ ...e, name: '' })); }}
              placeholder="e.g. Chanda Mwape"
              error={errors.name}
            />
            <SheetField
              label="Phone Number"
              icon="call-outline"
              value={phone}
              onChangeText={(v) => { setPhone(v); setErrors((e) => ({ ...e, phone: '' })); }}
              placeholder="+260 97 1234 567"
              keyboardType="phone-pad"
              error={errors.phone}
            />
            <SheetField
              label="License Number"
              icon="card-outline"
              value={license}
              onChangeText={(v) => { setLicense(v); setErrors((e) => ({ ...e, license: '' })); }}
              placeholder="ZPS-DL-2024-006"
              autoCapitalize="characters"
              error={errors.license}
            />

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#FFF" size="small" />
                : <><Ionicons name="checkmark-circle" size={18} color="#FFF" /><Text style={styles.saveBtnText}>Add Driver</Text></>
              }
            </TouchableOpacity>
            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Add Vehicle Sheet ────────────────────────────────────────────────────────

const MAKES = ['Toyota', 'Ford', 'Mitsubishi', 'Mercedes-Benz', 'Isuzu', 'Nissan', 'Hino', 'Volvo'];

function AddVehicleSheet({
  visible,
  onClose,
  onSave,
  drivers,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (v: Omit<Vehicle, 'id'>) => void;
  drivers: Driver[];
}) {
  const [plate,      setPlate]      = useState('');
  const [make,       setMake]       = useState('');
  const [model,      setModel]      = useState('');
  const [year,       setYear]       = useState(String(new Date().getFullYear()));
  const [odometer,   setOdometer]   = useState('0');
  const [fuelLevel,  setFuelLevel]  = useState('100');
  const [driverId,   setDriverId]   = useState<string | null>(null);
  const [saving,     setSaving]     = useState(false);
  const [errors,     setErrors]     = useState<Record<string, string>>({});

  const reset = () => {
    setPlate(''); setMake(''); setModel('');
    setYear(String(new Date().getFullYear())); setOdometer('0');
    setFuelLevel('100'); setDriverId(null); setErrors({});
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!plate.trim())   e.plate = 'Plate number is required';
    if (!make.trim())    e.make  = 'Make is required';
    if (!model.trim())   e.model = 'Model is required';
    const y = Number(year); if (isNaN(y) || y < 1990 || y > 2030) e.year = 'Enter a valid year';
    const fl = Number(fuelLevel); if (isNaN(fl) || fl < 0 || fl > 100) e.fuelLevel = '0–100%';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    await new Promise((r) => setTimeout(r, 500));
    const assignedDriver = driverId ? (drivers.find((d) => d.id === driverId) ?? null) : null;
    onSave({
      plate:      plate.trim().toUpperCase(),
      make:       make.trim(),
      model:      model.trim(),
      year:       Number(year),
      status:     'offline',
      driver:     assignedDriver,
      location:   { latitude: -15.4167, longitude: 28.2833, address: 'Lusaka CBD, Lusaka' },
      lastSeen:   new Date().toISOString(),
      odometer:   Number(odometer) || 0,
      fuelLevel:  Math.round(Number(fuelLevel)),
      speed:      0,
      engineOn:   false,
      groupId:    'g1',
    });
    setSaving(false);
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={styles.overlayBg} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Add New Vehicle</Text>
            <TouchableOpacity onPress={() => { reset(); onClose(); }}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <SheetField
              label="Registration Plate"
              icon="car-outline"
              value={plate}
              onChangeText={(v) => { setPlate(v); setErrors((e) => ({ ...e, plate: '' })); }}
              placeholder="e.g. ZMB 007"
              autoCapitalize="characters"
              error={errors.plate}
            />

            {/* Make chips */}
            <View style={styles.sheetFieldGroup}>
              <Text style={styles.sheetFieldLabel}>Make</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                {MAKES.map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.chip, make === m && styles.chipActive]}
                    onPress={() => { setMake(m); setErrors((e) => ({ ...e, make: '' })); }}
                  >
                    <Text style={[styles.chipText, make === m && styles.chipTextActive]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TextInput
                style={[styles.sheetInput, !!errors.make && styles.sheetInputError]}
                value={make}
                onChangeText={(v) => { setMake(v); setErrors((e) => ({ ...e, make: '' })); }}
                placeholder="Or type make..."
                placeholderTextColor={Colors.textMuted}
              />
              {!!errors.make && <Text style={styles.fieldError}>{errors.make}</Text>}
            </View>

            <SheetField
              label="Model"
              icon="settings-outline"
              value={model}
              onChangeText={(v) => { setModel(v); setErrors((e) => ({ ...e, model: '' })); }}
              placeholder="e.g. Hilux, Ranger, Canter"
              error={errors.model}
            />

            <View style={styles.sheetRow}>
              <View style={styles.sheetRowItem}>
                <SheetField
                  label="Year"
                  icon="calendar-outline"
                  value={year}
                  onChangeText={(v) => { setYear(v); setErrors((e) => ({ ...e, year: '' })); }}
                  placeholder="2024"
                  keyboardType="number-pad"
                  error={errors.year}
                />
              </View>
              <View style={styles.sheetRowItem}>
                <SheetField
                  label="Fuel Level (%)"
                  icon="water-outline"
                  value={fuelLevel}
                  onChangeText={(v) => { setFuelLevel(v); setErrors((e) => ({ ...e, fuelLevel: '' })); }}
                  placeholder="0–100"
                  keyboardType="number-pad"
                  error={errors.fuelLevel}
                />
              </View>
            </View>

            <SheetField
              label="Odometer (km) — optional"
              icon="speedometer-outline"
              value={odometer}
              onChangeText={setOdometer}
              placeholder="0"
              keyboardType="number-pad"
            />

            {/* Assign Driver */}
            <View style={styles.sheetFieldGroup}>
              <Text style={styles.sheetFieldLabel}>Assign Driver — optional</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                <TouchableOpacity
                  style={[styles.chip, driverId === null && styles.chipActive]}
                  onPress={() => setDriverId(null)}
                >
                  <Text style={[styles.chipText, driverId === null && styles.chipTextActive]}>Unassigned</Text>
                </TouchableOpacity>
                {drivers.map((d) => (
                  <TouchableOpacity
                    key={d.id}
                    style={[styles.chip, driverId === d.id && styles.chipActive]}
                    onPress={() => setDriverId(d.id)}
                  >
                    <Text style={[styles.chipText, driverId === d.id && styles.chipTextActive]}>
                      {d.name.split(' ')[0]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#FFF" size="small" />
                : <><Ionicons name="checkmark-circle" size={18} color="#FFF" /><Text style={styles.saveBtnText}>Add Vehicle</Text></>
              }
            </TouchableOpacity>
            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Shared field component ───────────────────────────────────────────────────

function SheetField({
  label, icon, value, onChangeText, placeholder, keyboardType, autoCapitalize, error,
}: {
  label: string; icon: string; value: string;
  onChangeText: (v: string) => void; placeholder: string;
  keyboardType?: any; autoCapitalize?: any; error?: string;
}) {
  return (
    <View style={styles.sheetFieldGroup}>
      <Text style={styles.sheetFieldLabel}>{label}</Text>
      <View style={[styles.sheetInputWrap, !!error && styles.sheetInputWrapError]}>
        <Ionicons name={icon as any} size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.sheetInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          keyboardType={keyboardType ?? 'default'}
          autoCapitalize={autoCapitalize ?? 'words'}
          autoCorrect={false}
        />
      </View>
      {!!error && <Text style={styles.fieldError}>{error}</Text>}
    </View>
  );
}

// ─── Main Settings Screen ─────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { user, logout }        = useAuth();
  const { drivers, vehicles, addDriver, addVehicle } = useFleet();
  const router                  = useRouter();

  const [pushAlerts,     setPushAlerts]     = useState(true);
  const [speedAlerts,    setSpeedAlerts]    = useState(true);
  const [geofenceAlerts, setGeofenceAlerts] = useState(true);
  const [fuelAlerts,     setFuelAlerts]     = useState(false);
  const [darkMode,       setDarkMode]       = useState(false);
  const [showAddDriver,  setShowAddDriver]  = useState(false);
  const [showAddVehicle, setShowAddVehicle] = useState(false);

  const handleSignOut = () => { logout(); router.replace('/login'); };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitials}>{user?.initials ?? 'OB'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.orgName}>{user?.name ?? 'Fleet User'}</Text>
            <Text style={styles.orgEmail}>{user?.email ?? ''}</Text>
            <View style={styles.planBadge}>
              <Text style={styles.planText}>
                {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'User'} · {vehicles.length} vehicles
              </Text>
            </View>
          </View>
        </View>

        {/* Notifications */}
        <SectionHeader title="Notifications" />
        <View style={styles.group}>
          <ToggleRow icon="notifications" label="Push Notifications"  sub="Receive alerts on your device"     value={pushAlerts}     onChange={setPushAlerts} />
          <Divider />
          <ToggleRow icon="speedometer"   label="Speed Alerts"        sub="Notify when vehicles exceed limits" value={speedAlerts}    onChange={setSpeedAlerts} />
          <Divider />
          <ToggleRow icon="map"           label="Geofence Alerts"     sub="Zone entry and exit events"        value={geofenceAlerts} onChange={setGeofenceAlerts} />
          <Divider />
          <ToggleRow icon="water"         label="Low Fuel Alerts"     sub="Alert when fuel below 25%"         value={fuelAlerts}     onChange={setFuelAlerts} />
        </View>

        {/* Appearance */}
        <SectionHeader title="Appearance" />
        <View style={styles.group}>
          <ToggleRow icon="moon" label="Dark Mode" sub="Use dark theme" value={darkMode} onChange={setDarkMode} />
        </View>

        {/* Drivers */}
        <SectionHeader title={`Drivers  (${drivers.length})`} />
        <View style={styles.group}>
          {drivers.map((driver, i) => (
            <React.Fragment key={driver.id}>
              {i > 0 && <Divider />}
              <TouchableOpacity style={styles.driverRow} activeOpacity={0.7}>
                <View style={styles.driverAvatar}>
                  <Text style={styles.driverInitials}>
                    {driver.name.split(' ').map((n) => n[0]).join('')}
                  </Text>
                </View>
                <View style={styles.driverInfo}>
                  <Text style={styles.driverName}>{driver.name}</Text>
                  <Text style={styles.driverMeta}>{driver.phone} · {driver.licenseNumber}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            </React.Fragment>
          ))}
          <Divider />
          <TouchableOpacity style={styles.addRow} activeOpacity={0.7} onPress={() => setShowAddDriver(true)}>
            <Ionicons name="add-circle" size={22} color={Colors.accent} />
            <Text style={styles.addText}>Add New Driver</Text>
          </TouchableOpacity>
        </View>

        {/* Vehicles */}
        <SectionHeader title={`Vehicles  (${vehicles.length})`} />
        <View style={styles.group}>
          {vehicles.map((v, i) => (
            <React.Fragment key={v.id}>
              {i > 0 && <Divider />}
              <TouchableOpacity style={styles.driverRow} activeOpacity={0.7}>
                <View style={[styles.driverAvatar, { backgroundColor: Colors.primaryLight }]}>
                  <Ionicons name="car-outline" size={18} color={Colors.textLight} />
                </View>
                <View style={styles.driverInfo}>
                  <Text style={styles.driverName}>{v.plate}</Text>
                  <Text style={styles.driverMeta}>{v.year} {v.make} {v.model}{v.driver ? `  ·  ${v.driver.name}` : '  ·  Unassigned'}</Text>
                </View>
                <View style={[styles.statusPip, { backgroundColor: statusColor(v.status) }]} />
              </TouchableOpacity>
            </React.Fragment>
          ))}
          <Divider />
          <TouchableOpacity style={styles.addRow} activeOpacity={0.7} onPress={() => setShowAddVehicle(true)}>
            <Ionicons name="add-circle" size={22} color={Colors.accent} />
            <Text style={styles.addText}>Add New Vehicle</Text>
          </TouchableOpacity>
        </View>

        {/* Account */}
        <SectionHeader title="Account" />
        <View style={styles.group}>
          <SettingRow icon="shield-checkmark" label="Security & Privacy" />
          <Divider />
          <SettingRow icon="download"         label="Export Data" />
          <Divider />
          <SettingRow icon="help-circle"      label="Help & Support" />
          <Divider />
          <SettingRow icon="document-text"    label="Terms & Privacy Policy" />
        </View>

        {/* Sign out */}
        <View style={styles.group}>
          <TouchableOpacity style={styles.signOutBtn} activeOpacity={0.8} onPress={handleSignOut}>
            <Ionicons name="log-out" size={18} color={Colors.danger} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>OBT MobileTracker v1.0.0</Text>
        <View style={{ height: Spacing.xl }} />
      </ScrollView>

      {/* Modals */}
      <AddDriverSheet
        visible={showAddDriver}
        onClose={() => setShowAddDriver(false)}
        onSave={addDriver}
      />
      <AddVehicleSheet
        visible={showAddVehicle}
        onClose={() => setShowAddVehicle(false)}
        onSave={addVehicle}
        drivers={drivers}
      />
    </SafeAreaView>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusColor(status: string) {
  switch (status) {
    case 'active':      return Colors.statusActive;
    case 'idle':        return Colors.statusIdle;
    case 'maintenance': return Colors.statusMaintenance;
    default:            return Colors.statusOffline;
  }
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function Divider() {
  return <View style={styles.divider} />;
}

function ToggleRow({
  icon, label, sub, value, onChange,
}: {
  icon: any; label: string; sub: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingIcon}>
        <Ionicons name={icon} size={18} color={Colors.primary} />
      </View>
      <View style={styles.settingText}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingSub}>{sub}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: Colors.border, true: Colors.accent }} thumbColor={Colors.textLight} />
    </View>
  );
}

function SettingRow({ icon, label }: { icon: any; label: string }) {
  return (
    <TouchableOpacity style={styles.settingRow} activeOpacity={0.7}>
      <View style={styles.settingIcon}>
        <Ionicons name={icon} size={18} color={Colors.primary} />
      </View>
      <Text style={[styles.settingLabel, { flex: 1 }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.backgroundLight },
  content: { padding: Spacing.md },

  // Profile card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadow.md,
  },
  avatar: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitials: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textLight },
  orgName:  { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textLight },
  orgEmail: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  planBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 3,
    alignSelf: 'flex-start', marginTop: 6,
  },
  planText: { fontSize: FontSize.xs, color: Colors.textLight, fontWeight: '600' },

  sectionHeader: {
    fontSize: FontSize.xs, fontWeight: '700',
    color: Colors.textSecondary, textTransform: 'uppercase',
    letterSpacing: 1, marginTop: Spacing.md, marginBottom: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  group: {
    backgroundColor: Colors.cardBackground,
    borderRadius: Radius.md,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  divider: { height: 1, backgroundColor: Colors.divider, marginLeft: 52 },

  settingRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.sm },
  settingIcon: {
    width: 34, height: 34, borderRadius: Radius.sm,
    backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center',
  },
  settingText:  { flex: 1 },
  settingLabel: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: '500' },
  settingSub:   { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },

  driverRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.sm },
  driverAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  driverInitials: { color: Colors.textLight, fontSize: FontSize.sm, fontWeight: '800' },
  driverInfo:     { flex: 1 },
  driverName:     { fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary },
  driverMeta:     { fontSize: FontSize.xs, color: Colors.textSecondary },

  statusPip: { width: 10, height: 10, borderRadius: 5 },

  addRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md },
  addText: { fontSize: FontSize.md, color: Colors.accent, fontWeight: '600' },

  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, padding: Spacing.md,
  },
  signOutText: { fontSize: FontSize.md, color: Colors.danger, fontWeight: '700' },
  version:     { textAlign: 'center', fontSize: FontSize.xs, color: Colors.textMuted, marginTop: Spacing.lg },

  // ─── Modal / Sheet ──────────────────────────────────────────────────────────
  overlay:   { flex: 1, justifyContent: 'flex-end' },
  overlayBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: Colors.cardBackground,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.md,
    maxHeight: '90%',
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center', marginTop: 10, marginBottom: 8,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.sm, marginBottom: Spacing.sm,
  },
  sheetTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textPrimary },

  sheetFieldGroup: { marginBottom: Spacing.md },
  sheetFieldLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary, marginBottom: 6 },
  sheetInputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: Radius.sm, paddingHorizontal: 12, height: 44,
    backgroundColor: Colors.backgroundLight,
  },
  sheetInputWrapError: { borderColor: Colors.danger },
  sheetInputError:     { borderColor: Colors.danger },
  sheetInput: {
    flex: 1, fontSize: FontSize.md, color: Colors.textPrimary,
    borderWidth: 0, height: 44, paddingHorizontal: 0,
  },
  fieldError: { fontSize: FontSize.xs, color: Colors.danger, marginTop: 3 },

  chipScroll:       { flexDirection: 'row', marginBottom: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.backgroundLight, marginRight: 6,
  },
  chipActive:     { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText:       { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  chipTextActive: { color: Colors.textLight },

  sheetRow:     { flexDirection: 'row', gap: Spacing.sm },
  sheetRowItem: { flex: 1 },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    height: 50, marginTop: Spacing.sm,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText:     { fontSize: FontSize.md, fontWeight: '800', color: Colors.textLight },
});
