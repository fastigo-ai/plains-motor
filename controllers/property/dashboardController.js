// controllers/dashboardController.js
import Payment from '../../modals/payment/paymentSchema.js';
import Order from '../../modals/payment/orderSchema.js';
import { User } from '../../modals/auth/authModal.js';
import Booked from '../../modals/properties/bookedSchema.js';

export const getDashboardData = async (req, res) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - today.getDay());
    
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    
    const thisYearStart = new Date(now.getFullYear(), 0, 1);
    const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
    const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31);

    // Parallel execution of all queries using the correct Booked model
    const [
      totalBookingsResult,
      todayBookingsResult,
      yesterdayBookingsResult,
      totalRevenueResult,
      newCustomersResult,
      weeklyBookingsResult,
      weeklyCancelledResult,
      salesReportResult,
      earningsReportResult,
      paymentStatusResult
    ] = await Promise.all([
      // Total Confirmed Bookings
      Booked.countDocuments({ bookingStatus: { $in: ['confirmed', 'completed'] } }),
      
      // Today's Bookings
      Booked.countDocuments({ 
        bookingStatus: { $in: ['confirmed', 'completed'] },
        createdAt: { $gte: today }
      }),
      
      // Yesterday's Bookings for percentage calculation
      Booked.countDocuments({
        bookingStatus: { $in: ['confirmed', 'completed'] },
        createdAt: { $gte: yesterday, $lt: today }
      }),
      
      // Total Revenue from confirmed bookings with succeeded payments
      Booked.aggregate([
        { 
          $match: { 
            bookingStatus: 'confirmed',
            'payment.paymentStatus': 'succeeded'
          } 
        },
        { 
          $group: { 
            _id: null, 
            total: { $sum: '$totalAmount' } 
          } 
        }
      ]),
      
      // New Customers this week
      User.countDocuments({ 
        role: 'customer',
        createdAt: { $gte: thisWeekStart }
      }),
      
      // Weekly Bookings for bounce rate calculation
      Booked.countDocuments({ 
        createdAt: { $gte: thisWeekStart }
      }),
      
      // Weekly Cancelled Bookings (for bounce rate)
      Booked.countDocuments({ 
        createdAt: { $gte: thisWeekStart },
        bookingStatus: 'cancelled'
      }),
      
      // Sales Report - Monthly comparison
      Booked.aggregate([
        {
          $match: {
            bookingStatus: 'confirmed',
            'payment.paymentStatus': 'succeeded',
            createdAt: { $gte: lastYearStart }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            total: { $sum: '$totalAmount' },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { '_id.year': 1, '_id.month': 1 }
        }
      ]),
      
      // Earnings Report - Daily data for current month
      Booked.aggregate([
        {
          $match: {
            bookingStatus: 'confirmed',
            'payment.paymentStatus': 'succeeded',
            createdAt: { $gte: thisMonthStart }
          }
        },
        {
          $lookup: {
            from: 'propertycards', // Assuming your property collection name
            localField: 'property',
            foreignField: '_id',
            as: 'propertyDetails'
          }
        },
        {
          $group: {
            _id: {
              day: { $dayOfMonth: '$createdAt' },
              month: { $month: '$createdAt' },
              year: { $year: '$createdAt' }
            },
            earnings: { $sum: '$totalAmount' },
            bookingCount: { $sum: 1 },
            totalStayNights: { $sum: '$totalStay' }
          }
        },
        {
          $sort: { '_id.day': 1 }
        },
        {
          $limit: 10 // Limit to first 10 days
        }
      ]),
      
      // Payment Status Breakdown
      Booked.aggregate([
        {
          $group: {
            _id: '$payment.paymentStatus',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    // Calculate percentages and format data
    const newBookingsPercentage = yesterdayBookingsResult > 0 
      ? ((todayBookingsResult - yesterdayBookingsResult) / yesterdayBookingsResult * 100).toFixed(1)
      : todayBookingsResult > 0 ? 100 : 0;

    // Calculate bounce rate (cancelled bookings / total bookings * 100)
    const bounceRate = weeklyBookingsResult > 0 
      ? (weeklyCancelledResult / weeklyBookingsResult * 100).toFixed(1)
      : 0;

    // Get current month bookings for comparison
    const currentMonthBookings = await Booked.countDocuments({
      bookingStatus: 'confirmed',
      createdAt: { $gte: thisMonthStart }
    });

    const lastMonthBookings = await Booked.countDocuments({
      bookingStatus: 'confirmed',
      createdAt: { $gte: lastMonthStart, $lt: thisMonthStart }
    });

    const monthlyGrowth = lastMonthBookings > 0 
      ? ((currentMonthBookings - lastMonthBookings) / lastMonthBookings * 100).toFixed(1)
      : currentMonthBookings > 0 ? 100 : 0;

    // Process sales report data
    const currentYear = now.getFullYear();
    
    const thisYearData = salesReportResult.filter(item => item._id.year === currentYear);
    const lastYearData = salesReportResult.filter(item => item._id.year === currentYear - 1);
    
    const salesChartData = {
      thisYear: thisYearData.reduce((sum, item) => sum + item.total, 0),
      lastYear: lastYearData.reduce((sum, item) => sum + item.total, 0),
      monthlyData: Array.from({length: 12}, (_, i) => {
        const monthData = thisYearData.find(item => item._id.month === i + 1);
        return {
          month: i + 1,
          revenue: monthData ? monthData.total : 0,
          bookings: monthData ? monthData.count : 0,
          monthName: new Date(currentYear, i).toLocaleDateString('en-US', { month: 'short' })
        };
      })
    };

    // Format earnings report
    const earningsData = earningsReportResult.map(item => ({
      date: `${String(item._id.day).padStart(2, '0')} ${new Date(currentYear, item._id.month - 1).toLocaleDateString('en-US', { month: 'long' })}`,
      bookingCount: item.bookingCount,
      totalNights: item.totalStayNights,
      earnings: `$${item.earnings.toLocaleString()}`,
      rawEarnings: item.earnings
    }));

    // Calculate total earnings for the badge
    const totalEarnings = earningsReportResult.reduce((sum, item) => sum + item.earnings, 0);
    const avgDailyEarnings = earningsReportResult.length > 0 ? totalEarnings / earningsReportResult.length : 0;

    // Get top performing properties
    const topPropertiesResult = await Booked.aggregate([
      {
        $match: {
          bookingStatus: 'confirmed',
          'payment.paymentStatus': 'succeeded',
          property: { $ne: null }
        }
      },
      {
        $lookup: {
          from: 'propertycards',
          localField: 'property',
          foreignField: '_id',
          as: 'propertyDetails'
        }
      },
      {
        $unwind: '$propertyDetails'
      },
      {
        $group: {
          _id: '$property',
          propertyTitle: { $first: '$propertyDetails.title' },
          totalRevenue: { $sum: '$totalAmount' },
          bookingCount: { $sum: 1 },
          avgRating: { $first: '$propertyDetails.rating' }
        }
      },
      {
        $sort: { totalRevenue: -1 }
      },
      {
        $limit: 5
      }
    ]);

    // Recent bookings for activity feed
    const recentBookings = await Booked.find({
      bookingStatus: 'confirmed'
    })
    .populate('userId', 'firstname lastname')
    .populate('property', 'title')
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

    // Response data
    const dashboardData = {
      // Main KPIs
      totalBookings: {
        count: totalBookingsResult,
        percentage: `${newBookingsPercentage}%`,
        label: 'vs Yesterday',
        trend: newBookingsPercentage > 0 ? 'up' : newBookingsPercentage < 0 ? 'down' : 'stable'
      },
      
      newCustomers: {
        count: newCustomersResult,
        percentage: `${bounceRate}%`,
        label: 'Cancellation Rate',
        monthlyGrowth: `${monthlyGrowth}%`
      },
      
      totalRevenue: {
        amount: totalRevenueResult.length > 0 ? totalRevenueResult[0].total : 0,
        formatted: `$${totalRevenueResult.length > 0 ? totalRevenueResult[0].total.toLocaleString() : '0'}`,
        avgPerBooking: totalBookingsResult > 0 
          ? `$${((totalRevenueResult.length > 0 ? totalRevenueResult[0].total : 0) / totalBookingsResult).toFixed(2)}`
          : '$0'
      },
      
      // Payment Status Breakdown
      paymentBreakdown: paymentStatusResult.reduce((acc, item) => {
        acc[item._id || 'unknown'] = item.count;
        return acc;
      }, {}),
      
      // Sales Report
      salesReport: {
        period: `${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
        chartData: salesChartData,
        comparison: {
          thisYear: salesChartData.thisYear,
          lastYear: salesChartData.lastYear,
          growth: salesChartData.lastYear > 0 
            ? ((salesChartData.thisYear - salesChartData.lastYear) / salesChartData.lastYear * 100).toFixed(1)
            : salesChartData.thisYear > 0 ? 100 : 0
        },
        monthlyData: salesChartData.monthlyData
      },
      
      // Earnings Report
      earningsReport: {
        totalEarnings: `$${totalEarnings.toLocaleString()}`,
        avgDailyEarnings: `$${avgDailyEarnings.toFixed(2)}`,
        data: earningsData
      },
      
      // Top Properties
      topProperties: topPropertiesResult.map(prop => ({
        id: prop._id,
        name: prop.propertyTitle,
        revenue: `$${prop.totalRevenue.toLocaleString()}`,
        bookings: prop.bookingCount,
        rating: prop.avgRating || 'N/A'
      })),
      
      // Recent Activity
      recentActivity: recentBookings.map(booking => ({
        id: booking._id,
        customerName: booking.userId ? 
          `${booking.userId.firstname} ${booking.userId.lastname}` : 'Guest',
        propertyName: booking.property?.title || 'Property not available',
        amount: `$${booking.totalAmount}`,
        date: booking.createdAt.toLocaleDateString(),
        status: booking.bookingStatus
      })),
      
      // Statistics Summary
      summary: {
        totalBookings: totalBookingsResult,
        totalRevenue: totalRevenueResult.length > 0 ? totalRevenueResult[0].total : 0,
        totalCustomers: newCustomersResult,
        avgBookingValue: totalBookingsResult > 0 
          ? ((totalRevenueResult.length > 0 ? totalRevenueResult[0].total : 0) / totalBookingsResult).toFixed(2)
          : 0,
        occupancyRate: `${(100 - parseFloat(bounceRate)).toFixed(1)}%`, // Inverse of cancellation rate
        topPerformingMonth: salesChartData.monthlyData
          .reduce((max, month) => month.revenue > max.revenue ? month : max, {revenue: 0, monthName: 'N/A'})
          .monthName
      },
      
      // Meta information
      dateRange: `01 January ${currentYear} to ${now.toLocaleDateString()}`,
      lastUpdated: now.toISOString(),
      dataSource: 'Booked Collection'
    };

    res.status(200).json({
      success: true,
      data: dashboardData,
      timestamp: now.toISOString()
    });

  } catch (error) {
    console.error('Dashboard API Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard data',
      error: error.message
    });
  }
};

// Additional helper function for date range queries
export const getDashboardDataByDateRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const dateFilter = {
      createdAt: { $gte: start, $lte: end }
    };

    const [orders, revenue, customers, payments] = await Promise.all([
      Order.countDocuments({ ...dateFilter, status: { $in: ['confirmed', 'completed'] } }),
      Payment.aggregate([
        { $match: { ...dateFilter, status: 'succeeded' } },
        { $group: { _id: null, total: { $sum: '$netAmount' } } }
      ]),
      User.countDocuments({ ...dateFilter, role: 'customer' }),
      Payment.aggregate([
        { $match: { ...dateFilter, status: 'succeeded' } },
        {
          $group: {
            _id: {
              day: { $dayOfMonth: '$createdAt' },
              month: { $month: '$createdAt' },
              year: { $year: '$createdAt' }
            },
            earnings: { $sum: '$netAmount' },
            itemCount: { $sum: 1 },
            tax: { $sum: '$transactionFee' }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
      ])
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalOrders: orders,
        totalRevenue: revenue.length > 0 ? revenue[0].total : 0,
        newCustomers: customers,
        earningsBreakdown: payments,
        dateRange: `${startDate} to ${endDate}`
      }
    });

  } catch (error) {
    console.error('Dashboard Date Range API Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard data for date range',
      error: error.message
    });
  }
};