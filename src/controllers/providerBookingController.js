const Booking = require('../models/Booking');
const Appointment = require('../models/Appointment');
const Service = require('../models/Service');
const Provider = require('../models/Provider');
const { getStripe } = require('../utility/stripe');
const { createAndSend } = require('../utility/notificationService');

/**
 * Helper function to get provider from user
 */
const getProviderFromUser = async (userId) => {
  const provider = await Provider.findOne({ userId });
  if (!provider) {
    throw new Error('Provider profile not found');
  }
  return provider;
};

// ==================== BOOKING MANAGEMENT ====================

/**
 * @desc    Get all bookings for provider's services
 * @route   GET /api/providers/bookings
 * @access  Private (Provider)
 */
exports.getProviderBookings = async (req, res) => {
  try {
    const provider = await getProviderFromUser(req.user._id);
    const { status, page = 1, limit = 10 } = req.query;

    // Build query
    const query = { providerId: provider._id };
    if (status) {
      query.bookingStatus = status;
    }

    // Pagination
    const skip = (page - 1) * limit;

    const bookings = await Booking.find(query)
      .populate('user', 'fullName email phoneNumber profilePicture location')
      .populate('service')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Booking.countDocuments(query);

    const bookingsWithAddress = bookings.map((booking) => {
      const obj = booking.toObject ? booking.toObject() : booking;
      if (obj.user && obj.user.location) {
        obj.user.address = obj.user.location.address || '';
      }
      return obj;
    });

    res.status(200).json({
      success: true,
      count: bookingsWithAddress.length,
      total,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      data: bookingsWithAddress
    });

  } catch (error) {
    console.error('Get provider bookings error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching bookings'
    });
  }
};

/**
 * @desc    Get single booking details
 * @route   GET /api/providers/bookings/:id
 * @access  Private (Provider)
 */
exports.getBookingDetails = async (req, res) => {
  try {
    const provider = await getProviderFromUser(req.user._id);

    const booking = await Booking.findById(req.params.id)
      .populate('user', 'fullName email phoneNumber profilePicture')
      .populate('service');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if booking belongs to this provider
    if (booking.providerId.toString() !== provider._id.toString()) {
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
    console.error('Get booking details error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching booking details'
    });
  }
};

/**
 * @desc    Accept/Confirm a booking request
 * @route   PATCH /api/providers/bookings/:id/accept
 * @access  Private (Provider)
 */
exports.acceptBooking = async (req, res) => {
  try {
    const provider = await getProviderFromUser(req.user._id);
    const { providerNotes } = req.body;

    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if booking belongs to this provider
    if (booking.providerId.toString() !== provider._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to manage this booking'
      });
    }

    // Check if booking is in pending status
    if (booking.bookingStatus !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot accept a ${booking.bookingStatus} booking`
      });
    }

    // Update booking status
    booking.bookingStatus = 'confirmed';
    if (providerNotes) {
      booking.providerNotes = providerNotes;
    }
    await booking.save();

    let sessionUrl = null;
    try {
      const successUrl = process.env.STRIPE_CHECKOUT_SUCCESS_URL;
      const cancelUrl = process.env.STRIPE_CHECKOUT_CANCEL_URL;
      if (!successUrl || !cancelUrl) {
        return res.status(500).json({
          success: false,
          message: 'Stripe checkout URLs not configured'
        });
      }

      const stripe = getStripe();
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'usd',
              unit_amount: Math.round(booking.downPayment * 100),
              product_data: {
                name: booking.serviceSnapshot?.serviceName || 'Service booking down payment'
              }
            }
          }
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          bookingId: booking._id.toString(),
          userId: booking.userId.toString(),
          providerId: booking.providerId.toString(),
          type: 'booking_down_payment'
        }
      });

      booking.paymentIntentId = session.payment_intent || booking.paymentIntentId;
      booking.paymentIntentStatus = 'requires_payment_method';
      booking.checkoutSessionId = session.id;
      booking.checkoutSessionUrl = session.url;
      await booking.save();

      sessionUrl = session.url;
    } catch (stripeError) {
      console.error('Stripe checkout session error:', stripeError);
      return res.status(500).json({
        success: false,
        message: 'Failed to create checkout session',
        error: stripeError.message
      });
    }

    // Populate for response
    await booking.populate('user', 'fullName email phoneNumber profilePicture');

    res.status(200).json({
      success: true,
      message: 'Booking accepted successfully',
      data: {
        booking,
        checkout: {
          sessionUrl
        }
      }
    });

    if (sessionUrl) {
      await createAndSend({
        userId: booking.userId,
        userType: 'user',
        title: 'Booking accepted',
        body: 'Your booking was accepted. Please complete the down payment.',
        type: 'booking_payment',
        entityType: 'booking',
        entityId: booking._id,
        metadata: { sessionUrl },
        data: {
          bookingId: booking._id.toString(),
          sessionUrl
        }
      });
    }

  } catch (error) {
    console.error('Accept booking error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error accepting booking'
    });
  }
};

/**
 * @desc    Reject/Cancel a booking request
 * @route   PATCH /api/providers/bookings/:id/reject
 * @access  Private (Provider)
 */
exports.rejectBooking = async (req, res) => {
  try {
    const provider = await getProviderFromUser(req.user._id);
    const { cancellationReason } = req.body;

    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if booking belongs to this provider
    if (booking.providerId.toString() !== provider._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to manage this booking'
      });
    }

    // Check if booking can be rejected
    if (['completed', 'cancelled', 'rejected'].includes(booking.bookingStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot reject a ${booking.bookingStatus} booking`
      });
    }

    // Update booking status
    booking.bookingStatus = 'rejected';
    booking.cancellationReason = cancellationReason || 'Rejected by provider';
    booking.cancelledBy = 'provider';
    booking.cancelledAt = new Date();

    if (booking.paymentIntentId) {
      try {
        const stripe = getStripe();
        await stripe.paymentIntents.cancel(booking.paymentIntentId);
        booking.paymentIntentStatus = 'canceled';
      } catch (stripeError) {
        console.error('Stripe cancel error:', stripeError);
      }
    }
    await booking.save();

    // Populate for response
    await booking.populate('user', 'fullName email phoneNumber profilePicture');

    res.status(200).json({
      success: true,
      message: 'Booking rejected successfully',
      data: booking
    });

  } catch (error) {
    console.error('Reject booking error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error rejecting booking'
    });
  }
};

/**
 * @desc    Mark booking as in progress
 * @route   PATCH /api/providers/bookings/:id/start
 * @access  Private (Provider)
 */
exports.startBooking = async (req, res) => {
  try {
    const provider = await getProviderFromUser(req.user._id);

    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if booking belongs to this provider
    if (booking.providerId.toString() !== provider._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to manage this booking'
      });
    }

    // Check if booking is confirmed
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
    console.error('Start booking error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error starting booking'
    });
  }
};

/**
 * @desc    Mark booking as completed
 * @route   PATCH /api/providers/bookings/:id/complete
 * @access  Private (Provider)
 */
exports.completeBooking = async (req, res) => {
  try {
    const provider = await getProviderFromUser(req.user._id);

    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if booking belongs to this provider
    if (booking.providerId.toString() !== provider._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to manage this booking'
      });
    }

    // Check if booking can be completed
    if (!['confirmed', 'in_progress'].includes(booking.bookingStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot complete a ${booking.bookingStatus} booking`
      });
    }

    booking.bookingStatus = 'completed';
    booking.completedAt = new Date();
    await booking.save();

    // Update provider's completed jobs count
    provider.completedJobs += 1;
    await provider.save();

    res.status(200).json({
      success: true,
      message: 'Booking completed successfully',
      data: booking
    });

  } catch (error) {
    console.error('Complete booking error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error completing booking'
    });
  }
};

// ==================== APPOINTMENT MANAGEMENT ====================

/**
 * @desc    Get all appointments for provider's services
 * @route   GET /api/providers/appointments
 * @access  Private (Provider)
 */
exports.getProviderAppointments = async (req, res) => {
  try {
    const provider = await getProviderFromUser(req.user._id);
    const { status, date, page = 1, limit = 10 } = req.query;

    // Build query
    const query = { providerId: provider._id };
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

    // Pagination
    const skip = (page - 1) * limit;

    const appointments = await Appointment.find(query)
      .select('-downPayment')
      .populate('user', 'fullName email phoneNumber profilePicture location')
      .populate('service')
      .sort({ appointmentDate: 1, 'timeSlot.startTime': 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Appointment.countDocuments(query);

    const appointmentsWithAddress = appointments.map((appointment) => {
      const obj = appointment.toObject ? appointment.toObject() : appointment;
      if (obj.user && obj.user.location) {
        obj.user.address = obj.user.location.address || '';
      }
      return obj;
    });

    res.status(200).json({
      success: true,
      count: appointmentsWithAddress.length,
      total,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      data: appointmentsWithAddress
    });

  } catch (error) {
    console.error('Get provider appointments error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching appointments'
    });
  }
};

/**
 * @desc    Get single appointment details
 * @route   GET /api/providers/appointments/:id
 * @access  Private (Provider)
 */
exports.getAppointmentDetails = async (req, res) => {
  try {
    const provider = await getProviderFromUser(req.user._id);

    const appointment = await Appointment.findById(req.params.id)
      .select('-downPayment')
      .populate('user', 'fullName email phoneNumber profilePicture')
      .populate('service');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Check if appointment belongs to this provider
    if (appointment.providerId.toString() !== provider._id.toString()) {
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
    console.error('Get appointment details error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching appointment details'
    });
  }
};

/**
 * @desc    Accept/Confirm an appointment request
 * @route   PATCH /api/providers/appointments/:id/accept
 * @access  Private (Provider)
 */
exports.acceptAppointment = async (req, res) => {
  try {
    const provider = await getProviderFromUser(req.user._id);
    const { providerNotes } = req.body;

    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Check if appointment belongs to this provider
    if (appointment.providerId.toString() !== provider._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to manage this appointment'
      });
    }

    // Check if appointment is in pending status
    if (appointment.appointmentStatus !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot accept a ${appointment.appointmentStatus} appointment`
      });
    }

    // Update appointment status
    appointment.appointmentStatus = 'confirmed';
    if (providerNotes) {
      appointment.providerNotes = providerNotes;
    }
    await appointment.save();

    let sessionUrl = null;
    try {
      const successUrl = process.env.STRIPE_CHECKOUT_SUCCESS_URL;
      const cancelUrl = process.env.STRIPE_CHECKOUT_CANCEL_URL;
      if (!successUrl || !cancelUrl) {
        return res.status(500).json({
          success: false,
          message: 'Stripe checkout URLs not configured'
        });
      }

      const totalAmount = appointment.totalAmount;
      const platformFee = Math.round(totalAmount * 0.1 * 100) / 100;
      const providerPayoutFromPayment = Math.max(totalAmount - platformFee, 0);
      appointment.platformFee = platformFee;
      appointment.providerPayoutFromPayment = providerPayoutFromPayment;

      const stripe = getStripe();
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'usd',
              unit_amount: Math.round(totalAmount * 100),
              product_data: {
                name: appointment.serviceSnapshot?.serviceName || 'Service appointment payment'
              }
            }
          }
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          appointmentId: appointment._id.toString(),
          userId: appointment.userId.toString(),
          providerId: appointment.providerId.toString(),
          type: 'appointment_full_payment'
        }
      });

      appointment.paymentIntentId = session.payment_intent || appointment.paymentIntentId;
      appointment.paymentIntentStatus = 'requires_payment_method';
      appointment.checkoutSessionId = session.id;
      appointment.checkoutSessionUrl = session.url;
      await appointment.save();

      sessionUrl = session.url;
    } catch (stripeError) {
      console.error('Stripe checkout session error:', stripeError);
      return res.status(500).json({
        success: false,
        message: 'Failed to create checkout session',
        error: stripeError.message
      });
    }

    // Populate for response
    await appointment.populate('user', 'fullName email phoneNumber profilePicture');

    res.status(200).json({
      success: true,
      message: 'Appointment accepted successfully',
      data: {
        appointment,
        checkout: {
          sessionUrl
        }
      }
    });

    if (sessionUrl) {
      await createAndSend({
        userId: appointment.userId,
        userType: 'user',
        title: 'Appointment accepted',
        body: 'Your appointment was accepted. Please complete the payment.',
        type: 'appointment_payment',
        entityType: 'appointment',
        entityId: appointment._id,
        metadata: { sessionUrl },
        data: {
          appointmentId: appointment._id.toString(),
          sessionUrl
        }
      });
    }

  } catch (error) {
    console.error('Accept appointment error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error accepting appointment'
    });
  }
};

/**
 * @desc    Reject/Cancel an appointment request
 * @route   PATCH /api/providers/appointments/:id/reject
 * @access  Private (Provider)
 */
exports.rejectAppointment = async (req, res) => {
  try {
    const provider = await getProviderFromUser(req.user._id);
    const { cancellationReason } = req.body;

    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Check if appointment belongs to this provider
    if (appointment.providerId.toString() !== provider._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to manage this appointment'
      });
    }

    // Check if appointment can be rejected
    if (['completed', 'cancelled', 'rejected'].includes(appointment.appointmentStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot reject a ${appointment.appointmentStatus} appointment`
      });
    }

    // Update appointment status
    appointment.appointmentStatus = 'rejected';
    appointment.cancellationReason = cancellationReason || 'Rejected by provider';
    appointment.cancelledBy = 'provider';
    appointment.cancelledAt = new Date();
    await appointment.save();

    // Populate for response
    await appointment.populate('user', 'fullName email phoneNumber profilePicture');

    res.status(200).json({
      success: true,
      message: 'Appointment rejected successfully',
      data: appointment
    });

  } catch (error) {
    console.error('Reject appointment error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error rejecting appointment'
    });
  }
};

/**
 * @desc    Reschedule an appointment
 * @route   PATCH /api/providers/appointments/:id/reschedule
 * @access  Private (Provider)
 */
exports.rescheduleAppointment = async (req, res) => {
  try {
    const provider = await getProviderFromUser(req.user._id);
    const { appointmentDate, timeSlot, providerNotes } = req.body;

    // Validate required fields
    if (!appointmentDate || !timeSlot) {
      return res.status(400).json({
        success: false,
        message: 'Please provide appointmentDate and timeSlot'
      });
    }

    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Check if appointment belongs to this provider
    if (appointment.providerId.toString() !== provider._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to manage this appointment'
      });
    }

    // Check if appointment can be rescheduled
    if (['completed', 'cancelled', 'rejected', 'no_show'].includes(appointment.appointmentStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot reschedule a ${appointment.appointmentStatus} appointment`
      });
    }

    // Store old values for reference
    const oldDate = appointment.appointmentDate;
    const oldTimeSlot = { ...appointment.timeSlot };

    // Update appointment with new schedule
    appointment.appointmentDate = new Date(appointmentDate);
    appointment.timeSlot = {
      startTime: timeSlot.startTime,
      endTime: timeSlot.endTime
    };

    // Check for time conflicts with the new schedule
    const hasConflict = await appointment.hasTimeConflict();
    if (hasConflict) {
      return res.status(409).json({
        success: false,
        message: 'The new time slot conflicts with another appointment. Please choose a different time.'
      });
    }

    // Add provider notes about rescheduling
    const rescheduleNote = `Rescheduled by provider from ${oldDate.toLocaleDateString()} (${oldTimeSlot.startTime}-${oldTimeSlot.endTime}) to ${appointment.appointmentDate.toLocaleDateString()} (${timeSlot.startTime}-${timeSlot.endTime})`;
    appointment.providerNotes = providerNotes
      ? `${providerNotes}\n\n${rescheduleNote}`
      : rescheduleNote;

    // Keep status as confirmed if it was, otherwise set to pending for user review
    if (appointment.appointmentStatus === 'pending') {
      appointment.appointmentStatus = 'pending';
    }

    await appointment.save();

    // Populate for response
    await appointment.populate('user', 'fullName email phoneNumber profilePicture');

    res.status(200).json({
      success: true,
      message: 'Appointment rescheduled successfully',
      data: appointment
    });

  } catch (error) {
    console.error('Reschedule appointment error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error rescheduling appointment'
    });
  }
};

/**
 * @desc    Mark appointment as in progress
 * @route   PATCH /api/providers/appointments/:id/start
 * @access  Private (Provider)
 */
exports.startAppointment = async (req, res) => {
  try {
    const provider = await getProviderFromUser(req.user._id);

    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Check if appointment belongs to this provider
    if (appointment.providerId.toString() !== provider._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to manage this appointment'
      });
    }

    // Check if appointment is confirmed
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
    console.error('Start appointment error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error starting appointment'
    });
  }
};

/**
 * @desc    Mark appointment as completed
 * @route   PATCH /api/providers/appointments/:id/complete
 * @access  Private (Provider)
 */
exports.completeAppointment = async (req, res) => {
  try {
    const provider = await getProviderFromUser(req.user._id);

    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Check if appointment belongs to this provider
    if (appointment.providerId.toString() !== provider._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to manage this appointment'
      });
    }

    // Check if appointment can be completed
    if (!['confirmed', 'in_progress'].includes(appointment.appointmentStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot complete a ${appointment.appointmentStatus} appointment`
      });
    }

    appointment.appointmentStatus = 'completed';
    appointment.completedAt = new Date();
    await appointment.save();

    // Update provider's completed jobs count
    provider.completedJobs += 1;
    await provider.save();

    res.status(200).json({
      success: true,
      message: 'Appointment completed successfully',
      data: appointment
    });

  } catch (error) {
    console.error('Complete appointment error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error completing appointment'
    });
  }
};

/**
 * @desc    Mark user as no-show for appointment
 * @route   PATCH /api/providers/appointments/:id/no-show
 * @access  Private (Provider)
 */
exports.markNoShow = async (req, res) => {
  try {
    const provider = await getProviderFromUser(req.user._id);

    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Check if appointment belongs to this provider
    if (appointment.providerId.toString() !== provider._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to manage this appointment'
      });
    }

    // Check if appointment was confirmed
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
    console.error('Mark no-show error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error marking no-show'
    });
  }
};

/**
 * @desc    Get provider's booking/appointment statistics
 * @route   GET /api/providers/stats
 * @access  Private (Provider)
 */
exports.getProviderStats = async (req, res) => {
  try {
    const provider = await getProviderFromUser(req.user._id);

    // Get booking stats
    const bookingStats = await Booking.aggregate([
      { $match: { providerId: provider._id } },
      {
        $group: {
          _id: '$bookingStatus',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);

    // Get appointment stats
    const appointmentStats = await Appointment.aggregate([
      { $match: { providerId: provider._id } },
      {
        $group: {
          _id: '$appointmentStatus',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);

    // Get today's appointments
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayAppointments = await Appointment.countDocuments({
      providerId: provider._id,
      appointmentDate: { $gte: today, $lt: tomorrow },
      appointmentStatus: { $in: ['pending', 'confirmed'] }
    });

    // Get pending requests
    const pendingBookings = await Booking.countDocuments({
      providerId: provider._id,
      bookingStatus: 'pending'
    });

    const pendingAppointments = await Appointment.countDocuments({
      providerId: provider._id,
      appointmentStatus: 'pending'
    });

    // Month range for stats
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const startOfNextMonth = new Date(startOfMonth);
    startOfNextMonth.setMonth(startOfNextMonth.getMonth() + 1);

    // Total orders (bookings + appointments)
    const totalBookingsCount = await Booking.countDocuments({ providerId: provider._id });
    const totalAppointmentsCount = await Appointment.countDocuments({ providerId: provider._id });

    const completedBookingsCount = await Booking.countDocuments({
      providerId: provider._id,
      bookingStatus: 'completed'
    });
    const completedAppointmentsCount = await Appointment.countDocuments({
      providerId: provider._id,
      appointmentStatus: 'completed'
    });

    const cancelledBookingsCount = await Booking.countDocuments({
      providerId: provider._id,
      bookingStatus: 'cancelled'
    });
    const cancelledAppointmentsCount = await Appointment.countDocuments({
      providerId: provider._id,
      appointmentStatus: 'cancelled'
    });

    const monthlyBookingsCount = await Booking.countDocuments({
      providerId: provider._id,
      createdAt: { $gte: startOfMonth, $lt: startOfNextMonth }
    });
    const monthlyAppointmentsCount = await Appointment.countDocuments({
      providerId: provider._id,
      createdAt: { $gte: startOfMonth, $lt: startOfNextMonth }
    });

    // Income (completed or offline paid)
    const paymentMatch = { $in: ['completed', 'offline_paid'] };

    const totalBookingIncome = await Booking.aggregate([
      { $match: { providerId: provider._id, paymentStatus: paymentMatch } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    const totalAppointmentIncome = await Appointment.aggregate([
      { $match: { providerId: provider._id, paymentStatus: paymentMatch } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    const monthlyBookingIncome = await Booking.aggregate([
      {
        $match: {
          providerId: provider._id,
          paymentStatus: paymentMatch,
          createdAt: { $gte: startOfMonth, $lt: startOfNextMonth }
        }
      },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    const monthlyAppointmentIncome = await Appointment.aggregate([
      {
        $match: {
          providerId: provider._id,
          paymentStatus: paymentMatch,
          createdAt: { $gte: startOfMonth, $lt: startOfNextMonth }
        }
      },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        profileStats: {
          myOrders: {
            total: totalBookingsCount + totalAppointmentsCount,
            thisMonth: monthlyBookingsCount + monthlyAppointmentsCount
          },
          totalIncome: {
            total:
              (totalBookingIncome[0]?.total || 0) +
              (totalAppointmentIncome[0]?.total || 0),
            thisMonth:
              (monthlyBookingIncome[0]?.total || 0) +
              (monthlyAppointmentIncome[0]?.total || 0)
          }
        },
        homeStats: {
          totalServiceAndAppointmentBooking: totalBookingsCount + totalAppointmentsCount,
          completedServiceAndAppointmentBooking: completedBookingsCount + completedAppointmentsCount,
          cancelledServiceAndAppointmentBooking: cancelledBookingsCount + cancelledAppointmentsCount
        },
        bookingStats,
        appointmentStats,
        todayAppointments,
        pendingRequests: {
          bookings: pendingBookings,
          appointments: pendingAppointments,
          total: pendingBookings + pendingAppointments
        },
        orders: {
          total: totalBookingsCount + totalAppointmentsCount,
          thisMonth: monthlyBookingsCount + monthlyAppointmentsCount
        },
        income: {
          total:
            (totalBookingIncome[0]?.total || 0) +
            (totalAppointmentIncome[0]?.total || 0),
          thisMonth:
            (monthlyBookingIncome[0]?.total || 0) +
            (monthlyAppointmentIncome[0]?.total || 0)
        },
        completedJobs: provider.completedJobs,
        rating: provider.rating,
        totalReviews: provider.totalReviews
      }
    });

  } catch (error) {
    console.error('Get provider stats error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching statistics'
    });
  }
};

/**
 * @desc    Request due payment for a completed booking (provider)
 * @route   POST /api/providers/bookings/:id/request-due
 * @access  Private (Provider)
 */
exports.requestDuePayment = async (req, res) => {
  try {
    const provider = await getProviderFromUser(req.user._id);
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.providerId.toString() !== provider._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    if (booking.bookingStatus !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Booking must be completed to request due payment'
      });
    }

    if (booking.paymentStatus === 'completed' || booking.paymentStatus === 'offline_paid') {
      return res.status(400).json({
        success: false,
        message: 'Booking already paid'
      });
    }

    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(booking.dueAmount * 100),
      currency: 'usd',
      metadata: {
        bookingId: booking._id.toString(),
        userId: booking.userId.toString(),
        providerId: booking.providerId.toString(),
        type: 'booking_due_payment'
      }
    });

    booking.duePaymentIntentId = paymentIntent.id;
    booking.duePaymentIntentStatus = paymentIntent.status;
    booking.paymentStatus = 'due_requested';
    booking.dueRequestedAt = new Date();
    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Due payment requested',
      data: {
        bookingId: booking._id,
        dueAmount: booking.dueAmount,
        clientSecret: paymentIntent.client_secret
      }
    });
  } catch (error) {
    console.error('Request due payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error requesting due payment',
      error: error.message
    });
  }
};

/**
 * @desc    Mark due payment as paid offline (provider)
 * @route   POST /api/providers/bookings/:id/mark-offline-paid
 * @access  Private (Provider)
 */
exports.markOfflinePaid = async (req, res) => {
  try {
    const provider = await getProviderFromUser(req.user._id);
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.providerId.toString() !== provider._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    if (booking.bookingStatus !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Booking must be completed to mark offline payment'
      });
    }

    booking.paymentStatus = 'offline_paid';
    booking.paidVia = 'offline';
    booking.offlinePaidAt = new Date();
    booking.remainingAmount = 0;
    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Marked as paid offline',
      data: {
        booking,
        checkout: {
          sessionUrl
        }
      }
    });
  } catch (error) {
    console.error('Mark offline paid error:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking offline payment',
      error: error.message
    });
  }
};
