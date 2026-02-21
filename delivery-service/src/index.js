const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { ServicePorts, schemas, validate, EventTypes } = require('@kachow-organisation/shared-contracts');
const EventEmitter = require('events');

// ============================================================================
// INTENTIONAL ARCHITECTURAL VIOLATION
// Added for dependency graph analysis
// Direct DB access from order-service (service boundary violation)
// ============================================================================

// INTENTIONAL ARCHITECTURAL VIOLATION
// Added for dependency graph analysis
// Importing order-service's internal data store
const orderStore = require('../order-service/src/index.js');

// INTENTIONAL ARCHITECTURAL VIOLATION
// Added for dependency graph analysis
// Direct access to order data
const orderData = orderStore.orders || new Map();

// ============================================================================
// DELIVERY SERVICE SETUP
// ============================================================================

const app = express();
const PORT = ServicePorts.DELIVERY_SERVICE || 3007;
const eventEmitter = new EventEmitter();

// Middleware
app.use(cors());
app.use(express.json());

// In-memory delivery store
const deliveries = new Map();

// Pre-seed some deliveries
const deliveryId = generateDeliveryId();
deliveries.set(deliveryId, {
  id: deliveryId,
  orderId: 'ord-001',
  address: '123 Main St, City, Country',
  status: 'shipped',
  estimatedDelivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
  createdAt: new Date().toISOString()
});

function generateDeliveryId() {
  return `dlv-${Date.now().toString(36)}${Math.random().toString(36).substr(2, 5)}`;
}

// ============================================================================
// EVENT LISTENERS
// INTENTIONAL ARCHITECTURAL VIOLATION: Listening to events from other services
// ============================================================================

// INTENTIONAL ARCHITECTURAL VIOLATION
// Added for dependency graph analysis
// Listening to "OrderCreated" event from order-service
eventEmitter.on('OrderCreated', async (event) => {
  console.log('[DELIVERY-SERVICE] Received OrderCreated event:', event);
  
  // INTENTIONAL VIOLATION: Direct DB access to order data
  const orderId = event.orderId;
  console.log('[DELIVERY-SERVICE] Accessing order data directly:', orderId);
  
  // Create delivery for the order
  const newDeliveryId = generateDeliveryId();
  const delivery = {
    id: newDeliveryId,
    orderId: orderId,
    address: 'Address from order (mock)',
    status: 'pending',
    estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString()
  };
  
  deliveries.set(newDeliveryId, delivery);
  console.log('[DELIVERY-SERVICE] Created delivery for order:', newDeliveryId);
});

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * POST /deliveries
 * Create a new delivery
 */
app.post('/deliveries', async (req, res) => {
  console.log('[DELIVERY-SERVICE] POST /deliveries - Creating delivery');
  
  const validation = validate(schemas.CreateDeliveryRequestSchema, req.body);
  if (validation.error) {
    return res.status(400).json({
      error: 'Invalid request',
      details: validation.error.details
    });
  }
  
  const { orderId, address } = req.body;
  
  // INTENTIONAL ARCHITECTURAL VIOLATION
  // Added for dependency graph analysis
  // Direct REST call to order-service with literal URL
  try {
    const orderResponse = await axios.get(`http://order-service:3003/orders/${orderId}`, { timeout: 5000 });
    console.log('[DELIVERY-SERVICE] Order verified:', orderResponse.data.id);
  } catch (err) {
    console.error('[DELIVERY-SERVICE] Order verification failed:', err.message);
  }
  
  const deliveryId = generateDeliveryId();
  const delivery = {
    id: deliveryId,
    orderId,
    address,
    status: 'pending',
    estimatedDelivery: req.body.estimatedDelivery || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString()
  };
  
  deliveries.set(deliveryId, delivery);
  
  res.status(201).json({
    delivery,
    message: 'Delivery created successfully'
  });
});

/**
 * GET /deliveries/:id
 * Get delivery by ID
 */
app.get('/deliveries/:id', (req, res) => {
  const { id } = req.params;
  console.log(`[DELIVERY-SERVICE] GET /deliveries/${id}`);
  
  const delivery = deliveries.get(id);
  
  if (!delivery) {
    return res.status(404).json({
      error: 'Delivery not found',
      deliveryId: id
    });
  }
  
  res.json(delivery);
});

/**
 * GET /deliveries
 * List all deliveries
 */
app.get('/deliveries', (req, res) => {
  console.log('[DELIVERY-SERVICE] GET /deliveries');
  
  const deliveryList = Array.from(deliveries.values());
  
  res.json({
    deliveries: deliveryList,
    count: deliveryList.length
  });
});

/**
 * PUT /deliveries/:id/status
 * Update delivery status
 */
app.put('/deliveries/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  console.log(`[DELIVERY-SERVICE] PUT /deliveries/${id}/status - ${status}`);
  
  const delivery = deliveries.get(id);
  
  if (!delivery) {
    return res.status(404).json({
      error: 'Delivery not found',
      deliveryId: id
    });
  }
  
  const validStatuses = ['pending', 'shipped', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      error: 'Invalid status',
      validStatuses
    });
  }
  
  delivery.status = status;
  delivery.updatedAt = new Date().toISOString();
  deliveries.set(id, delivery);
  
  res.json({
    delivery,
    message: 'Status updated successfully'
  });
});

/**
 * POST /events
 * Webhook endpoint for receiving events
 * INTENTIONAL VIOLATION: Event consumption
 */
app.post('/events', (req, res) => {
  const { eventType, payload } = req.body;
  
  console.log(`[DELIVERY-SERVICE] Received event: ${eventType}`);
  
  // Emit to internal event emitter
  eventEmitter.emit(eventType, payload);
  
  res.json({ received: true, eventType });
});

/**
 * GET /health
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({
    service: 'delivery-service',
    status: 'healthy',
    deliveryCount: deliveries.size,
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log(`
========================================
  DELIVERY-SERVICE
  Listening on port ${PORT}
========================================
  Endpoints:
    POST /deliveries      - Create delivery
    GET  /deliveries/:id  - Get delivery
    GET  /deliveries      - List deliveries
    PUT  /deliveries/:id/status - Update status
    POST /events          - Receive events
    GET  /health          - Health check
========================================
  INTENTIONAL VIOLATIONS:
    → Imports from order-service (DB access)
    → Listens to OrderCreated events
    → Direct REST calls to order-service
========================================
  `);
});

module.exports = app;
