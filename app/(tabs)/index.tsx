import React, { useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { mockFleetStats, mockVehicles, mockAlerts } from '../../data/mockData';
import { Colors, Spacing, Radius, FontSize, Shadow } from '../../constants/theme';
import type { Vehicle } from '../../types';

// ─────────────────────────────────────────────────────────────────────────────

function greet() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const STATUS_COLOR: Record<string, string> = {
  active:      Colors.statusActive,
  idle:        Colors.statusIdle,
  offline:     Colors.statusOffline,
  maintenance: Colors.statusMaintenance,
};

const ALERT_META: Record<string, { icon: string; color: string; bg: string }> = {
  critical: { icon: 'alert-circle',       color: Colors.danger,  bg: '#FEF2F2' },
  warning:  { icon: 'warning',            color: Colors.warning, bg: '#FFFBEB' },
  info:     { icon: 'information-circle', color: Colors.accent,  bg: '#EFF6FF' },
};

// ─── Fleet Status Bar ─────────────────────────────────────────────────────────

function FleetStatusBar({ vehicles }: { vehicles: Vehicle[] }) {
  const counts: Record<string, number> = {
    active:      vehicles.filter((v) => v.status === 'active').length,
    idle:        vehicles.filter((v) => v.status === 'idle').length,
    maintenance: vehicles.filter((v) => v.status === 'maintenance').length,
    offline:     vehicles.filter((v) => v.status === 'offline').length,
  };
  const segments = Object.entries(counts).filter(([, n]) => n > 0);

  return (
    <View style={styles.barWrap}>
      <View style={styles.bar}>
        {segments.map(([key, count], i) => (
          <View
            key={key}
            style={[
              styles.barSeg,
              { flex: count, backgroundColor: STATUS_COLOR[key] },
              i === 0 && { borderTopLeftRadius: 5, borderBottomLeftRadius: 5 },
              i === segments.length - 1 && { borderTopRightRadius: 5, borderBottomRightRadius: 5 },
            ]}
          />
        ))}
      </View>
      <View style={styles.barLegend}>
        {segments.map(([key, count]) => (
          <View key={key} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: STATUS_COLOR[key] }]} />
            <Text style={styles.legendLabel}>
              {count} {key.charAt(0).toUpperCase() + key.slice(1)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Stat Chip ────────────────────────────────────────────────────────────────

function StatChip({ value, label, color }: { value: number; label: string; color?: string }) {
  return (
    <View style={styles.statChip}>
      <Text style={[styles.statValue, color ? { color } : undefined]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Metric Pill ──────────────────────────────────────────────────────────────

function MetricPill({
  icon, value, label, color,
}: { icon: string; value: string | number; label: string; color: string }) {
  return (
    <View style={styles.metricPill}>
      <View style={[styles.metricIconBg, { backgroundColor: color + '1A' }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

// ─── Vehicle Row ──────────────────────────────────────────────────────────────

function VehicleRow({ vehicle, onPress }: { vehicle: Vehicle; onPress: () => void }) {
  const isMoving = vehicle.status === 'active' && vehicle.speed > 0;
  const dotColor = STATUS_COLOR[vehicle.status] ?? Colors.statusOffline;

  return (
    <TouchableOpacity style={styles.vehicleRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.vDot, { backgroundColor: dotColor }]} />
      <View style={styles.vInfo}>
        <Text style={styles.vPlate}>{vehicle.plate}</Text>
        <Text style={styles.vSub} numberOfLines={1}>
          {vehicle.make} {vehicle.model}
          {vehicle.driver ? `  ·  ${vehicle.driver.name}` : ''}
        </Text>
      </View>
      {isMoving ? (
        <View style={[styles.movingBadge, { backgroundColor: Colors.statusActive + '18' }]}>
          <Text style={[styles.movingBadgeText, { color: Colors.statusActive }]}>
            {vehicle.speed} km/h
          </Text>
        </View>
      ) : (
        <View style={[styles.statusBadge, { backgroundColor: dotColor + '18' }]}>
          <Text style={[styles.statusBadgeText, { color: dotColor }]}>
            {vehicle.status.charAt(0).toUpperCase() + vehicle.status.slice(1)}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Alert Row ────────────────────────────────────────────────────────────────

function AlertRow({ alert }: { alert: any }) {
  const meta = ALERT_META[alert.severity] ?? ALERT_META.info;
  return (
    <View style={styles.alertRow}>
      <View style={[styles.alertIconWrap, { backgroundColor: meta.bg }]}>
        <Ionicons name={meta.icon as any} size={18} color={meta.color} />
      </View>
      <View style={styles.alertInfo}>
        <Text style={styles.alertMsg} numberOfLines={2}>{alert.message}</Text>
        <Text style={styles.alertMeta}>
          {alert.vehiclePlate}{'  ·  '}{timeAgo(alert.timestamp)}
        </Text>
      </View>
      {!alert.read && <View style={[styles.unreadPip, { backgroundColor: meta.color }]} />}
    </View>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHead({
  title, badge, onSeeAll,
}: { title: string; badge?: number; onSeeAll?: () => void }) {
  return (
    <View style={styles.sectionHead}>
      <View style={styles.sectionHeadLeft}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {badge != null && badge > 0 && (
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeText}>{badge}</Text>
          </View>
        )}
      </View>
      {onSeeAll && (
        <TouchableOpacity onPress={onSeeAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.seeAll}>See all</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const { user }  = useAuth();
  const router    = useRouter();
  const [refreshing, setRefreshing] = React.useState(false);

  // Pulsing live indicator
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.7, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,   duration: 750, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const vehicles        = mockVehicles;
  const unreadAlerts    = mockAlerts.filter((a) => !a.read);
  const recentAlerts    = unreadAlerts.slice(0, 3);
  const displayVehicles = vehicles
    .filter((v) => v.status === 'active' || v.status === 'idle')
    .slice(0, 4);

  const counts = {
    total:       vehicles.length,
    active:      vehicles.filter((v) => v.status === 'active').length,
    idle:        vehicles.filter((v) => v.status === 'idle').length,
    maintenance: vehicles.filter((v) => v.status === 'maintenance').length,
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 900));
    setRefreshing(false);
  }, []);

  const firstName = user?.name?.split(' ')[0] ?? 'there';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* ── Custom Header ────────────────────────────────── */}
      <SafeAreaView style={styles.headerBg} edges={['top']}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greetText}>{greet()}, {firstName}</Text>
            <Text style={styles.dateText}>{formatDate()}</Text>
          </View>
          <View style={styles.headerRight}>
            {unreadAlerts.length > 0 && (
              <TouchableOpacity
                style={styles.bellWrap}
                onPress={() => router.push('/(tabs)/alerts')}
              >
                <Ionicons name="notifications-outline" size={22} color={Colors.textLight} />
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>
                    {unreadAlerts.length > 9 ? '9+' : unreadAlerts.length}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            <View style={styles.livePill}>
              <Animated.View style={[styles.liveDot, { transform: [{ scale: pulse }] }]} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>

      {/* ── Scrollable Body ──────────────────────────────── */}
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent}
            colors={[Colors.accent]}
          />
        }
      >
        {/* Fleet Overview card */}
        <View style={styles.card}>
          <SectionHead
            title="Fleet Overview"
            onSeeAll={() => router.push('/(tabs)/vehicles')}
          />
          <View style={styles.statsRow}>
            <StatChip value={counts.total}       label="Total" />
            <View style={styles.statDivider} />
            <StatChip value={counts.active}      label="Active"  color={Colors.statusActive} />
            <View style={styles.statDivider} />
            <StatChip value={counts.idle}        label="Idle"    color={Colors.statusIdle} />
            <View style={styles.statDivider} />
            <StatChip value={counts.maintenance} label="Maint."  color={Colors.statusMaintenance} />
          </View>
          <FleetStatusBar vehicles={vehicles} />
        </View>

        {/* Today at a Glance */}
        <View style={styles.metricsRow}>
          <MetricPill
            icon="navigate"
            value={mockFleetStats.totalTripsToday}
            label="Trips"
            color={Colors.accent}
          />
          <MetricPill
            icon="speedometer"
            value={`${Math.round(mockFleetStats.totalDistanceToday)} km`}
            label="Distance"
            color="#8B5CF6"
          />
          <MetricPill
            icon="alert-circle"
            value={unreadAlerts.length}
            label="Alerts"
            color={unreadAlerts.length > 0 ? Colors.danger : Colors.statusOffline}
          />
        </View>

        {/* Active Vehicles */}
        <View style={styles.card}>
          <SectionHead
            title="Active Vehicles"
            badge={counts.active}
            onSeeAll={() => router.push('/(tabs)/vehicles')}
          />
          {displayVehicles.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="car-outline" size={32} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No vehicles active right now</Text>
            </View>
          ) : (
            displayVehicles.map((v, i) => (
              <React.Fragment key={v.id}>
                {i > 0 && <View style={styles.rowDivider} />}
                <VehicleRow
                  vehicle={v}
                  onPress={() => router.push(`/vehicle/${v.id}` as any)}
                />
              </React.Fragment>
            ))
          )}
        </View>

        {/* Recent Alerts */}
        <View style={styles.card}>
          <SectionHead
            title="Recent Alerts"
            badge={unreadAlerts.length}
            onSeeAll={() => router.push('/(tabs)/alerts')}
          />
          {recentAlerts.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle-outline" size={32} color={Colors.statusActive} />
              <Text style={styles.emptyText}>All clear — no unread alerts</Text>
            </View>
          ) : (
            recentAlerts.map((a, i) => (
              <React.Fragment key={a.id}>
                {i > 0 && <View style={styles.rowDivider} />}
                <AlertRow alert={a} />
              </React.Fragment>
            ))
          )}
        </View>

        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.backgroundLight },

  // Header
  headerBg: { backgroundColor: Colors.primary },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  greetText:   { fontSize: 19, fontWeight: '800', color: Colors.textLight },
  dateText:    { fontSize: 11.5, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  bellWrap:      { position: 'relative', padding: 4 },
  bellBadge:     {
    position: 'absolute', top: 0, right: 0,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: Colors.danger,
    alignItems: 'center', justifyContent: 'center',
  },
  bellBadgeText: { fontSize: 8, fontWeight: '800', color: '#FFF' },

  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20, paddingHorizontal: 11, paddingVertical: 6,
  },
  liveDot:  { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.statusActive },
  liveText: { fontSize: 9.5, fontWeight: '800', color: Colors.textLight, letterSpacing: 1 },

  // Content
  content: { padding: 14, gap: 12 },

  // Card
  card:       { backgroundColor: Colors.cardBackground, borderRadius: Radius.lg, padding: 16, ...Shadow.sm },
  rowDivider: { height: 1, backgroundColor: Colors.divider, marginLeft: 26 },

  // Section header
  sectionHead:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionHeadLeft:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle:     { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  sectionBadge:     {
    backgroundColor: Colors.accent, borderRadius: 10,
    minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
  },
  sectionBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFF' },
  seeAll:           { fontSize: FontSize.sm, fontWeight: '600', color: Colors.accent },

  // Stat chips
  statsRow:    { flexDirection: 'row', marginBottom: 16 },
  statChip:    { flex: 1, alignItems: 'center', gap: 2 },
  statValue:   { fontSize: 28, fontWeight: '900', color: Colors.textPrimary, lineHeight: 32 },
  statLabel:   { fontSize: 10.5, color: Colors.textMuted, fontWeight: '500' },
  statDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 6 },

  // Fleet bar
  barWrap:    { gap: 8 },
  bar:        {
    flexDirection: 'row', height: 10, borderRadius: 5,
    overflow: 'hidden', backgroundColor: Colors.border,
  },
  barSeg:     { height: '100%' },
  barLegend:  { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:  { width: 8, height: 8, borderRadius: 4 },
  legendLabel:{ fontSize: 11, color: Colors.textSecondary, fontWeight: '500' },

  // Metrics row
  metricsRow:   { flexDirection: 'row', gap: 10 },
  metricPill:   {
    flex: 1, backgroundColor: Colors.cardBackground,
    borderRadius: Radius.md, padding: 14,
    alignItems: 'center', gap: 5, ...Shadow.sm,
  },
  metricIconBg: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  metricValue:  { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  metricLabel:  { fontSize: 10.5, color: Colors.textMuted, fontWeight: '500' },

  // Vehicle row
  vehicleRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  vDot:            { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  vInfo:           { flex: 1 },
  vPlate:          { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  vSub:            { fontSize: 11.5, color: Colors.textSecondary, marginTop: 2 },
  movingBadge:     { borderRadius: 12, paddingHorizontal: 9, paddingVertical: 3 },
  movingBadgeText: { fontSize: 11, fontWeight: '700' },
  statusBadge:     { borderRadius: 12, paddingHorizontal: 9, paddingVertical: 3 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },

  // Alert row
  alertRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  alertIconWrap:{ width: 36, height: 36, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  alertInfo:    { flex: 1 },
  alertMsg:     { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, lineHeight: 18 },
  alertMeta:    { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  unreadPip:    { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 22, gap: 7 },
  emptyText:  { fontSize: FontSize.sm, color: Colors.textMuted },
});
