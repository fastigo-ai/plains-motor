import express from 'express';
import { addCard, getAllCards } from '../../controllers/property/propertyController.js';
import { addListing, getListingByCardId } from '../../controllers/property/propertyDetailController.js';
import upload from '../../utils/multer.js';

const router = express.Router();

router.post('/add-property', addCard);

// Use upload.any() to accept files from any field name
router.post('/add-property-detail', upload.any(), addListing);

router.get('/getallPropertiesCards', getAllCards);
router.get('/getPropertyDetail/:id', getListingByCardId);

export default router;
