const mongoose = require('mongoose');

/**
 * Booking Model - For regular service bookings (when appointmentEnabled = false)
 * User selects a service and provides:
 * - Date
 * - Down payment (minimum 20% of base price)
 * - Notes
 */
const bookingSchema = new mongoose.Schema({
  // Reference to User who made the booking
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  // Reference to Service being booked
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: [true, 'Service ID is required']
  },
  // Reference to Provider who owns the service
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Provider',
    required: [true, 'Provider ID is required']
  },
  // Booking Date - when user wants the service
  bookingDate: {
    type: Date,
    required: [true, 'Booking date is required'],
    validate: {
      validator: function(v) {
        // Date should be in the future
        return v >= new Date();
      },
      message: 'Booking date must be in the future'
    }
  },
  // Service details snapshot (to preserve info even if service is modified later)
  serviceSnapshot: {
    serviceName: String,
    servicePhoto: String,
    basePrice: {
      type: Number,
      required: true
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category'
    }
  },
  // Down Payment (minimum 20% of total price)
  downPayment: {
    type: Number,
    required: [true, 'Down payment is required'],
    min: [0, 'Down payment cannot be negative']
  },
  // Total Amount (from service base price)
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  // Remaining Amount
  remainingAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  // Payment Status
  paymentStatus: {
    type: String,
    enum: ['pending', 'partial', 'completed', 'refunded'],
    default: 'partial' // Since down payment is made
  },
  // Booking Status
  bookingStatus: {
    type: String,
    enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rejected'],
    default: 'pending'
  },
  // Notes from User
  userNotes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  // Provider Notes/Response
  providerNotes: {
    type: String,
    trim: true,
    maxlength: [500, 'Provider notes cannot exceed 500 characters']
  },
  // Cancellation Details
  cancellationReason: {
    type: String,
    trim: true
  },
  cancelledBy: {
    type: String,
    enum: ['user', 'provider', 'admin']
  },
  cancelledAt: {
    type: Date
  },
  // Completion Details
  completedAt: {
    type: Date
  },
  // Review/Rating
  rating: {
    type: Number,
    min: 0,
    max: 5
  },
  review: {
    type: String,
    trim: true,
    maxlength: [500, 'Review cannot exceed 500 characters']
  },
  reviewedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for faster queries
bookingSchema.index({ userId: 1, createdAt: -1 });
bookingSchema.index({ providerId: 1, createdAt: -1 });
bookingSchema.index({ serviceId: 1 });
bookingSchema.index({ bookingStatus: 1 });
bookingSchema.index({ bookingDate: 1 });

// Validate down payment is at least 20% of total amount
bookingSchema.pre('validate', function(next) {
  if (this.downPayment && this.totalAmount) {
    const minimumDownPayment = this.totalAmount * 0.2;
    if (this.downPayment < minimumDownPayment) {
      return next(new Error(`Down payment must be at least 20% of total amount (minimum: $${minimumDownPayment.toFixed(2)})`));
    }
  }
  next();
});

// Calculate remaining amount before saving
bookingSchema.pre('save', function(next) {
  if (this.totalAmount && this.downPayment) {
    this.remainingAmount = this.totalAmount - this.downPayment;

    // Update payment status
    if (this.remainingAmount <= 0) {
      this.paymentStatus = 'completed';
    } else if (this.downPayment > 0) {
      this.paymentStatus = 'partial';
    } else {
      this.paymentStatus = 'pending';
    }
  }
  next();
});

// Virtual populate
bookingSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

bookingSchema.virtual('service', {
  ref: 'Service',
  localField: 'serviceId',
  foreignField: '_id',
  justOne: true
});

bookingSchema.virtual('provider', {
  ref: 'Provider',
  localField: 'providerId',
  foreignField: '_id',
  justOne: true
});

// Ensure virtuals are included when converting to JSON
bookingSchema.set('toJSON', { virtuals: true });
bookingSchema.set('toObject', { virtuals: true });

// Methods
bookingSchema.methods.cancel = function(reason, cancelledBy) {
  this.bookingStatus = 'cancelled';
  this.cancellationReason = reason;
  this.cancelledBy = cancelledBy;
  this.cancelledAt = new Date();
  return this.save();
};

bookingSchema.methods.confirm = function() {
  this.bookingStatus = 'confirmed';
  return this.save();
};

bookingSchema.methods.complete = function() {
  this.bookingStatus = 'completed';
  this.completedAt = new Date();
  return this.save();
};

module.exports = mongoose.model('Booking', bookingSchema);
