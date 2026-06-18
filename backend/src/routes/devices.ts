/**
 * Device API — two distinct concerns in one router:
 *
 * A) Fleet device registry (user JWT auth)
 *    Manage the Device table: register, list, update, delete, assign to vehicle.
 *    GET    /api/devices              — list devices for the user's org
 *    POST   /api/devices/register     — register a new device
 *    PUT    /api/devices/:id          — update device (notes, firmware, status)
 *    DELETE /api/devices/:id          — remove device
 *    POST   /api/devices/:id/assign   — assign device to a vehicle (also sets vehicle.imei)
 *    DELETE /api/devices/:id/assign   — unassign device from vehicle
 *
 * B) Hardware gateway (X-Device-Token auth)
 *    Used by on-board gateways (Raspberry Pi, ESP32, OBD-II dongle) that POST
 *    telemetry over HTTPS instead of raw TCP protocol.
 *    POST   /api/devices/telemetry    — full telemetry payload
 *    POST   /api/devices/location     — GPS-only shortcut
 *    GET    /api/devices/me           — vehicle config for the on-board gateway
 *
 * C) Token management (admin JWT)
 *    POST   /api/devices/:vehicleId/token   — generate hardware token
 *    DELETE /api/devices/:vehicleId/token   — revoke hardware token
 */

import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AppError } from '../middleware/errorHandler';
import { processTelemetry, findVehicleByToken } from '../gateway/telemetry';

const router = Router();

// ── Device token middleware ────────────────────────────────────────────────────

async function authenticateDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.headers['x-device-token'] as string | undefined;
  if (!token) {
    res.status(401).json({ error: 'X-Device-Token header required' });
    return;
  }
  const vehicle = await findVehicleByToken(token);
  if (!vehicle) {
    res.status(401).json({ error: 'Invalid device token' });
    return;
  }
  req.device = vehicle;
  next();
}

// ── Validation schemas ────────────────────────────────────────────────────────

const telemetrySchema = z.object({
  lat: z.number().optional(),
  lng: z.number().optional(),
  speed: z.number().min(0).optional(),
  heading: z.number().min(0).max(360).optional(),
  altitude: z.number().optional(),
  satellites: z.number().int().optional(),
  fuelLevel: z.number().min(0).max(100).optional(),
  fuelRaw: z.number().min(0).max(4095).optional(),
  engineOn: z.boolean().optional(),
  odometer: z.number().min(0).optional(),
  rpm: z.number().min(0).optional(),
  coolantTemp: z.number().optional(),
  batteryVoltage: z.number().optional(),
  temperature: z.number().optional(),
  harshBraking: z.boolean().optional(),
  harshAcceleration: z.boolean().optional(),
  externalPower: z.boolean().optional(),
  tamperingDetected: z.boolean().optional(),
  sosAlert: z.boolean().optional(),
  timestamp: z.string().datetime().optional(),
});

const locationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  speed: z.number().min(0).default(0),
  heading: z.number().min(0).max(360).optional(),
  altitude: z.number().optional(),
  satellites: z.number().int().optional(),
  timestamp: z.string().datetime().optional(),
});

// ── Device-authenticated routes ───────────────────────────────────────────────

router.post('/telemetry', authenticateDevice, validate(telemetrySchema), async (req, res, next) => {
  try {
    const { timestamp, ...rest } = req.body as z.infer<typeof telemetrySchema>;
    await processTelemetry(req.device!.id, {
      ...rest,
      timestamp: timestamp ? new Date(timestamp) : undefined,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/location', authenticateDevice, validate(locationSchema), async (req, res, next) => {
  try {
    const { timestamp, ...rest } = req.body as z.infer<typeof locationSchema>;
    await processTelemetry(req.device!.id, {
      ...rest,
      timestamp: timestamp ? new Date(timestamp) : undefined,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticateDevice, async (req, res, next) => {
  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: req.device!.id },
      select: {
        id: true,
        plate: true,
        make: true,
        model: true,
        year: true,
        status: true,
        odometer: true,
        fuelLevel: true,
        engineOn: true,
        imei: true,
        lat: true,
        lng: true,
        lastSeen: true,
      },
    });
    if (!vehicle) throw new AppError(404, 'Vehicle not found');
    res.json(vehicle);
  } catch (err) {
    next(err);
  }
});

// ── Admin token management (requires user JWT + admin/manager role) ────────────

router.post(
  '/:vehicleId/token',
  authenticate,
  requireRole('admin', 'manager'),
  async (req, res, next) => {
    try {
      const existing = await prisma.vehicle.findFirst({
        where: { id: req.params.vehicleId, orgId: req.user!.orgId },
      });
      if (!existing) throw new AppError(404, 'Vehicle not found');

      const token = crypto.randomBytes(32).toString('hex');
      const vehicle = await prisma.vehicle.update({
        where: { id: req.params.vehicleId },
        data: { deviceToken: token },
        select: { id: true, plate: true, deviceToken: true },
      });
      res.json(vehicle);
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  '/:vehicleId/token',
  authenticate,
  requireRole('admin', 'manager'),
  async (req, res, next) => {
    try {
      const existing = await prisma.vehicle.findFirst({
        where: { id: req.params.vehicleId, orgId: req.user!.orgId },
      });
      if (!existing) throw new AppError(404, 'Vehicle not found');

      await prisma.vehicle.update({
        where: { id: req.params.vehicleId },
        data: { deviceToken: null },
      });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

// ── Fleet device registry (user JWT) ─────────────────────────────────────────

const registerSchema = z.object({
  serial:    z.string().min(1),
  imei:      z.string().regex(/^\d{15,17}$/, 'IMEI must be 15-17 digits').optional().nullable(),
  simNumber: z.string().optional().nullable(),
  type:      z.enum(['gps', 'fuel', 'obd', 'dashcam', 'temp']),
  notes:     z.string().optional(),
  vehicleId: z.string().optional().nullable(),
});

const updateDeviceSchema = z.object({
  serial:    z.string().min(1).optional(),
  imei:      z.string().regex(/^\d{15,17}$/).optional().nullable(),
  simNumber: z.string().optional().nullable(),
  status:    z.enum(['online', 'offline', 'fault', 'low_battery']).optional(),
  firmware:  z.string().optional(),
  notes:     z.string().optional(),
  fault:     z.string().optional().nullable(),
});

const assignSchema = z.object({
  vehicleId: z.string(),
});

// List all devices for the org
router.get('/', authenticate, async (req, res, next) => {
  try {
    const devices = await prisma.device.findMany({
      where: { orgId: req.user!.orgId },
      include: { vehicle: { select: { id: true, plate: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(devices);
  } catch (err) { next(err); }
});

// Register a new device
router.post('/register', authenticate, requireRole('admin', 'manager'), validate(registerSchema), async (req, res, next) => {
  try {
    const { vehicleId, ...rest } = req.body as z.infer<typeof registerSchema>;

    // Validate vehicleId belongs to this org if provided
    if (vehicleId) {
      const v = await prisma.vehicle.findFirst({ where: { id: vehicleId, orgId: req.user!.orgId } });
      if (!v) throw new AppError(400, 'Vehicle not found in your organisation');
    }

    const device = await prisma.device.create({
      data: { ...rest, orgId: req.user!.orgId, vehicleId: vehicleId ?? null },
      include: { vehicle: { select: { id: true, plate: true } } },
    });

    // If a vehicle is assigned and the device has an IMEI, write it to the vehicle
    if (vehicleId && rest.imei) {
      await prisma.vehicle.update({ where: { id: vehicleId }, data: { imei: rest.imei } });
    }

    res.status(201).json(device);
  } catch (err) { next(err); }
});

// Update device metadata
router.put('/:id', authenticate, requireRole('admin', 'manager'), validate(updateDeviceSchema), async (req, res, next) => {
  try {
    const existing = await prisma.device.findFirst({ where: { id: req.params.id, orgId: req.user!.orgId } });
    if (!existing) throw new AppError(404, 'Device not found');

    const device = await prisma.device.update({
      where: { id: req.params.id },
      data: req.body,
      include: { vehicle: { select: { id: true, plate: true } } },
    });
    res.json(device);
  } catch (err) { next(err); }
});

// Assign device to a vehicle — also syncs vehicle.imei
router.post('/:id/assign', authenticate, requireRole('admin', 'manager'), validate(assignSchema), async (req, res, next) => {
  try {
    const device = await prisma.device.findFirst({ where: { id: req.params.id, orgId: req.user!.orgId } });
    if (!device) throw new AppError(404, 'Device not found');

    const vehicle = await prisma.vehicle.findFirst({ where: { id: req.body.vehicleId, orgId: req.user!.orgId } });
    if (!vehicle) throw new AppError(404, 'Vehicle not found');

    // Update device → vehicle link
    const updated = await prisma.device.update({
      where: { id: req.params.id },
      data: { vehicleId: vehicle.id },
      include: { vehicle: { select: { id: true, plate: true } } },
    });

    // Sync vehicle.imei from the device's IMEI
    if (device.imei) {
      await prisma.vehicle.update({ where: { id: vehicle.id }, data: { imei: device.imei } });
    }

    res.json(updated);
  } catch (err) { next(err); }
});

// Unassign device from vehicle — clears vehicle.imei if it was set by this device
router.delete('/:id/assign', authenticate, requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    const device = await prisma.device.findFirst({ where: { id: req.params.id, orgId: req.user!.orgId } });
    if (!device) throw new AppError(404, 'Device not found');

    if (device.vehicleId && device.imei) {
      const vehicle = await prisma.vehicle.findUnique({ where: { id: device.vehicleId } });
      if (vehicle?.imei === device.imei) {
        await prisma.vehicle.update({ where: { id: device.vehicleId }, data: { imei: null } });
      }
    }

    const updated = await prisma.device.update({
      where: { id: req.params.id },
      data: { vehicleId: null },
      include: { vehicle: { select: { id: true, plate: true } } },
    });
    res.json(updated);
  } catch (err) { next(err); }
});

// Delete a device
router.delete('/:id', authenticate, requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    const existing = await prisma.device.findFirst({ where: { id: req.params.id, orgId: req.user!.orgId } });
    if (!existing) throw new AppError(404, 'Device not found');

    // Clear vehicle.imei if it was set by this device
    if (existing.vehicleId && existing.imei) {
      const vehicle = await prisma.vehicle.findUnique({ where: { id: existing.vehicleId } });
      if (vehicle?.imei === existing.imei) {
        await prisma.vehicle.update({ where: { id: existing.vehicleId }, data: { imei: null } });
      }
    }

    await prisma.device.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
