const mongoose = require('mongoose');

const businessOwnerSchema = new mongoose.Schema({
  // Reference to User model
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  // ID Card Information
  idCard: {
    frontImage: {
      type: String, // Cloudinary URL for ID card front image
      required: false,
      default: null
    },
    backImage: {
      type: String, // Cloudinary URL for ID card back image
      required: false,
      default: null
    }
  },
  // Occupation (Optional)
  occupation: {
    type: String,
    trim: true,
    maxlength: [100, 'Occupation cannot exceed 100 characters']
  },
  // Reference ID (Optional)
  referenceId: {
    type: String,
    trim: true,
    sparse: true // Allow null but unique when present
  }
}, {
  timestamps: true
});

// Index for faster queries
businessOwnerSchema.index({ userId: 1 });

// Virtual populate to get user details
businessOwnerSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

// Ensure virtuals are included when converting to JSON
businessOwnerSchema.set('toJSON', { virtuals: true });
businessOwnerSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('BusinessOwner', businessOwnerSchema);
