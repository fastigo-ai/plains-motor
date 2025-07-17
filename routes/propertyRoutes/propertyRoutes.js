import express from 'express';
import { 
  addCard, 
  getAllCards, 
  getCardById, 
  updateProperty,  
  deleteProperty,  
  toggleStock 
} from '../../controllers/property/propertyController.js';
import { 
  addListing, 
  getListingByCardId
} from '../../controllers/property/propertyDetailController.js';
import upload from '../../utils/multer.js';
import { protect, authorizeRoles } from '../../utils/authMiddleware.js';
import  { getDashboardData, getDashboardDataByDateRange } from '../../controllers/property/dashboardController.js';
import { getMyBookingById, getMyBookings } from '../../controllers/booking/bookingController.js';

const router = express.Router();

router.post('/add-property', 

  upload.single('image'), 
  addCard
);

router.get('/get-all-properties', 
  getAllCards
);

router.get('/get-property/:id', 
  getCardById
);

router.put('/update-property/:id', 
//   protect, 
//   authorizeRoles('customer', 'admin'), 
  upload.fields([
    { name: 'cardImage', maxCount: 1 },
    { name: 'listingImages', maxCount: 10 }
  ]), 
  updateProperty
);


router.delete('/delete-property/:id', 
  deleteProperty
);

router.patch('/toggle-stock/:id', 
  toggleStock
);

router.post('/add-property-detail', 
  upload.any(), 
  addListing
);

router.get('/getPropertyDetail/:id', 
 
  getListingByCardId
);


// Main dashboard endpoint
router.get('/dashboard', getDashboardData);

// Dashboard with custom date range
router.get('/dashboard/date-range', getDashboardDataByDateRange);



router.get('/my-bookings', protect, getMyBookings);

router.get('/my-bookings/:bookingId',  protect, getMyBookingById);

export default router;