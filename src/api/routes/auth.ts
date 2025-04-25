import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authRateLimiter } from '../middleware/rateLimit';
import { AuthenticatedRequest } from '../middleware/auth'; // Import AuthenticatedRequest from auth.ts
import { logEvent } from '../middleware/audit';
import { HTTP_STATUS, USER_ROLES, COUNTRIES, EVENT_ACTIONS } from '../../utils/constants';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { sendEmail } from '../../services/emailService';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Validation schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phoneNumber: z.string().optional(),
  role: z.enum([USER_ROLES.FARMER, USER_ROLES.BUYER, USER_ROLES.ADMIN]).default(USER_ROLES.FARMER),
  country: z.enum([COUNTRIES.KENYA, COUNTRIES.UGANDA, COUNTRIES.TANZANIA]),
  county: z.string().optional(),
  subCounty: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  idNumber: z.string().optional(),
  avatarUrl: z.string().url().optional(),
});

const requestResetSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(6),
});

// Login
router.post('/login', authRateLimiter, validate(loginSchema), async (req: AuthenticatedRequest, res: Response) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({ message: 'Invalid email or password' });
  }

  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET!, {
    expiresIn: '1d',
  });

  await logEvent(user.id, EVENT_ACTIONS.USER_LOGIN, 'USER', user.id, { ip: req.ip });

  res.json({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      role: user.role,
      country: user.country,
      county: user.county,
      subCounty: user.subCounty,
      latitude: user.latitude,
      longitude: user.longitude,
      verificationStatus: user.verificationStatus,
      avatarUrl: user.avatarUrl,
      averageRating: user.averageRating,
    },
    token,
  });
});

// Signup
router.post('/signup', authRateLimiter, validate(signupSchema), async (req: AuthenticatedRequest, res: Response) => {
  const data = req.body;
  const existingUser = await prisma.user.findUnique({ where: { email: data.email } });

  if (existingUser) {
    return res.status(HTTP_STATUS.CONFLICT).json({ message: 'Email already exists' });
  }

  const hashedPassword = await bcrypt.hash(data.password, 10);

  const user = await prisma.user.create({
    data: {
      email: data.email,
      password: hashedPassword,
      firstName: data.firstName,
      lastName: data.lastName,
      phoneNumber: data.phoneNumber,
      role: data.role,
      country: data.country,
      county: data.county,
      subCounty: data.subCounty,
      latitude: data.latitude,
      longitude: data.longitude,
      avatarUrl: data.avatarUrl,
      verificationStatus: data.idNumber ? 'VERIFIED' : 'NOT_VERIFIED',
    },
  });

  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET!, {
    expiresIn: '1d',
  });

  await logEvent(user.id, EVENT_ACTIONS.USER_REGISTERED, 'USER', user.id, { ip: req.ip });

  res.status(HTTP_STATUS.CREATED).json({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      role: user.role,
      country: user.country,
      county: user.county,
      subCounty: user.subCounty,
      latitude: user.latitude,
      longitude: user.longitude,
      verificationStatus: user.verificationStatus,
      avatarUrl: user.avatarUrl,
      averageRating: user.averageRating,
    },
    token,
  });
});

// Request Password Reset
router.post('/request-password-reset', authRateLimiter, validate(requestResetSchema), async (req: AuthenticatedRequest, res: Response) => {
  const { email } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    // It's often better practice not to reveal if an email exists for security reasons
    // You might just return a success message regardless.
    // return res.status(HTTP_STATUS.NOT_FOUND).json({ message: 'User not found' });
    // Consider just sending the success message even if user not found:
    return res.json({ message: 'If an account with that email exists, a password reset email has been sent.' });
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 3600000); // 1 hour expiry

  // Delete any existing tokens for this user
  await prisma.passwordResetToken.create({
    data: {
      token,
      userId: user.id,
      expiresAt,
    },
  });

  // Make the base URL configurable (e.g., via environment variables)
  const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
  try {
      await sendEmail(user.email, 'Password Reset Request', `Click this link to reset your password: ${resetLink}. This link is valid for 1 hour.`);
      await logEvent(user.id, EVENT_ACTIONS.PASSWORD_RESET_REQUESTED, 'USER', user.id, { ip: req.ip });
      res.json({ message: 'Password reset email sent successfully.' });
  } catch (emailError) {
      console.error("Failed to send password reset email:", emailError);
      // Log the error but still inform the user something happened
      // Potentially delete the token if email fails? Or let it expire? Depends on desired UX.
      await logEvent(user.id, EVENT_ACTIONS.PASSWORD_RESET_REQUESTED, 'USER', user.id, { ip: req.ip, error: 'Email send failed' });
      // Don't expose internal errors to the client
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: 'Failed to send password reset email. Please try again later.' });
  }
});

// Reset Password
router.post('/reset-password', authRateLimiter, validate(resetPasswordSchema), async (req: AuthenticatedRequest, res: Response) => {
  const { token, newPassword } = req.body;
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!resetToken || resetToken.expiresAt < new Date()) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: 'Invalid or expired token' });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

   // Use a transaction to ensure both operations succeed or fail together
  try {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword },
      }),
      prisma.passwordResetToken.delete({ where: { token } })
    ]);

    await logEvent(resetToken.userId, EVENT_ACTIONS.PASSWORD_RESET, 'USER', resetToken.userId, { ip: req.ip });
    res.json({ message: 'Password has been reset successfully.' });

  } catch (error) {
      console.error("Failed to reset password:", error);
      // Log the specific error internally
      await logEvent(resetToken.userId, EVENT_ACTIONS.PASSWORD_RESET, 'USER', resetToken.userId, { ip: req.ip, error: 'Transaction failed' });
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: 'Failed to reset password. Please try again.' });
  }
});

export default router;