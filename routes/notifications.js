// Notification routes
const express = require('express');
const router = express.Router();
const { getNotificationsCollection, ObjectId } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const Notification = require('../models/Notification');

// Get notifications (paginated)
router.get('/', verifyToken, async (req, res) => {
  try {
    const notificationsCollection = await getNotificationsCollection();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Get notifications for user, sorted by most recent first
    const notifications = await notificationsCollection
      .find({ userId: req.user.uid })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Get unread count
    const unreadCount = await notificationsCollection.countDocuments({
      userId: req.user.uid,
      read: false,
    });

    res.json({
      notifications: notifications.map(n => new Notification(n).toJSON()),
      unreadCount,
      page,
      limit,
      total: await notificationsCollection.countDocuments({ userId: req.user.uid }),
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Error fetching notifications' });
  }
});

// Get unread notification count
router.get('/unread-count', verifyToken, async (req, res) => {
  try {
    const notificationsCollection = await getNotificationsCollection();
    
    const count = await notificationsCollection.countDocuments({
      userId: req.user.uid,
      read: false,
    });

    res.json({ count });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ message: 'Error fetching unread count' });
  }
});

// Mark all notifications as read - MUST come before /:id/read to avoid route conflict
router.put('/read-all', verifyToken, async (req, res) => {
  try {
    const notificationsCollection = await getNotificationsCollection();
    
    await notificationsCollection.updateMany(
      { userId: req.user.uid, read: false },
      { $set: { read: true } }
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ message: 'Error marking all notifications as read' });
  }
});

// Mark notification as read
router.put('/:id/read', verifyToken, async (req, res) => {
  try {
    const notificationsCollection = await getNotificationsCollection();
    
    let notification;
    if (ObjectId.isValid(req.params.id)) {
      notification = await notificationsCollection.findOne({ 
        _id: new ObjectId(req.params.id),
        userId: req.user.uid 
      });
    } else {
      notification = await notificationsCollection.findOne({ 
        _id: req.params.id,
        userId: req.user.uid 
      });
    }

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    await notificationsCollection.updateOne(
      { _id: notification._id },
      { $set: { read: true } }
    );

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Error marking notification as read' });
  }
});

module.exports = router;

