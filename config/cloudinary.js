// utils/cloudinary.js
import { v2 as cloudinary } from 'cloudinary';
import sharp from 'sharp';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Single function to optimize and upload images
export const uploadToCloudinary = async (buffer, options = {}) => {
  try {
    // Get original file size
    const originalSize = buffer.length;
    console.log(`Original file size: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);

    // Optimize image with Sharp
    const optimizedBuffer = await sharp(buffer)
      .resize(800, 600, { 
        fit: 'inside', 
        withoutEnlargement: true 
      })
      .jpeg({ 
        quality: 85, 
        progressive: true,
        mozjpeg: true // Use mozjpeg encoder for better compression
      })
      .toBuffer();

    // Get optimized file size
    const optimizedSize = optimizedBuffer.length;
    const reduction = ((originalSize - optimizedSize) / originalSize * 100).toFixed(2);
    console.log(`Optimized file size: ${(optimizedSize / 1024).toFixed(2)} KB`);
    console.log(`Size reduction: ${reduction}%`);

    // Upload to Cloudinary
    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: 'property-uploads',
          resource_type: 'image',
          format: 'jpg',
          quality: 'auto:good',
          flags: 'immutable_cache',
          ...options
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            console.log(`Final Cloudinary size: ${(result.bytes / 1024).toFixed(2)} KB`);
            resolve(result);
          }
        }
      ).end(optimizedBuffer);
    });

  } catch (error) {
    throw new Error(`Image optimization and upload failed: ${error.message}`);
  }
};

export { cloudinary };