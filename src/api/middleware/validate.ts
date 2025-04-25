import { Request, Response, NextFunction } from 'express';
import { z, AnyZodObject } from 'zod';
import { AppError } from '../../utils/error';
import { HTTP_STATUS } from '../../utils/constants';

export const validate = (schema: AnyZodObject) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AppError('Validation failed', HTTP_STATUS.BAD_REQUEST, error.errors);
      }
      throw new AppError('Invalid request data', HTTP_STATUS.BAD_REQUEST);
    }
  };
};