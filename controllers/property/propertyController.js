import propertyCard from '../../modals/properties/propertyModal.js';
import { uploadToCloudinary } from '../../config/cloudinary.js';

// @desc    Add a new card
// @route   POST /api/cards
// @access  Public
export const addCard = async (req, res) => {
  try {
     console.log(req.file , "request.body");
     
    let imageUrl = '';

    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer);
      imageUrl = result.secure_url;
    }

    const card = new propertyCard({ ...req.body, image:imageUrl });
    const savedCard = await card.save();
    res.status(201).json(savedCard);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getAllCards = async (req, res) => {
    try {
      const cards = await propertyCard.find().select('-__v'); // Exclude __v
      res.status(200).json(cards);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
