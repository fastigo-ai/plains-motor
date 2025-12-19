import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
  // Order identification
  orderId: {
    type: String,
    required: true,
    unique: true,
    default: () => `ORDER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  },
  
  // Property reference
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'propertyCard',
    required: true
  },
  
  // Customer information
  customer: {
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: true
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String
    }
  },
  
  // Booking details
  booking: {
    checkIn: {
      type: Date,
      required: true
    },
    checkOut: {
      type: Date,
      required: true
    },
    guests: {
      type: Number,
      required: true,
      min: 1
    },
    nights: {
      type: Number,
      required: true
    },
    rooms: {
      type: Number,
      required: true,
      min: 1
    },
    roomType: {
      type: String,
      enum: ['single', 'double'],
      required: true
    },
    specialRequest: {
      type: String,
      default: ''
    }
  },
  
  // Payment information
  payment: {
    amount: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      required: true,
      default: 'usd'
    },
    stripePaymentIntentId: {
      type: String,
      default: ''
    },
    stripePaymentStatus: {
      type: String,
      enum: ['pending', 'succeeded', 'failed', 'canceled','cod_paid','cod_pending','payment_pending',],
      default: 'pending'
    },
    paymentMethod: {
      type: String,
      default: 'card'
    }
  },
  
  // Order status
  status: {
    type: String,
    enum: [
      'pending',
      'paid',
      'cod_pending',
      'failed',
      'refunded',
      'cancelled',
      'confirmed',
      'payment_pending',
    ],
    default: 'pending'
  },
  
  // Booking reference
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booked',
    required: true
  },
  
  // Additional details
  notes: {
    type: String,
    default: ''
  },
  
  // Metadata
  metadata: {
    type: Map,
    of: String,
    default: {}
  }
}, {
  timestamps: true
});

export default mongoose.model('Order', orderSchema);