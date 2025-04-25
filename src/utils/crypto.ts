// Encrypts sensitive data

import crypto from 'crypto';
import { AppError } from './error';
import { HTTP_STATUS } from './constants';

export const encrypt = (data: string): string => {
  try {
    const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (error) {
    throw new AppError('Encryption failed', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};

export const decrypt = (encryptedData: string): string => {
  try {
    const [ivHex, encrypted] = encryptedData.split(':');
    const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    throw new AppError('Decryption failed', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};