import express from 'express';
import {
  createCheckoutSession,
  handleStripeWebhook,
  getBookingDetails,
  getUserBookings
} from '../../controllers/payment/paymentControllers.js';

const router = express.Router();

// Middleware for webhook (raw body needed)
const webhookMiddleware = (req, res, next) => {
  if (req.originalUrl === '/api/payments/webhook') {
    next();
  } else {
    express.json()(req, res, next);
  }
};

// Routes
router.post('/create-checkout-session', createCheckoutSession);
router.post('/webhook', handleStripeWebhook);
router.get('/booking-details/:sessionId', getBookingDetails);
router.get('/user-bookings/:userId', getUserBookings);

export default router;