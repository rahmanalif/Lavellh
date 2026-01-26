const { getStripe } = require('../utility/stripe');
const Booking = require('../models/Booking');

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
      case 'payment_intent.amount_capturable_updated': {
        const booking =
          await Booking.findOne({ paymentIntentId: data.id }) ||
          (data.metadata?.bookingId ? await Booking.findById(data.metadata.bookingId) : null);
        if (booking) {
          booking.paymentIntentId = data.id;
          booking.paymentIntentStatus = data.status;
          booking.paymentStatus = 'authorized';
          await booking.save();
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
        const dueBooking = await Booking.findOne({ duePaymentIntentId: data.id });
        if (dueBooking) {
          dueBooking.duePaymentIntentStatus = data.status;
          await dueBooking.save();
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
        const dueBooking = await Booking.findOne({ duePaymentIntentId: data.id });
        if (dueBooking) {
          dueBooking.duePaymentIntentStatus = 'canceled';
          await dueBooking.save();
          break;
        }
        const Appointment = require('../models/Appointment');
        const appointment =
          await Appointment.findOne({ paymentIntentId: data.id }) ||
          (data.metadata?.appointmentId ? await Appointment.findById(data.metadata.appointmentId) : null);
        if (appointment) {
          appointment.paymentIntentStatus = 'canceled';
          await appointment.save();
        }
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
