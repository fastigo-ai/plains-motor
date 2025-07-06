import propertyCard from '../../modals/properties/propertyModal.js';
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

    const card = new propertyCard({ ...rest, category: categoryId, image: imageUrl });
    const savedCard = await card.save();
    res.status(201).json(savedCard);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getAllCards = async (req, res) => {
    try {
      const cards = await propertyCard.find().populate('category').select('-__v'); // Exclude __v and populate category
      res.status(200).json(cards);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
