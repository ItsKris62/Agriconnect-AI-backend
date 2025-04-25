import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { sendEmail } from '../services/emailService';
import { logEvent } from '../api/middleware/audit';
import { encrypt } from '../utils/crypto';
import { AppError } from '../utils/error';
import { HTTP_STATUS } from '../utils/constants';

const prisma = new PrismaClient();

export const login = async (email: string, password: string, ip: string) => {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new AppError('Invalid email or password', HTTP_STATUS.UNAUTHORIZED);
  }

  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET!, {
    expiresIn: '1d',
  });

  await logEvent(user.id, 'USER_LOGIN', 'USER', user.id, { ip });

  return {
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
  };
};

export const signup = async (
  data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
    role: 'FARMER' | 'BUYER' | 'ADMIN';
    country: 'KENYA' | 'UGANDA' | 'TANZANIA';
    county?: string;
    subCounty?: string;
    latitude?: number;
    longitude?: number;
    idNumber?: string;
    avatarUrl?: string;
  },
  ip: string
) => {
  const existingUser = await prisma.user.findUnique({ where: { email: data.email } });

  if (existingUser) {
    throw new AppError('Email already exists', HTTP_STATUS.CONFLICT);
  }

  const hashedPassword = await bcrypt.hash(data.password, 10);
  const encryptedIdNumber = data.idNumber ? encrypt(data.idNumber) : undefined;

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
      idNumber: encryptedIdNumber,
      avatarUrl: data.avatarUrl,
      verificationStatus: data.idNumber ? 'VERIFIED' : 'NOT_VERIFIED',
    },
  });

  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET!, {
    expiresIn: '1d',
  });

  await logEvent(user.id, 'USER_REGISTERED', 'USER', user.id, { ip });

  return {
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
  };
};

export const requestPasswordReset = async (email: string, ip: string) => {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 3600000); // 1 hour expiry

  await prisma.passwordResetToken.create({
    data: {
      token,
      userId: user.id,
      expiresAt,
    },
  });

  const resetLink = `http://localhost:3000/reset-password?token=${token}`;
  await sendEmail(user.email, 'Password Reset', `Click here to reset your password: ${resetLink}`);

  await logEvent(user.id, 'PASSWORD_RESET_REQUESTED', 'USER', user.id, { ip });

  return { message: 'Password reset email sent' };
};

export const resetPassword = async (token: string, newPassword: string, ip: string) => {
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!resetToken || resetToken.expiresAt < new Date()) {
    throw new AppError('Invalid or expired token', HTTP_STATUS.BAD_REQUEST);
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: resetToken.userId },
    data: { password: hashedPassword },
  });

  await prisma.passwordResetToken.delete({ where: { token } });

  await logEvent(resetToken.userId, 'PASSWORD_RESET', 'USER', resetToken.userId, { ip });

  return { message: 'Password reset successfully' };
};