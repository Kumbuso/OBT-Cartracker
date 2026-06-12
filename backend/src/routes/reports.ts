import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const startOfDay = (d = new Date()) => {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
};

router.get('/fleet-stats', async (req, res, next) => {
  try {
    const orgId = req.user!.orgId;
    const today = startOfDay();

    const [total, active, idle, offline, maintenance, tripsToday, alertsUnread] =
      await prisma.$transaction([
        prisma.vehicle.count({ where: { orgId } }),
        prisma.vehicle.count({ where: { orgId, status: 'active' } }),
        prisma.vehicle.count({ where: { orgId, status: 'idle' } }),
        prisma.vehicle.count({ where: { orgId, status: 'offline' } }),
        prisma.vehicle.count({ where: { orgId, status: 'maintenance' } }),
        prisma.trip.count({ where: { orgId, startTime: { gte: today } } }),
        prisma.alert.count({ where: { orgId, read: false } }),
      ]);

    const distanceAgg = await prisma.trip.aggregate({
      where: { orgId, startTime: { gte: today } },
      _sum: { distance: true },
    });

    res.json({
      total,
      active,
      idle,
      offline,
      maintenance,
      tripsToday,
      distanceToday: distanceAgg._sum.distance ?? 0,
      unreadAlerts: alertsUnread,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/trips-summary', async (req, res, next) => {
  try {
    const orgId = req.user!.orgId;
    const { from, to } = req.query;

    const where = {
      orgId,
      ...(from || to
        ? {
            startTime: {
              ...(from ? { gte: new Date(from as string) } : {}),
              ...(to ? { lte: new Date(to as string) } : {}),
            },
          }
        : {}),
    };

    const [count, agg] = await prisma.$transaction([
      prisma.trip.count({ where }),
      prisma.trip.aggregate({
        where,
        _sum: { distance: true, fuelConsumed: true, duration: true },
        _avg: { avgSpeed: true, maxSpeed: true },
      }),
    ]);

    res.json({
      count,
      totalDistance: agg._sum.distance ?? 0,
      totalFuelConsumed: agg._sum.fuelConsumed ?? 0,
      totalDuration: agg._sum.duration ?? 0,
      avgSpeed: agg._avg.avgSpeed ?? 0,
      avgMaxSpeed: agg._avg.maxSpeed ?? 0,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/fuel-summary', async (req, res, next) => {
  try {
    const orgId = req.user!.orgId;
    const { from, to } = req.query;

    const dateFilter =
      from || to
        ? {
            timestamp: {
              ...(from ? { gte: new Date(from as string) } : {}),
              ...(to ? { lte: new Date(to as string) } : {}),
            },
          }
        : {};

    const [refuels, consumption] = await prisma.$transaction([
      prisma.fuelEvent.aggregate({
        where: { orgId, type: 'refuel', ...dateFilter },
        _sum: { liters: true, totalCost: true },
        _count: true,
      }),
      prisma.fuelEvent.aggregate({
        where: { orgId, type: 'consumption', ...dateFilter },
        _sum: { liters: true },
      }),
    ]);

    res.json({
      totalRefuels: refuels._count,
      totalLitersRefueled: refuels._sum.liters ?? 0,
      totalFuelCost: refuels._sum.totalCost ?? 0,
      totalLitersConsumed: consumption._sum.liters ?? 0,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/driver-performance', async (req, res, next) => {
  try {
    const orgId = req.user!.orgId;
    const { from, to } = req.query;

    const dateFilter =
      from || to
        ? {
            startTime: {
              ...(from ? { gte: new Date(from as string) } : {}),
              ...(to ? { lte: new Date(to as string) } : {}),
            },
          }
        : {};

    const drivers = await prisma.driver.findMany({
      where: { orgId },
      include: {
        trips: {
          where: { ...dateFilter, status: 'completed' },
          select: { distance: true, duration: true, fuelConsumed: true, maxSpeed: true, avgSpeed: true },
        },
      },
    });

    const performance = drivers.map((d) => {
      const trips = d.trips;
      const totalTrips = trips.length;
      const totalDistance = trips.reduce((s, t) => s + t.distance, 0);
      const totalFuel = trips.reduce((s, t) => s + t.fuelConsumed, 0);
      const avgSpeed = totalTrips > 0 ? trips.reduce((s, t) => s + t.avgSpeed, 0) / totalTrips : 0;
      const maxSpeed = trips.reduce((m, t) => Math.max(m, t.maxSpeed), 0);

      return {
        id: d.id,
        name: d.name,
        phone: d.phone,
        totalTrips,
        totalDistance: Math.round(totalDistance * 10) / 10,
        totalFuelConsumed: Math.round(totalFuel * 10) / 10,
        avgSpeed: Math.round(avgSpeed),
        maxSpeed: Math.round(maxSpeed),
      };
    });

    res.json(performance);
  } catch (err) {
    next(err);
  }
});

router.get('/alerts-summary', async (req, res, next) => {
  try {
    const orgId = req.user!.orgId;
    const { from, to } = req.query;

    const dateFilter =
      from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from as string) } : {}),
              ...(to ? { lte: new Date(to as string) } : {}),
            },
          }
        : {};

    const [total, critical, warning, info, unread] = await prisma.$transaction([
      prisma.alert.count({ where: { orgId, ...dateFilter } }),
      prisma.alert.count({ where: { orgId, severity: 'critical', ...dateFilter } }),
      prisma.alert.count({ where: { orgId, severity: 'warning', ...dateFilter } }),
      prisma.alert.count({ where: { orgId, severity: 'info', ...dateFilter } }),
      prisma.alert.count({ where: { orgId, read: false } }),
    ]);

    res.json({ total, critical, warning, info, unread });
  } catch (err) {
    next(err);
  }
});

export default router;
