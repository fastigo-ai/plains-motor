import { User } from '../../modals/auth/authModal.js';
import { client, verifyServiceSid } from '../../config/twilio.js';
import { generateToken } from '../../utils/generateToken.js';
import bcrypt from 'bcryptjs';

// Send OTP using Twilio Verify
export const sendOTP = async (req, res) => {
  try {
    let { mobile } = req.body;

    if (!mobile) return res.status(400).json({ message: 'Mobile number is required' });

    // Format mobile number
    mobile = mobile.replace(/[^\d+]/g, '');
    if (!mobile.startsWith('+')) {
      if (mobile.startsWith('91') && mobile.length === 12) {
        mobile = '+' + mobile;
      } else if (mobile.length === 10) {
        mobile = '+91' + mobile;
      } else {
        mobile = '+91' + mobile;
      }
    }

    // Check if user exists, if not, create one
    let user = await User.findOne({ mobile });

    if (!user) {
      user = new User({
        mobile,
        name: 'User',
        email: `${mobile}@placeholder.com`,
        password: bcrypt.hashSync('defaultPassword123', 10),
        status: 'pending',
      });
    }

    user.otpCreatedAt = new Date();
    await user.save();

    // Send OTP using Twilio Verify
    await client.verify.v2.services(verifyServiceSid).verifications.create({
      to: mobile,
      channel: 'sms', // or 'call' if needed
    });

    res.status(200).json({ message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Send OTP Error:', error);
    res.status(500).json({ message: 'Failed to send OTP', error: error.message });
  }
};

// Verify OTP using Twilio Verify
export const verifyOTP = async (req, res) => {
  try {
    let { mobile, otp } = req.body;

    if (!mobile || !otp) {
      return res.status(400).json({ message: 'Mobile number and OTP are required' });
    }

    mobile = mobile.replace(/[^\d+]/g, '');
    if (!mobile.startsWith('+')) {
      if (mobile.startsWith('91') && mobile.length === 12) {
        mobile = '+' + mobile;
      } else if (mobile.length === 10) {
        mobile = '+91' + mobile;
      } else {
        mobile = '+91' + mobile;
      }
    }

    // Check OTP using Twilio
    const verification = await client.verify.v2
      .services(verifyServiceSid)
      .verificationChecks.create({
        to: mobile,
        code: otp,
      });

    if (verification.status !== 'approved') {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // Fetch user and mark as verified
    const user = await User.findOne({ mobile });

    if (!user) return res.status(404).json({ message: 'User not found' });

    user.isPhoneVerified = true;
    user.phoneVerifiedAt = new Date();
    user.otpCreatedAt = undefined;
    user.status = 'active';
    await user.save();

    const token = generateToken(user._id.toString());

    res.status(200).json({
      message: 'Phone verified successfully',
      token,
      user: {
        id: user._id,
        mobile: user.mobile,
        name: user.name,
        email: user.email,
        isPhoneVerified: user.isPhoneVerified,
        status: user.status,
      },
    });
  } catch (error) {
    console.error('Verify OTP Error:', error);
    res.status(500).json({ message: 'OTP verification failed', error: error.message });
  }
};
