// Thesis Vault Routes (Module A)
const express = require('express');
const router = express.Router();
const { verifyToken, checkRole } = require('../middleware/auth');
const thesisController = require('../controllers/thesisController');

// Public routes - browse and search thesis archive
router.get('/search', thesisController.searchTheses);
router.get('/:id', thesisController.getThesisById);

// Student routes - check for duplicates before submission
router.post(
    '/check-duplicate',
    verifyToken,
    checkRole(['student']),
    thesisController.checkDuplicateThesis
);

// Admin routes - repository statistics
router.get(
    '/admin/stats',
    verifyToken,
    checkRole(['admin']),
    thesisController.getThesisStats
);

module.exports = router;
