/**
 * Device HTTP API — used by on-board gateways (Raspberry Pi, ESP32, OBD-II dongle
 * with WiFi/cellular) that POST telemetry over HTTPS instead of a raw TCP protocol.
 *
 * Authentication: X-Device-Token header (stored as vehicle.deviceToken).
 * No user JWT is required — the token identifies the vehicle directly.
 *
 * POST /api/devices/telemetry
 *   Full payload: GPS + OBD + fuel + sensor data in one request.
 *
 * POST /api/devices/location
 *   GPS-only shortcut (subset of telemetry).
 *
 * GET /api/devices/me
 *   Returns the vehicle record linked to the device token — useful for
 *   on-board gateways to verify connectivity and retrieve config.
 *
 * Device token management (admin only, uses user JWT):
 * POST /api/devices/:vehicleId/token  — generate and assign a new token
 * DELETE /api/devices/:vehicleId/token — revoke the token
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

export default router;
