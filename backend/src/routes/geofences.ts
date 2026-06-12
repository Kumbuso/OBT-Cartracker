import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AppError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);

const circleSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['allowed', 'restricted']),
  shape: z.literal('circle'),
  centerLat: z.number(),
  centerLng: z.number(),
  radius: z.number().positive(),
  alertOnEnter: z.boolean().default(false),
  alertOnExit: z.boolean().default(true),
  active: z.boolean().default(true),
});

const polygonSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['allowed', 'restricted']),
  shape: z.literal('polygon'),
  coordinates: z
    .array(z.object({ lat: z.number(), lng: z.number() }))
    .min(3),
  alertOnEnter: z.boolean().default(false),
  alertOnExit: z.boolean().default(true),
  active: z.boolean().default(true),
});

const createSchema = z.discriminatedUnion('shape', [circleSchema, polygonSchema]);
const updateSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['allowed', 'restricted']).optional(),
  shape: z.enum(['circle', 'polygon']).optional(),
  centerLat: z.number().optional(),
  centerLng: z.number().optional(),
  radius: z.number().positive().optional(),
  coordinates: z.array(z.object({ lat: z.number(), lng: z.number() })).optional(),
  alertOnEnter: z.boolean().optional(),
  alertOnExit: z.boolean().optional(),
  active: z.boolean().optional(),
});

const assignSchema = z.object({
  vehicleIds: z.array(z.string()).min(1),
});

router.get('/', async (req, res, next) => {
  try {
    const geofences = await prisma.geofence.findMany({
      where: { orgId: req.user!.orgId },
      include: {
        vehicles: {
          include: { vehicle: { select: { id: true, plate: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(geofences);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const geofence = await prisma.geofence.findFirst({
      where: { id: req.params.id, orgId: req.user!.orgId },
      include: {
        vehicles: {
          include: { vehicle: { select: { id: true, plate: true, status: true, lat: true, lng: true } } },
        },
      },
    });
    if (!geofence) throw new AppError(404, 'Geofence not found');
    res.json(geofence);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRole('admin', 'manager'), validate(createSchema as any), async (req, res, next) => {
  try {
    const geofence = await prisma.geofence.create({
      data: { ...req.body, orgId: req.user!.orgId },
      include: { vehicles: true },
    });
    res.status(201).json(geofence);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    const existing = await prisma.geofence.findFirst({
      where: { id: req.params.id, orgId: req.user!.orgId },
    });
    if (!existing) throw new AppError(404, 'Geofence not found');

    const geofence = await prisma.geofence.update({
      where: { id: req.params.id },
      data: req.body,
      include: { vehicles: true },
    });
    res.json(geofence);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const existing = await prisma.geofence.findFirst({
      where: { id: req.params.id, orgId: req.user!.orgId },
    });
    if (!existing) throw new AppError(404, 'Geofence not found');
    await prisma.geofence.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.post('/:id/vehicles', requireRole('admin', 'manager'), validate(assignSchema), async (req, res, next) => {
  try {
    const geofence = await prisma.geofence.findFirst({
      where: { id: req.params.id, orgId: req.user!.orgId },
    });
    if (!geofence) throw new AppError(404, 'Geofence not found');

    const { vehicleIds } = req.body as { vehicleIds: string[] };

    await prisma.geofenceVehicle.createMany({
      data: vehicleIds.map((vehicleId) => ({ geofenceId: req.params.id, vehicleId })),
      skipDuplicates: true,
    });

    const updated = await prisma.geofence.findUnique({
      where: { id: req.params.id },
      include: {
        vehicles: { include: { vehicle: { select: { id: true, plate: true } } } },
      },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/vehicles/:vehicleId', requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    const geofence = await prisma.geofence.findFirst({
      where: { id: req.params.id, orgId: req.user!.orgId },
    });
    if (!geofence) throw new AppError(404, 'Geofence not found');

    await prisma.geofenceVehicle.delete({
      where: {
        geofenceId_vehicleId: {
          geofenceId: req.params.id,
          vehicleId: req.params.vehicleId,
        },
      },
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
