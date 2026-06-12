import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AppError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);

const createSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  licenseNumber: z.string().min(1),
  avatar: z.string().url().optional(),
});

const updateSchema = createSchema.partial();

router.get('/', async (req, res, next) => {
  try {
    const drivers = await prisma.driver.findMany({
      where: { orgId: req.user!.orgId },
      include: {
        vehicles: { select: { id: true, plate: true, status: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json(drivers);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const driver = await prisma.driver.findFirst({
      where: { id: req.params.id, orgId: req.user!.orgId },
      include: {
        vehicles: { select: { id: true, plate: true, status: true } },
        trips: { orderBy: { startTime: 'desc' }, take: 10 },
      },
    });
    if (!driver) throw new AppError(404, 'Driver not found');
    res.json(driver);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRole('admin', 'manager'), validate(createSchema), async (req, res, next) => {
  try {
    const driver = await prisma.driver.create({
      data: { ...req.body, orgId: req.user!.orgId },
    });
    res.status(201).json(driver);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireRole('admin', 'manager'), validate(updateSchema), async (req, res, next) => {
  try {
    const existing = await prisma.driver.findFirst({
      where: { id: req.params.id, orgId: req.user!.orgId },
    });
    if (!existing) throw new AppError(404, 'Driver not found');

    const driver = await prisma.driver.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(driver);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const existing = await prisma.driver.findFirst({
      where: { id: req.params.id, orgId: req.user!.orgId },
    });
    if (!existing) throw new AppError(404, 'Driver not found');

    // Unassign driver from vehicles before deleting
    await prisma.vehicle.updateMany({
      where: { driverId: req.params.id },
      data: { driverId: null },
    });

    await prisma.driver.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
