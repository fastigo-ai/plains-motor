// ===== PROPERTY DETAIL CONTROLLER =====

// controllers/property/propertyDetailController.js
import propertyCard from '../../modals/properties/propertyModal.js';
import propertyDetail from '../../modals/properties/propertyDetailModal.js';
import mongoose from 'mongoose';
import { uploadToCloudinary } from '../../config/cloudinary.js';

// @desc    Add property detail
// @route   POST /api/property-details
// @access  Private
export const addListing = async (req, res) => {
  try {
    console.log('=== DEBUG INFO ===');
    console.log('req.body:', req.body);
    console.log('req.files:', req.files);
    
    const { cardId, ...detailData } = req.body;

    if (!cardId) {
      return res.status(400).json({ error: 'cardId is required in request body.' });
    }

    const card = await propertyCard.findById(cardId);
    if (!card) {
      return res.status(404).json({ error: `Card with _id "${cardId}" not found.` });
    }

    const existingDetail = await propertyDetail.findOne({ property: cardId });
    if (existingDetail) {
      return res.status(400).json({ error: 'Detail already exists for this card.' });
    }

    let imageUrls = [];
    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map(file =>
        uploadToCloudinary(file.buffer, {
          public_id: `property_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
          format: 'jpg'
        })
      );
      imageUrls = (await Promise.all(uploadPromises)).map(result => result.secure_url);
    }

    const detail = new propertyDetail({
      ...detailData,
      property: cardId,
      images: imageUrls
    });

    const savedDetail = await detail.save();
    card.detail = savedDetail._id;
    await card.save();

    res.status(201).json({
      message: 'Listing added successfully',
      detail: savedDetail
    });
  } catch (error) {
    console.error('Error in addListing:', error);
    res.status(500).json({ error: error.message });
  }
};


// @desc    Get property detail by card ID
// @route   GET /api/property-details/:id
// @access  Private
export const getListingByCardId = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid card ID' });
    }

    const result = await propertyCard.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(id) } },
      {
        $lookup: {
          from: 'propertydetails',
          localField: '_id',
          foreignField: 'property',
          as: 'detail'
        }
      },
      { $unwind: { path: '$detail', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          name: 1,
          title: 1,
          image: 1,
          price: 1,
          rating: 1,
          badge: 1,
          inStock: 1,
          createdAt: 1,
          updatedAt: 1,
          // Detail fields
          location: '$detail.location',
          guest: '$detail.guest',
          bedroom: '$detail.bedroom',
          bed: '$detail.bed',
          bathroom: '$detail.bathroom',
          description: '$detail.description',
          images: '$detail.images',
          detailRating: '$detail.rating',
          roomType: '$detail.roomType',
          quantity: '$detail.quantity',
          defaultAllowedPersons: '$detail.defaultAllowedPersons',
          extraPersonCharge: '$detail.extraPersonCharge',
          isSmokingAllowed: '$detail.isSmokingAllowed',
          smokingRoomCharge: '$detail.smokingRoomCharge',
          isPetFriendly: '$detail.isPetFriendly',
          allowedPets: '$detail.allowedPets',
          petFeePerPet: '$detail.petFeePerPet'
        }
      }
    ]);

    if (!result || result.length === 0) {
      return res.status(404).json({ error: 'Card or its details not found' });
    }

    res.status(200).json(result[0]);
  } catch (error) {
    console.error('Error in getListingByCardId:', error);
    res.status(500).json({ error: error.message });
  }
};


// @desc    Update property detail
// @route   PUT /api/property-details/:id
// @access  Private
export const updateListing = async (req, res) => {
  try {
    const { id } = req.params;
    let updateData = { ...req.body };

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid detail ID' });
    }

    const existingDetail = await propertyDetail.findById(id);
    if (!existingDetail) {
      return res.status(404).json({ error: 'Property detail not found' });
    }

    // Sanitize number fields
    const numberFields = [
      'guest', 'bedroom', 'bed', 'bathroom', 'rating', 'price',
      'quantity', 'defaultAllowedPersons', 'allowedPersonsPerRoom',
      'extraPersonCharge', 'smokingRoomCharge', 'allowedPets', 'petFeePerPet'
    ];

    numberFields.forEach(field => {
      if (updateData[field] !== undefined && updateData[field] !== null && updateData[field] !== '') {
        const numValue = Number(updateData[field]);
        if (!isNaN(numValue)) {
          updateData[field] = numValue;
        }
      }
    });

    // Sanitize boolean fields
    const booleanFields = ['isSmokingAllowed', 'isPetFriendly', 'keepExistingImages'];
    booleanFields.forEach(field => {
      if (updateData[field] !== undefined) {
        updateData[field] = updateData[field] === 'true' || updateData[field] === true;
      }
    });

    // Handle image uploads
    if (req.files && req.files.length > 0) {
      try {
        const uploadPromises = req.files.map(file =>
          uploadToCloudinary(file.buffer, {
            public_id: `property_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
            format: 'jpg'
          })
        );
        
        const uploadResults = await Promise.all(uploadPromises);
        const newImageUrls = uploadResults.map(result => result.secure_url);

        // Handle image update logic
        if (updateData.keepExistingImages === true) {
          // Keep existing images and add new ones
          updateData.images = [...(existingDetail.images || []), ...newImageUrls];
        } else {
          // Replace existing images with new ones
          updateData.images = newImageUrls;
        }
      } catch (uploadError) {
        console.error('Error uploading images:', uploadError);
        return res.status(500).json({ error: 'Failed to upload images' });
      }
    } else if (updateData.keepExistingImages === false) {
      // If no new images and keepExistingImages is false, clear images
      updateData.images = [];
    }

    // Remove keepExistingImages from updateData as it's not a field in the schema
    delete updateData.keepExistingImages;

    // Update the property detail
    const updatedDetail = await propertyDetail.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedDetail) {
      return res.status(404).json({ error: 'Property detail not found after update' });
    }

    res.status(200).json({
      message: 'Property detail updated successfully',
      detail: updatedDetail
    });
  } catch (error) {
    console.error('Error in updateListing:', error);
    res.status(500).json({ 
      error: error.message || 'An error occurred while updating the property detail' 
    });
  }
};



// @desc    Delete property detail
// @route   DELETE /api/property-details/:id
// @access  Private (Admin only)
export const deleteListing = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid detail ID' });
    }
    
    const detail = await propertyDetail.findById(id);
    if (!detail) {
      return res.status(404).json({ error: 'Property detail not found' });
    }
    
    // Remove detail reference from card
    await propertyCard.findByIdAndUpdate(
      detail.property,
      { $unset: { detail: 1 } }
    );
    
    await propertyDetail.findByIdAndDelete(id);
    
    res.status(200).json({
      message: 'Property detail deleted successfully'
    });
  } catch (error) {
    console.error('Error in deleteListing:', error);
    res.status(500).json({ error: error.message });
  }
};
