// Image upload and processing

import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const validateCloudinaryUrl = (url: string): boolean => {
  return url.startsWith('https://res.cloudinary.com/') && url.includes('/image/upload/');
};

export const uploadImage = async (file: Buffer, folder: string): Promise<string> => {
  const result = await cloudinary.uploader.upload(`data:image/jpeg;base64,${file.toString('base64')}`, {
    folder,
  });
  return result.secure_url;
};