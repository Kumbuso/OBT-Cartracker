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
  severity: z.enum(['minor', 'moderate', 'severe', 'fatal']),
  description: z.string().min(1),
  location: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  injuries: z.boolean().default(false),
  thirdPartyInvolved: z.boolean().default(false),
  thirdPartyInfo: z.string().optional(),
  policeReport: z.string().optional(),
  estimatedDamage: z.number().min(0).optional(),
  occurredAt: z.string().datetime(),
});

const updateSchema = z.object({
  severity: z.enum(['minor', 'moderate', 'severe', 'fatal']).optional(),
  status: z.enum(['reported', 'under_investigation', 'resolved', 'closed']).optional(),
  description: z.string().optional(),
  thirdPartyInfo: z.string().optional(),
  policeReport: z.string().optional(),
  estimatedDamage: z.number().min(0).optional(),
  injuries: z.boolean().optional(),
});

router.get('/', async (req, res, next) => {
  try {
    const { vehicleId, severity, status, from, to, limit = '50' } = req.query;
    const reports = await prisma.accidentReport.findMany({
      where: {
        orgId: req.user!.orgId,
        ...(vehicleId ? { vehicleId: vehicleId as string } : {}),
        ...(severity ? { severity: severity as any } : {}),
        ...(status ? { status: status as any } : {}),
        ...(from || to
          ? {
              occurredAt: {
                ...(from ? { gte: new Date(from as string) } : {}),
                ...(to ? { lte: new Date(to as string) } : {}),
              },
            }
          : {}),
      },
      include: { vehicle: { select: { id: true, plate: true } } },
      orderBy: { occurredAt: 'desc' },
      take: Math.min(parseInt(limit as string, 10), 200),
    });
    res.json(reports);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const report = await prisma.accidentReport.findFirst({
      where: { id: req.params.id, orgId: req.user!.orgId },
      include: { vehicle: { select: { id: true, plate: true, make: true, model: true } } },
    });
    if (!report) throw new AppError(404, 'Accident report not found');
    res.json(report);
  } catch (err) {
    next(err);
  }
});

router.post('/', validate(createSchema), async (req, res, next) => {
  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: req.body.vehicleId, orgId: req.user!.orgId },
    });
    if (!vehicle) throw new AppError(404, 'Vehicle not found');

    const report = await prisma.accidentReport.create({
      data: {
        ...req.body,
        occurredAt: new Date(req.body.occurredAt),
        reportedBy: req.user!.id,
        orgId: req.user!.orgId,
      },
      include: { vehicle: { select: { id: true, plate: true } } },
    });
    res.status(201).json(report);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireRole('admin', 'manager'), validate(updateSchema), async (req, res, next) => {
  try {
    const existing = await prisma.accidentReport.findFirst({
      where: { id: req.params.id, orgId: req.user!.orgId },
    });
    if (!existing) throw new AppError(404, 'Accident report not found');

    const report = await prisma.accidentReport.update({
      where: { id: req.params.id },
      data: req.body,
      include: { vehicle: { select: { id: true, plate: true } } },
    });
    res.json(report);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const existing = await prisma.accidentReport.findFirst({
      where: { id: req.params.id, orgId: req.user!.orgId },
    });
    if (!existing) throw new AppError(404, 'Accident report not found');
    await prisma.accidentReport.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
