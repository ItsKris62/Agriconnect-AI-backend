// API response formatting

import { Response } from 'express';

export const sendResponse = (res: Response, statusCode: number, data: any) => {
  res.status(statusCode).json(data);
};

export const sendError = (res: Response, statusCode: number, message: string, details?: any) => {
  res.status(statusCode).json({ message, details });
};