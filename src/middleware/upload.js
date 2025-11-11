const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../../uploads');
const idCardsDir = path.join(uploadsDir, 'id-cards');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

if (!fs.existsSync(idCardsDir)) {
  fs.mkdirSync(idCardsDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, idCardsDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename: timestamp-randomstring-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    cb(null, `${nameWithoutExt}-${uniqueSuffix}${ext}`);
  }
});

// File filter to accept only images
const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  }
});

// Middleware for ID card uploads (front required, back optional)
const uploadIdCards = upload.fields([
  { name: 'idCardFront', maxCount: 1 },    // Required
  { name: 'idCardBack', maxCount: 1 }      // Optional - for records only
]);

// Middleware for single profile picture upload
const uploadProfilePicture = upload.single('profilePicture');

// Error handler middleware for multer
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // Multer-specific errors
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size is too large. Maximum size is 5MB.'
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: `Unexpected field in file upload. Expected fields: 'idCardFront' and 'idCardBack'. Got unexpected field: '${err.field}'`
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message
    });
  } else if (err) {
    // Other errors
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
  next();
};

module.exports = {
  uploadIdCards,
  uploadProfilePicture,
  handleUploadError
};
