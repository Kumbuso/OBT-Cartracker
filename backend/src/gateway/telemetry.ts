/**
 * Shared telemetry processor — the single funnel for all inbound hardware data.
 *
 * All protocol gateways (GT06 TCP, Teltonika TCP, NMEA TCP, MQTT, HTTP OBD)
 * normalise their parsed data into a TelemetryPayload and call processTelemetry().
 *
 * Responsibilities:
 *   1. Persist vehicle position and extended sensor readings
 *   2. Run geofence entry/exit detection against all assigned zones
 *   3. Auto-generate alerts (speeding, low fuel, harsh events, SOS, etc.)
 *   4. Broadcast real-time update via Socket.io to the owning organisation
 */

import { prisma } from '../lib/prisma';
import { emitToOrg } from '../socket';
import { Prisma } from '@prisma/client';

export interface TelemetryPayload {
  lat?: number;
  lng?: number;
  speed?: number;           // km/h
  heading?: number;         // degrees 0–360
  altitude?: number;        // metres
  satellites?: number;
  fuelLevel?: number;       // 0–100 %
  fuelRaw?: number;         // raw ADC value (0–4095), auto-mapped to %
  engineOn?: boolean;
  odometer?: number;        // kilometres
  rpm?: number;
  coolantTemp?: number;     // °C
  batteryVoltage?: number;  // Volts
  temperature?: number;     // °C (cargo / ambient)
  harshBraking?: boolean;
  harshAcceleration?: boolean;
  externalPower?: boolean;
  tamperingDetected?: boolean;
  sosAlert?: boolean;
  timestamp?: Date;
}

// ── Geofence geometry helpers ─────────────────────────────────────────────────

function haversineMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

type Coord = { lat: number; lng: number };

function insideCircle(lat: number, lng: number, cLat: number, cLng: number, radius: number): boolean {
  return haversineMetres(lat, lng, cLat, cLng) <= radius;
}

// Ray-casting algorithm for point-in-polygon
function insidePolygon(lat: number, lng: number, coords: Coord[]): boolean {
  let inside = false;
  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    const xi = coords[i].lng, yi = coords[i].lat;
    const xj = coords[j].lng, yj = coords[j].lat;
    const intersects = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

// ── Main processor ────────────────────────────────────────────────────────────

export async function processTelemetry(vehicleId: string, payload: TelemetryPayload): Promise<void> {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    include: { geofences: { include: { geofence: true } } },
  });
  if (!vehicle) {
    console.warn(`[telemetry] unknown vehicleId: ${vehicleId}`);
    return;
  }

  const prevLat = vehicle.lat;
  const prevLng = vehicle.lng;
  const now = payload.timestamp ?? new Date();

  // Normalise raw ADC fuel reading to percentage
  let fuelLevel = payload.fuelLevel;
  if (fuelLevel === undefined && payload.fuelRaw !== undefined) {
    fuelLevel = Math.min(100, Math.round((payload.fuelRaw / 4095) * 100));
  }

  // ── 1. Build vehicle update ────────────────────────────────────────────────
  const vehicleUpdate: Prisma.VehicleUpdateInput = { lastSeen: now };

  if (payload.lat !== undefined) vehicleUpdate.lat = payload.lat;
  if (payload.lng !== undefined) vehicleUpdate.lng = payload.lng;
  if (payload.speed !== undefined) {
    vehicleUpdate.speed = payload.speed;
    if (payload.speed > 0) vehicleUpdate.status = 'active';
  }
  if (fuelLevel !== undefined) vehicleUpdate.fuelLevel = fuelLevel;
  if (payload.engineOn !== undefined) vehicleUpdate.engineOn = payload.engineOn;
  if (payload.odometer !== undefined) vehicleUpdate.odometer = payload.odometer;

  // ── 2. Batch DB writes ─────────────────────────────────────────────────────
  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.vehicle.update({ where: { id: vehicleId }, data: vehicleUpdate }),
  ];

  if (payload.lat !== undefined && payload.lng !== undefined) {
    ops.push(
      prisma.vehicleLocation.create({
        data: {
          vehicleId,
          lat: payload.lat,
          lng: payload.lng,
          speed: payload.speed ?? 0,
          heading: payload.heading,
          timestamp: now,
        },
      }),
    );
  }

  // Extended sensor readings (OBD, temperature probes, battery, etc.)
  const readings: { vehicleId: string; type: string; value: number; unit?: string; timestamp: Date }[] = [];
  if (payload.rpm !== undefined) readings.push({ vehicleId, type: 'rpm', value: payload.rpm, unit: 'rpm', timestamp: now });
  if (payload.coolantTemp !== undefined) readings.push({ vehicleId, type: 'coolant_temp', value: payload.coolantTemp, unit: '°C', timestamp: now });
  if (payload.batteryVoltage !== undefined) readings.push({ vehicleId, type: 'battery_voltage', value: payload.batteryVoltage, unit: 'V', timestamp: now });
  if (payload.temperature !== undefined) readings.push({ vehicleId, type: 'temperature', value: payload.temperature, unit: '°C', timestamp: now });
  if (payload.altitude !== undefined) readings.push({ vehicleId, type: 'altitude', value: payload.altitude, unit: 'm', timestamp: now });
  if (payload.satellites !== undefined) readings.push({ vehicleId, type: 'satellites', value: payload.satellites, timestamp: now });

  if (readings.length > 0) {
    ops.push(prisma.sensorReading.createMany({ data: readings }));
  }

  await prisma.$transaction(ops);

  // ── 3. Alert generation ────────────────────────────────────────────────────
  type AlertInput = Parameters<typeof prisma.alert.create>[0]['data'];
  const pendingAlerts: AlertInput[] = [];

  // Speeding
  if (payload.speed !== undefined && payload.speed > 120) {
    pendingAlerts.push({
      vehicleId,
      orgId: vehicle.orgId,
      type: 'speeding',
      severity: payload.speed > 150 ? 'critical' : 'warning',
      message: `${vehicle.plate} speeding at ${Math.round(payload.speed)} km/h`,
    });
  }

  // Low fuel (only alert on the downward crossing)
  if (fuelLevel !== undefined && fuelLevel < 15 && vehicle.fuelLevel >= 15) {
    pendingAlerts.push({
      vehicleId,
      orgId: vehicle.orgId,
      type: 'low_fuel',
      severity: fuelLevel < 5 ? 'critical' : 'warning',
      message: `${vehicle.plate} fuel critically low at ${Math.round(fuelLevel)}%`,
    });
  }

  // Harsh braking
  if (payload.harshBraking) {
    pendingAlerts.push({
      vehicleId,
      orgId: vehicle.orgId,
      type: 'harsh_braking',
      severity: 'warning',
      message: `${vehicle.plate} harsh braking detected`,
    });
  }

  // Harsh acceleration
  if (payload.harshAcceleration) {
    pendingAlerts.push({
      vehicleId,
      orgId: vehicle.orgId,
      type: 'harsh_acceleration',
      severity: 'warning',
      message: `${vehicle.plate} harsh acceleration detected`,
    });
  }

  // External power cut (tamper / tow detection)
  if (payload.externalPower === false) {
    pendingAlerts.push({
      vehicleId,
      orgId: vehicle.orgId,
      type: 'power_cut',
      severity: 'critical',
      message: `${vehicle.plate} external power disconnected`,
    });
  }

  // Tampering
  if (payload.tamperingDetected) {
    pendingAlerts.push({
      vehicleId,
      orgId: vehicle.orgId,
      type: 'tampering',
      severity: 'critical',
      message: `${vehicle.plate} tampering or case-open detected`,
    });
  }

  // SOS
  if (payload.sosAlert) {
    pendingAlerts.push({
      vehicleId,
      orgId: vehicle.orgId,
      type: 'sos',
      severity: 'critical',
      message: `${vehicle.plate} SOS alert triggered by driver`,
    });
  }

  // ── 4. Geofence checks ────────────────────────────────────────────────────
  const newLat = payload.lat;
  const newLng = payload.lng;

  if (newLat !== undefined && newLng !== undefined && prevLat !== null && prevLng !== null) {
    for (const gv of vehicle.geofences) {
      const g = gv.geofence;
      if (!g.active) continue;

      let wasInside = false;
      let isInside = false;

      if (g.shape === 'circle' && g.centerLat !== null && g.centerLng !== null && g.radius !== null) {
        wasInside = insideCircle(prevLat, prevLng, g.centerLat, g.centerLng, g.radius);
        isInside = insideCircle(newLat, newLng, g.centerLat, g.centerLng, g.radius);
      } else if (g.shape === 'polygon' && g.coordinates) {
        const coords = g.coordinates as Coord[];
        wasInside = insidePolygon(prevLat, prevLng, coords);
        isInside = insidePolygon(newLat, newLng, coords);
      }

      if (!wasInside && isInside && g.alertOnEnter) {
        pendingAlerts.push({
          vehicleId,
          orgId: vehicle.orgId,
          type: 'geofence_enter',
          severity: 'info',
          message: `${vehicle.plate} entered geofence "${g.name}"`,
        });
      } else if (wasInside && !isInside && g.alertOnExit) {
        pendingAlerts.push({
          vehicleId,
          orgId: vehicle.orgId,
          type: 'geofence_exit',
          severity: g.type === 'restricted' ? 'warning' : 'info',
          message: `${vehicle.plate} exited geofence "${g.name}"`,
        });
      }
    }
  }

  // Persist and broadcast all alerts
  for (const alertData of pendingAlerts) {
    const alert = await prisma.alert.create({ data: alertData as any });
    emitToOrg(vehicle.orgId, 'alert:new', alert);
  }

  // ── 5. Real-time broadcast ────────────────────────────────────────────────
  emitToOrg(vehicle.orgId, 'vehicle:location', {
    vehicleId,
    lat: newLat ?? vehicle.lat,
    lng: newLng ?? vehicle.lng,
    speed: payload.speed ?? vehicle.speed,
    heading: payload.heading,
    fuelLevel: fuelLevel ?? vehicle.fuelLevel,
    engineOn: payload.engineOn ?? vehicle.engineOn,
    batteryVoltage: payload.batteryVoltage,
    temperature: payload.temperature,
    timestamp: now,
  });
}

/** Look up a vehicle by IMEI. Returns null if not registered. */
export async function findVehicleByImei(imei: string): Promise<string | null> {
  const vehicle = await prisma.vehicle.findUnique({ where: { imei }, select: { id: true } });
  return vehicle?.id ?? null;
}

/** Look up a vehicle by device token. Returns null if not found. */
export async function findVehicleByToken(token: string): Promise<{ id: string; orgId: string } | null> {
  const vehicle = await prisma.vehicle.findUnique({
    where: { deviceToken: token },
    select: { id: true, orgId: true },
  });
  return vehicle ?? null;
}
