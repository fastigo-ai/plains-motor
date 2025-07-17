// ===== UPDATED MODELS =====

// models/PropertyCard.js
import mongoose from 'mongoose';

const propertyCardSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
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
  roomType: {
    type: String,
    enum: ['single', 'double'],
    required: true
  },
  // 🔗 Reference to category
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
  },
  // 🔗 Reference to detail
  detail: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'propertyDetail',
    default: null,
  },
  // 📦 In Stock field
  inStock: {
    type: Boolean,
    default: true,
  }
}, { timestamps: true });

export default mongoose.model('propertyCard', propertyCardSchema);