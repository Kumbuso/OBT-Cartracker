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
import AlertItem from '../../components/AlertItem';
import { mockAlerts } from '../../data/mockData';
import type { Alert, AlertSeverity } from '../../types';
import { Colors, Spacing, Radius, FontSize } from '../../constants/theme';

export default function AlertsScreen() {
  const [alerts, setAlerts] = useState<Alert[]>(mockAlerts);
  const [filter, setFilter] = useState<AlertSeverity | 'all'>('all');

  const unread = alerts.filter((a) => !a.read).length;

  const filtered = alerts.filter((a) => filter === 'all' || a.severity === filter);
  const sorted = [...filtered].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const markAllRead = () => setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>
            Alerts
            {unread > 0 && (
              <Text style={styles.unreadBadge}> {unread} unread</Text>
            )}
          </Text>
          {unread > 0 && (
            <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn}>
              <Ionicons name="checkmark-done" size={16} color={Colors.accent} />
              <Text style={styles.markAllText}>Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.filterRow}>
          {(['all', 'critical', 'warning', 'info'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[
                styles.filterChip,
                filter === f && { backgroundColor: filterChipActiveBg(f), borderColor: filterChipActiveBg(f) },
              ]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <FlatList
        style={{ flex: 1 }}
        data={sorted}
        keyExtractor={(a) => a.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <AlertItem alert={item} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="shield-checkmark-outline" size={56} color={Colors.statusActive} />
            <Text style={styles.emptyTitle}>All clear!</Text>
            <Text style={styles.emptyText}>No alerts in this category</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function filterChipActiveBg(f: string): string {
  switch (f) {
    case 'critical': return Colors.danger;
    case 'warning': return Colors.warning;
    case 'info': return Colors.info;
    default: return Colors.primary;
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundLight },
  header: {
    backgroundColor: Colors.cardBackground,
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  unreadBadge: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.danger,
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  markAllText: {
    fontSize: FontSize.sm,
    color: Colors.accent,
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  filterChip: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: Radius.md,
    alignItems: 'center',
    backgroundColor: Colors.backgroundLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  filterTextActive: {
    color: Colors.textLight,
  },
  list: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emptyText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
});
