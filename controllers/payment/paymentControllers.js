// controllers/bookingController.js
import Order from '../../modals/payment/orderSchema.js';
import Payment from '../../modals/payment/paymentSchema.js';
import stripe from '../../config/stripe.js';
import mongoose from 'mongoose';
import { User } from '../../modals/auth/authModal.js';
import Booked from '../../modals/properties/bookedSchema.js';
import PropertyCard from '../../modals/properties/propertyModal.js';



// Create Stripe Checkout Session
export const createCheckoutSession = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      propertyId,
      userId,
      checkInDate,
      checkOutDate,
      totalStay,
      guests,
      specialRequest = '',
      user: { firstname, lastname, phone },
      totalAmount,
      currency = 'usd'
    } = req.body;

    // Validate required fields
    if (!propertyId || !userId || !checkInDate || !checkOutDate || !totalStay || !guests || !totalAmount) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Validate property exists and is in stock
    const property = await PropertyCard.findById(propertyId).session(session);
    if (!property) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    if (!property.inStock) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Property is not available for booking'
      });
    }

    // Validate user exists
    const existingUser = await User.findById(userId).session(session);
    if (!existingUser) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update user information if provided
    if (firstname || lastname || phone) {
      const updateData = {};
      if (firstname) updateData.firstname = firstname;
      if (lastname) updateData.lastname = lastname;
      if (phone) updateData.mobile = phone;

      await User.findByIdAndUpdate(
        userId,
        updateData,
        { session, runValidators: true }
      );
    }

    // Validate dates
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (checkIn < today) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Check-in date cannot be in the past'
      });
    }

    if (checkOut <= checkIn) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Check-out date must be after check-in date'
      });
    }

    // Check for existing bookings (prevent double booking)
    const existingBooking = await Booked.findOne({
      property: propertyId,
      $or: [
        {
          checkInDate: { $lt: checkOut },
          checkOutDate: { $gt: checkIn }
        }
      ],
      bookingStatus: { $in: ['pending', 'confirmed'] }
    }).session(session);

    if (existingBooking) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Property is already booked for selected dates'
      });
    }

    // Create booking first
    const booking = new Booked({
      property: propertyId,
      userId,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      totalStay,
      guests: {
        adults: guests.adults,
        children: guests.children || 0,
        infants: guests.infants || 0,
        pets: guests.pets || 0
      },
      specialRequest,
      totalAmount,
      bookingStatus: 'pending'
    });

    const savedBooking = await booking.save({ session });

    // Create order
    const order = new Order({
      property: propertyId,
      customer: {
        name: `${firstname || existingUser.firstname} ${lastname || existingUser.lastname}`,
        email: existingUser.email,
        phone: phone || existingUser.mobile
      },
      booking: {
        checkIn: checkIn,
        checkOut: checkOut,
        guests: guests.adults + guests.children + guests.infants,
        nights: totalStay,
        specialRequest
      },
      payment: {
        amount: totalAmount * 100, // Convert to cents
        currency,
        stripePaymentIntentId: '', // Will be filled after checkout session
        stripePaymentStatus: 'pending'
      },
      bookingId: savedBooking._id
    });

    await order.save({ session });

    // Create Stripe Checkout Session
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: currency,
            product_data: {
              name: property.name,
              description: `${totalStay} night(s) stay - ${guests.adults} adults, ${guests.children || 0} children`,
              images: property.image ? [property.image] : [],
            },
            unit_amount: totalAmount * 100, // Amount in cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.CLIENT_URL}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/booking/cancel`,
      metadata: {
        orderId: order._id.toString(),
        bookingId: savedBooking._id.toString(),
        propertyId: propertyId,
        userId: userId,
      },
      customer_email: existingUser.email,
      billing_address_collection: 'required',
      phone_number_collection: {
        enabled: true,
      },
    });

    // Create payment record
    const payment = new Payment({
      paymentId: `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      order: order._id,
      stripe: {
        paymentIntentId: checkoutSession.id, // Using session ID temporarily
        clientSecret: checkoutSession.id,
        status: 'requires_payment_method'
      },
      amount: totalAmount * 100,
      currency,
      netAmount: totalAmount * 100,
      status: 'pending',
      bookingId: savedBooking._id
    });

    await payment.save({ session });

    // Update booking and order with session info
    savedBooking.payment = {
      paymentIntentId: checkoutSession.id,
      paymentStatus: 'pending'
    };
    await savedBooking.save({ session });

    order.payment.stripePaymentIntentId = checkoutSession.id;
    await order.save({ session });

    await session.commitTransaction();

    res.status(201).json({
      success: true,
      message: 'Checkout session created successfully',
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
      bookingId: savedBooking._id,
      orderId: order._id
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Checkout session creation error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate booking detected'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create checkout session',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

// Handle Stripe Webhook
export const handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.log(`Webhook signature verification failed.`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      await handleSuccessfulPayment(session);
      break;
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      await handlePaymentIntentSucceeded(paymentIntent);
      break;
    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      await handlePaymentFailed(failedPayment);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({received: true});
};

// Handle successful payment
const handleSuccessfulPayment = async (session) => {
  try {
    const { orderId, bookingId } = session.metadata;

    // Update booking status
    const booking = await Booked.findById(bookingId);
    if (booking) {
      booking.bookingStatus = 'confirmed';
      booking.payment.paymentStatus = 'succeeded';
      await booking.save();
    }

    // Update order status
    const order = await Order.findById(orderId);
    if (order) {
      order.status = 'confirmed';
      order.payment.stripePaymentStatus = 'succeeded';
      await order.save();
    }

    // Update payment record
    const payment = await Payment.findOne({ bookingId: bookingId });
    if (payment) {
      payment.status = 'succeeded';
      payment.stripe.status = 'succeeded';
      await payment.save();
    }

    console.log('Payment successful for booking:', bookingId);
  } catch (error) {
    console.error('Error handling successful payment:', error);
  }
};

// Handle payment intent succeeded
const handlePaymentIntentSucceeded = async (paymentIntent) => {
  try {
    // Additional logic if needed
    console.log('Payment intent succeeded:', paymentIntent.id);
  } catch (error) {
    console.error('Error handling payment intent succeeded:', error);
  }
};

// Handle payment failed
const handlePaymentFailed = async (failedPayment) => {
  try {
    // Find and update booking/order status
    const booking = await Booked.findOne({
      'payment.paymentIntentId': failedPayment.id
    });

    if (booking) {
      booking.bookingStatus = 'cancelled';
      booking.payment.paymentStatus = 'failed';
      await booking.save();
    }

    console.log('Payment failed for:', failedPayment.id);
  } catch (error) {
    console.error('Error handling payment failed:', error);
  }
};

// Get booking details after successful payment
export const getBookingDetails = async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Find booking by session ID
    const booking = await Booked.findOne({
      'payment.paymentIntentId': sessionId
    })
    .populate('property', 'name title price image')
    .populate('userId', 'firstname lastname email mobile');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Find order
    const order = await Order.findOne({
      'payment.stripePaymentIntentId': sessionId
    });

    res.json({
      success: true,
      booking,
      order,
      session: {
        id: session.id,
        payment_status: session.payment_status,
        amount_total: session.amount_total,
        currency: session.currency
      }
    });

  } catch (error) {
    console.error('Error fetching booking details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booking details',
      error: error.message
    });
  }
};

// Get all bookings for a user
export const getUserBookings = async (req, res) => {
  try {
    const { userId } = req.params;

    const bookings = await Booked.find({ userId })
      .populate('property', 'name title price image')
      .populate('userId', 'firstname lastname email mobile')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      bookings
    });

  } catch (error) {
    console.error('Error fetching user bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings',
      error: error.message
    });
  }
};