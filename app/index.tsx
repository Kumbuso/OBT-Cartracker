import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';

const { width, height } = Dimensions.get('window');

const FEATURES = [
  {
    icon: 'locate',
    title: 'Live Tracking',
    desc: 'Real-time GPS positions for every vehicle across Zambia.',
  },
  {
    icon: 'shield-checkmark',
    title: 'Geofencing',
    desc: 'Draw zones on the map and get instant entry/exit alerts.',
  },
  {
    icon: 'water',
    title: 'Fuel Management',
    desc: 'Monitor consumption, refuelling costs and efficiency.',
  },
  {
    icon: 'bar-chart',
    title: 'Smart Reports',
    desc: 'Custom date-range reports: trips, drivers, fuel and accidents.',
  },
];

const STATS = [
  { value: '6', label: 'Vehicles' },
  { value: '5', label: 'Drivers' },
  { value: '24/7', label: 'Monitoring' },
];

export default function LandingScreen() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (user) router.replace('/(tabs)');
  }, [user]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0A2463" />

      {/* Decorative background circles */}
      <View style={[styles.circle, styles.circle1]} />
      <View style={[styles.circle, styles.circle2]} />
      <View style={[styles.circle, styles.circle3]} />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* ── Hero ────────────────────────────────────── */}
          <View style={styles.hero}>
            <View style={styles.logoWrap}>
              <View style={styles.logoOuter}>
                <View style={styles.logoInner}>
                  <Ionicons name="car-sport" size={36} color="#0A2463" />
                </View>
              </View>
            </View>

            <Text style={styles.brand}>OBT</Text>
            <Text style={styles.product}>MobileTracker</Text>
            <Text style={styles.tagline}>
              Real-time fleet intelligence{'\n'}for Zambia's roads
            </Text>

            {/* Stats bar */}
            <View style={styles.statsBar}>
              {STATS.map((s, i) => (
                <React.Fragment key={s.label}>
                  {i > 0 && <View style={styles.statsDivider} />}
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{s.value}</Text>
                    <Text style={styles.statLabel}>{s.label}</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>
          </View>

          {/* ── Features ────────────────────────────────── */}
          <View style={styles.featuresWrap}>
            <Text style={styles.sectionHeading}>Everything your fleet needs</Text>
            <View style={styles.featureGrid}>
              {FEATURES.map((f) => (
                <View key={f.title} style={styles.featureCard}>
                  <View style={styles.featureIconWrap}>
                    <Ionicons name={f.icon as any} size={22} color="#3E92CC" />
                  </View>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureDesc}>{f.desc}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* ── CTA ─────────────────────────────────────── */}
          <View style={styles.ctaWrap}>
            <TouchableOpacity
              style={styles.signInBtn}
              onPress={() => router.push('/login')}
              activeOpacity={0.85}
            >
              <Ionicons name="log-in-outline" size={20} color="#0A2463" />
              <Text style={styles.signInBtnText}>Sign In to Your Fleet</Text>
            </TouchableOpacity>

            <Text style={styles.demoHint}>
              Demo: admin@obt.zm · obt2026
            </Text>

            <Text style={styles.footer}>
              © 2026 OBT Systems · Lusaka, Zambia
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A2463',
  },

  // Decorative circles
  circle: {
    position: 'absolute',
    borderRadius: 9999,
    opacity: 0.06,
    backgroundColor: '#FFFFFF',
  },
  circle1: { width: 420, height: 420, top: -160, right: -140 },
  circle2: { width: 300, height: 300, top: 200, left: -130 },
  circle3: { width: 220, height: 220, bottom: 80, right: -60 },

  safe: { flex: 1 },
  scroll: { flexGrow: 1 },

  // Hero
  hero: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  logoWrap: { marginBottom: 20 },
  logoOuter: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: 'rgba(62,146,204,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#3E92CC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    fontSize: 46,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 6,
    lineHeight: 50,
  },
  product: {
    fontSize: 18,
    fontWeight: '300',
    color: '#3E92CC',
    letterSpacing: 3,
    marginTop: 2,
    marginBottom: 16,
  },
  tagline: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },

  // Stats bar
  statsBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statsDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 4 },
  statValue: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: '500' },

  // Features
  featuresWrap: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 28,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0D1B2A',
    marginBottom: 16,
    textAlign: 'center',
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  featureCard: {
    width: (width - 52) / 2,
    backgroundColor: '#F5F7FA',
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  featureIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EEF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  featureTitle: { fontSize: 13, fontWeight: '700', color: '#0D1B2A' },
  featureDesc: { fontSize: 11, color: '#6B7280', lineHeight: 16 },

  // CTA
  ctaWrap: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 32,
    alignItems: 'center',
    gap: 12,
  },
  signInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3E92CC',
    borderRadius: 14,
    paddingVertical: 15,
    width: '100%',
    shadowColor: '#3E92CC',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  signInBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  demoHint: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  footer: {
    fontSize: 11,
    color: '#C4CAD4',
    marginTop: 4,
  },
});
