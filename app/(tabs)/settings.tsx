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
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { Colors, Spacing, Radius, FontSize, Shadow } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useFleet } from '../../context/FleetContext';
import { mockTrips, mockAlerts, mockFuelEvents, mockAccidentReports } from '../../data/mockData';
import type { Driver, Vehicle, Trip, Alert as FleetAlert, FuelEvent, AccidentReport } from '../../types';

// ─── Add Driver Sheet ─────────────────────────────────────────────────────────

function AddDriverSheet({
  visible, onClose, onSave,
}: { visible: boolean; onClose: () => void; onSave: (d: Omit<Driver, 'id'>) => void }) {
  const [name,    setName]    = useState('');
  const [phone,   setPhone]   = useState('+260 ');
  const [license, setLicense] = useState('ZPS-DL-');
  const [saving,  setSaving]  = useState(false);
  const [errors,  setErrors]  = useState<Record<string, string>>({});

  const reset = () => { setName(''); setPhone('+260 '); setLicense('ZPS-DL-'); setErrors({}); };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Full name is required';
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
            <SheetField label="Full Name"      icon="person-outline"   value={name}    onChangeText={(v) => { setName(v);    setErrors((e) => ({ ...e, name: '' })); }}    placeholder="e.g. Chanda Mwape"    error={errors.name} />
            <SheetField label="Phone Number"   icon="call-outline"     value={phone}   onChangeText={(v) => { setPhone(v);   setErrors((e) => ({ ...e, phone: '' })); }}   placeholder="+260 97 1234 567"     keyboardType="phone-pad" error={errors.phone} />
            <SheetField label="License Number" icon="card-outline"     value={license} onChangeText={(v) => { setLicense(v); setErrors((e) => ({ ...e, license: '' })); }} placeholder="ZPS-DL-2024-006"     autoCapitalize="characters" error={errors.license} />
            <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#FFF" size="small" /> : <><Ionicons name="checkmark-circle" size={18} color="#FFF" /><Text style={styles.saveBtnText}>Add Driver</Text></>}
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
  visible, onClose, onSave, drivers,
}: { visible: boolean; onClose: () => void; onSave: (v: Omit<Vehicle, 'id'>) => void; drivers: Driver[] }) {
  const [plate,     setPlate]     = useState('');
  const [make,      setMake]      = useState('');
  const [model,     setModel]     = useState('');
  const [year,      setYear]      = useState(String(new Date().getFullYear()));
  const [odometer,  setOdometer]  = useState('0');
  const [fuelLevel, setFuelLevel] = useState('100');
  const [driverId,  setDriverId]  = useState<string | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [errors,    setErrors]    = useState<Record<string, string>>({});

  const reset = () => { setPlate(''); setMake(''); setModel(''); setYear(String(new Date().getFullYear())); setOdometer('0'); setFuelLevel('100'); setDriverId(null); setErrors({}); };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!plate.trim()) e.plate = 'Plate number is required';
    if (!make.trim())  e.make  = 'Make is required';
    if (!model.trim()) e.model = 'Model is required';
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
    onSave({ plate: plate.trim().toUpperCase(), make: make.trim(), model: model.trim(), year: Number(year), status: 'offline', driver: assignedDriver, location: { latitude: -15.4167, longitude: 28.2833, address: 'Lusaka CBD, Lusaka' }, lastSeen: new Date().toISOString(), odometer: Number(odometer) || 0, fuelLevel: Math.round(Number(fuelLevel)), speed: 0, engineOn: false, groupId: 'g1' });
    setSaving(false); reset(); onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={styles.overlayBg} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Add New Vehicle</Text>
            <TouchableOpacity onPress={() => { reset(); onClose(); }}><Ionicons name="close" size={22} color={Colors.textSecondary} /></TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <SheetField label="Registration Plate" icon="car-outline" value={plate} onChangeText={(v) => { setPlate(v); setErrors((e) => ({ ...e, plate: '' })); }} placeholder="e.g. ZMB 007" autoCapitalize="characters" error={errors.plate} />
            <View style={styles.sheetFieldGroup}>
              <Text style={styles.sheetFieldLabel}>Make</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                {MAKES.map((m) => (
                  <TouchableOpacity key={m} style={[styles.chip, make === m && styles.chipActive]} onPress={() => { setMake(m); setErrors((e) => ({ ...e, make: '' })); }}>
                    <Text style={[styles.chipText, make === m && styles.chipTextActive]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TextInput style={[styles.sheetInput, !!errors.make && styles.sheetInputError]} value={make} onChangeText={(v) => { setMake(v); setErrors((e) => ({ ...e, make: '' })); }} placeholder="Or type make..." placeholderTextColor={Colors.textMuted} />
              {!!errors.make && <Text style={styles.fieldError}>{errors.make}</Text>}
            </View>
            <SheetField label="Model" icon="settings-outline" value={model} onChangeText={(v) => { setModel(v); setErrors((e) => ({ ...e, model: '' })); }} placeholder="e.g. Hilux, Ranger, Canter" error={errors.model} />
            <View style={styles.sheetRow}>
              <View style={styles.sheetRowItem}><SheetField label="Year" icon="calendar-outline" value={year} onChangeText={(v) => { setYear(v); setErrors((e) => ({ ...e, year: '' })); }} placeholder="2024" keyboardType="number-pad" error={errors.year} /></View>
              <View style={styles.sheetRowItem}><SheetField label="Fuel Level (%)" icon="water-outline" value={fuelLevel} onChangeText={(v) => { setFuelLevel(v); setErrors((e) => ({ ...e, fuelLevel: '' })); }} placeholder="0–100" keyboardType="number-pad" error={errors.fuelLevel} /></View>
            </View>
            <SheetField label="Odometer (km) — optional" icon="speedometer-outline" value={odometer} onChangeText={setOdometer} placeholder="0" keyboardType="number-pad" />
            <View style={styles.sheetFieldGroup}>
              <Text style={styles.sheetFieldLabel}>Assign Driver — optional</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                <TouchableOpacity style={[styles.chip, driverId === null && styles.chipActive]} onPress={() => setDriverId(null)}>
                  <Text style={[styles.chipText, driverId === null && styles.chipTextActive]}>Unassigned</Text>
                </TouchableOpacity>
                {drivers.map((d) => (
                  <TouchableOpacity key={d.id} style={[styles.chip, driverId === d.id && styles.chipActive]} onPress={() => setDriverId(d.id)}>
                    <Text style={[styles.chipText, driverId === d.id && styles.chipTextActive]}>{d.name.split(' ')[0]}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#FFF" size="small" /> : <><Ionicons name="checkmark-circle" size={18} color="#FFF" /><Text style={styles.saveBtnText}>Add Vehicle</Text></>}
            </TouchableOpacity>
            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Security & Privacy Sheet ─────────────────────────────────────────────────

function SecuritySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [current,  setCurrent]  = useState('');
  const [next,     setNext]     = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showCur,  setShowCur]  = useState(false);
  const [showNew,  setShowNew]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [done,     setDone]     = useState(false);
  const [errors,   setErrors]   = useState<Record<string, string>>({});
  const [signedOut, setSignedOut] = useState(false);

  const handleSave = async () => {
    const e: Record<string, string> = {};
    if (!current)          e.current = 'Required';
    if (next.length < 6)   e.next    = 'Min. 6 characters';
    if (next !== confirm)  e.confirm  = 'Passwords do not match';
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    setDone(true);
    setTimeout(() => { setDone(false); setCurrent(''); setNext(''); setConfirm(''); onClose(); }, 1800);
  };

  const handleSignOutSessions = async () => {
    setSignedOut(true);
    await new Promise((r) => setTimeout(r, 600));
    setTimeout(() => setSignedOut(false), 2000);
  };

  const SESSIONS = [
    { device: 'This device',      icon: 'phone-portrait-outline', location: 'Lusaka, ZM', time: 'Active now', current: true },
    { device: 'Chrome · Windows', icon: 'desktop-outline',        location: 'Lusaka, ZM', time: '2 days ago',  current: false },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={styles.overlayBg} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Security & Privacy</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={Colors.textSecondary} /></TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.subSection}>Change Password</Text>

            <SheetField label="Current Password" icon={showCur ? 'eye-off-outline' : 'eye-outline'} onIconPress={() => setShowCur((p) => !p)}
              value={current} onChangeText={(v) => { setCurrent(v); setErrors((e) => ({ ...e, current: '' })); }}
              placeholder="Enter current password" secureTextEntry={!showCur} error={errors.current} />
            <SheetField label="New Password" icon={showNew ? 'eye-off-outline' : 'eye-outline'} onIconPress={() => setShowNew((p) => !p)}
              value={next} onChangeText={(v) => { setNext(v); setErrors((e) => ({ ...e, next: '', confirm: '' })); }}
              placeholder="At least 6 characters" secureTextEntry={!showNew} error={errors.next} />
            <SheetField label="Confirm New Password" icon="lock-closed-outline"
              value={confirm} onChangeText={(v) => { setConfirm(v); setErrors((e) => ({ ...e, confirm: '' })); }}
              placeholder="Repeat new password" secureTextEntry error={errors.confirm} />

            <TouchableOpacity
              style={[styles.saveBtn, (saving || done) && styles.saveBtnDisabled, done && { backgroundColor: Colors.success }]}
              onPress={handleSave} disabled={saving || done}
            >
              {saving ? <ActivityIndicator color="#FFF" size="small" /> :
               done   ? <><Ionicons name="checkmark-circle" size={18} color="#FFF" /><Text style={styles.saveBtnText}>Password Updated!</Text></> :
                        <><Ionicons name="lock-closed" size={18} color="#FFF" /><Text style={styles.saveBtnText}>Update Password</Text></>}
            </TouchableOpacity>

            <Text style={[styles.subSection, { marginTop: Spacing.lg }]}>Active Sessions</Text>
            <View style={styles.group}>
              {SESSIONS.map((s, i) => (
                <React.Fragment key={s.device}>
                  {i > 0 && <Divider />}
                  <View style={styles.sessionRow}>
                    <View style={[styles.settingIcon, { backgroundColor: s.current ? '#EEF2FF' : Colors.backgroundLight }]}>
                      <Ionicons name={s.icon as any} size={18} color={s.current ? Colors.primary : Colors.textMuted} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.settingLabel}>{s.device}</Text>
                      <Text style={styles.settingSub}>{s.location} · {s.time}</Text>
                    </View>
                    {s.current && (
                      <View style={styles.currentBadge}>
                        <Text style={styles.currentBadgeText}>Current</Text>
                      </View>
                    )}
                  </View>
                </React.Fragment>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.dangerOutlineBtn, signedOut && { borderColor: Colors.success }]}
              onPress={handleSignOutSessions}
              activeOpacity={0.8}
            >
              <Ionicons name={signedOut ? 'checkmark-circle-outline' : 'log-out-outline'} size={16} color={signedOut ? Colors.success : Colors.danger} />
              <Text style={[styles.dangerOutlineBtnText, signedOut && { color: Colors.success }]}>
                {signedOut ? 'Other sessions signed out' : 'Sign Out All Other Sessions'}
              </Text>
            </TouchableOpacity>
            <View style={{ height: 32 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Export Helpers ───────────────────────────────────────────────────────────

function periodCutoff(period: string): Date | null {
  const days: Record<string, number> = {
    'Last 7 days': 7, 'Last 30 days': 30, 'Last 3 months': 90,
  };
  return days[period] ? new Date(Date.now() - days[period] * 86_400_000) : null;
}

function withinPeriod(iso: string, cutoff: Date | null): boolean {
  return !cutoff || new Date(iso) >= cutoff;
}

function cell(v: string | number | boolean | undefined | null): string {
  const s = v === null || v === undefined ? '' : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

function toTable<T>(rows: T[], headers: string[], mapper: (r: T) => (string | number | boolean | undefined | null)[]): string {
  const head = headers.map(cell).join(',');
  const body = rows.map((r) => mapper(r).map(cell).join(','));
  return [head, ...body].join('\n');
}

function tripsSection(trips: Trip[], cutoff: Date | null) {
  const data = trips.filter((t) => withinPeriod(t.startTime, cutoff));
  return toTable(data,
    ['Vehicle', 'Driver', 'Start Time', 'End Time', 'Distance (km)', 'Duration (min)', 'Max Speed (km/h)', 'Avg Speed (km/h)', 'Fuel Used (L)'],
    (t) => [
      t.vehiclePlate, t.driverName,
      new Date(t.startTime).toLocaleString(),
      t.endTime ? new Date(t.endTime).toLocaleString() : 'In Progress',
      t.distance.toFixed(1), Math.round(t.duration),
      t.maxSpeed, t.avgSpeed.toFixed(1), t.fuelUsed.toFixed(1),
    ],
  );
}

function fuelSection(events: FuelEvent[], cutoff: Date | null) {
  const data = events.filter((e) => withinPeriod(e.timestamp, cutoff));
  return toTable(data,
    ['Date', 'Vehicle', 'Type', 'Liters', 'Cost (ZMW)', 'Station', 'Odometer (km)'],
    (e) => [
      new Date(e.timestamp).toLocaleString(), e.vehiclePlate, e.type,
      e.liters.toFixed(1), e.cost ?? '', e.station ?? '', e.odometer,
    ],
  );
}

function alertsSection(alerts: FleetAlert[], cutoff: Date | null) {
  const data = alerts.filter((a) => withinPeriod(a.timestamp, cutoff));
  return toTable(data,
    ['Time', 'Vehicle', 'Type', 'Severity', 'Message', 'Read'],
    (a) => [
      new Date(a.timestamp).toLocaleString(), a.vehiclePlate,
      a.type.replace(/_/g, ' '), a.severity, a.message, a.read ? 'Yes' : 'No',
    ],
  );
}

function accidentsSection(reports: AccidentReport[], cutoff: Date | null) {
  const data = reports.filter((r) => withinPeriod(r.timestamp, cutoff));
  return toTable(data,
    ['Date', 'Vehicle', 'Driver', 'Location', 'Severity', 'Status', 'Injuries', 'Damage Est. (ZMW)'],
    (r) => [
      new Date(r.timestamp).toLocaleString(), r.vehiclePlate, r.driverName,
      r.location.address ?? `${r.location.latitude},${r.location.longitude}`,
      r.severity, r.status.replace(/_/g, ' '),
      r.injuriesReported ? 'Yes' : 'No', r.estimatedDamage ?? '',
    ],
  );
}

function buildCSV(datasets: string[], period: string): string {
  const cutoff = periodCutoff(period);
  const parts: string[] = [];
  if (datasets.includes('Trips'))            parts.push(`TRIPS\n${tripsSection(mockTrips, cutoff)}`);
  if (datasets.includes('Fuel Events'))      parts.push(`FUEL EVENTS\n${fuelSection(mockFuelEvents, cutoff)}`);
  if (datasets.includes('Alerts'))           parts.push(`ALERTS\n${alertsSection(mockAlerts, cutoff)}`);
  if (datasets.includes('Accident Reports')) parts.push(`ACCIDENT REPORTS\n${accidentsSection(mockAccidentReports, cutoff)}`);
  return parts.join('\n\n');
}

function buildHTML(datasets: string[], period: string): string {
  const cutoff   = periodCutoff(period);
  const dateStr  = new Date().toLocaleDateString('en-ZM', { dateStyle: 'long' });

  const tableHTML = (headers: string[], rows: string[][]): string => `
    <table>
      <thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>`;

  const badge = (text: string, cls: string) => `<span class="badge ${cls}">${text}</span>`;

  let sections = '';

  if (datasets.includes('Trips')) {
    const data = mockTrips.filter((t) => withinPeriod(t.startTime, cutoff));
    sections += `<h2>Trips <span class="count">${data.length}</span></h2>` + tableHTML(
      ['Vehicle', 'Driver', 'Start Time', 'Distance', 'Duration', 'Max Speed', 'Fuel Used'],
      data.map((t) => [
        `<strong>${t.vehiclePlate}</strong>`, t.driverName,
        new Date(t.startTime).toLocaleString(),
        `${t.distance.toFixed(1)} km`, `${Math.round(t.duration)} min`,
        `${t.maxSpeed} km/h`, `${t.fuelUsed.toFixed(1)} L`,
      ]),
    );
  }

  if (datasets.includes('Fuel Events')) {
    const data = mockFuelEvents.filter((e) => withinPeriod(e.timestamp, cutoff));
    sections += `<h2>Fuel Events <span class="count">${data.length}</span></h2>` + tableHTML(
      ['Date', 'Vehicle', 'Type', 'Liters', 'Cost (ZMW)', 'Station'],
      data.map((e) => [
        new Date(e.timestamp).toLocaleString(), e.vehiclePlate,
        badge(e.type, e.type === 'refuel' ? 'refuel' : 'consumption'),
        `${e.liters.toFixed(1)} L`,
        e.cost ? `ZMW ${e.cost.toFixed(2)}` : '—', e.station ?? '—',
      ]),
    );
  }

  if (datasets.includes('Alerts')) {
    const data = mockAlerts.filter((a) => withinPeriod(a.timestamp, cutoff));
    sections += `<h2>Alerts <span class="count">${data.length}</span></h2>` + tableHTML(
      ['Time', 'Vehicle', 'Type', 'Severity', 'Message'],
      data.map((a) => [
        new Date(a.timestamp).toLocaleString(), a.vehiclePlate,
        a.type.replace(/_/g, ' '),
        badge(a.severity, a.severity),
        a.message,
      ]),
    );
  }

  if (datasets.includes('Accident Reports')) {
    const data = mockAccidentReports.filter((r) => withinPeriod(r.timestamp, cutoff));
    sections += `<h2>Accident Reports <span class="count">${data.length}</span></h2>` + tableHTML(
      ['Date', 'Vehicle', 'Driver', 'Location', 'Severity', 'Status', 'Injuries'],
      data.map((r) => [
        new Date(r.timestamp).toLocaleString(),
        `<strong>${r.vehiclePlate}</strong>`, r.driverName,
        r.location.address ?? '—',
        badge(r.severity, r.severity),
        r.status.replace(/_/g, ' '),
        r.injuriesReported ? '<strong style="color:#DC2626">Yes</strong>' : 'No',
      ]),
    );
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; padding: 36px; color: #0D1B2A; font-size: 13px; }
    .header { border-bottom: 3px solid #0A2463; padding-bottom: 16px; margin-bottom: 28px; }
    .brand { font-size: 24px; font-weight: 900; color: #0A2463; letter-spacing: 3px; }
    .meta { font-size: 12px; color: #6B7280; margin-top: 4px; }
    h2 { font-size: 14px; font-weight: 700; color: #0A2463; text-transform: uppercase;
         letter-spacing: 1px; margin: 28px 0 10px; }
    .count { background: #EEF2FF; color: #0A2463; border-radius: 10px;
             padding: 1px 7px; font-size: 11px; font-weight: 600; text-transform: none; letter-spacing: 0; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th { background: #0A2463; color: #fff; padding: 8px 10px; text-align: left;
         font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    td { padding: 7px 10px; border-bottom: 1px solid #E5E7EB; vertical-align: top; }
    tr:nth-child(even) td { background: #F9FAFB; }
    .badge { display: inline-block; padding: 2px 7px; border-radius: 10px;
             font-size: 10px; font-weight: 700; text-transform: capitalize; }
    .critical, .severe, .fatal { background: #FEE2E2; color: #DC2626; }
    .warning, .moderate       { background: #FEF3C7; color: #D97706; }
    .info, .minor             { background: #DBEAFE; color: #2563EB; }
    .refuel                   { background: #DCFCE7; color: #16A34A; }
    .consumption              { background: #FEF3C7; color: #D97706; }
  </style></head><body>
    <div class="header">
      <div class="brand">OBT MobileTracker</div>
      <div class="meta">Fleet Report &nbsp;·&nbsp; Generated ${dateStr} &nbsp;·&nbsp; Period: ${period}</div>
    </div>
    ${sections}
  </body></html>`;
}

// ─── Export Data Sheet ────────────────────────────────────────────────────────

const EXPORT_FORMATS  = ['PDF', 'Excel', 'CSV'] as const;
const EXPORT_DATASETS = ['Trips', 'Fuel Events', 'Alerts', 'Accident Reports'];
const EXPORT_PERIODS  = ['Last 7 days', 'Last 30 days', 'Last 3 months', 'All time'];

function ExportSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [format,    setFormat]    = useState<string>('PDF');
  const [datasets,  setDatasets]  = useState(['Trips', 'Fuel Events']);
  const [period,    setPeriod]    = useState('Last 30 days');
  const [exporting, setExporting] = useState(false);
  const [done,      setDone]      = useState(false);

  const toggle = (d: string) =>
    setDatasets((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);

  const handleExport = async () => {
    if (!datasets.length) return;
    setExporting(true);
    try {
      const stamp = new Date().toISOString().slice(0, 10);

      if (format === 'PDF') {
        const html       = buildHTML(datasets, period);
        const { uri }    = await Print.printToFileAsync({ html });
        const destUri    = `${FileSystem.documentDirectory}OBT-Fleet-${stamp}.pdf`;
        await FileSystem.moveAsync({ from: uri, to: destUri });
        await Sharing.shareAsync(destUri, {
          mimeType:    'application/pdf',
          dialogTitle: 'Save or Share Fleet Report',
          UTI:         'com.adobe.pdf',
        });
      } else {
        const csv      = buildCSV(datasets, period);
        const ext      = format === 'Excel' ? 'xlsx' : 'csv';
        const mimeType = format === 'Excel'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv';
        const fileUri  = `${FileSystem.documentDirectory}OBT-Fleet-${stamp}.${ext}`;
        await FileSystem.writeAsStringAsync(fileUri, csv, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        await Sharing.shareAsync(fileUri, {
          mimeType,
          dialogTitle: `Save or Share Fleet Report (${format})`,
          UTI: 'public.comma-separated-values-text',
        });
      }

      setExporting(false);
      setDone(true);
      setTimeout(() => { setDone(false); onClose(); }, 2000);
    } catch (err) {
      setExporting(false);
      Alert.alert('Export Failed', 'Could not generate the file. Please try again.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.overlayBg} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Export Data</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={Colors.textSecondary} /></TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {done ? (
              <View style={styles.successState}>
                <Ionicons name="checkmark-circle" size={56} color={Colors.success} />
                <Text style={styles.successTitle}>Export Ready!</Text>
                <Text style={styles.successSub}>Your {format} file has been generated and saved to your device.</Text>
              </View>
            ) : (
              <>
                <Text style={styles.subSection}>File Format</Text>
                <View style={styles.segRow}>
                  {EXPORT_FORMATS.map((f) => (
                    <TouchableOpacity key={f} style={[styles.segChip, format === f && styles.segChipActive]} onPress={() => setFormat(f)}>
                      <Text style={[styles.segChipText, format === f && styles.segChipTextActive]}>{f}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.subSection}>Include Data</Text>
                <View style={styles.checkGrid}>
                  {EXPORT_DATASETS.map((d) => {
                    const on = datasets.includes(d);
                    return (
                      <TouchableOpacity key={d} style={[styles.checkChip, on && styles.checkChipActive]} onPress={() => toggle(d)}>
                        <Ionicons name={on ? 'checkbox' : 'square-outline'} size={16} color={on ? Colors.primary : Colors.textMuted} />
                        <Text style={[styles.checkChipText, on && { color: Colors.primary }]}>{d}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.subSection}>Time Period</Text>
                <View style={styles.periodWrap}>
                  {EXPORT_PERIODS.map((p) => (
                    <TouchableOpacity key={p} style={[styles.periodChip, period === p && styles.periodChipActive]} onPress={() => setPeriod(p)}>
                      <Text style={[styles.periodChipText, period === p && styles.periodChipTextActive]}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  style={[styles.saveBtn, (exporting || !datasets.length) && styles.saveBtnDisabled]}
                  onPress={handleExport}
                  disabled={exporting || !datasets.length}
                >
                  {exporting
                    ? <><ActivityIndicator color="#FFF" size="small" /><Text style={styles.saveBtnText}>Generating…</Text></>
                    : <><Ionicons name="download" size={18} color="#FFF" /><Text style={styles.saveBtnText}>Export {format}</Text></>}
                </TouchableOpacity>
                {!datasets.length && <Text style={styles.exportHint}>Select at least one dataset</Text>}
              </>
            )}
            <View style={{ height: 32 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Help & Support Sheet ─────────────────────────────────────────────────────

const FAQ_ITEMS = [
  { q: 'How do I add a new vehicle?',         a: 'Go to Settings → Vehicles and tap "Add New Vehicle". Fill in the plate, make, model, and year, then assign a driver.' },
  { q: 'Why is my vehicle showing Offline?',  a: "A vehicle shows Offline when its GPS device hasn't sent a location update in over 10 minutes. Check the device battery and signal strength in Device Management." },
  { q: 'How do geofence alerts work?',        a: 'Create a zone in the Geofences screen and enable entry/exit alerts. You\'ll get a push notification whenever a vehicle crosses the boundary.' },
  { q: 'How do I export trip reports?',       a: 'Go to Settings → Export Data to download Trips, Fuel Events, Alerts, or Accident Reports as PDF, Excel, or CSV.' },
];

function HelpSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [expanded, setExpanded] = useState<number | null>(null);

  const openLink = (url: string) => Linking.openURL(url).catch(() => {});

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.overlayBg} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Help & Support</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={Colors.textSecondary} /></TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.subSection}>Contact Support</Text>
            <View style={styles.group}>
              {[
                { icon: 'mail',         label: 'Email',     value: 'support@obt.zm',    url: 'mailto:support@obt.zm' },
                { icon: 'logo-whatsapp',label: 'WhatsApp',  value: '+260 97 1234 567',   url: 'whatsapp://send?phone=260971234567' },
                { icon: 'call',         label: 'Call',      value: '+260 21 1234 567',   url: 'tel:+26021 1234 567' },
              ].map((c, i) => (
                <React.Fragment key={c.label}>
                  {i > 0 && <Divider />}
                  <TouchableOpacity style={styles.contactRow} activeOpacity={0.7} onPress={() => openLink(c.url)}>
                    <View style={[styles.settingIcon, { backgroundColor: '#EEF6FF' }]}>
                      <Ionicons name={c.icon as any} size={18} color={Colors.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.contactAction}>{c.label}</Text>
                      <Text style={styles.contactValue}>{c.value}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                </React.Fragment>
              ))}
            </View>

            <Text style={[styles.subSection, { marginTop: Spacing.lg }]}>Frequently Asked Questions</Text>
            <View style={styles.group}>
              {FAQ_ITEMS.map((item, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <Divider />}
                  <TouchableOpacity
                    style={styles.faqRow}
                    onPress={() => setExpanded(expanded === i ? null : i)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.faqQ}>{item.q}</Text>
                    <Ionicons name={expanded === i ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                  {expanded === i && <Text style={styles.faqA}>{item.a}</Text>}
                </React.Fragment>
              ))}
            </View>

            <Text style={styles.supportHours}>Support hours: Mon–Fri, 08:00–17:00 CAT</Text>
            <View style={{ height: 32 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Terms & Privacy Sheet ────────────────────────────────────────────────────

const TERMS_TEXT = `TERMS OF SERVICE
Last updated: 1 January 2026

1. ACCEPTANCE OF TERMS
By accessing or using OBT MobileTracker ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.

2. USE OF SERVICE
OBT MobileTracker provides fleet tracking and management services for authorised organisations. You may only use the Service for lawful purposes and in accordance with these Terms.

3. ACCOUNT RESPONSIBILITY
You are responsible for all activity that occurs under your account. Keep your credentials confidential and notify us immediately of any unauthorised use at support@obt.zm.

4. DATA ACCURACY
GPS tracking data is provided on a best-effort basis. OBT Systems is not liable for inaccuracies in location data caused by poor signal, device faults, or network issues.

5. LIMITATION OF LIABILITY
To the maximum extent permitted by law, OBT Systems shall not be liable for any indirect, incidental, special, or consequential damages arising from use of the Service.

6. GOVERNING LAW
These Terms are governed by the laws of the Republic of Zambia.

7. CHANGES TO TERMS
We may update these Terms at any time. Continued use of the Service after changes constitutes acceptance of the new Terms.`;

const PRIVACY_TEXT = `PRIVACY POLICY
Last updated: 1 January 2026

1. INFORMATION WE COLLECT
We collect vehicle location data, trip records, fuel events, alert history, and account credentials necessary to provide the fleet management service.

2. HOW WE USE YOUR DATA
Your data is used to display fleet status, generate reports, and send configurable alerts. We do not sell your data to third parties.

3. DATA RETENTION
Location history is retained for 12 months. Trip records are retained for 3 years. You may request deletion at any time by contacting us.

4. SECURITY
We use industry-standard encryption (TLS 1.3) for all data in transit. Passwords are hashed using bcrypt with a minimum cost factor of 12.

5. YOUR RIGHTS
You have the right to access, correct, or delete your personal data. Contact privacy@obt.zm to exercise these rights. We will respond within 30 days.

6. COOKIES & ANALYTICS
The mobile application does not use advertising cookies. Crash analytics may collect anonymised device information to improve the Service.

7. CONTACT
For privacy concerns: privacy@obt.zm`;

function TermsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<'terms' | 'privacy'>('terms');

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.overlayBg} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { maxHeight: '88%' }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Legal</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={Colors.textSecondary} /></TouchableOpacity>
          </View>

          <View style={styles.legalTabs}>
            {(['terms', 'privacy'] as const).map((t) => (
              <TouchableOpacity key={t} style={[styles.legalTab, tab === t && styles.legalTabActive]} onPress={() => setTab(t)}>
                <Text style={[styles.legalTabText, tab === t && styles.legalTabTextActive]}>
                  {t === 'terms' ? 'Terms of Service' : 'Privacy Policy'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            <Text style={styles.legalText}>{tab === 'terms' ? TERMS_TEXT : PRIVACY_TEXT}</Text>
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Shared Field Component ───────────────────────────────────────────────────

function SheetField({
  label, icon, value, onChangeText, placeholder, keyboardType, autoCapitalize, error, secureTextEntry, onIconPress,
}: {
  label: string; icon: string; value: string;
  onChangeText: (v: string) => void; placeholder: string;
  keyboardType?: any; autoCapitalize?: any; error?: string;
  secureTextEntry?: boolean; onIconPress?: () => void;
}) {
  const IconEl = onIconPress
    ? <TouchableOpacity onPress={onIconPress}><Ionicons name={icon as any} size={16} color={Colors.textMuted} /></TouchableOpacity>
    : <Ionicons name={icon as any} size={16} color={Colors.textMuted} />;

  return (
    <View style={styles.sheetFieldGroup}>
      <Text style={styles.sheetFieldLabel}>{label}</Text>
      <View style={[styles.sheetInputWrap, !!error && styles.sheetInputWrapError]}>
        {IconEl}
        <TextInput
          style={styles.sheetInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          keyboardType={keyboardType ?? 'default'}
          autoCapitalize={autoCapitalize ?? 'words'}
          autoCorrect={false}
          secureTextEntry={secureTextEntry}
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
  const [showSecurity,   setShowSecurity]   = useState(false);
  const [showExport,     setShowExport]     = useState(false);
  const [showHelp,       setShowHelp]       = useState(false);
  const [showTerms,      setShowTerms]      = useState(false);

  const handleSignOut = () => { logout(); router.replace('/login'); };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>

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
                  <Text style={styles.driverInitials}>{driver.name.split(' ').map((n) => n[0]).join('')}</Text>
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

        {/* Devices */}
        <SectionHeader title="Devices" />
        <View style={styles.group}>
          <TouchableOpacity style={styles.settingRow} activeOpacity={0.7} onPress={() => router.push('/devices')}>
            <View style={[styles.settingIcon, { backgroundColor: '#EEF6FF' }]}>
              <Ionicons name="radio" size={18} color={Colors.accent} />
            </View>
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Device Management</Text>
              <Text style={styles.settingSub}>GPS trackers, fuel sensors & more</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Account */}
        <SectionHeader title="Account" />
        <View style={styles.group}>
          <SettingRow icon="shield-checkmark" label="Security & Privacy"      onPress={() => setShowSecurity(true)} />
          <Divider />
          <SettingRow icon="download"         label="Export Data"             onPress={() => setShowExport(true)} />
          <Divider />
          <SettingRow icon="help-circle"      label="Help & Support"          onPress={() => setShowHelp(true)} />
          <Divider />
          <SettingRow icon="document-text"    label="Terms & Privacy Policy"  onPress={() => setShowTerms(true)} />
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

      {/* ── Modals ── */}
      <AddDriverSheet  visible={showAddDriver}  onClose={() => setShowAddDriver(false)}  onSave={addDriver} />
      <AddVehicleSheet visible={showAddVehicle} onClose={() => setShowAddVehicle(false)} onSave={addVehicle} drivers={drivers} />
      <SecuritySheet   visible={showSecurity}   onClose={() => setShowSecurity(false)} />
      <ExportSheet     visible={showExport}      onClose={() => setShowExport(false)} />
      <HelpSheet       visible={showHelp}        onClose={() => setShowHelp(false)} />
      <TermsSheet      visible={showTerms}       onClose={() => setShowTerms(false)} />
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

function ToggleRow({ icon, label, sub, value, onChange }: { icon: any; label: string; sub: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingIcon}><Ionicons name={icon} size={18} color={Colors.primary} /></View>
      <View style={styles.settingText}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingSub}>{sub}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: Colors.border, true: Colors.accent }} thumbColor={Colors.textLight} />
    </View>
  );
}

function SettingRow({ icon, label, onPress }: { icon: any; label: string; onPress?: () => void }) {
  return (
    <TouchableOpacity style={styles.settingRow} activeOpacity={0.7} onPress={onPress}>
      <View style={styles.settingIcon}><Ionicons name={icon} size={18} color={Colors.primary} /></View>
      <Text style={[styles.settingLabel, { flex: 1 }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.backgroundLight },
  content: { padding: Spacing.md },

  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.primary, borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: Spacing.md, ...Shadow.md,
  },
  avatar:         { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textLight },
  orgName:        { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textLight },
  orgEmail:       { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  planBadge:      { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 6 },
  planText:       { fontSize: FontSize.xs, color: Colors.textLight, fontWeight: '600' },

  sectionHeader: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginTop: Spacing.md, marginBottom: Spacing.xs, paddingHorizontal: Spacing.xs },
  group:         { backgroundColor: Colors.cardBackground, borderRadius: Radius.md, overflow: 'hidden', ...Shadow.sm },
  divider:       { height: 1, backgroundColor: Colors.divider, marginLeft: 52 },

  settingRow:  { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.sm },
  settingIcon: { width: 34, height: 34, borderRadius: Radius.sm, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  settingText: { flex: 1 },
  settingLabel:{ fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: '500' },
  settingSub:  { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },

  driverRow:    { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.sm },
  driverAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  driverInitials:{ color: Colors.textLight, fontSize: FontSize.sm, fontWeight: '800' },
  driverInfo:   { flex: 1 },
  driverName:   { fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary },
  driverMeta:   { fontSize: FontSize.xs, color: Colors.textSecondary },

  statusPip: { width: 10, height: 10, borderRadius: 5 },
  addRow:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md },
  addText:   { fontSize: FontSize.md, color: Colors.accent, fontWeight: '600' },

  signOutBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.md },
  signOutText: { fontSize: FontSize.md, color: Colors.danger, fontWeight: '700' },
  version:     { textAlign: 'center', fontSize: FontSize.xs, color: Colors.textMuted, marginTop: Spacing.lg },

  // ── Modal / Sheet ────────────────────────────────────────────────────────────
  overlay:   { flex: 1, justifyContent: 'flex-end' },
  overlayBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: Colors.cardBackground,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: Spacing.md, maxHeight: '90%',
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginTop: 10, marginBottom: 8 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm, marginBottom: Spacing.sm },
  sheetTitle:  { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textPrimary },

  sheetFieldGroup:   { marginBottom: Spacing.md },
  sheetFieldLabel:   { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary, marginBottom: 6 },
  sheetInputWrap:    { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.sm, paddingHorizontal: 12, height: 44, backgroundColor: Colors.backgroundLight },
  sheetInputWrapError:{ borderColor: Colors.danger },
  sheetInputError:   { borderColor: Colors.danger },
  sheetInput:        { flex: 1, fontSize: FontSize.md, color: Colors.textPrimary, borderWidth: 0, height: 44, paddingHorizontal: 0 },
  fieldError:        { fontSize: FontSize.xs, color: Colors.danger, marginTop: 3 },

  chipScroll:       { flexDirection: 'row', marginBottom: 8 },
  chip:             { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.backgroundLight, marginRight: 6 },
  chipActive:       { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText:         { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  chipTextActive:   { color: Colors.textLight },

  sheetRow:     { flexDirection: 'row', gap: Spacing.sm },
  sheetRowItem: { flex: 1 },

  saveBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: Radius.md, height: 50, marginTop: Spacing.sm },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText:     { fontSize: FontSize.md, fontWeight: '800', color: Colors.textLight },

  // ── Security sheet ────────────────────────────────────────────────────────────
  subSection: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm },
  sessionRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.sm },
  currentBadge:     { backgroundColor: '#EEF2FF', borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  currentBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.primary },
  dangerOutlineBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: Colors.danger, borderRadius: Radius.md, height: 46, marginTop: Spacing.sm, marginBottom: 8 },
  dangerOutlineBtnText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.danger },

  // ── Export sheet ──────────────────────────────────────────────────────────────
  segRow:             { flexDirection: 'row', gap: 8, marginBottom: Spacing.md },
  segChip:            { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: Radius.sm, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.backgroundLight },
  segChipActive:      { backgroundColor: Colors.primary, borderColor: Colors.primary },
  segChipText:        { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary },
  segChipTextActive:  { color: Colors.textLight },
  checkGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.md },
  checkChip:          { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.sm, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.backgroundLight },
  checkChipActive:    { borderColor: Colors.primary, backgroundColor: '#EEF2FF' },
  checkChipText:      { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  periodWrap:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.md },
  periodChip:         { paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.sm, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.backgroundLight },
  periodChipActive:   { backgroundColor: Colors.primary, borderColor: Colors.primary },
  periodChipText:     { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  periodChipTextActive:{ color: Colors.textLight },
  exportHint:         { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', marginTop: 6 },
  successState:       { alignItems: 'center', paddingVertical: 32, gap: 12 },
  successTitle:       { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textPrimary },
  successSub:         { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: 16 },

  // ── Help sheet ────────────────────────────────────────────────────────────────
  contactRow:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md },
  contactAction: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  contactValue:  { fontSize: FontSize.xs, color: Colors.textSecondary },
  faqRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md, gap: 8 },
  faqQ:          { fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary, flex: 1 },
  faqA:          { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
  supportHours:  { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.md, marginBottom: 8 },

  // ── Terms sheet ───────────────────────────────────────────────────────────────
  legalTabs:         { flexDirection: 'row', borderRadius: Radius.sm, backgroundColor: Colors.backgroundLight, padding: 3, marginBottom: Spacing.md },
  legalTab:          { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: Radius.sm - 2 },
  legalTabActive:    { backgroundColor: Colors.cardBackground, ...Shadow.sm },
  legalTabText:      { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textMuted },
  legalTabTextActive:{ color: Colors.textPrimary },
  legalText:         { fontSize: 13, color: Colors.textSecondary, lineHeight: 22, padding: Spacing.sm },
});
