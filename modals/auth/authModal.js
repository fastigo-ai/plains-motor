import mongoose, { Document, Schema } from 'mongoose';

const userSchema = new Schema({
  name: {
    type: String,
    trim: true,
    default: 'User'
  },
  email: {
    type: String,
    unique: true,
    sparse: true, // Allows multiple null values
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
  }
}, {
  timestamps: true
});

// Index for automatic OTP cleanup after 5 minutes
userSchema.index({ otpCreatedAt: 1 }, { expireAfterSeconds: 300, partialFilterExpression: { otp: { $exists: true } } });

export const User = mongoose.model('User', userSchema);