import express from 'express';
import { addCard, getAllCards } from '../../controllers/property/propertyController.js';
import { addListing, getListingByCardId } from '../../controllers/property/propertyDetailController.js';
import upload from '../../utils/multer.js';
import { protect, authorizeRoles } from '../../utils/authMiddleware.js';

const router = express.Router();

router.post('/add-property', protect, authorizeRoles('customer', 'admin'), upload.single('image'), addCard);

router.post('/add-property-detail', upload.any(), protect, authorizeRoles('customer', 'admin'), addListing);

router.get('/get-all-cards', protect, authorizeRoles('customer', 'admin'), getAllCards);
router.get('/getPropertyDetail/:id', protect, authorizeRoles('customer', 'admin'), getListingByCardId);

export default router;
