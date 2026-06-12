import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { VehicleStatus } from '../types';
import { Colors, Radius, FontSize } from '../constants/theme';

const statusConfig: Record<VehicleStatus, { label: string; color: string; bg: string }> = {
  active: { label: 'Active', color: Colors.statusActive, bg: '#E8FAF0' },
  idle: { label: 'Idle', color: Colors.statusIdle, bg: '#FFF4E6' },
  offline: { label: 'Offline', color: Colors.statusOffline, bg: '#F3F4F6' },
  maintenance: { label: 'Maintenance', color: Colors.statusMaintenance, bg: '#FEE8EA' },
};

interface Props {
  status: VehicleStatus;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'md' }: Props) {
  const cfg = statusConfig[status];
  const isSmall = size === 'sm';
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }, isSmall && styles.badgeSm]}>
      <View style={[styles.dot, { backgroundColor: cfg.color }, isSmall && styles.dotSm]} />
      <Text style={[styles.label, { color: cfg.color }, isSmall && styles.labelSm]}>
        {cfg.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    gap: 5,
  },
  badgeSm: {
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: Radius.full,
  },
  dotSm: {
    width: 5,
    height: 5,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  labelSm: {
    fontSize: FontSize.xs,
  },
});
