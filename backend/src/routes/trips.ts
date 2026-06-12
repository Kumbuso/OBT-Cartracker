import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AppError } from '../middleware/errorHandler';
import { emitToOrg } from '../socket';

const router = Router();
router.use(authenticate);

const createSchema = z.object({
  vehicleId: z.string(),
  driverId: z.string().optional(),
  startTime: z.string().datetime().optional(),
  startLat: z.number(),
  startLng: z.number(),
  startAddress: z.string().optional(),
});

const updateSchema = z.object({
  endTime: z.string().datetime().optional(),
  endLat: z.number().optional(),
  endLng: z.number().optional(),
  endAddress: z.string().optional(),
  distance: z.number().min(0).optional(),
  duration: z.number().int().min(0).optional(),
  avgSpeed: z.number().min(0).optional(),
  maxSpeed: z.number().min(0).optional(),
  fuelConsumed: z.number().min(0).optional(),
  status: z.enum(['active', 'completed', 'cancelled']).optional(),
});

router.get('/', async (req, res, next) => {
  try {
    const { vehicleId, driverId, status, from, to, limit = '50' } = req.query;
    const trips = await prisma.trip.findMany({
      where: {
        orgId: req.user!.orgId,
        ...(vehicleId ? { vehicleId: vehicleId as string } : {}),
        ...(driverId ? { driverId: driverId as string } : {}),
        ...(status ? { status: status as any } : {}),
        ...(from || to
          ? {
              startTime: {
                ...(from ? { gte: new Date(from as string) } : {}),
                ...(to ? { lte: new Date(to as string) } : {}),
              },
            }
          : {}),
      },
      include: {
        vehicle: { select: { id: true, plate: true, make: true, model: true } },
        driver: { select: { id: true, name: true } },
      },
      orderBy: { startTime: 'desc' },
      take: Math.min(parseInt(limit as string, 10), 200),
    });
    res.json(trips);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const trip = await prisma.trip.findFirst({
      where: { id: req.params.id, orgId: req.user!.orgId },
      include: {
        vehicle: { select: { id: true, plate: true, make: true, model: true } },
        driver: { select: { id: true, name: true, phone: true } },
      },
    });
    if (!trip) throw new AppError(404, 'Trip not found');
    res.json(trip);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRole('admin', 'manager'), validate(createSchema), async (req, res, next) => {
  try {
    const { vehicleId } = req.body;
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, orgId: req.user!.orgId },
    });
    if (!vehicle) throw new AppError(404, 'Vehicle not found');

    const trip = await prisma.trip.create({
      data: {
        ...req.body,
        startTime: req.body.startTime ? new Date(req.body.startTime) : new Date(),
        orgId: req.user!.orgId,
      },
      include: {
        vehicle: { select: { id: true, plate: true } },
        driver: { select: { id: true, name: true } },
      },
    });

    emitToOrg(req.user!.orgId, 'trip:updated', trip);
    res.status(201).json(trip);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireRole('admin', 'manager'), validate(updateSchema), async (req, res, next) => {
  try {
    const existing = await prisma.trip.findFirst({
      where: { id: req.params.id, orgId: req.user!.orgId },
    });
    if (!existing) throw new AppError(404, 'Trip not found');

    const data: Record<string, unknown> = { ...req.body };
    if (req.body.endTime) data.endTime = new Date(req.body.endTime);

    const trip = await prisma.trip.update({
      where: { id: req.params.id },
      data,
      include: {
        vehicle: { select: { id: true, plate: true } },
        driver: { select: { id: true, name: true } },
      },
    });

    emitToOrg(req.user!.orgId, 'trip:updated', trip);
    res.json(trip);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const existing = await prisma.trip.findFirst({
      where: { id: req.params.id, orgId: req.user!.orgId },
    });
    if (!existing) throw new AppError(404, 'Trip not found');
    await prisma.trip.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
