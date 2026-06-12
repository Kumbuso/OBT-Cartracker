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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();

  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [showPwd,     setShowPwd]     = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const passwordRef = useRef<TextInput>(null);

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

      {/* Top decoration */}
      <View style={styles.topBg}>
        <View style={[styles.circle, styles.c1]} />
        <View style={[styles.circle, styles.c2]} />

        <SafeAreaView edges={['top']}>
          <View style={styles.topContent}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>

            <View style={styles.logoWrap}>
              <View style={styles.logoInner}>
                <Ionicons name="car-sport" size={30} color="#0A2463" />
              </View>
            </View>
            <Text style={styles.topBrand}>OBT MobileTracker</Text>
            <Text style={styles.topSub}>Fleet Management Platform</Text>
          </View>
        </SafeAreaView>
      </View>

      {/* Login card */}
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
            <Text style={styles.heading}>Welcome back</Text>
            <Text style={styles.subheading}>Sign in to continue</Text>

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
                <Ionicons name="mail-outline" size={18} color="#9CA3AF" style={styles.inputIcon} />
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
              <Text style={styles.fieldLabel}>Password</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={18} color="#9CA3AF" style={styles.inputIcon} />
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
                    size={18}
                    color="#9CA3AF"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Sign In button */}
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
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>

            {/* Demo accounts */}
            <View style={styles.demoBox}>
              <View style={styles.demoHeaderRow}>
                <View style={styles.demoDivider} />
                <Text style={styles.demoLabel}>Demo Accounts</Text>
                <View style={styles.demoDivider} />
              </View>
              {[
                { email: 'admin@obt.zm',   role: 'Admin',   name: 'Chanda Mwape' },
                { email: 'manager@obt.zm', role: 'Manager', name: 'Mutale Phiri' },
              ].map((a) => (
                <TouchableOpacity
                  key={a.email}
                  style={styles.demoRow}
                  onPress={() => { setEmail(a.email); setPassword('obt2026'); setError(''); }}
                >
                  <View style={styles.demoAvatar}>
                    <Text style={styles.demoAvatarText}>{a.name.split(' ').map((n) => n[0]).join('')}</Text>
                  </View>
                  <View style={styles.demoInfo}>
                    <Text style={styles.demoName}>{a.name}</Text>
                    <Text style={styles.demoEmail}>{a.email}</Text>
                  </View>
                  <View style={styles.demoRoleBadge}>
                    <Text style={styles.demoRoleText}>{a.role}</Text>
                  </View>
                </TouchableOpacity>
              ))}
              <Text style={styles.demoPassword}>Password for all accounts: obt2026</Text>
            </View>
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

  // Top blue section
  topBg: {
    backgroundColor: '#0A2463',
    paddingBottom: 32,
    overflow: 'hidden',
  },
  circle: {
    position: 'absolute',
    borderRadius: 9999,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  c1: { width: 260, height: 260, top: -100, right: -80 },
  c2: { width: 180, height: 180, top: 40, left: -70 },
  topContent: { alignItems: 'center', paddingHorizontal: 24, paddingBottom: 8, paddingTop: 8 },
  backBtn: {
    position: 'absolute',
    left: 16,
    top: 8,
    padding: 8,
  },
  logoWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#3E92CC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#3E92CC',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  logoInner: { alignItems: 'center', justifyContent: 'center' },
  topBrand: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },
  topSub:   { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 3 },

  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    marginHorizontal: 20,
    marginTop: -20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
  heading:    { fontSize: 22, fontWeight: '800', color: '#0D1B2A', marginBottom: 2 },
  subheading: { fontSize: 14, color: '#9CA3AF', marginBottom: 20 },

  // Error
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: { fontSize: 13, color: '#E63946', flex: 1 },

  // Fields
  fieldGroup: { marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 6 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    height: 48,
  },
  inputIcon: { marginRight: 8 },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#0D1B2A',
    height: '100%',
  },
  inputPassword: { paddingRight: 8 },
  eyeBtn: { padding: 4 },

  // Sign In button
  signInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0A2463',
    borderRadius: 14,
    height: 50,
    marginTop: 4,
    marginBottom: 24,
    shadowColor: '#0A2463',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  signInBtnLoading: { opacity: 0.7 },
  signInBtnText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },

  // Demo accounts
  demoBox: { gap: 10 },
  demoHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  demoDivider: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  demoLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },
  demoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  demoAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0A2463',
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoAvatarText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
  demoInfo: { flex: 1 },
  demoName:  { fontSize: 13, fontWeight: '700', color: '#0D1B2A' },
  demoEmail: { fontSize: 11, color: '#6B7280' },
  demoRoleBadge: {
    backgroundColor: '#EEF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  demoRoleText: { fontSize: 10, fontWeight: '700', color: '#3E92CC' },
  demoPassword: { fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: 2 },

  footer: { fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: 24 },
});
