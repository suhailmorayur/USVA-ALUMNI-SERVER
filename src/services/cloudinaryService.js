const cloudinary = require('cloudinary').v2;
const dotenv = require('dotenv');
const { PassThrough } = require('stream');

dotenv.config({ override: true });

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Uploads a base64 image directly to Cloudinary
 * @param {String} base64Str - base64 data URL
 * @param {String} folder - Cloudinary folder name
 * @returns {Promise<Object>} upload result containing url and public_id
 */
const uploadImage = async (base64Str, folder = 'usva_members') => {
  try {
    const uploadResponse = await cloudinary.uploader.upload(base64Str, {
      folder: folder,
      resource_type: 'image',
      transformation: [
        { quality: 'auto:good' } // Optimize file size
      ]
    });
    return {
      url: uploadResponse.secure_url,
      publicId: uploadResponse.public_id
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error('Image upload failed: ' + error.message);
  }
};

/**
 * Uploads a buffer (like a PDF or QR code PNG) to Cloudinary via stream
 * @param {Buffer} buffer - File buffer
 * @param {String} folder - Cloudinary folder name
 * @param {String} filename - Optional public ID filename
 * @param {String} resourceType - raw, image, or auto
 * @returns {Promise<Object>} upload result
 */
const uploadBuffer = (buffer, folder = 'usva_members', filename = '', resourceType = 'auto') => {
  return new Promise((resolve, reject) => {
    const options = {
      folder: folder,
      resource_type: resourceType
    };
    if (filename) {
      options.public_id = filename;
    }

    const writeStream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) {
        console.error('Cloudinary buffer stream upload error:', error);
        return reject(new Error('Cloudinary stream upload failed: ' + error.message));
      }
      resolve({
        url: result.secure_url,
        publicId: result.public_id
      });
    });

    const readStream = new PassThrough();
    readStream.end(buffer);
    readStream.pipe(writeStream);
  });
};

/**
 * Deletes an image from Cloudinary by its public ID
 * @param {String} publicId - Cloudinary image public_id
 * @param {String} resourceType - image, raw, video
 */
const deleteImage = async (publicId, resourceType = 'image') => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (error) {
    console.error('Cloudinary deletion error:', error);
  }
};

module.exports = {
  uploadImage,
  uploadBuffer,
  deleteImage
};
