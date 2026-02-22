const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { ServicePorts, ServiceUrls } = require('@kachow-organisation/shared-contracts');

const app = express();
const PORT = ServicePorts.API_GATEWAY;

// ============================================================================
// ARCHITECTURAL VIOLATION NOTE:
// This API Gateway directly imports ServiceUrls from shared-contracts.
// In a proper microservices architecture, the gateway should use service 
// discovery (Consul, Eureka, Kubernetes DNS) rather than hardcoded URLs.
// 
// Additionally, this gateway has implicit knowledge of all service endpoints,
// which creates coupling. A better approach would be to use path-based
// routing with minimal transformation.
// ============================================================================

// Middleware
app.use(cors());
app.use(express.json());

// ============================================================================
// REQUEST LOGGING MIDDLEWARE
// ============================================================================

app.use((req, res, next) => {
  console.log(`[API-GATEWAY] ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// ============================================================================
// SERVICE ROUTING CONFIGURATION
// ============================================================================

/**
 * Route requests to auth-service
 * Paths: /auth/*
 */
app.use('/auth', async (req, res) => {
  try {
    const targetUrl = `${ServiceUrls.AUTH_SERVICE}${req.path.replace('/auth', '')}`;
    console.log(`[API-GATEWAY] Routing to auth-service: ${targetUrl}`);
    
    const response = await axios({
      method: req.method,
      url: targetUrl,
      data: req.body,
      headers: {
        'Content-Type': 'application/json',
        ...req.headers
      },
      timeout: 10000
    });
    
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('[API-GATEWAY] auth-service error:', error.message);
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(503).json({ error: 'Auth service unavailable', message: error.message });
    }
  }
});
//heyyyyyyyyyyyyy
/**
 * Route requests to user-service
 * Paths: /users/*
 */
app.use('/users', async (req, res) => {
  try {
    const targetUrl = `${ServiceUrls.USER_SERVICE}${req.path}`;
    console.log(`[API-GATEWAY] Routing to user-service: ${targetUrl}`);
    
    const response = await axios({
      method: req.method,
      url: targetUrl,
      data: req.body,
      headers: {
        'Content-Type': 'application/json',
        ...req.headers
      },
      timeout: 10000
    });
    
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('[API-GATEWAY] user-service error:', error.message);
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(503).json({ error: 'User service unavailable', message: error.message });
    }
  }
});

/**
 * Route requests to order-service
 * Paths: /orders/*
 */
app.use('/orders', async (req, res) => {
  try {
    const targetUrl = `${ServiceUrls.ORDER_SERVICE}${req.path}`;
    console.log(`[API-GATEWAY] Routing to order-service: ${targetUrl}`);
    
    const response = await axios({
      method: req.method,
      url: targetUrl,
      data: req.body,
      headers: {
        'Content-Type': 'application/json',
        ...req.headers
      },
      timeout: 15000 // Orders may take longer due to payment processing
    });
    
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('[API-GATEWAY] order-service error:', error.message);
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(503).json({ error: 'Order service unavailable', message: error.message });
    }
  }
});

/**
 * Route requests to payment-service
 * Paths: /payments/*
 */
app.use('/payments', async (req, res) => {
  try {
    const targetUrl = `${ServiceUrls.PAYMENT_SERVICE}${req.path}`;
    console.log(`[API-GATEWAY] Routing to payment-service: ${targetUrl}`);
    
    const response = await axios({
      method: req.method,
      url: targetUrl,
      data: req.body,
      headers: {
        'Content-Type': 'application/json',
        ...req.headers
      },
      timeout: 15000
    });
    
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('[API-GATEWAY] payment-service error:', error.message);
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(503).json({ error: 'Payment service unavailable', message: error.message });
    }
  }
});

/**
 * Route requests to notification-service
 * Paths: /notifications/*
 */
app.use('/notifications', async (req, res) => {
  try {
    const targetUrl = `${ServiceUrls.NOTIFICATION_SERVICE}${req.path}`;
    console.log(`[API-GATEWAY] Routing to notification-service: ${targetUrl}`);
    
    const response = await axios({
      method: req.method,
      url: targetUrl,
      data: req.body,
      headers: {
        'Content-Type': 'application/json',
        ...req.headers
      },
      timeout: 10000
    });
    
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('[API-GATEWAY] notification-service error:', error.message);
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(503).json({ error: 'Notification service unavailable', message: error.message });
    }
  }
});

/**
 * Route requests to analytics-service
 * Paths: /analytics/*
 */
app.use('/analytics', async (req, res) => {
  try {
    const targetUrl = `${ServiceUrls.ANALYTICS_SERVICE}${req.path}`;
    console.log(`[API-GATEWAY] Routing to analytics-service: ${targetUrl}`);
    
    const response = await axios({
      method: req.method,
      url: targetUrl,
      data: req.body,
      headers: {
        'Content-Type': 'application/json',
        ...req.headers
      },
      timeout: 10000
    });
    
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('[API-GATEWAY] analytics-service error:', error.message);
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(503).json({ error: 'Analytics service unavailable', message: error.message });
    }
  }
});

// ============================================================================
// UNDOCUMENTED ENDPOINT (ARCHITECTURAL VIOLATION)
// ============================================================================
// 
// The following endpoint is NOT documented in the API documentation.
// This is an intentional architectural violation for testing purposes.
// In production, all endpoints should be documented and follow API governance.
// ============================================================================

/**
 * POST /internal/service-status
 * Undocumented endpoint to check all service statuses
 * This is an internal/debug endpoint not meant for public use
 */
app.post('/internal/service-status', async (req, res) => {
  console.log('[API-GATEWAY] UNDOCUMENTED ENDPOINT: /internal/service-status');
  console.log('[API-GATEWAY] This endpoint is not documented and should not be used by clients');
  
  const services = [
    { name: 'auth-service', url: ServiceUrls.AUTH_SERVICE },
    { name: 'user-service', url: ServiceUrls.USER_SERVICE },
    { name: 'order-service', url: ServiceUrls.ORDER_SERVICE },
    { name: 'payment-service', url: ServiceUrls.PAYMENT_SERVICE },
    { name: 'notification-service', url: ServiceUrls.NOTIFICATION_SERVICE },
    { name: 'analytics-service', url: ServiceUrls.ANALYTICS_SERVICE }
  ];
  
  const statusChecks = await Promise.all(
    services.map(async (service) => {
      try {
        const response = await axios.get(`${service.url}/health`, { timeout: 3000 });
        return {
          name: service.name,
          url: service.url,
          status: 'up',
          responseTime: response.headers['x-response-time'] || 'unknown'
        };
      } catch (err) {
        return {
          name: service.name,
          url: service.url,
          status: 'down',
          error: err.message
        };
      }
    })
  );
  
  res.json({
    gateway: 'api-gateway',
    timestamp: new Date().toISOString(),
    services: statusChecks,
    warning: 'This is an undocumented internal endpoint'
  });
});

// ============================================================================
// GATEWAY ROOT ENDPOINTS
// ============================================================================

/**
 * GET /health
 * Gateway health check
 */
app.get('/health', (req, res) => {
  res.json({
    service: 'api-gateway',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    routes: [
      '/auth/* -> auth-service',
      '/users/* -> user-service',
      '/orders/* -> order-service',
      '/payments/* -> payment-service',
      '/notifications/* -> notification-service',
      '/analytics/* -> analytics-service'
    ]
  });
});

/**
 * GET /
 * Gateway info
 */
app.get('/', (req, res) => {
  res.json({
    name: 'KaChow API Gateway',
    version: '1.0.0',
    description: 'Unified entry point for KaChow microservices',
    documentation: 'See individual service READMEs for API details',
    services: {
      auth: { path: '/auth', port: ServicePorts.AUTH_SERVICE },
      users: { path: '/users', port: ServicePorts.USER_SERVICE },
      orders: { path: '/orders', port: ServicePorts.ORDER_SERVICE },
      payments: { path: '/payments', port: ServicePorts.PAYMENT_SERVICE },
      notifications: { path: '/notifications', port: ServicePorts.NOTIFICATION_SERVICE },
      analytics: { path: '/analytics', port: ServicePorts.ANALYTICS_SERVICE }
    }
  });
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.use((err, req, res, next) => {
  console.error('[API-GATEWAY] Error:', err);
  res.status(500).json({
    error: 'Gateway error',
    message: err.message
  });
});

// ============================================================================
// 404 HANDLER
// ============================================================================

app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Path ${req.path} not found. Available routes: /auth, /users, /orders, /payments, /notifications, /analytics`,
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log(`
========================================
  API-GATEWAY
  Listening on port ${PORT}
========================================
  Gateway Routes:
    /auth/*         → auth-service (port ${ServicePorts.AUTH_SERVICE})
    /users/*        → user-service (port ${ServicePorts.USER_SERVICE})
    /orders/*       → order-service (port ${ServicePorts.ORDER_SERVICE})
    /payments/*     → payment-service (port ${ServicePorts.PAYMENT_SERVICE})
    /notifications/* → notification-service (port ${ServicePorts.NOTIFICATION_SERVICE})
    /analytics/*    → analytics-service (port ${ServicePorts.ANALYTICS_SERVICE})
    
  ⚠️  UNDOCUMENTED ENDPOINT (for testing only):
    POST /internal/service-status
========================================
  Features:
    ✓ Request logging
    ✓ Error handling
    ✓ Timeout configuration
    ✓ Service health aggregation
========================================
  `);
});

module.exports = app;
