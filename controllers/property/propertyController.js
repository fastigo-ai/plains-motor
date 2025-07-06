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
  try {
    const { id } = req.params;
    const {
      name, title, price, rating, badge, category, inStock,
      location, guest, bedroom, bed, bathroom, description, listingRating,
      updateCard = true,
      updateListing = true,
      keepExistingImages = false
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid property ID' });
    }

    const card = await propertyCard.findById(id);
    if (!card) {
      return res.status(404).json({ error: 'Property not found' });
    }

    let updatedCard = card;
    let updatedListing = null;

    // ===== Update Card =====
    if (updateCard) {
      const cardUpdateData = {};

      if (name) cardUpdateData.name = name;
      if (title) cardUpdateData.title = title;
      if (price) cardUpdateData.price = price;
      if (rating) cardUpdateData.rating = rating;
      if (badge) cardUpdateData.badge = badge;
      if (inStock !== undefined) cardUpdateData.inStock = inStock;

      // === Category handling ===
      if (category) {
        let categoryId;
        if (mongoose.Types.ObjectId.isValid(category)) {
          const existingCategory = await Category.findById(category);
          if (!existingCategory) {
            return res.status(404).json({ error: 'Category not found' });
          }
          categoryId = existingCategory._id;
        } else {
          let existingCategory = await Category.findOne({ name: category });
          if (!existingCategory) {
            const newCategory = new Category({ name: category });
            existingCategory = await newCategory.save();
          }
          categoryId = existingCategory._id;
        }
        cardUpdateData.category = categoryId;
      }

      // === Card image ===
      if (req.files && req.files.cardImage && req.files.cardImage.length > 0) {
        const cardImageFile = req.files.cardImage[0];
        const result = await uploadToCloudinary(cardImageFile.buffer);
        cardUpdateData.image = result.secure_url;
      }

      updatedCard = await propertyCard.findByIdAndUpdate(
        id,
        cardUpdateData,
        { new: true, runValidators: true }
      ).populate('category');
    }

    // ===== Update Listing =====
    if (updateListing) {
      const listing = await propertyDetail.findOne({ property: id });

      if (listing) {
        const listingUpdateData = {};

        if (location) listingUpdateData.location = location;
        if (guest) listingUpdateData.guest = guest;
        if (bedroom) listingUpdateData.bedroom = bedroom;
        if (bed) listingUpdateData.bed = bed;
        if (bathroom) listingUpdateData.bathroom = bathroom;
        if (description) listingUpdateData.description = description;
        if (listingRating) listingUpdateData.rating = listingRating;

        // === Listing images ===
        const listingImageFiles = req.files?.listingImages || [];
        if (listingImageFiles.length > 0) {
          const uploadPromises = listingImageFiles.map(async (file) => {
            const result = await uploadToCloudinary(file.buffer, {
              public_id: `property_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
              format: 'jpg',
            });
            return result.secure_url;
          });

          const newImageUrls = await Promise.all(uploadPromises);

          if (keepExistingImages && listing.images) {
            listingUpdateData.images = [...listing.images, ...newImageUrls];
          } else {
            listingUpdateData.images = newImageUrls;
          }
        }

        updatedListing = await propertyDetail.findByIdAndUpdate(
          listing._id,
          listingUpdateData,
          { new: true, runValidators: true }
        );
      }
    }

    res.status(200).json({
      message: 'Property updated successfully',
      card: updatedCard,
      listing: updatedListing,
    });
  } catch (error) {
    console.error('Error in updateProperty:', error);
    res.status(500).json({ error: error.message });
  }
};


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