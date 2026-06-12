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
  type: z.enum([
    'speeding',
    'geofence_exit',
    'geofence_enter',
    'maintenance_due',
    'low_fuel',
    'engine_off',
    'harsh_braking',
    'idle_timeout',
  ]),
  severity: z.enum(['critical', 'warning', 'info']),
  message: z.string().min(1),
});

router.get('/', async (req, res, next) => {
  try {
    const { severity, type, read, vehicleId, limit = '100' } = req.query;
    const alerts = await prisma.alert.findMany({
      where: {
        orgId: req.user!.orgId,
        ...(severity ? { severity: severity as any } : {}),
        ...(type ? { type: type as any } : {}),
        ...(read !== undefined ? { read: read === 'true' } : {}),
        ...(vehicleId ? { vehicleId: vehicleId as string } : {}),
      },
      include: { vehicle: { select: { id: true, plate: true } } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(parseInt(limit as string, 10), 500),
    });
    res.json(alerts);
  } catch (err) {
    next(err);
  }
});

router.get('/unread-count', async (req, res, next) => {
  try {
    const count = await prisma.alert.count({
      where: { orgId: req.user!.orgId, read: false },
    });
    res.json({ count });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRole('admin', 'manager'), validate(createSchema), async (req, res, next) => {
  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: req.body.vehicleId, orgId: req.user!.orgId },
    });
    if (!vehicle) throw new AppError(404, 'Vehicle not found');

    const alert = await prisma.alert.create({
      data: { ...req.body, orgId: req.user!.orgId },
      include: { vehicle: { select: { id: true, plate: true } } },
    });

    emitToOrg(req.user!.orgId, 'alert:new', alert);
    res.status(201).json(alert);
  } catch (err) {
    next(err);
  }
});

router.put('/:id/read', async (req, res, next) => {
  try {
    const existing = await prisma.alert.findFirst({
      where: { id: req.params.id, orgId: req.user!.orgId },
    });
    if (!existing) throw new AppError(404, 'Alert not found');

    const alert = await prisma.alert.update({
      where: { id: req.params.id },
      data: { read: true },
    });
    res.json(alert);
  } catch (err) {
    next(err);
  }
});

router.put('/mark-all-read', async (req, res, next) => {
  try {
    const { count } = await prisma.alert.updateMany({
      where: { orgId: req.user!.orgId, read: false },
      data: { read: true },
    });
    res.json({ updated: count });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    const existing = await prisma.alert.findFirst({
      where: { id: req.params.id, orgId: req.user!.orgId },
    });
    if (!existing) throw new AppError(404, 'Alert not found');
    await prisma.alert.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
