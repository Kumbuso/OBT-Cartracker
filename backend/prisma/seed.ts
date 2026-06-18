import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.organization.findFirst({ where: { name: 'OBT Logistics Zambia' } });
  if (existing) {
    console.log('Database already seeded. Run db:reset first to re-seed.');
    return;
  }

  console.log('Seeding database...');

  const org = await prisma.organization.create({
    data: {
      name: 'OBT Logistics Zambia',
      plan: 'pro',
      status: 'active',
      maxVehicles: 50,
      maxUsers: 20,
    },
  });

  const hash = await bcrypt.hash('obt2026', 10);

  await prisma.user.createMany({
    data: [
      {
        name: 'Admin User',
        email: 'admin@obt.zm',
        passwordHash: hash,
        role: 'admin',
        status: 'active',
        phone: '+260 97 123 4567',
        orgId: org.id,
      },
      {
        name: 'Fleet Manager',
        email: 'manager@obt.zm',
        passwordHash: hash,
        role: 'manager',
        status: 'active',
        phone: '+260 97 234 5678',
        orgId: org.id,
      },
      {
        name: 'View Only',
        email: 'viewer@obt.zm',
        passwordHash: hash,
        role: 'viewer',
        status: 'active',
        orgId: org.id,
      },
    ],
  });

  const [d1, d2, d3] = await prisma.$transaction([
    prisma.driver.create({
      data: { name: 'James Mwale', phone: '+260 96 111 2222', licenseNumber: 'ZM-DL-001234', orgId: org.id },
    }),
    prisma.driver.create({
      data: { name: 'Sarah Banda', phone: '+260 96 333 4444', licenseNumber: 'ZM-DL-005678', orgId: org.id },
    }),
    prisma.driver.create({
      data: { name: 'Peter Phiri', phone: '+260 96 555 6666', licenseNumber: 'ZM-DL-009012', orgId: org.id },
    }),
  ]);

  const now = new Date();

  const [v1, v2, v3, v4, v5] = await prisma.$transaction([
    prisma.vehicle.create({
      data: {
        plate: 'ABJ 1234 ZM', make: 'Toyota', model: 'Hilux', year: 2022,
        status: 'active', driverId: d1.id, orgId: org.id,
        odometer: 45280, fuelLevel: 78, speed: 65, engineOn: true, group: 'Delivery',
        lat: -15.4167, lng: 28.2833, address: 'Great East Road, Lusaka', lastSeen: now,
      },
    }),
    prisma.vehicle.create({
      data: {
        plate: 'CDL 5678 ZM', make: 'Isuzu', model: 'NKR', year: 2021,
        status: 'idle', driverId: d2.id, orgId: org.id,
        odometer: 89150, fuelLevel: 45, speed: 0, engineOn: false, group: 'Logistics',
        lat: -15.4500, lng: 28.3000, address: 'Cairo Road, Lusaka',
        lastSeen: new Date(now.getTime() - 30 * 60 * 1000),
      },
    }),
    prisma.vehicle.create({
      data: {
        plate: 'EFN 9012 ZM', make: 'Mercedes', model: 'Sprinter', year: 2023,
        status: 'active', driverId: d3.id, orgId: org.id,
        odometer: 12430, fuelLevel: 92, speed: 88, engineOn: true, group: 'Delivery',
        lat: -15.3800, lng: 28.3200, address: 'Independence Avenue, Lusaka', lastSeen: now,
      },
    }),
    prisma.vehicle.create({
      data: {
        plate: 'GHR 3456 ZM', make: 'Ford', model: 'Ranger', year: 2020,
        status: 'maintenance', orgId: org.id,
        odometer: 112000, fuelLevel: 30, speed: 0, engineOn: false, group: 'Management',
        lat: -15.4200, lng: 28.2900,
        lastSeen: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.vehicle.create({
      data: {
        plate: 'IJT 7890 ZM', make: 'Nissan', model: 'Navara', year: 2022,
        status: 'offline', orgId: org.id,
        odometer: 67890, fuelLevel: 12, speed: 0, engineOn: false, group: 'Logistics',
        lat: -15.4600, lng: 28.2700,
        lastSeen: new Date(now.getTime() - 6 * 60 * 60 * 1000),
      },
    }),
  ]);

  // Trips
  await prisma.trip.createMany({
    data: [
      {
        vehicleId: v1.id, driverId: d1.id, orgId: org.id,
        startTime: new Date(now.getTime() - 2 * 3600 * 1000),
        endTime: new Date(now.getTime() - 30 * 60 * 1000),
        startLat: -15.4000, startLng: 28.2800, startAddress: 'Lusaka Depot',
        endLat: -15.4167, endLng: 28.2833, endAddress: 'Great East Road Delivery',
        distance: 42.5, duration: 5400, avgSpeed: 45, maxSpeed: 98, fuelConsumed: 6.5,
        status: 'completed',
      },
      {
        vehicleId: v3.id, driverId: d3.id, orgId: org.id,
        startTime: new Date(now.getTime() - 45 * 60 * 1000),
        startLat: -15.4200, startLng: 28.2900, startAddress: 'Lusaka Depot',
        distance: 28, avgSpeed: 55, maxSpeed: 88, fuelConsumed: 4.2,
        status: 'active',
      },
    ],
  });

  // Alerts
  await prisma.alert.createMany({
    data: [
      {
        vehicleId: v1.id, orgId: org.id, type: 'speeding', severity: 'warning',
        message: `Vehicle ${v1.plate} exceeded speed limit at 98 km/h`, read: false,
        createdAt: new Date(now.getTime() - 20 * 60 * 1000),
      },
      {
        vehicleId: v5.id, orgId: org.id, type: 'low_fuel', severity: 'warning',
        message: `Vehicle ${v5.plate} fuel level is critically low at 12%`, read: false,
        createdAt: new Date(now.getTime() - 60 * 60 * 1000),
      },
      {
        vehicleId: v4.id, orgId: org.id, type: 'maintenance_due', severity: 'critical',
        message: `Vehicle ${v4.plate} is overdue for scheduled maintenance`, read: false,
        createdAt: new Date(now.getTime() - 2 * 3600 * 1000),
      },
      {
        vehicleId: v2.id, orgId: org.id, type: 'idle_timeout', severity: 'info',
        message: `Vehicle ${v2.plate} has been idle for over 30 minutes`, read: true,
        createdAt: new Date(now.getTime() - 3 * 3600 * 1000),
      },
    ],
  });

  // Fuel events
  await prisma.fuelEvent.createMany({
    data: [
      {
        vehicleId: v1.id, orgId: org.id, type: 'refuel', liters: 45,
        costPerLiter: 2.85, totalCost: 128.25, odometer: 45100,
        station: 'TotalEnergies Great East Road',
        timestamp: new Date(now.getTime() - 24 * 3600 * 1000),
      },
      {
        vehicleId: v2.id, orgId: org.id, type: 'refuel', liters: 60,
        costPerLiter: 2.85, totalCost: 171.00, odometer: 89000,
        station: 'ENGEN Cairo Road',
        timestamp: new Date(now.getTime() - 2 * 24 * 3600 * 1000),
      },
      {
        vehicleId: v3.id, orgId: org.id, type: 'consumption', liters: 4.2,
        odometer: 12430, timestamp: new Date(now.getTime() - 45 * 60 * 1000),
      },
    ],
  });

  // Devices
  await prisma.device.createMany({
    data: [
      {
        serial: 'OBT-GPS-001', imei: '356307042441013', simNumber: '+260 95 1234 001',
        type: 'gps', status: 'online', vehicleId: v1.id, orgId: org.id,
        firmware: '3.2.1', battery: 87, signal: 4, lastSeen: now,
      },
      {
        serial: 'OBT-GPS-002', imei: '356307042441021', simNumber: '+260 95 1234 002',
        type: 'gps', status: 'online', vehicleId: v2.id, orgId: org.id,
        firmware: '3.2.1', battery: 65, signal: 3, lastSeen: new Date(now.getTime() - 3 * 60000),
      },
      {
        serial: 'OBT-GPS-003', imei: '356307042441039', simNumber: '+260 95 1234 003',
        type: 'gps', status: 'fault', vehicleId: v4.id, orgId: org.id,
        firmware: '3.1.8', battery: 12, signal: 0, fault: 'GPS module not responding',
        lastSeen: new Date(now.getTime() - 37 * 60000),
      },
      {
        serial: 'OBT-GPS-004', imei: null, simNumber: null,
        type: 'gps', status: 'offline', vehicleId: null, orgId: org.id,
        firmware: '3.2.1', battery: 45, notes: 'Spare unit — IMEI not yet registered',
        lastSeen: new Date(now.getTime() - 16 * 3600000),
      },
      {
        serial: 'OBT-FUEL-001', imei: null, simNumber: null,
        type: 'fuel', status: 'online', vehicleId: v1.id, orgId: org.id,
        firmware: '1.4.0', lastSeen: now,
      },
      {
        serial: 'OBT-FUEL-002', imei: null, simNumber: null,
        type: 'fuel', status: 'online', vehicleId: v3.id, orgId: org.id,
        firmware: '1.4.0', lastSeen: new Date(now.getTime() - 4 * 60000),
      },
      {
        serial: 'OBT-OBD-001', imei: '862531041782345', simNumber: null,
        type: 'obd', status: 'online', vehicleId: v2.id, orgId: org.id,
        firmware: '2.1.3', lastSeen: new Date(now.getTime() - 2 * 60000),
      },
      {
        serial: 'OBT-TEMP-001', imei: null, simNumber: null,
        type: 'temp', status: 'low_battery', vehicleId: v3.id, orgId: org.id,
        firmware: '1.0.5', battery: 8, lastSeen: new Date(now.getTime() - 18 * 60000),
      },
    ],
  });

  // Sync vehicle.imei from registered GPS devices
  await prisma.vehicle.update({ where: { id: v1.id }, data: { imei: '356307042441013' } });
  await prisma.vehicle.update({ where: { id: v2.id }, data: { imei: '356307042441021' } });
  await prisma.vehicle.update({ where: { id: v4.id }, data: { imei: '356307042441039' } });

  // Geofences
  await prisma.geofence.createMany({
    data: [
      {
        name: 'Lusaka City Center', type: 'allowed', shape: 'circle',
        centerLat: -15.4167, centerLng: 28.2833, radius: 10000,
        alertOnEnter: false, alertOnExit: true, active: true, orgId: org.id,
      },
      {
        name: 'Lusaka Depot Zone', type: 'allowed', shape: 'circle',
        centerLat: -15.4200, centerLng: 28.2900, radius: 500,
        alertOnEnter: false, alertOnExit: false, active: true, orgId: org.id,
      },
      {
        name: 'Restricted Industrial Area', type: 'restricted', shape: 'polygon',
        coordinates: [
          { lat: -15.3900, lng: 28.3100 },
          { lat: -15.3900, lng: 28.3400 },
          { lat: -15.4100, lng: 28.3400 },
          { lat: -15.4100, lng: 28.3100 },
        ],
        alertOnEnter: true, alertOnExit: false, active: true, orgId: org.id,
      },
    ],
  });

  console.log('\nDatabase seeded successfully!');
  console.log('Demo credentials:');
  console.log('  admin@obt.zm / obt2026');
  console.log('  manager@obt.zm / obt2026');
  console.log('  viewer@obt.zm / obt2026');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
