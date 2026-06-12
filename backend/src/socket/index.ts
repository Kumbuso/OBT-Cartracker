import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { JwtPayload } from '../middleware/auth';

let io: SocketServer;

export const setupSocket = (httpServer: HttpServer): SocketServer => {
  io = new SocketServer(httpServer, {
    cors: { origin: env.CORS_ORIGIN, methods: ['GET', 'POST'] },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('Authentication required'));

    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
      socket.data.userId = payload.userId;
      socket.data.orgId = payload.orgId;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const orgId = socket.data.orgId as string;
    socket.join(`org:${orgId}`);

    socket.on('disconnect', () => {});
  });

  return io;
};

export const emitToOrg = (orgId: string, event: string, data: unknown): void => {
  io?.to(`org:${orgId}`).emit(event, data);
};
