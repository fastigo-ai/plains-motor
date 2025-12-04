// controllers/bookingController.js
import Order from '../../modals/payment/orderSchema.js';
import Payment from '../../modals/payment/paymentSchema.js';
import stripe from '../../config/stripe.js';
import mongoose from 'mongoose';
import { User } from '../../modals/auth/authModal.js';
import Booked from '../../modals/properties/bookedSchema.js';
import PropertyCard from '../../modals/properties/propertyModal.js';
import { sendEmail } from '../../utils/sendEmail.js';

// Table update helper function
// Table update helper function
// export const updateRoomAvailability = async (propertyId, checkInDate, checkOutDate, roomType, quantity, action = 'book', session = null) => {
//   try {
//     // Get property details
//     const property = await PropertyCard.findById(propertyId).populate('detail').session(session);
//     if (!property || !property.detail) {
//       throw new Error('Property or property details not found');
//     }

//    console.log(property)
//    console.log(property.detail)
//    console.log(roomType)
//     const propertyDetail = property.detail;

//     console.log(propertyDetail.roomType , "roomType")
//     // Validate room type matches
//     if (propertyDetail.roomType !== roomType) {
//       throw new Error(`Room type mismatch. Property has ${propertyDetail.roomType} rooms, requested ${roomType}`);
//     }

//     // Check if enough rooms are available
//     if (action === 'book' && propertyDetail.quantity < quantity) {
//       throw new Error(`Not enough ${roomType} rooms available. Available: ${propertyDetail.quantity}, Requested: ${quantity}`);
//     }

//     // Calculate date range for checking conflicts
//     const checkIn = new Date(checkInDate);
//     const checkOut = new Date(checkOutDate);

//     // Check for booking conflicts in the date range
//     const conflictingBookings = await Booked.find({
//       property: propertyId,
//       bookingStatus: { $in: ['confirmed', 'completed'] },
//       $or: [
//         {
//           checkInDate: { $lt: checkOut },
//           checkOutDate: { $gt: checkIn }
//         }
//       ]
//     }).session(session);

//     // Calculate total rooms booked during the period
//     const roomsBookedInPeriod = conflictingBookings.reduce((total, booking) => {
//       return total + (booking.roomDetails?.quantity || 1);
//     }, 0);

//     // Check availability
//     const availableRooms = propertyDetail.quantity - roomsBookedInPeriod;

//     if (action === 'book' && availableRooms < quantity) {
//       throw new Error(`Not enough rooms available for selected dates. Available: ${availableRooms}, Requested: ${quantity}`);
//     }

//     // Update property stock status based on availability
//     const shouldBeInStock = availableRooms > 0;

//     if (property.inStock !== shouldBeInStock) {
//       await PropertyCard.findByIdAndUpdate(
//         propertyId,
//         { inStock: shouldBeInStock },
//         { session }
//       );
//     }

//     return {
//       success: true,
//       availableRooms,
//       totalRooms: propertyDetail.quantity,
//       roomsBookedInPeriod,
//       propertyDetail
//     };

//   } catch (error) {
//     console.error('Room availability update error:', error);
//     throw error;
//   }
// };

// // Updated checkout session creation function
// export const createCheckoutSession = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const {
//       propertyId,
//       userId,
//       checkInDate,
//       checkOutDate,
//       totalStay,
//       roomDetails: {
//         roomType,
//         quantity,
//         allowedPersonsPerRoom,
//         extraPersons = 0,
//         extraPersonCharge = 0,
//         isSmokingAllowed = false,
//         smokingRoomCharge = 0,
//         isPetFriendly = false,
//         pets = 0,
//         petFeePerPet = 0
//       },
//       guests,
//       specialRequest = '',
//       user: { firstname, lastname, phone },
//       totalAmount,
//       currency = 'cad'
//     } = req.body;

//     // Validate required fields
//     if (!propertyId || !userId || !checkInDate || !checkOutDate || !totalStay || 
//         !roomType || !quantity || !allowedPersonsPerRoom || !guests || !totalAmount) {
//       await session.abortTransaction();
//       return res.status(400).json({
//         success: false,
//         message: 'Missing required fields'
//       });
//     }

//     // Validate property exists and get details
//     const property = await PropertyCard.findById(propertyId)
//       .populate('detail')
//       .session(session);

//     if (!property) {
//       await session.abortTransaction();
//       return res.status(404).json({
//         success: false,
//         message: 'Property not found'
//       });
//     }

//     if (!property.inStock) {
//       await session.abortTransaction();
//       return res.status(400).json({
//         success: false,
//         message: 'Property is not available for booking'
//       });
//     }

//     // Validate room availability FIRST
//     const roomAvailability = await updateRoomAvailability(
//       propertyId, 
//       checkInDate, 
//       checkOutDate, 
//       roomType, 
//       quantity, 
//       'book', 
//       session
//     );

//     // Validate user exists
//     const existingUser = await User.findById(userId).session(session);
//     if (!existingUser) {
//       await session.abortTransaction();
//       return res.status(404).json({
//         success: false,
//         message: 'User not found'
//       });
//     }

//     // Update user information if provided
//     if (firstname || lastname || phone) {
//       const updateData = {};
//       if (firstname) updateData.firstname = firstname;
//       if (lastname) updateData.lastname = lastname;
//       if (phone) updateData.mobile = phone;

//       await User.findByIdAndUpdate(
//         userId,
//         updateData,
//         { session, runValidators: true }
//       );
//     }

//     // Validate dates
//     const checkIn = new Date(checkInDate);
//     const checkOut = new Date(checkOutDate);
//     const today = new Date();
//     today.setHours(0, 0, 0, 0);

//     if (checkIn < today) {
//       await session.abortTransaction();
//       return res.status(400).json({
//         success: false,
//         message: 'Check-in date cannot be in the past'
//       });
//     }

//     if (checkOut <= checkIn) {
//       await session.abortTransaction();
//       return res.status(400).json({
//         success: false,
//         message: 'Check-out date must be after check-in date'
//       });
//     }

//     // Validate guest capacity
//     const totalGuests = guests.adults + (guests.children || 0) + (guests.infants || 0);
//     const maxCapacity = (allowedPersonsPerRoom * quantity) + extraPersons;

//     if (totalGuests > maxCapacity) {
//       await session.abortTransaction();
//       return res.status(400).json({
//         success: false,
//         message: `Too many guests. Maximum capacity: ${maxCapacity}, Requested: ${totalGuests}`
//       });
//     }

//     // Validate pet policy
//     if (pets > 0 && !isPetFriendly) {
//       await session.abortTransaction();
//       return res.status(400).json({
//         success: false,
//         message: 'Pets are not allowed in this property'
//       });
//     }

//     if (pets > roomAvailability.propertyDetail.allowedPets) {
//       await session.abortTransaction();
//       return res.status(400).json({
//         success: false,
//         message: `Too many pets. Maximum allowed: ${roomAvailability.propertyDetail.allowedPets}, Requested: ${pets}`
//       });
//     }

//     // Check for existing bookings by the same user for the same property
//     const existingUserBookings = await Booked.find({
//       property: propertyId,
//       userId: userId,
//       bookingStatus: { $in: ['pending', 'confirmed', 'completed'] }
//     }).session(session);

//     // Check for exact same dates by same user
//     const duplicateBooking = existingUserBookings.find(booking => {
//       return booking.checkInDate.getTime() === checkIn.getTime() && 
//              booking.checkOutDate.getTime() === checkOut.getTime();
//     });

//     // NEW LOGIC: Only prevent duplicate booking if no rooms are available
//     if (duplicateBooking) {
//       // Calculate current room usage for the same dates
//       const sameUserSameDateBookings = await Booked.find({
//         property: propertyId,
//         userId: userId,
//         checkInDate: checkIn,
//         checkOutDate: checkOut,
//         bookingStatus: { $in: ['pending', 'confirmed', 'completed'] }
//       }).session(session);

//       // Calculate total rooms this user has booked for these exact dates
//       const userRoomsForSameDates = sameUserSameDateBookings.reduce((total, booking) => {
//         return total + (booking.roomDetails?.quantity || 1);
//       }, 0);

//       // Check if adding more rooms would exceed availability
//       const totalRoomsAfterBooking = userRoomsForSameDates + quantity;
//       const availableRoomsAfterExisting = roomAvailability.availableRooms + userRoomsForSameDates;

//       if (totalRoomsAfterBooking > availableRoomsAfterExisting) {
//         await session.abortTransaction();
//         return res.status(400).json({
//           success: false,
//           message: `You already have a booking for this property on the same dates. No additional rooms available for these dates. Available: ${availableRoomsAfterExisting - userRoomsForSameDates}, Requested: ${quantity}`,
//           details: {
//             userCurrentRooms: userRoomsForSameDates,
//             requestedRooms: quantity,
//             availableRooms: availableRoomsAfterExisting - userRoomsForSameDates,
//             totalPropertyRooms: roomAvailability.totalRooms
//           }
//         });
//       }
//     }

//     // Check for consecutive dates (add-on booking)
//     const consecutiveBooking = existingUserBookings.find(booking => {
//       const existingCheckOut = new Date(booking.checkOutDate);
//       const existingCheckIn = new Date(booking.checkInDate);

//       return existingCheckOut.getTime() === checkIn.getTime() ||
//              checkOut.getTime() === existingCheckIn.getTime();
//     });

//     let isExtension = false;
//     let originalBooking = null;

//     if (consecutiveBooking && !duplicateBooking) {
//       isExtension = true;
//       originalBooking = consecutiveBooking;
//     }

//     // Generate unique IDs
//     const timestamp = Date.now();
//     const randomSuffix = Math.random().toString(36).substr(2, 9);
//     const userSuffix = userId.toString().substr(-4);

//     const orderId = `ORDER-${timestamp}-${userSuffix}-${randomSuffix}`;
//     const paymentId = `PAY-${timestamp}-${userSuffix}-${randomSuffix}`;

//     let savedBooking;
//     let bookingAction = 'created';

//     if (isExtension && originalBooking && !duplicateBooking) {
//       // Extend existing booking
//       const newCheckIn = new Date(Math.min(originalBooking.checkInDate.getTime(), checkIn.getTime()));
//       const newCheckOut = new Date(Math.max(originalBooking.checkOutDate.getTime(), checkOut.getTime()));
//       const newTotalStay = Math.ceil((newCheckOut - newCheckIn) / (1000 * 60 * 60 * 24));

//       // Update existing booking
//       originalBooking.checkInDate = newCheckIn;
//       originalBooking.checkOutDate = newCheckOut;
//       originalBooking.totalStay = newTotalStay;
//       originalBooking.totalAmount = originalBooking.totalAmount + totalAmount;

//       // Update room details if extending with different room configuration
//       if (quantity > originalBooking.roomDetails.quantity) {
//         originalBooking.roomDetails.quantity = quantity;
//       }

//       // Update guests if new booking has more guests
//       if (guests.adults > originalBooking.guests.adults) {
//         originalBooking.guests.adults = guests.adults;
//       }
//       if (guests.children > originalBooking.guests.children) {
//         originalBooking.guests.children = guests.children;
//       }
//       if (guests.infants > originalBooking.guests.infants) {
//         originalBooking.guests.infants = guests.infants;
//       }

//       // Update pet details
//       if (pets > originalBooking.roomDetails.pets) {
//         originalBooking.roomDetails.pets = pets;
//       }

//       // Append special request if provided
//       if (specialRequest) {
//         originalBooking.specialRequest = originalBooking.specialRequest 
//           ? `${originalBooking.specialRequest}; ${specialRequest}`
//           : specialRequest;
//       }

//       savedBooking = await originalBooking.save({ session });
//       bookingAction = 'extended';

//     } else {
//       // Create new booking (including additional rooms for same dates)
//       const booking = new Booked({
//         property: propertyId,
//         userId,
//         checkInDate: checkIn,
//         checkOutDate: checkOut,
//         totalStay,
//         roomDetails: {
//           roomType,
//           quantity,
//           allowedPersonsPerRoom,
//           extraPersons,
//           extraPersonCharge,
//           isSmokingAllowed,
//           smokingRoomCharge,
//           isPetFriendly,
//           pets,
//           petFeePerPet
//         },
//         guests: {
//           adults: guests.adults,
//           children: guests.children || 0,
//           infants: guests.infants || 0
//         },
//         specialRequest,
//         totalAmount,
//         bookingStatus: 'pending'
//       });

//       savedBooking = await booking.save({ session });
//       bookingAction = duplicateBooking ? 'additional_rooms' : 'created';
//     }

//     // Create order
//     const order = new Order({
//       orderId: orderId,
//       property: propertyId,
//       customer: {
//         name: `${firstname || existingUser.firstname} ${lastname || existingUser.lastname}`,
//         email: existingUser.email,
//         phone: phone || existingUser.mobile
//       },
//       booking: {
//         checkIn: savedBooking.checkInDate,
//         checkOut: savedBooking.checkOutDate,
//         guests: savedBooking.guests.adults + savedBooking.guests.children + savedBooking.guests.infants,
//         nights: savedBooking.totalStay,
//         rooms: savedBooking.roomDetails.quantity,
//         roomType: savedBooking.roomDetails.roomType,
//         specialRequest: savedBooking.specialRequest
//       },
//       payment: {
//         amount: totalAmount * 100,
//         currency,
//         stripePaymentIntentId: '',
//         stripePaymentStatus: 'pending'
//       },
//       bookingId: savedBooking._id,
//       notes: isExtension ? `Extension payment for existing booking` : (duplicateBooking ? 'Additional rooms for same dates' : ''),
//       metadata: {
//         isExtension: isExtension.toString(),
//         isAdditionalRooms: duplicateBooking ? 'true' : 'false',
//         originalBookingId: originalBooking?._id?.toString() || '',
//         bookingAction: bookingAction
//       }
//     });

//     const savedOrder = await order.save({ session });

//     // Define the base URL for your frontend
//     const baseUrl = process.env.CLIENT_URL || 'http://localhost:3000';

//     // Create detailed line item description
//     const lineItemDescription = `${totalStay} night(s) stay - ${quantity} ${roomType} room(s) - ${guests.adults} adults, ${guests.children || 0} children${pets > 0 ? `, ${pets} pet(s)` : ''}${extraPersons > 0 ? `, ${extraPersons} extra person(s)` : ''}${isSmokingAllowed ? ', smoking allowed' : ''}`;

//     // Create Stripe Checkout Session
//     const checkoutSession = await stripe.checkout.sessions.create({
//       payment_method_types: ['card'],
//       line_items: [
//         {
//           price_data: {
//             currency: currency,
//             product_data: {
//               name: `${property.name} ${isExtension ? '(Extension)' : duplicateBooking ? '(Additional Rooms)' : ''}`,
//               description: isExtension 
//                 ? `Extension: ${lineItemDescription}`
//                 : duplicateBooking 
//                   ? `Additional Rooms: ${lineItemDescription}`
//                   : lineItemDescription,
//               images: property.image ? [property.image] : [],
//             },
//             unit_amount: Math.floor(totalAmount) * 100,
//           },
//           quantity: 1,
//         },
//       ],
//       mode: 'payment',
//       success_url: `${baseUrl}/payment-success`,
//       cancel_url: `${baseUrl}`,
//       metadata: {
//         orderId: savedOrder._id.toString(),
//         bookingId: savedBooking._id.toString(),
//         propertyId: propertyId,
//         userId: userId,
//         customOrderId: orderId,
//         isExtension: isExtension.toString(),
//         isAdditionalRooms: duplicateBooking ? 'true' : 'false',
//         bookingAction: bookingAction,
//         roomType: roomType,
//         roomQuantity: quantity.toString()
//       },
//       customer_email: existingUser.email,
//       billing_address_collection: 'required',
//       phone_number_collection: {
//         enabled: true,
//       },
//       allow_promotion_codes: true,
//       automatic_tax: {
//         enabled: false,
//       },
//       custom_text: {
//         submit: {
//           message: `Complete your ${isExtension ? 'extension' : duplicateBooking ? 'additional room' : 'booking'} payment securely.`
//         }
//       },
//       expires_at: Math.floor(Date.now() / 1000) + (24 * 60 * 60),
//       locale: 'auto',
//       payment_intent_data: {
//         metadata: {
//           orderId: savedOrder._id.toString(),
//           bookingId: savedBooking._id.toString(),
//           propertyId: propertyId,
//           userId: userId,
//           customOrderId: orderId,
//           isExtension: isExtension.toString(),
//           isAdditionalRooms: duplicateBooking ? 'true' : 'false',
//           bookingAction: bookingAction,
//           roomType: roomType,
//           roomQuantity: quantity.toString()
//         }
//       }
//     });

//     // Create payment record
//     const payment = new Payment({
//       paymentId: paymentId,
//       order: savedOrder._id,
//       stripe: {
//         paymentIntentId: checkoutSession.payment_intent || checkoutSession.id,
//         clientSecret: checkoutSession.id,
//         status: 'requires_payment_method'
//       },
//       amount: Math.floor(totalAmount) * 100,
//       currency,
//       netAmount: Math.floor(totalAmount) * 100,
//       status: 'pending',
//       bookingId: savedBooking._id
//     });

//     await payment.save({ session });

//     // Update booking and order with session info
//     savedBooking.payment = {
//       paymentIntentId: checkoutSession.payment_intent || checkoutSession.id,
//       paymentStatus: 'pending'
//     };

//     await savedBooking.save({ session });

//     savedOrder.payment.stripePaymentIntentId = checkoutSession.payment_intent || checkoutSession.id;
//     await savedOrder.save({ session });

//     await session.commitTransaction();

//     res.status(201).json({
//       success: true,
//       message: `Checkout session ${bookingAction} successfully`,
//       sessionId: checkoutSession.id,
//       url: checkoutSession.url,
//       bookingId: savedBooking._id,
//       orderId: savedOrder._id,
//       customOrderId: orderId,
//       bookingAction: bookingAction,
//       isExtension: isExtension,
//       isAdditionalRooms: duplicateBooking || false,
//       roomAvailability: {
//         availableRooms: roomAvailability.availableRooms,
//         totalRooms: roomAvailability.totalRooms,
//         bookedRooms: roomAvailability.roomsBookedInPeriod
//       },
//       redirectUrls: {
//         success: `${baseUrl}/booking-success?session_id=${checkoutSession.id}&action=${bookingAction}&booking_id=${savedBooking._id}&order_id=${savedOrder._id}`,
//         cancel: `${baseUrl}/booking-cancel?session_id=${checkoutSession.id}&action=${bookingAction}&booking_id=${savedBooking._id}&property_id=${propertyId}`,
//         return: `${baseUrl}/confirm?property_id=${propertyId}&check_in=${checkInDate}&check_out=${checkOutDate}&guests=${JSON.stringify(guests)}&rooms=${quantity}&room_type=${roomType}`
//       },
//       bookingDetails: {
//         checkInDate: savedBooking.checkInDate,
//         checkOutDate: savedBooking.checkOutDate,
//         totalStay: savedBooking.totalStay,
//         totalAmount: savedBooking.totalAmount,
//         currentPaymentAmount: Math.floor(totalAmount),
//         roomDetails: savedBooking.roomDetails,
//         guests: savedBooking.guests
//       }
//     });

//   } catch (error) {
//     await session.abortTransaction();
//     console.error('Checkout session creation error:', error);

//     // Handle specific errors
//     if (error.message.includes('Not enough rooms available') || 
//         error.message.includes('Too many guests') ||
//         error.message.includes('Pets are not allowed') ||
//         error.message.includes('Too many pets') ||
//         error.message.includes('You already have a booking for this property on the same dates')) {
//       return res.status(400).json({
//         success: false,
//         message: error.message,
//         redirectUrl: `${process.env.CLIENT_URL || 'http://localhost:3000'}/confirm`
//       });
//     }

//     if (error.code === 11000) {
//       console.error('Duplicate key error details:', {
//         keyPattern: error.keyPattern,
//         keyValue: error.keyValue,
//         message: error.message
//       });

//       return res.status(400).json({
//         success: false,
//         message: 'Booking conflict detected. Please try again.',
//         redirectUrl: `${process.env.CLIENT_URL || 'http://localhost:3000'}/confirm`
//       });
//     }

//     // Handle Stripe errors
//     if (error.type === 'StripeCardError' || error.type === 'StripeInvalidRequestError') {
//       return res.status(400).json({
//         success: false,
//         message: 'Payment processing error: ' + error.message,
//         redirectUrl: `${process.env.CLIENT_URL || 'http://localhost:3000'}/confirm`
//       });
//     }

//     res.status(500).json({
//       success: false,
//       message: 'Failed to create checkout session',
//       error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
//       redirectUrl: `${process.env.CLIENT_URL || 'http://localhost:3000'}/confirm`
//     });
//   } finally {
//     session.endSession();
//   }
// };

// export const handleStripeWebhook = async (req, res) => {
//   console.log("Running Stripe Webhook Event");

//   const sig = req.headers['stripe-signature'];
//   let event;

//   try {
//     event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
//   } catch (err) {
//     console.error(`Webhook signature verification failed:`, err.message);
//     return res.status(400).send(`Webhook Error: ${err.message}`);
//   }

//   console.log(`Processing event type: ${event.type}`);


//   try {
//     switch (event.type) {
//       case 'checkout.session.completed':
//         const session = event.data.object;

//         await handleSuccessfulPayment(session);
//         await sendEmail({
//           to: session.customer_details.email,
//           subject: 'Booking Confirmed',
//           text: 'Your booking has been confirmed.',
//           html: '<p>Your booking has been confirmed.</p>'
//         });
//         break;

//       case 'payment_intent.succeeded':
//         const paymentIntent = event.data.object;
//         await handlePaymentIntentSucceeded(paymentIntent);
//         await sendEmail({
//           to: session.customer_details.email,
//           subject: 'Booking Confirmed',
//           text: 'Your booking has been confirmed.',
//           html: '<p>Your booking has been confirmed.</p>'
//         });
//         break;

//       case 'payment_intent.payment_failed':
//         const failedPayment = event.data.object;  
//         await handlePaymentFailed(failedPayment);
//         await sendEmail({
//           to: session.customer_details.email,
//           subject: 'Booking Failed',
//           text: 'Your booking has been failed.',
//           html: '<p>Your booking has been failed.</p>'
//         });
//         break;

//       case 'payment_intent.canceled':
//         const canceledPayment = event.data.object;
//         await handlePaymentCanceled(canceledPayment);
//         await sendEmail({
//           to: session.customer_details.email,
//           subject: 'Booking Canceled',
//           text: 'Your booking has been canceled.',
//           html: '<p>Your booking has been canceled.</p>'
//         });
//         break;

//       default:
//         console.log(`Unhandled event type: ${event.type}`);
//     }

//     res.json({ received: true });
//   } catch (error) {
//     console.error('Error processing webhook:', error);
//     res.status(500).json({ error: 'Webhook processing failed' });
//   }
// };

// Handle successful checkout session completion
const handleSuccessfulPayment = async (session) => {
  return await retryWithBackoff(async () => {
    const mongoSession = await mongoose.startSession();

    try {
      await mongoSession.withTransaction(async () => {
        console.log('Processing successful payment for session:', session.id);
        console.log('Session metadata:', session.metadata);

        const { orderId, bookingId, propertyId, isExtension, isAdditionalRooms, bookingAction } = session.metadata;

        if (!orderId || !bookingId) {
          throw new Error('Missing required metadata in session');
        }

        // Check if booking is already confirmed to prevent duplicate processing
        const existingBooking = await Booked.findById(bookingId).session(mongoSession);
        if (!existingBooking) {
          throw new Error(`Booking not found: ${bookingId}`);
        }

        if (existingBooking.bookingStatus === 'confirmed' && existingBooking.payment?.paymentIntentId === session.payment_intent) {
          console.log(`Payment already processed for booking: ${bookingId}`);
          return; // Skip processing if already confirmed with same payment intent
        }

        // Use findOneAndUpdate for atomic updates to prevent write conflicts
        const updatedBooking = await Booked.findByIdAndUpdate(
          bookingId,
          {
            $set: {
              bookingStatus: 'confirmed',
              'payment.paymentStatus': 'succeeded',
              'payment.paymentIntentId': session.payment_intent,
              'payment.updatedAt': new Date()
            }
          },
          {
            session: mongoSession,
            new: true,
            runValidators: true
          }
        );

        if (!updatedBooking) {
          throw new Error(`Failed to update booking: ${bookingId}`);
        }

        // Update order status atomically
        const updatedOrder = await Order.findByIdAndUpdate(
          orderId,
          {
            $set: {
              status: 'confirmed',
              'payment.stripePaymentStatus': 'succeeded',
              'payment.stripePaymentIntentId': session.payment_intent,
              'payment.updatedAt': new Date()
            }
          },
          {
            session: mongoSession,
            new: true,
            runValidators: true
          }
        );

        if (!updatedOrder) {
          throw new Error(`Failed to update order: ${orderId}`);
        }

        // Update payment record atomically
        const paymentUpdate = {
          $set: {
            status: 'succeeded',
            'stripe.status': 'succeeded',
            updatedAt: new Date()
          }
        };

        // Add payment method details if available
        if (session.payment_method_types && session.payment_method_types.length > 0) {
          paymentUpdate.$set['paymentMethod.type'] = session.payment_method_types[0];
        }

        await Payment.findOneAndUpdate(
          { bookingId: bookingId },
          paymentUpdate,
          {
            session: mongoSession,
            new: true,
            upsert: false
          }
        );

        // Update room availability if needed
        if (propertyId) {
          await updateRoomAvailability(
            propertyId,
            updatedBooking.checkInDate,
            updatedBooking.checkOutDate,
            updatedBooking.roomDetails.roomType,
            updatedBooking.roomDetails.quantity,
            'confirm',
            mongoSession
          );
        }
      }, {
        readPreference: 'primary',
        readConcern: { level: 'majority' },
        writeConcern: { w: 'majority', j: true }
      });

      // Send emails after successful transaction (outside of transaction to avoid delays)
      try {
        await sendBookingEmails('confirmed', session.metadata.bookingId, session);
        console.log(`Payment successful for booking: ${session.metadata.bookingId}, action: ${session.metadata.bookingAction}`);
      } catch (emailError) {
        console.error('Error sending booking emails:', emailError);
        // Don't throw here as the payment was successful
      }

    } finally {
      await mongoSession.endSession();
    }
  });
};

// Handle payment intent succeeded (backup handler)
const handlePaymentIntentSucceeded = async (paymentIntent) => {
  return await retryWithBackoff(async () => {
    const mongoSession = await mongoose.startSession();

    try {
      await mongoSession.withTransaction(async () => {
        console.log('Processing payment intent succeeded:', paymentIntent.id);
        console.log('Payment intent metadata:', paymentIntent.metadata);

        const { orderId, bookingId, propertyId, bookingAction } = paymentIntent.metadata;

        if (!orderId || !bookingId) {
          console.log('Missing metadata in payment intent, skipping...');
          return;
        }

        // Check if already processed by checkout.session.completed
        const existingBooking = await Booked.findById(bookingId).session(mongoSession);
        if (!existingBooking) {
          console.log(`Booking not found: ${bookingId}`);
          return;
        }

        if (existingBooking.bookingStatus === 'confirmed') {
          console.log('Payment already processed by checkout.session.completed or previous payment_intent.succeeded');
          return;
        }

        // Use atomic updates to prevent write conflicts
        const updatedBooking = await Booked.findByIdAndUpdate(
          bookingId,
          {
            $set: {
              bookingStatus: 'confirmed',
              'payment.paymentStatus': 'succeeded',
              'payment.paymentIntentId': paymentIntent.id,
              'payment.updatedAt': new Date()
            }
          },
          {
            session: mongoSession,
            new: true,
            runValidators: true
          }
        );

        if (!updatedBooking) {
          throw new Error(`Failed to update booking: ${bookingId}`);
        }

        // Update order status atomically
        await Order.findByIdAndUpdate(
          orderId,
          {
            $set: {
              status: 'confirmed',
              'payment.stripePaymentStatus': 'succeeded',
              'payment.stripePaymentIntentId': paymentIntent.id,
              'payment.updatedAt': new Date()
            }
          },
          {
            session: mongoSession,
            new: true,
            runValidators: true
          }
        );

        // Update payment record atomically
        const paymentUpdate = {
          $set: {
            status: 'succeeded',
            'stripe.status': 'succeeded',
            updatedAt: new Date()
          }
        };

        // Add charge details if available
        if (paymentIntent.charges && paymentIntent.charges.data.length > 0) {
          const charge = paymentIntent.charges.data[0];
          paymentUpdate.$set['stripe.charges'] = [{
            chargeId: charge.id,
            amount: charge.amount,
            status: charge.status,
            receiptUrl: charge.receipt_url,
            created: new Date(charge.created * 1000)
          }];

          // Add payment method details
          if (charge.payment_method_details && charge.payment_method_details.card) {
            const card = charge.payment_method_details.card;
            paymentUpdate.$set.paymentMethod = {
              type: 'card',
              last4: card.last4,
              brand: card.brand,
              expMonth: card.exp_month,
              expYear: card.exp_year
            };
          }
        }

        await Payment.findOneAndUpdate(
          { bookingId: bookingId },
          paymentUpdate,
          {
            session: mongoSession,
            new: true,
            upsert: false
          }
        );
      }, {
        readPreference: 'primary',
        readConcern: { level: 'majority' },
        writeConcern: { w: 'majority', j: true }
      });

      // Send emails after successful transaction
      try {
        await sendBookingEmails('confirmed', paymentIntent.metadata.bookingId, paymentIntent);
        console.log(`Payment intent succeeded for booking: ${paymentIntent.metadata.bookingId}, action: ${paymentIntent.metadata.bookingAction}`);
      } catch (emailError) {
        console.error('Error sending booking emails:', emailError);
        // Don't throw here as the payment was successful
      }

    } finally {
      await mongoSession.endSession();
    }
  });
};

// Handle payment failed
const handlePaymentFailed = async (failedPayment) => {
  return await retryWithBackoff(async () => {
    const mongoSession = await mongoose.startSession();

    try {
      await mongoSession.withTransaction(async () => {
        console.log('Processing payment failed:', failedPayment.id);
        console.log('Failed payment metadata:', failedPayment.metadata);

        const { orderId, bookingId, propertyId } = failedPayment.metadata;

        if (!orderId || !bookingId) {
          console.log('Missing metadata in failed payment, skipping...');
          return;
        }

        // Update booking status atomically
        const updatedBooking = await Booked.findByIdAndUpdate(
          bookingId,
          {
            $set: {
              bookingStatus: 'cancelled',
              'payment.paymentStatus': 'failed',
              'payment.paymentIntentId': failedPayment.id,
              'payment.updatedAt': new Date()
            }
          },
          {
            session: mongoSession,
            new: true,
            runValidators: true
          }
        );

        // Update order status atomically
        if (updatedBooking) {
          await Order.findByIdAndUpdate(
            orderId,
            {
              $set: {
                status: 'cancelled',
                'payment.stripePaymentStatus': 'failed',
                'payment.stripePaymentIntentId': failedPayment.id,
                'payment.updatedAt': new Date()
              }
            },
            {
              session: mongoSession,
              new: true,
              runValidators: true
            }
          );
        }

        // Update payment record atomically
        await Payment.findOneAndUpdate(
          { bookingId: bookingId },
          {
            $set: {
              status: 'failed',
              'stripe.status': 'failed',
              updatedAt: new Date()
            }
          },
          {
            session: mongoSession,
            new: true,
            upsert: false
          }
        );

        // Release room availability
        if (propertyId && updatedBooking) {
          await updateRoomAvailability(
            propertyId,
            updatedBooking.checkInDate,
            updatedBooking.checkOutDate,
            updatedBooking.roomDetails.roomType,
            updatedBooking.roomDetails.quantity,
            'cancel',
            mongoSession
          );
        }
      }, {
        readPreference: 'primary',
        readConcern: { level: 'majority' },
        writeConcern: { w: 'majority', j: true }
      });

      // Send emails after successful transaction
      try {
        await sendBookingEmails('failed', failedPayment.metadata.bookingId, failedPayment);
        console.log(`Payment failed for booking: ${failedPayment.metadata.bookingId}`);
      } catch (emailError) {
        console.error('Error sending booking emails:', emailError);
      }

    } finally {
      await mongoSession.endSession();
    }
  });
};

// Handle payment canceled
const handlePaymentCanceled = async (canceledPayment) => {
  return await retryWithBackoff(async () => {
    const mongoSession = await mongoose.startSession();

    try {
      await mongoSession.withTransaction(async () => {
        console.log('Processing payment canceled:', canceledPayment.id);
        console.log('Canceled payment metadata:', canceledPayment.metadata);

        const { orderId, bookingId, propertyId } = canceledPayment.metadata;

        if (!orderId || !bookingId) {
          console.log('Missing metadata in canceled payment, skipping...');
          return;
        }

        // Update booking status atomically
        const updatedBooking = await Booked.findByIdAndUpdate(
          bookingId,
          {
            $set: {
              bookingStatus: 'cancelled',
              'payment.paymentStatus': 'failed',
              'payment.paymentIntentId': canceledPayment.id,
              'payment.updatedAt': new Date()
            }
          },
          {
            session: mongoSession,
            new: true,
            runValidators: true
          }
        );

        // Update order status atomically
        if (updatedBooking) {
          await Order.findByIdAndUpdate(
            orderId,
            {
              $set: {
                status: 'cancelled',
                'payment.stripePaymentStatus': 'canceled',
                'payment.stripePaymentIntentId': canceledPayment.id,
                'payment.updatedAt': new Date()
              }
            },
            {
              session: mongoSession,
              new: true,
              runValidators: true
            }
          );
        }

        // Update payment record atomically
        await Payment.findOneAndUpdate(
          { bookingId: bookingId },
          {
            $set: {
              status: 'failed',
              'stripe.status': 'cancelled',
              updatedAt: new Date()
            }
          },
          {
            session: mongoSession,
            new: true,
            upsert: false
          }
        );

        // Release room availability
        if (propertyId && updatedBooking) {
          await updateRoomAvailability(
            propertyId,
            updatedBooking.checkInDate,
            updatedBooking.checkOutDate,
            updatedBooking.roomDetails.roomType,
            updatedBooking.roomDetails.quantity,
            'cancel',
            mongoSession
          );
        }
      }, {
        readPreference: 'primary',
        readConcern: { level: 'majority' },
        writeConcern: { w: 'majority', j: true }
      });

      // Send emails after successful transaction
      try {
        await sendBookingEmails('canceled', canceledPayment.metadata.bookingId, canceledPayment);
        console.log(`Payment canceled for booking: ${canceledPayment.metadata.bookingId}`);
      } catch (emailError) {
        console.error('Error sending booking emails:', emailError);
      }

    } finally {
      await mongoSession.endSession();
    }
  });
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

//// New Updated controller with the email 
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

    console.log(propertyDetail.roomType, "roomType")
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
      bookingStatus: { $in: ['confirmed', 'completed'] },
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

    console.log(shouldBeInStock, "adads")

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
      user: {
        firstname,
        lastname,
        phone,
        email  // Accept email in the request
      },
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

    console.log(roomAvailability, "roomAvailability")

    // Validate user exists
    const existingUser = await User.findById(userId).session(session);
    if (!existingUser) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update user information if provided (including email)
    const updateData = {};
    if (firstname) updateData.firstname = firstname;
    if (lastname) updateData.lastname = lastname;
    if (phone) updateData.mobile = phone;
    if (email) updateData.email = email;

    if (Object.keys(updateData).length > 0) {
      await User.findByIdAndUpdate(
        userId,
        updateData,
        { session, runValidators: true }
      );

      // Update existingUser object with new data for use in response
      Object.assign(existingUser, updateData);
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
        email: email || existingUser.email,
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
      success_url: `${baseUrl}/payment-success`,
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
        roomQuantity: quantity.toString(),
        userEmail: email || existingUser.email,
        userName: `${firstname || existingUser.firstname} ${lastname || existingUser.lastname}`,
        userPhone: phone || existingUser.mobile
      },
      customer_email: email || existingUser.email,
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
          roomQuantity: quantity.toString(),
          userEmail: email || existingUser.email,
          userName: `${firstname || existingUser.firstname} ${lastname || existingUser.lastname}`,
          userPhone: phone || existingUser.mobile
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


// Utility function to retry operations with exponential backoff
const retryWithBackoff = async (operation, maxRetries = 3, baseDelay = 1000) => {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Check if this is a retryable error
      const isRetryable = error.code === 112 || // WriteConflict
        error.code === 11000 || // DuplicateKey
        error.errorLabels?.includes('TransientTransactionError') ||
        error.message?.includes('Write conflict');

      if (!isRetryable || attempt === maxRetries - 1) {
        throw error;
      }

      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      console.log(`Retrying operation after ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};

// Create a simple webhook event tracking schema (you might want to create a separate model file)
const WebhookEvent = mongoose.model('WebhookEvent', new mongoose.Schema({
  eventId: { type: String, required: true, unique: true },
  eventType: { type: String, required: true },
  processedAt: { type: Date, default: Date.now },
  bookingId: String,
  orderId: String,
  status: { type: String, enum: ['processed', 'failed'], default: 'processed' },
  retryCount: { type: Number, default: 0 },
  errorMessage: String
}, {
  timestamps: true,
  expires: '30d' // Auto-delete after 30 days
}));

// Utility function to check if event was already processed
const checkEventProcessed = async (eventId, eventType) => {
  try {
    const existingEvent = await WebhookEvent.findOne({ eventId });
    if (existingEvent) {
      console.log(`Event ${eventId} already processed at ${existingEvent.processedAt}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error checking event processing status:', error);
    return false;
  }
};

// Utility function to mark event as processed
const markEventProcessed = async (eventId, eventType, bookingId, orderId, status = 'processed', errorMessage = null) => {
  try {
    await WebhookEvent.findOneAndUpdate(
      { eventId },
      {
        eventId,
        eventType,
        bookingId,
        orderId,
        status,
        errorMessage,
        processedAt: new Date()
      },
      { upsert: true, new: true }
    );
  } catch (error) {
    console.error('Error marking event as processed:', error);
    // Don't throw here as this is not critical
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

  console.log(`Processing event type: ${event.type} with ID: ${event.id}`);

  let bookingId = null;
  let orderId = null;

  try {
    // Extract metadata for tracking
    const eventData = event.data.object;
    if (eventData.metadata) {
      bookingId = eventData.metadata.bookingId;
      orderId = eventData.metadata.orderId;
    }

    // Check if this event was already processed (idempotency check)
    const alreadyProcessed = await checkEventProcessed(event.id, event.type);
    if (alreadyProcessed) {
      console.log(`Event ${event.id} already processed, skipping`);
      return res.json({ received: true, status: 'already_processed' });
    }

    // Wrap the entire webhook processing in retry logic
    await retryWithBackoff(async () => {
      switch (event.type) {
        case 'checkout.session.completed':
          const session = event.data.object;
          console.log('Checkout session completed:', session.id);
          await handleSuccessfulPayment(session);
          break;

        case 'payment_intent.succeeded':
          const paymentIntent = event.data.object;
          console.log('Payment intent succeeded:', paymentIntent.id);
          await handlePaymentIntentSucceeded(paymentIntent);
          break;

        case 'payment_intent.payment_failed':
          const failedPayment = event.data.object;
          console.log('Payment intent failed:', failedPayment.id);
          await handlePaymentFailed(failedPayment);
          break;

        case 'payment_intent.canceled':
          const canceledPayment = event.data.object;
          console.log('Payment intent canceled:', canceledPayment.id);
          await handlePaymentCanceled(canceledPayment);
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
    });

    // Mark event as successfully processed
    await markEventProcessed(event.id, event.type, bookingId, orderId, 'processed');

    console.log(`Successfully processed webhook event ${event.id} of type ${event.type}`);
    res.json({ received: true, status: 'processed' });

  } catch (error) {
    console.error('Error processing webhook after retries:', error);

    // Mark event as failed for tracking
    await markEventProcessed(event.id, event.type, bookingId, orderId, 'failed', error.message);

    // Return 500 for retryable errors so Stripe will retry
    const isRetryable = error.code === 112 ||
      error.code === 11000 ||
      error.errorLabels?.includes('TransientTransactionError') ||
      error.message?.includes('Write conflict') ||
      error.message?.includes('Connection') ||
      error.message?.includes('timeout');

    if (isRetryable) {
      console.log(`Retryable error for event ${event.id}: ${error.message}`);
      res.status(500).json({
        error: 'Webhook processing failed - retryable error',
        eventId: event.id,
        code: error.code,
        message: error.message
      });
    } else {
      // Return 400 for non-retryable errors
      console.log(`Non-retryable error for event ${event.id}: ${error.message}`);
      res.status(400).json({
        error: 'Webhook processing failed - non-retryable error',
        eventId: event.id,
        code: error.code,
        message: error.message
      });
    }
  }
};



// Helper function to get booking and property details
const getBookingDetail = async (bookingId, session = null) => {
  try {
    const booking = await Booked.findById(bookingId)
      .populate('property')
      .populate('userId')
      .session(session);

    if (!booking) {
      throw new Error('Booking not found');
    }

    return {
      booking,
      property: booking.property,
      user: booking.userId
    };
  } catch (error) {
    console.error('Error fetching booking details:', error);
    throw error;
  }
};

const sendBookingEmails = async (status, bookingId, paymentDetails = {}) => {
  try {
    const { booking, property, user } = await getBookingDetail(bookingId);

    const bookingDetails = {
      customerName: `${user.firstname} ${user.lastname}`,
      bookingId: booking._id,
      checkInDate: booking.checkInDate,
      checkOutDate: booking.checkOutDate,
      roomType: booking.roomDetails.roomType,
      quantity: booking.roomDetails.quantity,
      totalAmount: booking.totalAmount
    };

    const propertyDetails = {
      name: property.name
    };

    const customerDetails = {
      name: `${user.firstname} ${user.lastname}`,
      email: user.email,
      phone: user.mobile
    };

    // Send email to customer
    const customerTemplate = getCustomerEmailTemplate(status, bookingDetails, propertyDetails);
    if (user.email) {
      await sendEmail({
        to: user.email,
        subject: customerTemplate.subject,
        html: customerTemplate.html
      });
      console.log(`Customer email sent to ${user.email} for booking ${bookingId} - Status: ${status}`);
    }

    // Send email to owner
    const ownerTemplate = getOwnerEmailTemplate(status, bookingDetails, propertyDetails, customerDetails);
    await sendEmail({
      to: 'plainsmotorinnn@gmail.com',
      subject: ownerTemplate.subject,
      html: ownerTemplate.html
    });
    console.log(`Owner email sent for booking ${bookingId} - Status: ${status}`);

  } catch (error) {
    console.error('Error sending booking emails:', error);
    // Don't throw error to prevent webhook from failing
  }
};




export const getCustomerEmailTemplate = (status, bookingDetails, propertyDetails) => {
  const { customerName, bookingId, checkInDate, checkOutDate, roomType, quantity, totalAmount, guests, specialRequest } = bookingDetails;

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD'
    }).format(amount);
  };

  const templates = {
    confirmed: {
      subject: `🎉 Booking Confirmed - ${propertyDetails.name}`,
      text: `Dear ${customerName},

Great news! Your booking has been confirmed.

Booking Details:
- Booking ID: ${bookingId}
- Property: ${propertyDetails.name}
- Check-in: ${formatDate(checkInDate)}
- Check-out: ${formatDate(checkOutDate)}
- Room Type: ${roomType}
- Number of Rooms: ${quantity}
- Guests: ${guests?.adults || 0} adults, ${guests?.children || 0} children, ${guests?.infants || 0} infants
- Total Amount: ${formatCurrency(totalAmount)}

We're excited to host you! If you have any questions, please don't hesitate to contact us.

Thank you for choosing our property!

Best regards,
The Booking Team`,
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Booking Confirmed</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f8f9fa;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 40px 30px; text-align: center;">
              <div style="background-color: rgba(255,255,255,0.2); width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 40px;">🎉</span>
              </div>
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">Booking Confirmed!</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 16px;">Your reservation is all set</p>
            </div>

            <!-- Content -->
            <div style="padding: 40px 30px;">
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">Dear ${customerName},</p>
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">Great news! Your booking has been confirmed and we're excited to welcome you.</p>
              
              <!-- Booking Details Card -->
              <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 12px; padding: 30px; margin: 30px 0; border-left: 4px solid #28a745;">
                <h2 style="color: #333; margin: 0 0 20px; font-size: 20px; font-weight: 600;">📋 Booking Details</h2>
                
                <div style="display: grid; gap: 15px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #dee2e6;">
                    <span style="color: #6c757d; font-weight: 500;">Booking ID</span>
                    <span style="color: #333; font-weight: 600; font-family: monospace;">${bookingId}</span>
                  </div>
                  
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #dee2e6;">
                    <span style="color: #6c757d; font-weight: 500;">Property</span>
                    <span style="color: #333; font-weight: 600;">${propertyDetails.name}</span>
                  </div>
                  
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #dee2e6;">
                    <span style="color: #6c757d; font-weight: 500;">Check-in</span>
                    <span style="color: #333; font-weight: 600;">${formatDate(checkInDate)}</span>
                  </div>
                  
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #dee2e6;">
                    <span style="color: #6c757d; font-weight: 500;">Check-out</span>
                    <span style="color: #333; font-weight: 600;">${formatDate(checkOutDate)}</span>
                  </div>
                  
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #dee2e6;">
                    <span style="color: #6c757d; font-weight: 500;">Room Type</span>
                    <span style="color: #333; font-weight: 600;">${roomType}</span>
                  </div>
                  
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #dee2e6;">
                    <span style="color: #6c757d; font-weight: 500;">Rooms</span>
                    <span style="color: #333; font-weight: 600;">${quantity} room(s)</span>
                  </div>
                  
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #dee2e6;">
                    <span style="color: #6c757d; font-weight: 500;">Guests</span>
                    <span style="color: #333; font-weight: 600;">${guests?.adults || 0} adults, ${guests?.children || 0} children, ${guests?.infants || 0} infants</span>
                  </div>
                  
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; background-color: rgba(40, 167, 69, 0.1); margin: 10px -15px -15px; padding: 20px 15px; border-radius: 8px;">
                    <span style="color: #28a745; font-weight: 600; font-size: 16px;">Total Amount</span>
                    <span style="color: #28a745; font-weight: 700; font-size: 20px;">${formatCurrency(totalAmount)}</span>
                  </div>
                </div>
                
                ${specialRequest ? `
                  <div style="margin-top: 20px; padding: 15px; background-color: rgba(13, 110, 253, 0.1); border-radius: 8px; border-left: 3px solid #0d6efd;">
                    <h4 style="color: #0d6efd; margin: 0 0 8px; font-size: 14px; font-weight: 600;">Special Request:</h4>
                    <p style="color: #333; margin: 0; font-size: 14px; line-height: 1.5;">${specialRequest}</p>
                  </div>
                ` : ''}
              </div>
              
              <!-- What's Next Section -->
              <div style="background-color: #e7f3ff; border-radius: 12px; padding: 25px; margin: 30px 0;">
                <h3 style="color: #0056b3; margin: 0 0 15px; font-size: 18px; font-weight: 600;">📱 What's Next?</h3>
                <ul style="color: #333; margin: 0; padding-left: 20px; line-height: 1.8;">
                  <li>You'll receive a confirmation email with check-in instructions 24 hours before arrival</li>
                  <li>Please bring a valid ID for check-in</li>
                  <li>If you need to make any changes, contact us as soon as possible</li>
                  <li>We're here to help make your stay memorable!</li>
                </ul>
              </div>
              
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 30px 0 0;">We can't wait to welcome you! If you have any questions or special requests, please don't hesitate to reach out.</p>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 40px 0;">
                <a href="mailto:support@yourproperty.com" style="display: inline-block; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: #ffffff; text-decoration: none; padding: 15px 30px; border-radius: 50px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3); transition: transform 0.2s;">
                  📧 Contact Us
                </a>
              </div>
              
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 20px 0 0; font-weight: 600;">Thank you for choosing us!</p>
              <p style="color: #6c757d; font-size: 14px; margin: 5px 0 0;">The Booking Team</p>
            </div>

            <!-- Footer -->
            <div style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #dee2e6;">
              <p style="color: #6c757d; font-size: 12px; margin: 0; line-height: 1.5;">
                This is an automated confirmation email. Please do not reply directly to this message.<br>
                For support, please contact us at <a href="mailto:support@yourproperty.com" style="color: #28a745;">support@yourproperty.com</a>
              </p>
            </div>
          </div>
        </body>
        </html>
      `
    },

    failed: {
      subject: `❌ Payment Failed - ${propertyDetails.name}`,
      text: `Dear ${customerName},

Unfortunately, your payment could not be processed for your booking.

Booking Details:
- Booking ID: ${bookingId}
- Property: ${propertyDetails.name}
- Check-in: ${formatDate(checkInDate)}
- Check-out: ${formatDate(checkOutDate)}
- Room Type: ${roomType}
- Number of Rooms: ${quantity}
- Total Amount: ${formatCurrency(totalAmount)}

Please try again or contact us for assistance. Your booking is currently on hold and will be automatically canceled if payment is not completed within 24 hours.

You can retry your payment or contact our support team for help.

Best regards,
The Booking Team`,
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Payment Failed</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f8f9fa;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); padding: 40px 30px; text-align: center;">
              <div style="background-color: rgba(255,255,255,0.2); width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 40px;">❌</span>
              </div>
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">Payment Failed</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 16px;">We couldn't process your payment</p>
            </div>

            <!-- Content -->
            <div style="padding: 40px 30px;">
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">Dear ${customerName},</p>
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">Unfortunately, we were unable to process your payment for the booking below. Don't worry - your reservation is temporarily on hold.</p>
              
              <!-- Booking Details Card -->
              <div style="background: linear-gradient(135deg, #fff5f5 0%, #fed7d7 100%); border-radius: 12px; padding: 30px; margin: 30px 0; border-left: 4px solid #dc3545;">
                <h2 style="color: #333; margin: 0 0 20px; font-size: 20px; font-weight: 600;">📋 Booking Details</h2>
                
                <div style="display: grid; gap: 15px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #f1c2c2;">
                    <span style="color: #6c757d; font-weight: 500;">Booking ID</span>
                    <span style="color: #333; font-weight: 600; font-family: monospace;">${bookingId}</span>
                  </div>
                  
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #f1c2c2;">
                    <span style="color: #6c757d; font-weight: 500;">Property</span>
                    <span style="color: #333; font-weight: 600;">${propertyDetails.name}</span>
                  </div>
                  
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #f1c2c2;">
                    <span style="color: #6c757d; font-weight: 500;">Check-in</span>
                    <span style="color: #333; font-weight: 600;">${formatDate(checkInDate)}</span>
                  </div>
                  
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #f1c2c2;">
                    <span style="color: #6c757d; font-weight: 500;">Check-out</span>
                    <span style="color: #333; font-weight: 600;">${formatDate(checkOutDate)}</span>
                  </div>
                  
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #f1c2c2;">
                    <span style="color: #6c757d; font-weight: 500;">Room Type</span>
                    <span style="color: #333; font-weight: 600;">${roomType}</span>
                  </div>
                  
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; background-color: rgba(220, 53, 69, 0.1); margin: 10px -15px -15px; padding: 20px 15px; border-radius: 8px;">
                    <span style="color: #dc3545; font-weight: 600; font-size: 16px;">Amount Due</span>
                    <span style="color: #dc3545; font-weight: 700; font-size: 20px;">${formatCurrency(totalAmount)}</span>
                  </div>
                </div>
              </div>
              
              <!-- Action Required -->
              <div style="background-color: #fff3cd; border-radius: 12px; padding: 25px; margin: 30px 0; border-left: 4px solid #ffc107;">
                <h3 style="color: #856404; margin: 0 0 15px; font-size: 18px; font-weight: 600;">⚠️ Action Required</h3>
                <p style="color: #856404; margin: 0 0 15px; line-height: 1.6;">Your booking will be automatically canceled if payment is not completed within <strong>24 hours</strong>.</p>
                <ul style="color: #856404; margin: 0; padding-left: 20px; line-height: 1.8;">
                  <li>Check your payment method for sufficient funds</li>
                  <li>Verify your card details are correct</li>
                  <li>Try a different payment method</li>
                  <li>Contact your bank if the issue persists</li>
                </ul>
              </div>
              
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 30px 0;">Please retry your payment or contact our support team if you need assistance. We're here to help!</p>
              
              <!-- CTA Buttons -->
              <div style="text-align: center; margin: 40px 0;">
                <a href="#" style="display: inline-block; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: #ffffff; text-decoration: none; padding: 15px 30px; border-radius: 50px; font-weight: 600; font-size: 16px; margin: 0 10px 10px; box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);">
                  💳 Retry Payment
                </a>
                <a href="mailto:support@yourproperty.com" style="display: inline-block; background: linear-gradient(135deg, #6c757d 0%, #495057 100%); color: #ffffff; text-decoration: none; padding: 15px 30px; border-radius: 50px; font-weight: 600; font-size: 16px; margin: 0 10px 10px; box-shadow: 0 4px 12px rgba(108, 117, 125, 0.3);">
                  📧 Get Help
                </a>
              </div>
              
              <p style="color: #6c757d; font-size: 14px; margin: 20px 0 0;">The Booking Team</p>
            </div>

            <!-- Footer -->
            <div style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #dee2e6;">
              <p style="color: #6c757d; font-size: 12px; margin: 0; line-height: 1.5;">
                This is an automated notification. For immediate assistance, please contact us at<br>
                <a href="mailto:support@yourproperty.com" style="color: #dc3545;">support@yourproperty.com</a> or call us directly.
              </p>
            </div>
          </div>
        </body>
        </html>
      `
    },

    canceled: {
      subject: `⚠️ Booking Canceled - ${propertyDetails.name}`,
      text: `Dear ${customerName},

Your booking has been canceled.

Canceled Booking Details:
- Booking ID: ${bookingId}
- Property: ${propertyDetails.name}
- Check-in: ${formatDate(checkInDate)}
- Check-out: ${formatDate(checkOutDate)}
- Room Type: ${roomType}
- Number of Rooms: ${quantity}
- Total Amount: ${formatCurrency(totalAmount)}

If this cancellation was unexpected or if you have any questions, please contact us immediately.

We're here to help with any rebooking needs.

Best regards,
The Booking Team`,
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Booking Canceled</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f8f9fa;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #ffc107 0%, #e0a800 100%); padding: 40px 30px; text-align: center;">
              <div style="background-color: rgba(255,255,255,0.2); width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 40px;">⚠️</span>
              </div>
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">Booking Canceled</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 16px;">Your reservation has been canceled</p>
            </div>

            <!-- Content -->
            <div style="padding: 40px 30px;">
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">Dear ${customerName},</p>
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">We want to inform you that your booking has been canceled. Below are the details of the canceled reservation.</p>
              
              <!-- Booking Details Card -->
              <div style="background: linear-gradient(135deg, #fffbf0 0%, #fef3cd 100%); border-radius: 12px; padding: 30px; margin: 30px 0; border-left: 4px solid #ffc107;">
                <h2 style="color: #333; margin: 0 0 20px; font-size: 20px; font-weight: 600;">📋 Canceled Booking Details</h2>
                
                <div style="display: grid; gap: 15px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #f5e6a3;">
                    <span style="color: #6c757d; font-weight: 500;">Booking ID</span>
                    <span style="color: #333; font-weight: 600; font-family: monospace;">${bookingId}</span>
                  </div>
                  
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #f5e6a3;">
                    <span style="color: #6c757d; font-weight: 500;">Property</span>
                    <span style="color: #333; font-weight: 600;">${propertyDetails.name}</span>
                  </div>
                  
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #f5e6a3;">
                    <span style="color: #6c757d; font-weight: 500;">Check-in</span>
                    <span style="color: #333; font-weight: 600;">${formatDate(checkInDate)}</span>
                  </div>
                  
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #f5e6a3;">
                    <span style="color: #6c757d; font-weight: 500;">Check-out</span>
                    <span style="color: #333; font-weight: 600;">${formatDate(checkOutDate)}</span>
                  </div>
                  
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #f5e6a3;">
                    <span style="color: #6c757d; font-weight: 500;">Room Type</span>
                    <span style="color: #333; font-weight: 600;">${roomType}</span>
                  </div>
                  
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; background-color: rgba(255, 193, 7, 0.1); margin: 10px -15px -15px; padding: 20px 15px; border-radius: 8px;">
                    <span style="color: #856404; font-weight: 600; font-size: 16px;">Total Amount</span>
                    <span style="color: #856404; font-weight: 700; font-size: 20px;">${formatCurrency(totalAmount)}</span>
                  </div>
                </div>
              </div>
              
              <!-- Refund Information -->
              <div style="background-color: #e7f3ff; border-radius: 12px; padding: 25px; margin: 30px 0;">
                <h3 style="color: #0056b3; margin: 0 0 15px; font-size: 18px; font-weight: 600;">💰 Refund Information</h3>
                <p style="color: #0056b3; margin: 0; line-height: 1.6;">If you made a payment, any applicable refunds will be processed according to our cancellation policy. Refunds typically take 5-10 business days to appear on your original payment method.</p>
              </div>
              
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 30px 0;">If this cancellation was unexpected or if you have any questions, please don't hesitate to contact us. We're here to help with any rebooking needs or concerns you may have.</p>
              
              <!-- CTA Buttons -->
              <div style="text-align: center; margin: 40px 0;">
                <a href="#" style="display: inline-block; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: #ffffff; text-decoration: none; padding: 15px 30px; border-radius: 50px; font-weight: 600; font-size: 16px; margin: 0 10px 10px; box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);">
                  🏨 Book Again
                </a>
                <a href="mailto:support@yourproperty.com" style="display: inline-block; background: linear-gradient(135deg, #6c757d 0%, #495057 100%); color: #ffffff; text-decoration: none; padding: 15px 30px; border-radius: 50px; font-weight: 600; font-size: 16px; margin: 0 10px 10px; box-shadow: 0 4px 12px rgba(108, 117, 125, 0.3);">
                  📧 Contact Us
                </a>
              </div>
              
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 20px 0 0;">We hope to serve you again in the future.</p>
              <p style="color: #6c757d; font-size: 14px; margin: 5px 0 0;">The Booking Team</p>
            </div>

            <!-- Footer -->
            <div style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #dee2e6;">
              <p style="color: #6c757d; font-size: 12px; margin: 0; line-height: 1.5;">
                For questions about this cancellation or to make a new reservation, contact us at<br>
                <a href="mailto:support@yourproperty.com" style="color: #ffc107;">support@yourproperty.com</a>
              </p>
            </div>
          </div>
        </body>
        </html>
      `
    }
  };

  return templates[status] || templates.failed;
};

export const getOwnerEmailTemplate = (status, bookingDetails, propertyDetails, customerDetails) => {
  const { bookingId, checkInDate, checkOutDate, roomType, quantity, totalAmount } = bookingDetails;

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD'
    }).format(amount);
  };

  const templates = {
    confirmed: {
      subject: `New Booking Confirmed - ${bookingId}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <h3 style="color: #28a745;">✅ New Booking Confirmed</h3>
          
          <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <p><strong>Booking ID:</strong> ${bookingId}</p>
            <p><strong>Property:</strong> ${propertyDetails.name}</p>
            <p><strong>Guest:</strong> ${customerDetails.name}</p>
            <p><strong>Phone:</strong> ${customerDetails.phone}</p>
            <p><strong>Email:</strong> ${customerDetails.email}</p>
            <p><strong>Check-in:</strong> ${formatDate(checkInDate)}</p>
            <p><strong>Check-out:</strong> ${formatDate(checkOutDate)}</p>
            <p><strong>Room:</strong> ${roomType} (${quantity} room${quantity > 1 ? 's' : ''})</p>
            <p><strong>Total Amount:</strong> ${formatCurrency(totalAmount)}</p>
          </div>
        </div>
      `
    },

    failed: {
      subject: `Payment Failed - ${bookingId}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <h3 style="color: #dc3545;">❌ Payment Failed</h3>
          
          <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <p><strong>Booking ID:</strong> ${bookingId}</p>
            <p><strong>Property:</strong> ${propertyDetails.name}</p>
            <p><strong>Guest:</strong> ${customerDetails.name}</p>
            <p><strong>Phone:</strong> ${customerDetails.phone}</p>
            <p><strong>Check-in:</strong> ${formatDate(checkInDate)}</p>
            <p><strong>Check-out:</strong> ${formatDate(checkOutDate)}</p>
            <p><strong>Room:</strong> ${roomType} (${quantity} room${quantity > 1 ? 's' : ''})</p>
            <p><strong>Total Amount:</strong> ${formatCurrency(totalAmount)}</p>
            <p style="color: #dc3545;"><strong>Status:</strong> Payment failed - booking on hold</p>
          </div>
        </div>
      `
    },

    canceled: {
      subject: `Booking Canceled - ${bookingId}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <h3 style="color: #ffc107;">⚠️ Booking Canceled</h3>
          
          <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <p><strong>Booking ID:</strong> ${bookingId}</p>
            <p><strong>Property:</strong> ${propertyDetails.name}</p>
            <p><strong>Guest:</strong> ${customerDetails.name}</p>
            <p><strong>Phone:</strong> ${customerDetails.phone}</p>
            <p><strong>Email:</strong> ${customerDetails.email}</p>
            <p><strong>Check-in:</strong> ${formatDate(checkInDate)}</p>
            <p><strong>Check-out:</strong> ${formatDate(checkOutDate)}</p>
            <p><strong>Room:</strong> ${roomType} (${quantity} room${quantity > 1 ? 's' : ''})</p>
            <p><strong>Total Amount:</strong> ${formatCurrency(totalAmount)}</p>
            <p style="color: #ffc107;"><strong>Status:</strong> Booking was canceled</p>
          </div>
        </div>
      `
    }
  };

  return templates[status] || { subject: "Booking Update", html: "<p>No template available</p>" };
};


