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
  roomDetails: {
    roomType: {
      type: String,
      enum: ['single', 'double'],
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    allowedPersonsPerRoom: {
      type: Number,
      required: true
    },
    extraPersons: {
      type: Number,
      default: 0
    },
    extraPersonCharge: {
      type: Number,
      default: 0
    },
    isSmokingAllowed: {
      type: Boolean,
      default: false
    },
    smokingRoomCharge: {
      type: Number,
      default: 0
    },
    isPetFriendly: {
      type: Boolean,
      default: false
    },
    pets: {
      type: Number,
      default: 0
    },
    petFeePerPet: {
      type: Number,
      default: 0
    }
  },
  guests: {
    adults: {
      type: Number,
      required: true,
      min: 1
    },
    children: {
      type: Number,
      default: 0,
      min: 0
    },
    infants: {
      type: Number,
      default: 0,
      min: 0
    }
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
  },
  // Add expiry field for TTL index
  expiresAt: {
    type: Date,
    default: function() {
      // Only set expiry for pending bookings
      if (this.bookingStatus === 'pending') {
        return new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
      }
      return null;
    }
  }
}, {
  timestamps: true
});

// TTL Index - MongoDB will automatically delete documents when expiresAt time is reached
bookedSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Pre-save middleware to handle expiry logic
bookedSchema.pre('save', function(next) {
  if (this.bookingStatus === 'pending' && this.isNew) {
    // Set expiry for new pending bookings
    this.expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  } else if (this.bookingStatus !== 'pending') {
    // Remove expiry for non-pending bookings
    this.expiresAt = null;
  }
  next();
});

// Method to extend booking expiry (useful if user is actively engaged)
bookedSchema.methods.extendExpiry = function(minutes = 10) {
  if (this.bookingStatus === 'pending') {
    this.expiresAt = new Date(Date.now() + minutes * 60 * 1000);
    return this.save();
  }
};

// Static method to cleanup expired pending bookings manually
bookedSchema.statics.cleanupExpiredPendingBookings = async function() {
  const result = await this.deleteMany({
    bookingStatus: 'pending',
    createdAt: { $lt: new Date(Date.now() - 10 * 60 * 1000) }
  });
  return result;
};

export default mongoose.model('Booked', bookedSchema);