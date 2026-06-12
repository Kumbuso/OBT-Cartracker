import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AppError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['admin', 'manager', 'viewer']).default('viewer'),
  phone: z.string().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  role: z.enum(['admin', 'manager', 'viewer']).optional(),
});

const statusSchema = z.object({
  status: z.enum(['active', 'suspended', 'pending']),
});

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8),
});

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  phone: true,
  avatar: true,
  orgId: true,
  lastLogin: true,
  createdAt: true,
  updatedAt: true,
};

router.get('/', requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    const { role, status } = req.query;
    const users = await prisma.user.findMany({
      where: {
        orgId: req.user!.orgId,
        ...(role ? { role: role as any } : {}),
        ...(status ? { status: status as any } : {}),
      },
      select: userSelect,
      orderBy: { name: 'asc' },
    });
    res.json(users);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    // Users can only view themselves unless admin/manager
    if (req.params.id !== req.user!.id && !['admin', 'manager'].includes(req.user!.role)) {
      throw new AppError(403, 'Access denied');
    }

    const user = await prisma.user.findFirst({
      where: { id: req.params.id, orgId: req.user!.orgId },
      select: userSelect,
    });
    if (!user) throw new AppError(404, 'User not found');
    res.json(user);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRole('admin'), validate(createSchema), async (req, res, next) => {
  try {
    const { password, ...rest } = req.body as { password: string; name: string; email: string; role: string; phone?: string };
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { ...rest, role: rest.role as UserRole, passwordHash, status: 'active', orgId: req.user!.orgId },
      select: userSelect,
    });
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireRole('admin'), validate(updateSchema), async (req, res, next) => {
  try {
    const existing = await prisma.user.findFirst({
      where: { id: req.params.id, orgId: req.user!.orgId },
    });
    if (!existing) throw new AppError(404, 'User not found');

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: req.body,
      select: userSelect,
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/status', requireRole('admin'), validate(statusSchema), async (req, res, next) => {
  try {
    const existing = await prisma.user.findFirst({
      where: { id: req.params.id, orgId: req.user!.orgId },
    });
    if (!existing) throw new AppError(404, 'User not found');
    if (req.params.id === req.user!.id) throw new AppError(400, 'Cannot change your own status');

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { status: req.body.status },
      select: userSelect,
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

router.post('/me/change-password', validate(changePasswordSchema), async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw new AppError(404, 'User not found');

    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new AppError(401, 'Current password is incorrect');
    }

    await prisma.user.update({
      where: { id: req.user!.id },
      data: { passwordHash: await bcrypt.hash(newPassword, 10) },
    });
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    if (req.params.id === req.user!.id) throw new AppError(400, 'Cannot delete your own account');

    const existing = await prisma.user.findFirst({
      where: { id: req.params.id, orgId: req.user!.orgId },
    });
    if (!existing) throw new AppError(404, 'User not found');

    await prisma.user.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
