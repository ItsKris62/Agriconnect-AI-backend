import { Router, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { validate } from '../middleware/validate';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { generalRateLimiter } from '../middleware/rateLimit';
import { logEvent } from '../middleware/audit';
import { HTTP_STATUS, COUNTRIES, EVENT_ACTIONS } from '../../utils/constants';

const router = Router();
const prisma = new PrismaClient();

// Validation schema for profile update
const updateProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phoneNumber: z.string().optional(),
  country: z.enum([COUNTRIES.KENYA, COUNTRIES.UGANDA, COUNTRIES.TANZANIA]).optional(),
  county: z.string().optional(),
  subCounty: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  idNumber: z.string().optional(),
  avatarUrl: z.string().url().optional(),
});

// Get user profile
router.get('/profile', authenticate, generalRateLimiter, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // req.user is guaranteed to exist because of the 'authenticate' middleware
  const userId = req.user!.id;
  
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
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
      createdAt: true, // Might be useful to return creation date
      updatedAt: true, // Might be useful to return last update date
    },
  });

  if (!user) {
    // This case should theoretically not happen if the token is valid
    // but good to handle defensively.
    res.status(HTTP_STATUS.NOT_FOUND).json({ message: 'User not found' });
    return;
  }

  res.json(user);
});

// Update user profile
router.patch('/profile', authenticate, generalRateLimiter, validate(updateProfileSchema), async (req: AuthenticatedRequest, res: Response) => {
  const data = req.body;
  const userId = req.user!.id;

  const allowedUpdates = {
    firstName: data.firstName,
      lastName: data.lastName,
      phoneNumber: data.phoneNumber,
      country: data.country,
      county: data.county,
      subCounty: data.subCounty,
      latitude: data.latitude,
      longitude: data.longitude,
      // idNumber: data.idNumber, // Handle ID number update carefully - might trigger re-verification?
      avatarUrl: data.avatarUrl,
  };
    

  // Filter out undefined values so Prisma doesn't try to set fields to null
  const updateData = Object.fromEntries(
      Object.entries(allowedUpdates).filter(([_, v]) => v !== undefined)
  );

  // Add logic for idNumber if it's intended to be updatable and affects verification
  if (data.idNumber !== undefined) {
      updateData.idNumber = data.idNumber;
      // Optionally, reset verification status if ID number changes?
      // updateData.verificationStatus = 'PENDING'; // Or 'NOT_VERIFIED'
  }


  if (Object.keys(updateData).length === 0) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "No valid fields provided for update." });
      return;
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { // Select the same fields as the GET profile endpoint for consistency
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
        createdAt: true,
        updatedAt: true,
      },
    });

    await logEvent(userId, EVENT_ACTIONS.PROFILE_UPDATED, 'USER', updatedUser.id, { ip: req.ip, updatedFields: Object.keys(updateData) });

    res.json(updatedUser);
  } catch (error) {
      console.error("Failed to update profile:", error);
      // Log the error appropriately
      await logEvent(userId, EVENT_ACTIONS.PROFILE_UPDATED, 'USER', userId, { ip: req.ip, error: 'Update failed' });
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: "Failed to update profile." });
  }
});

export default router;