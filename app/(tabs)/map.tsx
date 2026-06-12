import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import StatusBadge from '../../components/StatusBadge';
import { mockVehicles } from '../../data/mockData';
import type { Vehicle } from '../../types';
import { Colors, Spacing, Radius, FontSize, Shadow } from '../../constants/theme';

const { width } = Dimensions.get('window');

export default function MapScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<Vehicle | null>(null);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.mapPlaceholder}>
        <View style={styles.mapGrid}>
          {mockVehicles.map((v) => (
            <TouchableOpacity
              key={v.id}
              style={[
                styles.vehiclePin,
                {
                  left: `${((v.location.longitude - 3.3) / 0.5) * 80 + 5}%`,
                  top: `${((6.65 - v.location.latitude) / 0.3) * 75 + 5}%`,
                },
                selected?.id === v.id && styles.vehiclePinSelected,
                v.status === 'active' && styles.pinActive,
                v.status === 'idle' && styles.pinIdle,
                v.status === 'offline' && styles.pinOffline,
                v.status === 'maintenance' && styles.pinMaintenance,
              ]}
              onPress={() => setSelected(selected?.id === v.id ? null : v)}
            >
              <Ionicons
                name="car"
                size={14}
                color={selected?.id === v.id ? '#FFF' : getStatusColor(v.status)}
              />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.mapOverlay}>
          <Ionicons name="map-outline" size={40} color="rgba(255,255,255,0.3)" />
          <Text style={styles.mapNote}>Live Map View</Text>
          <Text style={styles.mapSub}>Install expo-location & react-native-maps{'\n'}for full GPS tracking</Text>
        </View>

        <View style={styles.legend}>
          <LegendDot color={Colors.statusActive} label="Active" />
          <LegendDot color={Colors.statusIdle} label="Idle" />
          <LegendDot color={Colors.statusOffline} label="Offline" />
          <LegendDot color={Colors.statusMaintenance} label="Maint." />
        </View>
      </View>

      {selected && (
        <TouchableOpacity
          style={styles.selectedCard}
          onPress={() => router.push(`/vehicle/${selected.id}`)}
          activeOpacity={0.9}
        >
          <View style={styles.selectedInfo}>
            <Text style={styles.selectedPlate}>{selected.plate}</Text>
            <Text style={styles.selectedModel}>{selected.year} {selected.make} {selected.model}</Text>
            {selected.location.address ? (
              <Text style={styles.selectedAddr} numberOfLines={1}>{selected.location.address}</Text>
            ) : null}
          </View>
          <View style={styles.selectedRight}>
            <StatusBadge status={selected.status} size="sm" />
            <View style={styles.selectedSpeed}>
              <Ionicons name="speedometer-outline" size={13} color={Colors.textSecondary} />
              <Text style={styles.selectedSpeedText}>{selected.speed} km/h</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </View>
        </TouchableOpacity>
      )}

      <View style={styles.listSection}>
        <Text style={styles.listTitle}>All Vehicles ({mockVehicles.length})</Text>
        <FlatList
          data={mockVehicles}
          keyExtractor={(v) => v.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.vehicleChip, selected?.id === item.id && styles.vehicleChipActive]}
              onPress={() => setSelected(selected?.id === item.id ? null : item)}
            >
              <View style={[styles.chipDot, { backgroundColor: getStatusColor(item.status) }]} />
              <Text style={[styles.chipText, selected?.id === item.id && styles.chipTextActive]}>
                {item.plate}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

function getStatusColor(status: Vehicle['status']): string {
  switch (status) {
    case 'active': return Colors.statusActive;
    case 'idle': return Colors.statusIdle;
    case 'offline': return Colors.statusOffline;
    case 'maintenance': return Colors.statusMaintenance;
  }
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundLight },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: Colors.backgroundDark,
    position: 'relative',
  },
  mapGrid: {
    ...StyleSheet.absoluteFill,
  },
  vehiclePin: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehiclePinSelected: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
    transform: [{ scale: 1.25 }],
  },
  pinActive: { borderColor: Colors.statusActive },
  pinIdle: { borderColor: Colors.statusIdle },
  pinOffline: { borderColor: Colors.statusOffline },
  pinMaintenance: { borderColor: Colors.statusMaintenance },
  mapOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    pointerEvents: 'none',
  },
  mapNote: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  mapSub: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  legend: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: Radius.md,
    padding: 8,
    gap: 5,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: FontSize.xs,
  },
  selectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    margin: Spacing.sm,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Shadow.md,
  },
  selectedInfo: { flex: 1 },
  selectedPlate: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  selectedModel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  selectedAddr: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  selectedRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  selectedSpeed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  selectedSpeedText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  listSection: {
    backgroundColor: Colors.cardBackground,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  listTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textSecondary,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
  },
  chipList: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
  },
  vehicleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.backgroundLight,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: Spacing.xs,
  },
  vehicleChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  chipText: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  chipTextActive: {
    color: Colors.textLight,
  },
});
