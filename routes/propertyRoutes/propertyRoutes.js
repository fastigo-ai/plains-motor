import express from 'express';
import { addCard, getAllCards } from '../../controllers/property/propertyController.js';
import { addListing, getListingByCardId } from '../../controllers/property/propertyDetailController.js';

const router = express.Router();

router.post('/add-property', addCard);
router.post('/add-property-detail', addListing);
router.get('/getallPropertiesCards' , getAllCards)
router.get('/getPropertyDetail/:id' , getListingByCardId)

export default router;
