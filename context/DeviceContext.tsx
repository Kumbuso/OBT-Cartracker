import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from './AuthContext';

// ── Types ──────────────────────────────────────────────────────────────────────

export type DeviceType   = 'gps' | 'fuel' | 'obd' | 'dashcam' | 'temp';
export type DeviceStatus = 'online' | 'offline' | 'fault' | 'low_battery';

export interface Device {
  id: string;
  serial: string;
  imei: string | null;
  simNumber: string | null;
  type: DeviceType;
  status: DeviceStatus;
  vehicleId: string | null;
  vehiclePlate: string | null;
  lastSeen: string | null;
  battery: number | null;
  signal: number | null;
  firmware: string | null;
  fault: string | null;
  notes: string | null;
}

export interface RegisterDeviceInput {
  serial: string;
  imei: string | null;
  simNumber: string | null;
  type: DeviceType;
  notes?: string;
  vehicleId?: string | null;
}

interface DeviceContextType {
  devices: Device[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  registerDevice: (input: RegisterDeviceInput) => Promise<Device>;
  updateDevice: (id: string, patch: Partial<Pick<Device, 'serial' | 'imei' | 'simNumber' | 'status' | 'firmware' | 'notes' | 'fault'>>) => Promise<Device>;
  deleteDevice: (id: string) => Promise<void>;
  assignDevice: (id: string, vehicleId: string) => Promise<Device>;
  unassignDevice: (id: string) => Promise<Device>;
}

// ── API response normalizer ────────────────────────────────────────────────────

interface ApiDevice {
  id: string;
  serial: string;
  imei: string | null;
  simNumber: string | null;
  type: DeviceType;
  status: DeviceStatus;
  vehicleId: string | null;
  vehicle: { id: string; plate: string } | null;
  lastSeen: string | null;
  battery: number | null;
  signal: number | null;
  firmware: string | null;
  fault: string | null;
  notes: string | null;
}

function normalize(d: ApiDevice): Device {
  return {
    id:           d.id,
    serial:       d.serial,
    imei:         d.imei,
    simNumber:    d.simNumber,
    type:         d.type,
    status:       d.status,
    vehicleId:    d.vehicleId,
    vehiclePlate: d.vehicle?.plate ?? null,
    lastSeen:     d.lastSeen,
    battery:      d.battery,
    signal:       d.signal,
    firmware:     d.firmware,
    fault:        d.fault,
    notes:        d.notes,
  };
}

// ── Context ────────────────────────────────────────────────────────────────────

const DeviceContext = createContext<DeviceContextType | null>(null);

export function DeviceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const raw = await api.get<ApiDevice[]>('/api/devices');
      setDevices(raw.map(normalize));
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load devices');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Load once user is authenticated
  useEffect(() => { refresh(); }, [refresh]);

  const registerDevice = async (input: RegisterDeviceInput): Promise<Device> => {
    const raw = await api.post<ApiDevice>('/api/devices/register', input);
    const device = normalize(raw);
    setDevices((prev) => [device, ...prev]);
    return device;
  };

  const updateDevice = async (
    id: string,
    patch: Partial<Pick<Device, 'serial' | 'imei' | 'simNumber' | 'status' | 'firmware' | 'notes' | 'fault'>>,
  ): Promise<Device> => {
    const raw = await api.put<ApiDevice>(`/api/devices/${id}`, patch);
    const device = normalize(raw);
    setDevices((prev) => prev.map((d) => (d.id === id ? device : d)));
    return device;
  };

  const deleteDevice = async (id: string): Promise<void> => {
    await api.delete(`/api/devices/${id}`);
    setDevices((prev) => prev.filter((d) => d.id !== id));
  };

  const assignDevice = async (id: string, vehicleId: string): Promise<Device> => {
    const raw = await api.post<ApiDevice>(`/api/devices/${id}/assign`, { vehicleId });
    const device = normalize(raw);
    setDevices((prev) => prev.map((d) => (d.id === id ? device : d)));
    return device;
  };

  const unassignDevice = async (id: string): Promise<Device> => {
    const raw = await api.delete<ApiDevice>(`/api/devices/${id}/assign`);
    const device = normalize(raw);
    setDevices((prev) => prev.map((d) => (d.id === id ? device : d)));
    return device;
  };

  return (
    <DeviceContext.Provider value={{ devices, loading, error, refresh, registerDevice, updateDevice, deleteDevice, assignDevice, unassignDevice }}>
      {children}
    </DeviceContext.Provider>
  );
}

export function useDeviceRegistry(): DeviceContextType {
  const ctx = useContext(DeviceContext);
  if (!ctx) throw new Error('useDeviceRegistry must be used within DeviceProvider');
  return ctx;
}
