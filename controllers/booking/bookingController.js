
// controllers/userBookingsController.js
import mongoose from 'mongoose';
import Booked from '../../modals/properties/bookedSchema.js';
import Order from '../../modals/payment/orderSchema.js';

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


// export const getMyBookings = async (req, res) => {
//   try {
//     const userId = req.params.userId || req.user.id;
//     if (!userId) {
//       return res.status(400).json({ success: false, message: "User ID is required" });
//     }

//     // Filter out bookings with status "pending"
//     const bookings = await Booked.find({
//       userId,
//       bookingStatus: { $ne: "pending" } // $ne means "not equal"
//     })
//       .populate("property")
//       .sort({ createdAt: -1 });

//     if (!bookings.length) { 
//       return res.status(200).json({ success: false, message: "No bookings found" });
//     }
//     console.log(bookings)

//     res.status(200).json({ success: true, bookings });
//   } catch (err) {
//     console.error("❌ Error fetching user bookings:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

export const getMyBookings = async (req, res) => {
  try {
    const userId = req.params.userId || req.user.id;
    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }

    // Fetch bookings excluding "pending"
    const bookings = await Booked.find({
      userId,
      bookingStatus: { $ne: "pending" }
    })
      .populate("property")
      .sort({ createdAt: -1 });

    if (!bookings.length) {
      return res.status(200).json({ success: false, message: "No bookings found" });
    }

    // Attach orderId from Order collection
    const bookingsWithOrder = await Promise.all(bookings.map(async (booking) => {
      const order = await Order.findOne({ bookingId: booking._id }).select("orderId");
      return {
        ...booking.toObject(),
        orderId: order ? order._id : null
      };
    }));

    res.status(200).json({ success: true, bookings: bookingsWithOrder });
  } catch (err) {
    console.error("❌ Error fetching user bookings:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// Get single booking by ID for logged-in user
export const getMyBookingById = async (req, res) => {
  try {
    const { bookingId } = req.params;

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

// Get all bookings with confirmed status (without pagination)
export const getAllConfirmedBookings = async (req, res) => {
  try {
    const { sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    // Build sort object
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Find all confirmed bookings
    const confirmedBookings = await Booked.find({
      bookingStatus: "confirmed" || "succeeded" || "cancelled"
    })
      .populate('property', 'title location images price amenities rating reviews')
      .populate('userId', 'firstname lastname email mobile')
      .sort(sortOptions)
      .lean();

    if (!confirmedBookings.length) {
      return res.status(200).json({
        success: false,
        message: "No confirmed bookings found"
      });
    }

    console.log(`Found ${confirmedBookings.length} confirmed bookings`);

    res.status(200).json({
      success: true,
      data: {
        bookings: confirmedBookings,
        count: confirmedBookings.length
      }
    });

  } catch (error) {
    console.error("❌ Error fetching confirmed bookings:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};


export const getAllBookings = async (req, res) => {
  try {
    const {
      status,
      fromDate,
      toDate,
      search,
      page = 1,
      limit = 50,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    /* -------------------- FILTER -------------------- */
    const filter = {};

    // 🔹 Booking status filter
    if (status) {
      filter.bookingStatus = status;
    } else {
      filter.bookingStatus = {
        $in: ["confirmed", "succeeded", "cancelled"],
      };
    }

    // 🔹 Date-wise filter
    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) filter.createdAt.$gte = new Date(fromDate);
      if (toDate) filter.createdAt.$lte = new Date(toDate);
    }

    /* -------------------- SORT -------------------- */
    const sortOptions = {
      [sortBy]: sortOrder === "desc" ? -1 : 1,
    };

    const skip = (page - 1) * limit;

    /* -------------------- QUERY -------------------- */
    let query = Booked.find(filter)
      .populate({
        path: "userId",
        select: "firstname lastname email mobile",
        match: search
          ? {
              $or: [
                { firstname: { $regex: search, $options: "i" } },
                { lastname: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
              ],
            }
          : {},
      })
      .populate(
        "property",
        "title location images price amenities rating"
      )
      .sort(sortOptions)
      .skip(skip)
      .limit(Number(limit))
      .lean();

    let bookings = await query;

    // 🔹 Remove bookings where user doesn't match search
    if (search) {
      bookings = bookings.filter(b => b.userId !== null);
    }

    const total = await Booked.countDocuments(filter);

    /* -------------------- RESPONSE -------------------- */
    return res.status(200).json({
      success: true,
      data: {
        bookings,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / limit),
        },
      },
    });

  } catch (error) {
    console.error("❌ Error fetching bookings:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
