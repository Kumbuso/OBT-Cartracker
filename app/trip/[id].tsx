import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { mockTrips } from '../../data/mockData';
import { Colors, Spacing, Radius, FontSize, Shadow } from '../../constants/theme';

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}

export default function TripDetailScreen() {
  const { id }  = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const trip    = mockTrips.find((t) => t.id === id);

  if (!trip) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.notFound}>
          <Ionicons name="navigate-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.notFoundText}>Trip not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isActive = trip.endTime === null;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <View style={styles.heroBadgeRow}>
            <View style={styles.plateBadge}>
              <Ionicons name="car" size={14} color={Colors.textLight} />
              <Text style={styles.plateBadgeText}>{trip.vehiclePlate}</Text>
            </View>
            <View style={[styles.statusPill, isActive ? styles.statusPillActive : styles.statusPillDone]}>
              <View style={[styles.statusDot, { backgroundColor: isActive ? Colors.statusActive : Colors.textMuted }]} />
              <Text style={[styles.statusText, { color: isActive ? Colors.statusActive : Colors.textMuted }]}>
                {isActive ? 'In Progress' : 'Completed'}
              </Text>
            </View>
          </View>

          <View style={styles.routeViz}>
            <View style={styles.routeStop}>
              <View style={[styles.routeCircle, { backgroundColor: Colors.statusActive }]} />
              <View style={styles.routeStopInfo}>
                <Text style={styles.routeStopLabel}>ORIGIN</Text>
                <Text style={styles.routeStopAddr}>{trip.startLocation.address ?? 'Start Location'}</Text>
                <Text style={styles.routeStopTime}>{formatDateTime(trip.startTime)}</Text>
              </View>
            </View>
            <View style={styles.routeConnector}>
              <View style={styles.routeLine} />
              <View style={styles.distancePill}>
                <Ionicons name="navigate" size={11} color={Colors.accent} />
                <Text style={styles.distanceText}>{trip.distance.toFixed(1)} km</Text>
              </View>
              <View style={styles.routeLine} />
            </View>
            <View style={styles.routeStop}>
              <View style={[styles.routeCircle, { backgroundColor: isActive ? Colors.textMuted : Colors.danger }]} />
              <View style={styles.routeStopInfo}>
                <Text style={styles.routeStopLabel}>DESTINATION</Text>
                <Text style={styles.routeStopAddr}>
                  {isActive ? 'In progress...' : (trip.endLocation?.address ?? 'End Location')}
                </Text>
                {trip.endTime && (
                  <Text style={styles.routeStopTime}>{formatDateTime(trip.endTime)}</Text>
                )}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatBox icon="time" label="Duration" value={formatDuration(trip.duration)} color={Colors.accent} />
          <StatBox icon="speedometer" label="Max Speed" value={`${trip.maxSpeed} km/h`} color={Colors.danger} />
          <StatBox icon="trending-up" label="Avg Speed" value={`${trip.avgSpeed} km/h`} color={Colors.primaryLight} />
          <StatBox icon="flame" label="Fuel Used" value={`${trip.fuelUsed.toFixed(1)} L`} color={Colors.warning} />
        </View>

        <Text style={styles.sectionTitle}>Driver</Text>
        <View style={styles.driverCard}>
          <View style={styles.driverAvatar}>
            <Text style={styles.driverInitials}>
              {trip.driverName.split(' ').map((n) => n[0]).join('')}
            </Text>
          </View>
          <View>
            <Text style={styles.driverName}>{trip.driverName}</Text>
            <Text style={styles.driverSub}>ID: {trip.driverId.toUpperCase()}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Performance Summary</Text>
        <View style={styles.summaryCard}>
          <SummaryRow label="Trip Distance" value={`${trip.distance.toFixed(2)} km`} />
          <SummaryDivider />
          <SummaryRow label="Trip Duration" value={formatDuration(trip.duration)} />
          <SummaryDivider />
          <SummaryRow label="Maximum Speed" value={`${trip.maxSpeed} km/h`} highlight={trip.maxSpeed > 100} />
          <SummaryDivider />
          <SummaryRow label="Average Speed" value={`${trip.avgSpeed} km/h`} />
          <SummaryDivider />
          <SummaryRow label="Fuel Consumed" value={`${trip.fuelUsed.toFixed(1)} L`} />
          <SummaryDivider />
          <SummaryRow
            label="Efficiency"
            value={`${(trip.distance / trip.fuelUsed).toFixed(1)} km/L`}
          />
        </View>

        {/* Replay button */}
        {trip.route && trip.route.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Trip Replay</Text>
            <TouchableOpacity
              style={styles.replayCard}
              onPress={() => router.push(`/trip/replay/${trip.id}` as any)}
              activeOpacity={0.85}
            >
              <View style={styles.replayIconWrap}>
                <Ionicons name="play-circle" size={28} color={Colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.replayTitle}>Watch Route Replay</Text>
                <Text style={styles.replaySub}>
                  {trip.route.length} GPS points  ·  {trip.distance.toFixed(1)} km  ·  Max {trip.maxSpeed} km/h
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StatBox({ icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <View style={styles.statBox}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SummaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, highlight && styles.summaryHighlight]}>{value}</Text>
    </View>
  );
}

function SummaryDivider() {
  return <View style={styles.summaryDivider} />;
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
  heroBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  plateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  plateBadgeText: {
    color: Colors.textLight,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  statusPillActive: { backgroundColor: 'rgba(45,198,83,0.2)' },
  statusPillDone: { backgroundColor: 'rgba(255,255,255,0.15)' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: FontSize.xs, fontWeight: '700' },
  routeViz: { gap: 0 },
  routeStop: { flexDirection: 'row', gap: Spacing.sm },
  routeCircle: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  routeStopInfo: { flex: 1, paddingBottom: 4 },
  routeStopLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  routeStopAddr: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textLight, marginTop: 2 },
  routeStopTime: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  routeConnector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 5,
    marginVertical: 3,
    gap: 4,
  },
  routeLine: { width: 2, height: 16, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 1 },
  distancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  distanceText: { fontSize: FontSize.xs, color: Colors.accent, fontWeight: '700' },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statBox: {
    width: '47%',
    backgroundColor: Colors.cardBackground,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 4,
    ...Shadow.sm,
  },
  statValue: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textPrimary },
  statLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
    marginTop: Spacing.xs,
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.cardBackground,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadow.sm,
  },
  driverAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverInitials: { color: Colors.textLight, fontSize: FontSize.md, fontWeight: '800' },
  driverName: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  driverSub: { fontSize: FontSize.xs, color: Colors.textSecondary },
  summaryCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: Radius.md,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
  },
  summaryLabel: { fontSize: FontSize.md, color: Colors.textSecondary },
  summaryValue: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  summaryHighlight: { color: Colors.danger },
  summaryDivider: { height: 1, backgroundColor: Colors.divider },

  // Replay
  replayCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.cardBackground,
    borderRadius: Radius.md, padding: Spacing.md,
    borderWidth: 1.5, borderColor: Colors.accent + '30',
    ...Shadow.sm,
  },
  replayIconWrap: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.accent + '12',
    alignItems: 'center', justifyContent: 'center',
  },
  replayTitle: { fontSize: FontSize.md, fontWeight: '800', color: Colors.textPrimary },
  replaySub:   { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 3 },
});
