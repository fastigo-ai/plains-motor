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
  }
}, { timestamps: true });

export default mongoose.model('Booked', bookedSchema);
