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
  price: Number
}, { timestamps: true });

export default mongoose.model('propertyDetail', propertyDetailSchema);
