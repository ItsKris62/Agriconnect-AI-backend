import rateLimit from 'express-rate-limit';
import { HTTP_STATUS } from '../../utils/constants';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: { message: 'Too many requests, please try again later' },
  statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
});

export const feedbackRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per window
  message: { message: 'Too many feedback submissions, please try again later' },
  statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
});

export const generalRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // 100 requests per window
  message: { message: 'Too many requests, please try again later' },
  statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
});