import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import StatusBadge from '../../components/StatusBadge';
import { mockVehicles, mockTrips, mockAlerts, mockFuelEvents } from '../../data/mockData';
import { Colors, Spacing, Radius, FontSize, Shadow } from '../../constants/theme';

export default function VehicleDetailScreen() {
  const { id }  = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const vehicle = mockVehicles.find((v) => v.id === id);

  const [callLoading, setCallLoading] = useState(false);

  // ── Mileage state ────────────────────────────────────────────────────────────
  const [mileage, setMileage] = useState({
    odometer:         vehicle?.odometer ?? 0,
    serviceIntervalKm: 10000,
    lastServiceKm:    Math.max(0, (vehicle?.odometer ?? 0) - 3500),
    dailyLimitKm:     250,
    monthlyTargetKm:  4000,
  });
  const [showMileageSheet, setShowMileageSheet] = useState(false);
  const [draft, setDraft] = useState(mileage);

  const openMileageSheet = () => {
    setDraft(mileage);
    setShowMileageSheet(true);
  };
  const saveMileage = () => {
    const parsed = {
      odometer:          Math.max(0, parseInt(String(draft.odometer),          10) || 0),
      serviceIntervalKm: Math.max(1, parseInt(String(draft.serviceIntervalKm), 10) || 10000),
      lastServiceKm:     Math.max(0, parseInt(String(draft.lastServiceKm),     10) || 0),
      dailyLimitKm:      Math.max(1, parseInt(String(draft.dailyLimitKm),      10) || 250),
      monthlyTargetKm:   Math.max(1, parseInt(String(draft.monthlyTargetKm),   10) || 4000),
    };
    setMileage(parsed);
    setShowMileageSheet(false);
  };

  if (!vehicle) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.notFound}>
          <Ionicons name="car-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.notFoundText}>Vehicle not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const vehicleTrips      = mockTrips.filter((t) => t.vehicleId === id).slice(0, 3);
  const vehicleAlerts     = mockAlerts.filter((a) => a.vehicleId === id);
  const vehicleFuelEvents = mockFuelEvents.filter((f) => f.vehicleId === id);

  // ── Contact helpers ─────────────────────────────────────────────────────────

  const dialDriver = async () => {
    if (!vehicle.driver?.phone) return;
    const raw = vehicle.driver.phone.replace(/\s/g, '');
    const url = `tel:${raw}`;
    setCallLoading(true);
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Cannot Call', 'Phone calls are not available on this device.');
      }
    } catch {
      Alert.alert('Error', 'Unable to initiate call. Please try again.');
    } finally {
      setCallLoading(false);
    }
  };

  const smsDriver = async () => {
    if (!vehicle.driver?.phone) return;
    const raw = vehicle.driver.phone.replace(/\s/g, '');
    await Linking.openURL(`sms:${raw}`).catch(() =>
      Alert.alert('Cannot Message', 'SMS is not available on this device.')
    );
  };

  const whatsAppDriver = async () => {
    if (!vehicle.driver?.phone) return;
    // Strip leading + and spaces for WhatsApp
    const raw = vehicle.driver.phone.replace(/[\s+]/g, '');
    const url = `whatsapp://send?phone=${raw}&text=Hi ${vehicle.driver.name}, this is a message from fleet management regarding vehicle ${vehicle.plate}.`;
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert('WhatsApp Not Found', 'Please install WhatsApp to use this feature.');
    }
  };

  const sendAlert = () => {
    Alert.alert(
      'Send Alert to Driver',
      `Alert ${vehicle.driver?.name ?? 'driver'} about vehicle ${vehicle.plate}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call Now',
          onPress: dialDriver,
        },
        {
          text: 'Send SMS',
          onPress: smsDriver,
        },
      ]
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>

        {/* Hero card */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.vehicleIcon}>
              <Ionicons name="car" size={36} color={Colors.textLight} />
            </View>
            <View style={styles.heroInfo}>
              <Text style={styles.heroPlate}>{vehicle.plate}</Text>
              <Text style={styles.heroModel}>
                {vehicle.year} {vehicle.make} {vehicle.model}
              </Text>
              <StatusBadge status={vehicle.status} />
            </View>
          </View>
          {vehicle.location.address && (
            <View style={styles.heroLocation}>
              <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.7)" />
              <Text style={styles.heroAddr}>{vehicle.location.address}</Text>
            </View>
          )}
        </View>

        {/* Live metrics */}
        <View style={styles.metricsRow}>
          <MetricBox icon="speedometer"  value={`${vehicle.speed}`}                 unit="km/h" label="Speed"    color={Colors.accent} />
          <MetricBox icon="water"        value={`${vehicle.fuelLevel}`}             unit="%"    label="Fuel"     color={vehicle.fuelLevel < 25 ? Colors.danger : Colors.statusActive} />
          <MetricBox icon="analytics"    value={(mileage.odometer / 1000).toFixed(1)} unit="k km" label="Odometer" color={Colors.primaryLight} />
        </View>

        {/* Driver info card */}
        <SectionTitle title="Driver & Engine" />
        <View style={styles.card}>
          <InfoRow icon="power"    label="Engine"          value={vehicle.engineOn ? 'Running' : 'Off'} valueColor={vehicle.engineOn ? Colors.statusActive : Colors.textSecondary} />
          <CardDivider />
          <InfoRow icon="person"   label="Assigned Driver" value={vehicle.driver?.name ?? 'Unassigned'} />
          {vehicle.driver && (
            <>
              <CardDivider />
              <InfoRow icon="call"  label="Driver Phone"   value={vehicle.driver.phone} />
              <CardDivider />
              <InfoRow icon="card"  label="License"        value={vehicle.driver.licenseNumber} />
            </>
          )}
          <CardDivider />
          <InfoRow icon="layers"   label="Fleet Group"     value={vehicle.groupId.toUpperCase()} />
        </View>

        {/* ── Push-to-Contact actions ──────────────────────── */}
        {vehicle.driver && (
          <>
            <SectionTitle title="Contact Driver" />
            <View style={styles.contactCard}>
              <View style={styles.driverRow}>
                <View style={styles.driverAvatar}>
                  <Text style={styles.driverInitials}>
                    {vehicle.driver.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                  </Text>
                </View>
                <View style={styles.driverMeta}>
                  <Text style={styles.driverName}>{vehicle.driver.name}</Text>
                  <Text style={styles.driverPhone}>{vehicle.driver.phone}</Text>
                </View>
                <TouchableOpacity style={styles.alertBtn} onPress={sendAlert}>
                  <Ionicons name="megaphone-outline" size={18} color={Colors.warning} />
                </TouchableOpacity>
              </View>

              {/* Action buttons */}
              <View style={styles.actionRow}>
                {/* Call — primary action */}
                <TouchableOpacity
                  style={[styles.callBtn, callLoading && styles.callBtnDisabled]}
                  onPress={dialDriver}
                  activeOpacity={0.85}
                  disabled={callLoading}
                >
                  <View style={styles.callIconRing}>
                    <Ionicons name="call" size={22} color="#FFF" />
                  </View>
                  <Text style={styles.callBtnText}>Call Driver</Text>
                  <Text style={styles.callBtnSub}>Tap to dial</Text>
                </TouchableOpacity>

                {/* Secondary: SMS + WhatsApp */}
                <View style={styles.secondaryActions}>
                  <TouchableOpacity style={styles.secondaryBtn} onPress={smsDriver}>
                    <Ionicons name="chatbubble-outline" size={20} color={Colors.accent} />
                    <Text style={styles.secondaryBtnText}>SMS</Text>
                  </TouchableOpacity>
                  <View style={styles.secondaryDivider} />
                  <TouchableOpacity style={styles.secondaryBtn} onPress={whatsAppDriver}>
                    <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
                    <Text style={styles.secondaryBtnText}>WhatsApp</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </>
        )}

        {/* ── Mileage Settings ─────────────────────────────── */}
        {(() => {
          const nextServiceKm  = mileage.lastServiceKm + mileage.serviceIntervalKm;
          const kmToService    = nextServiceKm - mileage.odometer;
          const pct            = Math.min(1, Math.max(0, (mileage.odometer - mileage.lastServiceKm) / mileage.serviceIntervalKm));
          const overdue        = kmToService <= 0;
          const urgent         = !overdue && pct >= 0.85;
          const barColor       = overdue ? Colors.danger : urgent ? Colors.warning : Colors.statusActive;

          return (
            <>
              <SectionTitle title="Mileage Settings" />
              <View style={styles.mileageCard}>

                {/* Card header */}
                <View style={styles.mileageHeader}>
                  <View style={styles.mileageHeaderLeft}>
                    <View style={styles.mileageIconBg}>
                      <Ionicons name="speedometer" size={16} color={Colors.accent} />
                    </View>
                    <Text style={styles.mileageCardTitle}>Odometer &amp; Service</Text>
                  </View>
                  <TouchableOpacity style={styles.editBtn} onPress={openMileageSheet}>
                    <Ionicons name="create-outline" size={15} color={Colors.accent} />
                    <Text style={styles.editBtnText}>Edit</Text>
                  </TouchableOpacity>
                </View>

                {/* Odometer row */}
                <View style={styles.mlRow}>
                  <View style={[styles.mlIconBg, { backgroundColor: Colors.accent + '14' }]}>
                    <Ionicons name="analytics-outline" size={16} color={Colors.accent} />
                  </View>
                  <Text style={styles.mlLabel}>Current Odometer</Text>
                  <Text style={styles.mlValue}>{mileage.odometer.toLocaleString()} km</Text>
                </View>
                <View style={styles.mlDivider} />

                {/* Next service row + progress bar */}
                <View style={styles.mlRow}>
                  <View style={[styles.mlIconBg, { backgroundColor: barColor + '14' }]}>
                    <Ionicons name="construct-outline" size={16} color={barColor} />
                  </View>
                  <View style={styles.mlServiceBlock}>
                    <View style={styles.mlServiceTop}>
                      <Text style={styles.mlLabel}>Next Service</Text>
                      {overdue ? (
                        <View style={styles.overdueBadge}>
                          <Text style={styles.overdueBadgeText}>OVERDUE</Text>
                        </View>
                      ) : (
                        <Text style={[styles.mlValue, { color: barColor }]}>
                          {kmToService > 0 ? `${kmToService.toLocaleString()} km left` : 'Due now'}
                        </Text>
                      )}
                    </View>
                    {/* Progress bar */}
                    <View style={styles.serviceBarBg}>
                      <View style={[styles.serviceBarFill, { width: `${Math.round(pct * 100)}%` as any, backgroundColor: barColor }]} />
                    </View>
                    <Text style={styles.serviceBarHint}>
                      {overdue
                        ? `${Math.abs(kmToService).toLocaleString()} km past service due`
                        : `${nextServiceKm.toLocaleString()} km threshold  ·  ${mileage.serviceIntervalKm.toLocaleString()} km interval`}
                    </Text>
                  </View>
                </View>
                <View style={styles.mlDivider} />

                {/* Daily limit row */}
                <View style={styles.mlRow}>
                  <View style={[styles.mlIconBg, { backgroundColor: Colors.info + '14' }]}>
                    <Ionicons name="today-outline" size={16} color={Colors.info} />
                  </View>
                  <Text style={styles.mlLabel}>Daily Limit</Text>
                  <Text style={styles.mlValue}>{mileage.dailyLimitKm.toLocaleString()} km/day</Text>
                </View>
                <View style={styles.mlDivider} />

                {/* Monthly target row */}
                <View style={styles.mlRow}>
                  <View style={[styles.mlIconBg, { backgroundColor: '#8B5CF6' + '14' }]}>
                    <Ionicons name="calendar-outline" size={16} color="#8B5CF6" />
                  </View>
                  <Text style={styles.mlLabel}>Monthly Target</Text>
                  <Text style={styles.mlValue}>{mileage.monthlyTargetKm.toLocaleString()} km/mo</Text>
                </View>

              </View>

              {/* ── Mileage edit sheet ──────────────────────── */}
              <Modal
                visible={showMileageSheet}
                animationType="slide"
                transparent
                onRequestClose={() => setShowMileageSheet(false)}
              >
                <KeyboardAvoidingView
                  style={styles.sheetOverlay}
                  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                  <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setShowMileageSheet(false)} />
                  <View style={styles.sheet}>
                    {/* Sheet header */}
                    <View style={styles.sheetHeader}>
                      <View style={styles.sheetHandle} />
                      <Text style={styles.sheetTitle}>Mileage Settings</Text>
                      <Text style={styles.sheetSub}>{vehicle.plate}  ·  {vehicle.make} {vehicle.model}</Text>
                    </View>

                    <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">

                      <MileageField
                        icon="analytics-outline" iconColor={Colors.accent}
                        label="Current Odometer"
                        hint="Adjust if tracker reading is off"
                        unit="km"
                        value={String(draft.odometer)}
                        onChange={(v) => setDraft((d) => ({ ...d, odometer: v as any }))}
                      />
                      <MileageField
                        icon="construct-outline" iconColor={Colors.warning}
                        label="Service Interval"
                        hint="Km between scheduled services"
                        unit="km"
                        value={String(draft.serviceIntervalKm)}
                        onChange={(v) => setDraft((d) => ({ ...d, serviceIntervalKm: v as any }))}
                      />
                      <MileageField
                        icon="checkmark-circle-outline" iconColor={Colors.statusActive}
                        label="Last Service At"
                        hint="Odometer reading at last service"
                        unit="km"
                        value={String(draft.lastServiceKm)}
                        onChange={(v) => setDraft((d) => ({ ...d, lastServiceKm: v as any }))}
                      />
                      <MileageField
                        icon="today-outline" iconColor={Colors.info}
                        label="Daily Limit"
                        hint="Alert when vehicle exceeds this per day"
                        unit="km/day"
                        value={String(draft.dailyLimitKm)}
                        onChange={(v) => setDraft((d) => ({ ...d, dailyLimitKm: v as any }))}
                      />
                      <MileageField
                        icon="calendar-outline" iconColor="#8B5CF6"
                        label="Monthly Target"
                        hint="Expected distance per month"
                        unit="km/mo"
                        value={String(draft.monthlyTargetKm)}
                        onChange={(v) => setDraft((d) => ({ ...d, monthlyTargetKm: v as any }))}
                      />

                      <View style={styles.sheetActions}>
                        <TouchableOpacity style={styles.sheetCancel} onPress={() => setShowMileageSheet(false)}>
                          <Text style={styles.sheetCancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.sheetSave} onPress={saveMileage}>
                          <Ionicons name="checkmark" size={16} color="#FFF" />
                          <Text style={styles.sheetSaveText}>Save Changes</Text>
                        </TouchableOpacity>
                      </View>

                    </ScrollView>
                  </View>
                </KeyboardAvoidingView>
              </Modal>
            </>
          );
        })()}

        {/* Recent Trips */}
        <SectionTitle title="Recent Trips" />
        {vehicleTrips.length > 0 ? (
          vehicleTrips.map((trip) => (
            <TouchableOpacity
              key={trip.id}
              style={styles.tripRow}
              onPress={() => router.push(`/trip/${trip.id}`)}
              activeOpacity={0.85}
            >
              <View style={styles.tripLeft}>
                <Ionicons
                  name={trip.endTime ? 'checkmark-circle' : 'radio-button-on'}
                  size={20}
                  color={trip.endTime ? Colors.statusActive : Colors.accent}
                />
                <View>
                  <Text style={styles.tripDist}>{trip.distance.toFixed(1)} km</Text>
                  <Text style={styles.tripTime}>{new Date(trip.startTime).toLocaleDateString()}</Text>
                </View>
              </View>
              <View style={styles.tripRight}>
                <Text style={styles.tripDriver}>{trip.driverName}</Text>
                <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <Text style={styles.emptyNote}>No trips recorded for this vehicle</Text>
        )}

        {/* Fuel History */}
        <SectionTitle title="Fuel History" />
        {vehicleFuelEvents.length > 0 ? (
          vehicleFuelEvents.map((ev) => (
            <View key={ev.id} style={styles.fuelRow}>
              <View style={[styles.fuelDot, { backgroundColor: ev.type === 'refuel' ? Colors.statusActive : Colors.textMuted }]} />
              <View style={styles.fuelInfo}>
                <Text style={styles.fuelEventTitle}>
                  {ev.type === 'refuel' ? `+${ev.liters}L refuelled` : `-${ev.liters}L consumed`}
                  {ev.cost != null ? `  ·  K${ev.cost.toLocaleString()}` : ''}
                </Text>
                {ev.station != null && <Text style={styles.fuelStation}>{ev.station}</Text>}
                <Text style={styles.fuelMeta}>{ev.odometer.toLocaleString()} km · {new Date(ev.timestamp).toLocaleDateString()}</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyNote}>No fuel events recorded</Text>
        )}

        {/* Active Alerts */}
        <SectionTitle title="Active Alerts" />
        {vehicleAlerts.filter((a) => !a.read).length > 0 ? (
          vehicleAlerts.filter((a) => !a.read).map((alert) => (
            <View key={alert.id} style={styles.alertRow}>
              <Ionicons
                name={alert.severity === 'critical' ? 'warning' : 'alert-circle'}
                size={18}
                color={alert.severity === 'critical' ? Colors.danger : Colors.warning}
              />
              <Text style={styles.alertMsg} numberOfLines={2}>{alert.message}</Text>
            </View>
          ))
        ) : (
          <View style={styles.noAlerts}>
            <Ionicons name="shield-checkmark-outline" size={24} color={Colors.statusActive} />
            <Text style={styles.noAlertsText}>No active alerts</Text>
          </View>
        )}

        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MetricBox({ icon, value, unit, label, color }: {
  icon: any; value: string; unit: string; label: string; color: string;
}) {
  return (
    <View style={styles.metricBox}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={styles.metricValue}>
        {value}<Text style={styles.metricUnit}> {unit}</Text>
      </Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function InfoRow({ icon, label, value, valueColor }: {
  icon: any; label: string; value: string; valueColor?: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={16} color={Colors.primary} />
      </View>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, valueColor ? { color: valueColor } : {}]}>{value}</Text>
    </View>
  );
}

function CardDivider() {
  return <View style={styles.cardDivider} />;
}

function MileageField({ icon, iconColor, label, hint, unit, value, onChange }: {
  icon: any; iconColor: string; label: string; hint: string;
  unit: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <View style={styles.mlField}>
      <View style={styles.mlFieldTop}>
        <View style={[styles.mlFieldIcon, { backgroundColor: iconColor + '14' }]}>
          <Ionicons name={icon} size={15} color={iconColor} />
        </View>
        <View style={styles.mlFieldMeta}>
          <Text style={styles.mlFieldLabel}>{label}</Text>
          <Text style={styles.mlFieldHint}>{hint}</Text>
        </View>
        <Text style={styles.mlFieldUnit}>{unit}</Text>
      </View>
      <TextInput
        style={styles.mlFieldInput}
        value={value}
        onChangeText={onChange}
        keyboardType="numeric"
        placeholder="0"
        placeholderTextColor={Colors.textMuted}
        selectTextOnFocus
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: Colors.backgroundLight },
  content:      { padding: Spacing.md },
  notFound:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  notFoundText: { fontSize: FontSize.lg, color: Colors.textSecondary },

  // Hero
  heroCard: {
    backgroundColor: Colors.primary, borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: Spacing.md, ...Shadow.md,
  },
  heroTop:      { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  vehicleIcon:  {
    width: 64, height: 64, borderRadius: Radius.md,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroInfo:     { flex: 1, gap: 4 },
  heroPlate:    { fontSize: FontSize.xxl, fontWeight: '900', color: Colors.textLight },
  heroModel:    { fontSize: FontSize.md, color: 'rgba(255,255,255,0.8)' },
  heroLocation: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: Spacing.sm, paddingTop: Spacing.sm,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)',
  },
  heroAddr: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.7)' },

  // Metrics
  metricsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  metricBox:  {
    flex: 1, backgroundColor: Colors.cardBackground, borderRadius: Radius.md,
    padding: Spacing.sm, alignItems: 'center', gap: 3, ...Shadow.sm,
  },
  metricValue: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textPrimary },
  metricUnit:  { fontSize: FontSize.sm, fontWeight: '400', color: Colors.textSecondary },
  metricLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },

  // Section
  sectionTitle: {
    fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary,
    marginTop: Spacing.sm, marginBottom: Spacing.xs,
  },

  // Info card
  card:       { backgroundColor: Colors.cardBackground, borderRadius: Radius.md, marginBottom: Spacing.sm, overflow: 'hidden', ...Shadow.sm },
  infoRow:    { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.sm },
  infoIcon:   {
    width: 30, height: 30, borderRadius: Radius.sm,
    backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center',
  },
  infoLabel:   { flex: 1, fontSize: FontSize.md, color: Colors.textSecondary },
  infoValue:   { fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary },
  cardDivider: { height: 1, backgroundColor: Colors.divider, marginLeft: 56 },

  // ── Contact card ──────────────────────────────────────
  contactCard: {
    backgroundColor: Colors.cardBackground, borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: Spacing.sm,
    ...Shadow.sm,
  },
  driverRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  driverAvatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  driverInitials: { fontSize: 14, fontWeight: '800', color: '#FFF' },
  driverMeta:     { flex: 1 },
  driverName:     { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  driverPhone:    { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 1 },

  alertBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.warning + '18',
    alignItems: 'center', justifyContent: 'center',
  },

  actionRow: { flexDirection: 'row', gap: 10 },

  // Primary call button
  callBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.statusActive, borderRadius: Radius.md,
    padding: 12, gap: 10,
    ...Shadow.md,
    shadowColor: Colors.statusActive,
  },
  callBtnDisabled: { opacity: 0.6 },
  callIconRing: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  callBtnText: { fontSize: 15, fontWeight: '800', color: '#FFF', flex: 1 },
  callBtnSub:  { fontSize: 10, color: 'rgba(255,255,255,0.65)' },

  // Secondary actions
  secondaryActions: {
    flex: 0,
    backgroundColor: Colors.backgroundLight, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
  },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  secondaryBtnText: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  secondaryDivider: { height: 1, backgroundColor: Colors.border },

  // Trips
  tripRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.cardBackground, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.xs, ...Shadow.sm,
  },
  tripLeft:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  tripDist:   { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  tripTime:   { fontSize: FontSize.xs, color: Colors.textSecondary },
  tripRight:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tripDriver: { fontSize: FontSize.sm, color: Colors.textSecondary },
  emptyNote:  { fontSize: FontSize.sm, color: Colors.textMuted, marginBottom: Spacing.sm },

  // Fuel
  fuelRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    backgroundColor: Colors.cardBackground, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.xs, ...Shadow.sm,
  },
  fuelDot:        { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  fuelInfo:       { flex: 1 },
  fuelEventTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  fuelStation:    { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },
  fuelMeta:       { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },

  // ── Mileage card ──────────────────────────────────────
  mileageCard: {
    backgroundColor: Colors.cardBackground, borderRadius: Radius.lg,
    marginBottom: Spacing.sm, overflow: 'hidden', ...Shadow.sm,
  },
  mileageHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  mileageHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mileageIconBg:     {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: Colors.accent + '14', alignItems: 'center', justifyContent: 'center',
  },
  mileageCardTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  editBtn:          { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.accent + '12', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  editBtnText:      { fontSize: 12, fontWeight: '700', color: Colors.accent },

  mlRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 12, gap: 10 },
  mlDivider: { height: 1, backgroundColor: Colors.divider, marginLeft: 52 },
  mlIconBg:  { width: 30, height: 30, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  mlLabel:   { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500' },
  mlValue:   { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },

  // Service block (has progress bar)
  mlServiceBlock: { flex: 1, gap: 5 },
  mlServiceTop:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  serviceBarBg:   { height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden' },
  serviceBarFill: { height: '100%', borderRadius: 3 },
  serviceBarHint: { fontSize: 10, color: Colors.textMuted },

  overdueBadge:     { backgroundColor: Colors.danger + '18', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  overdueBadgeText: { fontSize: 10, fontWeight: '800', color: Colors.danger, letterSpacing: 0.5 },

  // ── Mileage edit sheet ──────────────────────────────
  sheetOverlay:  { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: Colors.cardBackground,
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    maxHeight: '85%',
    ...Shadow.lg,
  },
  sheetHandle:  { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  sheetHeader:  { paddingHorizontal: Spacing.md, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  sheetTitle:   { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textPrimary, marginTop: 6 },
  sheetSub:     { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  sheetBody:    { padding: Spacing.md, gap: 10 },

  // Field inside sheet
  mlField:      { backgroundColor: Colors.backgroundLight, borderRadius: Radius.md, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  mlFieldTop:   { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 },
  mlFieldIcon:  { width: 28, height: 28, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  mlFieldMeta:  { flex: 1 },
  mlFieldLabel: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  mlFieldHint:  { fontSize: 10.5, color: Colors.textMuted, marginTop: 1 },
  mlFieldUnit:  { fontSize: 11, fontWeight: '600', color: Colors.textMuted },
  mlFieldInput: {
    height: 44, borderTopWidth: 1, borderTopColor: Colors.border,
    paddingHorizontal: 14, fontSize: 17, fontWeight: '700',
    color: Colors.textPrimary, backgroundColor: '#FFF',
  },

  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  sheetCancel:  {
    flex: 1, height: 48, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  sheetCancelText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textSecondary },
  sheetSave: {
    flex: 2, height: 48, borderRadius: Radius.md,
    backgroundColor: Colors.accent, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 7,
    ...Shadow.sm, shadowColor: Colors.accent,
  },
  sheetSaveText: { fontSize: FontSize.md, fontWeight: '800', color: '#FFF' },

  // Alerts
  alertRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    backgroundColor: Colors.cardBackground, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.xs, ...Shadow.sm,
  },
  alertMsg:     { flex: 1, fontSize: FontSize.sm, color: Colors.textPrimary },
  noAlerts:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm },
  noAlertsText: { fontSize: FontSize.md, color: Colors.statusActive, fontWeight: '600' },
});
