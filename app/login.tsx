import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';

const DEMO_ACCOUNTS = [
  { email: 'admin@obt.zm',   role: 'Admin',   name: 'Chanda Mwape', initials: 'CM' },
  { email: 'manager@obt.zm', role: 'Manager', name: 'Mutale Phiri', initials: 'MP' },
  { email: 'viewer@obt.zm',  role: 'Viewer',  name: 'Kapambwe Banda', initials: 'KB' },
];

const ROLE_COLOR: Record<string, string> = {
  Admin:   '#E63946',
  Manager: '#3E92CC',
  Viewer:  '#2DC653',
};

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [showDemo, setShowDemo] = useState(false);

  const demoAnim    = useRef(new Animated.Value(0)).current;
  const passwordRef = useRef<TextInput>(null);

  const toggleDemo = () => {
    const next = !showDemo;
    setShowDemo(next);
    Animated.timing(demoAnim, {
      toValue: next ? 1 : 0,
      duration: 280,
      useNativeDriver: false,
    }).start();
  };

  const pickDemo = (acc: (typeof DEMO_ACCOUNTS)[0]) => {
    setEmail(acc.email);
    setPassword('obt2026');
    setError('');
    setShowDemo(false);
    Animated.timing(demoAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  };

  const handleLogin = async () => {
    setError('');
    if (!email.trim()) { setError('Please enter your email address.'); return; }
    if (!password)     { setError('Please enter your password.'); return; }
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.success) {
      router.replace('/(tabs)');
    } else {
      setError(result.error ?? 'Login failed.');
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0A2463" />

      {/* ── Blue header ───────────────────────────────── */}
      <View style={styles.header}>
        <View style={[styles.orb, styles.orb1]} />
        <View style={[styles.orb, styles.orb2]} />

        <SafeAreaView edges={['top']}>
          <View style={styles.headerContent}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <View style={styles.backBtnCircle}>
                <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            <View style={styles.logoCircle}>
              <Ionicons name="car-sport" size={28} color="#FFFFFF" />
            </View>
            <Text style={styles.headerBrand}>OBT MobileTracker</Text>
            <Text style={styles.headerSub}>Fleet Management Platform</Text>

            <View style={styles.headingBlock}>
              <Text style={styles.heading}>Welcome back</Text>
              <Text style={styles.subheading}>Sign in to your account</Text>
            </View>
          </View>
        </SafeAreaView>
      </View>

      {/* ── Form card ─────────────────────────────────── */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>

            {/* Error */}
            {!!error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={15} color="#E63946" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Email Address</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={17} color="#9CA3AF" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="you@obt.zm"
                  placeholderTextColor="#9CA3AF"
                  value={email}
                  onChangeText={(v) => { setEmail(v); setError(''); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>Password</Text>
                <TouchableOpacity>
                  <Text style={styles.forgotLink}>Forgot password?</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={17} color="#9CA3AF" style={styles.inputIcon} />
                <TextInput
                  ref={passwordRef}
                  style={[styles.input, styles.inputPassword]}
                  placeholder="Enter your password"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={(v) => { setPassword(v); setError(''); }}
                  secureTextEntry={!showPwd}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity onPress={() => setShowPwd((p) => !p)} style={styles.eyeBtn}>
                  <Ionicons
                    name={showPwd ? 'eye-off-outline' : 'eye-outline'}
                    size={17}
                    color="#9CA3AF"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Sign In */}
            <TouchableOpacity
              style={[styles.signInBtn, loading && styles.signInBtnLoading]}
              onPress={handleLogin}
              activeOpacity={0.85}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Text style={styles.signInBtnText}>Sign In</Text>
                  <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>

            {/* Demo toggle */}
            <TouchableOpacity style={styles.demoToggleRow} onPress={toggleDemo} activeOpacity={0.7}>
              <View style={styles.dividerLine} />
              <View style={styles.demoToggleChip}>
                <Ionicons name="flask-outline" size={12} color="#9CA3AF" />
                <Text style={styles.demoToggleText}>Try a demo account</Text>
                <Ionicons name={showDemo ? 'chevron-up' : 'chevron-down'} size={12} color="#9CA3AF" />
              </View>
              <View style={styles.dividerLine} />
            </TouchableOpacity>

            {/* Demo list (animated expand) */}
            <Animated.View
              style={{
                maxHeight: demoAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 210] }),
                overflow: 'hidden',
              }}
            >
              <View style={styles.demoList}>
                {DEMO_ACCOUNTS.map((acc) => (
                  <TouchableOpacity
                    key={acc.email}
                    style={styles.demoRow}
                    onPress={() => pickDemo(acc)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.demoAvatar}>
                      <Text style={styles.demoInitials}>{acc.initials}</Text>
                    </View>
                    <View style={styles.demoMeta}>
                      <Text style={styles.demoName}>{acc.name}</Text>
                      <Text style={styles.demoEmail}>{acc.email}</Text>
                    </View>
                    <View style={[styles.roleTag, { backgroundColor: ROLE_COLOR[acc.role] + '1A' }]}>
                      <Text style={[styles.roleTagText, { color: ROLE_COLOR[acc.role] }]}>{acc.role}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
                <Text style={styles.demoNote}>All accounts · password: obt2026</Text>
              </View>
            </Animated.View>

          </View>

          <Text style={styles.footer}>© 2026 OBT Systems · Lusaka, Zambia</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F7FA' },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: 32 },

  // Header
  header: { backgroundColor: '#0A2463', overflow: 'hidden' },
  orb: { position: 'absolute', borderRadius: 9999 },
  orb1: { width: 260, height: 260, backgroundColor: 'rgba(255,255,255,0.06)', top: -100, right: -80 },
  orb2: { width: 180, height: 180, backgroundColor: 'rgba(255,255,255,0.05)', top: 60,   left: -70  },

  headerContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 48,
    alignItems: 'center',
  },
  backBtn: { position: 'absolute', left: 16, top: 8 },
  backBtnCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#3E92CC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#3E92CC',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 6,
  },
  headerBrand: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },
  headerSub:   { fontSize: 11, color: 'rgba(255,255,255,0.42)', marginTop: 2 },

  headingBlock: { alignItems: 'center', marginTop: 26 },
  heading:    { fontSize: 28, fontWeight: '900', color: '#FFFFFF' },
  subheading: { fontSize: 14, color: 'rgba(255,255,255,0.48)', marginTop: 4 },

  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    marginHorizontal: 20,
    marginTop: -24,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 8,
  },

  // Error
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 11,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: { fontSize: 12.5, color: '#E63946', flex: 1 },

  // Fields
  fieldGroup: { marginBottom: 14 },
  labelRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  fieldLabel: { fontSize: 11.5, fontWeight: '700', color: '#374151', marginBottom: 6 },
  forgotLink: { fontSize: 11.5, fontWeight: '600', color: '#3E92CC' },

  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    height: 46,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 14, color: '#0D1B2A', height: '100%' },
  inputPassword: { paddingRight: 8 },
  eyeBtn: { padding: 4 },

  // Sign In
  signInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0A2463',
    borderRadius: 14,
    height: 50,
    marginTop: 6,
    marginBottom: 20,
    shadowColor: '#0A2463',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  signInBtnLoading: { opacity: 0.7 },
  signInBtnText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },

  // Demo toggle
  demoToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dividerLine:   { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  demoToggleChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  demoToggleText: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },

  // Demo list
  demoList: { paddingTop: 10, gap: 6 },
  demoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  demoAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#0A2463',
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoInitials: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },
  demoMeta:  { flex: 1 },
  demoName:  { fontSize: 12.5, fontWeight: '700', color: '#0D1B2A' },
  demoEmail: { fontSize: 10.5, color: '#6B7280' },
  roleTag:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  roleTagText: { fontSize: 10, fontWeight: '700' },
  demoNote: { fontSize: 10.5, color: '#9CA3AF', textAlign: 'center', marginTop: 4, marginBottom: 2 },

  footer: { fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: 24 },
});
