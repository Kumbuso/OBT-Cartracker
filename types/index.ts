export type VehicleStatus = 'active' | 'idle' | 'offline' | 'maintenance';

export interface Vehicle {
  id: string;
  plate: string;
  model: string;
  make: string;
  year: number;
  status: VehicleStatus;
  driver: Driver | null;
  location: Coordinates;
  lastSeen: string;
  odometer: number;
  fuelLevel: number;
  speed: number;
  engineOn: boolean;
  groupId: string;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  licenseNumber: string;
  avatar?: string;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface Trip {
  id: string;
  vehicleId: string;
  vehiclePlate: string;
  driverId: string;
  driverName: string;
  startTime: string;
  endTime: string | null;
  startLocation: Coordinates;
  endLocation: Coordinates | null;
  distance: number;
  duration: number;
  maxSpeed: number;
  avgSpeed: number;
  fuelUsed: number;
}

export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertType =
  | 'speeding'
  | 'geofence_exit'
  | 'geofence_enter'
  | 'maintenance_due'
  | 'low_fuel'
  | 'engine_off'
  | 'harsh_braking'
  | 'idle_timeout';

export interface Alert {
  id: string;
  vehicleId: string;
  vehiclePlate: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  timestamp: string;
  read: boolean;
}

export interface FleetStats {
  totalVehicles: number;
  activeVehicles: number;
  idleVehicles: number;
  offlineVehicles: number;
  maintenanceVehicles: number;
  totalTripsToday: number;
  totalDistanceToday: number;
  unreadAlerts: number;
}

export interface FuelEvent {
  id: string;
  vehicleId: string;
  vehiclePlate: string;
  type: 'refuel' | 'consumption';
  liters: number;
  cost?: number;
  odometer: number;
  timestamp: string;
  station?: string;
}

export type AccidentSeverity = 'minor' | 'moderate' | 'severe' | 'fatal';
export type AccidentStatus   = 'reported' | 'under_investigation' | 'resolved' | 'closed';

export interface AccidentReport {
  id: string;
  vehicleId: string;
  vehiclePlate: string;
  driverId: string;
  driverName: string;
  timestamp: string;
  location: Coordinates;
  severity: AccidentSeverity;
  status: AccidentStatus;
  description: string;
  injuriesReported: boolean;
  thirdPartyInvolved: boolean;
  estimatedDamage?: number;
  policeReportNumber?: string;
  notes?: string;
}

export type OrgPlan   = 'basic' | 'pro' | 'enterprise';
export type OrgStatus = 'active' | 'suspended' | 'trial';

export interface Organization {
  id: string;
  name: string;
  contactName: string;
  contactEmail: string;
  phone: string;
  plan: OrgPlan;
  status: OrgStatus;
  createdAt: string;
  vehicleLimit: number;
  vehicleCount: number;
  userCount: number;
  city: string;
}

export type UserRole   = 'admin' | 'manager' | 'viewer';
export type UserStatus = 'active' | 'suspended' | 'pending';

export interface SystemUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  orgId: string;
  orgName: string;
  status: UserStatus;
  createdAt: string;
  lastLogin?: string;
  initials: string;
}

export type GeofenceType = 'allowed' | 'restricted';

export interface Geofence {
  id: string;
  name: string;
  type: GeofenceType;
  center: Coordinates;
  radiusKm: number;
  polygon?: Coordinates[];   // when set, this is a drawn polygon geofence; radiusKm is 0
  assignedVehicleIds: string[];
  active: boolean;
  alertOnExit: boolean;
  alertOnEnter: boolean;
  color: string;
}
