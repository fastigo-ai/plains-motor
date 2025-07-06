import express from 'express';
import { addCategory } from '../../controllers/category/categoryController.js';
import { protect, authorizeRoles } from '../../utils/authMiddleware.js';

const router = express.Router();

router.post('/add-category', protect, authorizeRoles('admin'), addCategory);

export default router; 