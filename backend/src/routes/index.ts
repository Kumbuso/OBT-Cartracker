import { Router } from 'express';
import authRouter from './auth';
import vehicleRouter from './vehicles';
import driverRouter from './drivers';
import tripRouter from './trips';
import alertRouter from './alerts';
import geofenceRouter from './geofences';
import fuelRouter from './fuel';
import accidentRouter from './accidents';
import organizationRouter from './organizations';
import userRouter from './users';
import reportRouter from './reports';
import deviceRouter from './devices';

export const authRoutes = authRouter;

const api = Router();
api.use('/vehicles', vehicleRouter);
api.use('/drivers', driverRouter);
api.use('/trips', tripRouter);
api.use('/alerts', alertRouter);
api.use('/geofences', geofenceRouter);
api.use('/fuel', fuelRouter);
api.use('/accidents', accidentRouter);
api.use('/organizations', organizationRouter);
api.use('/users', userRouter);
api.use('/reports', reportRouter);
api.use('/devices', deviceRouter);

export const apiRoutes = api;
