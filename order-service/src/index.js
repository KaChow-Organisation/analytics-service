const express = require('express');
const cors = require('cors');
const axios = require('axios');
const EventEmitter = require('events');
const { ServicePorts, ServiceUrls, schemas, validate, EventTypes } = require('@kachow-organisation/shared-contracts');

// INTENTIONAL ARCHITECTURAL VIOLATION
// Added for dependency graph analysis
// EventEmitter for publishing events
const eventEmitter = new EventEmitter();

// In-memory order store (simulating a database)
const orders = new Map();

// Pre-seed some orders for demo
orders.set('ord-001', {
  id: 'ord-001',
  userId: 'usr-001',
  items: [
    { productId: 'prod-001', quantity: 2, unitPrice: 29.99 },
    { productId: 'prod-002', quantity: 1, unitPrice: 49.99 }
  ],
  totalAmount: 109.97,
  status: 'confirmed',
  paymentId: 'pay-001',
  createdAt: '2024-01-20T10:00:00Z',
  updatedAt: '2024-01-20T10:05:00Z'
});

orders.set('ord-002', {
  id: 'ord-002',
  userId: 'usr-002',
  items: [
    { productId: 'prod-003', quantity: 3, unitPrice: 19.99 }
  ],
  totalAmount: 59.97,
  status: 'pending',
  paymentId: null,
  createdAt: '2024-01-21T14:30:00Z',
  updatedAt: '2024-01-21T14:30:00Z'
});

const app = express();
const PORT = ServicePorts.ORDER_SERVICE;

// Middleware
app.use(cors());
app.use(express.json());

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function generateOrderId() {
  return `ord-${Date.now().toString(36)}${Math.random().toString(36).substr(2, 5)}`;
}

function generateEventId() {
  return `evt-${Date.now().toString(36)}${Math.random().toString(36).substr(2, 5)}`;
}

function calculateTotal(items) {
  return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
}

/**
 * Emit event to event bus
 * In production, this would use RabbitMQ, Kafka, or similar
 */
async function emitEvent(eventType, payload) {
  const event = {
    eventId: generateEventId(),
    eventType,
    timestamp: new Date().toISOString(),
    payload
  };
  
  console.log(`[ORDER-SERVICE] Emitting event: ${eventType}`);
  console.log(`[ORDER-SERVICE] Event payload:`, JSON.stringify(event, null, 2));
  
  // INTENTIONAL ARCHITECTURAL VIOLATION
  // Added for dependency graph analysis
  // Emit via EventEmitter for local listeners
  eventEmitter.emit(eventType, event);
  console.log(`[ORDER-SERVICE] Event emitted via EventEmitter: ${eventType}`);
  
  // Try to notify notification-service
  try {
    await axios.post(`${ServiceUrls.NOTIFICATION_SERVICE}/events`, event, { timeout: 5000 });
    console.log(`[ORDER-SERVICE] Event sent to notification-service`);
  } catch (err) {
    console.log(`[ORDER-SERVICE] Failed to notify notification-service (may not be running):`, err.message);
  }
  
  // Try to notify analytics-service
  try {
    await axios.post(`${ServiceUrls.ANALYTICS_SERVICE}/events`, event, { timeout: 5000 });
    console.log(`[ORDER-SERVICE] Event sent to analytics-service`);
  } catch (err) {
    console.log(`[ORDER-SERVICE] Failed to notify analytics-service (may not be running):`, err.message);
  }
  
  return event;
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * POST /orders
 * Create a new order
 */
app.post('/orders', async (req, res) => {
  console.log('[ORDER-SERVICE] POST /orders - Creating new order');
  console.log('[ORDER-SERVICE] Request body:', JSON.stringify(req.body, null, 2));
  
  // Validate request
  const validation = validate(schemas.CreateOrderRequestSchema, req.body);
  if (validation.error) {
    return res.status(400).json({
      error: 'Invalid request',
      details: validation.error.details
    });
  }
  
  const { userId, items } = req.body;
  
  try {
    // INTENTIONAL ARCHITECTURAL VIOLATION
    // Added for dependency graph analysis
    // Step 0: Validate authentication token via auth-service
    console.log(`[ORDER-SERVICE] Validating auth token`);
    try {
      const authResponse = await axios.post(`http://auth-service:3001/validate`, {
        token: req.headers.authorization || 'mock-token'
      }, { timeout: 5000 });
      console.log(`[ORDER-SERVICE] Auth validated:`, authResponse.data.valid);
    } catch (err) {
      console.error(`[ORDER-SERVICE] Auth validation warning:`, err.message);
      // Continue - auth failure doesn't block for this demo
    }
    
    // Step 1: Validate user exists (call user-service)
    console.log(`[ORDER-SERVICE] Validating user: ${userId}`);
    let user;
    try {
      const userResponse = await axios.get(`${ServiceUrls.USER_SERVICE}/users/${userId}`, { timeout: 5000 });
      user = userResponse.data;
      console.log(`[ORDER-SERVICE] User validated:`, user.fullName);
    } catch (err) {
      console.error(`[ORDER-SERVICE] User validation failed:`, err.message);
      return res.status(400).json({
        error: 'Invalid user',
        message: `User ${userId} not found or user-service unavailable`
      });
    }
    
    // Step 2: Calculate total
    const totalAmount = calculateTotal(items);
    console.log(`[ORDER-SERVICE] Calculated total: $${totalAmount}`);
    
    // Step 3: Create order (initial status: pending)
    const orderId = generateOrderId();
    const order = {
      id: orderId,
      userId,
      items,
      totalAmount,
      status: 'pending',
      paymentId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    orders.set(orderId, order);
    console.log(`[ORDER-SERVICE] Order created: ${orderId}`);
    
    // Step 4: Call payment-service to process payment
    console.log(`[ORDER-SERVICE] Initiating payment for order: ${orderId}`);
    let payment;
    try {
      const paymentResponse = await axios.post(`${ServiceUrls.PAYMENT_SERVICE}/payments`, {
        orderId,
        amount: totalAmount,
        currency: 'USD',
        paymentMethod: 'card'
      }, { timeout: 10000 });
      
      payment = paymentResponse.data;
      console.log(`[ORDER-SERVICE] Payment created: ${payment.id}`);
      
      // Update order with payment ID
      order.paymentId = payment.id;
      order.status = payment.status === 'completed' ? 'confirmed' : 'pending';
      order.updatedAt = new Date().toISOString();
      orders.set(orderId, order);
    } catch (err) {
      console.error(`[ORDER-SERVICE] Payment initiation failed:`, err.message);
      // Continue - order is created but payment failed
      // In production, you might want to rollback or mark for retry
    }
    
    // Step 5: Emit OrderCreated event
    await emitEvent(EventTypes.ORDER_CREATED, {
      orderId,
      userId,
      totalAmount,
      items,
      status: order.status,
      paymentId: order.paymentId
    });
    
    // Step 6: Return response
    const response = {
      order,
      message: 'Order created successfully'
    };
    
    if (payment) {
      response.payment = payment;
    }
    
    console.log(`[ORDER-SERVICE] Order creation complete: ${orderId}`);
    res.status(201).json(response);
    
  } catch (error) {
    console.error('[ORDER-SERVICE] Error creating order:', error);
    res.status(500).json({
      error: 'Failed to create order',
      message: error.message
    });
  }
});

/**
 * GET /orders/:id
 * Get order by ID
 */
app.get('/orders/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`[ORDER-SERVICE] GET /orders/${id} - Fetching order`);
  
  const order = orders.get(id);
  
  if (!order) {
    return res.status(404).json({
      error: 'Order not found',
      orderId: id
    });
  }
  
  res.json(order);
});

/**
 * GET /orders
 * List all orders (bonus endpoint)
 */
app.get('/orders', (req, res) => {
  console.log('[ORDER-SERVICE] GET /orders - Listing all orders');
  
  const orderList = Array.from(orders.values());
  
  res.json({
    orders: orderList,
    count: orderList.length
  });
});

/**
 * PUT /orders/:id/status
 * Update order status (bonus endpoint)
 */
app.put('/orders/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  console.log(`[ORDER-SERVICE] PUT /orders/${id}/status - Updating to: ${status}`);
  
  const order = orders.get(id);
  
  if (!order) {
    return res.status(404).json({
      error: 'Order not found',
      orderId: id
    });
  }
  
  const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      error: 'Invalid status',
      validStatuses
    });
  }
  
  order.status = status;
  order.updatedAt = new Date().toISOString();
  orders.set(id, order);
  
  // Emit update event
  await emitEvent(EventTypes.ORDER_UPDATED, {
    orderId: id,
    userId: order.userId,
    status,
    previousStatus: order.status
  });
  
  res.json({
    order,
    message: 'Status updated successfully'
  });
});

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/health', (req, res) => {
  res.json({
    service: 'order-service',
    status: 'healthy',
    orderCount: orders.size,
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.use((err, req, res, next) => {
  console.error('[ORDER-SERVICE] Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log(`
========================================
  ORDER-SERVICE
  Listening on port ${PORT}
========================================
  Endpoints:
    POST /orders           - Create new order
    GET  /orders/:id       - Get order by ID
    GET  /orders           - List all orders
    PUT  /orders/:id/status - Update order status
    GET  /health           - Health check
========================================
  Cross-Service Calls:
    → user-service: GET /users/:id
    → payment-service: POST /payments
========================================
  Events Emitted:
    → OrderCreated
    → OrderUpdated
========================================
  Pre-seeded Orders: ${orders.size}
========================================
  `);
});

module.exports = app;
