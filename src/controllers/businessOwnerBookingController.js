
const BusinessOwnerBooking = require('../models/BusinessOwnerBooking');
const BusinessOwnerAppointment = require('../models/BusinessOwnerAppointment');
const EmployeeService = require('../models/EmployeeService');
const BusinessOwner = require('../models/BusinessOwner');

const getBusinessOwnerFromUser = async (userId) => {
  const businessOwner = await BusinessOwner.findOne({ userId });
  if (!businessOwner) {
    throw new Error('Business owner profile not found');
  }
  return businessOwner;
};

// ==================== USER BOOKING ====================

/**
 * @desc    Create a regular booking for a business owner service
 * @route   POST /api/business-owner-bookings
 * @access  Private (User)
 */
exports.createBusinessOwnerBooking = async (req, res) => {
  try {
    const { employeeServiceId, bookingDate, downPayment, userNotes } = req.body;
    const userId = req.user._id;

    if (!employeeServiceId || !bookingDate || downPayment === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Please provide employeeServiceId, bookingDate, and downPayment'
      });
    }

    const service = await EmployeeService.findById(employeeServiceId);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    if (!service.isActive) {
      return res.status(400).json({
        success: false,
        message: 'This service is currently not available'
      });
    }

    if (service.appointmentEnabled) {
      return res.status(400).json({
        success: false,
        message: 'This service requires an appointment. Please use the appointment endpoint instead.'
      });
    }

    const minimumDownPayment = service.basePrice * 0.2;
    if (downPayment < minimumDownPayment) {
      return res.status(400).json({
        success: false,
        message: `Down payment must be at least 20% of total amount (minimum: $${minimumDownPayment.toFixed(2)})`
      });
    }

    const booking = new BusinessOwnerBooking({
      userId,
      employeeServiceId: service._id,
      businessOwnerId: service.businessOwnerId,
      bookingDate: new Date(bookingDate),
      serviceSnapshot: {
        serviceName: service.headline,
        servicePhoto: service.servicePhoto,
        basePrice: service.basePrice,
        categories: service.categories
      },
      downPayment,
      totalAmount: service.basePrice,
      userNotes
    });

    await booking.save();

    await booking.populate([
      { path: 'user', select: 'fullName email phoneNumber profilePicture' },
      { path: 'service' },
      {
        path: 'businessOwner',
        populate: {
          path: 'userId',
          select: 'fullName email phoneNumber profilePicture'
        }
      }
    ]);

    service.bookings += 1;
    await service.save();

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: booking
    });
  } catch (error) {
    console.error('Create business owner booking error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating booking'
    });
  }
};

/**
 * @desc    Create an appointment for a business owner service
 * @route   POST /api/business-owner-appointments
 * @access  Private (User)
 */
exports.createBusinessOwnerAppointment = async (req, res) => {
  try {
    const {
      employeeServiceId,
      appointmentDate,
      timeSlot,
      slotId,
      downPayment,
      userNotes
    } = req.body;
    const userId = req.user._id;

    if (!employeeServiceId || !appointmentDate || !timeSlot || !slotId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide employeeServiceId, appointmentDate, timeSlot, and slotId'
      });
    }

    if (!timeSlot.startTime || !timeSlot.endTime) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both startTime and endTime in timeSlot'
      });
    }

    const service = await EmployeeService.findById(employeeServiceId);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    if (!service.isActive) {
      return res.status(400).json({
        success: false,
        message: 'This service is currently not available'
      });
    }

    if (!service.appointmentEnabled) {
      return res.status(400).json({
        success: false,
        message: 'This service does not support appointments. Please use the regular booking endpoint.'
      });
    }

    const selectedSlot = service.appointmentSlots.id(slotId);
    if (!selectedSlot) {
      return res.status(404).json({
        success: false,
        message: 'Selected appointment slot not found'
      });
    }

    const appointment = new BusinessOwnerAppointment({
      userId,
      employeeServiceId: service._id,
      businessOwnerId: service.businessOwnerId,
      appointmentDate: new Date(appointmentDate),
      timeSlot: {
        startTime: timeSlot.startTime,
        endTime: timeSlot.endTime
      },
      selectedSlot: {
        duration: selectedSlot.duration,
        durationUnit: selectedSlot.durationUnit,
        price: selectedSlot.price,
        slotId: selectedSlot._id
      },
      serviceSnapshot: {
        serviceName: service.headline,
        servicePhoto: service.servicePhoto,
        headline: service.headline,
        categories: service.categories
      },
      totalAmount: selectedSlot.price,
      downPayment: downPayment || 0,
      userNotes
    });

    const hasConflict = await appointment.hasTimeConflict();
    if (hasConflict) {
      return res.status(409).json({
        success: false,
        message: 'This time slot is already booked. Please choose a different time.'
      });
    }

    await appointment.save();

    await appointment.populate([
      { path: 'user', select: 'fullName email phoneNumber profilePicture' },
      { path: 'service' },
      {
        path: 'businessOwner',
        populate: {
          path: 'userId',
          select: 'fullName email phoneNumber profilePicture'
        }
      }
    ]);

    service.bookings += 1;
    await service.save();

    res.status(201).json({
      success: true,
      message: 'Appointment created successfully',
      data: appointment
    });
  } catch (error) {
    console.error('Create business owner appointment error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating appointment'
    });
  }
};
/**
 * @desc    Get user's business owner bookings
 * @route   GET /api/business-owner-bookings/my-bookings
 * @access  Private (User)
 */
exports.getMyBusinessOwnerBookings = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status, page = 1, limit = 10 } = req.query;

    const query = { userId };
    if (status) {
      query.bookingStatus = status;
    }

    const skip = (page - 1) * limit;

    const bookings = await BusinessOwnerBooking.find(query)
      .populate('service')
      .populate({
        path: 'businessOwner',
        populate: {
          path: 'userId',
          select: 'fullName email phoneNumber profilePicture'
        }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await BusinessOwnerBooking.countDocuments(query);

    res.status(200).json({
      success: true,
      count: bookings.length,
      total,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      data: bookings
    });
  } catch (error) {
    console.error('Get my business owner bookings error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching bookings'
    });
  }
};

/**
 * @desc    Get user's business owner appointments
 * @route   GET /api/business-owner-appointments/my-appointments
 * @access  Private (User)
 */
exports.getMyBusinessOwnerAppointments = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status, page = 1, limit = 10 } = req.query;

    const query = { userId };
    if (status) {
      query.appointmentStatus = status;
    }

    const skip = (page - 1) * limit;

    const appointments = await BusinessOwnerAppointment.find(query)
      .populate('service')
      .populate({
        path: 'businessOwner',
        populate: {
          path: 'userId',
          select: 'fullName email phoneNumber profilePicture'
        }
      })
      .sort({ appointmentDate: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await BusinessOwnerAppointment.countDocuments(query);

    res.status(200).json({
      success: true,
      count: appointments.length,
      total,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      data: appointments
    });
  } catch (error) {
    console.error('Get my business owner appointments error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching appointments'
    });
  }
};

/**
 * @desc    Get business owner booking by ID (user)
 * @route   GET /api/business-owner-bookings/:id
 * @access  Private (User)
 */
exports.getBusinessOwnerBookingById = async (req, res) => {
  try {
    const booking = await BusinessOwnerBooking.findById(req.params.id)
      .populate('user', 'fullName email phoneNumber profilePicture')
      .populate('service')
      .populate({
        path: 'businessOwner',
        populate: {
          path: 'userId',
          select: 'fullName email phoneNumber profilePicture'
        }
      })

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this booking'
      });
    }

    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Get business owner booking error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching booking'
    });
  }
};

/**
 * @desc    Get business owner appointment by ID (user)
 * @route   GET /api/business-owner-appointments/:id
 * @access  Private (User)
 */
exports.getBusinessOwnerAppointmentById = async (req, res) => {
  try {
    const appointment = await BusinessOwnerAppointment.findById(req.params.id)
      .populate('user', 'fullName email phoneNumber profilePicture')
      .populate('service')
      .populate({
        path: 'businessOwner',
        populate: {
          path: 'userId',
          select: 'fullName email phoneNumber profilePicture'
        }
      })

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    if (appointment.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this appointment'
      });
    }

    res.status(200).json({
      success: true,
      data: appointment
    });
  } catch (error) {
    console.error('Get business owner appointment error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching appointment'
    });
  }
};

/**
 * @desc    Cancel business owner booking (user)
 * @route   PATCH /api/business-owner-bookings/:id/cancel
 * @access  Private (User)
 */
exports.cancelBusinessOwnerBooking = async (req, res) => {
  try {
    const { cancellationReason } = req.body;
    const booking = await BusinessOwnerBooking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this booking'
      });
    }

    if (['completed', 'cancelled'].includes(booking.bookingStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel a ${booking.bookingStatus} booking`
      });
    }

    await booking.cancel(cancellationReason, 'user');

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      data: booking
    });
  } catch (error) {
    console.error('Cancel business owner booking error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error cancelling booking'
    });
  }
};

/**
 * @desc    Cancel business owner appointment (user)
 * @route   PATCH /api/business-owner-appointments/:id/cancel
 * @access  Private (User)
 */
exports.cancelBusinessOwnerAppointment = async (req, res) => {
  try {
    const { cancellationReason } = req.body;
    const appointment = await BusinessOwnerAppointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    if (appointment.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this appointment'
      });
    }

    if (['completed', 'cancelled'].includes(appointment.appointmentStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel a ${appointment.appointmentStatus} appointment`
      });
    }

    await appointment.cancel(cancellationReason, 'user');

    res.status(200).json({
      success: true,
      message: 'Appointment cancelled successfully',
      data: appointment
    });
  } catch (error) {
    console.error('Cancel business owner appointment error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error cancelling appointment'
    });
  }
};

/**
 * @desc    Get available slots for a business owner service on a specific date
 * @route   GET /api/business-owner-appointments/available-slots/:serviceId
 * @access  Public
 */
exports.getAvailableBusinessOwnerSlots = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a date'
      });
    }

    const service = await EmployeeService.findById(serviceId);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    if (!service.appointmentEnabled) {
      return res.status(400).json({
        success: false,
        message: 'This service does not support appointments'
      });
    }

    const appointmentDate = new Date(date);
    const appointments = await BusinessOwnerAppointment.find({
      employeeServiceId: service._id,
      appointmentDate: {
        $gte: new Date(appointmentDate.setHours(0, 0, 0, 0)),
        $lt: new Date(appointmentDate.setHours(23, 59, 59, 999))
      },
      appointmentStatus: { $in: ['pending', 'confirmed'] }
    }).select('timeSlot');

    const bookedSlots = appointments.map(apt => apt.timeSlot);
    const bookedSlotSet = new Set(bookedSlots);
    const availableSlots = (service.appointmentSlots || []).filter(
      slot => !bookedSlotSet.has(slot)
    );

    res.status(200).json({
      success: true,
      data: {
        service: {
          id: service._id,
          name: service.headline,
          appointmentSlots: service.appointmentSlots
        },
        bookedSlots,
        availableSlots,
        date: date
      }
    });
  } catch (error) {
    console.error('Get business owner available slots error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching available slots'
    });
  }
};
// ==================== BUSINESS OWNER MANAGEMENT ====================

/**
 * @desc    Get all bookings for business owner's services
 * @route   GET /api/business-owners/bookings
 * @access  Private (Business Owner)
 */
exports.getBusinessOwnerBookings = async (req, res) => {
  try {
    const businessOwner = await getBusinessOwnerFromUser(req.user._id);
    const { status, page = 1, limit = 10 } = req.query;

    const query = { businessOwnerId: businessOwner._id };
    if (status) {
      query.bookingStatus = status;
    }

    const skip = (page - 1) * limit;

    const bookings = await BusinessOwnerBooking.find(query)
      .populate('user', 'fullName email phoneNumber profilePicture')
      .populate('service')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await BusinessOwnerBooking.countDocuments(query);

    res.status(200).json({
      success: true,
      count: bookings.length,
      total,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      data: bookings
    });
  } catch (error) {
    console.error('Get business owner bookings error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching bookings'
    });
  }
};

/**
 * @desc    Get single booking details (business owner)
 * @route   GET /api/business-owners/bookings/:id
 * @access  Private (Business Owner)
 */
exports.getBusinessOwnerBookingDetails = async (req, res) => {
  try {
    const businessOwner = await getBusinessOwnerFromUser(req.user._id);

    const booking = await BusinessOwnerBooking.findById(req.params.id)
      .populate('user', 'fullName email phoneNumber profilePicture')
      .populate('service')

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.businessOwnerId.toString() !== businessOwner._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this booking'
      });
    }

    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Get business owner booking details error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching booking details'
    });
  }
};

/**
 * @desc    Accept/Confirm a booking request (business owner)
 * @route   PATCH /api/business-owners/bookings/:id/accept
 * @access  Private (Business Owner)
 */
exports.acceptBusinessOwnerBooking = async (req, res) => {
  try {
    const businessOwner = await getBusinessOwnerFromUser(req.user._id);
    const { providerNotes } = req.body;

    const booking = await BusinessOwnerBooking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.businessOwnerId.toString() !== businessOwner._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to manage this booking'
      });
    }

    if (booking.bookingStatus !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot accept a ${booking.bookingStatus} booking`
      });
    }

    booking.bookingStatus = 'confirmed';
    if (providerNotes) {
      booking.providerNotes = providerNotes;
    }
    await booking.save();

    await booking.populate('user', 'fullName email phoneNumber profilePicture');

    res.status(200).json({
      success: true,
      message: 'Booking accepted successfully',
      data: booking
    });
  } catch (error) {
    console.error('Accept business owner booking error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error accepting booking'
    });
  }
};

/**
 * @desc    Reject/Cancel a booking request (business owner)
 * @route   PATCH /api/business-owners/bookings/:id/reject
 * @access  Private (Business Owner)
 */
exports.rejectBusinessOwnerBooking = async (req, res) => {
  try {
    const businessOwner = await getBusinessOwnerFromUser(req.user._id);
    const { cancellationReason } = req.body;

    const booking = await BusinessOwnerBooking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.businessOwnerId.toString() !== businessOwner._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to manage this booking'
      });
    }

    if (['completed', 'cancelled', 'rejected'].includes(booking.bookingStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot reject a ${booking.bookingStatus} booking`
      });
    }

    booking.bookingStatus = 'rejected';
    booking.cancellationReason = cancellationReason || 'Rejected by business owner';
    booking.cancelledBy = 'business_owner';
    booking.cancelledAt = new Date();
    await booking.save();

    await booking.populate('user', 'fullName email phoneNumber profilePicture');

    res.status(200).json({
      success: true,
      message: 'Booking rejected successfully',
      data: booking
    });
  } catch (error) {
    console.error('Reject business owner booking error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error rejecting booking'
    });
  }
};

/**
 * @desc    Mark booking as in progress (business owner)
 * @route   PATCH /api/business-owners/bookings/:id/start
 * @access  Private (Business Owner)
 */
exports.startBusinessOwnerBooking = async (req, res) => {
  try {
    const businessOwner = await getBusinessOwnerFromUser(req.user._id);

    const booking = await BusinessOwnerBooking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.businessOwnerId.toString() !== businessOwner._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to manage this booking'
      });
    }

    if (booking.bookingStatus !== 'confirmed') {
      return res.status(400).json({
        success: false,
        message: `Cannot start a ${booking.bookingStatus} booking. Must be confirmed first.`
      });
    }

    booking.bookingStatus = 'in_progress';
    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Booking started',
      data: booking
    });
  } catch (error) {
    console.error('Start business owner booking error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error starting booking'
    });
  }
};

/**
 * @desc    Mark booking as completed (business owner)
 * @route   PATCH /api/business-owners/bookings/:id/complete
 * @access  Private (Business Owner)
 */
exports.completeBusinessOwnerBooking = async (req, res) => {
  try {
    const businessOwner = await getBusinessOwnerFromUser(req.user._id);

    const booking = await BusinessOwnerBooking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.businessOwnerId.toString() !== businessOwner._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to manage this booking'
      });
    }

    if (!['confirmed', 'in_progress'].includes(booking.bookingStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot complete a ${booking.bookingStatus} booking`
      });
    }

    booking.bookingStatus = 'completed';
    booking.completedAt = new Date();
    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Booking completed successfully',
      data: booking
    });
  } catch (error) {
    console.error('Complete business owner booking error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error completing booking'
    });
  }
};
// ==================== BUSINESS OWNER APPOINTMENT MANAGEMENT ====================

/**
 * @desc    Get all appointments for business owner's services
 * @route   GET /api/business-owners/appointments
 * @access  Private (Business Owner)
 */
exports.getBusinessOwnerAppointments = async (req, res) => {
  try {
    const businessOwner = await getBusinessOwnerFromUser(req.user._id);
    const { status, date, page = 1, limit = 10 } = req.query;

    const query = { businessOwnerId: businessOwner._id };
    if (status) {
      query.appointmentStatus = status;
    }
    if (date) {
      const appointmentDate = new Date(date);
      query.appointmentDate = {
        $gte: new Date(appointmentDate.setHours(0, 0, 0, 0)),
        $lt: new Date(appointmentDate.setHours(23, 59, 59, 999))
      };
    }

    const skip = (page - 1) * limit;

    const appointments = await BusinessOwnerAppointment.find(query)
      .populate('user', 'fullName email phoneNumber profilePicture')
      .populate('service')
      .sort({ appointmentDate: 1, 'timeSlot.startTime': 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await BusinessOwnerAppointment.countDocuments(query);

    res.status(200).json({
      success: true,
      count: appointments.length,
      total,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      data: appointments
    });
  } catch (error) {
    console.error('Get business owner appointments error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching appointments'
    });
  }
};

/**
 * @desc    Get single appointment details (business owner)
 * @route   GET /api/business-owners/appointments/:id
 * @access  Private (Business Owner)
 */
exports.getBusinessOwnerAppointmentDetails = async (req, res) => {
  try {
    const businessOwner = await getBusinessOwnerFromUser(req.user._id);

    const appointment = await BusinessOwnerAppointment.findById(req.params.id)
      .populate('user', 'fullName email phoneNumber profilePicture')
      .populate('service')

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    if (appointment.businessOwnerId.toString() !== businessOwner._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this appointment'
      });
    }

    res.status(200).json({
      success: true,
      data: appointment
    });
  } catch (error) {
    console.error('Get business owner appointment details error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching appointment details'
    });
  }
};

/**
 * @desc    Accept/Confirm an appointment request (business owner)
 * @route   PATCH /api/business-owners/appointments/:id/accept
 * @access  Private (Business Owner)
 */
exports.acceptBusinessOwnerAppointment = async (req, res) => {
  try {
    const businessOwner = await getBusinessOwnerFromUser(req.user._id);
    const { providerNotes } = req.body;

    const appointment = await BusinessOwnerAppointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    if (appointment.businessOwnerId.toString() !== businessOwner._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to manage this appointment'
      });
    }

    if (appointment.appointmentStatus !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot accept a ${appointment.appointmentStatus} appointment`
      });
    }

    appointment.appointmentStatus = 'confirmed';
    if (providerNotes) {
      appointment.providerNotes = providerNotes;
    }
    await appointment.save();

    await appointment.populate('user', 'fullName email phoneNumber profilePicture');

    res.status(200).json({
      success: true,
      message: 'Appointment accepted successfully',
      data: appointment
    });
  } catch (error) {
    console.error('Accept business owner appointment error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error accepting appointment'
    });
  }
};

/**
 * @desc    Reject/Cancel an appointment request (business owner)
 * @route   PATCH /api/business-owners/appointments/:id/reject
 * @access  Private (Business Owner)
 */
exports.rejectBusinessOwnerAppointment = async (req, res) => {
  try {
    const businessOwner = await getBusinessOwnerFromUser(req.user._id);
    const { cancellationReason } = req.body;

    const appointment = await BusinessOwnerAppointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    if (appointment.businessOwnerId.toString() !== businessOwner._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to manage this appointment'
      });
    }

    if (['completed', 'cancelled', 'rejected'].includes(appointment.appointmentStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot reject a ${appointment.appointmentStatus} appointment`
      });
    }

    appointment.appointmentStatus = 'rejected';
    appointment.cancellationReason = cancellationReason || 'Rejected by business owner';
    appointment.cancelledBy = 'business_owner';
    appointment.cancelledAt = new Date();
    await appointment.save();

    await appointment.populate('user', 'fullName email phoneNumber profilePicture');

    res.status(200).json({
      success: true,
      message: 'Appointment rejected successfully',
      data: appointment
    });
  } catch (error) {
    console.error('Reject business owner appointment error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error rejecting appointment'
    });
  }
};

/**
 * @desc    Reschedule an appointment (business owner)
 * @route   PATCH /api/business-owners/appointments/:id/reschedule
 * @access  Private (Business Owner)
 */
exports.rescheduleBusinessOwnerAppointment = async (req, res) => {
  try {
    const businessOwner = await getBusinessOwnerFromUser(req.user._id);
    const { appointmentDate, timeSlot, providerNotes } = req.body;

    if (!appointmentDate || !timeSlot) {
      return res.status(400).json({
        success: false,
        message: 'Please provide appointmentDate and timeSlot'
      });
    }

    const appointment = await BusinessOwnerAppointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    if (appointment.businessOwnerId.toString() !== businessOwner._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to manage this appointment'
      });
    }

    if (['completed', 'cancelled', 'rejected', 'no_show'].includes(appointment.appointmentStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot reschedule a ${appointment.appointmentStatus} appointment`
      });
    }

    const oldDate = appointment.appointmentDate;
    const oldTimeSlot = { ...appointment.timeSlot };

    appointment.appointmentDate = new Date(appointmentDate);
    appointment.timeSlot = {
      startTime: timeSlot.startTime,
      endTime: timeSlot.endTime
    };

    const hasConflict = await appointment.hasTimeConflict();
    if (hasConflict) {
      return res.status(409).json({
        success: false,
        message: 'The new time slot conflicts with another appointment. Please choose a different time.'
      });
    }

    const rescheduleNote = `Rescheduled by business owner from ${oldDate.toLocaleDateString()} (${oldTimeSlot.startTime}-${oldTimeSlot.endTime}) to ${appointment.appointmentDate.toLocaleDateString()} (${timeSlot.startTime}-${timeSlot.endTime})`;
    appointment.providerNotes = providerNotes
      ? `${providerNotes}\n\n${rescheduleNote}`
      : rescheduleNote;

    if (appointment.appointmentStatus === 'pending') {
      appointment.appointmentStatus = 'pending';
    }

    await appointment.save();

    await appointment.populate('user', 'fullName email phoneNumber profilePicture');

    res.status(200).json({
      success: true,
      message: 'Appointment rescheduled successfully',
      data: appointment
    });
  } catch (error) {
    console.error('Reschedule business owner appointment error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error rescheduling appointment'
    });
  }
};

/**
 * @desc    Mark appointment as in progress (business owner)
 * @route   PATCH /api/business-owners/appointments/:id/start
 * @access  Private (Business Owner)
 */
exports.startBusinessOwnerAppointment = async (req, res) => {
  try {
    const businessOwner = await getBusinessOwnerFromUser(req.user._id);

    const appointment = await BusinessOwnerAppointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    if (appointment.businessOwnerId.toString() !== businessOwner._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to manage this appointment'
      });
    }

    if (appointment.appointmentStatus !== 'confirmed') {
      return res.status(400).json({
        success: false,
        message: `Cannot start a ${appointment.appointmentStatus} appointment. Must be confirmed first.`
      });
    }

    appointment.appointmentStatus = 'in_progress';
    await appointment.save();

    res.status(200).json({
      success: true,
      message: 'Appointment started',
      data: appointment
    });
  } catch (error) {
    console.error('Start business owner appointment error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error starting appointment'
    });
  }
};

/**
 * @desc    Mark appointment as completed (business owner)
 * @route   PATCH /api/business-owners/appointments/:id/complete
 * @access  Private (Business Owner)
 */
exports.completeBusinessOwnerAppointment = async (req, res) => {
  try {
    const businessOwner = await getBusinessOwnerFromUser(req.user._id);

    const appointment = await BusinessOwnerAppointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    if (appointment.businessOwnerId.toString() !== businessOwner._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to manage this appointment'
      });
    }

    if (!['confirmed', 'in_progress'].includes(appointment.appointmentStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot complete a ${appointment.appointmentStatus} appointment`
      });
    }

    appointment.appointmentStatus = 'completed';
    appointment.completedAt = new Date();
    await appointment.save();

    res.status(200).json({
      success: true,
      message: 'Appointment completed successfully',
      data: appointment
    });
  } catch (error) {
    console.error('Complete business owner appointment error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error completing appointment'
    });
  }
};

/**
 * @desc    Mark user as no-show for appointment (business owner)
 * @route   PATCH /api/business-owners/appointments/:id/no-show
 * @access  Private (Business Owner)
 */
exports.markBusinessOwnerNoShow = async (req, res) => {
  try {
    const businessOwner = await getBusinessOwnerFromUser(req.user._id);

    const appointment = await BusinessOwnerAppointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    if (appointment.businessOwnerId.toString() !== businessOwner._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to manage this appointment'
      });
    }

    if (appointment.appointmentStatus !== 'confirmed') {
      return res.status(400).json({
        success: false,
        message: `Cannot mark no-show for a ${appointment.appointmentStatus} appointment`
      });
    }

    appointment.appointmentStatus = 'no_show';
    await appointment.save();

    res.status(200).json({
      success: true,
      message: 'Appointment marked as no-show',
      data: appointment
    });
  } catch (error) {
    console.error('Mark business owner no-show error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error marking no-show'
    });
  }
};
