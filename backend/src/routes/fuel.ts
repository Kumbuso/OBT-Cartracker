import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AppError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);

const createSchema = z.object({
  vehicleId: z.string(),
  type: z.enum(['refuel', 'consumption']),
  liters: z.number().positive(),
  costPerLiter: z.number().positive().optional(),
  totalCost: z.number().positive().optional(),
  odometer: z.number().min(0).optional(),
  station: z.string().optional(),
  timestamp: z.string().datetime().optional(),
});

router.get('/', async (req, res, next) => {
  try {
    const { vehicleId, type, from, to, limit = '100' } = req.query;
    const events = await prisma.fuelEvent.findMany({
      where: {
        orgId: req.user!.orgId,
        ...(vehicleId ? { vehicleId: vehicleId as string } : {}),
        ...(type ? { type: type as any } : {}),
        ...(from || to
          ? {
              timestamp: {
                ...(from ? { gte: new Date(from as string) } : {}),
                ...(to ? { lte: new Date(to as string) } : {}),
              },
            }
          : {}),
      },
      include: { vehicle: { select: { id: true, plate: true } } },
      orderBy: { timestamp: 'desc' },
      take: Math.min(parseInt(limit as string, 10), 500),
    });
    res.json(events);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const event = await prisma.fuelEvent.findFirst({
      where: { id: req.params.id, orgId: req.user!.orgId },
      include: { vehicle: { select: { id: true, plate: true } } },
    });
    if (!event) throw new AppError(404, 'Fuel event not found');
    res.json(event);
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

    const data = { ...req.body, orgId: req.user!.orgId };
    if (data.timestamp) data.timestamp = new Date(data.timestamp);

    // Update vehicle fuel level on refuel
    if (req.body.type === 'refuel') {
      await prisma.vehicle.update({
        where: { id: vehicleId },
        data: {
          fuelLevel: Math.min(100, vehicle.fuelLevel + (req.body.liters / 80) * 100),
          ...(req.body.odometer ? { odometer: req.body.odometer } : {}),
        },
      });
    }

    const event = await prisma.fuelEvent.create({
      data,
      include: { vehicle: { select: { id: true, plate: true } } },
    });
    res.status(201).json(event);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const existing = await prisma.fuelEvent.findFirst({
      where: { id: req.params.id, orgId: req.user!.orgId },
    });
    if (!existing) throw new AppError(404, 'Fuel event not found');
    await prisma.fuelEvent.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
