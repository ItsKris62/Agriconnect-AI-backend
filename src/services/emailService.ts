import nodemailer from 'nodemailer';

import { logger } from '../config/logger';
import { AppError } from '../utils/error';
import { HTTP_STATUS } from '../utils/constants';

const transporter = nodemailer.createTransport({
  service: 'gmail', // Replace with SendGrid for production
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendEmail = async (to: string, subject: string, text: string) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      text,
    });
  } catch (error) {
    logger.error('Failed to send email:', error);
    throw new AppError('Email sending failed', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};