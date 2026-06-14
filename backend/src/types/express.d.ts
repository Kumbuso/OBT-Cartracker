import { UserRole } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        orgId: string;
        role: UserRole;
        email: string;
      };
      /** Set by authenticateDevice middleware on /api/devices routes */
      device?: {
        id: string;
        orgId: string;
      };
    }
  }
}

export {};
