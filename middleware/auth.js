// Firebase token verification middleware
const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
      : null;

    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else {
      console.warn('Firebase Admin not initialized. Set FIREBASE_SERVICE_ACCOUNT_KEY in .env');
    }
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
  }
}

// Middleware to verify Firebase token
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        message: 'No token provided',
        code: 'NO_TOKEN'
      });
    }

    const token = authHeader.split('Bearer ')[1].trim();
    
    if (!token) {
      return res.status(401).json({ 
        message: 'Token is empty',
        code: 'EMPTY_TOKEN'
      });
    }
    
    if (!admin.apps.length) {
      // If Firebase Admin is not configured, skip verification (for development only)
      if (process.env.NODE_ENV === 'production') {
        console.error('Firebase Admin not configured in production!');
        return res.status(500).json({ 
          message: 'Server configuration error',
          code: 'CONFIG_ERROR'
        });
      }
      console.warn('Firebase Admin not configured, skipping token verification (DEV MODE)');
      req.user = { uid: 'dev-user', email: 'dev@example.com', name: 'Dev User' };
      return next();
    }

    // Verify the token with Firebase Admin
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Ensure we have required fields
    if (!decodedToken.uid) {
      return res.status(401).json({ 
        message: 'Invalid token: missing user ID',
        code: 'INVALID_TOKEN'
      });
    }
    
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || null,
      name: decodedToken.name || decodedToken.email?.split('@')[0] || 'User',
    };
    
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    
    // Provide specific error messages
    let message = 'Invalid or expired token';
    let code = 'TOKEN_ERROR';
    
    if (error.code === 'auth/id-token-expired') {
      message = 'Token has expired. Please login again.';
      code = 'TOKEN_EXPIRED';
    } else if (error.code === 'auth/id-token-revoked') {
      message = 'Token has been revoked. Please login again.';
      code = 'TOKEN_REVOKED';
    } else if (error.code === 'auth/argument-error') {
      message = 'Invalid token format.';
      code = 'INVALID_FORMAT';
    }
    
    return res.status(401).json({ 
      message,
      code
    });
  }
};

// Optional middleware - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1];
      
      if (admin.apps.length) {
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.user = {
          uid: decodedToken.uid,
          email: decodedToken.email,
          name: decodedToken.name || decodedToken.email?.split('@')[0],
        };
      } else {
        req.user = { uid: 'dev-user', email: 'dev@example.com' };
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

// Middleware to check if user is admin
// This MUST be used after verifyToken middleware
const requireAdmin = async (req, res, next) => {
  try {
    // Ensure user is authenticated first
    if (!req.user || !req.user.uid) {
      return res.status(401).json({ 
        message: 'Authentication required',
        code: 'NOT_AUTHENTICATED'
      });
    }

    // Check database for admin status
    const { getUsersCollection } = require('../config/database');
    const usersCollection = getUsersCollection();
    
    if (!usersCollection) {
      console.error('Database collection not available');
      return res.status(500).json({ 
        message: 'Database error',
        code: 'DB_ERROR'
      });
    }
    
    const user = await usersCollection.findOne({ uid: req.user.uid });

    if (!user) {
      return res.status(403).json({ 
        message: 'User profile not found. Please complete your profile.',
        code: 'USER_NOT_FOUND'
      });
    }

    // Check admin status - must be explicitly true
    if (user.isAdmin !== true) {
      console.warn(`Unauthorized admin access attempt by user: ${req.user.uid}`);
      return res.status(403).json({ 
        message: 'Admin access required',
        code: 'FORBIDDEN'
      });
    }

    // Attach admin status to request object
    req.user.isAdmin = true;
    req.user.adminVerified = true; // Flag that admin status was verified
    
    next();
  } catch (error) {
    console.error('Admin check error:', error);
    return res.status(500).json({ 
      message: 'Error checking admin status',
      code: 'ADMIN_CHECK_ERROR',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  verifyToken,
  optionalAuth,
  requireAdmin,
};

