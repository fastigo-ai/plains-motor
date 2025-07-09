import mongoose from 'mongoose';

const bookedSchema = new mongoose.Schema({
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'propertyCard',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  checkInDate: {
    type: Date,
    required: true,
  },
  checkOutDate: {
    type: Date,
    required: true,
  },
  totalStay: {
    type: Number,
    required: true,
    min: 1,
  },
  guests: {
    adults: {
      type: Number,
      required: true,
      min: 1,
    },
    children: {
      type: Number,
      default: 0,
      min: 0,
    },
    infants: {
      type: Number,
      default: 0,
      min: 0,
    },
    pets: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  specialRequest: {
    type: String,
    trim: true,
    maxlength: 500,
    default: ''
  },
  bookingStatus: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed'],
    default: 'pending'
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  // Optional: Link to payment if using the payment system
  payment: {
    paymentIntentId: {
      type: String,
      default: null
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'succeeded', 'failed'],
      default: 'pending'
    }
  }
}, { timestamps: true });

// Index for efficient queries
bookedSchema.index({ userId: 1 });
bookedSchema.index({ property: 1 });
bookedSchema.index({ checkInDate: 1, checkOutDate: 1 });

export default mongoose.model('Booked', bookedSchema);
