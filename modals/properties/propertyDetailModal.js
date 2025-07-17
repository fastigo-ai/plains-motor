import mongoose from 'mongoose';

const propertyDetailSchema = new mongoose.Schema({
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'propertyCard',
    required: true,
    unique: true
  },
  location: {
    type: String,
    required: true,
  },
  guest: Number,
  bedroom: Number,
  bed: Number,
  bathroom: Number,
  rating: {
    type: Number,
    min: 1,
    max: 5,
    default: 0,
  },
  description: String,
  images: [String],
  price: Number,

  // Room Details
  roomType: {
    type: String,
    enum: ['single', 'double'],
    required: true
  },

  quantity: Number,

  defaultAllowedPersons: Number,     // manually provided e.g., 2 for single, 4 for double
  allowedPersonsPerRoom: Number,     // can be > defaultAllowedPersons
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

  allowedPets: {
    type: Number,
    default: 0
  },

  petFeePerPet: {
    type: Number,
    default: 0
  }

}, { timestamps: true });

export default mongoose.model('propertyDetail', propertyDetailSchema);
