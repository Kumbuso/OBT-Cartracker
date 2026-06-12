import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import StatusBadge from '../../components/StatusBadge';
import { mockVehicles, mockTrips, mockAlerts, mockFuelEvents } from '../../data/mockData';
import { Colors, Spacing, Radius, FontSize, Shadow } from '../../constants/theme';

export default function VehicleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const vehicle = mockVehicles.find((v) => v.id === id);

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

  const vehicleTrips = mockTrips.filter((t) => t.vehicleId === id).slice(0, 3);
  const vehicleAlerts = mockAlerts.filter((a) => a.vehicleId === id);
  const vehicleFuelEvents = mockFuelEvents.filter((f) => f.vehicleId === id);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
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

        <View style={styles.metricsRow}>
          <MetricBox icon="speedometer" value={`${vehicle.speed}`} unit="km/h" label="Speed" color={Colors.accent} />
          <MetricBox icon="water" value={`${vehicle.fuelLevel}`} unit="%" label="Fuel" color={vehicle.fuelLevel < 25 ? Colors.danger : Colors.statusActive} />
          <MetricBox icon="analytics" value={(vehicle.odometer / 1000).toFixed(1)} unit="k km" label="Odometer" color={Colors.primaryLight} />
        </View>

        <SectionTitle title="Engine Status" />
        <View style={styles.card}>
          <InfoRow icon="power" label="Engine" value={vehicle.engineOn ? 'Running' : 'Off'} valueColor={vehicle.engineOn ? Colors.statusActive : Colors.textSecondary} />
          <CardDivider />
          <InfoRow icon="person" label="Assigned Driver" value={vehicle.driver?.name ?? 'Unassigned'} />
          {vehicle.driver && (
            <>
              <CardDivider />
              <InfoRow icon="call" label="Driver Phone" value={vehicle.driver.phone} />
              <CardDivider />
              <InfoRow icon="card" label="License" value={vehicle.driver.licenseNumber} />
            </>
          )}
          <CardDivider />
          <InfoRow icon="layers" label="Fleet Group" value={vehicle.groupId.toUpperCase()} />
        </View>

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

        <SectionTitle title="Active Alerts" />
        {vehicleAlerts.filter((a) => !a.read).length > 0 ? (
          vehicleAlerts
            .filter((a) => !a.read)
            .map((alert) => (
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

function MetricBox({ icon, value, unit, label, color }: { icon: any; value: string; unit: string; label: string; color: string }) {
  return (
    <View style={styles.metricBox}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={styles.metricValue}>{value}<Text style={styles.metricUnit}> {unit}</Text></Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function InfoRow({ icon, label, value, valueColor }: { icon: any; label: string; value: string; valueColor?: string }) {
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundLight },
  content: { padding: Spacing.md },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  notFoundText: { fontSize: FontSize.lg, color: Colors.textSecondary },
  heroCard: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadow.md,
  },
  heroTop: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  vehicleIcon: {
    width: 64,
    height: 64,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInfo: { flex: 1, gap: 4 },
  heroPlate: { fontSize: FontSize.xxl, fontWeight: '900', color: Colors.textLight },
  heroModel: { fontSize: FontSize.md, color: 'rgba(255,255,255,0.8)' },
  heroLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  heroAddr: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.7)' },
  metricsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  metricBox: {
    flex: 1,
    backgroundColor: Colors.cardBackground,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    alignItems: 'center',
    gap: 3,
    ...Shadow.sm,
  },
  metricValue: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textPrimary },
  metricUnit: { fontSize: FontSize.sm, fontWeight: '400', color: Colors.textSecondary },
  metricLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  infoIcon: {
    width: 30,
    height: 30,
    borderRadius: Radius.sm,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: { flex: 1, fontSize: FontSize.md, color: Colors.textSecondary },
  infoValue: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary },
  cardDivider: { height: 1, backgroundColor: Colors.divider, marginLeft: 56 },
  tripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.cardBackground,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.xs,
    ...Shadow.sm,
  },
  tripLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  tripDist: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  tripTime: { fontSize: FontSize.xs, color: Colors.textSecondary },
  tripRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tripDriver: { fontSize: FontSize.sm, color: Colors.textSecondary },
  emptyNote: { fontSize: FontSize.sm, color: Colors.textMuted, marginBottom: Spacing.sm },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.cardBackground,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.xs,
    ...Shadow.sm,
  },
  alertMsg: { flex: 1, fontSize: FontSize.sm, color: Colors.textPrimary },
  noAlerts: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm },
  noAlertsText: { fontSize: FontSize.md, color: Colors.statusActive, fontWeight: '600' },
  fuelRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.cardBackground,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.xs,
    ...Shadow.sm,
  },
  fuelDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  fuelInfo: { flex: 1 },
  fuelEventTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  fuelStation: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },
  fuelMeta: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },
});
