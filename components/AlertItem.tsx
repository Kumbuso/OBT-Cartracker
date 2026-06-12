import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Alert, AlertSeverity, AlertType } from '../types';
import { Colors, Spacing, Radius, FontSize } from '../constants/theme';

const severityConfig: Record<AlertSeverity, { color: string; bg: string; icon: any }> = {
  critical: { color: Colors.danger, bg: '#FEE8EA', icon: 'warning' },
  warning: { color: Colors.warning, bg: '#FFF4E6', icon: 'alert-circle' },
  info: { color: Colors.info, bg: '#EBF4FB', icon: 'information-circle' },
};

const typeLabel: Record<AlertType, string> = {
  speeding: 'Speeding',
  geofence_exit: 'Geofence Exit',
  geofence_enter: 'Geofence Enter',
  maintenance_due: 'Maintenance Due',
  low_fuel: 'Low Fuel',
  engine_off: 'Engine Off',
  harsh_braking: 'Harsh Braking',
  idle_timeout: 'Idle Timeout',
};

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface Props {
  alert: Alert;
}

export default function AlertItem({ alert }: Props) {
  const cfg = severityConfig[alert.severity];
  return (
    <View style={[styles.container, !alert.read && styles.unread]}>
      <View style={[styles.iconWrap, { backgroundColor: cfg.bg }]}>
        <Ionicons name={cfg.icon} size={20} color={cfg.color} />
      </View>
      <View style={styles.content}>
        <View style={styles.row}>
          <Text style={[styles.type, { color: cfg.color }]}>{typeLabel[alert.type]}</Text>
          <Text style={styles.time}>{timeAgo(alert.timestamp)}</Text>
        </View>
        <Text style={styles.message} numberOfLines={2}>{alert.message}</Text>
        <Text style={styles.plate}>{alert.vehiclePlate}</Text>
      </View>
      {!alert.read && <View style={[styles.unreadDot, { backgroundColor: cfg.color }]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.cardBackground,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  unread: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  content: {
    flex: 1,
    gap: 3,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  type: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  time: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  message: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  plate: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
    marginTop: 5,
  },
});
