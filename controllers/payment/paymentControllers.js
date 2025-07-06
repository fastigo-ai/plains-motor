import stripe from '../../config/stripe.js';
import Order from '../../modals/payment/orderSchema.js';
import Payment from '../../modals/payment/paymentSchema.js';
import PropertyCard from '../../modals/properties/propertyModal.js';// Your existing model

// Create Payment Intent
export const createPaymentIntent = async (req, res) => {
  try {
    const {
      propertyId,
      customer,
      booking,
      amount,
      currency = 'usd'
    } = req.body;

    // Validate property exists
    const property = await PropertyCard.findById(propertyId);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    // Calculate nights
    const checkIn = new Date(booking.checkIn);
    const checkOut = new Date(booking.checkOut);
    const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

    // Create order first
    const order = new Order({
      property: propertyId,
      customer,
      booking: {
        ...booking,
        nights
      },
      payment: {
        amount: amount * 100, // Convert to cents
        currency,
        stripePaymentIntentId: '', // Will be updated after creating payment intent
        stripePaymentStatus: 'pending'
      }
    });

    await order.save();

    // Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, // Amount in cents
      currency,
      metadata: {
        orderId: order._id.toString(),
        propertyId: propertyId,
        customerEmail: customer.email
      },
      automatic_payment_methods: {
        enabled: true
      }
    });

    // Update order with payment intent ID
    order.payment.stripePaymentIntentId = paymentIntent.id;
    await order.save();

    // Create payment record
    const payment = new Payment({
      paymentId: `PAY-${Date.now()}`,
      order: order._id,
      stripe: {
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        status: paymentIntent.status
      },
      amount: amount * 100,
      currency,
      netAmount: amount * 100,
      status: 'pending'
    });

    await payment.save();

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      orderId: order.orderId,
      paymentIntentId: paymentIntent.id
    });

  } catch (error) {
    console.error('Payment Intent creation error:', error);
    res.status(500).json({ 
      error: 'Failed to create payment intent',
      details: error.message 
    });
  }
};

// Confirm Payment
export const confirmPayment = async (req, res) => {
  try {
    const { paymentIntentId } = req.body;

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Update order status
    const order = await Order.findOne({ 
      'payment.stripePaymentIntentId': paymentIntentId 
    });

    if (order) {
      order.payment.stripePaymentStatus = paymentIntent.status;
      if (paymentIntent.status === 'succeeded') {
        order.status = 'confirmed';
      }
      await order.save();
    }

    // Update payment record
    const payment = await Payment.findOne({ 
      'stripe.paymentIntentId': paymentIntentId 
    });

    if (payment) {
      payment.stripe.status = paymentIntent.status;
      payment.status = paymentIntent.status === 'succeeded' ? 'succeeded' : 'failed';
      await payment.save();
    }

    res.json({
      success: true,
      status: paymentIntent.status,
      order: order
    });

  } catch (error) {
    console.error('Payment confirmation error:', error);
    res.status(500).json({ 
      error: 'Failed to confirm payment',
      details: error.message 
    });
  }
};

// Get Order Details
export const getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ orderId })
      .populate('property')
      .exec();

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({
      success: true,
      order
    });

  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch order details',
      details: error.message 
    });
  }
};

// ==================== WEBHOOK HANDLER ====================

// controllers/webhookController.js
import express from 'express';
import propertyModal from '../../modals/properties/propertyModal.js';

export const handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentSucceeded(event.data.object);
      break;
    
    case 'payment_intent.payment_failed':
      await handlePaymentFailed(event.data.object);
      break;
    
    case 'charge.succeeded':
      await handleChargeSucceeded(event.data.object);
      break;
    
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
};

const handlePaymentSucceeded = async (paymentIntent) => {
  try {
    // Update order
    const order = await Order.findOne({ 
      'payment.stripePaymentIntentId': paymentIntent.id 
    });
    
    if (order) {
      order.payment.stripePaymentStatus = 'succeeded';
      order.status = 'confirmed';
      await order.save();
    }

    // Update payment record
    const payment = await Payment.findOne({ 
      'stripe.paymentIntentId': paymentIntent.id 
    });
    
    if (payment) {
      payment.stripe.status = 'succeeded';
      payment.status = 'succeeded';
      await payment.save();
    }

    console.log('Payment succeeded:', paymentIntent.id);
  } catch (error) {
    console.error('Error handling payment success:', error);
  }
};

const handlePaymentFailed = async (paymentIntent) => {
  try {
    // Update order
    const order = await Order.findOne({ 
      'payment.stripePaymentIntentId': paymentIntent.id 
    });
    
    if (order) {
      order.payment.stripePaymentStatus = 'failed';
      order.status = 'cancelled';
      await order.save();
    }

    // Update payment record
    const payment = await Payment.findOne({ 
      'stripe.paymentIntentId': paymentIntent.id 
    });
    
    if (payment) {
      payment.stripe.status = 'failed';
      payment.status = 'failed';
      await payment.save();
    }

    console.log('Payment failed:', paymentIntent.id);
  } catch (error) {
    console.error('Error handling payment failure:', error);
  }
};

const handleChargeSucceeded = async (charge) => {
  try {
    const payment = await Payment.findOne({ 
      'stripe.paymentIntentId': charge.payment_intent 
    });
    
    if (payment) {
      payment.stripe.charges.push({
        chargeId: charge.id,
        amount: charge.amount,
        status: charge.status,
        receiptUrl: charge.receipt_url,
        created: new Date(charge.created * 1000)
      });
      await payment.save();
    }

    console.log('Charge succeeded:', charge.id);
  } catch (error) {
    console.error('Error handling charge success:', error);
  }
};