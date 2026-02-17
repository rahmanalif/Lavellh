const { getStripe } = require('../utility/stripe');
const Booking = require('../models/Booking');
const BusinessOwnerBooking = require('../models/BusinessOwnerBooking');
const BusinessOwnerAppointment = require('../models/BusinessOwnerAppointment');
const EventTicketPurchase = require('../models/EventTicketPurchase');
const Event = require('../models/Event');
const PaymentRefundLog = require('../models/PaymentRefundLog');

const normalizeRefundStatus = (status) => {
  const allowed = ['requested', 'pending', 'succeeded', 'failed', 'canceled', 'requires_action'];
  if (allowed.includes(status)) return status;
  return 'pending';
};

const syncRefundLogFromStripe = async (refund) => {
  if (!refund?.id) return;

  let refundLog = await PaymentRefundLog.findOne({ refundId: refund.id });

  // Fallback: if refundId was not set yet, attach this Stripe refund to the newest pending/requested log for the same payment intent.
  if (!refundLog && refund.payment_intent) {
    refundLog = await PaymentRefundLog.findOne({
      paymentIntentId: refund.payment_intent,
      refundId: null,
      status: { $in: ['requested', 'pending', 'requires_action'] }
    }).sort({ createdAt: -1 });
  }

  if (!refundLog) return;

  refundLog.refundId = refund.id;
  refundLog.status = normalizeRefundStatus(refund.status);
  refundLog.stripeError = refund.failure_reason || null;
  refundLog.metadata = {
    ...(refundLog.metadata || {}),
    stripeRefundStatus: refund.status || null,
    chargeId: refund.charge || null,
    receiptNumber: refund.receipt_number || null
  };
  await refundLog.save();
};

const handleStripeWebhook = async (req, res) => {
  let event;

  try {
    const stripe = getStripe();
    const signature = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Stripe webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    const data = event.data?.object;

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = data;
        const paymentIntentId = session.payment_intent;
        const paymentStatus = session.payment_status;

        if (session?.id) {
          const booking = await Booking.findOne({ checkoutSessionId: session.id });
          if (booking) {
            if (paymentIntentId) booking.paymentIntentId = paymentIntentId;
            if (paymentStatus === 'paid') {
              booking.paymentIntentStatus = 'succeeded';
              booking.paymentStatus = 'partial';
            }
            await booking.save();
            break;
          }

          const boBooking = await BusinessOwnerBooking.findOne({ checkoutSessionId: session.id });
          if (boBooking) {
            if (paymentIntentId) boBooking.paymentIntentId = paymentIntentId;
            if (paymentStatus === 'paid') {
              boBooking.paymentIntentStatus = 'succeeded';
              boBooking.paymentStatus = 'partial';
            }
            await boBooking.save();
            break;
          }

          const Appointment = require('../models/Appointment');
          const appointment = await Appointment.findOne({ checkoutSessionId: session.id });
          if (appointment) {
            if (paymentIntentId) appointment.paymentIntentId = paymentIntentId;
            if (paymentStatus === 'paid') {
              appointment.paymentIntentStatus = 'succeeded';
              appointment.paymentStatus = 'completed';
              appointment.paidVia = 'online';
              appointment.paidAt = new Date();
              appointment.remainingAmount = 0;
            }
            await appointment.save();
            break;
          }

          const boAppointment = await BusinessOwnerAppointment.findOne({ checkoutSessionId: session.id });
          if (boAppointment) {
            if (paymentIntentId) boAppointment.paymentIntentId = paymentIntentId;
            if (paymentStatus === 'paid') {
              boAppointment.paymentIntentStatus = 'succeeded';
              boAppointment.paymentStatus = 'completed';
              boAppointment.paidVia = 'online';
              boAppointment.paidAt = new Date();
              boAppointment.remainingAmount = 0;
            }
            await boAppointment.save();
          }
        }
        break;
      }
      case 'payment_intent.amount_capturable_updated': {
        const booking =
          await Booking.findOne({ paymentIntentId: data.id }) ||
          (data.metadata?.bookingId ? await Booking.findById(data.metadata.bookingId) : null);
        if (booking) {
          booking.paymentIntentId = data.id;
          booking.paymentIntentStatus = data.status;
          booking.paymentStatus = 'authorized';
          await booking.save();
          break;
        }

        const boBooking =
          await BusinessOwnerBooking.findOne({ paymentIntentId: data.id }) ||
          (data.metadata?.businessOwnerBookingId ? await BusinessOwnerBooking.findById(data.metadata.businessOwnerBookingId) : null);
        if (boBooking) {
          boBooking.paymentIntentId = data.id;
          boBooking.paymentIntentStatus = data.status;
          boBooking.paymentStatus = 'authorized';
          await boBooking.save();
        }
        break;
      }
      case 'payment_intent.succeeded': {
        // Down payment capture succeeded
        const booking =
          await Booking.findOne({ paymentIntentId: data.id }) ||
          (data.metadata?.bookingId ? await Booking.findById(data.metadata.bookingId) : null);
        if (booking) {
          booking.paymentIntentId = data.id;
          booking.paymentIntentStatus = data.status;
          booking.paymentStatus = 'partial';
          await booking.save();
          break;
        }

        const boBooking =
          await BusinessOwnerBooking.findOne({ paymentIntentId: data.id }) ||
          (data.metadata?.businessOwnerBookingId ? await BusinessOwnerBooking.findById(data.metadata.businessOwnerBookingId) : null);
        if (boBooking) {
          boBooking.paymentIntentId = data.id;
          boBooking.paymentIntentStatus = data.status;
          boBooking.paymentStatus = 'partial';
          await boBooking.save();
          break;
        }

        // Due payment succeeded
        const dueBooking = await Booking.findOne({ duePaymentIntentId: data.id });
        if (dueBooking) {
          dueBooking.duePaymentIntentStatus = data.status;
          dueBooking.paymentStatus = 'completed';
          dueBooking.paidVia = 'online';
          dueBooking.duePaidAt = new Date();
          dueBooking.remainingAmount = 0;
          await dueBooking.save();
          break;
        }

        const dueBoBooking = await BusinessOwnerBooking.findOne({ duePaymentIntentId: data.id });
        if (dueBoBooking) {
          dueBoBooking.duePaymentIntentStatus = data.status;
          dueBoBooking.paymentStatus = 'completed';
          dueBoBooking.paidVia = 'online';
          dueBoBooking.duePaidAt = new Date();
          dueBoBooking.remainingAmount = 0;
          await dueBoBooking.save();
          break;
        }

        // Appointment payment succeeded
        const Appointment = require('../models/Appointment');
        const appointment =
          await Appointment.findOne({ paymentIntentId: data.id }) ||
          (data.metadata?.appointmentId ? await Appointment.findById(data.metadata.appointmentId) : null);
        if (appointment) {
          appointment.paymentIntentId = data.id;
          appointment.paymentIntentStatus = data.status;
          appointment.paymentStatus = 'completed';
          appointment.paidVia = 'online';
          appointment.paidAt = new Date();
          appointment.remainingAmount = 0;
          await appointment.save();
          break;
        }

        const boAppointment =
          await BusinessOwnerAppointment.findOne({ paymentIntentId: data.id }) ||
          (data.metadata?.businessOwnerAppointmentId ? await BusinessOwnerAppointment.findById(data.metadata.businessOwnerAppointmentId) : null);
        if (boAppointment) {
          boAppointment.paymentIntentId = data.id;
          boAppointment.paymentIntentStatus = data.status;
          boAppointment.paymentStatus = 'completed';
          boAppointment.paidVia = 'online';
          boAppointment.paidAt = new Date();
          boAppointment.remainingAmount = 0;
          await boAppointment.save();
        }

        const ticketPurchase =
          await EventTicketPurchase.findOne({ paymentIntentId: data.id }) ||
          (data.metadata?.eventTicketPurchaseId ? await EventTicketPurchase.findById(data.metadata.eventTicketPurchaseId) : null);
        if (ticketPurchase) {
          ticketPurchase.paymentIntentId = data.id;
          ticketPurchase.paymentIntentStatus = data.status;
          ticketPurchase.paymentStatus = 'completed';
          ticketPurchase.paidAt = new Date();
          await ticketPurchase.save();

          const event = await Event.findById(ticketPurchase.eventId);
          if (event) {
            event.ticketsSold += ticketPurchase.quantity;
            await event.save();
          }
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const booking =
          await Booking.findOne({ paymentIntentId: data.id }) ||
          (data.metadata?.bookingId ? await Booking.findById(data.metadata.bookingId) : null);
        if (booking) {
          booking.paymentIntentId = data.id;
          booking.paymentIntentStatus = data.status;
          await booking.save();
          break;
        }
        const boBooking =
          await BusinessOwnerBooking.findOne({ paymentIntentId: data.id }) ||
          (data.metadata?.businessOwnerBookingId ? await BusinessOwnerBooking.findById(data.metadata.businessOwnerBookingId) : null);
        if (boBooking) {
          boBooking.paymentIntentId = data.id;
          boBooking.paymentIntentStatus = data.status;
          await boBooking.save();
          break;
        }
        const dueBooking = await Booking.findOne({ duePaymentIntentId: data.id });
        if (dueBooking) {
          dueBooking.duePaymentIntentStatus = data.status;
          await dueBooking.save();
          break;
        }
        const dueBoBooking = await BusinessOwnerBooking.findOne({ duePaymentIntentId: data.id });
        if (dueBoBooking) {
          dueBoBooking.duePaymentIntentStatus = data.status;
          await dueBoBooking.save();
          break;
        }
        const Appointment = require('../models/Appointment');
        const appointment =
          await Appointment.findOne({ paymentIntentId: data.id }) ||
          (data.metadata?.appointmentId ? await Appointment.findById(data.metadata.appointmentId) : null);
        if (appointment) {
          appointment.paymentIntentId = data.id;
          appointment.paymentIntentStatus = data.status;
          await appointment.save();
          break;
        }
        const boAppointment =
          await BusinessOwnerAppointment.findOne({ paymentIntentId: data.id }) ||
          (data.metadata?.businessOwnerAppointmentId ? await BusinessOwnerAppointment.findById(data.metadata.businessOwnerAppointmentId) : null);
        if (boAppointment) {
          boAppointment.paymentIntentId = data.id;
          boAppointment.paymentIntentStatus = data.status;
          await boAppointment.save();
          break;
        }
        const ticketPurchase =
          await EventTicketPurchase.findOne({ paymentIntentId: data.id }) ||
          (data.metadata?.eventTicketPurchaseId ? await EventTicketPurchase.findById(data.metadata.eventTicketPurchaseId) : null);
        if (ticketPurchase) {
          ticketPurchase.paymentIntentStatus = data.status;
          ticketPurchase.paymentStatus = 'failed';
          await ticketPurchase.save();
        }
        break;
      }
      case 'payment_intent.canceled': {
        const booking = await Booking.findOne({ paymentIntentId: data.id });
        if (booking) {
          booking.paymentIntentStatus = 'canceled';
          await booking.save();
          break;
        }
        const boBooking = await BusinessOwnerBooking.findOne({ paymentIntentId: data.id });
        if (boBooking) {
          boBooking.paymentIntentStatus = 'canceled';
          await boBooking.save();
          break;
        }
        const dueBooking = await Booking.findOne({ duePaymentIntentId: data.id });
        if (dueBooking) {
          dueBooking.duePaymentIntentStatus = 'canceled';
          await dueBooking.save();
          break;
        }
        const dueBoBooking = await BusinessOwnerBooking.findOne({ duePaymentIntentId: data.id });
        if (dueBoBooking) {
          dueBoBooking.duePaymentIntentStatus = 'canceled';
          await dueBoBooking.save();
          break;
        }
        const Appointment = require('../models/Appointment');
        const appointment =
          await Appointment.findOne({ paymentIntentId: data.id }) ||
          (data.metadata?.appointmentId ? await Appointment.findById(data.metadata.appointmentId) : null);
        if (appointment) {
          appointment.paymentIntentStatus = 'canceled';
          await appointment.save();
          break;
        }
        const boAppointment =
          await BusinessOwnerAppointment.findOne({ paymentIntentId: data.id }) ||
          (data.metadata?.businessOwnerAppointmentId ? await BusinessOwnerAppointment.findById(data.metadata.businessOwnerAppointmentId) : null);
        if (boAppointment) {
          boAppointment.paymentIntentStatus = 'canceled';
          await boAppointment.save();
          break;
        }
        const ticketPurchase =
          await EventTicketPurchase.findOne({ paymentIntentId: data.id }) ||
          (data.metadata?.eventTicketPurchaseId ? await EventTicketPurchase.findById(data.metadata.eventTicketPurchaseId) : null);
        if (ticketPurchase) {
          ticketPurchase.paymentIntentStatus = 'canceled';
          ticketPurchase.paymentStatus = 'failed';
          await ticketPurchase.save();
        }
        break;
      }
      case 'refund.updated': {
        await syncRefundLogFromStripe(data);
        break;
      }
      default:
        break;
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook handler error:', error);
    res.status(500).json({ received: false });
  }
};

module.exports = { handleStripeWebhook };
