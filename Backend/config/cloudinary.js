const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "ddxl5rbsq",
  api_key: process.env.CLOUDINARY_API_KEY || "836744593982542",
  api_secret: process.env.CLOUDINARY_API_SECRET || "SIpPXEurF3Gn4dL3tCUMlUbJz9Q",
});

module.exports = cloudinary;
