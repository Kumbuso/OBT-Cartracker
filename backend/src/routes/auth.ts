import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AppError } from '../middleware/errorHandler';
import { env } from '../config/env';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

const generateTokens = (userId: string, orgId: string, role: string, email: string) => {
  const accessToken = jwt.sign({ userId, orgId, role, email }, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES,
  } as jwt.SignOptions);
  const refreshToken = jwt.sign({ userId }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES,
  } as jwt.SignOptions);
  return { accessToken, refreshToken };
};

const refreshExpiry = () => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d;
};

router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body as { email: string; password: string };

    const user = await prisma.user.findUnique({
      where: { email },
      include: { org: { select: { id: true, name: true, plan: true, status: true } } },
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new AppError(401, 'Invalid credentials');
    }
    if (user.status !== 'active') throw new AppError(403, 'Account is not active');
    if (user.org.status === 'suspended') throw new AppError(403, 'Organization is suspended');

    const { accessToken, refreshToken } = generateTokens(user.id, user.orgId, user.role, user.email);

    await prisma.$transaction([
      prisma.refreshToken.create({
        data: { token: refreshToken, userId: user.id, expiresAt: refreshExpiry() },
      }),
      prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } }),
    ]);

    const { passwordHash: _, ...safeUser } = user;
    res.json({ accessToken, refreshToken, user: safeUser });
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', validate(refreshSchema), async (req, res, next) => {
  try {
    const { refreshToken } = req.body as { refreshToken: string };

    try {
      jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
    } catch {
      throw new AppError(401, 'Invalid or expired refresh token');
    }

    const stored = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new AppError(401, 'Invalid or expired refresh token');
    }

    const { user } = stored;
    const tokens = generateTokens(user.id, user.orgId, user.role, user.email);

    await prisma.$transaction([
      prisma.refreshToken.delete({ where: { id: stored.id } }),
      prisma.refreshToken.create({
        data: { token: tokens.refreshToken, userId: user.id, expiresAt: refreshExpiry() },
      }),
    ]);

    res.json(tokens);
  } catch (err) {
    next(err);
  }
});

router.post('/logout', authenticate, async (req, res, next) => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken, userId: req.user!.id } });
    } else {
      await prisma.refreshToken.deleteMany({ where: { userId: req.user!.id } });
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { org: { select: { id: true, name: true, plan: true, status: true } } },
    });
    if (!user) throw new AppError(404, 'User not found');
    const { passwordHash: _, ...safeUser } = user;
    res.json(safeUser);
  } catch (err) {
    next(err);
  }
});

export default router;
