const mongoose = require('mongoose');
const User = require('./User');

const providerSchema = new mongoose.Schema({
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
      type: String, // URL or path to uploaded image (optional - just stored)
      required: false,
      default: null
    },
    backImage: {
      type: String, // URL or path to uploaded image (optional - just stored)
      required: false,
      default: null
    },
    idNumber: {
      type: String, // To be filled manually by admin after review
      required: false,
      sparse: true, // Allow null but unique when present
      trim: true
    },
    fullNameOnId: {
      type: String,
      required: false,
      trim: true
    },
    dateOfBirth: {
      type: Date
    },
    expiryDate: {
      type: Date
    },
    issuedDate: {
      type: Date
    },
    nationality: {
      type: String,
      trim: true
    },
    address: {
      type: String,
      trim: true
    }
  },
  // Verification Status
  verificationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  idVerifiedAt: {
    type: Date
  },
  verificationNotes: {
    type: String,
    trim: true
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
  },
  // Provider-specific fields
  servicesOffered: [{
    type: String,
    trim: true
  }],
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalReviews: {
    type: Number,
    default: 0
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  completedJobs: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for faster queries
providerSchema.index({ userId: 1 });
providerSchema.index({ 'idCard.idNumber': 1 });
providerSchema.index({ verificationStatus: 1 });

// Virtual populate to get user details
providerSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

// Ensure virtuals are included when converting to JSON
providerSchema.set('toJSON', { virtuals: true });
providerSchema.set('toObject', { virtuals: true });

// Method to approve provider
providerSchema.methods.approve = function() {
  this.verificationStatus = 'approved';
  this.idVerifiedAt = new Date();
  return this.save();
};

// Method to reject provider
providerSchema.methods.reject = function(reason) {
  this.verificationStatus = 'rejected';
  this.verificationNotes = reason;
  return this.save();
};

module.exports = mongoose.model('Provider', providerSchema);
