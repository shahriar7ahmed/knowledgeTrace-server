// Supervisor Routes
const express = require('express');
const router = express.Router();
const { verifyToken, checkRole } = require('../middleware/auth');
const supervisorController = require('../controllers/supervisorController');

// Student: Browse available supervisors with their work
router.get(
    '/browse',
    verifyToken,
    checkRole(['student']),
    supervisorController.browseSupervisors
);

// Student: Send collaboration request to supervisor
router.post(
    '/request',
    verifyToken,
    checkRole(['student']),
    supervisorController.sendRequest
);

// Student: Get their sent requests
router.get(
    '/my-requests',
    verifyToken,
    checkRole(['student']),
    supervisorController.getMyRequests
);

// Supervisor: Get pending requests sent to them
router.get(
    '/pending-requests',
    verifyToken,
    checkRole(['supervisor']),
    supervisorController.getPendingRequests
);

// Supervisor: Respond to collaboration request (approve/reject)
router.patch(
    '/request/:id/respond',
    verifyToken,
    checkRole(['supervisor']),
    supervisorController.respondToRequest
);

module.exports = router;
