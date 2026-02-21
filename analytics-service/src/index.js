const express = require('express');
const cors = require('cors');
const axios = require('axios');
const EventEmitter = require('events');
const { ServicePorts, EventTypes, ServiceUrls } = require('@kachow-organisation/shared-contracts');

// INTENTIONAL ARCHITECTURAL VIOLATION
// Added for dependency graph analysis
// EventEmitter for consuming all events
const eventEmitter = new EventEmitter();

// ============================================================================
// INTENTIONAL ARCHITECTURAL VIOLATION
// Added for dependency graph analysis
// Direct REST calls to order-service and payment-service
// ============================================================================

// ============================================================================
// INTENTIONAL ARCHITECTURAL VIOLATION - DB ACCESS
// Added for dependency graph analysis
// Direct access to other services' internal data stores
// ============================================================================

// INTENTIONAL ARCHITECTURAL VIOLATION
// Added for dependency graph analysis
// Importing order-service's internal data store
const orderDataStore = require('../order-service/src/index.js');

// INTENTIONAL ARCHITECTURAL VIOLATION
// Added for dependency graph analysis
// Importing payment-service's internal data store
const paymentDataStore = require('../payment-service/src/index.js');

// In-memory metrics store
const metrics = [];

// In-memory event store
const events = [];

// In-memory reports store
const reports = new Map();

const app = express();
const PORT = ServicePorts.ANALYTICS_SERVICE;

// Middleware
app.use(cors());
app.use(express.json());

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function generateReportId() {
  return `rpt-${Date.now().toString(36)}${Math.random().toString(36).substr(2, 5)}`;
}

function generateMetricId() {
  return `mtr-${Date.now().toString(36)}${Math.random().toString(36).substr(2, 5)}`;
}

// ============================================================================
// EVENT HANDLING
// ============================================================================

// INTENTIONAL ARCHITECTURAL VIOLATION
// Added for dependency graph analysis
// Register event listeners for EventEmitter - listens to ALL events
// Listen to "OrderCreated" events
eventEmitter.on('OrderCreated', async (event) => {
  console.log('[ANALYTICS-SERVICE] EventEmitter received OrderCreated event:', event);
  processEvent(event);
});

// Listen to "OrderUpdated" events
eventEmitter.on('OrderUpdated', async (event) => {
  console.log('[ANALYTICS-SERVICE] EventEmitter received OrderUpdated event:', event);
  processEvent(event);
});

// Listen to "PaymentProcessed" events
eventEmitter.on('PaymentProcessed', async (event) => {
  console.log('[ANALYTICS-SERVICE] EventEmitter received PaymentProcessed event:', event);
  processEvent(event);
});

// Listen to "PaymentFailed" events
eventEmitter.on('PaymentFailed', async (event) => {
  console.log('[ANALYTICS-SERVICE] EventEmitter received PaymentFailed event:', event);
  processEvent(event);
});

// Listen to "UserCreated" events
eventEmitter.on('UserCreated', async (event) => {
  console.log('[ANALYTICS-SERVICE] EventEmitter received UserCreated event:', event);
  processEvent(event);
});

/**
 * Store and process incoming events
 */
function processEvent(event) {
  console.log('[ANALYTICS-SERVICE] Processing event:', event.eventType);
  
  // Store the event
  events.push({
    ...event,
    receivedAt: new Date().toISOString()
  });
  
  // Generate metrics based on event type
  switch (event.eventType) {
    case EventTypes.ORDER_CREATED:
      recordMetric('order-service', 'orders_created', event.payload.totalAmount || 1, {
        orderId: event.payload.orderId,
        userId: event.payload.userId
      });
      break;
      
    case EventTypes.PAYMENT_PROCESSED:
      recordMetric(
        'payment-service',
        event.payload.status === 'completed' ? 'payments_successful' : 'payments_failed',
        event.payload.amount || 1,
        {
          paymentId: event.payload.paymentId,
          orderId: event.payload.orderId
        }
      );
      break;
      
    case EventTypes.USER_CREATED:
      recordMetric('user-service', 'users_created', 1, {
        userId: event.payload.userId
      });
      break;
  }
}

/**
 * Record a metric
 */
function recordMetric(service, metric, value, tags = {}) {
  const metricEntry = {
    id: generateMetricId(),
    service,
    metric,
    value,
    timestamp: new Date().toISOString(),
    tags
  };
  
  metrics.push(metricEntry);
  console.log(`[ANALYTICS-SERVICE] Metric recorded: ${service}.${metric} = ${value}`);
  
  return metricEntry;
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * POST /events
 * Receive events from other services
 */
app.post('/events', (req, res) => {
  const event = req.body;
  
  console.log('[ANALYTICS-SERVICE] POST /events - Received event');
  console.log('[ANALYTICS-SERVICE] Event type:', event.eventType);
  
  // Validate event structure
  if (!event.eventType || !event.timestamp) {
    return res.status(400).json({
      error: 'Invalid event structure',
      required: ['eventType', 'timestamp', 'payload']
    });
  }
  
  // Process event asynchronously
  processEvent(event);
  
  res.json({
    received: true,
    eventType: event.eventType,
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /metrics
 * Get all metrics or filter by query parameters
 */
app.get('/metrics', (req, res) => {
  console.log('[ANALYTICS-SERVICE] GET /metrics - Retrieving metrics');
  
  const { service, metric, from, to, limit = 100 } = req.query;
  
  let filteredMetrics = [...metrics];
  
  // Filter by service
  if (service) {
    filteredMetrics = filteredMetrics.filter(m => m.service === service);
  }
  
  // Filter by metric name
  if (metric) {
    filteredMetrics = filteredMetrics.filter(m => m.metric === metric);
  }
  
  // Filter by time range
  if (from) {
    filteredMetrics = filteredMetrics.filter(m => new Date(m.timestamp) >= new Date(from));
  }
  if (to) {
    filteredMetrics = filteredMetrics.filter(m => new Date(m.timestamp) <= new Date(to));
  }
  
  // Sort by timestamp (newest first) and limit
  filteredMetrics = filteredMetrics
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, parseInt(limit));
  
  // Calculate summary statistics
  const summary = {};
  filteredMetrics.forEach(m => {
    const key = `${m.service}.${m.metric}`;
    if (!summary[key]) {
      summary[key] = { count: 0, total: 0, avg: 0, min: Infinity, max: -Infinity };
    }
    summary[key].count++;
    summary[key].total += m.value;
    summary[key].min = Math.min(summary[key].min, m.value);
    summary[key].max = Math.max(summary[key].max, m.value);
    summary[key].avg = summary[key].total / summary[key].count;
  });
  
  res.json({
    metrics: filteredMetrics,
    count: filteredMetrics.length,
    summary,
    totalRecorded: metrics.length,
    filters: { service, metric, from, to }
  });
});

/**
 * POST /metrics
 * Submit a direct metric (bonus endpoint)
 */
app.post('/metrics', (req, res) => {
  console.log('[ANALYTICS-SERVICE] POST /metrics - Recording metric');
  
  const { service, metric, value, tags } = req.body;
  
  if (!service || !metric || value === undefined) {
    return res.status(400).json({
      error: 'Invalid metric',
      required: ['service', 'metric', 'value']
    });
  }
  
  const metricEntry = recordMetric(service, metric, value, tags);
  
  res.status(201).json({
    metric: metricEntry,
    message: 'Metric recorded successfully'
  });
});

/**
 * GET /reports
 * Generate and retrieve reports
 */
app.get('/reports', (req, res) => {
  console.log('[ANALYTICS-SERVICE] GET /reports - Generating report');
  
  const { type = 'daily', service } = req.query;
  
  const validTypes = ['daily', 'weekly', 'monthly'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({
      error: 'Invalid report type',
      validTypes
    });
  }
  
  // Generate report data
  const now = new Date();
  let startDate;
  
  switch (type) {
    case 'daily':
      startDate = new Date(now - 24 * 60 * 60 * 1000);
      break;
    case 'weekly':
      startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'monthly':
      startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
      break;
  }
  
  // Filter metrics for the time period
  let periodMetrics = metrics.filter(m => new Date(m.timestamp) >= startDate);
  
  if (service) {
    periodMetrics = periodMetrics.filter(m => m.service === service);
  }
  
  // Aggregate data by service and metric
  const aggregation = {};
  periodMetrics.forEach(m => {
    const key = `${m.service}.${m.metric}`;
    if (!aggregation[key]) {
      aggregation[key] = {
        service: m.service,
        metric: m.metric,
        count: 0,
        total: 0,
        values: []
      };
    }
    aggregation[key].count++;
    aggregation[key].total += m.value;
    aggregation[key].values.push(m.value);
  });
  
  // Calculate statistics
  const reportData = Object.values(aggregation).map(item => ({
    ...item,
    average: item.total / item.count,
    min: Math.min(...item.values),
    max: Math.max(...item.values),
    values: undefined // Don't return raw values
  }));
  
  // Store report
  const reportId = generateReportId();
  const report = {
    id: reportId,
    type,
    service: service || 'all',
    generatedAt: now.toISOString(),
    periodStart: startDate.toISOString(),
    periodEnd: now.toISOString(),
    totalEvents: periodMetrics.length,
    data: reportData
  };
  
  reports.set(reportId, report);
  
  res.json(report);
});

/**
 * GET /reports/:id
 * Get a specific report by ID
 */
app.get('/reports/:id', (req, res) => {
  const { id } = req.params;
  console.log(`[ANALYTICS-SERVICE] GET /reports/${id}`);
  
  const report = reports.get(id);
  
  if (!report) {
    return res.status(404).json({
      error: 'Report not found',
      reportId: id
    });
  }
  
  res.json(report);
});

/**
 * GET /events
 * List all recorded events (bonus endpoint)
 */
app.get('/events', (req, res) => {
  console.log('[ANALYTICS-SERVICE] GET /events - Listing events');
  
  const { type, from, to, limit = 50 } = req.query;
  
  let filteredEvents = [...events];
  
  if (type) {
    filteredEvents = filteredEvents.filter(e => e.eventType === type);
  }
  
  if (from) {
    filteredEvents = filteredEvents.filter(e => new Date(e.timestamp) >= new Date(from));
  }
  if (to) {
    filteredEvents = filteredEvents.filter(e => new Date(e.timestamp) <= new Date(to));
  }
  
  // Sort by timestamp (newest first) and limit
  filteredEvents = filteredEvents
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, parseInt(limit));
  
  res.json({
    events: filteredEvents,
    count: filteredEvents.length,
    totalRecorded: events.length,
    eventTypes: [...new Set(events.map(e => e.eventType))]
  });
});

// ============================================================================
// ARCHITECTURAL VIOLATION: Direct Service Boundary Violation
// ============================================================================
// 
// This endpoint directly accesses order data structures that should be
// internal to order-service. Instead of calling the order-service API,
// it accesses the data directly from the event store, which may contain
// stale or incomplete data.
// 
// PROPER APPROACH: Should call GET /orders on order-service
// ============================================================================

/**
 * GET /orders/summary
 * UNDOCUMENTED ENDPOINT: Get order summary from analytics perspective
 * This violates service boundaries by reconstructing order data
 */
app.get('/orders/summary', (req, res) => {
  console.log('[ANALYTICS-SERVICE] ⚠️ ARCHITECTURAL VIOLATION: Accessing order data directly');
  console.log('[ANALYTICS-SERVICE] This endpoint violates service boundaries!');
  
  // Reconstruct order data from events (VIOLATION)
  const orderEvents = events.filter(e => 
    e.eventType === EventTypes.ORDER_CREATED || 
    e.eventType === EventTypes.ORDER_UPDATED
  );
  
  // This is using event data to reconstruct order state
  // which should be the responsibility of order-service
  const orderSummary = orderEvents.map(e => ({
    orderId: e.payload.orderId,
    userId: e.payload.userId,
    totalAmount: e.payload.totalAmount,
    status: e.payload.status,
    lastEvent: e.eventType,
    timestamp: e.timestamp
  }));
  
  res.json({
    warning: 'This endpoint violates service boundaries by accessing order data directly',
    source: 'Event reconstruction (may be incomplete/stale)',
    orderSummary,
    count: orderSummary.length
  });
});

// ============================================================================
// INTENTIONAL ARCHITECTURAL VIOLATION
// Added for dependency graph analysis
// Direct REST calls to order-service and payment-service
// ============================================================================

/**
 * GET /external/orders
 * Fetches order data directly from order-service
 * INTENTIONAL VIOLATION: Cross-service REST call
 */
app.get('/external/orders', async (req, res) => {
  console.log('[ANALYTICS-SERVICE] INTENTIONAL VIOLATION: Calling order-service directly');
  
  try {
    // INTENTIONAL ARCHITECTURAL VIOLATION
    // Added for dependency graph analysis
    const orderResponse = await axios.get(`http://order-service:3003/orders`, { timeout: 5000 });
    
    res.json({
      source: 'order-service',
      data: orderResponse.data,
      warning: 'Direct REST call to order-service'
    });
  } catch (err) {
    console.error('[ANALYTICS-SERVICE] Failed to fetch orders:', err.message);
    res.status(503).json({ error: 'order-service unavailable' });
  }
});

/**
 * GET /external/payments
 * Fetches payment data directly from payment-service
 * INTENTIONAL VIOLATION: Cross-service REST call
 */
app.get('/external/payments', async (req, res) => {
  console.log('[ANALYTICS-SERVICE] INTENTIONAL VIOLATION: Calling payment-service directly');
  
  try {
    // INTENTIONAL ARCHITECTURAL VIOLATION
    // Added for dependency graph analysis
    const paymentResponse = await axios.get(`http://payment-service:3004/payments`, { timeout: 5000 });
    
    res.json({
      source: 'payment-service',
      data: paymentResponse.data,
      warning: 'Direct REST call to payment-service'
    });
  } catch (err) {
    console.error('[ANALYTICS-SERVICE] Failed to fetch payments:', err.message);
    res.status(503).json({ error: 'payment-service unavailable' });
  }
});

// ============================================================================
// INTENTIONAL ARCHITECTURAL VIOLATION - DB ACCESS ENDPOINTS
// Added for dependency graph analysis
// These endpoints directly access other services' internal data stores
// ============================================================================

/**
 * GET /violation/db/orders
 * INTENTIONAL VIOLATION: Direct DB access to order-service data
 */
app.get('/violation/db/orders', (req, res) => {
  console.log('[ANALYTICS-SERVICE] ⚠️ DB ACCESS VIOLATION: Accessing order-service internal data store');
  
  // INTENTIONAL ARCHITECTURAL VIOLATION
  // Added for dependency graph analysis
  // Directly accessing order-service's internal data
  const orders = orderDataStore.orders || new Map();
  const orderList = Array.from(orders.values());
  
  res.json({
    violation: 'Direct DB access to order-service',
    source: 'order-service/src/index.js',
    orders: orderList,
    count: orderList.length,
    warning: 'This is an intentional architectural violation for dependency graph analysis'
  });
});

/**
 * GET /violation/db/payments
 * INTENTIONAL VIOLATION: Direct DB access to payment-service data
 */
app.get('/violation/db/payments', (req, res) => {
  console.log('[ANALYTICS-SERVICE] ⚠️ DB ACCESS VIOLATION: Accessing payment-service internal data store');
  
  // INTENTIONAL ARCHITECTURAL VIOLATION
  // Added for dependency graph analysis
  // Directly accessing payment-service's internal data
  const payments = paymentDataStore.payments || new Map();
  const paymentList = Array.from(payments.values());
  
  res.json({
    violation: 'Direct DB access to payment-service',
    source: 'payment-service/src/index.js',
    payments: paymentList,
    count: paymentList.length,
    warning: 'This is an intentional architectural violation for dependency graph analysis'
  });
});

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/health', (req, res) => {
  const eventTypes = [...new Set(events.map(e => e.eventType))];
  
  res.json({
    service: 'analytics-service',
    status: 'healthy',
    stats: {
      totalEvents: events.length,
      totalMetrics: metrics.length,
      totalReports: reports.size,
      eventTypes: eventTypes.length
    },
    recordedEventTypes: eventTypes,
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.use((err, req, res, next) => {
  console.error('[ANALYTICS-SERVICE] Error:', err);
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
  ANALYTICS-SERVICE
  Listening on port ${PORT}
========================================
  Endpoints:
    POST /events          - Receive events from services
    GET  /metrics         - Get metrics with filters
    POST /metrics         - Submit direct metric
    GET  /reports         - Generate reports
    GET  /reports/:id     - Get specific report
    GET  /events          - List recorded events
    GET  /health          - Health check
    
  ⚠️ VIOLATION:
    GET  /orders/summary  - Directly accesses order data
========================================
  Event Types Tracked:
    ✓ OrderCreated
    ✓ PaymentProcessed
    ✓ UserCreated
    ✓ OrderUpdated
========================================
  `);
});

module.exports = app;
