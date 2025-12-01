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
    const projectsCollection = getProjectsCollection();
    const { getUsersCollection } = require('../config/database');
    const usersCollection = getUsersCollection();
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
    if (isAdmin) {
      // Admins can see all projects
    } else {
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
    if (req.query.keywords) {
      // Sanitize: remove special regex characters and limit length
      const sanitizedKeywords = String(req.query.keywords)
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .substring(0, 200);
      if (sanitizedKeywords.length > 0) {
        query.$or = [
          { title: { $regex: sanitizedKeywords, $options: 'i' } },
          { abstract: { $regex: sanitizedKeywords, $options: 'i' } },
          { tags: { $regex: sanitizedKeywords, $options: 'i' } },
        ];
      }
    }

    const projects = await projectsCollection.find(query).sort({ createdAt: -1 }).toArray();
    res.json(projects.map(p => new Project(p).toJSON()));
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ message: 'Error fetching projects' });
  }
});

// Get project by ID
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const projectsCollection = getProjectsCollection();
    
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
    const projectsCollection = getProjectsCollection();
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
    const projectsCollection = getProjectsCollection();
    
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

    const result = await projectsCollection.insertOne(projectData);
    const project = await projectsCollection.findOne({ _id: result.insertedId });

    res.status(201).json({ message: 'Project submitted successfully', project: new Project(project).toJSON() });
  } catch (error) {
    console.error('Error submitting project:', error);
    res.status(500).json({ message: error.message || 'Error submitting project' });
  }
});

// Update project status (for admin or project owner)
router.put('/:id/status', verifyToken, async (req, res) => {
  try {
    const projectsCollection = getProjectsCollection();
    const { getUsersCollection } = require('../config/database');
    const usersCollection = getUsersCollection();
    
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

module.exports = router;

