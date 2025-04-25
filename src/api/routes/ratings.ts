import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate, restrictTo, AuthenticatedRequest } from '../middleware/auth';
import { generalRateLimiter } from '../middleware/rateLimit';
import { HTTP_STATUS, EVENT_ACTIONS } from '../../utils/constants';
import { logEvent } from '../middleware/audit';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Validation schema
const ratingSchema = z.object({
  farmerId: z.number().int().positive(),
  productQuality: z.number().int().min(1).max(5),
  responseTime: z.number().int().min(1).max(5),
  communication: z.number().int().min(1).max(5),
  friendliness: z.number().int().min(1).max(5),
});

// Submit a rating
router.post(
  '/',
  generalRateLimiter,
  authenticate,
  restrictTo('BUYER'),
  validate(ratingSchema),
  async (req: AuthenticatedRequest, res) => {
    const raterId = req.user!.id;
    const { farmerId, productQuality, responseTime, communication, friendliness } = req.body;

    const rating = await prisma.rating.create({
      data: {
        raterId,
        farmerId,
        productQuality,
        responseTime,
        communication,
        friendliness,
      },
    });



// Update average rating
    const ratings = await prisma.rating.findMany({ where: { farmerId } });
    const avgRating =
      ratings.length > 0
        ? ratings.reduce(
            (sum, r) =>
              sum + (r.productQuality + r.responseTime + r.communication + r.friendliness) / 4,
            0
          ) / ratings.length
        : null;

    await prisma.user.update({
      where: { id: farmerId },
      data: { averageRating: avgRating ? parseFloat(avgRating.toFixed(2)) : null },
    });

    await logEvent(raterId, EVENT_ACTIONS.RATING_SUBMITTED, 'RATING', rating.id, { ip: req.ip });

    res.status(HTTP_STATUS.CREATED).json(rating);
  }
);


// Get farmer's ratings
router.get('/farmer/:farmerId', async (req, res) => {
  const farmerId = parseInt(req.params.farmerId, 10);
  const ratings = await prisma.rating.findMany({
    where: { farmerId },
    select: {
      productQuality: true,
      responseTime: true,
      communication: true,
      friendliness: true,
      createdAt: true,
    },
  });

  const farmer = await prisma.user.findUnique({
    where: { id: farmerId },
    select: { averageRating: true, firstName: true, lastName: true },
  });

  res.json({ farmer, ratings });
});

export default router;