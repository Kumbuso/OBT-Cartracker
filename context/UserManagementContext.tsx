import React, { createContext, useContext, useState } from 'react';
import { mockOrganizations, mockSystemUsers } from '../data/mockData';
import type { Organization, SystemUser, OrgStatus, UserStatus } from '../types';

interface UserManagementContextType {
  organizations: Organization[];
  systemUsers: SystemUser[];
  addOrganization: (org: Omit<Organization, 'id' | 'createdAt' | 'userCount' | 'vehicleCount'>) => void;
  addSystemUser: (user: Omit<SystemUser, 'id' | 'createdAt' | 'initials'>) => void;
  toggleOrgStatus: (orgId: string) => void;
  toggleUserStatus: (userId: string) => void;
}

const UserManagementContext = createContext<UserManagementContextType | null>(null);

export function UserManagementProvider({ children }: { children: React.ReactNode }) {
  const [organizations, setOrganizations] = useState<Organization[]>(mockOrganizations);
  const [systemUsers,   setSystemUsers]   = useState<SystemUser[]>(mockSystemUsers);

  const addOrganization = (org: Omit<Organization, 'id' | 'createdAt' | 'userCount' | 'vehicleCount'>) => {
    setOrganizations((prev) => [
      ...prev,
      { ...org, id: `org${prev.length + 1}`, createdAt: new Date().toISOString(), userCount: 0, vehicleCount: 0 },
    ]);
  };

  const addSystemUser = (user: Omit<SystemUser, 'id' | 'createdAt' | 'initials'>) => {
    const initials = user.name.split(' ').slice(0, 2).map((n) => n[0].toUpperCase()).join('');
    setSystemUsers((prev) => [
      ...prev,
      { ...user, id: `su${prev.length + 1}`, createdAt: new Date().toISOString(), initials },
    ]);
    setOrganizations((prev) =>
      prev.map((o) => o.id === user.orgId ? { ...o, userCount: o.userCount + 1 } : o),
    );
  };

  const toggleOrgStatus = (orgId: string) => {
    setOrganizations((prev) =>
      prev.map((o) => {
        if (o.id !== orgId) return o;
        const next: OrgStatus = o.status === 'active' ? 'suspended' : 'active';
        return { ...o, status: next };
      }),
    );
  };

  const toggleUserStatus = (userId: string) => {
    setSystemUsers((prev) =>
      prev.map((u) => {
        if (u.id !== userId) return u;
        const next: UserStatus = u.status === 'active' ? 'suspended' : 'active';
        return { ...u, status: next };
      }),
    );
  };

  return (
    <UserManagementContext.Provider value={{ organizations, systemUsers, addOrganization, addSystemUser, toggleOrgStatus, toggleUserStatus }}>
      {children}
    </UserManagementContext.Provider>
  );
}

export function useUserManagement(): UserManagementContextType {
  const ctx = useContext(UserManagementContext);
  if (!ctx) throw new Error('useUserManagement must be used within UserManagementProvider');
  return ctx;
}
