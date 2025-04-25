import { PrismaClient } from '@prisma/client';
import redis from 'redis';

import { validateCloudinaryUrl } from '../services/cloudinaryService';
import { encrypt } from '../utils/crypto';
import { AppError } from '../utils/error';
import { HTTP_STATUS } from '../utils/constants';
import { logEvent } from '../api/middleware/audit';

const prisma = new PrismaClient();
const redisClient = redis.createClient({ url: process.env.REDIS_URL });
redisClient.connect().catch(console.error);

export const getProfile = async (userId: number) => {
  const cacheKey = `user:${userId}`;
  const cachedProfile = await redisClient.get(cacheKey);

  if (cachedProfile) {
    return JSON.parse(cachedProfile);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phoneNumber: true,
      role: true,
      country: true,
      county: true,
      subCounty: true,
      latitude: true,
      longitude: true,
      verificationStatus: true,
      avatarUrl: true,
      averageRating: true,
    },
  });

  if (!user) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  }

  await redisClient.setEx(cacheKey, 3600, JSON.stringify(user)); // Cache for 1 hour
  return user;
};

export const updateProfile = async (
  userId: number,
  data: {
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    country?: 'KENYA' | 'UGANDA' | 'TANZANIA';
    county?: string;
    subCounty?: string;
    latitude?: number;
    longitude?: number;
    idNumber?: string;
    avatarUrl?: string;
  },
  ip: string
) => {
  if (data.avatarUrl && !validateCloudinaryUrl(data.avatarUrl)) {
    throw new AppError('Invalid Cloudinary URL', HTTP_STATUS.BAD_REQUEST);
  }

  const encryptedIdNumber = data.idNumber ? encrypt(data.idNumber) : undefined;

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      phoneNumber: data.phoneNumber,
      country: data.country,
      county: data.county,
      subCounty: data.subCounty,
      latitude: data.latitude,
      longitude: data.longitude,
      idNumber: encryptedIdNumber,
      avatarUrl: data.avatarUrl,
      verificationStatus: data.idNumber ? 'VERIFIED' : undefined,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phoneNumber: true,
      role: true,
      country: true,
      county: true,
      subCounty: true,
      latitude: true,
      longitude: true,
      verificationStatus: true,
      avatarUrl: true,
      averageRating: true,
    },
  });

  const cacheKey = `user:${userId}`;
  await redisClient.setEx(cacheKey, 3600, JSON.stringify(user)); // Update cache

  await logEvent(userId, 'PROFILE_UPDATED', 'USER', user.id, { ip });

  return user;
};