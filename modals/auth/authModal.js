// ===== UPDATED MODELS =====

// models/User.js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  firstname: {
    type: String,
    trim: true,
    default: 'John'
  },
  lastname: {
    type: String,
    trim: true,
    default: 'Doe'
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true
  },
  mobile: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  otp: {
    type: String,
    trim: true
  },
  otpCreatedAt: {
    type: Date,
    default: Date.now
  },
  password: {
    type: String,
    minlength: 6
  },
  isPhoneVerified: {
    type: Boolean,
    default: false
  },
  phoneVerifiedAt: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending'],
    default: 'pending'
  },
  role: {
    type: String,
    enum: ['admin', 'customer'],
    default: 'customer'
  }
}, {
  timestamps: true
});

// Index for automatic OTP cleanup after 5 minutes
userSchema.index({ otpCreatedAt: 1 }, { 
  expireAfterSeconds: 300, 
  partialFilterExpression: { otp: { $exists: true } } 
});

export const User = mongoose.model('User', userSchema);