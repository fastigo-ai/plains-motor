import express from 'express';

import { confirmPayment, createPaymentIntent, getOrderDetails, handleStripeWebhook } from '../../controllers/payment/paymentControllers.js';

const router = express.Router();

// Payment routes
router.post('/create-payment-intent', createPaymentIntent);
router.post('/confirm-payment', confirmPayment);
router.get('/order/:orderId', getOrderDetails);

// Webhook route (must be raw body)
router.post('/webhook', 
  express.raw({ type: 'application/json' }), 
  handleStripeWebhook
);

export default router;