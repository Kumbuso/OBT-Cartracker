import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { mockTrips } from '../../data/mockData';
import { Colors, Spacing, Radius, FontSize, Shadow } from '../../constants/theme';
import type { Trip } from '../../types';

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function TripsScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  const filtered = mockTrips.filter((t) => {
    if (filter === 'active') return t.endTime === null;
    if (filter === 'completed') return t.endTime !== null;
    return true;
  });

  const sorted = [...filtered].sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.filterRow}>
        {(['all', 'active', 'completed'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterBtnText, filter === f && styles.filterBtnTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        style={{ flex: 1 }}
        data={sorted}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <TripCard trip={item} onPress={() => router.push(`/trip/${item.id}`)} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="navigate-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No trips found</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function TripCard({ trip, onPress }: { trip: Trip; onPress: () => void }) {
  const isActive = trip.endTime === null;
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.cardHeader}>
        <View style={styles.plateBadge}>
          <Ionicons name="car" size={14} color={Colors.primary} />
          <Text style={styles.plateBadgeText}>{trip.vehiclePlate}</Text>
        </View>
        <View style={[styles.statusPill, isActive ? styles.statusPillActive : styles.statusPillDone]}>
          <View style={[styles.statusDot, { backgroundColor: isActive ? Colors.statusActive : Colors.textMuted }]} />
          <Text style={[styles.statusPillText, { color: isActive ? Colors.statusActive : Colors.textMuted }]}>
            {isActive ? 'In Progress' : 'Completed'}
          </Text>
        </View>
      </View>

      <View style={styles.route}>
        <View style={styles.routePoint}>
          <View style={[styles.routeDot, { backgroundColor: Colors.statusActive }]} />
          <View style={styles.routeInfo}>
            <Text style={styles.routeLabel}>From</Text>
            <Text style={styles.routeAddr} numberOfLines={1}>{trip.startLocation.address ?? 'Start'}</Text>
            <Text style={styles.routeTime}>{formatTime(trip.startTime)} · {formatDate(trip.startTime)}</Text>
          </View>
        </View>
        <View style={styles.routeLine} />
        <View style={styles.routePoint}>
          <View style={[styles.routeDot, { backgroundColor: isActive ? Colors.textMuted : Colors.danger }]} />
          <View style={styles.routeInfo}>
            <Text style={styles.routeLabel}>To</Text>
            <Text style={styles.routeAddr} numberOfLines={1}>
              {isActive ? 'In progress...' : (trip.endLocation?.address ?? 'Destination')}
            </Text>
            {trip.endTime && <Text style={styles.routeTime}>{formatTime(trip.endTime)}</Text>}
          </View>
        </View>
      </View>

      <View style={styles.metrics}>
        <Metric icon="navigate-outline" value={`${trip.distance.toFixed(1)} km`} label="Distance" />
        <Metric icon="time-outline" value={formatDuration(trip.duration)} label="Duration" />
        <Metric icon="speedometer-outline" value={`${trip.maxSpeed} km/h`} label="Max Speed" />
        <Metric icon="person-outline" value={trip.driverName.split(' ')[0]} label="Driver" />
      </View>
    </TouchableOpacity>
  );
}

function Metric({ icon, value, label }: { icon: any; value: string; label: string }) {
  return (
    <View style={styles.metric}>
      <Ionicons name={icon} size={14} color={Colors.textSecondary} />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundLight },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    padding: Spacing.md,
    backgroundColor: Colors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: Radius.md,
    alignItems: 'center',
    backgroundColor: Colors.backgroundLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterBtnText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  filterBtnTextActive: {
    color: Colors.textLight,
  },
  list: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  empty: {
    alignItems: 'center' as const,
    paddingTop: 80,
    gap: Spacing.sm,
  },
  emptyText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadow.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  plateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  plateBadgeText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.primary,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  statusPillActive: { backgroundColor: '#E8FAF0' },
  statusPillDone: { backgroundColor: Colors.divider },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontSize: FontSize.xs, fontWeight: '600' },
  route: { gap: 0, marginBottom: Spacing.sm },
  routePoint: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 3,
  },
  routeLine: {
    width: 2,
    height: 14,
    backgroundColor: Colors.border,
    marginLeft: 4,
    marginVertical: 2,
  },
  routeInfo: { flex: 1, paddingBottom: 4 },
  routeLabel: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '600' },
  routeAddr: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: '600' },
  routeTime: { fontSize: FontSize.xs, color: Colors.textSecondary },
  metrics: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    paddingTop: Spacing.sm,
  },
  metric: { flex: 1, alignItems: 'center', gap: 2 },
  metricValue: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  metricLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
});
