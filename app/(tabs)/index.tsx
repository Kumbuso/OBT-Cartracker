import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import StatCard from '../../components/StatCard';
import VehicleCard from '../../components/VehicleCard';
import AlertItem from '../../components/AlertItem';
import { mockFleetStats, mockVehicles, mockAlerts } from '../../data/mockData';
import { Colors, Spacing, FontSize, Radius, Shadow } from '../../constants/theme';

export default function DashboardScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = React.useState(false);

  const activeVehicles = mockVehicles.filter((v) => v.status === 'active');
  const recentAlerts = mockAlerts.filter((a) => !a.read).slice(0, 3);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1200);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        <View style={styles.headerBanner}>
          <View>
            <Text style={styles.greeting}>Good morning,</Text>
            <Text style={styles.orgName}>OBT Fleet Manager</Text>
          </View>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Live</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Fleet Overview</Text>
        <View style={styles.statsRow}>
          <StatCard
            label="Total Vehicles"
            value={mockFleetStats.totalVehicles}
            icon="car"
            iconColor={Colors.primary}
            iconBg="#EEF2FF"
          />
          <StatCard
            label="Active"
            value={mockFleetStats.activeVehicles}
            icon="radio-button-on"
            iconColor={Colors.statusActive}
            iconBg="#E8FAF0"
          />
        </View>
        <View style={styles.statsRow}>
          <StatCard
            label="Idle"
            value={mockFleetStats.idleVehicles}
            icon="pause-circle"
            iconColor={Colors.statusIdle}
            iconBg="#FFF4E6"
          />
          <StatCard
            label="Offline"
            value={mockFleetStats.offlineVehicles}
            icon="cloud-offline"
            iconColor={Colors.statusOffline}
            iconBg="#F3F4F6"
          />
        </View>

        <View style={styles.kpiRow}>
          <KpiBox
            icon="navigate"
            label="Trips Today"
            value={String(mockFleetStats.totalTripsToday)}
            iconColor={Colors.accent}
          />
          <KpiBox
            icon="speedometer"
            label="km Today"
            value={mockFleetStats.totalDistanceToday.toFixed(1)}
            iconColor={Colors.primaryLight}
          />
          <KpiBox
            icon="alert-circle"
            label="Alerts"
            value={String(mockFleetStats.unreadAlerts)}
            iconColor={Colors.danger}
          />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Active Vehicles</Text>
          <TouchableOpacity onPress={() => router.push('/vehicles')}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>
        {activeVehicles.map((v) => (
          <VehicleCard key={v.id} vehicle={v} />
        ))}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Unread Alerts</Text>
          <TouchableOpacity onPress={() => router.push('/alerts')}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>
        {recentAlerts.length > 0 ? (
          recentAlerts.map((a) => <AlertItem key={a.id} alert={a} />)
        ) : (
          <View style={styles.emptyAlerts}>
            <Ionicons name="checkmark-circle" size={32} color={Colors.statusActive} />
            <Text style={styles.emptyAlertsText}>All clear — no unread alerts</Text>
          </View>
        )}
        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function KpiBox({ icon, label, value, iconColor }: { icon: any; label: string; value: string; iconColor: string }) {
  return (
    <View style={styles.kpiBox}>
      <Ionicons name={icon} size={20} color={iconColor} />
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundLight },
  scroll: { flex: 1 },
  content: { padding: Spacing.md },
  headerBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadow.md,
  },
  greeting: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.7)',
  },
  orgName: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.textLight,
    marginTop: 2,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.statusActive,
  },
  liveText: {
    color: Colors.textLight,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  seeAll: {
    fontSize: FontSize.sm,
    color: Colors.accent,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  kpiBox: {
    flex: 1,
    backgroundColor: Colors.cardBackground,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    alignItems: 'center',
    gap: 3,
    ...Shadow.sm,
  },
  kpiValue: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  kpiLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  emptyAlerts: {
    alignItems: 'center',
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyAlertsText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
});
