import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import VehicleCard from '../../components/VehicleCard';
import type { VehicleStatus } from '../../types';
import { Colors, Spacing, FontSize, Radius } from '../../constants/theme';
import { useFleet } from '../../context/FleetContext';

const FILTERS: { label: string; value: VehicleStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Idle', value: 'idle' },
  { label: 'Offline', value: 'offline' },
  { label: 'Maintenance', value: 'maintenance' },
];

export default function VehiclesScreen() {
  const { vehicles } = useFleet();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<VehicleStatus | 'all'>('all');

  const filtered = vehicles.filter((v) => {
    const matchesSearch =
      v.plate.toLowerCase().includes(search.toLowerCase()) ||
      v.make.toLowerCase().includes(search.toLowerCase()) ||
      v.model.toLowerCase().includes(search.toLowerCase()) ||
      (v.driver?.name.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchesFilter = filter === 'all' || v.status === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by plate, model, driver..."
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.value}
              style={[styles.filterChip, filter === f.value && styles.filterChipActive]}
              onPress={() => setFilter(f.value)}
            >
              <Text style={[styles.filterLabel, filter === f.value && styles.filterLabelActive]}>
                {f.label}
              </Text>
              <Text style={[styles.filterCount, filter === f.value && styles.filterLabelActive]}>
                {f.value === 'all'
                  ? vehicles.length
                  : vehicles.filter((v) => v.status === f.value).length}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <VehicleCard vehicle={item} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="car-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No vehicles match your search</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundLight },
  header: {
    backgroundColor: Colors.cardBackground,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundLight,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  filters: {
    flexDirection: 'row',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.backgroundLight,
    marginRight: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  filterLabelActive: {
    color: Colors.textLight,
  },
  filterCount: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: '700',
  },
  list: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    gap: Spacing.sm,
  },
  emptyText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
});
