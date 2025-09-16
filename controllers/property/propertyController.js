// ===== PROPERTY CONTROLLER =====

// controllers/property/propertyController.js
import propertyCard from '../../modals/properties/propertyModal.js';
import propertyDetail from '../../modals/properties/propertyDetailModal.js';
import { uploadToCloudinary } from '../../config/cloudinary.js';
import Category from '../../modals/category/categoryModal.js';
import mongoose from 'mongoose';

// @desc    Add a new card
// @route   POST /api/cards
// @access  Public
export const addCard = async (req, res) => {
  try {
    const { category, ...rest } = req.body;
    
    if (!category) {
      return res.status(400).json({ error: 'Category is required' });
    }

    let categoryId;
    if (mongoose.Types.ObjectId.isValid(category)) {
      // If it's a valid ObjectId, try to find by ID
      const existingCategory = await Category.findById(category);
      if (!existingCategory) {
        return res.status(404).json({ error: 'Category not found' });
      }
      categoryId = existingCategory._id;
    } else {
      // Otherwise, treat it as a category name
      let existingCategory = await Category.findOne({ name: category });
      if (!existingCategory) {
        // Create new category if not found
        const newCategory = new Category({ name: category });
        existingCategory = await newCategory.save();
      }
      categoryId = existingCategory._id;
    }

    let imageUrl = '';
    
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer);
      imageUrl = result.secure_url;
    }

    const card = new propertyCard({ 
      ...rest, 
      category: categoryId, 
      image: imageUrl 
    });
    
    const savedCard = await card.save();
    res.status(201).json(savedCard);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// @desc    Get all cards
// @route   GET /api/cards
// @access  Public
export const getAllCards = async (req, res) => {
  try {
    const cards = await propertyCard.find().populate('category').select('-__v');
    res.status(200).json(cards);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Get card by ID
// @route   GET /api/cards/:id
// @access  Public
export const getCardById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid card ID' });
    }
    
    const card = await propertyCard.findById(id).populate('category').select('-__v');
    
    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }
    
    res.status(200).json(card);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Update card
// @route   PUT /api/cards/:id
// @access  Private (Admin/Customer)

export const updateProperty = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const {
      // Card fields
      name, title, price, rating, badge, category, inStock, roomType,
      
      // Detail fields
      location, guest, bedroom, bed, bathroom, description, listingRating,
      detailPrice, quantity, defaultAllowedPersons, allowedPersonsPerRoom,
      extraPersonCharge, isSmokingAllowed, smokingRoomCharge, isPetFriendly,
      allowedPets, petFeePerPet,
      
      // Control flags - Fixed to handle string values from form data
      updateCard = true,
      updateListing = true,
      keepExistingImages = false
    } = req.body;

    console.log(req.body, "Tbalew");

    // Parse boolean values from strings (common with form data)
    const parsedUpdateCard = typeof updateCard === 'string' ? updateCard === 'true' : Boolean(updateCard);
    const parsedUpdateListing = typeof updateListing === 'string' ? updateListing === 'true' : Boolean(updateListing);
    const parsedKeepExistingImages = typeof keepExistingImages === 'string' ? keepExistingImages === 'true' : Boolean(keepExistingImages);
    const parsedInStock = typeof inStock === 'string' ? inStock === 'true' : Boolean(inStock);

    // Input validation
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid property ID format' 
      });
    }

    // Validate numeric fields
    const numericFields = { 
      price, rating, guest, bedroom, bed, bathroom, listingRating,
      detailPrice, quantity, defaultAllowedPersons, allowedPersonsPerRoom,
      extraPersonCharge, smokingRoomCharge, allowedPets, petFeePerPet
    };
    
    for (const [field, value] of Object.entries(numericFields)) {
      if (value !== undefined && value !== null && value !== '' && (isNaN(value) || Number(value) < 0)) {
        return res.status(400).json({
          success: false,
          error: `Invalid ${field}: must be a non-negative number`
        });
      }
    }

    // Validate rating ranges
    if (rating !== undefined && rating !== '' && (Number(rating) < 0 || Number(rating) > 5)) {
      return res.status(400).json({
        success: false,
        error: 'Rating must be between 0 and 5'
      });
    }

    if (listingRating !== undefined && listingRating !== '' && (Number(listingRating) < 0 || Number(listingRating) > 5)) {
      return res.status(400).json({
        success: false,
        error: 'Listing rating must be between 0 and 5'
      });
    }

    // Validate roomType
    if (roomType && !['single', 'double'].includes(roomType)) {
      return res.status(400).json({
        success: false,
        error: 'Room type must be either "single" or "double"'
      });
    }

    // Check if property exists
    const existingProperty = await propertyCard.findById(id).session(session);
    if (!existingProperty) {
      await session.abortTransaction();
      return res.status(404).json({ 
        success: false,
        error: 'Property not found' 
      });
    }

    let updatedCard = existingProperty;
    let updatedListing = null;

    // ===== Update Card =====
    if (parsedUpdateCard) {
      const cardUpdateData = {};

      // Update basic card fields
      if (name?.trim()) cardUpdateData.name = name.trim();
      if (title?.trim()) cardUpdateData.title = title.trim();
      if (price !== undefined && price !== '') cardUpdateData.price = Number(price);
      if (rating !== undefined && rating !== '') cardUpdateData.rating = Number(rating);
      if (badge?.trim()) cardUpdateData.badge = badge.trim();
      if (inStock !== undefined) cardUpdateData.inStock = parsedInStock;
      if (roomType) cardUpdateData.roomType = roomType;

      // Handle category
      if (category) {
        const categoryId = await handleCategoryUpdate(category, session);
        if (!categoryId) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            error: 'Failed to process category'
          });
        }
        cardUpdateData.category = categoryId;
      }

      // Handle card image upload
      if (req.files?.cardImage?.length > 0) {
        try {
          const cardImageFile = req.files.cardImage[0];
          const result = await uploadToCloudinary(cardImageFile.buffer, {
            public_id: `card_${id}_${Date.now()}`,
            format: 'jpg',
            transformation: [
              { width: 800, height: 600, crop: 'fill' },
              { quality: 'auto' }
            ]
          });
          cardUpdateData.image = result.secure_url;
        } catch (uploadError) {
          await session.abortTransaction();
          return res.status(500).json({
            success: false,
            error: 'Failed to upload card image'
          });
        }
      }

      // Update card if there are changes
      if (Object.keys(cardUpdateData).length > 0) {
        cardUpdateData.updatedAt = new Date();
        
        updatedCard = await propertyCard.findByIdAndUpdate(
          id,
          cardUpdateData,
          { 
            new: true, 
            runValidators: true,
            session 
          }
        ).populate('category');
      }
    }

    // ===== Update Listing =====
    // Check if we need to update listing fields (even if updateListing is false, we might have listing-related data)
    const hasListingData = location || guest || bedroom || bed || bathroom || description || 
                           listingRating !== undefined || detailPrice !== undefined || quantity !== undefined ||
                           defaultAllowedPersons !== undefined || allowedPersonsPerRoom !== undefined ||
                           extraPersonCharge !== undefined || isSmokingAllowed !== undefined ||
                           smokingRoomCharge !== undefined || isPetFriendly !== undefined ||
                           allowedPets !== undefined || petFeePerPet !== undefined ||
                           req.files?.listingImages?.length > 0;

    if (parsedUpdateListing || hasListingData) {
      let listing = await propertyDetail.findOne({ property: id }).session(session);

      if (listing) {
        const listingUpdateData = {};

        // Update basic listing fields
        if (location?.trim()) listingUpdateData.location = location.trim();
        if (guest !== undefined && guest !== '') listingUpdateData.guest = Number(guest);
        if (bedroom !== undefined && bedroom !== '') listingUpdateData.bedroom = Number(bedroom);
        if (bed !== undefined && bed !== '') listingUpdateData.bed = Number(bed);
        if (bathroom !== undefined && bathroom !== '') listingUpdateData.bathroom = Number(bathroom);
        if (description?.trim()) listingUpdateData.description = description.trim();
        if (listingRating !== undefined && listingRating !== '') listingUpdateData.rating = listingRating; // Keep as string per schema

        // Handle price field in detail (separate from card price)
        if (detailPrice !== undefined && detailPrice !== '') listingUpdateData.price = Number(detailPrice);

        // Handle room type in detail
        if (roomType) listingUpdateData.roomType = roomType;

        console.log(listingUpdateData , "listingUpdateData")
        
        // Handle new room detail fields
        if (quantity !== undefined && quantity !== '') listingUpdateData.quantity = Number(quantity);
        if (defaultAllowedPersons !== undefined && defaultAllowedPersons !== '') listingUpdateData.defaultAllowedPersons = Number(defaultAllowedPersons);
        if (allowedPersonsPerRoom !== undefined && allowedPersonsPerRoom !== '') listingUpdateData.allowedPersonsPerRoom = Number(allowedPersonsPerRoom);
        if (extraPersonCharge !== undefined && extraPersonCharge !== '') listingUpdateData.extraPersonCharge = Number(extraPersonCharge);
        
        // Parse boolean fields
        if (isSmokingAllowed !== undefined) {
          const parsedIsSmokingAllowed = typeof isSmokingAllowed === 'string' ? isSmokingAllowed === 'true' : Boolean(isSmokingAllowed);
          listingUpdateData.isSmokingAllowed = parsedIsSmokingAllowed;
        }
        
        if (smokingRoomCharge !== undefined && smokingRoomCharge !== '') listingUpdateData.smokingRoomCharge = Number(smokingRoomCharge);
        
        if (isPetFriendly !== undefined) {
          const parsedIsPetFriendly = typeof isPetFriendly === 'string' ? isPetFriendly === 'true' : Boolean(isPetFriendly);
          listingUpdateData.isPetFriendly = parsedIsPetFriendly;
        }
        
        if (allowedPets !== undefined && allowedPets !== '') listingUpdateData.allowedPets = Number(allowedPets);
        if (petFeePerPet !== undefined && petFeePerPet !== '') listingUpdateData.petFeePerPet = Number(petFeePerPet);

        // Handle listing images
        const listingImageFiles = req.files?.listingImages || [];
        if (listingImageFiles.length > 0) {
          try {
            const uploadPromises = listingImageFiles.map(async (file, index) => {
              const result = await uploadToCloudinary(file.buffer, {
                public_id: `listing_${id}_${Date.now()}_${index}`,
                format: 'jpg',
                transformation: [
                  { width: 1200, height: 800, crop: 'fill' },
                  { quality: 'auto' }
                ]
              });
              return result.secure_url;
            });

            const newImageUrls = await Promise.all(uploadPromises);

            if (parsedKeepExistingImages && listing.images?.length > 0) {
              listingUpdateData.images = [...listing.images, ...newImageUrls];
            } else {
              listingUpdateData.images = newImageUrls;
            }
          } catch (uploadError) {
            await session.abortTransaction();
            return res.status(500).json({
              success: false,
              error: 'Failed to upload listing images'
            });
          }
        }

        // Update listing if there are changes
        if (Object.keys(listingUpdateData).length > 0) {
          listingUpdateData.updatedAt = new Date();
          
          updatedListing = await propertyDetail.findByIdAndUpdate(
            listing._id,
            listingUpdateData,
            { 
              new: true, 
              runValidators: true,
              session 
            }
          );
        } else {
          // If no updates, still return the existing listing
          updatedListing = listing;
        }
      } else if (parsedUpdateListing) {
        // Create new listing only if updateListing is explicitly true
        const newListingData = {
          property: id,
          ...(location?.trim() && { location: location.trim() }),
          ...(guest !== undefined && guest !== '' && { guest: Number(guest) }),
          ...(bedroom !== undefined && bedroom !== '' && { bedroom: Number(bedroom) }),
          ...(bed !== undefined && bed !== '' && { bed: Number(bed) }),
          ...(bathroom !== undefined && bathroom !== '' && { bathroom: Number(bathroom) }),
          ...(description?.trim() && { description: description.trim() }),
          ...(listingRating !== undefined && listingRating !== '' && { rating: listingRating }), // Keep as string
          ...(detailPrice !== undefined && detailPrice !== '' && { price: Number(detailPrice) }),
          ...(roomType && { roomType: roomType }),
          ...(quantity !== undefined && quantity !== '' && { quantity: Number(quantity) }),
          ...(defaultAllowedPersons !== undefined && defaultAllowedPersons !== '' && { defaultAllowedPersons: Number(defaultAllowedPersons) }),
          ...(allowedPersonsPerRoom !== undefined && allowedPersonsPerRoom !== '' && { allowedPersonsPerRoom: Number(allowedPersonsPerRoom) }),
          ...(extraPersonCharge !== undefined && extraPersonCharge !== '' && { extraPersonCharge: Number(extraPersonCharge) }),
          ...(smokingRoomCharge !== undefined && smokingRoomCharge !== '' && { smokingRoomCharge: Number(smokingRoomCharge) }),
          ...(allowedPets !== undefined && allowedPets !== '' && { allowedPets: Number(allowedPets) }),
          ...(petFeePerPet !== undefined && petFeePerPet !== '' && { petFeePerPet: Number(petFeePerPet) })
        };

        // Handle boolean fields for new listing
        if (isSmokingAllowed !== undefined) {
          const parsedIsSmokingAllowed = typeof isSmokingAllowed === 'string' ? isSmokingAllowed === 'true' : Boolean(isSmokingAllowed);
          newListingData.isSmokingAllowed = parsedIsSmokingAllowed;
        }

        if (isPetFriendly !== undefined) {
          const parsedIsPetFriendly = typeof isPetFriendly === 'string' ? isPetFriendly === 'true' : Boolean(isPetFriendly);
          newListingData.isPetFriendly = parsedIsPetFriendly;
        }

        // Validate required fields for new listing
        if (!newListingData.location) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            error: 'Location is required for new listing'
          });
        }

        if (!newListingData.roomType) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            error: 'Room type is required for new listing'
          });
        }

        // Handle images for new listing
        const listingImageFiles = req.files?.listingImages || [];
        if (listingImageFiles.length > 0) {
          try {
            const uploadPromises = listingImageFiles.map(async (file, index) => {
              const result = await uploadToCloudinary(file.buffer, {
                public_id: `listing_${id}_${Date.now()}_${index}`,
                format: 'jpg',
                transformation: [
                  { width: 1200, height: 800, crop: 'fill' },
                  { quality: 'auto' }
                ]
              });
              return result.secure_url;
            });

            newListingData.images = await Promise.all(uploadPromises);
          } catch (uploadError) {
            await session.abortTransaction();
            return res.status(500).json({
              success: false,
              error: 'Failed to upload listing images'
            });
          }
        }

        updatedListing = await propertyDetail.create([newListingData], { session });
        updatedListing = updatedListing[0];

        // Update the card with reference to the new listing
        await propertyCard.findByIdAndUpdate(
          id,
          { detail: updatedListing._id },
          { session }
        );
      }
    }

    // Handle case where only inStock needs to be updated and no other updates were made
    if (!parsedUpdateCard && !parsedUpdateListing && !hasListingData && inStock !== undefined) {
      updatedCard = await propertyCard.findByIdAndUpdate(
        id,
        { inStock: parsedInStock, updatedAt: new Date() },
        { 
          new: true, 
          runValidators: true,
          session 
        }
      ).populate('category');
    }

    // If we still don't have listing data but the listing exists, fetch it
    if (!updatedListing) {
      updatedListing = await propertyDetail.findOne({ property: id }).session(session);
    }

    // Commit transaction
    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: 'Property updated successfully',
      data: {
        card: updatedCard,
        listing: updatedListing,
      }
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Error in updateProperty:', error);
    
    // Handle specific error types
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: Object.values(error.errors).map(err => err.message)
      });
    }

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid data type provided'
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'Property detail already exists for this property'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  } finally {
    session.endSession();
  }
};
/**
 * Helper function to handle category updates
 * @param {string|ObjectId} category - Category name or ID
 * @param {Object} session - Mongoose session
 * @returns {ObjectId|null} - Category ID or null if failed
 */
async function handleCategoryUpdate(category, session) {
  try {
    let categoryId;
    
    if (mongoose.Types.ObjectId.isValid(category)) {
      // Category is an ObjectId
      const existingCategory = await Category.findById(category).session(session);
      if (!existingCategory) {
        return null;
      }
      categoryId = existingCategory._id;
    } else {
      // Category is a name string
      const categoryName = category.trim();
      if (!categoryName) {
        return null;
      }
      
      let existingCategory = await Category.findOne({ 
        name: { $regex: new RegExp(`^${categoryName}$`, 'i') } 
      }).session(session);
      
      if (!existingCategory) {
        const newCategory = new Category({ name: categoryName });
        existingCategory = await newCategory.save({ session });
      }
      categoryId = existingCategory._id;
    }
    
    return categoryId;
  } catch (error) {
    console.error('Error handling category update:', error);
    return null;
  }
}


// @desc    Delete property (card + listing)
// @route   DELETE /api/properties/:id
// @access  Private (Admin only)
export const deleteProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const { deleteListingOnly = false } = req.query;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid property ID' });
    }
    
    const card = await propertyCard.findById(id);
    if (!card) {
      return res.status(404).json({ error: 'Property not found' });
    }
    
    if (deleteListingOnly) {
      // Delete only the listing, keep the card
      if (card.detail) {
        await propertyDetail.findByIdAndDelete(card.detail);
        card.detail = null;
        await card.save();
      }
      
      res.status(200).json({
        message: 'Property listing deleted successfully, card retained'
      });
    } else {
      // Delete both card and listing
      if (card.detail) {
        await propertyDetail.findByIdAndDelete(card.detail);
      }
      await propertyCard.findByIdAndDelete(id);
      
      res.status(200).json({
        message: 'Property and listing deleted successfully'
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// @desc    Toggle stock status
// @route   PATCH /api/cards/:id/stock
// @access  Private (Admin only)
export const toggleStock = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid card ID' });
    }
    
    const card = await propertyCard.findById(id);
    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }
    
    card.inStock = !card.inStock;
    await card.save();
    
    res.status(200).json({
      message: `Property ${card.inStock ? 'is now in stock' : 'is now out of stock'}`,
      card: card
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};