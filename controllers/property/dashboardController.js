// controllers/dashboardController.js
import Payment from '../../modals/payment/paymentSchema.js';
import Order from '../../modals/payment/orderSchema.js';
import { User } from '../../modals/auth/authModal.js';


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

    // Parallel execution of all queries
    const [
      totalOrdersResult,
      todayOrdersResult,
      totalRevenueResult,
      newCustomersResult,
      weeklyBounceRateResult,
      topCouponsResult,
      weeklyCouponsResult,
      salesReportResult,
      earningsReportResult
    ] = await Promise.all([
      // Total Orders
      Order.countDocuments({ status: { $in: ['confirmed', 'completed'] } }),
      
      // Today's Orders for percentage calculation
      Order.countDocuments({ 
        status: { $in: ['confirmed', 'completed'] },
        createdAt: { $gte: today }
      }),
      
      // Total Revenue
      Payment.aggregate([
        { $match: { status: 'succeeded' } },
        { $group: { _id: null, total: { $sum: '$netAmount' } } }
      ]),
      
      // New Customers
      User.countDocuments({ 
        role: 'customer',
        createdAt: { $gte: thisWeekStart }
      }),
      
      // Weekly Bounce Rate (using cancelled orders as proxy)
      Promise.all([
        Order.countDocuments({ 
          createdAt: { $gte: thisWeekStart },
          status: 'cancelled'
        }),
        Order.countDocuments({ 
          createdAt: { $gte: thisWeekStart }
        })
      ]),
      
      // Top Coupons (mock data as no coupon schema provided)
      // Replace with actual coupon aggregation if you have coupon system
      Promise.resolve(78), // Mock percentage
      
      // Weekly Coupons Sessions
      Promise.resolve(1.5), // Mock percentage
      
      // Sales Report - Monthly comparison
      Payment.aggregate([
        {
          $match: {
            status: 'succeeded',
            createdAt: { $gte: lastYearStart }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            total: { $sum: '$netAmount' },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { '_id.year': 1, '_id.month': 1 }
        }
      ]),
      
      // Earnings Report - Daily data for current month
      Payment.aggregate([
        {
          $match: {
            status: 'succeeded',
            createdAt: { $gte: thisMonthStart }
          }
        },
        {
          $lookup: {
            from: 'orders',
            localField: 'order',
            foreignField: '_id',
            as: 'orderDetails'
          }
        },
        {
          $unwind: '$orderDetails'
        },
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
        {
          $sort: { '_id.day': 1 }
        },
        {
          $limit: 10 // Limit to first 10 days as shown in your image
        }
      ])
    ]);

    // Calculate percentages and format data
    const yesterdayOrders = await Order.countDocuments({
      status: { $in: ['confirmed', 'completed'] },
      createdAt: { $gte: yesterday, $lt: today }
    });

    const newSessionsPercentage = yesterdayOrders > 0 
      ? ((todayOrdersResult - yesterdayOrders) / yesterdayOrders * 100).toFixed(1)
      : 0;

    // Calculate bounce rate
    const [cancelledOrders, totalWeeklyOrders] = weeklyBounceRateResult;
    const bounceRate = totalWeeklyOrders > 0 
      ? (cancelledOrders / totalWeeklyOrders * 100).toFixed(1)
      : 0;

    // Process sales report data
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    const thisYearData = salesReportResult.filter(item => item._id.year === currentYear);
    const lastYearData = salesReportResult.filter(item => item._id.year === currentYear - 1);
    
    const salesChartData = {
      thisYear: thisYearData.reduce((sum, item) => sum + item.total, 0),
      lastYear: lastYearData.reduce((sum, item) => sum + item.total, 0),
      monthlyData: thisYearData.map(item => ({
        month: item._id.month,
        revenue: item.total,
        orders: item.count
      }))
    };

    // Format earnings report
    const earningsData = earningsReportResult.map(item => ({
      date: `${String(item._id.day).padStart(2, '0')} ${new Date(2024, item._id.month - 1).toLocaleDateString('en-US', { month: 'long' })}`,
      itemCount: item.itemCount,
      tax: `$${item.tax.toFixed(0)}`,
      earnings: `$${item.earnings.toLocaleString()}`
    }));

    // Calculate total earnings for the badge
    const totalEarnings = earningsReportResult.reduce((sum, item) => sum + item.earnings, 0);

    // Response data
    const dashboardData = {
      // Main KPIs
      totalOrders: {
        count: totalOrdersResult,
        percentage: `${newSessionsPercentage}%`,
        label: 'New Sessions Today'
      },
      
      newCustomers: {
        count: newCustomersResult,
        percentage: `${bounceRate}%`,
        label: 'Bounce Rate Weekly'
      },
      
      topCoupons: {
        percentage: `${topCouponsResult}%`,
        weeklyAvg: `${weeklyCouponsResult}%`,
        label: 'Weekly Avg Sessions'
      },
      
      totalRevenue: {
        amount: totalRevenueResult.length > 0 ? totalRevenueResult[0].total : 0,
        formatted: `$${totalRevenueResult.length > 0 ? totalRevenueResult[0].total.toLocaleString() : '0'}`
      },
      
      // Sales Report
      salesReport: {
        period: 'This Month',
        chartData: salesChartData,
        comparison: {
          thisYear: salesChartData.thisYear,
          lastYear: salesChartData.lastYear,
          growth: salesChartData.lastYear > 0 
            ? ((salesChartData.thisYear - salesChartData.lastYear) / salesChartData.lastYear * 100).toFixed(1)
            : 0
        }
      },
      
      // Earnings Report
      earningsReport: {
        totalEarnings: `$${totalEarnings.toLocaleString()}`,
        data: earningsData
      },
      
      // Device breakdown (mock data based on your image)
      deviceBreakdown: {
        tablet: 'Tablet',
        desktop: 'Desktop', 
        mobile: 'Mobile'
      },
      
      // Meta information
      dateRange: '01 January 2023 to 31 December 2024',
      lastUpdated: now.toISOString()
    };

    res.status(200).json({
      success: true,
      data: dashboardData
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