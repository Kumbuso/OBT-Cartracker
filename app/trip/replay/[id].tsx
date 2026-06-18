import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { mockTrips } from '../../../data/mockData';
import { Colors, Radius, Shadow, FontSize } from '../../../constants/theme';
import TripReplayMap from '../../../components/TripReplayMap';

// ── Playback constants ─────────────────────────────────────────────────────────

const TICK_MS: Record<number, number> = { 1: 300, 2: 150, 4: 75 };

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtDuration(mins: number) {
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function TripReplayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const trip   = mockTrips.find((t) => t.id === id);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying,    setIsPlaying]    = useState(false);
  const [speed,        setSpeed]        = useState<1 | 2 | 4>(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const waypoints = trip?.route ?? [];
  const total     = waypoints.length;

  const clearTick = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  };

  const startTick = useCallback(() => {
    clearTick();
    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev >= total - 1) { clearTick(); setIsPlaying(false); return prev; }
        return prev + 1;
      });
    }, TICK_MS[speed]);
  }, [speed, total]);

  useEffect(() => {
    if (isPlaying) startTick();
    else           clearTick();
    return clearTick;
  }, [isPlaying, speed]);

  const togglePlay = () => {
    if (currentIndex >= total - 1) { setCurrentIndex(0); setIsPlaying(true); }
    else setIsPlaying((p) => !p);
  };

  const reset = () => { clearTick(); setCurrentIndex(0); setIsPlaying(false); };

  const seek = (delta: number) =>
    setCurrentIndex((i) => Math.max(0, Math.min(total - 1, i + delta)));

  const cycleSpeed = () => setSpeed((s) => s === 1 ? 2 : s === 2 ? 4 : 1);

  // ── No route ────────────────────────────────────────────────────────────────

  if (!trip || !waypoints.length) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.notFound}>
          <Ionicons name="navigate-outline" size={48} color={Colors.textMuted} />
          <Text style={s.notFoundText}>No route data for this trip</Text>
          <TouchableOpacity style={s.goBackBtn} onPress={() => router.back()}>
            <Text style={s.goBackBtnText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Derived values ──────────────────────────────────────────────────────────

  const current      = waypoints[currentIndex];
  const progress     = total > 1 ? currentIndex / (total - 1) : 0;
  const pct          = Math.round(progress * 100);
  const distSoFar    = (trip.distance * progress).toFixed(1);
  const startMs      = new Date(waypoints[0].timestamp).getTime();
  const currentMs    = new Date(current.timestamp).getTime();
  const elapsedMins  = Math.round((currentMs - startMs) / 60_000);
  const isDone       = currentIndex >= total - 1;
  const statusLabel  = isPlaying ? 'PLAYING' : isDone ? 'DONE' : 'PAUSED';
  const statusColor  = isPlaying ? Colors.statusActive : isDone ? Colors.accent : Colors.textMuted;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Full-screen replay map */}
      <TripReplayMap waypoints={waypoints} currentIndex={currentIndex} />

      {/* ── Top overlay ── */}
      <SafeAreaView style={s.topOverlay} edges={['top']}>
        <View style={s.topRow}>
          <TouchableOpacity style={s.iconBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>

          <View style={s.topCard}>
            <View style={s.topCardLeft}>
              <Text style={s.topPlate}>{trip.vehiclePlate}</Text>
              <Text style={s.topMeta}>{trip.driverName}  ·  {fmtDate(trip.startTime)}</Text>
            </View>
            <View style={[s.statusPill, { borderColor: statusColor + '40', backgroundColor: statusColor + '12' }]}>
              {isPlaying && <View style={[s.liveDot, { backgroundColor: statusColor }]} />}
              <Text style={[s.statusText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>

      {/* ── Speed badge (floating, right side) ── */}
      <View style={s.speedBadge}>
        <Ionicons name="speedometer-outline" size={14} color={Colors.accent} />
        <Text style={s.speedBadgeKmh}>{current.speed}</Text>
        <Text style={s.speedBadgeUnit}>km/h</Text>
      </View>

      {/* ── Bottom controls panel ── */}
      <SafeAreaView style={s.panel} edges={['bottom']}>

        {/* Stats row */}
        <View style={s.statsRow}>
          <StatChip icon="navigate-outline"  value={`${distSoFar} km`}        label="Distance" />
          <StatChip icon="time-outline"      value={fmtDuration(elapsedMins)} label="Elapsed" />
          <StatChip icon="flash-outline"     value={`${pct}%`}                label="Progress" color={Colors.accent} />
          <StatChip icon="trending-up-outline" value={`${trip.maxSpeed} km/h`} label="Max Speed" />
        </View>

        {/* Progress bar */}
        <View style={s.progressWrap}>
          <View style={s.progressBg}>
            <View style={[s.progressFill, { width: `${pct}%` as any }]} />
          </View>
          <View style={s.progressTimes}>
            <Text style={s.progressTime}>{fmtTime(waypoints[0].timestamp)}</Text>
            <Text style={s.progressTime}>{fmtTime(waypoints[total - 1].timestamp)}</Text>
          </View>
        </View>

        {/* Playback controls */}
        <View style={s.controls}>
          {/* Reset to start */}
          <TouchableOpacity style={s.ctrlBtn} onPress={reset}>
            <Ionicons name="play-skip-back" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>

          {/* Rewind 5 steps */}
          <TouchableOpacity style={s.ctrlBtn} onPress={() => seek(-5)}>
            <Ionicons name="play-back" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>

          {/* Play / Pause */}
          <TouchableOpacity style={s.playBtn} onPress={togglePlay} activeOpacity={0.85}>
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={30} color="#FFF" />
          </TouchableOpacity>

          {/* Forward 5 steps */}
          <TouchableOpacity style={s.ctrlBtn} onPress={() => seek(5)}>
            <Ionicons name="play-forward" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>

          {/* Speed toggle */}
          <TouchableOpacity style={s.speedToggle} onPress={cycleSpeed}>
            <Text style={s.speedToggleText}>{speed}×</Text>
          </TouchableOpacity>
        </View>

      </SafeAreaView>
    </View>
  );
}

// ── Sub-component ─────────────────────────────────────────────────────────────

function StatChip({
  icon, value, label, color,
}: { icon: string; value: string; label: string; color?: string }) {
  return (
    <View style={s.statChip}>
      <Ionicons name={icon as any} size={13} color={color ?? Colors.textMuted} />
      <Text style={[s.statValue, color ? { color } : {}]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.backgroundLight },
  safe: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  notFound:     { alignItems: 'center', gap: 12 },
  notFoundText: { fontSize: FontSize.lg, color: Colors.textSecondary },
  goBackBtn:    { marginTop: 8, paddingHorizontal: 24, paddingVertical: 11, backgroundColor: Colors.primary, borderRadius: Radius.md },
  goBackBtnText:{ fontSize: FontSize.md, fontWeight: '700', color: '#FFF' },

  // Top overlay
  topOverlay: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000 },
  topRow:     { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, paddingTop: 6 },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    ...Shadow.sm,
  },
  topCard: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 8, gap: 10,
    ...Shadow.sm,
  },
  topCardLeft:  { flex: 1 },
  topPlate:     { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  topMeta:      { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  statusPill:   { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: Radius.full, paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1 },
  liveDot:      { width: 6, height: 6, borderRadius: 3 },
  statusText:   { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.6 },

  // Speed badge
  speedBadge: {
    position: 'absolute', right: 14, top: '45%', zIndex: 999,
    flexDirection: 'row', alignItems: 'baseline', gap: 3,
    backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: Radius.md,
    paddingHorizontal: 11, paddingVertical: 8,
    ...Shadow.md,
  },
  speedBadgeKmh:  { fontSize: 22, fontWeight: '900', color: Colors.textPrimary },
  speedBadgeUnit: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },

  // Bottom panel
  panel: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 1000,
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderTopWidth: 1, borderTopColor: Colors.border,
    paddingHorizontal: 16, paddingTop: 12,
    ...Shadow.lg,
  },

  // Stats
  statsRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  statChip: { flex: 1, alignItems: 'center', gap: 3 },
  statValue:{ fontSize: 13, fontWeight: '800', color: Colors.textPrimary },
  statLabel:{ fontSize: 9.5, color: Colors.textMuted },

  // Progress bar
  progressWrap: { marginBottom: 12 },
  progressBg: {
    height: 5, backgroundColor: Colors.border, borderRadius: 3,
    overflow: 'hidden', marginBottom: 5,
  },
  progressFill: { height: '100%', backgroundColor: Colors.accent, borderRadius: 3 },
  progressTimes:{ flexDirection: 'row', justifyContent: 'space-between' },
  progressTime: { fontSize: 10, color: Colors.textMuted },

  // Controls
  controls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 14, paddingBottom: 6,
  },
  ctrlBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.backgroundLight,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  playBtn: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    ...Shadow.md, shadowColor: Colors.primary,
  },
  speedToggle: {
    width: 54, height: 44, borderRadius: 22,
    backgroundColor: Colors.accent + '12',
    borderWidth: 1.5, borderColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  speedToggleText: { fontSize: 14, fontWeight: '800', color: Colors.accent },
});
