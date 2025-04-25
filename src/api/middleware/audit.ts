import PrismaClient from '../../config/database';
// import { AuthenticatedRequest } from './auth';
import { EVENT_ACTIONS } from '../../utils/constants';
import { logger } from '../../config/logger';
import { Request, Response, NextFunction } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: { id: number; role: string };
}

export const logEvent = async (
  userId: number | null,
  action: keyof typeof EVENT_ACTIONS,
  entityType: string | null,
  entityId: number | null,
  details: any
) => {
  try {
    await prisma.event.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        details,
        createdAt: new Date(),
      },
    });
  } catch (error) {
    logger.error('Failed to log event:', error);
  }
};



export const auditMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const userId = req.user?.id || null;
  const action = `${req.method} ${req.path}` as keyof typeof EVENT_ACTIONS;
  const details = { ip: req.ip, userAgent: req.headers['user-agent'] };

  // Log event asynchronously without awaiting to avoid blocking
  logEvent(userId, action, null, null, details).catch((err) =>
    logger.error('Audit logging failed:', err)
  );

  next();
};