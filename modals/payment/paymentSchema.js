import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  // Payment identification
  paymentId: {
    type: String,
    required: true,
    unique: true
  },
  
  // Order reference
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  
  // Booking reference
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booked',
    required: true
  },
  
  // Stripe details
  stripe: {
    paymentIntentId: {
      type: String,
      required: true,
      unique: true
    },
    clientSecret: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['requires_payment_method', 'requires_confirmation', 'requires_action', 'processing', 'succeeded', 'cancelled'],
      required: true
    },
    charges: [{
      chargeId: String,
      amount: Number,
      status: String,
      receiptUrl: String,
      created: Date
    }]
  },
  
  // Payment details
  amount: {
    type: Number,
    required: true
  },
  
  currency: {
    type: String,
    required: true,
    default: 'usd'
  },
  
  // Transaction details
  transactionFee: {
    type: Number,
    default: 0
  },
  
  netAmount: {
    type: Number,
    required: true
  },
  
  // Payment method details
  paymentMethod: {
    type: {
      type: String,
      enum: ['card', 'bank_transfer', 'digital_wallet'],
      default: 'card'
    },
    last4: String,
    brand: String,
    expMonth: Number,
    expYear: Number
  },
  
  // Status tracking
  status: {
    type: String,
    enum: ['pending', 'processing', 'succeeded', 'failed', 'refunded', 'partially_refunded'],
    default: 'pending'
  },
  
  // Refund information
  refunds: [{
    refundId: String,
    amount: Number,
    reason: String,
    status: String,
    created: Date
  }],
  
  // Additional metadata
  metadata: {
    type: Map,
    of: String,
    default: {}
  }
}, {
  timestamps: true
});


// Indexes

export default mongoose.model('Payment', paymentSchema);