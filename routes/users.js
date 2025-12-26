// User routes - Refactored to use controllers
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const userController = require('../controllers/userController');
const { validate } = require('../middleware/validate');
const { createUserSchema, updateUserProfileSchema } = require('../validators/userValidator');

// User routes with validation
// IMPORTANT: Specific routes must come before parameterized routes
router.get('/profile', verifyToken, userController.getUserProfile); // Authenticated user's profile
router.post('/', verifyToken, validate(createUserSchema), userController.createOrUpdateUser);
router.put('/profile', verifyToken, validate(updateUserProfileSchema), userController.updateUserProfile);
router.get('/:id', userController.getPublicUserProfile); // Public profile (no auth required)

module.exports = router;
