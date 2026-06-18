import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { mockVehicles, mockTrips, mockAlerts, mockDrivers, mockFuelEvents, mockAccidentReports } from '../../data/mockData';
import { Colors, Spacing, Radius, FontSize, Shadow } from '../../constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = 'today' | 'week' | 'month' | 'custom';
type ReportTab = 'fleet' | 'trips' | 'drivers' | 'fuel' | 'accidents';
interface DateRange { from: Date; to: Date }

// ─── Constants ────────────────────────────────────────────────────────────────

const PERIODS: { key: Period; label: string }[] = [
  { key: 'today',  label: 'Today'  },
  { key: 'week',   label: 'Week'   },
  { key: 'month',  label: 'Month'  },
  { key: 'custom', label: 'Range'  },
];

const REPORT_TABS: { key: ReportTab; label: string; icon: string }[] = [
  { key: 'fleet',     label: 'Fleet',     icon: 'layers-outline'        },
  { key: 'trips',     label: 'Trips',     icon: 'navigate-outline'      },
  { key: 'drivers',   label: 'Drivers',   icon: 'people-outline'        },
  { key: 'fuel',      label: 'Fuel',      icon: 'water-outline'         },
  { key: 'accidents', label: 'Accidents', icon: 'alert-circle-outline'  },
];

const RANGE_PRESETS = [
  { label: 'Q1 2026', from: '2026-01-01', to: '2026-03-31' },
  { label: 'Q2 2026', from: '2026-04-01', to: '2026-06-30' },
  { label: 'H1 2026', from: '2026-01-01', to: '2026-06-30' },
  { label: '2025',    from: '2025-01-01', to: '2025-12-31' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDateBounds(period: Period, customFrom: string, customTo: string): DateRange {
  const now = new Date();
  if (period === 'today') {
    const from = new Date(now); from.setHours(0, 0, 0, 0);
    const to   = new Date(now); to.setHours(23, 59, 59, 999);
    return { from, to };
  }
  if (period === 'week') {
    const from = new Date(now); from.setDate(from.getDate() - 7); from.setHours(0, 0, 0, 0);
    return { from, to: now };
  }
  if (period === 'month') {
    const from = new Date(now); from.setDate(1); from.setHours(0, 0, 0, 0);
    return { from, to: now };
  }
  const from = customFrom ? new Date(customFrom + 'T00:00:00') : new Date(0);
  const to   = customTo   ? new Date(customTo   + 'T23:59:59') : now;
  return {
    from: isNaN(from.getTime()) ? new Date(0) : from,
    to:   isNaN(to.getTime())   ? now         : to,
  };
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtDate(d: Date) {
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function inRange(isoStr: string, range: DateRange) {
  const d = new Date(isoStr);
  return d >= range.from && d <= range.to;
}

function formatDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function bucketTripsByTime(trips: { startTime: string }[], range: DateRange): { label: string; value: number }[] {
  const diffDays = (range.to.getTime() - range.from.getTime()) / 86_400_000;
  const DAY = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  if (diffDays <= 1) {
    return ['12a', '4a', '8a', '12p', '4p', '8p'].map((label, i) => ({
      label,
      value: trips.filter((t) => {
        const h = new Date(t.startTime).getHours();
        return h >= i * 4 && h < (i + 1) * 4;
      }).length,
    }));
  }

  if (diffDays <= 10) {
    const count = Math.min(Math.ceil(diffDays) + 1, 7);
    return Array.from({ length: count }, (_, i) => {
      const d = new Date(range.from);
      d.setDate(d.getDate() + i);
      return {
        label: DAY[d.getDay()],
        value: trips.filter((t) => new Date(t.startTime).toDateString() === d.toDateString()).length,
      };
    });
  }

  const weeks: { label: string; value: number }[] = [];
  const cur = new Date(range.from);
  for (let wk = 1; cur <= range.to && wk <= 8; wk++) {
    const end = new Date(cur);
    end.setDate(end.getDate() + 6);
    weeks.push({
      label: `W${wk}`,
      value: trips.filter((t) => { const d = new Date(t.startTime); return d >= cur && d <= end; }).length,
    });
    cur.setDate(cur.getDate() + 7);
  }
  return weeks;
}

// ─── Date Range Panel ─────────────────────────────────────────────────────────

function DateRangePanel({
  from, to, onFromChange, onToChange,
}: {
  from: string; to: string;
  onFromChange: (v: string) => void;
  onToChange:   (v: string) => void;
}) {
  return (
    <View style={styles.rangePanel}>
      <View style={styles.rangeInputRow}>
        <View style={styles.rangeField}>
          <Text style={styles.rangeFieldLabel}>From</Text>
          <TextInput
            style={styles.rangeInput}
            value={from}
            onChangeText={onFromChange}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={Colors.textMuted}
            keyboardType="numbers-and-punctuation"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <Text style={styles.rangeSep}>–</Text>
        <View style={styles.rangeField}>
          <Text style={styles.rangeFieldLabel}>To</Text>
          <TextInput
            style={styles.rangeInput}
            value={to}
            onChangeText={onToChange}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={Colors.textMuted}
            keyboardType="numbers-and-punctuation"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>
      <View style={styles.presetRow}>
        {RANGE_PRESETS.map((p) => {
          const active = from === p.from && to === p.to;
          return (
            <TouchableOpacity
              key={p.label}
              style={[styles.presetBtn, active && styles.presetBtnActive]}
              onPress={() => { onFromChange(p.from); onToChange(p.to); }}
            >
              <Text style={[styles.presetBtnText, active && styles.presetBtnTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Fleet Summary ────────────────────────────────────────────────────────────

function FleetReport({ dateRange }: { dateRange: DateRange }) {
  const trips = useMemo(() => mockTrips.filter((t) => inRange(t.startTime, dateRange)), [dateRange]);

  const total       = mockVehicles.length;
  const active      = mockVehicles.filter((v) => v.status === 'active').length;
  const idle        = mockVehicles.filter((v) => v.status === 'idle').length;
  const offline     = mockVehicles.filter((v) => v.status === 'offline').length;
  const maintenance = mockVehicles.filter((v) => v.status === 'maintenance').length;
  const utilization = Math.round((active / total) * 100);

  const totalDistance = trips.reduce((s, t) => s + t.distance, 0);
  const totalFuel     = trips.reduce((s, t) => s + t.fuelUsed, 0);
  const unread        = mockAlerts.filter((a) => !a.read).length;

  const statusRows = [
    { label: 'Active',      count: active,      color: Colors.statusActive },
    { label: 'Idle',        count: idle,        color: Colors.statusIdle },
    { label: 'Offline',     count: offline,     color: Colors.statusOffline },
    { label: 'Maintenance', count: maintenance, color: Colors.statusMaintenance },
  ];

  return (
    <View style={styles.section}>
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="speedometer-outline" size={16} color={Colors.accent} />
          <Text style={styles.cardTitle}>Fleet Utilization</Text>
        </View>
        <View style={styles.utilizationRow}>
          <Text style={styles.utilizationPct}>{utilization}%</Text>
          <Text style={styles.utilizationSub}>{active} of {total} vehicles active</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${utilization}%` as any, backgroundColor: Colors.statusActive }]} />
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="pie-chart-outline" size={16} color={Colors.accent} />
          <Text style={styles.cardTitle}>Fleet Distribution</Text>
        </View>
        <SegmentedBar segments={statusRows.map((r) => ({ label: r.label, value: r.count, color: r.color }))} />
      </View>

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="bar-chart-outline" size={16} color={Colors.accent} />
          <Text style={styles.cardTitle}>Trips per Vehicle</Text>
        </View>
        <MiniBarChart
          barColor={Colors.primary}
          data={mockVehicles.map((v) => ({
            label: v.plate,
            value: trips.filter((t) => t.vehicleId === v.id).length,
          }))}
        />
      </View>

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="car-outline" size={16} color={Colors.accent} />
          <Text style={styles.cardTitle}>Status Breakdown</Text>
        </View>
        <View style={styles.statusGrid}>
          {statusRows.map((row) => (
            <View key={row.label} style={styles.statusCell}>
              <View style={[styles.statusDot, { backgroundColor: row.color }]} />
              <Text style={styles.statusCount}>{row.count}</Text>
              <Text style={styles.statusLabel}>{row.label}</Text>
              <Text style={styles.statusPct}>{Math.round((row.count / total) * 100)}%</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.statRow}>
        <StatBox icon="navigate-outline"      value={String(trips.length)}             label="Trips"     color={Colors.accent} />
        <StatBox icon="map-outline"           value={`${totalDistance.toFixed(1)} km`} label="Distance"  color={Colors.primary} />
        <StatBox icon="water-outline"         value={`${totalFuel.toFixed(1)} L`}      label="Fuel Used" color={Colors.warning} />
        <StatBox icon="notifications-outline" value={String(unread)}                   label="Alerts"    color={Colors.danger} />
      </View>
    </View>
  );
}

// ─── Trip Report ──────────────────────────────────────────────────────────────

function TripReport({ dateRange }: { dateRange: DateRange }) {
  const trips = useMemo(() => mockTrips.filter((t) => inRange(t.startTime, dateRange)), [dateRange]);

  const completed   = trips.filter((t) => t.endTime !== null);
  const inProgress  = trips.filter((t) => t.endTime === null);
  const totalDist   = trips.reduce((s, t) => s + t.distance, 0);
  const totalFuel   = trips.reduce((s, t) => s + t.fuelUsed, 0);
  const avgDuration = completed.length > 0
    ? Math.round(completed.reduce((s, t) => s + t.duration, 0) / completed.length)
    : 0;

  if (trips.length === 0) {
    return (
      <View style={styles.section}>
        <EmptyState icon="navigate-outline" message="No trips in this period" />
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.statRow}>
        <StatBox icon="navigate-outline"         value={String(trips.length)}       label="Total"     color={Colors.accent} />
        <StatBox icon="checkmark-circle-outline" value={String(completed.length)}   label="Completed" color={Colors.statusActive} />
        <StatBox icon="radio-button-on-outline"  value={String(inProgress.length)}  label="Active"    color={Colors.warning} />
        <StatBox icon="time-outline"             value={formatDuration(avgDuration)} label="Avg Time"  color={Colors.primary} />
      </View>

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="bar-chart-outline" size={16} color={Colors.accent} />
          <Text style={styles.cardTitle}>Trip Activity</Text>
        </View>
        <MiniBarChart data={bucketTripsByTime(trips, dateRange)} barColor={Colors.accent} />
      </View>

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="list-outline" size={16} color={Colors.accent} />
          <Text style={styles.cardTitle}>Distance &amp; Fuel</Text>
        </View>
        <View style={styles.summaryMetrics}>
          <View style={styles.summaryMetric}>
            <Text style={styles.summaryMetricValue}>{totalDist.toFixed(1)} km</Text>
            <Text style={styles.summaryMetricLabel}>Total Distance</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryMetric}>
            <Text style={styles.summaryMetricValue}>{totalFuel.toFixed(1)} L</Text>
            <Text style={styles.summaryMetricLabel}>Total Fuel</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryMetric}>
            <Text style={styles.summaryMetricValue}>
              {totalFuel > 0 ? (totalDist / totalFuel).toFixed(1) : '—'} km/L
            </Text>
            <Text style={styles.summaryMetricLabel}>Efficiency</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="navigate-outline" size={16} color={Colors.accent} />
          <Text style={styles.cardTitle}>Trip List</Text>
        </View>
        {trips
          .slice()
          .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
          .map((trip, i) => (
            <View key={trip.id} style={[styles.tripRow, i > 0 && styles.tripRowBorder]}>
              <View style={styles.tripLeft}>
                <View style={styles.platePill}>
                  <Text style={styles.platePillText}>{trip.vehiclePlate}</Text>
                </View>
                <View>
                  <Text style={styles.tripDriver}>{trip.driverName}</Text>
                  <Text style={styles.tripMeta}>
                    {trip.distance.toFixed(1)} km · {formatDuration(trip.duration)}
                  </Text>
                </View>
              </View>
              <View style={styles.tripRight}>
                <View style={[styles.tripStatus, trip.endTime ? styles.tripStatusDone : styles.tripStatusActive]}>
                  <Text style={[styles.tripStatusText, { color: trip.endTime ? Colors.textMuted : Colors.statusActive }]}>
                    {trip.endTime ? 'Done' : 'Live'}
                  </Text>
                </View>
                <Text style={styles.tripSpeed}>{trip.maxSpeed} km/h max</Text>
              </View>
            </View>
          ))}
      </View>
    </View>
  );
}

// ─── Driver Report ────────────────────────────────────────────────────────────

function DriverReport({ dateRange }: { dateRange: DateRange }) {
  const trips = useMemo(() => mockTrips.filter((t) => inRange(t.startTime, dateRange)), [dateRange]);

  const driverStats = useMemo(() => {
    return mockDrivers.map((driver) => {
      const dTrips    = trips.filter((t) => t.driverId === driver.id);
      const totalDist = dTrips.reduce((s, t) => s + t.distance, 0);
      const totalFuel = dTrips.reduce((s, t) => s + t.fuelUsed, 0);
      const maxSpeed  = dTrips.reduce((max, t) => Math.max(max, t.maxSpeed), 0);
      const avgSpeed  = dTrips.length > 0
        ? Math.round(dTrips.reduce((s, t) => s + t.avgSpeed, 0) / dTrips.length)
        : 0;
      const incidents = mockAlerts.filter(
        (a) => mockVehicles.find((v) => v.id === a.vehicleId)?.driver?.id === driver.id
      ).length;
      return { driver, trips: dTrips.length, totalDist, totalFuel, maxSpeed, avgSpeed, incidents };
    });
  }, [trips]);

  return (
    <View style={styles.section}>
      <View style={styles.statRow}>
        <StatBox icon="people-outline"    value={String(mockDrivers.length)} label="Drivers"     color={Colors.accent} />
        <StatBox icon="navigate-outline"  value={String(trips.length)}       label="Total Trips" color={Colors.primary} />
        <StatBox
          icon="speedometer-outline"
          value={trips.length > 0 ? `${Math.max(...trips.map((t) => t.maxSpeed))} km/h` : '—'}
          label="Top Speed"
          color={Colors.danger}
        />
        <StatBox icon="warning-outline" value={String(mockAlerts.length)} label="Incidents" color={Colors.warning} />
      </View>

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="bar-chart-outline" size={16} color={Colors.accent} />
          <Text style={styles.cardTitle}>Distance by Driver</Text>
        </View>
        <HorizontalBarChart
          barColor={Colors.primary}
          data={driverStats
            .sort((a, b) => b.totalDist - a.totalDist)
            .map(({ driver, totalDist }) => ({
              label: driver.name.split(' ')[0],
              value: totalDist,
              valueLabel: `${totalDist.toFixed(0)} km`,
            }))}
        />
      </View>

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="bar-chart-outline" size={16} color={Colors.accent} />
          <Text style={styles.cardTitle}>Trips per Driver</Text>
        </View>
        <MiniBarChart
          barColor={Colors.accent}
          data={driverStats
            .sort((a, b) => b.trips - a.trips)
            .map(({ driver, trips: dCount }) => ({
              label: driver.name.split(' ')[0],
              value: dCount,
            }))}
        />
      </View>

      {driverStats.map(({ driver, trips: dCount, totalDist, totalFuel, maxSpeed, avgSpeed, incidents }) => (
        <View key={driver.id} style={styles.card}>
          <View style={styles.driverHeader}>
            <View style={styles.driverAvatar}>
              <Text style={styles.driverAvatarText}>
                {driver.name.split(' ').map((n) => n[0]).join('')}
              </Text>
            </View>
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{driver.name}</Text>
              <Text style={styles.driverLicense}>{driver.licenseNumber}</Text>
            </View>
            {incidents > 0 && (
              <View style={styles.incidentBadge}>
                <Ionicons name="warning" size={12} color={Colors.warning} />
                <Text style={styles.incidentBadgeText}>{incidents}</Text>
              </View>
            )}
          </View>
          <View style={styles.driverMetrics}>
            <DriverMetric label="Trips"     value={String(dCount)} />
            <DriverMetric label="Distance"  value={`${totalDist.toFixed(1)} km`} />
            <DriverMetric label="Avg Speed" value={`${avgSpeed} km/h`} />
            <DriverMetric label="Max Speed" value={`${maxSpeed} km/h`} highlight={maxSpeed > 100} />
            <DriverMetric label="Fuel"      value={`${totalFuel.toFixed(1)} L`} />
          </View>
        </View>
      ))}
    </View>
  );
}

function DriverMetric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.driverMetric}>
      <Text style={[styles.driverMetricValue, highlight && { color: Colors.danger }]}>{value}</Text>
      <Text style={styles.driverMetricLabel}>{label}</Text>
    </View>
  );
}

// ─── Fuel Report ──────────────────────────────────────────────────────────────

function FuelReport({ dateRange }: { dateRange: DateRange }) {
  const trips  = useMemo(() => mockTrips.filter((t)  => inRange(t.startTime,  dateRange)), [dateRange]);
  const events = useMemo(() => mockFuelEvents.filter((e) => inRange(e.timestamp, dateRange)), [dateRange]);

  const vehiclesFuel = mockVehicles.map((v) => {
    const vTrips = trips.filter((t) => t.vehicleId === v.id);
    const used   = vTrips.reduce((s, t) => s + t.fuelUsed, 0);
    const dist   = vTrips.reduce((s, t) => s + t.distance, 0);
    return { vehicle: v, used, dist, efficiency: used > 0 ? dist / used : 0 };
  });

  const totalUsed      = vehiclesFuel.reduce((s, x) => s + x.used, 0);
  const avgLevel       = Math.round(mockVehicles.reduce((s, v) => s + v.fuelLevel, 0) / mockVehicles.length);
  const refuels        = events.filter((e) => e.type === 'refuel');
  const totalCost      = refuels.reduce((s, e) => s + (e.cost ?? 0), 0);
  const totalRefuelled = refuels.reduce((s, e) => s + e.liters, 0);
  const fleetAvgEff    = vehiclesFuel.reduce((s, x) => s + x.efficiency, 0) / mockVehicles.length;

  return (
    <View style={styles.section}>
      <View style={styles.statRow}>
        <StatBox icon="water-outline"        value={`${totalUsed.toFixed(1)} L`} label="Trip Fuel"  color={Colors.accent} />
        <StatBox
          icon="battery-half-outline"
          value={`${avgLevel}%`}
          label="Avg Level"
          color={avgLevel < 30 ? Colors.danger : Colors.statusActive}
        />
        <StatBox
          icon="leaf-outline"
          value={fleetAvgEff > 0 ? `${fleetAvgEff.toFixed(1)} km/L` : '—'}
          label="Fleet Avg"
          color={Colors.statusActive}
        />
        <StatBox
          icon="warning-outline"
          value={String(mockVehicles.filter((v) => v.fuelLevel < 25).length)}
          label="Low Fuel"
          color={Colors.danger}
        />
      </View>

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="bar-chart-outline" size={16} color={Colors.accent} />
          <Text style={styles.cardTitle}>Consumption per Vehicle</Text>
        </View>
        <MiniBarChart
          barColor={Colors.info}
          data={vehiclesFuel
            .sort((a, b) => b.used - a.used)
            .map(({ vehicle, used }) => ({
              label: vehicle.plate,
              value: parseFloat(used.toFixed(1)),
              color: used > 30 ? Colors.danger : used > 15 ? Colors.warning : Colors.statusActive,
            }))}
        />
      </View>

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="leaf-outline" size={16} color={Colors.accent} />
          <Text style={styles.cardTitle}>Fuel Efficiency (km/L)</Text>
        </View>
        <HorizontalBarChart
          barColor={Colors.statusActive}
          data={vehiclesFuel
            .filter(({ used }) => used > 0)
            .sort((a, b) => b.efficiency - a.efficiency)
            .map(({ vehicle, efficiency }) => ({
              label: vehicle.plate,
              value: parseFloat(efficiency.toFixed(1)),
              valueLabel: `${efficiency.toFixed(1)} km/L`,
              color: efficiency >= 12 ? Colors.statusActive : efficiency >= 8 ? Colors.warning : Colors.danger,
            }))}
        />
      </View>

      {/* Refuelling events */}
      {events.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="receipt-outline" size={16} color={Colors.accent} />
            <Text style={styles.cardTitle}>Refuelling Events</Text>
            <View style={styles.cardBadge}>
              <Text style={styles.cardBadgeText}>
                {refuels.length} fills · {totalRefuelled.toFixed(0)} L{totalCost > 0 ? ` · K${totalCost.toLocaleString()}` : ''}
              </Text>
            </View>
          </View>
          {events
            .slice()
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .map((ev, i) => (
              <View key={ev.id} style={[styles.eventRow, i > 0 && styles.tripRowBorder]}>
                <View style={[styles.eventDot, { backgroundColor: ev.type === 'refuel' ? Colors.statusActive : Colors.warning }]} />
                <View style={styles.eventInfo}>
                  <Text style={styles.eventTitle}>
                    {ev.vehiclePlate} · {ev.type === 'refuel' ? `+${ev.liters} L` : `-${ev.liters} L consumed`}
                  </Text>
                  {ev.station && <Text style={styles.eventStation}>{ev.station}</Text>}
                  <Text style={styles.eventMeta}>
                    {new Date(ev.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {ev.cost ? `  ·  K${ev.cost.toLocaleString()}` : ''}
                  </Text>
                </View>
              </View>
            ))}
        </View>
      )}

      {events.length === 0 && trips.length === 0 && (
        <EmptyState icon="water-outline" message="No fuel activity in this period" />
      )}

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="water-outline" size={16} color={Colors.accent} />
          <Text style={styles.cardTitle}>Per Vehicle</Text>
        </View>
        {vehiclesFuel
          .sort((a, b) => a.vehicle.fuelLevel - b.vehicle.fuelLevel)
          .map(({ vehicle, used, dist, efficiency }, i) => (
            <View key={vehicle.id} style={[styles.fuelRow, i > 0 && styles.tripRowBorder]}>
              <View style={styles.fuelLeft}>
                <View style={styles.platePill}>
                  <Text style={styles.platePillText}>{vehicle.plate}</Text>
                </View>
                <View>
                  <Text style={styles.fuelModel}>{vehicle.make} {vehicle.model}</Text>
                  <Text style={styles.fuelMeta}>
                    {used > 0 ? `${used.toFixed(1)} L · ${efficiency.toFixed(1)} km/L` : 'No trips in period'}
                  </Text>
                </View>
              </View>
              <View style={styles.fuelLevelWrap}>
                <Text style={[
                  styles.fuelLevelPct,
                  { color: vehicle.fuelLevel < 25 ? Colors.danger : vehicle.fuelLevel < 50 ? Colors.warning : Colors.statusActive },
                ]}>
                  {vehicle.fuelLevel}%
                </Text>
                <View style={styles.fuelBar}>
                  <View style={[
                    styles.fuelBarFill,
                    {
                      width: `${vehicle.fuelLevel}%` as any,
                      backgroundColor: vehicle.fuelLevel < 25 ? Colors.danger : vehicle.fuelLevel < 50 ? Colors.warning : Colors.statusActive,
                    },
                  ]} />
                </View>
              </View>
            </View>
          ))}
      </View>
    </View>
  );
}

// ─── Accident Report ─────────────────────────────────────────────────────────

const SEVERITY_COLOR: Record<string, string> = {
  minor:    '#2DC653',
  moderate: '#F4A261',
  severe:   '#E63946',
  fatal:    '#7B0828',
};

const STATUS_COLOR: Record<string, string> = {
  reported:             '#3E92CC',
  under_investigation:  '#F4A261',
  resolved:             '#2DC653',
  closed:               '#888',
};

function AccidentReportSection({ dateRange }: { dateRange: DateRange }) {
  const accidents = useMemo(
    () =>
      mockAccidentReports
        .filter((a) => inRange(a.timestamp, dateRange))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [dateRange],
  );

  const total      = accidents.length;
  const severe     = accidents.filter((a) => a.severity === 'severe' || a.severity === 'fatal').length;
  const injuries   = accidents.filter((a) => a.injuriesReported).length;
  const totalDmg   = accidents.reduce((s, a) => s + (a.estimatedDamage ?? 0), 0);
  const open       = accidents.filter((a) => a.status === 'reported' || a.status === 'under_investigation').length;

  if (total === 0) {
    return (
      <View style={styles.section}>
        <EmptyState icon="shield-checkmark-outline" message="No accidents in this period" />
      </View>
    );
  }

  return (
    <View style={styles.section}>
      {/* Summary stats */}
      <View style={styles.statRow}>
        <StatBox icon="alert-circle-outline" value={String(total)}    label="Total"    color={Colors.danger} />
        <StatBox icon="flame-outline"        value={String(severe)}   label="Severe+"  color="#7B0828" />
        <StatBox icon="medkit-outline"       value={String(injuries)} label="Injuries" color={Colors.warning} />
        <StatBox icon="construct-outline"    value={String(open)}     label="Open"     color={Colors.accent} />
      </View>

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="bar-chart-outline" size={16} color={Colors.accent} />
          <Text style={styles.cardTitle}>By Severity</Text>
        </View>
        <HorizontalBarChart
          data={[
            { label: 'Minor',    value: accidents.filter((a) => a.severity === 'minor').length,    color: SEVERITY_COLOR.minor },
            { label: 'Moderate', value: accidents.filter((a) => a.severity === 'moderate').length, color: SEVERITY_COLOR.moderate },
            { label: 'Severe',   value: accidents.filter((a) => a.severity === 'severe').length,   color: SEVERITY_COLOR.severe },
            { label: 'Fatal',    value: accidents.filter((a) => a.severity === 'fatal').length,    color: SEVERITY_COLOR.fatal },
          ].filter((d) => d.value > 0)}
        />
      </View>

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="bar-chart-outline" size={16} color={Colors.accent} />
          <Text style={styles.cardTitle}>By Status</Text>
        </View>
        <HorizontalBarChart
          data={[
            { label: 'Reported',       value: accidents.filter((a) => a.status === 'reported').length,             color: STATUS_COLOR.reported },
            { label: 'Investigating',  value: accidents.filter((a) => a.status === 'under_investigation').length,  color: STATUS_COLOR.under_investigation },
            { label: 'Resolved',       value: accidents.filter((a) => a.status === 'resolved').length,             color: STATUS_COLOR.resolved },
            { label: 'Closed',         value: accidents.filter((a) => a.status === 'closed').length,              color: STATUS_COLOR.closed },
          ].filter((d) => d.value > 0)}
        />
      </View>

      {/* Damage summary card */}
      {totalDmg > 0 && (
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="cash-outline" size={16} color={Colors.accent} />
            <Text style={styles.cardTitle}>Estimated Damage</Text>
          </View>
          <Text style={styles.dmgTotal}>K{totalDmg.toLocaleString()}</Text>
          <Text style={styles.dmgSub}>{total} incident{total !== 1 ? 's' : ''} · avg K{Math.round(totalDmg / total).toLocaleString()}</Text>
        </View>
      )}

      {/* Accident list */}
      {accidents.map((acc) => (
        <View key={acc.id} style={styles.accCard}>
          {/* Header row */}
          <View style={styles.accHeader}>
            <View style={styles.platePill}>
              <Text style={styles.platePillText}>{acc.vehiclePlate}</Text>
            </View>
            <View style={styles.accHeaderMid}>
              <Text style={styles.accDriver}>{acc.driverName}</Text>
              <Text style={styles.accTime}>
                {new Date(acc.timestamp).toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}{' '}
                {new Date(acc.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            <View style={[styles.severityBadge, { backgroundColor: SEVERITY_COLOR[acc.severity] + '22', borderColor: SEVERITY_COLOR[acc.severity] + '66' }]}>
              <Text style={[styles.severityText, { color: SEVERITY_COLOR[acc.severity] }]}>
                {acc.severity.charAt(0).toUpperCase() + acc.severity.slice(1)}
              </Text>
            </View>
          </View>

          {/* Location */}
          <View style={styles.accLocationRow}>
            <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.accLocation}>{acc.location.address}</Text>
          </View>

          {/* Description */}
          <Text style={styles.accDescription}>{acc.description}</Text>

          {/* Tags row */}
          <View style={styles.accTagRow}>
            {acc.injuriesReported && (
              <View style={[styles.accTag, { backgroundColor: Colors.danger + '18' }]}>
                <Ionicons name="medkit-outline" size={11} color={Colors.danger} />
                <Text style={[styles.accTagText, { color: Colors.danger }]}>Injuries</Text>
              </View>
            )}
            {acc.thirdPartyInvolved && (
              <View style={[styles.accTag, { backgroundColor: Colors.warning + '18' }]}>
                <Ionicons name="people-outline" size={11} color={Colors.warning} />
                <Text style={[styles.accTagText, { color: Colors.warning }]}>3rd Party</Text>
              </View>
            )}
            {acc.policeReportNumber && (
              <View style={[styles.accTag, { backgroundColor: Colors.accent + '18' }]}>
                <Ionicons name="document-text-outline" size={11} color={Colors.accent} />
                <Text style={[styles.accTagText, { color: Colors.accent }]}>{acc.policeReportNumber}</Text>
              </View>
            )}
          </View>

          {/* Footer: damage + status */}
          <View style={styles.accFooter}>
            {acc.estimatedDamage ? (
              <Text style={styles.accDamage}>K{acc.estimatedDamage.toLocaleString()} damage</Text>
            ) : (
              <Text style={styles.accDamage}>No estimate yet</Text>
            )}
            <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[acc.status] + '22' }]}>
              <View style={[styles.statusDot2, { backgroundColor: STATUS_COLOR[acc.status] }]} />
              <Text style={[styles.statusBadgeText, { color: STATUS_COLOR[acc.status] }]}>
                {acc.status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </Text>
            </View>
          </View>

          {/* Notes */}
          {acc.notes && (
            <View style={styles.accNotesRow}>
              <Ionicons name="information-circle-outline" size={13} color={Colors.textMuted} />
              <Text style={styles.accNotes}>{acc.notes}</Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function StatBox({ icon, value, label, color }: { icon: string; value: string; label: string; color: string }) {
  return (
    <View style={styles.statBox}>
      <View style={[styles.statBoxIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text style={styles.statBoxValue}>{value}</Text>
      <Text style={styles.statBoxLabel}>{label}</Text>
    </View>
  );
}

function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name={icon as any} size={36} color={Colors.textMuted} />
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

// ─── Chart Components ─────────────────────────────────────────────────────────

function MiniBarChart({
  data, chartHeight = 72, barColor,
}: {
  data: { label: string; value: number; color?: string }[];
  chartHeight?: number;
  barColor?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: chartHeight + 36, paddingTop: 16 }}>
      {data.map((d, i) => {
        const barH = Math.max(Math.round((d.value / max) * chartHeight), d.value > 0 ? 4 : 0);
        return (
          <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
            {d.value > 0 && (
              <Text style={styles.chartBarValue}>{d.value}</Text>
            )}
            <View style={[styles.chartBar, { height: barH, backgroundColor: d.color ?? barColor ?? Colors.primary }]} />
            <Text style={styles.chartBarLabel} numberOfLines={1}>{d.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function HorizontalBarChart({
  data, barColor,
}: {
  data: { label: string; value: number; valueLabel?: string; color?: string }[];
  barColor?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <View style={{ gap: 10 }}>
      {data.map((d, i) => (
        <View key={i} style={{ gap: 3 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.chartHLabel} numberOfLines={1}>{d.label}</Text>
            <Text style={styles.chartHValue}>{d.valueLabel ?? String(d.value)}</Text>
          </View>
          <View style={styles.chartHTrack}>
            <View style={[
              styles.chartHFill,
              { width: `${(d.value / max) * 100}%` as any, backgroundColor: d.color ?? barColor ?? Colors.accent },
            ]} />
          </View>
        </View>
      ))}
    </View>
  );
}

function SegmentedBar({ segments }: {
  segments: { label: string; value: number; color: string }[];
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <View style={{ gap: Spacing.sm }}>
      <View style={styles.segTrack}>
        {segments.filter((s) => s.value > 0).map((seg, i, arr) => (
          <View
            key={i}
            style={[
              styles.segFill,
              { flex: seg.value, backgroundColor: seg.color },
              i === 0 && styles.segFillFirst,
              i === arr.length - 1 && styles.segFillLast,
            ]}
          />
        ))}
      </View>
      <View style={styles.segLegend}>
        {segments.map((seg, i) => (
          <View key={i} style={styles.segLegendItem}>
            <View style={[styles.segDot, { backgroundColor: seg.color }]} />
            <Text style={styles.segLegendText}>
              {seg.label} · {Math.round((seg.value / total) * 100)}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ReportsScreen() {
  const [period,     setPeriod]     = useState<Period>('today');
  const [tab,        setTab]        = useState<ReportTab>('fleet');
  const [customFrom, setCustomFrom] = useState('2026-01-01');
  const [customTo,   setCustomTo]   = useState('2026-03-31');

  const dateRange = useMemo(
    () => getDateBounds(period, customFrom, customTo),
    [period, customFrom, customTo],
  );

  const periodLabel = useMemo(() => {
    if (period === 'today')  return `Today · ${fmtDate(new Date())}`;
    if (period === 'week')   return 'Last 7 days';
    if (period === 'month')  return 'This month';
    return `${fmtDate(dateRange.from)} – ${fmtDate(dateRange.to)}`;
  }, [period, customFrom, customTo, dateRange]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* ─── Header ───────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Reports</Text>
            <View style={styles.headerDateRow}>
              <Ionicons name="calendar-outline" size={12} color={Colors.textMuted} />
              <Text style={styles.headerDateText}>{periodLabel}</Text>
            </View>
          </View>
        </View>

        {/* Period selector pills */}
        <View style={styles.periodRow}>
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p.key}
              style={[styles.periodBtn, period === p.key && styles.periodBtnActive]}
              onPress={() => setPeriod(p.key)}
            >
              <Text style={[styles.periodBtnText, period === p.key && styles.periodBtnTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Custom date range panel — visible only when Range is selected */}
      {period === 'custom' && (
        <DateRangePanel
          from={customFrom}
          to={customTo}
          onFromChange={setCustomFrom}
          onToChange={setCustomTo}
        />
      )}

      {/* Report type tabs — horizontal scroll so labels never get crushed */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabScroll}
        contentContainerStyle={styles.tabContent}
      >
        {REPORT_TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.reportTab, tab === t.key && styles.reportTabActive]}
            onPress={() => setTab(t.key)}
          >
            <Ionicons
              name={t.icon as any}
              size={14}
              color={tab === t.key ? Colors.textLight : Colors.textMuted}
            />
            <Text style={[styles.reportTabText, tab === t.key && styles.reportTabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {tab === 'fleet'     && <FleetReport         dateRange={dateRange} />}
        {tab === 'trips'     && <TripReport          dateRange={dateRange} />}
        {tab === 'drivers'   && <DriverReport        dateRange={dateRange} />}
        {tab === 'fuel'      && <FuelReport          dateRange={dateRange} />}
        {tab === 'accidents' && <AccidentReportSection dateRange={dateRange} />}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundLight },

  // Header
  header: {
    backgroundColor: Colors.cardBackground,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  headerDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  headerDateText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: '500',
  },

  periodRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: Radius.md,
    alignItems: 'center',
    backgroundColor: Colors.backgroundLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  periodBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  periodBtnText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  periodBtnTextActive: { color: Colors.textLight },

  // Custom range panel
  rangePanel: {
    backgroundColor: Colors.cardBackground,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  rangeInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  rangeField: { flex: 1, gap: 3 },
  rangeFieldLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary },
  rangeInput: {
    height: 36,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    backgroundColor: Colors.backgroundLight,
  },
  rangeSep: { fontSize: FontSize.lg, color: Colors.textMuted, paddingBottom: 8 },
  presetRow: { flexDirection: 'row', gap: Spacing.xs },
  presetBtn: {
    flex: 1,
    paddingVertical: 5,
    borderRadius: Radius.md,
    alignItems: 'center',
    backgroundColor: Colors.backgroundLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  presetBtnActive: { backgroundColor: Colors.accent + '18', borderColor: Colors.accent },
  presetBtnText: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  presetBtnTextActive: { color: Colors.accent },

  // Tab strip
  tabScroll: {
    backgroundColor: Colors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexGrow: 0,
  },
  tabContent: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
    flexDirection: 'row',
  },
  reportTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.backgroundLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reportTabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  reportTabText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textMuted },
  reportTabTextActive: { color: Colors.textLight },

  scroll: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  section: { gap: Spacing.sm },

  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: Radius.md,
    padding: Spacing.md,
    ...Shadow.sm,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  cardTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary, flex: 1 },
  cardBadge: {
    backgroundColor: Colors.accent + '18',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  cardBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.accent },

  utilizationRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm, marginBottom: Spacing.sm },
  utilizationPct: { fontSize: FontSize.xxxl, fontWeight: '800', color: Colors.primary },
  utilizationSub: { fontSize: FontSize.sm, color: Colors.textSecondary },
  progressTrack: { height: 8, backgroundColor: Colors.divider, borderRadius: Radius.full, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: Radius.full },

  statusGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  statusCell: { flex: 1, alignItems: 'center', gap: 3 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusCount: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textPrimary },
  statusLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '600' },
  statusPct: { fontSize: FontSize.xs, color: Colors.textMuted },

  statRow: { flexDirection: 'row', gap: Spacing.xs },
  statBox: {
    flex: 1,
    backgroundColor: Colors.cardBackground,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    alignItems: 'center',
    gap: 4,
    ...Shadow.sm,
  },
  statBoxIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  statBoxValue: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  statBoxLabel: { fontSize: 10, color: Colors.textMuted, textAlign: 'center' },

  summaryMetrics: { flexDirection: 'row', alignItems: 'center' },
  summaryMetric: { flex: 1, alignItems: 'center', gap: 2 },
  summaryDivider: { width: 1, height: 36, backgroundColor: Colors.divider },
  summaryMetricValue: { fontSize: FontSize.md, fontWeight: '800', color: Colors.textPrimary },
  summaryMetricLabel: { fontSize: FontSize.xs, color: Colors.textMuted },

  tripRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm },
  tripRowBorder: { borderTopWidth: 1, borderTopColor: Colors.divider },
  tripLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  tripRight: { alignItems: 'flex-end', gap: 3 },
  platePill: { backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  platePillText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },
  tripDriver: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  tripMeta: { fontSize: FontSize.xs, color: Colors.textSecondary },
  tripStatus: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.full },
  tripStatusActive: { backgroundColor: '#E8FAF0' },
  tripStatusDone: { backgroundColor: Colors.divider },
  tripStatusText: { fontSize: 10, fontWeight: '700' },
  tripSpeed: { fontSize: FontSize.xs, color: Colors.textMuted },

  driverHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  driverAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  driverAvatarText: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.textLight },
  driverInfo: { flex: 1 },
  driverName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  driverLicense: { fontSize: FontSize.xs, color: Colors.textMuted },
  incidentBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.warning + '20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full,
  },
  incidentBadgeText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.warning },
  driverMetrics: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: Colors.divider, paddingTop: Spacing.sm },
  driverMetric: { flex: 1, alignItems: 'center', gap: 2 },
  driverMetricValue: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  driverMetricLabel: { fontSize: 10, color: Colors.textMuted },

  fuelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm },
  fuelLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  fuelModel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  fuelMeta: { fontSize: FontSize.xs, color: Colors.textSecondary },
  fuelLevelWrap: { alignItems: 'flex-end', gap: 4, minWidth: 64 },
  fuelLevelPct: { fontSize: FontSize.sm, fontWeight: '800' },
  fuelBar: { width: 60, height: 6, backgroundColor: Colors.divider, borderRadius: Radius.full, overflow: 'hidden' },
  fuelBarFill: { height: '100%', borderRadius: Radius.full },

  eventRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, paddingVertical: Spacing.sm },
  eventDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4, flexShrink: 0 },
  eventInfo: { flex: 1 },
  eventTitle: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  eventStation: { fontSize: FontSize.xs, color: Colors.textSecondary },
  eventMeta: { fontSize: FontSize.xs, color: Colors.textMuted },

  emptyState: { alignItems: 'center', paddingVertical: 40, gap: Spacing.sm },
  emptyText: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: '600' },

  // Accident report styles
  dmgTotal: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.danger },
  dmgSub:   { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },

  accCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Shadow.sm,
    borderLeftWidth: 3,
    borderLeftColor: Colors.danger,
  },
  accHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  accHeaderMid: { flex: 1 },
  accDriver: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  accTime:   { fontSize: FontSize.xs, color: Colors.textMuted },

  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  severityText: { fontSize: 10, fontWeight: '800' },

  accLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  accLocation: { fontSize: FontSize.xs, color: Colors.textSecondary, flex: 1 },

  accDescription: { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 20 },

  accTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  accTag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  accTagText: { fontSize: 11, fontWeight: '600' },

  accFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  accDamage: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },

  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  statusDot2: { width: 7, height: 7, borderRadius: 4 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },

  accNotesRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, paddingTop: 2, borderTopWidth: 1, borderTopColor: Colors.divider },
  accNotes: { fontSize: FontSize.xs, color: Colors.textMuted, flex: 1, lineHeight: 18 },

  // Chart shared styles
  chartBar:       { width: '72%', borderRadius: 3 },
  chartBarValue:  { fontSize: 9, fontWeight: '700', color: Colors.textSecondary, marginBottom: 2 },
  chartBarLabel:  { fontSize: 9, color: Colors.textMuted, marginTop: 4, textAlign: 'center' },
  chartHLabel:    { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary, flex: 1, marginRight: 8 },
  chartHValue:    { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary },
  chartHTrack:    { height: 7, backgroundColor: Colors.divider, borderRadius: Radius.full, overflow: 'hidden' },
  chartHFill:     { height: '100%' as any, borderRadius: Radius.full },
  segTrack:       { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', gap: 2 },
  segFill:        { height: '100%' as any },
  segFillFirst:   { borderTopLeftRadius: 7, borderBottomLeftRadius: 7 },
  segFillLast:    { borderTopRightRadius: 7, borderBottomRightRadius: 7 },
  segLegend:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segLegendItem:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  segDot:         { width: 8, height: 8, borderRadius: 4 },
  segLegendText:  { fontSize: 10, color: Colors.textSecondary },
});
