import mongoose from 'mongoose';

const propertyCardSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  image: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    default: 0,
  },
  badge: {
    type: String,
    default: null,
  },

  // 💡 Reference to detail document
  detail: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'propertyDetail',
    default: null
  }
}, { timestamps: true });

export default mongoose.model('propertyCard', propertyCardSchema);
