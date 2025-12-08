// Activity routes
const express = require('express');
const router = express.Router();
const { getActivitiesCollection, getProjectsCollection, ObjectId } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const Activity = require('../models/Activity');

// Get recent projects
router.get('/recent', verifyToken, async (req, res) => {
  try {
    const activitiesCollection = await getActivitiesCollection();
    const projectsCollection = await getProjectsCollection();
    
    const activity = await activitiesCollection.findOne({ userId: req.user.uid });
    
    if (!activity || !activity.recentProjects || activity.recentProjects.length === 0) {
      return res.json({ recentProjects: [] });
    }

    // Get full project data for recent projects
    const recentProjectsWithData = await Promise.all(
      activity.recentProjects.map(async (rp) => {
        let project;
        if (ObjectId.isValid(rp.projectId)) {
          project = await projectsCollection.findOne({ _id: new ObjectId(rp.projectId) });
        } else {
          project = await projectsCollection.findOne({ _id: rp.projectId });
        }
        
        if (project) {
          const Project = require('../models/Project');
          return {
            projectId: project._id,
            projectTitle: project.title || rp.projectTitle,
            project: new Project(project).toJSON(),
            viewedAt: rp.viewedAt,
          };
        }
        return null;
      })
    );

    // Filter out nulls (projects that may have been deleted)
    const validProjects = recentProjectsWithData.filter(p => p !== null);
    
    // Sort by viewedAt descending (most recent first)
    validProjects.sort((a, b) => new Date(b.viewedAt) - new Date(a.viewedAt));

    res.json({ recentProjects: validProjects });
  } catch (error) {
    console.error('Error fetching recent projects:', error);
    res.status(500).json({ message: 'Error fetching recent projects' });
  }
});

// Get bookmarked projects
router.get('/bookmarks', verifyToken, async (req, res) => {
  try {
    const activitiesCollection = await getActivitiesCollection();
    const projectsCollection = await getProjectsCollection();
    
    const activity = await activitiesCollection.findOne({ userId: req.user.uid });
    
    if (!activity || !activity.bookmarkedProjects || activity.bookmarkedProjects.length === 0) {
      return res.json({ bookmarkedProjects: [] });
    }

    // Get full project data for bookmarked projects
    const bookmarkedProjectsWithData = await Promise.all(
      activity.bookmarkedProjects.map(async (bp) => {
        let project;
        if (ObjectId.isValid(bp.projectId)) {
          project = await projectsCollection.findOne({ _id: new ObjectId(bp.projectId) });
        } else {
          project = await projectsCollection.findOne({ _id: bp.projectId });
        }
        
        if (project) {
          const Project = require('../models/Project');
          return {
            projectId: project._id,
            project: new Project(project).toJSON(),
            bookmarkedAt: bp.bookmarkedAt,
          };
        }
        return null;
      })
    );

    // Filter out nulls (projects that may have been deleted)
    const validProjects = bookmarkedProjectsWithData.filter(p => p !== null);
    
    // Sort by bookmarkedAt descending (most recent first)
    validProjects.sort((a, b) => new Date(b.bookmarkedAt) - new Date(a.bookmarkedAt));

    res.json({ bookmarkedProjects: validProjects });
  } catch (error) {
    console.error('Error fetching bookmarked projects:', error);
    res.status(500).json({ message: 'Error fetching bookmarked projects' });
  }
});

module.exports = router;

