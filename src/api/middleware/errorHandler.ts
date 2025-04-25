import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/error';
import { logger } from '../../config/logger';
import { HTTP_STATUS } from '../../utils/constants';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (err instanceof AppError) {
    logger.error(`${err.message}: ${JSON.stringify(err.details)}`);
    res.status(err.statusCode).json({
      message: err.message,
      details: err.details,
    });
    return;
  }

  logger.error('Unexpected error:', err);
  res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
    message: 'Internal server error',
  });
};