
// controllers/userBookingsController.js
import mongoose from 'mongoose';
import Booked from '../../modals/properties/bookedSchema.js';

// Get all bookings for logged-in user
// export const getMyBookings = async (req, res) => {
//   try {
//     const { userId } = req.user; // Assuming user is authenticated and userId is available
    
//     const {
//       page = 1,
//       limit = 10,
//       status,
//       sortBy = 'createdAt',
//       sortOrder = 'desc',
//       upcoming = false,
//       past = false
//     } = req.query;

//     // Build filter for user's bookings
//     let filter = {
//       userId: userId
//     };

//     // Filter by booking status
//     if (status) {
//       if (Array.isArray(status)) {
//         filter.bookingStatus = { $in: status };
//       } else {
//         filter.bookingStatus = status;
//       }
//     }

//     // Filter by date (upcoming or past bookings)
//     const now = new Date();
//     if (upcoming === 'true') {
//       filter.checkInDate = { $gte: now };
//     } else if (past === 'true') {
//       filter.checkOutDate = { $lt: now };
//     }

//     // Pagination
//     const pageNumber = parseInt(page);
//     const pageSize = parseInt(limit);
//     const skip = (pageNumber - 1) * pageSize;

//     // Sort configuration
//     const sortConfig = {};
//     sortConfig[sortBy] = sortOrder === 'desc' ? -1 : 1;

//     // Execute queries
//     const [bookings, totalCount] = await Promise.all([
//       Booked.find(filter)
//         .populate('property', 'title location images price amenities description rating')
//         .populate('userId', 'firstname lastname email mobile')
//         .sort(sortConfig)
//         .skip(skip)
//         .limit(pageSize)
//         .lean(),
//       Booked.countDocuments(filter)
//     ]);

//     // Calculate pagination info
//     const totalPages = Math.ceil(totalCount / pageSize);
//     const hasNextPage = pageNumber < totalPages;
//     const hasPrevPage = pageNumber > 1;

//     // Calculate booking summary
//     const bookingSummary = await Booked.aggregate([
//       { $match: { userId: new mongoose.Types.ObjectId(userId) } },
//       {
//         $group: {
//           _id: null,
//           totalBookings: { $sum: 1 },
//           totalAmount: { $sum: '$totalAmount' },
//           pendingBookings: {
//             $sum: { $cond: [{ $eq: ['$bookingStatus', 'pending'] }, 1, 0] }
//           },
//           confirmedBookings: {
//             $sum: { $cond: [{ $eq: ['$bookingStatus', 'confirmed'] }, 1, 0] }
//           },
//           completedBookings: {
//             $sum: { $cond: [{ $eq: ['$bookingStatus', 'completed'] }, 1, 0] }
//           },
//           cancelledBookings: {
//             $sum: { $cond: [{ $eq: ['$bookingStatus', 'cancelled'] }, 1, 0] }
//           }
//         }
//       }
//     ]);

//     res.status(200).json({
//       success: true,
//       data: {
//         bookings,
//         pagination: {
//           currentPage: pageNumber,
//           totalPages,
//           totalCount,
//           pageSize,
//           hasNextPage,
//           hasPrevPage
//         },
//         summary: bookingSummary.length > 0 ? bookingSummary[0] : {
//           totalBookings: 0,
//           totalAmount: 0,
//           pendingBookings: 0,
//           confirmedBookings: 0,
//           completedBookings: 0,
//           cancelledBookings: 0
//         },
//         filters: {
//           status: status || 'all',
//           upcoming: upcoming === 'true',
//           past: past === 'true'
//         }
//       }
//     });

//   } catch (error) {
//     console.error('Get My Bookings Error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error fetching user bookings',
//       error: error.message
//     });
//   }
// };


export const getMyBookings = async (req, res) => {
  try {
    const userId = req.params.userId || req.user.id;
    console.log(req.user , "req.userreq.userreq.userssssss");
    
    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }

    const bookings = await Booked.find({ userId })
      .populate("property")
      .sort({ createdAt: -1 });

    if (!bookings.length) {
      return res.status(404).json({ success: false, message: "No bookings found" });
    }

    res.status(200).json({ success: true, bookings });
  } catch (err) {
    console.error("❌ Error fetching user bookings:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// Get single booking by ID for logged-in user
export const getMyBookingById = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { userId } = req.user;

    // Validate bookingId
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID'
      });
    }

    // Find booking by ID and ensure it belongs to the user
    const booking = await Booked.findOne({
      _id: bookingId,
      userId: userId
    })
    .populate('property', 'title location images price amenities description rating reviews')
    .populate('userId', 'firstname lastname email mobile')
    .lean();

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found or unauthorized'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        booking
      }
    });

  } catch (error) {
    console.error('Get My Booking By ID Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching booking',
      error: error.message
    });
  }
};

// Get upcoming bookings for logged-in user
export const getMyUpcomingBookings = async (req, res) => {
  try {
    const { userId } = req.user;
    const { limit = 5 } = req.query;

    const now = new Date();
    
    const upcomingBookings = await Booked.find({
      userId: userId,
      checkInDate: { $gte: now },
      bookingStatus: { $in: ['pending', 'confirmed'] }
    })
    .populate('property', 'title location images price')
    .sort({ checkInDate: 1 })
    .limit(parseInt(limit))
    .lean();

    res.status(200).json({
      success: true,
      data: {
        upcomingBookings,
        count: upcomingBookings.length
      }
    });

  } catch (error) {
    console.error('Get Upcoming Bookings Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching upcoming bookings',
      error: error.message
    });
  }
};
