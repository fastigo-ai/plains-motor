import propertyCard from '../../modals/properties/propertyModal.js';
import propertyDetail from '../../modals/properties/propertyDetailModal.js';
import mongoose from 'mongoose';

// @desc    Add a new listing and link to card
// @route   POST /api/listings
// @access  Public
export const addListing = async (req, res) => {
    try {
      const { cardId, ...detailData } = req.body;
  
      // 1. Validate the card ID
      if (!cardId) {
        return res.status(400).json({ error: 'cardId is required in request body.' });
      }
  
      const card = await propertyCard.findById(cardId);
      if (!card) {
        return res.status(404).json({ error: `Card with _id "${cardId}" not found.` });
      }
  
      // 2. Check if detail already exists for this card
      const existingDetail = await propertyDetail.findOne({ property: cardId });
      if (existingDetail) {
        return res.status(400).json({ error: 'Detail already exists for this card.' });
      }
  
      // 3. Create listing and link it to card
      const detail = new propertyDetail({
        ...detailData,
        property: cardId
      });
  
      const savedDetail = await detail.save();
  
      // 4. Link the detail back to card
      card.detail = savedDetail._id;
      await card.save();
  
      res.status(201).json({
        message: 'Listing added and linked successfully',
        detail: savedDetail
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

export const getListingByCardId = async (req, res) => {
    try {
      const { id } = req.params;
  
      // Check if valid ObjectId
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
  
            // Detail fields
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
      res.status(500).json({ error: error.message });
    }
  };