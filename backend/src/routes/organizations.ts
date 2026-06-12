import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AppError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  plan: z.enum(['basic', 'pro', 'enterprise']).optional(),
  maxVehicles: z.number().int().positive().optional(),
  maxUsers: z.number().int().positive().optional(),
});

const statusSchema = z.object({
  status: z.enum(['active', 'suspended', 'trial']),
});

// Users can only see their own org
router.get('/me', async (req, res, next) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.user!.orgId },
      include: {
        _count: { select: { vehicles: true, users: true } },
      },
    });
    if (!org) throw new AppError(404, 'Organization not found');
    res.json(org);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    // Users can only access their own org
    if (req.params.id !== req.user!.orgId) {
      throw new AppError(403, 'Access denied');
    }
    const org = await prisma.organization.findUnique({
      where: { id: req.params.id },
      include: {
        _count: { select: { vehicles: true, users: true, drivers: true } },
      },
    });
    if (!org) throw new AppError(404, 'Organization not found');
    res.json(org);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireRole('admin'), validate(updateSchema), async (req, res, next) => {
  try {
    if (req.params.id !== req.user!.orgId) throw new AppError(403, 'Access denied');

    const org = await prisma.organization.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(org);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/status', requireRole('admin'), validate(statusSchema), async (req, res, next) => {
  try {
    if (req.params.id !== req.user!.orgId) throw new AppError(403, 'Access denied');

    const org = await prisma.organization.update({
      where: { id: req.params.id },
      data: { status: req.body.status },
    });
    res.json(org);
  } catch (err) {
    next(err);
  }
});

export default router;
