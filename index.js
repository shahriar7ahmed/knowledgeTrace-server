const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { connectDB } = require('./config/database');

const app = express();
const port = process.env.PORT || 3000;

// Rate limiting middleware (simple in-memory implementation)
const rateLimitStore = new Map();
const rateLimit = (windowMs = 15 * 60 * 1000, maxRequests = 100) => {
  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    if (!rateLimitStore.has(key)) {
      rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    const record = rateLimitStore.get(key);
    
    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + windowMs;
      return next();
    }
    
    if (record.count >= maxRequests) {
      return res.status(429).json({ 
        message: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((record.resetTime - now) / 1000)
      });
    }
    
    record.count++;
    next();
  };
};

// Clean up old rate limit records periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60 * 1000); // Clean up every minute

// Apply rate limiting
app.use(rateLimit(15 * 60 * 1000, 100)); // 100 requests per 15 minutes per IP

// Stricter rate limiting for auth endpoints
const authRateLimit = rateLimit(15 * 60 * 1000, 5); // 5 requests per 15 minutes for auth

// Middleware
const corsOrigin = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(cors({
  origin: corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Add security headers to help with OAuth popups
app.use((req, res, next) => {
  // Allow popups for OAuth
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
  next();
});
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
const userRoutes = require('./routes/users');
const projectRoutes = require('./routes/projects');
const adminRoutes = require('./routes/admin');

// Apply stricter rate limiting to auth-related routes
app.use('/api/users', authRateLimit, userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/admin', authRateLimit, adminRoutes);

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ message: 'KnowledgeTrace API is running!', status: 'ok' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Start server
async function startServer() {
  try {
    // Connect to MongoDB
    await connectDB();
    
    // Start listening
    app.listen(port, () => {
      console.log(`🚀 KnowledgeTrace server is running on port ${port}`);
      console.log(`📡 API available at http://localhost:${port}/api`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
