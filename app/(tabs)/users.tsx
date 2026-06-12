import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  FlatList,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize, Shadow } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useUserManagement } from '../../context/UserManagementContext';
import type {
  Organization, SystemUser,
  OrgPlan, OrgStatus, UserRole, UserStatus,
} from '../../types';

// ─── Color maps ───────────────────────────────────────────────────────────────

const PLAN_META: Record<OrgPlan, { label: string; color: string; bg: string }> = {
  basic:      { label: 'Basic',      color: '#6B7280', bg: '#F3F4F6' },
  pro:        { label: 'Pro',        color: '#3E92CC', bg: '#EBF5FB' },
  enterprise: { label: 'Enterprise', color: '#7C3AED', bg: '#F3E8FF' },
};

const ORG_STATUS_META: Record<OrgStatus, { label: string; color: string; bg: string }> = {
  active:    { label: 'Active',    color: Colors.statusActive,  bg: '#E8FAF0' },
  suspended: { label: 'Suspended', color: Colors.danger,        bg: '#FEE8EA' },
  trial:     { label: 'Trial',     color: Colors.warning,       bg: '#FFF4E6' },
};

const USER_STATUS_META: Record<UserStatus, { label: string; color: string; bg: string }> = {
  active:    { label: 'Active',    color: Colors.statusActive, bg: '#E8FAF0' },
  suspended: { label: 'Suspended', color: Colors.danger,       bg: '#FEE8EA' },
  pending:   { label: 'Pending',   color: Colors.accent,       bg: '#EBF5FB' },
};

const ROLE_META: Record<UserRole, { label: string; color: string; bg: string }> = {
  admin:   { label: 'Admin',   color: '#7C3AED', bg: '#F3E8FF' },
  manager: { label: 'Manager', color: Colors.primary, bg: '#E8EDF8' },
  viewer:  { label: 'Viewer',  color: Colors.textSecondary, bg: '#F3F4F6' },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZM', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtLoginAgo(iso?: string) {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  return `${d}d ago`;
}

// ─── Shared badge ─────────────────────────────────────────────────────────────

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

// ─── Organization Card ────────────────────────────────────────────────────────

function OrgCard({
  org,
  onToggleStatus,
}: {
  org: Organization;
  onToggleStatus: (id: string) => void;
}) {
  const planMeta   = PLAN_META[org.plan];
  const statusMeta = ORG_STATUS_META[org.status];

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.orgIconWrap}>
          <Ionicons name="business" size={20} color={Colors.primary} />
        </View>
        <View style={styles.cardTitleBlock}>
          <Text style={styles.cardName} numberOfLines={1}>{org.name}</Text>
          <Text style={styles.cardSub}>{org.city} · {planMeta.label} Plan</Text>
        </View>
        <Badge label={statusMeta.label} color={statusMeta.color} bg={statusMeta.bg} />
      </View>

      <View style={styles.cardStats}>
        <StatChip icon="people" value={String(org.userCount)}           label="Users" />
        <StatChip icon="car"    value={`${org.vehicleCount}/${org.vehicleLimit}`} label="Vehicles" />
        <StatChip icon="calendar" value={fmtDate(org.createdAt)}        label="Joined" />
      </View>

      <View style={styles.cardFooter}>
        <View>
          <Text style={styles.contactLabel}>Contact</Text>
          <Text style={styles.contactValue}>{org.contactName} · {org.contactEmail}</Text>
        </View>
        <TouchableOpacity
          style={[styles.actionBtn, org.status === 'active' ? styles.actionBtnDanger : styles.actionBtnSuccess]}
          onPress={() => onToggleStatus(org.id)}
        >
          <Ionicons
            name={org.status === 'active' ? 'ban' : 'checkmark-circle'}
            size={14}
            color={org.status === 'active' ? Colors.danger : Colors.statusActive}
          />
          <Text style={[styles.actionBtnText, { color: org.status === 'active' ? Colors.danger : Colors.statusActive }]}>
            {org.status === 'active' ? 'Suspend' : 'Activate'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── User Card ────────────────────────────────────────────────────────────────

function UserCard({
  user,
  showOrg,
  onToggleStatus,
}: {
  user: SystemUser;
  showOrg: boolean;
  onToggleStatus: (id: string) => void;
}) {
  const statusMeta = USER_STATUS_META[user.status];
  const roleMeta   = ROLE_META[user.role];

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.userAvatar}>
          <Text style={styles.userInitials}>{user.initials}</Text>
        </View>
        <View style={styles.cardTitleBlock}>
          <Text style={styles.cardName}>{user.name}</Text>
          <Text style={styles.cardSub}>{user.email}</Text>
          {showOrg && <Text style={styles.cardOrg}>{user.orgName}</Text>}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Badge label={roleMeta.label}   color={roleMeta.color}   bg={roleMeta.bg} />
          <Badge label={statusMeta.label} color={statusMeta.color} bg={statusMeta.bg} />
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.loginRow}>
          <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
          <Text style={styles.loginText}>
            Last login: {fmtLoginAgo(user.lastLogin)}
          </Text>
          <Text style={styles.joinedText}>Joined {fmtDate(user.createdAt)}</Text>
        </View>
        {user.status !== 'pending' && (
          <TouchableOpacity
            style={[styles.actionBtn, user.status === 'active' ? styles.actionBtnDanger : styles.actionBtnSuccess]}
            onPress={() => onToggleStatus(user.id)}
          >
            <Ionicons
              name={user.status === 'active' ? 'ban' : 'checkmark-circle'}
              size={14}
              color={user.status === 'active' ? Colors.danger : Colors.statusActive}
            />
            <Text style={[styles.actionBtnText, { color: user.status === 'active' ? Colors.danger : Colors.statusActive }]}>
              {user.status === 'active' ? 'Suspend' : 'Activate'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function StatChip({ icon, value, label }: { icon: any; value: string; label: string }) {
  return (
    <View style={styles.statChip}>
      <Ionicons name={icon} size={12} color={Colors.textMuted} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Add Organization Modal ───────────────────────────────────────────────────

const PLANS: OrgPlan[] = ['basic', 'pro', 'enterprise'];

function AddOrgModal({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (org: Omit<Organization, 'id' | 'createdAt' | 'userCount' | 'vehicleCount'>) => void;
}) {
  const [name,      setName]      = useState('');
  const [contact,   setContact]   = useState('');
  const [email,     setEmail]     = useState('');
  const [phone,     setPhone]     = useState('+260 ');
  const [city,      setCity]      = useState('');
  const [plan,      setPlan]      = useState<OrgPlan>('pro');
  const [limit,     setLimit]     = useState('20');
  const [saving,    setSaving]    = useState(false);
  const [errors,    setErrors]    = useState<Record<string, string>>({});

  const reset = () => { setName(''); setContact(''); setEmail(''); setPhone('+260 '); setCity(''); setPlan('pro'); setLimit('20'); setErrors({}); };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim())    e.name    = 'Required';
    if (!contact.trim()) e.contact = 'Required';
    if (!email.trim() || !email.includes('@')) e.email = 'Valid email required';
    if (!city.trim())    e.city    = 'Required';
    const l = Number(limit); if (isNaN(l) || l < 1) e.limit = 'Min 1';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    await new Promise((r) => setTimeout(r, 500));
    onSave({ name: name.trim(), contactName: contact.trim(), contactEmail: email.trim(), phone: phone.trim(), city: city.trim(), plan, status: 'trial', vehicleLimit: Number(limit) });
    setSaving(false);
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={styles.overlayBg} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>New Client Account</Text>
              <Text style={styles.sheetSub}>Create an organization account</Text>
            </View>
            <TouchableOpacity onPress={() => { reset(); onClose(); }}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <ModalField label="Organization Name" icon="business-outline" value={name} onChange={(v) => { setName(v); setErrors((e) => ({ ...e, name: '' })); }} placeholder="e.g. Zambia Courier Services Ltd" error={errors.name} />
            <ModalField label="Contact Person"    icon="person-outline"   value={contact} onChange={(v) => { setContact(v); setErrors((e) => ({ ...e, contact: '' })); }} placeholder="Full name" error={errors.contact} />
            <ModalField label="Contact Email"     icon="mail-outline"     value={email}   onChange={(v) => { setEmail(v); setErrors((e) => ({ ...e, email: '' })); }} placeholder="contact@company.zm" keyboardType="email-address" autoCapitalize="none" error={errors.email} />
            <ModalField label="Phone"             icon="call-outline"     value={phone}   onChange={(v) => { setPhone(v); }} placeholder="+260 97 xxx xxxx" keyboardType="phone-pad" />
            <ModalField label="City"              icon="location-outline" value={city}    onChange={(v) => { setCity(v); setErrors((e) => ({ ...e, city: '' })); }} placeholder="e.g. Lusaka" error={errors.city} />

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Plan</Text>
              <View style={styles.chipRow}>
                {PLANS.map((p) => (
                  <TouchableOpacity key={p} style={[styles.chip, plan === p && styles.chipActive]} onPress={() => setPlan(p)}>
                    <Text style={[styles.chipText, plan === p && styles.chipTextActive]}>
                      {PLAN_META[p].label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <ModalField label="Vehicle Limit" icon="car-outline" value={limit} onChange={(v) => { setLimit(v); setErrors((e) => ({ ...e, limit: '' })); }} placeholder="20" keyboardType="number-pad" error={errors.limit} />

            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={16} color={Colors.accent} />
              <Text style={styles.infoText}>New accounts start on a Trial status. Activate them after setup is complete.</Text>
            </View>

            <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#FFF" size="small" /> : <><Ionicons name="business" size={18} color="#FFF" /><Text style={styles.saveBtnText}>Create Account</Text></>}
            </TouchableOpacity>
            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Add User Modal ───────────────────────────────────────────────────────────

function AddUserModal({
  visible,
  onClose,
  onSave,
  orgId,
  organizations,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (user: Omit<SystemUser, 'id' | 'createdAt' | 'initials'>) => void;
  orgId: string | null;
  organizations: Organization[];
}) {
  const [name,      setName]      = useState('');
  const [email,     setEmail]     = useState('');
  const [phone,     setPhone]     = useState('+260 ');
  const [role,      setRole]      = useState<'manager' | 'viewer'>('viewer');
  const [selectedOrg, setSelectedOrg] = useState<string>(orgId ?? organizations[0]?.id ?? '');
  const [saving,    setSaving]    = useState(false);
  const [errors,    setErrors]    = useState<Record<string, string>>({});

  const isAdminAdding = orgId === null;

  const reset = () => { setName(''); setEmail(''); setPhone('+260 '); setRole('viewer'); setSelectedOrg(orgId ?? organizations[0]?.id ?? ''); setErrors({}); };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Required';
    if (!email.trim() || !email.includes('@')) e.email = 'Valid email required';
    if (!selectedOrg) e.org = 'Select an organization';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    await new Promise((r) => setTimeout(r, 500));
    const org = organizations.find((o) => o.id === selectedOrg);
    onSave({
      name:     name.trim(),
      email:    email.trim(),
      phone:    phone.trim(),
      role,
      orgId:    selectedOrg,
      orgName:  org?.name ?? '',
      status:   'pending',
    });
    setSaving(false);
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={styles.overlayBg} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Add System User</Text>
              <Text style={styles.sheetSub}>They will receive a login invite</Text>
            </View>
            <TouchableOpacity onPress={() => { reset(); onClose(); }}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <ModalField label="Full Name"  icon="person-outline" value={name}  onChange={(v) => { setName(v); setErrors((e) => ({ ...e, name: '' })); }} placeholder="e.g. Bwalya Mutondo" error={errors.name} />
            <ModalField label="Email"      icon="mail-outline"   value={email} onChange={(v) => { setEmail(v); setErrors((e) => ({ ...e, email: '' })); }} placeholder="user@company.zm" keyboardType="email-address" autoCapitalize="none" error={errors.email} />
            <ModalField label="Phone"      icon="call-outline"   value={phone} onChange={(v) => setPhone(v)} placeholder="+260 97 xxx xxxx" keyboardType="phone-pad" />

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Role</Text>
              <View style={styles.chipRow}>
                {(['manager', 'viewer'] as const).map((r) => (
                  <TouchableOpacity key={r} style={[styles.chip, styles.chipWide, role === r && styles.chipActive]} onPress={() => setRole(r)}>
                    <Ionicons name={r === 'manager' ? 'shield-half' : 'eye'} size={14} color={role === r ? '#FFF' : Colors.textSecondary} />
                    <Text style={[styles.chipText, role === r && styles.chipTextActive]}>
                      {r === 'manager' ? 'Manager' : 'Viewer'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.roleHint}>
                {role === 'manager' ? 'Can manage vehicles, drivers, and add users to their org.' : 'Read-only access to fleet data.'}
              </Text>
            </View>

            {isAdminAdding && (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Organization</Text>
                {!!errors.org && <Text style={styles.fieldError}>{errors.org}</Text>}
                <ScrollView>
                  {organizations.map((org) => (
                    <TouchableOpacity
                      key={org.id}
                      style={[styles.orgPickerRow, selectedOrg === org.id && styles.orgPickerRowActive]}
                      onPress={() => { setSelectedOrg(org.id); setErrors((e) => ({ ...e, org: '' })); }}
                    >
                      <View style={styles.orgPickerIcon}>
                        <Ionicons name="business" size={14} color={selectedOrg === org.id ? Colors.textLight : Colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.orgPickerName, selectedOrg === org.id && styles.orgPickerNameActive]}>{org.name}</Text>
                        <Text style={styles.orgPickerSub}>{org.city} · {PLAN_META[org.plan].label}</Text>
                      </View>
                      {selectedOrg === org.id && <Ionicons name="checkmark-circle" size={18} color={Colors.textLight} />}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {!isAdminAdding && (
              <View style={styles.infoBox}>
                <Ionicons name="business-outline" size={16} color={Colors.accent} />
                <Text style={styles.infoText}>User will be added to your organization: <Text style={{ fontWeight: '700' }}>{organizations.find((o) => o.id === orgId)?.name}</Text></Text>
              </View>
            )}

            <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#FFF" size="small" /> : <><Ionicons name="person-add" size={18} color="#FFF" /><Text style={styles.saveBtnText}>Add User</Text></>}
            </TouchableOpacity>
            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Shared Modal Field ───────────────────────────────────────────────────────

function ModalField({
  label, icon, value, onChange, placeholder, keyboardType, autoCapitalize, error,
}: {
  label: string; icon: string; value: string; onChange: (v: string) => void;
  placeholder: string; keyboardType?: any; autoCapitalize?: any; error?: string;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputWrap, !!error && styles.inputWrapError]}>
        <Ionicons name={icon as any} size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          keyboardType={keyboardType ?? 'default'}
          autoCapitalize={autoCapitalize ?? 'words'}
          autoCorrect={false}
        />
      </View>
      {!!error && <Text style={styles.fieldError}>{error}</Text>}
    </View>
  );
}

// ─── Organizations View ───────────────────────────────────────────────────────

function OrgsView({ onAddOrg }: { onAddOrg: () => void }) {
  const { organizations, toggleOrgStatus } = useUserManagement();
  const active    = organizations.filter((o) => o.status === 'active').length;
  const suspended = organizations.filter((o) => o.status === 'suspended').length;
  const trial     = organizations.filter((o) => o.status === 'trial').length;

  return (
    <ScrollView contentContainerStyle={styles.listContent}>
      {/* Summary row */}
      <View style={styles.summaryRow}>
        <SummaryPill icon="business"         value={String(organizations.length)} label="Total"     color={Colors.primary} />
        <SummaryPill icon="checkmark-circle" value={String(active)}               label="Active"    color={Colors.statusActive} />
        <SummaryPill icon="flask"            value={String(trial)}                label="Trial"     color={Colors.warning} />
        <SummaryPill icon="ban"              value={String(suspended)}            label="Suspended" color={Colors.danger} />
      </View>

      {organizations.map((org) => (
        <OrgCard key={org.id} org={org} onToggleStatus={toggleOrgStatus} />
      ))}

      <TouchableOpacity style={styles.addFab} onPress={onAddOrg}>
        <Ionicons name="add" size={22} color="#FFF" />
        <Text style={styles.addFabText}>New Client Account</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── System Users View ────────────────────────────────────────────────────────

function UsersView({
  orgFilter,
  onAddUser,
  showOrgName,
  organizations,
}: {
  orgFilter: string | null;
  onAddUser: () => void;
  showOrgName: boolean;
  organizations: Organization[];
}) {
  const { systemUsers, toggleUserStatus } = useUserManagement();
  const [roleFilter, setRoleFilter] = useState<'all' | 'manager' | 'viewer'>('all');
  const [orgChipFilter, setOrgChipFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    let list = systemUsers;
    if (orgFilter) list = list.filter((u) => u.orgId === orgFilter);
    if (orgChipFilter !== 'all') list = list.filter((u) => u.orgId === orgChipFilter);
    if (roleFilter !== 'all') list = list.filter((u) => u.role === roleFilter);
    return list;
  }, [systemUsers, orgFilter, orgChipFilter, roleFilter]);

  const active    = filtered.filter((u) => u.status === 'active').length;
  const suspended = filtered.filter((u) => u.status === 'suspended').length;
  const pending   = filtered.filter((u) => u.status === 'pending').length;

  return (
    <ScrollView contentContainerStyle={styles.listContent}>
      <View style={styles.summaryRow}>
        <SummaryPill icon="people"           value={String(filtered.length)} label="Total"     color={Colors.primary} />
        <SummaryPill icon="checkmark-circle" value={String(active)}          label="Active"    color={Colors.statusActive} />
        <SummaryPill icon="time"             value={String(pending)}          label="Pending"   color={Colors.accent} />
        <SummaryPill icon="ban"              value={String(suspended)}        label="Suspended" color={Colors.danger} />
      </View>

      {/* Role filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        {(['all', 'manager', 'viewer'] as const).map((r) => (
          <TouchableOpacity key={r} style={[styles.filterChip, roleFilter === r && styles.filterChipActive]} onPress={() => setRoleFilter(r)}>
            <Text style={[styles.filterChipText, roleFilter === r && styles.filterChipTextActive]}>
              {r === 'all' ? 'All Roles' : r === 'manager' ? 'Managers' : 'Viewers'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Org filter (only for admin, when orgFilter is null) */}
      {!orgFilter && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.filterScroll, { marginTop: 6 }]}>
          <TouchableOpacity style={[styles.filterChip, orgChipFilter === 'all' && styles.filterChipActive]} onPress={() => setOrgChipFilter('all')}>
            <Text style={[styles.filterChipText, orgChipFilter === 'all' && styles.filterChipTextActive]}>All Orgs</Text>
          </TouchableOpacity>
          {organizations.map((org) => (
            <TouchableOpacity key={org.id} style={[styles.filterChip, orgChipFilter === org.id && styles.filterChipActive]} onPress={() => setOrgChipFilter(org.id)}>
              <Text style={[styles.filterChipText, orgChipFilter === org.id && styles.filterChipTextActive]} numberOfLines={1}>
                {org.name.split(' ')[0]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {filtered.length === 0
        ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="people-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No users found</Text>
          </View>
        )
        : filtered.map((u) => (
          <UserCard key={u.id} user={u} showOrg={showOrgName} onToggleStatus={toggleUserStatus} />
        ))
      }

      <TouchableOpacity style={styles.addFab} onPress={onAddUser}>
        <Ionicons name="person-add" size={18} color="#FFF" />
        <Text style={styles.addFabText}>Add User</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function SummaryPill({ icon, value, label, color }: { icon: any; value: string; label: string; color: string }) {
  return (
    <View style={styles.summaryPill}>
      <Ionicons name={icon} size={14} color={color} />
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function UsersScreen() {
  const { user } = useAuth();
  const { organizations } = useUserManagement();

  const [subTab,         setSubTab]         = useState<'orgs' | 'users'>('orgs');
  const [showAddOrg,     setShowAddOrg]     = useState(false);
  const [showAddUser,    setShowAddUser]    = useState(false);

  const { addOrganization, addSystemUser } = useUserManagement();

  if (user?.role === 'viewer') {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.restrictedWrap}>
          <View style={styles.restrictedIcon}>
            <Ionicons name="lock-closed" size={36} color={Colors.textMuted} />
          </View>
          <Text style={styles.restrictedTitle}>Access Restricted</Text>
          <Text style={styles.restrictedSub}>User management is available to Managers and Admins only.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Admin view ──────────────────────────────────────────────────────────────
  if (user?.role === 'admin') {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.subTabBar}>
          {(['orgs', 'users'] as const).map((t) => (
            <TouchableOpacity key={t} style={[styles.subTab, subTab === t && styles.subTabActive]} onPress={() => setSubTab(t)}>
              <Ionicons
                name={t === 'orgs' ? 'business' : 'people'}
                size={16}
                color={subTab === t ? Colors.primary : Colors.textMuted}
              />
              <Text style={[styles.subTabText, subTab === t && styles.subTabTextActive]}>
                {t === 'orgs' ? `Organizations (${organizations.length})` : 'System Users'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {subTab === 'orgs'
          ? <OrgsView onAddOrg={() => setShowAddOrg(true)} />
          : <UsersView orgFilter={null} onAddUser={() => setShowAddUser(true)} showOrgName organizations={organizations} />
        }

        <AddOrgModal  visible={showAddOrg}  onClose={() => setShowAddOrg(false)}  onSave={addOrganization} />
        <AddUserModal visible={showAddUser} onClose={() => setShowAddUser(false)} onSave={addSystemUser} orgId={null} organizations={organizations} />
      </SafeAreaView>
    );
  }

  // ── Manager view ────────────────────────────────────────────────────────────
  const managerOrg = organizations.find((o) => o.id === user?.orgId);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.managerHeader}>
        <View>
          <Text style={styles.managerTitle}>Team</Text>
          <Text style={styles.managerOrg}>{managerOrg?.name ?? user?.company}</Text>
        </View>
        <TouchableOpacity style={styles.addUserBtn} onPress={() => setShowAddUser(true)}>
          <Ionicons name="person-add" size={16} color="#FFF" />
          <Text style={styles.addUserBtnText}>Add User</Text>
        </TouchableOpacity>
      </View>

      <UsersView
        orgFilter={user?.orgId ?? null}
        onAddUser={() => setShowAddUser(true)}
        showOrgName={false}
        organizations={organizations}
      />

      <AddUserModal
        visible={showAddUser}
        onClose={() => setShowAddUser(false)}
        onSave={addSystemUser}
        orgId={user?.orgId ?? null}
        organizations={organizations}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundLight },

  // Access restricted
  restrictedWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  restrictedIcon:  { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.border, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  restrictedTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  restrictedSub:   { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 22 },

  // Sub-tab bar (admin)
  subTabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  subTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 14,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  subTabActive:     { borderBottomColor: Colors.primary },
  subTabText:       { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textMuted },
  subTabTextActive: { color: Colors.primary },

  // Manager header
  managerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
  },
  managerTitle: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.textLight },
  managerOrg:   { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  addUserBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: Radius.full,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  addUserBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textLight },

  // List
  listContent: { padding: Spacing.md, paddingBottom: Spacing.xxl },

  summaryRow: {
    flexDirection: 'row', gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  summaryPill: {
    flex: 1, alignItems: 'center', gap: 3,
    backgroundColor: Colors.cardBackground,
    borderRadius: Radius.sm, paddingVertical: 10,
    ...Shadow.sm,
  },
  summaryValue: { fontSize: FontSize.lg, fontWeight: '800' },
  summaryLabel: { fontSize: 9, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase' },

  filterScroll: { marginBottom: Spacing.sm },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.cardBackground, marginRight: 6,
  },
  filterChipActive:     { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipText:       { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  filterChipTextActive: { color: Colors.textLight },

  // Card
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadow.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginBottom: Spacing.sm },
  orgIconWrap: {
    width: 40, height: 40, borderRadius: Radius.sm,
    backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center',
  },
  cardTitleBlock: { flex: 1 },
  cardName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  cardSub:  { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  cardOrg:  { fontSize: FontSize.xs, color: Colors.accent, marginTop: 2, fontWeight: '600' },

  cardStats:  { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  statChip:   { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.backgroundLight, borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 5 },
  statValue:  { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textPrimary },
  statLabel:  { fontSize: FontSize.xs, color: Colors.textMuted },

  cardFooter:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: Colors.divider, paddingTop: Spacing.sm },
  contactLabel:  { fontSize: 10, color: Colors.textMuted, textTransform: 'uppercase', fontWeight: '700' },
  contactValue:  { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },

  actionBtn:        { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full, borderWidth: 1 },
  actionBtnDanger:  { borderColor: Colors.danger + '44', backgroundColor: Colors.danger + '10' },
  actionBtnSuccess: { borderColor: Colors.statusActive + '44', backgroundColor: Colors.statusActive + '10' },
  actionBtnText:    { fontSize: FontSize.xs, fontWeight: '700' },

  badge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  badgeText: { fontSize: 10, fontWeight: '700' },

  // User card specifics
  userAvatar:   { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  userInitials: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.textLight },

  loginRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  loginText:   { fontSize: FontSize.xs, color: Colors.textSecondary },
  joinedText:  { fontSize: FontSize.xs, color: Colors.textMuted },

  // Add FAB
  addFab: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    height: 50, marginTop: Spacing.sm,
    ...Shadow.md,
  },
  addFabText: { fontSize: FontSize.md, fontWeight: '800', color: Colors.textLight },

  emptyWrap: { alignItems: 'center', paddingTop: 48, gap: Spacing.sm },
  emptyText: { fontSize: FontSize.md, color: Colors.textSecondary, fontWeight: '600' },

  // ─── Modal ─────────────────────────────────────────────────────────────────
  overlay:   { flex: 1, justifyContent: 'flex-end' },
  overlayBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: Colors.cardBackground,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: Spacing.md, maxHeight: '92%',
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginTop: 10, marginBottom: 6 },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingVertical: Spacing.sm, marginBottom: 4 },
  sheetTitle:  { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textPrimary },
  sheetSub:    { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },

  fieldGroup: { marginBottom: Spacing.md },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary, marginBottom: 6 },
  inputWrap:  { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.sm, paddingHorizontal: 12, height: 44, backgroundColor: Colors.backgroundLight },
  inputWrapError: { borderColor: Colors.danger },
  input:      { flex: 1, fontSize: FontSize.md, color: Colors.textPrimary, height: 44 },
  fieldError: { fontSize: FontSize.xs, color: Colors.danger, marginTop: 3 },

  chipRow:       { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip:          { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.backgroundLight },
  chipWide:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipActive:    { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText:      { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  chipTextActive:{ color: Colors.textLight },

  roleHint: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 6, lineHeight: 18 },

  infoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#EBF5FB', borderRadius: Radius.sm, padding: Spacing.sm, marginBottom: Spacing.md },
  infoText: { flex: 1, fontSize: FontSize.xs, color: Colors.info, lineHeight: 18 },

  orgPickerRow:        { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm, borderRadius: Radius.sm, marginBottom: 6, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.backgroundLight },
  orgPickerRowActive:  { backgroundColor: Colors.primary, borderColor: Colors.primary },
  orgPickerIcon:       { width: 28, height: 28, borderRadius: Radius.sm, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  orgPickerName:       { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  orgPickerNameActive: { color: Colors.textLight },
  orgPickerSub:        { fontSize: FontSize.xs, color: Colors.textMuted },

  saveBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: Radius.md, height: 50, marginTop: Spacing.sm },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText:     { fontSize: FontSize.md, fontWeight: '800', color: Colors.textLight },
});
