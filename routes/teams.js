// Team Formation Routes (Module C)
const express = require('express');
const router = express.Router();
const { verifyToken, checkRole } = require('../middleware/auth');
const teamFormationController = require('../controllers/teamFormationController');

// Find skill-matched students for a project
router.get(
    '/find-matches/:projectId',
    verifyToken,
    teamFormationController.findMatchingStudentsForProject
);

// Student: Invite another student to team
router.post(
    '/invite',
    verifyToken,
    checkRole(['student']),
    teamFormationController.inviteToTeam
);

// Student: Respond to team invitation (accept/reject)
router.patch(
    '/respond/:inviteId',
    verifyToken,
    checkRole(['student']),
    teamFormationController.respondToInvitation
);

// Get all teams user is part of
router.get(
    '/my-teams',
    verifyToken,
    teamFormationController.getMyTeams
);

// Leave a team
router.delete(
    '/:teamId/leave',
    verifyToken,
    checkRole(['student']),
    teamFormationController.leaveTeam
);

module.exports = router;
