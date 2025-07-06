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
    console.log('Files count:', req.files?.length || 0);
    
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

    // Upload files to Cloudinary manually
    let imageUrls = [];
    
    if (req.files && req.files.length > 0) {
      console.log('Processing files...');
      
      const uploadPromises = req.files.map(async (file) => {
        try {
          console.log(`Uploading file: ${file.originalname}`);
          const result = await uploadToCloudinary(file.buffer, {
            public_id: `property_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
            format: 'jpg'
          });
          console.log(`Upload successful: ${result.secure_url}`);
          return result.secure_url;
        } catch (error) {
          console.error(`Upload failed for ${file.originalname}:`, error);
          throw error;
        }
      });

      try {
        imageUrls = await Promise.all(uploadPromises);
        console.log('All files uploaded successfully:', imageUrls);
      } catch (error) {
        console.error('Error uploading files:', error);
        return res.status(500).json({ error: 'Failed to upload images to Cloudinary' });
      }
    }

    const detail = new propertyDetail({
      ...detailData,
      property: cardId,
      images: imageUrls,
    });

    const savedDetail = await detail.save();

    card.detail = savedDetail._id;
    await card.save();

    res.status(201).json({
      message: 'Listing with multiple images added successfully',
      detail: savedDetail,
      uploadedImages: imageUrls.length,
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
      {
        $match: { _id: new mongoose.Types.ObjectId(id) }
      },
      {
        $lookup: {
          from: 'propertydetails',
          localField: '_id',
          foreignField: 'property',
          as: 'detail'
        }
      },
      {
        $unwind: {
          path: '$detail',
          preserveNullAndEmptyArrays: true
        }
      },
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
          location: '$detail.location',
          guest: '$detail.guest',
          bedroom: '$detail.bedroom',
          bed: '$detail.bed',
          bathroom: '$detail.bathroom',
          description: '$detail.description',
          images: '$detail.images',
          detailRating: '$detail.rating',
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
    const detailData = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid detail ID' });
    }
    
    const existingDetail = await propertyDetail.findById(id);
    if (!existingDetail) {
      return res.status(404).json({ error: 'Property detail not found' });
    }
    
    let updateData = { ...detailData };
    
    // Handle new image uploads
    if (req.files && req.files.length > 0) {
      console.log('Processing new files...');
      
      const uploadPromises = req.files.map(async (file) => {
        try {
          const result = await uploadToCloudinary(file.buffer, {
            public_id: `property_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
            format: 'jpg'
          });
          return result.secure_url;
        } catch (error) {
          console.error(`Upload failed for ${file.originalname}:`, error);
          throw error;
        }
      });

      try {
        const newImageUrls = await Promise.all(uploadPromises);
        
        // Combine existing images with new ones (if keepExisting is true)
        if (detailData.keepExistingImages === 'true') {
          updateData.images = [...existingDetail.images, ...newImageUrls];
        } else {
          updateData.images = newImageUrls;
        }
        
        console.log('New images uploaded successfully:', newImageUrls);
      } catch (error) {
        console.error('Error uploading files:', error);
        return res.status(500).json({ error: 'Failed to upload images to Cloudinary' });
      }
    }
    
    const updatedDetail = await propertyDetail.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
    
    res.status(200).json({
      message: 'Property detail updated successfully',
      detail: updatedDetail
    });
  } catch (error) {
    console.error('Error in updateListing:', error);
    res.status(500).json({ error: error.message });
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
