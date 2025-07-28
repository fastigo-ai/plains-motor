import express from 'express';
import { authenticateWithMobile } from '../../controllers/auth/authController.js';

const router = express.Router();

// router.post('/send-otp', sendOTP);
// router.post('/verify-otp', verifyOTP);
router.post('/authenticate-with-mobile', authenticateWithMobile);

export default router;
