import propertyCard from '../../modals/properties/propertyModal.js';
import propertyDetail from '../../modals/properties/propertyDetailModal.js';
import mongoose from 'mongoose';
import { uploadToCloudinary } from '../../config/cloudinary.js';

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
      
      // Upload each file to Cloudinary
      const uploadPromises = req.files.map(async (file) => {
        try {
          console.log(`Uploading file: ${file.originalname}`);
          const result = await uploadToCloudinary(file.buffer, {
            public_id: `property_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
            format: 'jpg' // Convert all images to JPG
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

    console.log('Final image URLs:', imageUrls);

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

// Alternative version with error handling and retry logic
export const addListingWithRetry = async (req, res) => {
  try {
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

    // Upload files with retry logic
    let imageUrls = [];
    
    if (req.files && req.files.length > 0) {
      const uploadWithRetry = async (file, retries = 3) => {
        for (let i = 0; i < retries; i++) {
          try {
            const result = await uploadToCloudinary(file.buffer, {
              public_id: `property_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
            });
            return result.secure_url;
          } catch (error) {
            console.error(`Upload attempt ${i + 1} failed for ${file.originalname}:`, error);
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Wait before retry
          }
        }
      };

      const uploadPromises = req.files.map(file => uploadWithRetry(file));
      imageUrls = await Promise.all(uploadPromises);
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
    console.error('Error in addListingWithRetry:', error);
    res.status(500).json({ error: error.message });
  }
};