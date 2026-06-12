import EmbeddedPostgres from 'embedded-postgres';
import { execSync, spawn, ChildProcess } from 'child_process';
import { writeFileSync } from 'fs';
import { setTimeout as wait } from 'timers/promises';
import path from 'path';

const PG_PORT = 5433;
const APP_PORT = 3099;
const DB_NAME = 'obt_test';
const BASE = `http://localhost:${APP_PORT}`;

let passed = 0;
let failed = 0;
const failures: string[] = [];

// ─── helpers ────────────────────────────────────────────────────────────────

const c = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red:   (s: string) => `\x1b[31m${s}\x1b[0m`,
  cyan:  (s: string) => `\x1b[36m${s}\x1b[0m`,
  bold:  (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim:   (s: string) => `\x1b[2m${s}\x1b[0m`,
};

function section(name: string) {
  console.log(`\n${c.cyan(c.bold('━━━ ' + name + ' ━━━'))}`);
}

function ok(label: string) {
  passed++;
  console.log(`  ${c.green('✔')} ${label}`);
}

function fail(label: string, detail: string) {
  failed++;
  failures.push(`${label}: ${detail}`);
  console.log(`  ${c.red('✖')} ${label} ${c.dim('→ ' + detail)}`);
}

async function req(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<{ status: number; data: unknown }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

function assert(label: string, condition: boolean, detail = '') {
  condition ? ok(label) : fail(label, detail || 'assertion failed');
}

// ─── test suites ────────────────────────────────────────────────────────────

let adminToken = '';
let managerToken = '';
let viewerToken = '';
let vehicleId = '';
let driverId = '';
let tripId = '';
let alertId = '';
let geofenceId = '';
let fuelId = '';
let accidentId = '';
let userId = '';
let orgId = '';

async function testHealth() {
  section('Health Check');
  const { status, data } = await req('GET', '/health');
  assert('GET /health returns 200', status === 200, `got ${status}`);
  assert('has status:ok', (data as any)?.status === 'ok', JSON.stringify(data));
}

async function testAuth() {
  section('Auth');

  // Login as admin
  let r = await req('POST', '/auth/login', { email: 'admin@obt.zm', password: 'obt2026' });
  assert('POST /auth/login admin 200', r.status === 200, `got ${r.status}`);
  adminToken = (r.data as any)?.accessToken;
  const adminRefresh = (r.data as any)?.refreshToken;
  assert('admin accessToken present', !!adminToken);
  assert('admin user.role == admin', (r.data as any)?.user?.role === 'admin');
  orgId = (r.data as any)?.user?.orgId;

  // Login as manager
  r = await req('POST', '/auth/login', { email: 'manager@obt.zm', password: 'obt2026' });
  assert('POST /auth/login manager 200', r.status === 200, `got ${r.status}`);
  managerToken = (r.data as any)?.accessToken;

  // Login as viewer
  r = await req('POST', '/auth/login', { email: 'viewer@obt.zm', password: 'obt2026' });
  assert('POST /auth/login viewer 200', r.status === 200, `got ${r.status}`);
  viewerToken = (r.data as any)?.accessToken;

  // Wrong password
  r = await req('POST', '/auth/login', { email: 'admin@obt.zm', password: 'wrong' });
  assert('POST /auth/login wrong password 401', r.status === 401, `got ${r.status}`);

  // GET /auth/me
  r = await req('GET', '/auth/me', undefined, adminToken);
  assert('GET /auth/me 200', r.status === 200, `got ${r.status}`);
  assert('me.email correct', (r.data as any)?.email === 'admin@obt.zm');

  // GET /auth/me no token
  r = await req('GET', '/auth/me');
  assert('GET /auth/me no token 401', r.status === 401, `got ${r.status}`);

  // Refresh token
  r = await req('POST', '/auth/refresh', { refreshToken: adminRefresh });
  assert('POST /auth/refresh 200', r.status === 200, `got ${r.status}`);
  assert('new accessToken returned', !!(r.data as any)?.accessToken);
  // Update adminToken with new one for subsequent tests
  adminToken = (r.data as any)?.accessToken;
}

async function testVehicles() {
  section('Vehicles');

  // List vehicles (seeded with 5)
  let r = await req('GET', '/api/vehicles', undefined, adminToken);
  assert('GET /api/vehicles 200', r.status === 200, `got ${r.status}`);
  assert('returns array of 5', Array.isArray(r.data) && (r.data as any[]).length === 5, `got ${(r.data as any[])?.length}`);
  vehicleId = (r.data as any[])[0].id;

  // Get single vehicle
  r = await req('GET', `/api/vehicles/${vehicleId}`, undefined, adminToken);
  assert('GET /api/vehicles/:id 200', r.status === 200, `got ${r.status}`);
  assert('vehicle has plate', !!(r.data as any)?.plate);

  // Get vehicle with wrong org — use a fake ID
  r = await req('GET', '/api/vehicles/nonexistent-id', undefined, adminToken);
  assert('GET /api/vehicles/bad-id 404', r.status === 404, `got ${r.status}`);

  // Create vehicle (admin)
  r = await req('POST', '/api/vehicles', {
    plate: 'TEST 001 ZM',
    make: 'Toyota',
    model: 'Land Cruiser',
    year: 2023,
    group: 'Test',
  }, adminToken);
  assert('POST /api/vehicles 201', r.status === 201, `got ${r.status}`);
  const newVehicleId = (r.data as any)?.id;
  assert('new vehicle has id', !!newVehicleId);

  // Create vehicle (viewer — forbidden)
  r = await req('POST', '/api/vehicles', { plate: 'X', make: 'X', model: 'X', year: 2020 }, viewerToken);
  assert('POST /api/vehicles viewer 403', r.status === 403, `got ${r.status}`);

  // Update vehicle
  r = await req('PUT', `/api/vehicles/${newVehicleId}`, { status: 'maintenance' }, adminToken);
  assert('PUT /api/vehicles/:id 200', r.status === 200, `got ${r.status}`);
  assert('status updated', (r.data as any)?.status === 'maintenance');

  // Update vehicle location
  r = await req('POST', `/api/vehicles/${vehicleId}/location`, {
    lat: -15.4167, lng: 28.2833, speed: 55, address: 'Test Road',
  }, managerToken);
  assert('POST /api/vehicles/:id/location 200', r.status === 200, `got ${r.status}`);

  // Location history
  r = await req('GET', `/api/vehicles/${vehicleId}/locations`, undefined, adminToken);
  assert('GET /api/vehicles/:id/locations 200', r.status === 200, `got ${r.status}`);
  assert('location history is array', Array.isArray(r.data));

  // Vehicle trips
  r = await req('GET', `/api/vehicles/${vehicleId}/trips`, undefined, adminToken);
  assert('GET /api/vehicles/:id/trips 200', r.status === 200, `got ${r.status}`);

  // Vehicle alerts
  r = await req('GET', `/api/vehicles/${vehicleId}/alerts`, undefined, adminToken);
  assert('GET /api/vehicles/:id/alerts 200', r.status === 200, `got ${r.status}`);

  // Speed alert auto-creation (speed > 120)
  r = await req('POST', `/api/vehicles/${vehicleId}/location`, {
    lat: -15.4167, lng: 28.2833, speed: 135,
  }, managerToken);
  assert('speeding location update 200', r.status === 200, `got ${r.status}`);

  // Delete vehicle
  r = await req('DELETE', `/api/vehicles/${newVehicleId}`, undefined, adminToken);
  assert('DELETE /api/vehicles/:id 204', r.status === 204, `got ${r.status}`);
}

async function testDrivers() {
  section('Drivers');

  let r = await req('GET', '/api/drivers', undefined, adminToken);
  assert('GET /api/drivers 200', r.status === 200, `got ${r.status}`);
  assert('returns 3 seeded drivers', Array.isArray(r.data) && (r.data as any[]).length === 3, `got ${(r.data as any[])?.length}`);
  driverId = (r.data as any[])[0].id;

  r = await req('GET', `/api/drivers/${driverId}`, undefined, managerToken);
  assert('GET /api/drivers/:id 200', r.status === 200, `got ${r.status}`);
  assert('driver has name', !!(r.data as any)?.name);

  r = await req('POST', '/api/drivers', {
    name: 'Test Driver', phone: '+260 97 999 0000', licenseNumber: 'ZM-TEST-999',
  }, managerToken);
  assert('POST /api/drivers 201', r.status === 201, `got ${r.status}`);
  const newDriverId = (r.data as any)?.id;

  r = await req('PUT', `/api/drivers/${newDriverId}`, { phone: '+260 97 000 1111' }, adminToken);
  assert('PUT /api/drivers/:id 200', r.status === 200, `got ${r.status}`);

  r = await req('DELETE', `/api/drivers/${newDriverId}`, undefined, adminToken);
  assert('DELETE /api/drivers/:id 204', r.status === 204, `got ${r.status}`);

  // Viewer can't create
  r = await req('POST', '/api/drivers', { name: 'X', phone: 'X', licenseNumber: 'X' }, viewerToken);
  assert('POST /api/drivers viewer 403', r.status === 403, `got ${r.status}`);
}

async function testTrips() {
  section('Trips');

  let r = await req('GET', '/api/trips', undefined, adminToken);
  assert('GET /api/trips 200', r.status === 200, `got ${r.status}`);
  assert('returns seeded trips', Array.isArray(r.data) && (r.data as any[]).length >= 2);

  // Filter by status
  r = await req('GET', '/api/trips?status=active', undefined, adminToken);
  assert('GET /api/trips?status=active 200', r.status === 200, `got ${r.status}`);
  assert('all returned trips are active', (r.data as any[]).every((t: any) => t.status === 'active'));

  r = await req('POST', '/api/trips', {
    vehicleId,
    startLat: -15.4000, startLng: 28.2800, startAddress: 'Test Depot',
  }, managerToken);
  assert('POST /api/trips 201', r.status === 201, `got ${r.status}`);
  tripId = (r.data as any)?.id;

  r = await req('GET', `/api/trips/${tripId}`, undefined, adminToken);
  assert('GET /api/trips/:id 200', r.status === 200, `got ${r.status}`);

  r = await req('PUT', `/api/trips/${tripId}`, {
    status: 'completed', endLat: -15.4167, endLng: 28.2833,
    distance: 12.3, duration: 900, avgSpeed: 49, maxSpeed: 80, fuelConsumed: 1.8,
  }, managerToken);
  assert('PUT /api/trips/:id complete 200', r.status === 200, `got ${r.status}`);
  assert('trip status = completed', (r.data as any)?.status === 'completed');
}

async function testAlerts() {
  section('Alerts');

  let r = await req('GET', '/api/alerts', undefined, adminToken);
  assert('GET /api/alerts 200', r.status === 200, `got ${r.status}`);
  assert('has seeded alerts', Array.isArray(r.data) && (r.data as any[]).length >= 4);
  alertId = (r.data as any[]).find((a: any) => !a.read)?.id;

  // Unread count
  r = await req('GET', '/api/alerts/unread-count', undefined, adminToken);
  assert('GET /api/alerts/unread-count 200', r.status === 200, `got ${r.status}`);
  assert('count is number', typeof (r.data as any)?.count === 'number');

  // Filter by severity
  r = await req('GET', '/api/alerts?severity=critical', undefined, adminToken);
  assert('GET /api/alerts?severity=critical 200', r.status === 200, `got ${r.status}`);

  // Mark single read
  r = await req('PUT', `/api/alerts/${alertId}/read`, undefined, adminToken);
  assert('PUT /api/alerts/:id/read 200', r.status === 200, `got ${r.status}`);
  assert('alert.read = true', (r.data as any)?.read === true);

  // Create alert
  r = await req('POST', '/api/alerts', {
    vehicleId, type: 'idle_timeout', severity: 'info',
    message: 'Test alert from integration test',
  }, managerToken);
  assert('POST /api/alerts 201', r.status === 201, `got ${r.status}`);
  const newAlertId = (r.data as any)?.id;

  // Mark all read
  r = await req('PUT', '/api/alerts/mark-all-read', undefined, adminToken);
  assert('PUT /api/alerts/mark-all-read 200', r.status === 200, `got ${r.status}`);
  assert('updated count is number', typeof (r.data as any)?.updated === 'number');

  // Delete alert
  r = await req('DELETE', `/api/alerts/${newAlertId}`, undefined, adminToken);
  assert('DELETE /api/alerts/:id 204', r.status === 204, `got ${r.status}`);
}

async function testGeofences() {
  section('Geofences');

  let r = await req('GET', '/api/geofences', undefined, adminToken);
  assert('GET /api/geofences 200', r.status === 200, `got ${r.status}`);
  assert('returns 3 seeded geofences', (r.data as any[])?.length === 3, `got ${(r.data as any[])?.length}`);
  geofenceId = (r.data as any[])[0].id;

  r = await req('GET', `/api/geofences/${geofenceId}`, undefined, managerToken);
  assert('GET /api/geofences/:id 200', r.status === 200, `got ${r.status}`);

  // Create circle geofence
  r = await req('POST', '/api/geofences', {
    name: 'Test Zone', type: 'restricted', shape: 'circle',
    centerLat: -15.4167, centerLng: 28.2833, radius: 2000,
    alertOnEnter: true, alertOnExit: false,
  }, managerToken);
  assert('POST /api/geofences circle 201', r.status === 201, `got ${r.status}`);
  const circleId = (r.data as any)?.id;

  // Create polygon geofence
  r = await req('POST', '/api/geofences', {
    name: 'Poly Zone', type: 'allowed', shape: 'polygon',
    coordinates: [
      { lat: -15.39, lng: 28.31 }, { lat: -15.39, lng: 28.34 },
      { lat: -15.41, lng: 28.34 }, { lat: -15.41, lng: 28.31 },
    ],
  }, managerToken);
  assert('POST /api/geofences polygon 201', r.status === 201, `got ${r.status}`);

  // Assign vehicle
  r = await req('POST', `/api/geofences/${circleId}/vehicles`, { vehicleIds: [vehicleId] }, adminToken);
  assert('POST /api/geofences/:id/vehicles 200', r.status === 200, `got ${r.status}`);

  // Unassign vehicle
  r = await req('DELETE', `/api/geofences/${circleId}/vehicles/${vehicleId}`, undefined, adminToken);
  assert('DELETE /api/geofences/:id/vehicles/:vehicleId 204', r.status === 204, `got ${r.status}`);

  // Update
  r = await req('PUT', `/api/geofences/${circleId}`, { name: 'Updated Test Zone', active: false }, adminToken);
  assert('PUT /api/geofences/:id 200', r.status === 200, `got ${r.status}`);

  // Delete
  r = await req('DELETE', `/api/geofences/${circleId}`, undefined, adminToken);
  assert('DELETE /api/geofences/:id 204', r.status === 204, `got ${r.status}`);

  // Viewer can't create
  r = await req('POST', '/api/geofences', { name: 'X', type: 'allowed', shape: 'circle', centerLat: 0, centerLng: 0, radius: 100 }, viewerToken);
  assert('POST /api/geofences viewer 403', r.status === 403, `got ${r.status}`);
}

async function testFuel() {
  section('Fuel Events');

  let r = await req('GET', '/api/fuel', undefined, adminToken);
  assert('GET /api/fuel 200', r.status === 200, `got ${r.status}`);
  assert('has seeded fuel events', (r.data as any[])?.length >= 3);

  r = await req('POST', '/api/fuel', {
    vehicleId, type: 'refuel', liters: 50,
    costPerLiter: 2.90, totalCost: 145, station: 'Test Station',
    odometer: 50000,
  }, managerToken);
  assert('POST /api/fuel 201', r.status === 201, `got ${r.status}`);
  fuelId = (r.data as any)?.id;

  r = await req('GET', `/api/fuel/${fuelId}`, undefined, adminToken);
  assert('GET /api/fuel/:id 200', r.status === 200, `got ${r.status}`);

  // Filter by vehicle
  r = await req('GET', `/api/fuel?vehicleId=${vehicleId}`, undefined, adminToken);
  assert('GET /api/fuel?vehicleId= 200', r.status === 200, `got ${r.status}`);

  r = await req('DELETE', `/api/fuel/${fuelId}`, undefined, adminToken);
  assert('DELETE /api/fuel/:id 204', r.status === 204, `got ${r.status}`);
}

async function testAccidents() {
  section('Accident Reports');

  let r = await req('GET', '/api/accidents', undefined, adminToken);
  assert('GET /api/accidents 200', r.status === 200, `got ${r.status}`);

  r = await req('POST', '/api/accidents', {
    vehicleId, severity: 'minor',
    description: 'Minor fender bender during test',
    location: 'Test Road, Lusaka',
    lat: -15.4167, lng: 28.2833,
    injuries: false, thirdPartyInvolved: false,
    occurredAt: new Date().toISOString(),
  }, managerToken);
  assert('POST /api/accidents 201', r.status === 201, `got ${r.status}`);
  accidentId = (r.data as any)?.id;

  r = await req('GET', `/api/accidents/${accidentId}`, undefined, adminToken);
  assert('GET /api/accidents/:id 200', r.status === 200, `got ${r.status}`);

  r = await req('PUT', `/api/accidents/${accidentId}`, { status: 'under_investigation' }, adminToken);
  assert('PUT /api/accidents/:id 200', r.status === 200, `got ${r.status}`);
  assert('status updated', (r.data as any)?.status === 'under_investigation');

  r = await req('DELETE', `/api/accidents/${accidentId}`, undefined, adminToken);
  assert('DELETE /api/accidents/:id 204', r.status === 204, `got ${r.status}`);
}

async function testOrganizations() {
  section('Organizations');

  let r = await req('GET', '/api/organizations/me', undefined, adminToken);
  assert('GET /api/organizations/me 200', r.status === 200, `got ${r.status}`);
  assert('org has name', !!(r.data as any)?.name);

  r = await req('GET', `/api/organizations/${orgId}`, undefined, adminToken);
  assert('GET /api/organizations/:id 200', r.status === 200, `got ${r.status}`);

  // Manager can't access wrong org
  r = await req('GET', '/api/organizations/wrong-org-id', undefined, managerToken);
  assert('GET /api/organizations/wrong 403', r.status === 403, `got ${r.status}`);

  r = await req('PUT', `/api/organizations/${orgId}`, { name: 'OBT Logistics Zambia (Updated)' }, adminToken);
  assert('PUT /api/organizations/:id 200', r.status === 200, `got ${r.status}`);

  r = await req('PATCH', `/api/organizations/${orgId}/status`, { status: 'active' }, adminToken);
  assert('PATCH /api/organizations/:id/status 200', r.status === 200, `got ${r.status}`);
}

async function testUsers() {
  section('Users');

  let r = await req('GET', '/api/users', undefined, adminToken);
  assert('GET /api/users 200', r.status === 200, `got ${r.status}`);
  assert('returns 3 seeded users', (r.data as any[])?.length === 3, `got ${(r.data as any[])?.length}`);

  // Create user
  r = await req('POST', '/api/users', {
    name: 'Test Operator', email: 'operator@obt.zm',
    password: 'testpass123', role: 'viewer', phone: '+260 97 777 8888',
  }, adminToken);
  assert('POST /api/users 201', r.status === 201, `got ${r.status}`);
  userId = (r.data as any)?.id;
  assert('new user has id', !!userId);

  r = await req('GET', `/api/users/${userId}`, undefined, adminToken);
  assert('GET /api/users/:id 200', r.status === 200, `got ${r.status}`);

  r = await req('PUT', `/api/users/${userId}`, { name: 'Test Operator Updated' }, adminToken);
  assert('PUT /api/users/:id 200', r.status === 200, `got ${r.status}`);
  assert('name updated', (r.data as any)?.name === 'Test Operator Updated');

  // Change status
  r = await req('PATCH', `/api/users/${userId}/status`, { status: 'suspended' }, adminToken);
  assert('PATCH /api/users/:id/status 200', r.status === 200, `got ${r.status}`);

  // Manager can list but not create
  r = await req('POST', '/api/users', { name: 'X', email: 'x@x.com', password: 'xxxxxxxx' }, managerToken);
  assert('POST /api/users manager 403', r.status === 403, `got ${r.status}`);

  // Change password
  r = await req('POST', '/api/users/me/change-password', {
    currentPassword: 'obt2026', newPassword: 'newpass2026',
  }, adminToken);
  assert('POST /api/users/me/change-password 200', r.status === 200, `got ${r.status}`);

  // Change back
  await req('POST', '/api/users/me/change-password', {
    currentPassword: 'newpass2026', newPassword: 'obt2026',
  }, adminToken);

  // Delete user
  r = await req('DELETE', `/api/users/${userId}`, undefined, adminToken);
  assert('DELETE /api/users/:id 204', r.status === 204, `got ${r.status}`);

  // Can't delete self
  const meRes = await req('GET', '/auth/me', undefined, adminToken);
  const myId = (meRes.data as any)?.id;
  r = await req('DELETE', `/api/users/${myId}`, undefined, adminToken);
  assert('DELETE self 400', r.status === 400, `got ${r.status}`);
}

async function testReports() {
  section('Reports');

  let r = await req('GET', '/api/reports/fleet-stats', undefined, adminToken);
  assert('GET /api/reports/fleet-stats 200', r.status === 200, `got ${r.status}`);
  assert('has total field', typeof (r.data as any)?.total === 'number');
  assert('has unreadAlerts field', typeof (r.data as any)?.unreadAlerts === 'number');

  r = await req('GET', '/api/reports/trips-summary', undefined, adminToken);
  assert('GET /api/reports/trips-summary 200', r.status === 200, `got ${r.status}`);
  assert('has count field', typeof (r.data as any)?.count === 'number');

  r = await req('GET', '/api/reports/fuel-summary', undefined, adminToken);
  assert('GET /api/reports/fuel-summary 200', r.status === 200, `got ${r.status}`);
  assert('has totalRefuels field', typeof (r.data as any)?.totalRefuels === 'number');

  r = await req('GET', '/api/reports/driver-performance', undefined, adminToken);
  assert('GET /api/reports/driver-performance 200', r.status === 200, `got ${r.status}`);
  assert('returns array', Array.isArray(r.data));

  r = await req('GET', '/api/reports/alerts-summary', undefined, adminToken);
  assert('GET /api/reports/alerts-summary 200', r.status === 200, `got ${r.status}`);
  assert('has total field', typeof (r.data as any)?.total === 'number');

  // Date range filter
  const from = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const to = new Date().toISOString();
  r = await req('GET', `/api/reports/trips-summary?from=${from}&to=${to}`, undefined, managerToken);
  assert('GET /api/reports/trips-summary with date range 200', r.status === 200, `got ${r.status}`);

  // Viewer can access reports
  r = await req('GET', '/api/reports/fleet-stats', undefined, viewerToken);
  assert('GET /api/reports/fleet-stats viewer 200', r.status === 200, `got ${r.status}`);
}

async function testValidation() {
  section('Validation & Error Handling');

  // Bad email on login
  let r = await req('POST', '/auth/login', { email: 'not-an-email', password: 'abc' });
  assert('POST /auth/login bad email 400', r.status === 400, `got ${r.status}`);

  // Missing required fields on vehicle create
  r = await req('POST', '/api/vehicles', { plate: 'X' }, adminToken);
  assert('POST /api/vehicles missing fields 400', r.status === 400, `got ${r.status}`);

  // Invalid enum on alerts
  r = await req('POST', '/api/alerts', {
    vehicleId, type: 'invalid_type', severity: 'info', message: 'test',
  }, adminToken);
  assert('POST /api/alerts invalid enum 400', r.status === 400, `got ${r.status}`);

  // No auth header
  r = await req('GET', '/api/vehicles');
  assert('GET /api/vehicles no auth 401', r.status === 401, `got ${r.status}`);

  // Bad token
  r = await req('GET', '/api/vehicles', undefined, 'not.a.valid.token');
  assert('GET /api/vehicles bad token 401', r.status === 401, `got ${r.status}`);
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  const pg = new EmbeddedPostgres({
    databaseDir: path.join(__dirname, '..', '.pgtest'),
    user: 'postgres',
    password: 'obt2026',
    port: PG_PORT,
    persistent: false,
  });

  let server: ChildProcess | null = null;

  try {
    // ── 1. Start embedded PostgreSQL
    process.stdout.write('\nStarting embedded PostgreSQL...');
    await pg.initialise();
    await pg.start();
    await pg.createDatabase(DB_NAME);
    console.log(' done');

    const DB_URL = `postgresql://postgres:obt2026@localhost:${PG_PORT}/${DB_NAME}`;

    // Write .env for prisma CLI tools
    writeFileSync(
      path.join(__dirname, '..', '.env'),
      [
        `DATABASE_URL="${DB_URL}"`,
        `JWT_SECRET="integration-test-secret-key-long-enough-32chars"`,
        `JWT_REFRESH_SECRET="integration-test-refresh-secret-long-enough"`,
        `PORT=${APP_PORT}`,
        `NODE_ENV=test`,
        `CORS_ORIGIN="*"`,
      ].join('\n'),
    );

    // ── 2. Push schema
    process.stdout.write('Pushing Prisma schema...');
    execSync('npx prisma db push --force-reset --skip-generate', {
      stdio: 'pipe',
      env: { ...process.env, DATABASE_URL: DB_URL },
    });
    console.log(' done');

    // ── 3. Seed
    process.stdout.write('Seeding database...');
    execSync('npx tsx prisma/seed.ts', {
      stdio: 'pipe',
      env: { ...process.env, DATABASE_URL: DB_URL },
    });
    console.log(' done');

    // ── 4. Start server
    process.stdout.write('Starting server...');
    server = spawn('npx', ['tsx', 'src/index.ts'], {
      env: { ...process.env, DATABASE_URL: DB_URL },
      stdio: 'pipe',
      shell: true,
    });
    server.stderr?.on('data', (d: Buffer) => {
      const msg = d.toString();
      if (!msg.includes('ExperimentalWarning')) process.stderr.write(c.dim(msg));
    });
    await wait(4000);
    console.log(' done\n');

    // ── 5. Run all tests
    await testHealth();
    await testAuth();
    await testVehicles();
    await testDrivers();
    await testTrips();
    await testAlerts();
    await testGeofences();
    await testFuel();
    await testAccidents();
    await testOrganizations();
    await testUsers();
    await testReports();
    await testValidation();

  } finally {
    // ── 6. Cleanup
    if (server) server.kill('SIGTERM');
    try { await pg.stop(); } catch {}
  }

  // ── 7. Summary
  const total = passed + failed;
  console.log(`\n${c.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}`);
  console.log(c.bold(`RESULTS: ${total} tests`));
  console.log(`  ${c.green(`✔ ${passed} passed`)}`);
  if (failed > 0) {
    console.log(`  ${c.red(`✖ ${failed} failed`)}`);
    console.log(`\n${c.red('Failures:')}`);
    failures.forEach(f => console.log(`  • ${f}`));
  }
  console.log(c.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
