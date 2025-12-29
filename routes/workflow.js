// Workflow Routes (Module B)
const express = require('express');
const router = express.Router();
const { verifyToken, checkRole } = require('../middleware/auth');
const workflowController = require('../controllers/workflowController');

// Supervisor/Admin: Get pending approvals
router.get(
    '/pending',
    verifyToken,
    checkRole(['supervisor', 'admin']),
    workflowController.getPendingApprovals
);

// Student: Submit proposal for review
router.post(
    '/submit-proposal',
    verifyToken,
    checkRole(['student']),
    workflowController.submitProposal
);

// Supervisor/Admin: Review project (approve/reject/request changes)
router.patch(
    '/:projectId/review',
    verifyToken,
    checkRole(['supervisor', 'admin']),
    workflowController.reviewProject
);

// All authenticated users: Add comments to specific phase
router.post(
    '/:projectId/comment',
    verifyToken,
    workflowController.addComment
);

// All authenticated users: Get project timeline with milestones
router.get(
    '/:projectId/timeline',
    verifyToken,
    workflowController.getProjectTimeline
);

// Supervisor/Admin: Advance project to next phase
router.patch(
    '/:projectId/advance',
    verifyToken,
    checkRole(['supervisor', 'admin']),
    workflowController.advancePhase
);

module.exports = router;
