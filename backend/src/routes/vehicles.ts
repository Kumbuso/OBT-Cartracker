import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AppError } from '../middleware/errorHandler';
import { emitToOrg } from '../socket';

const router = Router();
router.use(authenticate);

const driverSelect = { id: true, name: true, phone: true, licenseNumber: true };

const createSchema = z.object({
  plate: z.string().min(1),
  make: z.string().min(1),
  model: z.string().min(1),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 2),
  driverId: z.string().optional(),
  group: z.string().optional(),
  fuelLevel: z.number().min(0).max(100).optional(),
  odometer: z.number().min(0).optional(),
  imei: z.string().min(15).max(17).optional().nullable(),
});

const updateSchema = createSchema.partial().extend({
  status: z.enum(['active', 'idle', 'offline', 'maintenance']).optional(),
  engineOn: z.boolean().optional(),
  imei: z.string().min(15).max(17).optional().nullable(),
});

const locationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  speed: z.number().min(0).default(0),
  heading: z.number().min(0).max(360).optional(),
  address: z.string().optional(),
  fuelLevel: z.number().min(0).max(100).optional(),
  engineOn: z.boolean().optional(),
});

router.get('/', async (req, res, next) => {
  try {
    const { status, group, driverId } = req.query;
    const vehicles = await prisma.vehicle.findMany({
      where: {
        orgId: req.user!.orgId,
        ...(status ? { status: status as any } : {}),
        ...(group ? { group: group as string } : {}),
        ...(driverId ? { driverId: driverId as string } : {}),
      },
      include: { driver: { select: driverSelect } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(vehicles);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: req.params.id, orgId: req.user!.orgId },
      include: { driver: { select: driverSelect } },
    });
    if (!vehicle) throw new AppError(404, 'Vehicle not found');
    res.json(vehicle);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRole('admin', 'manager'), validate(createSchema), async (req, res, next) => {
  try {
    const vehicle = await prisma.vehicle.create({
      data: { ...req.body, orgId: req.user!.orgId },
      include: { driver: { select: driverSelect } },
    });
    res.status(201).json(vehicle);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireRole('admin', 'manager'), validate(updateSchema), async (req, res, next) => {
  try {
    const existing = await prisma.vehicle.findFirst({
      where: { id: req.params.id, orgId: req.user!.orgId },
    });
    if (!existing) throw new AppError(404, 'Vehicle not found');

    const vehicle = await prisma.vehicle.update({
      where: { id: req.params.id },
      data: req.body,
      include: { driver: { select: driverSelect } },
    });
    res.json(vehicle);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const existing = await prisma.vehicle.findFirst({
      where: { id: req.params.id, orgId: req.user!.orgId },
    });
    if (!existing) throw new AppError(404, 'Vehicle not found');
    await prisma.vehicle.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.post('/:id/location', validate(locationSchema), async (req, res, next) => {
  try {
    const { lat, lng, speed, heading, address, fuelLevel, engineOn } = req.body;

    const vehicle = await prisma.vehicle.findFirst({
      where: { id: req.params.id, orgId: req.user!.orgId },
    });
    if (!vehicle) throw new AppError(404, 'Vehicle not found');

    const updatedStatus = speed > 0 ? ('active' as const) : vehicle.status;

    await prisma.$transaction([
      prisma.vehicle.update({
        where: { id: req.params.id },
        data: {
          lat,
          lng,
          speed,
          address,
          lastSeen: new Date(),
          status: updatedStatus,
          ...(fuelLevel !== undefined ? { fuelLevel } : {}),
          ...(engineOn !== undefined ? { engineOn } : {}),
        },
      }),
      prisma.vehicleLocation.create({
        data: { vehicleId: req.params.id, lat, lng, speed, heading },
      }),
    ]);

    // Auto-generate speeding alert
    if (speed > 120) {
      const alert = await prisma.alert.create({
        data: {
          vehicleId: req.params.id,
          orgId: req.user!.orgId,
          type: 'speeding',
          severity: speed > 150 ? 'critical' : 'warning',
          message: `Vehicle ${vehicle.plate} is speeding at ${Math.round(speed)} km/h`,
        },
      });
      emitToOrg(req.user!.orgId, 'alert:new', alert);
    }

    // Auto-generate low fuel alert
    if (fuelLevel !== undefined && fuelLevel < 15 && vehicle.fuelLevel >= 15) {
      const alert = await prisma.alert.create({
        data: {
          vehicleId: req.params.id,
          orgId: req.user!.orgId,
          type: 'low_fuel',
          severity: 'warning',
          message: `Vehicle ${vehicle.plate} fuel level is critically low at ${Math.round(fuelLevel)}%`,
        },
      });
      emitToOrg(req.user!.orgId, 'alert:new', alert);
    }

    const payload = { vehicleId: req.params.id, lat, lng, speed, heading, address, timestamp: new Date() };
    emitToOrg(req.user!.orgId, 'vehicle:location', payload);

    res.json(payload);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/locations', async (req, res, next) => {
  try {
    const { from, to, limit = '200' } = req.query;

    const vehicle = await prisma.vehicle.findFirst({
      where: { id: req.params.id, orgId: req.user!.orgId },
    });
    if (!vehicle) throw new AppError(404, 'Vehicle not found');

    const locations = await prisma.vehicleLocation.findMany({
      where: {
        vehicleId: req.params.id,
        ...(from || to
          ? {
              timestamp: {
                ...(from ? { gte: new Date(from as string) } : {}),
                ...(to ? { lte: new Date(to as string) } : {}),
              },
            }
          : {}),
      },
      orderBy: { timestamp: 'desc' },
      take: Math.min(parseInt(limit as string, 10), 1000),
    });
    res.json(locations);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/trips', async (req, res, next) => {
  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: req.params.id, orgId: req.user!.orgId },
    });
    if (!vehicle) throw new AppError(404, 'Vehicle not found');

    const trips = await prisma.trip.findMany({
      where: { vehicleId: req.params.id },
      include: { driver: { select: { id: true, name: true } } },
      orderBy: { startTime: 'desc' },
      take: 50,
    });
    res.json(trips);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/alerts', async (req, res, next) => {
  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: req.params.id, orgId: req.user!.orgId },
    });
    if (!vehicle) throw new AppError(404, 'Vehicle not found');

    const alerts = await prisma.alert.findMany({
      where: { vehicleId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(alerts);
  } catch (err) {
    next(err);
  }
});

export default router;
