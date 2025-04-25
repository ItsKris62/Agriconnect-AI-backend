import { PrismaClient } from '@prisma/client';

import { AppError } from '../utils/error';
import { HTTP_STATUS } from '../utils/constants';

const prisma = new PrismaClient();

export const createRating = async (
  raterId: number,
  farmerId: number,
  productQuality: number,
  responseTime: number,
  communication: number,
  friendliness: number
) => {
  if ([productQuality, responseTime, communication, friendliness].some(score => score < 1 || score > 5)) {
    throw new AppError('Scores must be between 1 and 5', HTTP_STATUS.BAD_REQUEST);
  }

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

  await updateAverageRating(farmerId);

  return rating;
};

export const updateAverageRating = async (farmerId: number) => {
  const ratings = await prisma.rating.findMany({
    where: { farmerId },
  });

  if (ratings.length === 0) {
    await prisma.user.update({
      where: { id: farmerId },
      data: { averageRating: null },
    });
    return;
  }

  const avgRating =
    ratings.reduce(
      (sum, r) => sum + (r.productQuality + r.responseTime + r.communication + r.friendliness) / 4,
      0
    ) / ratings.length;

  await prisma.user.update({
    where: { id: farmerId },
    data: { averageRating: parseFloat(avgRating.toFixed(2)) },
  });
};