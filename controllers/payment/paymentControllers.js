// controllers/bookingController.js
import Order from '../../modals/payment/orderSchema.js';
import Payment from '../../modals/payment/paymentSchema.js';
import stripe from '../../config/stripe.js';
import mongoose from 'mongoose';
import { User } from '../../modals/auth/authModal.js';
import Booked from '../../modals/properties/bookedSchema.js';
import PropertyCard from '../../modals/properties/propertyModal.js';

// Table update helper function
// Table update helper function
export const updateRoomAvailability = async (propertyId, checkInDate, checkOutDate, roomType, quantity, action = 'book', session = null) => {
  try {
    // Get property details
    const property = await PropertyCard.findById(propertyId).populate('detail').session(session);
    if (!property || !property.detail) {
      throw new Error('Property or property details not found');
    }
   console.log(property)
   console.log(property.detail)
   console.log(roomType)
    const propertyDetail = property.detail;
    
    // Validate room type matches
    if (propertyDetail.roomType !== roomType) {
      throw new Error(`Room type mismatch. Property has ${propertyDetail.roomType} rooms, requested ${roomType}`);
    }

    // Check if enough rooms are available
    if (action === 'book' && propertyDetail.quantity < quantity) {
      throw new Error(`Not enough ${roomType} rooms available. Available: ${propertyDetail.quantity}, Requested: ${quantity}`);
    }

    // Calculate date range for checking conflicts
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    
    // Check for booking conflicts in the date range
    const conflictingBookings = await Booked.find({
      property: propertyId,
      bookingStatus: { $in: ['pending', 'confirmed', 'completed'] },
      $or: [
        {
          checkInDate: { $lt: checkOut },
          checkOutDate: { $gt: checkIn }
        }
      ]
    }).session(session);

    // Calculate total rooms booked during the period
    const roomsBookedInPeriod = conflictingBookings.reduce((total, booking) => {
      return total + (booking.roomDetails?.quantity || 1);
    }, 0);

    // Check availability
    const availableRooms = propertyDetail.quantity - roomsBookedInPeriod;
    
    if (action === 'book' && availableRooms < quantity) {
      throw new Error(`Not enough rooms available for selected dates. Available: ${availableRooms}, Requested: ${quantity}`);
    }

    // Update property stock status based on availability
    const shouldBeInStock = availableRooms > 0;
    
    if (property.inStock !== shouldBeInStock) {
      await PropertyCard.findByIdAndUpdate(
        propertyId,
        { inStock: shouldBeInStock },
        { session }
      );
    }

    return {
      success: true,
      availableRooms,
      totalRooms: propertyDetail.quantity,
      roomsBookedInPeriod,
      propertyDetail
    };

  } catch (error) {
    console.error('Room availability update error:', error);
    throw error;
  }
};

// Updated checkout session creation function
export const createCheckoutSession = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      propertyId,
      userId,
      checkInDate,
      checkOutDate,
      totalStay,
      roomDetails: {
        roomType,
        quantity,
        allowedPersonsPerRoom,
        extraPersons = 0,
        extraPersonCharge = 0,
        isSmokingAllowed = false,
        smokingRoomCharge = 0,
        isPetFriendly = false,
        pets = 0,
        petFeePerPet = 0
      },
      guests,
      specialRequest = '',
      user: { firstname, lastname, phone },
      totalAmount,
      currency = 'cad'
    } = req.body;

    // Validate required fields
    if (!propertyId || !userId || !checkInDate || !checkOutDate || !totalStay || 
        !roomType || !quantity || !allowedPersonsPerRoom || !guests || !totalAmount) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Validate property exists and get details
    const property = await PropertyCard.findById(propertyId)
      .populate('detail')
      .session(session);
    
    if (!property) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    if (!property.inStock) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Property is not available for booking'
      });
    }

    // Validate room availability FIRST
    const roomAvailability = await updateRoomAvailability(
      propertyId, 
      checkInDate, 
      checkOutDate, 
      roomType, 
      quantity, 
      'book', 
      session
    );

    // Validate user exists
    const existingUser = await User.findById(userId).session(session);
    if (!existingUser) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update user information if provided
    if (firstname || lastname || phone) {
      const updateData = {};
      if (firstname) updateData.firstname = firstname;
      if (lastname) updateData.lastname = lastname;
      if (phone) updateData.mobile = phone;

      await User.findByIdAndUpdate(
        userId,
        updateData,
        { session, runValidators: true }
      );
    }

    // Validate dates
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (checkIn < today) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Check-in date cannot be in the past'
      });
    }

    if (checkOut <= checkIn) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Check-out date must be after check-in date'
      });
    }

    // Validate guest capacity
    const totalGuests = guests.adults + (guests.children || 0) + (guests.infants || 0);
    const maxCapacity = (allowedPersonsPerRoom * quantity) + extraPersons;
    
    if (totalGuests > maxCapacity) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Too many guests. Maximum capacity: ${maxCapacity}, Requested: ${totalGuests}`
      });
    }

    // Validate pet policy
    if (pets > 0 && !isPetFriendly) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Pets are not allowed in this property'
      });
    }

    if (pets > roomAvailability.propertyDetail.allowedPets) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Too many pets. Maximum allowed: ${roomAvailability.propertyDetail.allowedPets}, Requested: ${pets}`
      });
    }

    // Check for existing bookings by the same user for the same property
    const existingUserBookings = await Booked.find({
      property: propertyId,
      userId: userId,
      bookingStatus: { $in: ['pending', 'confirmed', 'completed'] }
    }).session(session);

    // Check for exact same dates by same user
    const duplicateBooking = existingUserBookings.find(booking => {
      return booking.checkInDate.getTime() === checkIn.getTime() && 
             booking.checkOutDate.getTime() === checkOut.getTime();
    });

    // NEW LOGIC: Only prevent duplicate booking if no rooms are available
    if (duplicateBooking) {
      // Calculate current room usage for the same dates
      const sameUserSameDateBookings = await Booked.find({
        property: propertyId,
        userId: userId,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        bookingStatus: { $in: ['pending', 'confirmed', 'completed'] }
      }).session(session);

      // Calculate total rooms this user has booked for these exact dates
      const userRoomsForSameDates = sameUserSameDateBookings.reduce((total, booking) => {
        return total + (booking.roomDetails?.quantity || 1);
      }, 0);

      // Check if adding more rooms would exceed availability
      const totalRoomsAfterBooking = userRoomsForSameDates + quantity;
      const availableRoomsAfterExisting = roomAvailability.availableRooms + userRoomsForSameDates;

      if (totalRoomsAfterBooking > availableRoomsAfterExisting) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `You already have a booking for this property on the same dates. No additional rooms available for these dates. Available: ${availableRoomsAfterExisting - userRoomsForSameDates}, Requested: ${quantity}`,
          details: {
            userCurrentRooms: userRoomsForSameDates,
            requestedRooms: quantity,
            availableRooms: availableRoomsAfterExisting - userRoomsForSameDates,
            totalPropertyRooms: roomAvailability.totalRooms
          }
        });
      }
    }

    // Check for consecutive dates (add-on booking)
    const consecutiveBooking = existingUserBookings.find(booking => {
      const existingCheckOut = new Date(booking.checkOutDate);
      const existingCheckIn = new Date(booking.checkInDate);
      
      return existingCheckOut.getTime() === checkIn.getTime() ||
             checkOut.getTime() === existingCheckIn.getTime();
    });

    let isExtension = false;
    let originalBooking = null;

    if (consecutiveBooking && !duplicateBooking) {
      isExtension = true;
      originalBooking = consecutiveBooking;
    }

    // Generate unique IDs
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substr(2, 9);
    const userSuffix = userId.toString().substr(-4);
    
    const orderId = `ORDER-${timestamp}-${userSuffix}-${randomSuffix}`;
    const paymentId = `PAY-${timestamp}-${userSuffix}-${randomSuffix}`;

    let savedBooking;
    let bookingAction = 'created';

    if (isExtension && originalBooking && !duplicateBooking) {
      // Extend existing booking
      const newCheckIn = new Date(Math.min(originalBooking.checkInDate.getTime(), checkIn.getTime()));
      const newCheckOut = new Date(Math.max(originalBooking.checkOutDate.getTime(), checkOut.getTime()));
      const newTotalStay = Math.ceil((newCheckOut - newCheckIn) / (1000 * 60 * 60 * 24));

      // Update existing booking
      originalBooking.checkInDate = newCheckIn;
      originalBooking.checkOutDate = newCheckOut;
      originalBooking.totalStay = newTotalStay;
      originalBooking.totalAmount = originalBooking.totalAmount + totalAmount;
      
      // Update room details if extending with different room configuration
      if (quantity > originalBooking.roomDetails.quantity) {
        originalBooking.roomDetails.quantity = quantity;
      }
      
      // Update guests if new booking has more guests
      if (guests.adults > originalBooking.guests.adults) {
        originalBooking.guests.adults = guests.adults;
      }
      if (guests.children > originalBooking.guests.children) {
        originalBooking.guests.children = guests.children;
      }
      if (guests.infants > originalBooking.guests.infants) {
        originalBooking.guests.infants = guests.infants;
      }
      
      // Update pet details
      if (pets > originalBooking.roomDetails.pets) {
        originalBooking.roomDetails.pets = pets;
      }

      // Append special request if provided
      if (specialRequest) {
        originalBooking.specialRequest = originalBooking.specialRequest 
          ? `${originalBooking.specialRequest}; ${specialRequest}`
          : specialRequest;
      }

      savedBooking = await originalBooking.save({ session });
      bookingAction = 'extended';
      
    } else {
      // Create new booking (including additional rooms for same dates)
      const booking = new Booked({
        property: propertyId,
        userId,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        totalStay,
        roomDetails: {
          roomType,
          quantity,
          allowedPersonsPerRoom,
          extraPersons,
          extraPersonCharge,
          isSmokingAllowed,
          smokingRoomCharge,
          isPetFriendly,
          pets,
          petFeePerPet
        },
        guests: {
          adults: guests.adults,
          children: guests.children || 0,
          infants: guests.infants || 0
        },
        specialRequest,
        totalAmount,
        bookingStatus: 'pending'
      });

      savedBooking = await booking.save({ session });
      bookingAction = duplicateBooking ? 'additional_rooms' : 'created';
    }

    // Create order
    const order = new Order({
      orderId: orderId,
      property: propertyId,
      customer: {
        name: `${firstname || existingUser.firstname} ${lastname || existingUser.lastname}`,
        email: existingUser.email,
        phone: phone || existingUser.mobile
      },
      booking: {
        checkIn: savedBooking.checkInDate,
        checkOut: savedBooking.checkOutDate,
        guests: savedBooking.guests.adults + savedBooking.guests.children + savedBooking.guests.infants,
        nights: savedBooking.totalStay,
        rooms: savedBooking.roomDetails.quantity,
        roomType: savedBooking.roomDetails.roomType,
        specialRequest: savedBooking.specialRequest
      },
      payment: {
        amount: totalAmount * 100,
        currency,
        stripePaymentIntentId: '',
        stripePaymentStatus: 'pending'
      },
      bookingId: savedBooking._id,
      notes: isExtension ? `Extension payment for existing booking` : (duplicateBooking ? 'Additional rooms for same dates' : ''),
      metadata: {
        isExtension: isExtension.toString(),
        isAdditionalRooms: duplicateBooking ? 'true' : 'false',
        originalBookingId: originalBooking?._id?.toString() || '',
        bookingAction: bookingAction
      }
    });

    const savedOrder = await order.save({ session });

    // Define the base URL for your frontend
    const baseUrl = process.env.CLIENT_URL || 'http://localhost:3000';

    // Create detailed line item description
    const lineItemDescription = `${totalStay} night(s) stay - ${quantity} ${roomType} room(s) - ${guests.adults} adults, ${guests.children || 0} children${pets > 0 ? `, ${pets} pet(s)` : ''}${extraPersons > 0 ? `, ${extraPersons} extra person(s)` : ''}${isSmokingAllowed ? ', smoking allowed' : ''}`;

    // Create Stripe Checkout Session
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: currency,
            product_data: {
              name: `${property.name} ${isExtension ? '(Extension)' : duplicateBooking ? '(Additional Rooms)' : ''}`,
              description: isExtension 
                ? `Extension: ${lineItemDescription}`
                : duplicateBooking 
                  ? `Additional Rooms: ${lineItemDescription}`
                  : lineItemDescription,
              images: property.image ? [property.image] : [],
            },
            unit_amount: Math.floor(totalAmount) * 100,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${baseUrl}/booking-success?session_id={CHECKOUT_SESSION_ID}&action=${bookingAction}&booking_id=${savedBooking._id}&order_id=${savedOrder._id}`,
      cancel_url: `${baseUrl}`,
      metadata: {
        orderId: savedOrder._id.toString(),
        bookingId: savedBooking._id.toString(),
        propertyId: propertyId,
        userId: userId,
        customOrderId: orderId,
        isExtension: isExtension.toString(),
        isAdditionalRooms: duplicateBooking ? 'true' : 'false',
        bookingAction: bookingAction,
        roomType: roomType,
        roomQuantity: quantity.toString()
      },
      customer_email: existingUser.email,
      billing_address_collection: 'required',
      phone_number_collection: {
        enabled: true,
      },
      allow_promotion_codes: true,
      automatic_tax: {
        enabled: false,
      },
      custom_text: {
        submit: {
          message: `Complete your ${isExtension ? 'extension' : duplicateBooking ? 'additional room' : 'booking'} payment securely.`
        }
      },
      expires_at: Math.floor(Date.now() / 1000) + (24 * 60 * 60),
      locale: 'auto',
      payment_intent_data: {
        metadata: {
          orderId: savedOrder._id.toString(),
          bookingId: savedBooking._id.toString(),
          propertyId: propertyId,
          userId: userId,
          customOrderId: orderId,
          isExtension: isExtension.toString(),
          isAdditionalRooms: duplicateBooking ? 'true' : 'false',
          bookingAction: bookingAction,
          roomType: roomType,
          roomQuantity: quantity.toString()
        }
      }
    });

    // Create payment record
    const payment = new Payment({
      paymentId: paymentId,
      order: savedOrder._id,
      stripe: {
        paymentIntentId: checkoutSession.payment_intent || checkoutSession.id,
        clientSecret: checkoutSession.id,
        status: 'requires_payment_method'
      },
      amount: Math.floor(totalAmount) * 100,
      currency,
      netAmount: Math.floor(totalAmount) * 100,
      status: 'pending',
      bookingId: savedBooking._id
    });

    await payment.save({ session });

    // Update booking and order with session info
    savedBooking.payment = {
      paymentIntentId: checkoutSession.payment_intent || checkoutSession.id,
      paymentStatus: 'pending'
    };
    
    await savedBooking.save({ session });

    savedOrder.payment.stripePaymentIntentId = checkoutSession.payment_intent || checkoutSession.id;
    await savedOrder.save({ session });

    await session.commitTransaction();

    res.status(201).json({
      success: true,
      message: `Checkout session ${bookingAction} successfully`,
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
      bookingId: savedBooking._id,
      orderId: savedOrder._id,
      customOrderId: orderId,
      bookingAction: bookingAction,
      isExtension: isExtension,
      isAdditionalRooms: duplicateBooking || false,
      roomAvailability: {
        availableRooms: roomAvailability.availableRooms,
        totalRooms: roomAvailability.totalRooms,
        bookedRooms: roomAvailability.roomsBookedInPeriod
      },
      redirectUrls: {
        success: `${baseUrl}/booking-success?session_id=${checkoutSession.id}&action=${bookingAction}&booking_id=${savedBooking._id}&order_id=${savedOrder._id}`,
        cancel: `${baseUrl}/booking-cancel?session_id=${checkoutSession.id}&action=${bookingAction}&booking_id=${savedBooking._id}&property_id=${propertyId}`,
        return: `${baseUrl}/confirm?property_id=${propertyId}&check_in=${checkInDate}&check_out=${checkOutDate}&guests=${JSON.stringify(guests)}&rooms=${quantity}&room_type=${roomType}`
      },
      bookingDetails: {
        checkInDate: savedBooking.checkInDate,
        checkOutDate: savedBooking.checkOutDate,
        totalStay: savedBooking.totalStay,
        totalAmount: savedBooking.totalAmount,
        currentPaymentAmount: Math.floor(totalAmount),
        roomDetails: savedBooking.roomDetails,
        guests: savedBooking.guests
      }
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Checkout session creation error:', error);
    
    // Handle specific errors
    if (error.message.includes('Not enough rooms available') || 
        error.message.includes('Too many guests') ||
        error.message.includes('Pets are not allowed') ||
        error.message.includes('Too many pets') ||
        error.message.includes('You already have a booking for this property on the same dates')) {
      return res.status(400).json({
        success: false,
        message: error.message,
        redirectUrl: `${process.env.CLIENT_URL || 'http://localhost:3000'}/confirm`
      });
    }
    
    if (error.code === 11000) {
      console.error('Duplicate key error details:', {
        keyPattern: error.keyPattern,
        keyValue: error.keyValue,
        message: error.message
      });
      
      return res.status(400).json({
        success: false,
        message: 'Booking conflict detected. Please try again.',
        redirectUrl: `${process.env.CLIENT_URL || 'http://localhost:3000'}/confirm`
      });
    }

    // Handle Stripe errors
    if (error.type === 'StripeCardError' || error.type === 'StripeInvalidRequestError') {
      return res.status(400).json({
        success: false,
        message: 'Payment processing error: ' + error.message,
        redirectUrl: `${process.env.CLIENT_URL || 'http://localhost:3000'}/confirm`
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create checkout session',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      redirectUrl: `${process.env.CLIENT_URL || 'http://localhost:3000'}/confirm`
    });
  } finally {
    session.endSession();
  }
};

export const handleStripeWebhook = async (req, res) => {
  console.log("Running Stripe Webhook Event");
  
  const sig = req.headers['stripe-signature'];
  let event;
  
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error(`Webhook signature verification failed:`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  console.log(`Processing event type: ${event.type}`);
  
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        await handleSuccessfulPayment(session);
        break;
        
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        await handlePaymentIntentSucceeded(paymentIntent);
        break;
        
      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object;
        await handlePaymentFailed(failedPayment);
        break;
        
      case 'payment_intent.canceled':
        const canceledPayment = event.data.object;
        await handlePaymentCanceled(canceledPayment);
        break;
        
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

// Handle successful checkout session completion
const handleSuccessfulPayment = async (session) => {
  const mongoSession = await mongoose.startSession();
  mongoSession.startTransaction();
  
  try {
    console.log('Processing successful payment for session:', session.id);
    console.log('Session metadata:', session.metadata);
    
    const { orderId, bookingId, propertyId, isExtension, isAdditionalRooms, bookingAction } = session.metadata;
    
    if (!orderId || !bookingId) {
      throw new Error('Missing required metadata in session');
    }
    
    // Update booking status
    const booking = await Booked.findById(bookingId).session(mongoSession);
    if (!booking) {
      throw new Error(`Booking not found: ${bookingId}`);
    }
    
    booking.bookingStatus = 'confirmed';
    booking.payment.paymentStatus = 'succeeded';
    booking.payment.paymentIntentId = session.payment_intent;
    await booking.save({ session: mongoSession });
    
    // Update order status
    const order = await Order.findById(orderId).session(mongoSession);
    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }
    
    order.status = 'confirmed';
    order.payment.stripePaymentStatus = 'succeeded';
    order.payment.stripePaymentIntentId = session.payment_intent;
    await order.save({ session: mongoSession });
    
    // Update payment record
    const payment = await Payment.findOne({ bookingId: bookingId }).session(mongoSession);
    if (payment) {
      payment.status = 'succeeded';
      payment.stripe.status = 'succeeded';
      
      // Add payment method details if available
      if (session.payment_method_types && session.payment_method_types.length > 0) {
        payment.paymentMethod.type = session.payment_method_types[0];
      }
      
      await payment.save({ session: mongoSession });
    }
    
    // Update room availability if needed
    if (propertyId) {
      await updateRoomAvailability(
        propertyId,
        booking.checkInDate,
        booking.checkOutDate,
        booking.roomDetails.roomType,
        booking.roomDetails.quantity,
        'confirm',
        mongoSession
      );
    }
    
    await mongoSession.commitTransaction();
    
    console.log(`Payment successful for booking: ${bookingId}, action: ${bookingAction}`);
    
    // Send confirmation email or notification here if needed
    
  } catch (error) {
    await mongoSession.abortTransaction();
    console.error('Error handling successful payment:', error);
    throw error;
  } finally {
    mongoSession.endSession();
  }
};

// Handle payment intent succeeded (backup handler)
const handlePaymentIntentSucceeded = async (paymentIntent) => {
  const mongoSession = await mongoose.startSession();
  mongoSession.startTransaction();
  
  try {
    console.log('Processing payment intent succeeded:', paymentIntent.id);
    console.log('Payment intent metadata:', paymentIntent.metadata);
    
    const { orderId, bookingId, propertyId, bookingAction } = paymentIntent.metadata;
    
    if (!orderId || !bookingId) {
      console.log('Missing metadata in payment intent, skipping...');
      return;
    }
    
    // Check if already processed by checkout.session.completed
    const existingBooking = await Booked.findById(bookingId).session(mongoSession);
    if (existingBooking && existingBooking.bookingStatus === 'confirmed') {
      console.log('Payment already processed by checkout.session.completed');
      await mongoSession.commitTransaction();
      return;
    }
    
    // Update booking status
    if (existingBooking) {
      existingBooking.bookingStatus = 'confirmed';
      existingBooking.payment.paymentStatus = 'succeeded';
      existingBooking.payment.paymentIntentId = paymentIntent.id;
      await existingBooking.save({ session: mongoSession });
    }
    
    // Update order status
    const order = await Order.findById(orderId).session(mongoSession);
    if (order) {
      order.status = 'confirmed';
      order.payment.stripePaymentStatus = 'succeeded';
      order.payment.stripePaymentIntentId = paymentIntent.id;
      await order.save({ session: mongoSession });
    }
    
    // Update payment record
    const payment = await Payment.findOne({ bookingId: bookingId }).session(mongoSession);
    if (payment) {
      payment.status = 'succeeded';
      payment.stripe.status = 'succeeded';
      
      // Add charge details if available
      if (paymentIntent.charges && paymentIntent.charges.data.length > 0) {
        const charge = paymentIntent.charges.data[0];
        payment.stripe.charges = [{
          chargeId: charge.id,
          amount: charge.amount,
          status: charge.status,
          receiptUrl: charge.receipt_url,
          created: new Date(charge.created * 1000)
        }];
        
        // Add payment method details
        if (charge.payment_method_details && charge.payment_method_details.card) {
          const card = charge.payment_method_details.card;
          payment.paymentMethod = {
            type: 'card',
            last4: card.last4,
            brand: card.brand,
            expMonth: card.exp_month,
            expYear: card.exp_year
          };
        }
      }
      
      await payment.save({ session: mongoSession });
    }
    
    await mongoSession.commitTransaction();
    
    console.log(`Payment intent succeeded for booking: ${bookingId}, action: ${bookingAction}`);
    
  } catch (error) {
    await mongoSession.abortTransaction();
    console.error('Error handling payment intent succeeded:', error);
    throw error;
  } finally {
    mongoSession.endSession();
  }
};

// Handle payment failed
const handlePaymentFailed = async (failedPayment) => {
  const mongoSession = await mongoose.startSession();
  mongoSession.startTransaction();
  
  try {
    console.log('Processing payment failed:', failedPayment.id);
    console.log('Failed payment metadata:', failedPayment.metadata);
    
    const { orderId, bookingId, propertyId } = failedPayment.metadata;
    
    // Update booking status
    const booking = await Booked.findById(bookingId).session(mongoSession);
    if (booking) {
      booking.bookingStatus = 'cancelled';
      booking.payment.paymentStatus = 'failed';
      booking.payment.paymentIntentId = failedPayment.id;
      await booking.save({ session: mongoSession });
    }
    
    // Update order status
    const order = await Order.findById(orderId).session(mongoSession);
    if (order) {
      order.status = 'cancelled';
      order.payment.stripePaymentStatus = 'failed';
      order.payment.stripePaymentIntentId = failedPayment.id;
      await order.save({ session: mongoSession });
    }
    
    // Update payment record
    const payment = await Payment.findOne({ bookingId: bookingId }).session(mongoSession);
    if (payment) {
      payment.status = 'failed';
      payment.stripe.status = 'failed';
      await payment.save({ session: mongoSession });
    }
    
    // Release room availability
    if (propertyId && booking) {
      await updateRoomAvailability(
        propertyId,
        booking.checkInDate,
        booking.checkOutDate,
        booking.roomDetails.roomType,
        booking.roomDetails.quantity,
        'cancel',
        mongoSession
      );
    }
    
    await mongoSession.commitTransaction();
    
    console.log(`Payment failed for booking: ${bookingId}`);
    
  } catch (error) {
    await mongoSession.abortTransaction();
    console.error('Error handling payment failed:', error);
    throw error;
  } finally {
    mongoSession.endSession();
  }
};

// Handle payment canceled
const handlePaymentCanceled = async (canceledPayment) => {
  const mongoSession = await mongoose.startSession();
  mongoSession.startTransaction();
  
  try {
    console.log('Processing payment canceled:', canceledPayment.id);
    console.log('Canceled payment metadata:', canceledPayment.metadata);
    
    const { orderId, bookingId, propertyId } = canceledPayment.metadata;
    
    // Update booking status
    const booking = await Booked.findById(bookingId).session(mongoSession);
    if (booking) {
      booking.bookingStatus = 'cancelled';
      booking.payment.paymentStatus = 'failed';
      booking.payment.paymentIntentId = canceledPayment.id;
      await booking.save({ session: mongoSession });
    }
    
    // Update order status
    const order = await Order.findById(orderId).session(mongoSession);
    if (order) {
      order.status = 'cancelled';
      order.payment.stripePaymentStatus = 'canceled';
      order.payment.stripePaymentIntentId = canceledPayment.id;
      await order.save({ session: mongoSession });
    }
    
    // Update payment record
    const payment = await Payment.findOne({ bookingId: bookingId }).session(mongoSession);
    if (payment) {
      payment.status = 'failed';
      payment.stripe.status = 'cancelled';
      await payment.save({ session: mongoSession });
    }
    
    // Release room availability
    if (propertyId && booking) {
      await updateRoomAvailability(
        propertyId,
        booking.checkInDate,
        booking.checkOutDate,
        booking.roomDetails.roomType,
        booking.roomDetails.quantity,
        'cancel',
        mongoSession
      );
    }
    
    await mongoSession.commitTransaction();
    
    console.log(`Payment canceled for booking: ${bookingId}`);
    
  } catch (error) {
    await mongoSession.abortTransaction();
    console.error('Error handling payment canceled:', error);
    throw error;
  } finally {
    mongoSession.endSession();
  }
};
// Get booking details after successful payment
export const getBookingDetails = async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Find booking by session ID
    const booking = await Booked.findOne({
      'payment.paymentIntentId': sessionId
    })
    .populate('property', 'name title price image')
    .populate('userId', 'firstname lastname email mobile');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Find order
    const order = await Order.findOne({
      'payment.stripePaymentIntentId': sessionId
    });

    res.json({
      success: true,
      booking,
      order,
      session: {
        id: session.id,
        payment_status: session.payment_status,
        amount_total: session.amount_total,
        currency: session.currency
      }
    });

  } catch (error) {
    console.error('Error fetching booking details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booking details',
      error: error.message
    });
  }
};

// Get all bookings for a user
export const getUserBookings = async (req, res) => {
  try {
    const { userId } = req.user;
    const bookings = await Booked.find({ userId })
      .populate('property', 'name title price image')
      .populate('userId', 'firstname lastname email mobile')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      bookings
    });

  } catch (error) {
    console.error('Error fetching user bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings',
      error: error.message
    });
  }
};