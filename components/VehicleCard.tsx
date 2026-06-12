import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Vehicle } from '../types';
import StatusBadge from './StatusBadge';
import { Colors, Spacing, Radius, Shadow, FontSize } from '../constants/theme';

interface Props {
  vehicle: Vehicle;
}

export default function VehicleCard({ vehicle }: Props) {
  const router = useRouter();
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/vehicle/${vehicle.id}`)}
      activeOpacity={0.85}
    >
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="car" size={22} color={Colors.primary} />
        </View>
        <View style={styles.titleBlock}>
          <Text style={styles.plate}>{vehicle.plate}</Text>
          <Text style={styles.model}>
            {vehicle.year} {vehicle.make} {vehicle.model}
          </Text>
        </View>
        <StatusBadge status={vehicle.status} size="sm" />
      </View>

      <View style={styles.divider} />

      <View style={styles.stats}>
        <StatItem icon="person-outline" label="Driver" value={vehicle.driver?.name ?? 'Unassigned'} />
        <StatItem icon="speedometer-outline" label="Speed" value={`${vehicle.speed} km/h`} />
        <StatItem icon="water-outline" label="Fuel" value={`${vehicle.fuelLevel}%`} />
      </View>

      {vehicle.location.address ? (
        <View style={styles.location}>
          <Ionicons name="location-outline" size={13} color={Colors.textSecondary} />
          <Text style={styles.locationText} numberOfLines={1}>
            {vehicle.location.address}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function StatItem({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.statItem}>
      <Ionicons name={icon} size={14} color={Colors.textSecondary} />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadow.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    flex: 1,
  },
  plate: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  model: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginVertical: Spacing.sm,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  statValue: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  location: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: Spacing.sm,
  },
  locationText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    flex: 1,
  },
});
