const mongoose = require('mongoose');

/**
 * Business Owner Booking Model - For employee services (appointmentEnabled = false)
 */
const businessOwnerBookingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  employeeServiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EmployeeService',
    required: [true, 'Employee service ID is required']
  },
  businessOwnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessOwner',
    required: [true, 'Business owner ID is required']
  },
  bookingDate: {
    type: Date,
    required: [true, 'Booking date is required'],
    validate: {
      validator: function(v) {
        return v >= new Date();
      },
      message: 'Booking date must be in the future'
    }
  },
  serviceSnapshot: {
    serviceName: String,
    servicePhoto: String,
    basePrice: {
      type: Number,
      required: true
    },
    categories: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category'
    }]
  },
  downPayment: {
    type: Number,
    required: [true, 'Down payment is required'],
    min: [0, 'Down payment cannot be negative']
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  remainingAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'partial', 'completed', 'refunded'],
    default: 'partial'
  },
  bookingStatus: {
    type: String,
    enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rejected'],
    default: 'pending'
  },
  userNotes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  providerNotes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  cancellationReason: {
    type: String,
    trim: true
  },
  cancelledBy: {
    type: String,
    enum: ['user', 'business_owner', 'admin']
  },
  cancelledAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
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

businessOwnerBookingSchema.index({ userId: 1, createdAt: -1 });
businessOwnerBookingSchema.index({ businessOwnerId: 1, createdAt: -1 });
businessOwnerBookingSchema.index({ employeeServiceId: 1 });
businessOwnerBookingSchema.index({ bookingStatus: 1 });
businessOwnerBookingSchema.index({ bookingDate: 1 });

businessOwnerBookingSchema.pre('validate', function(next) {
  if (this.downPayment && this.totalAmount) {
    const minimumDownPayment = this.totalAmount * 0.2;
    if (this.downPayment < minimumDownPayment) {
      return next(new Error(`Down payment must be at least 20% of total amount (minimum: $${minimumDownPayment.toFixed(2)})`));
    }
  }
  next();
});

businessOwnerBookingSchema.pre('save', function(next) {
  if (this.totalAmount && this.downPayment) {
    this.remainingAmount = this.totalAmount - this.downPayment;

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

businessOwnerBookingSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

businessOwnerBookingSchema.virtual('service', {
  ref: 'EmployeeService',
  localField: 'employeeServiceId',
  foreignField: '_id',
  justOne: true
});

businessOwnerBookingSchema.virtual('businessOwner', {
  ref: 'BusinessOwner',
  localField: 'businessOwnerId',
  foreignField: '_id',
  justOne: true
});

businessOwnerBookingSchema.set('toJSON', { virtuals: true });
businessOwnerBookingSchema.set('toObject', { virtuals: true });

businessOwnerBookingSchema.methods.cancel = function(reason, cancelledBy) {
  this.bookingStatus = 'cancelled';
  this.cancellationReason = reason;
  this.cancelledBy = cancelledBy;
  this.cancelledAt = new Date();
  return this.save();
};

businessOwnerBookingSchema.methods.confirm = function() {
  this.bookingStatus = 'confirmed';
  return this.save();
};

businessOwnerBookingSchema.methods.complete = function() {
  this.bookingStatus = 'completed';
  this.completedAt = new Date();
  return this.save();
};

module.exports = mongoose.model('BusinessOwnerBooking', businessOwnerBookingSchema);
