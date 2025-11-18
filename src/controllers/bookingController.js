const Booking = require('../models/Booking');
const Appointment = require('../models/Appointment');
const Service = require('../models/Service');
const User = require('../models/User');
const Provider = require('../models/Provider');

/**
 * @desc    Create a regular booking (for services with appointmentEnabled = false)
 * @route   POST /api/bookings
 * @access  Private (User)
 */
exports.createBooking = async (req, res) => {
  try {
    const { serviceId, bookingDate, downPayment, userNotes } = req.body;
    const userId = req.user._id;

    // Validate required fields
    if (!serviceId || !bookingDate || downPayment === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Please provide serviceId, bookingDate, and downPayment'
      });
    }

    // Check if service exists and is active
    const service = await Service.findById(serviceId).populate('category');
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

    // Check if service has appointment disabled (booking is for non-appointment services)
    if (service.appointmentEnabled) {
      return res.status(400).json({
        success: false,
        message: 'This service requires an appointment. Please use the appointment endpoint instead.'
      });
    }

    // Validate down payment (minimum 20% of base price)
    const minimumDownPayment = service.basePrice * 0.2;
    if (downPayment < minimumDownPayment) {
      return res.status(400).json({
        success: false,
        message: `Down payment must be at least 20% of total amount (minimum: $${minimumDownPayment.toFixed(2)})`
      });
    }

    // Create booking
    const booking = new Booking({
      userId,
      serviceId: service._id,
      providerId: service.providerId,
      bookingDate: new Date(bookingDate),
      serviceSnapshot: {
        serviceName: service.headline,
        servicePhoto: service.servicePhoto,
        basePrice: service.basePrice,
        category: service.category._id
      },
      downPayment,
      totalAmount: service.basePrice,
      userNotes
    });

    await booking.save();

    // Populate booking data for response
    await booking.populate([
      { path: 'user', select: 'fullName email phoneNumber profilePicture' },
      { path: 'service' },
      {
        path: 'provider',
        populate: {
          path: 'userId',
          select: 'fullName email phoneNumber profilePicture'
        }
      }
    ]);

    // Update service booking count
    service.bookings += 1;
    await service.save();

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: booking
    });

  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating booking'
    });
  }
};

/**
 * @desc    Create an appointment (for services with appointmentEnabled = true)
 * @route   POST /api/appointments
 * @access  Private (User)
 */
exports.createAppointment = async (req, res) => {
  try {
    const {
      serviceId,
      appointmentDate,
      timeSlot,
      slotId,
      downPayment,
      userNotes
    } = req.body;
    const userId = req.user._id;

    // Validate required fields
    if (!serviceId || !appointmentDate || !timeSlot || !slotId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide serviceId, appointmentDate, timeSlot, and slotId'
      });
    }

    // Validate timeSlot format
    if (!timeSlot.startTime || !timeSlot.endTime) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both startTime and endTime in timeSlot'
      });
    }

    // Check if service exists and is active
    const service = await Service.findById(serviceId).populate('category');
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

    // Check if service has appointment enabled
    if (!service.appointmentEnabled) {
      return res.status(400).json({
        success: false,
        message: 'This service does not support appointments. Please use the regular booking endpoint.'
      });
    }

    // Find the selected appointment slot
    const selectedSlot = service.appointmentSlots.id(slotId);
    if (!selectedSlot) {
      return res.status(404).json({
        success: false,
        message: 'Selected appointment slot not found'
      });
    }

    // Create appointment object for conflict checking
    const appointment = new Appointment({
      userId,
      serviceId: service._id,
      providerId: service.providerId,
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
        category: service.category._id
      },
      totalAmount: selectedSlot.price,
      downPayment: downPayment || 0,
      userNotes
    });

    // Check for time conflicts
    const hasConflict = await appointment.hasTimeConflict();
    if (hasConflict) {
      return res.status(409).json({
        success: false,
        message: 'This time slot is already booked. Please choose a different time.'
      });
    }

    // Save appointment
    await appointment.save();

    // Populate appointment data for response
    await appointment.populate([
      { path: 'user', select: 'fullName email phoneNumber profilePicture' },
      { path: 'service' },
      {
        path: 'provider',
        populate: {
          path: 'userId',
          select: 'fullName email phoneNumber profilePicture'
        }
      }
    ]);

    // Update service booking count
    service.bookings += 1;
    await service.save();

    res.status(201).json({
      success: true,
      message: 'Appointment created successfully',
      data: appointment
    });

  } catch (error) {
    console.error('Create appointment error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating appointment'
    });
  }
};

/**
 * @desc    Get user's bookings
 * @route   GET /api/bookings/my-bookings
 * @access  Private (User)
 */
exports.getMyBookings = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status, page = 1, limit = 10 } = req.query;

    // Build query
    const query = { userId };
    if (status) {
      query.bookingStatus = status;
    }

    // Pagination
    const skip = (page - 1) * limit;

    const bookings = await Booking.find(query)
      .populate('service')
      .populate({
        path: 'provider',
        populate: {
          path: 'userId',
          select: 'fullName email phoneNumber profilePicture'
        }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Booking.countDocuments(query);

    res.status(200).json({
      success: true,
      count: bookings.length,
      total,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      data: bookings
    });

  } catch (error) {
    console.error('Get my bookings error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching bookings'
    });
  }
};

/**
 * @desc    Get user's appointments
 * @route   GET /api/appointments/my-appointments
 * @access  Private (User)
 */
exports.getMyAppointments = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status, page = 1, limit = 10 } = req.query;

    // Build query
    const query = { userId };
    if (status) {
      query.appointmentStatus = status;
    }

    // Pagination
    const skip = (page - 1) * limit;

    const appointments = await Appointment.find(query)
      .populate('service')
      .populate({
        path: 'provider',
        populate: {
          path: 'userId',
          select: 'fullName email phoneNumber profilePicture'
        }
      })
      .sort({ appointmentDate: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Appointment.countDocuments(query);

    res.status(200).json({
      success: true,
      count: appointments.length,
      total,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      data: appointments
    });

  } catch (error) {
    console.error('Get my appointments error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching appointments'
    });
  }
};

/**
 * @desc    Get single booking by ID
 * @route   GET /api/bookings/:id
 * @access  Private (User/Provider)
 */
exports.getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('user', 'fullName email phoneNumber profilePicture')
      .populate('service')
      .populate({
        path: 'provider',
        populate: {
          path: 'userId',
          select: 'fullName email phoneNumber profilePicture'
        }
      });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if user is authorized to view this booking
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
    console.error('Get booking error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching booking'
    });
  }
};

/**
 * @desc    Get single appointment by ID
 * @route   GET /api/appointments/:id
 * @access  Private (User/Provider)
 */
exports.getAppointmentById = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('user', 'fullName email phoneNumber profilePicture')
      .populate('service')
      .populate({
        path: 'provider',
        populate: {
          path: 'userId',
          select: 'fullName email phoneNumber profilePicture'
        }
      });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Check if user is authorized to view this appointment
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
    console.error('Get appointment error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching appointment'
    });
  }
};

/**
 * @desc    Cancel booking
 * @route   PATCH /api/bookings/:id/cancel
 * @access  Private (User)
 */
exports.cancelBooking = async (req, res) => {
  try {
    const { cancellationReason } = req.body;
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if user owns this booking
    if (booking.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this booking'
      });
    }

    // Check if booking can be cancelled
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
    console.error('Cancel booking error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error cancelling booking'
    });
  }
};

/**
 * @desc    Cancel appointment
 * @route   PATCH /api/appointments/:id/cancel
 * @access  Private (User)
 */
exports.cancelAppointment = async (req, res) => {
  try {
    const { cancellationReason } = req.body;
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Check if user owns this appointment
    if (appointment.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this appointment'
      });
    }

    // Check if appointment can be cancelled
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
    console.error('Cancel appointment error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error cancelling appointment'
    });
  }
};

/**
 * @desc    Get available time slots for a service on a specific date
 * @route   GET /api/appointments/available-slots/:serviceId
 * @access  Public
 */
exports.getAvailableSlots = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a date'
      });
    }

    // Get service
    const service = await Service.findById(serviceId);
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

    // Get all appointments for this service on the given date
    const appointmentDate = new Date(date);
    const appointments = await Appointment.find({
      serviceId,
      appointmentDate: {
        $gte: new Date(appointmentDate.setHours(0, 0, 0, 0)),
        $lt: new Date(appointmentDate.setHours(23, 59, 59, 999))
      },
      appointmentStatus: { $in: ['pending', 'confirmed'] }
    }).select('timeSlot');

    res.status(200).json({
      success: true,
      data: {
        service: {
          id: service._id,
          name: service.headline,
          appointmentSlots: service.appointmentSlots
        },
        bookedSlots: appointments.map(apt => apt.timeSlot),
        date: date
      }
    });

  } catch (error) {
    console.error('Get available slots error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching available slots'
    });
  }
};
