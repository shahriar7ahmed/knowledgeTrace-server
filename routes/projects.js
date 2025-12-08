// Project routes
const express = require('express');
const router = express.Router();
const { getProjectsCollection, ObjectId } = require('../config/database');
const { verifyToken, optionalAuth } = require('../middleware/auth');
const Project = require('../models/Project');
const multer = require('multer');
const { uploadToCloudinary } = require('../utils/cloudinary');

// Configure multer for file uploads (memory storage)
// Multer 2.x compatible configuration
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
});

// Get all projects (with optional filters)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const projectsCollection = await getProjectsCollection();
    const { getUsersCollection } = require('../config/database');
    const usersCollection = await getUsersCollection();
    const query = {};

    // Check if user is admin by querying database
    let isAdmin = false;
    if (req.user && req.user.uid) {
      try {
        const user = await usersCollection.findOne({ uid: req.user.uid });
        isAdmin = user?.isAdmin === true;
      } catch (error) {
        console.error('Error checking admin status:', error);
      }
    }

    // Filter by status (default to approved for non-authenticated users)
    let statusFilter = null;
    if (isAdmin) {
      // Admins can see all projects - no status filter
      // Don't add any status filter to query
      console.log('👤 Admin user detected - returning all projects');
    } else if (req.user && req.user.uid) {
      // Authenticated users can see approved projects AND their own pending projects
      statusFilter = {
        $or: [
          { status: 'approved' },
          { status: 'pending', authorId: req.user.uid }
        ]
      };
    } else {
      // Non-authenticated users only see approved projects
      query.status = 'approved';
    }

    // Apply filters with sanitization to prevent NoSQL injection
    if (req.query.techStack) {
      // Sanitize: remove special regex characters and limit length
      const sanitizedTechStack = String(req.query.techStack)
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .substring(0, 100);
      if (sanitizedTechStack.length > 0) {
        query.techStack = { $regex: sanitizedTechStack, $options: 'i' };
      }
    }
    if (req.query.author) {
      // Sanitize: remove special regex characters and limit length
      const sanitizedAuthor = String(req.query.author)
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .substring(0, 100);
      if (sanitizedAuthor.length > 0) {
        query.author = { $regex: sanitizedAuthor, $options: 'i' };
      }
    }
    if (req.query.year) {
      const year = parseInt(req.query.year);
      // Validate year is a reasonable number
      if (!isNaN(year) && year >= 2000 && year <= new Date().getFullYear() + 1) {
        query.year = year;
      }
    }
    if (req.query.supervisor) {
      // Sanitize: remove special regex characters and limit length
      const sanitizedSupervisor = String(req.query.supervisor)
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .substring(0, 100);
      if (sanitizedSupervisor.length > 0) {
        query.supervisor = { $regex: sanitizedSupervisor, $options: 'i' };
      }
    }
    
    // Handle keywords search - combine with status filter if needed
    if (req.query.keywords) {
      // Sanitize: remove special regex characters and limit length
      const sanitizedKeywords = String(req.query.keywords)
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .substring(0, 200);
      if (sanitizedKeywords.length > 0) {
        const keywordFilter = {
          $or: [
            { title: { $regex: sanitizedKeywords, $options: 'i' } },
            { abstract: { $regex: sanitizedKeywords, $options: 'i' } },
            { tags: { $regex: sanitizedKeywords, $options: 'i' } },
          ]
        };
        
        // Combine status filter and keyword filter using $and
        if (statusFilter) {
          query.$and = [
            statusFilter,
            keywordFilter
          ];
        } else {
          query.$or = keywordFilter.$or;
        }
      } else if (statusFilter) {
        // Only status filter, no keywords
        query.$and = [statusFilter];
      }
    } else if (statusFilter) {
      // Only status filter, no keywords
      query.$and = [statusFilter];
    }

    console.log('🔍 Fetching projects with query:', JSON.stringify(query, null, 2));
    const projects = await projectsCollection.find(query).sort({ createdAt: -1 }).toArray();
    console.log(`✅ Found ${projects.length} projects`);
    
    // Log status distribution for debugging (especially for admins)
    if (isAdmin) {
      const statusCounts = {
        pending: projects.filter(p => p.status === 'pending').length,
        approved: projects.filter(p => p.status === 'approved').length,
        rejected: projects.filter(p => p.status === 'rejected').length,
      };
      console.log('📊 Admin view - Projects by status:', statusCounts);
    }
    
    res.json(projects.map(p => new Project(p).toJSON()));
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ message: 'Error fetching projects' });
  }
});

// Get project by ID
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const projectsCollection = await getProjectsCollection();
    
    let project;
    if (ObjectId.isValid(req.params.id)) {
      project = await projectsCollection.findOne({ _id: new ObjectId(req.params.id) });
    } else {
      project = await projectsCollection.findOne({ _id: req.params.id });
    }

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Only show approved projects to non-authenticated users
    if (!req.user && project.status !== 'approved') {
      return res.status(403).json({ message: 'Project not available' });
    }

    res.json(new Project(project).toJSON());
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ message: 'Error fetching project' });
  }
});

// Get user's projects
router.get('/user/:userId', verifyToken, async (req, res) => {
  try {
    const projectsCollection = await getProjectsCollection();
    const userId = req.params.userId === 'me' ? req.user.uid : req.params.userId;

    // Only allow users to see their own projects unless they're admin
    if (userId !== req.user.uid && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const projects = await projectsCollection
      .find({ authorId: userId })
      .sort({ createdAt: -1 })
      .toArray();

    res.json(projects.map(p => new Project(p).toJSON()));
  } catch (error) {
    console.error('Error fetching user projects:', error);
    res.status(500).json({ message: 'Error fetching user projects' });
  }
});

// Submit a new project
router.post('/', verifyToken, upload.single('pdf'), async (req, res) => {
  try {
    console.log('📥 Received project submission request');
    console.log('📋 Request body keys:', Object.keys(req.body));
    console.log('📄 File uploaded:', req.file ? 'Yes' : 'No');
    
    const projectsCollection = await getProjectsCollection();
    
    // Basic input validation
    if (!req.body.title || typeof req.body.title !== 'string' || req.body.title.trim().length === 0) {
      return res.status(400).json({ message: 'Project title is required' });
    }
    if (req.body.title.length > 200) {
      return res.status(400).json({ message: 'Project title must be less than 200 characters' });
    }
    
    if (!req.body.abstract || typeof req.body.abstract !== 'string' || req.body.abstract.trim().length === 0) {
      return res.status(400).json({ message: 'Project abstract is required' });
    }
    if (req.body.abstract.length > 5000) {
      return res.status(400).json({ message: 'Project abstract must be less than 5000 characters' });
    }
    
    let pdfUrl = '';
    if (req.file) {
      try {
        // Upload PDF to Cloudinary
        pdfUrl = await uploadToCloudinary(req.file.buffer, req.file.originalname);
        if (!pdfUrl) {
          return res.status(500).json({ message: 'Failed to upload PDF file. Please try again.' });
        }
      } catch (uploadError) {
        console.error('PDF upload error:', uploadError);
        return res.status(500).json({ message: 'Failed to upload PDF file. Please try again.' });
      }
    }

    // Parse and sanitize techStack
    let techStack = req.body.techStack;
    if (typeof techStack === 'string') {
      try {
        techStack = JSON.parse(techStack);
      } catch {
        techStack = techStack.split(',').map(t => t.trim()).filter(t => t && t.length <= 50);
      }
    }
    if (!Array.isArray(techStack)) {
      techStack = [];
    }
    // Limit tech stack items
    techStack = techStack.slice(0, 20).map(tech => String(tech).substring(0, 50));

    // Parse and sanitize tags
    let tags = req.body.tags;
    if (typeof tags === 'string') {
      try {
        tags = JSON.parse(tags);
      } catch {
        tags = tags.split(',').map(t => t.trim()).filter(t => t && t.length <= 50);
      }
    }
    if (!Array.isArray(tags)) {
      tags = [];
    }
    // Limit tags
    tags = tags.slice(0, 10).map(tag => String(tag).substring(0, 50));

    // Sanitize and validate other fields
    const title = String(req.body.title).trim().substring(0, 200);
    const abstract = String(req.body.abstract).trim().substring(0, 5000);
    const author = req.body.author ? String(req.body.author).trim().substring(0, 100) : req.user.name || 'Anonymous';
    const supervisor = req.body.supervisor ? String(req.body.supervisor).trim().substring(0, 100) : '';
    const year = parseInt(req.body.year);
    const validatedYear = (!isNaN(year) && year >= 2000 && year <= new Date().getFullYear() + 1) 
      ? year 
      : new Date().getFullYear();
    
    // Validate GitHub link format if provided
    let githubLink = '';
    if (req.body.githubLink) {
      const githubUrl = String(req.body.githubLink).trim();
      // Allow empty strings (optional field)
      if (githubUrl.length > 0) {
        try {
          const url = new URL(githubUrl);
          if (url.hostname === 'github.com' || url.hostname === 'www.github.com') {
            githubLink = githubUrl.substring(0, 500);
          } else {
            return res.status(400).json({ message: 'Invalid GitHub URL. Must be a github.com link.' });
          }
        } catch {
          return res.status(400).json({ message: 'Invalid GitHub URL format.' });
        }
      }
    }

    const projectData = {
      title,
      abstract,
      techStack,
      author,
      authorId: req.user.uid,
      supervisor,
      year: validatedYear,
      githubLink,
      pdfUrl,
      tags,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    console.log('📝 Submitting project:', {
      title: projectData.title,
      author: projectData.author,
      authorId: projectData.authorId,
      status: projectData.status
    });

    // Verify database connection before insert
    const { isConnected } = require('../config/database');
    if (!isConnected()) {
      console.error('❌ Database not connected!');
      return res.status(500).json({ message: 'Database connection error. Please try again.' });
    }

    console.log('💾 Inserting project into MongoDB...');
    const result = await projectsCollection.insertOne(projectData);
    console.log('✅ Insert result:', {
      acknowledged: result.acknowledged,
      insertedId: result.insertedId
    });

    if (!result.acknowledged) {
      console.error('❌ Insert was not acknowledged by MongoDB');
      return res.status(500).json({ message: 'Failed to save project to database' });
    }

    const project = await projectsCollection.findOne({ _id: result.insertedId });

    if (!project) {
      console.error('❌ Failed to retrieve inserted project');
      return res.status(500).json({ message: 'Project created but could not be retrieved' });
    }

    console.log('✅ Project created successfully:', {
      id: project._id,
      title: project.title,
      status: project.status
    });

    res.status(201).json({ message: 'Project submitted successfully', project: new Project(project).toJSON() });
  } catch (error) {
    console.error('Error submitting project:', error);
    res.status(500).json({ message: error.message || 'Error submitting project' });
  }
});

// Update project status (for admin or project owner)
router.put('/:id/status', verifyToken, async (req, res) => {
  try {
    const projectsCollection = await getProjectsCollection();
    const { getUsersCollection } = require('../config/database');
    const usersCollection = await getUsersCollection();
    
    // Check if user is admin
    const user = await usersCollection.findOne({ uid: req.user.uid });
    const isAdmin = user?.isAdmin || false;
    
    let project;
    if (ObjectId.isValid(req.params.id)) {
      project = await projectsCollection.findOne({ _id: new ObjectId(req.params.id) });
    } else {
      project = await projectsCollection.findOne({ _id: req.params.id });
    }

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Check if user is admin or project owner
    if (!isAdmin && project.authorId !== req.user.uid) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { status } = req.body;
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    await projectsCollection.updateOne(
      { _id: project._id },
      { $set: { status, updatedAt: new Date() } }
    );

    const updatedProject = await projectsCollection.findOne({ _id: project._id });
    res.json({ message: 'Project status updated', project: new Project(updatedProject).toJSON() });
  } catch (error) {
    console.error('Error updating project status:', error);
    res.status(500).json({ message: 'Error updating project status' });
  }
});

// Helper function to create notification
async function createNotification(notificationData) {
  try {
    const { getNotificationsCollection } = require('../config/database');
    const { getUsersCollection } = require('../config/database');
    const notificationsCollection = await getNotificationsCollection();
    const usersCollection = await getUsersCollection();
    
    // Get user info for notification
    const relatedUser = await usersCollection.findOne({ uid: notificationData.relatedUserId });
    
    const notification = {
      userId: notificationData.userId,
      type: notificationData.type,
      relatedUserId: notificationData.relatedUserId,
      relatedUserName: relatedUser?.name || relatedUser?.displayName || 'Someone',
      relatedUserPhotoURL: relatedUser?.photoURL || '',
      projectId: notificationData.projectId,
      projectTitle: notificationData.projectTitle || '',
      commentId: notificationData.commentId || null,
      message: notificationData.message || '',
      read: false,
      createdAt: new Date(),
    };

    await notificationsCollection.insertOne(notification);
  } catch (error) {
    console.error('Error creating notification:', error);
    // Don't throw - notifications are non-critical
  }
}

// Like/Unlike project
router.post('/:id/like', verifyToken, async (req, res) => {
  try {
    const projectsCollection = await getProjectsCollection();
    const { getUsersCollection } = require('../config/database');
    const usersCollection = await getUsersCollection();
    
    let project;
    if (ObjectId.isValid(req.params.id)) {
      project = await projectsCollection.findOne({ _id: new ObjectId(req.params.id) });
    } else {
      project = await projectsCollection.findOne({ _id: req.params.id });
    }

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Initialize likes array if it doesn't exist
    if (!project.likes) {
      project.likes = [];
    }

    const userId = req.user.uid;
    const existingLikeIndex = project.likes.findIndex(like => like.userId === userId);
    let liked = false;

    if (existingLikeIndex >= 0) {
      // Unlike: remove from array
      project.likes.splice(existingLikeIndex, 1);
    } else {
      // Like: add to array
      project.likes.push({ userId, likedAt: new Date() });
      liked = true;

      // Create notification for project owner (if not the liker)
      if (project.authorId && project.authorId !== userId) {
        await createNotification({
          userId: project.authorId,
          type: 'like',
          relatedUserId: userId,
          projectId: project._id,
          projectTitle: project.title,
          message: `${req.user.name || 'Someone'} liked your paper "${project.title}"`,
        });
      }
    }

    const likeCount = project.likes.length;

    // Update project
    await projectsCollection.updateOne(
      { _id: project._id },
      { 
        $set: { 
          likes: project.likes,
          likeCount: likeCount,
          updatedAt: new Date() 
        } 
      }
    );

    // Get updated project
    const updatedProject = await projectsCollection.findOne({ _id: project._id });
    res.json({ 
      liked,
      likeCount,
      project: new Project(updatedProject).toJSON()
    });
  } catch (error) {
    console.error('Error toggling like:', error);
    res.status(500).json({ message: 'Error toggling like' });
  }
});

// Bookmark/Unbookmark project
router.post('/:id/bookmark', verifyToken, async (req, res) => {
  try {
    const projectsCollection = await getProjectsCollection();
    const { getActivitiesCollection } = require('../config/database');
    const activitiesCollection = await getActivitiesCollection();
    
    let project;
    if (ObjectId.isValid(req.params.id)) {
      project = await projectsCollection.findOne({ _id: new ObjectId(req.params.id) });
    } else {
      project = await projectsCollection.findOne({ _id: req.params.id });
    }

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Initialize bookmarks array if it doesn't exist (for older projects)
    if (!project.bookmarks) {
      project.bookmarks = [];
    }

    const userId = req.user.uid;
    const existingBookmarkIndex = project.bookmarks.findIndex(b => b.userId === userId);
    let bookmarked = false;

    if (existingBookmarkIndex >= 0) {
      // Unbookmark: remove from array
      project.bookmarks.splice(existingBookmarkIndex, 1);
      
      // Remove from user's activity
      await activitiesCollection.updateOne(
        { userId },
        { 
          $pull: { bookmarkedProjects: { projectId: project._id } },
          $set: { updatedAt: new Date() }
        },
        { upsert: true }
      );
    } else {
      // Bookmark: add to array
      project.bookmarks.push({ userId, bookmarkedAt: new Date() });
      bookmarked = true;

      // Add to user's activity
      await activitiesCollection.updateOne(
        { userId },
        { 
          $addToSet: { 
            bookmarkedProjects: { 
              projectId: project._id,
              bookmarkedAt: new Date()
            } 
          },
          $setOnInsert: { userId, createdAt: new Date() },
          $set: { updatedAt: new Date() }
        },
        { upsert: true }
      );
    }

    // Update project
    await projectsCollection.updateOne(
      { _id: project._id },
      { 
        $set: { 
          bookmarks: project.bookmarks,
          updatedAt: new Date() 
        } 
      }
    );

    // Get updated project
    const updatedProject = await projectsCollection.findOne({ _id: project._id });
    res.json({ 
      bookmarked,
      project: new Project(updatedProject).toJSON()
    });
  } catch (error) {
    console.error('Error toggling bookmark:', error);
    res.status(500).json({ message: 'Error toggling bookmark' });
  }
});

// Track view
router.post('/:id/view', verifyToken, async (req, res) => {
  try {
    const projectsCollection = await getProjectsCollection();
    const { getActivitiesCollection } = require('../config/database');
    const activitiesCollection = await getActivitiesCollection();
    
    let project;
    if (ObjectId.isValid(req.params.id)) {
      project = await projectsCollection.findOne({ _id: new ObjectId(req.params.id) });
    } else {
      project = await projectsCollection.findOne({ _id: req.params.id });
    }

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const userId = req.user.uid;

    // Increment view count
    await projectsCollection.updateOne(
      { _id: project._id },
      { 
        $inc: { views: 1 },
        $set: { updatedAt: new Date() }
      }
    );

    // Add to user's recent projects (limit to 10 most recent)
    await activitiesCollection.updateOne(
      { userId },
      { 
        $pull: { recentProjects: { projectId: project._id } },
        $push: {
          recentProjects: {
            $each: [{ projectId: project._id, projectTitle: project.title, viewedAt: new Date() }],
            $slice: -10 // Keep only last 10
          }
        },
        $setOnInsert: { userId, createdAt: new Date() },
        $set: { lastActivity: new Date(), updatedAt: new Date() }
      },
      { upsert: true }
    );

    // Get updated project
    const updatedProject = await projectsCollection.findOne({ _id: project._id });
    res.json({ 
      views: (updatedProject.views || 0) + 1,
      project: new Project(updatedProject).toJSON()
    });
  } catch (error) {
    console.error('Error tracking view:', error);
    res.status(500).json({ message: 'Error tracking view' });
  }
});

// Delete project (owner only)
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const projectsCollection = await getProjectsCollection();
    const { getUsersCollection } = require('../config/database');
    const usersCollection = await getUsersCollection();
    
    // Check if user is admin
    const user = await usersCollection.findOne({ uid: req.user.uid });
    const isAdmin = user?.isAdmin || false;
    
    let project;
    if (ObjectId.isValid(req.params.id)) {
      project = await projectsCollection.findOne({ _id: new ObjectId(req.params.id) });
    } else {
      project = await projectsCollection.findOne({ _id: req.params.id });
    }

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Check if user is admin or project owner
    if (!isAdmin && project.authorId !== req.user.uid) {
      return res.status(403).json({ message: 'Access denied. Only project owners can delete projects.' });
    }

    // Delete project
    await projectsCollection.deleteOne({ _id: project._id });

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ message: 'Error deleting project' });
  }
});

// Add comment
router.post('/:id/comments', verifyToken, async (req, res) => {
  try {
    const projectsCollection = await getProjectsCollection();
    const { getUsersCollection } = require('../config/database');
    const usersCollection = await getUsersCollection();
    
    let project;
    if (ObjectId.isValid(req.params.id)) {
      project = await projectsCollection.findOne({ _id: new ObjectId(req.params.id) });
    } else {
      project = await projectsCollection.findOne({ _id: req.params.id });
    }

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Comment content is required' });
    }

    // Get user info
    const user = await usersCollection.findOne({ uid: req.user.uid });
    
    // Initialize comments array if it doesn't exist (for older projects)
    if (!project.comments) {
      project.comments = [];
    }
    if (project.commentCount === undefined) {
      project.commentCount = project.comments.length || 0;
    }

    const newComment = {
      _id: new ObjectId(),
      userId: req.user.uid,
      userName: user?.name || user?.displayName || 'Anonymous',
      userPhotoURL: user?.photoURL || '',
      content: content.trim(),
      replies: [],
      createdAt: new Date(),
    };

    project.comments.push(newComment);
    project.commentCount = project.comments.length;

    // Update project
    await projectsCollection.updateOne(
      { _id: project._id },
      { 
        $set: { 
          comments: project.comments,
          commentCount: project.commentCount,
          updatedAt: new Date() 
        } 
      }
    );

    // Create notification for project owner (if not the commenter)
    if (project.authorId && project.authorId !== req.user.uid) {
      await createNotification({
        userId: project.authorId,
        type: 'comment',
        relatedUserId: req.user.uid,
        projectId: project._id,
        projectTitle: project.title,
        commentId: newComment._id,
        message: `${newComment.userName} commented on your paper "${project.title}"`,
      });
    }

    // Get updated project
    const updatedProject = await projectsCollection.findOne({ _id: project._id });
    res.status(201).json({ 
      comment: commentForResponse,
      commentCount: project.commentCount,
      project: new Project(updatedProject).toJSON()
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ message: 'Error adding comment' });
  }
});

// Edit comment
router.put('/:id/comments/:commentId', verifyToken, async (req, res) => {
  try {
    const projectsCollection = await getProjectsCollection();
    
    let project;
    if (ObjectId.isValid(req.params.id)) {
      project = await projectsCollection.findOne({ _id: new ObjectId(req.params.id) });
    } else {
      project = await projectsCollection.findOne({ _id: req.params.id });
    }

    if (!project || !project.comments) {
      return res.status(404).json({ message: 'Project or comment not found' });
    }

    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Comment content is required' });
    }

    const commentId = ObjectId.isValid(req.params.commentId) ? new ObjectId(req.params.commentId) : req.params.commentId;
    const commentIndex = project.comments.findIndex(c => 
      (c._id && c._id.toString() === commentId.toString()) || c._id === commentId
    );

    if (commentIndex === -1) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check if user is comment owner or project owner or admin
    const { getUsersCollection } = require('../config/database');
    const usersCollection = await getUsersCollection();
    const user = await usersCollection.findOne({ uid: req.user.uid });
    const isAdmin = user?.isAdmin || false;

    if (project.comments[commentIndex].userId !== req.user.uid && 
        project.authorId !== req.user.uid && 
        !isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Update comment
    project.comments[commentIndex].content = content.trim();
    project.comments[commentIndex].updatedAt = new Date();

    // Update project
    await projectsCollection.updateOne(
      { _id: project._id },
      { 
        $set: { 
          comments: project.comments,
          updatedAt: new Date() 
        } 
      }
    );

    // Get updated project
    const updatedProject = await projectsCollection.findOne({ _id: project._id });
    
    // Prepare comment for response (ensure ObjectId is serialized)
    const updatedComment = {
      ...project.comments[commentIndex],
      _id: project.comments[commentIndex]._id?.toString() || project.comments[commentIndex]._id,
    };
    
    res.json({ 
      comment: updatedComment,
      project: new Project(updatedProject).toJSON()
    });
  } catch (error) {
    console.error('Error editing comment:', error);
    res.status(500).json({ message: 'Error editing comment' });
  }
});

// Delete comment
router.delete('/:id/comments/:commentId', verifyToken, async (req, res) => {
  try {
    const projectsCollection = await getProjectsCollection();
    
    let project;
    if (ObjectId.isValid(req.params.id)) {
      project = await projectsCollection.findOne({ _id: new ObjectId(req.params.id) });
    } else {
      project = await projectsCollection.findOne({ _id: req.params.id });
    }

    if (!project || !project.comments) {
      return res.status(404).json({ message: 'Project or comment not found' });
    }

    const commentId = ObjectId.isValid(req.params.commentId) ? new ObjectId(req.params.commentId) : req.params.commentId;
    const commentIndex = project.comments.findIndex(c => 
      (c._id && c._id.toString() === commentId.toString()) || c._id === commentId
    );

    if (commentIndex === -1) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check if user is comment owner or project owner or admin
    const { getUsersCollection } = require('../config/database');
    const usersCollection = await getUsersCollection();
    const user = await usersCollection.findOne({ uid: req.user.uid });
    const isAdmin = user?.isAdmin || false;

    if (project.comments[commentIndex].userId !== req.user.uid && 
        project.authorId !== req.user.uid && 
        !isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Remove comment
    project.comments.splice(commentIndex, 1);
    project.commentCount = project.comments.length;

    // Update project
    await projectsCollection.updateOne(
      { _id: project._id },
      { 
        $set: { 
          comments: project.comments,
          commentCount: project.commentCount,
          updatedAt: new Date() 
        } 
      }
    );

    // Get updated project
    const updatedProject = await projectsCollection.findOne({ _id: project._id });
    res.json({ 
      message: 'Comment deleted successfully',
      project: new Project(updatedProject).toJSON()
    });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ message: 'Error deleting comment' });
  }
});

// Add reply to comment
router.post('/:id/comments/:commentId/replies', verifyToken, async (req, res) => {
  try {
    const projectsCollection = await getProjectsCollection();
    const { getUsersCollection } = require('../config/database');
    const usersCollection = await getUsersCollection();
    
    let project;
    if (ObjectId.isValid(req.params.id)) {
      project = await projectsCollection.findOne({ _id: new ObjectId(req.params.id) });
    } else {
      project = await projectsCollection.findOne({ _id: req.params.id });
    }

    if (!project || !project.comments) {
      return res.status(404).json({ message: 'Project or comment not found' });
    }

    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Reply content is required' });
    }

    const commentId = ObjectId.isValid(req.params.commentId) ? new ObjectId(req.params.commentId) : req.params.commentId;
    const commentIndex = project.comments.findIndex(c => 
      (c._id && c._id.toString() === commentId.toString()) || c._id === commentId
    );

    if (commentIndex === -1) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Get user info
    const user = await usersCollection.findOne({ uid: req.user.uid });
    
    // Initialize replies array if it doesn't exist
    if (!project.comments[commentIndex].replies) {
      project.comments[commentIndex].replies = [];
    }

    const newReply = {
      _id: new ObjectId(),
      userId: req.user.uid,
      userName: user?.name || user?.displayName || 'Anonymous',
      userPhotoURL: user?.photoURL || '',
      content: content.trim(),
      createdAt: new Date(),
    };

    project.comments[commentIndex].replies.push(newReply);
    
    // Prepare reply for response (convert ObjectId to string)
    const replyForResponse = {
      ...newReply,
      _id: newReply._id.toString(),
    };

    // Update project
    await projectsCollection.updateOne(
      { _id: project._id },
      { 
        $set: { 
          comments: project.comments,
          updatedAt: new Date() 
        } 
      }
    );

    // Create notification for comment owner (if not the replier)
    if (project.comments[commentIndex].userId !== req.user.uid) {
      await createNotification({
        userId: project.comments[commentIndex].userId,
        type: 'reply',
        relatedUserId: req.user.uid,
        projectId: project._id,
        projectTitle: project.title,
        commentId: commentId,
        message: `${newReply.userName} replied to your comment on "${project.title}"`,
      });
    }

    // Also notify project owner if different from comment owner and replier
    if (project.authorId && 
        project.authorId !== req.user.uid && 
        project.authorId !== project.comments[commentIndex].userId) {
      await createNotification({
        userId: project.authorId,
        type: 'reply',
        relatedUserId: req.user.uid,
        projectId: project._id,
        projectTitle: project.title,
        commentId: commentId,
        message: `${newReply.userName} replied to a comment on your paper "${project.title}"`,
      });
    }

    // Get updated project
    const updatedProject = await projectsCollection.findOne({ _id: project._id });
    res.status(201).json({ 
      reply: replyForResponse,
      project: new Project(updatedProject).toJSON()
    });
  } catch (error) {
    console.error('Error adding reply:', error);
    res.status(500).json({ message: 'Error adding reply' });
  }
});

// Edit reply
router.put('/:id/comments/:commentId/replies/:replyId', verifyToken, async (req, res) => {
  try {
    const projectsCollection = await getProjectsCollection();
    
    let project;
    if (ObjectId.isValid(req.params.id)) {
      project = await projectsCollection.findOne({ _id: new ObjectId(req.params.id) });
    } else {
      project = await projectsCollection.findOne({ _id: req.params.id });
    }

    if (!project || !project.comments) {
      return res.status(404).json({ message: 'Project or comment not found' });
    }

    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Reply content is required' });
    }

    const commentId = ObjectId.isValid(req.params.commentId) ? new ObjectId(req.params.commentId) : req.params.commentId;
    const replyId = ObjectId.isValid(req.params.replyId) ? new ObjectId(req.params.replyId) : req.params.replyId;
    
    const commentIndex = project.comments.findIndex(c => 
      (c._id && c._id.toString() === commentId.toString()) || c._id === commentId
    );

    if (commentIndex === -1 || !project.comments[commentIndex].replies) {
      return res.status(404).json({ message: 'Comment or reply not found' });
    }

    const replyIndex = project.comments[commentIndex].replies.findIndex(r => 
      (r._id && r._id.toString() === replyId.toString()) || r._id === replyId
    );

    if (replyIndex === -1) {
      return res.status(404).json({ message: 'Reply not found' });
    }

    // Check if user is reply owner or comment owner or project owner or admin
    const { getUsersCollection } = require('../config/database');
    const usersCollection = await getUsersCollection();
    const user = await usersCollection.findOne({ uid: req.user.uid });
    const isAdmin = user?.isAdmin || false;

    if (project.comments[commentIndex].replies[replyIndex].userId !== req.user.uid && 
        project.comments[commentIndex].userId !== req.user.uid &&
        project.authorId !== req.user.uid && 
        !isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Update reply
    project.comments[commentIndex].replies[replyIndex].content = content.trim();
    project.comments[commentIndex].replies[replyIndex].updatedAt = new Date();

    // Update project
    await projectsCollection.updateOne(
      { _id: project._id },
      { 
        $set: { 
          comments: project.comments,
          updatedAt: new Date() 
        } 
      }
    );

    // Get updated project
    const updatedProject = await projectsCollection.findOne({ _id: project._id });
    
    // Prepare reply for response (ensure ObjectId is serialized)
    const updatedReply = {
      ...project.comments[commentIndex].replies[replyIndex],
      _id: project.comments[commentIndex].replies[replyIndex]._id?.toString() || project.comments[commentIndex].replies[replyIndex]._id,
    };
    
    res.json({ 
      reply: updatedReply,
      project: new Project(updatedProject).toJSON()
    });
  } catch (error) {
    console.error('Error editing reply:', error);
    res.status(500).json({ message: 'Error editing reply' });
  }
});

// Delete reply
router.delete('/:id/comments/:commentId/replies/:replyId', verifyToken, async (req, res) => {
  try {
    const projectsCollection = await getProjectsCollection();
    
    let project;
    if (ObjectId.isValid(req.params.id)) {
      project = await projectsCollection.findOne({ _id: new ObjectId(req.params.id) });
    } else {
      project = await projectsCollection.findOne({ _id: req.params.id });
    }

    if (!project || !project.comments) {
      return res.status(404).json({ message: 'Project or comment not found' });
    }

    const commentId = ObjectId.isValid(req.params.commentId) ? new ObjectId(req.params.commentId) : req.params.commentId;
    const replyId = ObjectId.isValid(req.params.replyId) ? new ObjectId(req.params.replyId) : req.params.replyId;
    
    const commentIndex = project.comments.findIndex(c => 
      (c._id && c._id.toString() === commentId.toString()) || c._id === commentId
    );

    if (commentIndex === -1 || !project.comments[commentIndex].replies) {
      return res.status(404).json({ message: 'Comment or reply not found' });
    }

    const replyIndex = project.comments[commentIndex].replies.findIndex(r => 
      (r._id && r._id.toString() === replyId.toString()) || r._id === replyId
    );

    if (replyIndex === -1) {
      return res.status(404).json({ message: 'Reply not found' });
    }

    // Check if user is reply owner or comment owner or project owner or admin
    const { getUsersCollection } = require('../config/database');
    const usersCollection = await getUsersCollection();
    const user = await usersCollection.findOne({ uid: req.user.uid });
    const isAdmin = user?.isAdmin || false;

    if (project.comments[commentIndex].replies[replyIndex].userId !== req.user.uid && 
        project.comments[commentIndex].userId !== req.user.uid &&
        project.authorId !== req.user.uid && 
        !isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Remove reply
    project.comments[commentIndex].replies.splice(replyIndex, 1);

    // Update project
    await projectsCollection.updateOne(
      { _id: project._id },
      { 
        $set: { 
          comments: project.comments,
          updatedAt: new Date() 
        } 
      }
    );

    // Get updated project
    const updatedProject = await projectsCollection.findOne({ _id: project._id });
    res.json({ 
      message: 'Reply deleted successfully',
      project: new Project(updatedProject).toJSON()
    });
  } catch (error) {
    console.error('Error deleting reply:', error);
    res.status(500).json({ message: 'Error deleting reply' });
  }
});

module.exports = router;

