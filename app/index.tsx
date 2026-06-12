import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';

const FEATURES = [
  { icon: 'locate',           label: 'Live Tracking' },
  { icon: 'shield-checkmark', label: 'Geofencing' },
  { icon: 'water',            label: 'Fuel Mgmt' },
  { icon: 'bar-chart',        label: 'Smart Reports' },
  { icon: 'alert-circle',     label: 'Alerts' },
  { icon: 'car',              label: 'Trip History' },
];

export default function LandingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const logoScale   = useRef(new Animated.Value(0.7)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const fadeIn      = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (user) { router.replace('/(tabs)'); return; }

    Animated.parallel([
      Animated.spring(logoScale,   { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
      Animated.timing(logoOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(fadeIn,      { toValue: 1, duration: 600, delay: 200, useNativeDriver: true }),
    ]).start();
  }, [user]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0A2463" />

      {/* Decorative orbs */}
      <View style={[styles.orb, styles.orb1]} />
      <View style={[styles.orb, styles.orb2]} />
      <View style={[styles.orb, styles.orb3]} />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

        {/* ── Brand ─────────────────────────────────── */}
        <View style={styles.brandSection}>
          <Animated.View style={{ transform: [{ scale: logoScale }], opacity: logoOpacity }}>
            <View style={styles.logoRing}>
              <View style={styles.logoCore}>
                <Ionicons name="car-sport" size={36} color="#FFFFFF" />
              </View>
            </View>
          </Animated.View>

          <Animated.View style={[styles.brandTextWrap, { opacity: fadeIn }]}>
            <Text style={styles.brand}>OBT</Text>
            <Text style={styles.product}>MobileTracker</Text>
            <Text style={styles.tagline}>
              Real-time fleet intelligence{'\n'}for Zambia's roads
            </Text>
            <View style={styles.statsRow}>
              <Text style={styles.statChip}>6 Vehicles</Text>
              <View style={styles.statDot} />
              <Text style={styles.statChip}>5 Drivers</Text>
              <View style={styles.statDot} />
              <Text style={styles.statChip}>24/7 Monitoring</Text>
            </View>
          </Animated.View>
        </View>

        {/* ── Feature chips ─────────────────────────── */}
        <Animated.View style={[styles.chipsSection, { opacity: fadeIn }]}>
          <Text style={styles.chipsLabel}>PLATFORM FEATURES</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsScroll}
          >
            {FEATURES.map((f) => (
              <View key={f.label} style={styles.chip}>
                <Ionicons name={f.icon as any} size={15} color="#3E92CC" />
                <Text style={styles.chipText}>{f.label}</Text>
              </View>
            ))}
          </ScrollView>
        </Animated.View>

        {/* ── CTA ───────────────────────────────────── */}
        <Animated.View style={[styles.ctaSection, { opacity: fadeIn }]}>
          <TouchableOpacity
            style={styles.signInBtn}
            onPress={() => router.push('/login')}
            activeOpacity={0.85}
          >
            <Text style={styles.signInBtnText}>Sign In to Your Fleet</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.demoHint}>Demo: admin@obt.zm · obt2026</Text>
          <Text style={styles.footer}>© 2026 OBT Systems · Lusaka, Zambia</Text>
        </Animated.View>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A2463' },

  orb: { position: 'absolute', borderRadius: 9999, backgroundColor: '#FFFFFF' },
  orb1: { width: 380, height: 380, opacity: 0.04, top: -140,  right: -120 },
  orb2: { width: 260, height: 260, opacity: 0.05, top: 220,   left:  -110 },
  orb3: { width: 200, height: 200, opacity: 0.03, bottom: 60, right: -70  },

  safe: { flex: 1, paddingHorizontal: 24 },

  // Brand
  brandSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 8,
  },
  logoRing: {
    width: 106,
    height: 106,
    borderRadius: 53,
    borderWidth: 2,
    borderColor: 'rgba(62,146,204,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 26,
  },
  logoCore: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3E92CC',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3E92CC',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 18,
    elevation: 12,
  },
  brandTextWrap: { alignItems: 'center' },
  brand: {
    fontSize: 54,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 10,
    lineHeight: 58,
  },
  product: {
    fontSize: 16,
    fontWeight: '300',
    color: '#3E92CC',
    letterSpacing: 4,
    marginTop: 2,
    marginBottom: 14,
  },
  tagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 22,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statChip: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  statDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },

  // Feature chips
  chipsSection: { paddingBottom: 30 },
  chipsLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.28)',
    letterSpacing: 2,
    marginBottom: 10,
    textAlign: 'center',
  },
  chipsScroll: { gap: 8, paddingHorizontal: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipText: { fontSize: 12, color: 'rgba(255,255,255,0.72)', fontWeight: '600' },

  // CTA
  ctaSection: { paddingBottom: 8, gap: 10, alignItems: 'center' },
  signInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#3E92CC',
    borderRadius: 16,
    height: 56,
    width: '100%',
    shadowColor: '#3E92CC',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
  },
  signInBtnText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  demoHint: { fontSize: 12, color: 'rgba(255,255,255,0.32)', fontWeight: '500' },
  footer:   { fontSize: 10, color: 'rgba(255,255,255,0.18)' },
});
