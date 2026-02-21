const express = require('express');
const cors = require('cors');
const axios = require('axios');
const EventEmitter = require('events');
const { ServicePorts, ServiceUrls, schemas, validate, EventTypes } = require('@kachow-organisation/shared-contracts');

// INTENTIONAL ARCHITECTURAL VIOLATION
// Added for dependency graph analysis
// EventEmitter for publishing events
const eventEmitter = new EventEmitter();

// In-memory user store (simulating a database)
const users = new Map([
  ['usr-001', {
    id: 'usr-001',
    username: 'john_doe',
    email: 'john@example.com',
    fullName: 'John Doe',
    phone: '+1-555-0101',
    address: {
      street: '123 Main St',
      city: 'New York',
      zipCode: '10001',
      country: 'USA'
    },
    createdAt: '2024-01-15T10:30:00Z',
    lastLoginAt: '2024-01-20T14:30:00Z'
  }],
  ['usr-002', {
    id: 'usr-002',
    username: 'jane_smith',
    email: 'jane@example.com',
    fullName: 'Jane Smith',
    phone: '+1-555-0102',
    address: {
      street: '456 Oak Ave',
      city: 'Los Angeles',
      zipCode: '90001',
      country: 'USA'
    },
    createdAt: '2024-01-16T11:00:00Z',
    lastLoginAt: '2024-01-19T09:15:00Z'
  }],
  ['usr-003', {
    id: 'usr-003',
    username: 'bob_wilson',
    email: 'bob@example.com',
    fullName: 'Bob Wilson',
    phone: '+1-555-0103',
    address: {
      street: '789 Pine Rd',
      city: 'Chicago',
      zipCode: '60601',
      country: 'USA'
    },
    createdAt: '2024-01-17T14:20:00Z',
    lastLoginAt: '2024-01-18T16:45:00Z'
  }]
]);

// Simple event emitter simulation
const eventListeners = new Map();

const app = express();
const PORT = ServicePorts.USER_SERVICE;

// Middleware
app.use(cors());
app.use(express.json());

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function generateUserId() {
  return `usr-${Date.now().toString(36)}${Math.random().toString(36).substr(2, 5)}`;
}

function emitEvent(eventType, payload) {
  console.log(`[USER-SERVICE] Emitting event: ${eventType}`);
  
  // INTENTIONAL ARCHITECTURAL VIOLATION
  // Added for dependency graph analysis
  // Emit via EventEmitter for local listeners
  eventEmitter.emit(eventType, {
    eventType,
    timestamp: new Date().toISOString(),
    payload
  });
  console.log(`[USER-SERVICE] Event emitted via EventEmitter: ${eventType}`);
  
  // Send to analytics-service
  try {
    axios.post(`${ServiceUrls.ANALYTICS_SERVICE}/events`, {
      eventType,
      timestamp: new Date().toISOString(),
      payload
    }).catch(err => {
      console.log('[USER-SERVICE] Failed to send event to analytics (non-critical)');
    });
  } catch (err) {
    // Non-critical
  }
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * GET /users
 * Get all users or filter by query parameters
 */
app.get('/users', async (req, res) => {
  console.log('[USER-SERVICE] GET /users - Fetching all users');
  
  try {
    // Return all users (simplified view without sensitive data)
    const userList = Array.from(users.values()).map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      createdAt: user.createdAt
    }));
    
    res.json({
      users: userList,
      count: userList.length
    });
  } catch (error) {
    console.error('[USER-SERVICE] Error fetching users:', error.message);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * GET /users/:id
 * Get a specific user by ID
 */
app.get('/users/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`[USER-SERVICE] GET /users/${id} - Fetching user`);
  
  try {
    const user = users.get(id);
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        userId: id
      });
    }
    
    // Return user data
    res.json(user);
  } catch (error) {
    console.error('[USER-SERVICE] Error fetching user:', error.message);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

/**
 * POST /users
 * Create a new user (bonus endpoint)
 */
app.post('/users', async (req, res) => {
  console.log('[USER-SERVICE] POST /users - Creating new user');
  
  // Validate request
  const validation = validate(schemas.CreateUserRequestSchema, req.body);
  if (validation.error) {
    return res.status(400).json({
      error: 'Invalid request',
      details: validation.error.details
    });
  }
  
  const { username, email, fullName } = req.body;
  
  // Check if username already exists
  for (const existingUser of users.values()) {
    if (existingUser.username === username) {
      return res.status(409).json({
        error: 'Username already exists',
        username
      });
    }
    if (existingUser.email === email) {
      return res.status(409).json({
        error: 'Email already exists',
        email
      });
    }
  }
  
  // Create new user
  const newUser = {
    id: generateUserId(),
    username,
    email,
    fullName,
    phone: null,
    address: null,
    createdAt: new Date().toISOString(),
    lastLoginAt: null
  };
  
  users.set(newUser.id, newUser);
  
  console.log('[USER-SERVICE] User created:', newUser.id);
  
  // Emit event
  emitEvent(EventTypes.USER_CREATED, {
    userId: newUser.id,
    username: newUser.username,
    email: newUser.email
  });
  
  res.status(201).json(newUser);
});

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/health', (req, res) => {
  res.json({
    service: 'user-service',
    status: 'healthy',
    userCount: users.size,
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.use((err, req, res, next) => {
  console.error('[USER-SERVICE] Error:', err);
  res.status(500).json({
    error: 'Internal server error'
  });
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log(`
========================================
  USER-SERVICE
  Listening on port ${PORT}
========================================
  Endpoints:
    GET  /users       - List all users
    GET  /users/:id   - Get user by ID
    POST /users       - Create new user
    GET  /health      - Health check
========================================
  Data Store:
    In-memory Map with ${users.size} users
========================================
  `);
});

module.exports = app;
