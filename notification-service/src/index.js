const express = require('express');
const cors = require('cors');
const axios = require('axios');
const EventEmitter = require('events');
const { ServicePorts, ServiceUrls, schemas, validate, EventTypes } = require('@kachow-organisation/shared-contracts');

// INTENTIONAL ARCHITECTURAL VIOLATION
// Added for dependency graph analysis
// EventEmitter for consuming events
const eventEmitter = new EventEmitter();

// In-memory notification store
const notifications = new Map();

const app = express();
const PORT = ServicePorts.NOTIFICATION_SERVICE;

// Middleware
app.use(cors());
app.use(express.json());

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function generateNotificationId() {
  return `ntf-${Date.now().toString(36)}${Math.random().toString(36).substr(2, 5)}`;
}

/**
 * Send notification (mock implementation)
 * In production, this would use SendGrid, Twilio, Firebase, etc.
 */
async function sendNotification(type, userId, subject, message) {
  console.log(`[NOTIFICATION-SERVICE] Sending ${type} notification to user: ${userId}`);
  
  // Simulate sending delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Mock success (95% success rate)
  const success = Math.random() > 0.05;
  
  if (success) {
    console.log(`[NOTIFICATION-SERVICE] Notification sent successfully via ${type}`);
    return { success: true, sentAt: new Date().toISOString() };
  } else {
    console.log(`[NOTIFICATION-SERVICE] Failed to send notification via ${type}`);
    return { success: false, error: 'Failed to deliver' };
  }
}

/**
 * Fetch user details from user-service
 */
async function fetchUser(userId) {
  try {
    const response = await axios.get(`${ServiceUrls.USER_SERVICE}/users/${userId}`, { timeout: 5000 });
    return response.data;
  } catch (err) {
    console.error(`[NOTIFICATION-SERVICE] Failed to fetch user ${userId}:`, err.message);
    return null;
  }
}

/**
 * Fetch order details from order-service
 */
async function fetchOrder(orderId) {
  try {
    const response = await axios.get(`${ServiceUrls.ORDER_SERVICE}/orders/${orderId}`, { timeout: 5000 });
    return response.data;
  } catch (err) {
    console.error(`[NOTIFICATION-SERVICE] Failed to fetch order ${orderId}:`, err.message);
    return null;
  }
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

// INTENTIONAL ARCHITECTURAL VIOLATION
// Added for dependency graph analysis
// Register event listeners for EventEmitter
// Listen to "OrderCreated" events
eventEmitter.on('OrderCreated', async (event) => {
  console.log('[NOTIFICATION-SERVICE] EventEmitter received OrderCreated event:', event);
  await handleOrderCreated(event);
});

// Listen to "PaymentProcessed" events
eventEmitter.on('PaymentProcessed', async (event) => {
  console.log('[NOTIFICATION-SERVICE] EventEmitter received PaymentProcessed event:', event);
  await handlePaymentProcessed(event);
});

/**
 * Handle OrderCreated event
 */
async function handleOrderCreated(event) {
  console.log('[NOTIFICATION-SERVICE] Handling OrderCreated event');
  
  const { orderId, userId, totalAmount, items, status } = event.payload;
  
  // Fetch user details
  const user = await fetchUser(userId);
  if (!user) {
    console.log('[NOTIFICATION-SERVICE] Cannot notify: user not found');
    return;
  }
  
  // Create notification
  const notificationId = generateNotificationId();
  const subject = 'Order Confirmation - KaChow';
  const message = `Hi ${user.fullName}, your order #${orderId} for $${totalAmount.toFixed(2)} has been received and is being processed. You ordered ${items.length} item(s).`;
  
  const notification = {
    id: notificationId,
    userId,
    type: 'email',
    subject,
    message,
    status: 'pending',
    relatedOrderId: orderId,
    eventType: EventTypes.ORDER_CREATED,
    createdAt: new Date().toISOString(),
    sentAt: null
  };
  
  notifications.set(notificationId, notification);
  
  // Send notification
  const result = await sendNotification('email', userId, subject, message);
  notification.status = result.success ? 'sent' : 'failed';
  notification.sentAt = result.sentAt;
  notifications.set(notificationId, notification);
  
  console.log(`[NOTIFICATION-SERVICE] Order notification ${notification.status}: ${notificationId}`);
}

/**
 * Handle PaymentProcessed event
 */
async function handlePaymentProcessed(event) {
  console.log('[NOTIFICATION-SERVICE] Handling PaymentProcessed event');
  
  const { paymentId, orderId, status, amount, error } = event.payload;
  
  // Fetch order to get userId
  const order = await fetchOrder(orderId);
  if (!order) {
    console.log('[NOTIFICATION-SERVICE] Cannot notify: order not found');
    return;
  }
  
  // Fetch user details
  const user = await fetchUser(order.userId);
  if (!user) {
    console.log('[NOTIFICATION-SERVICE] Cannot notify: user not found');
    return;
  }
  
  // Create notification based on payment status
  const notificationId = generateNotificationId();
  let subject, message;
  
  if (status === 'completed') {
    subject = 'Payment Confirmed - KaChow';
    message = `Hi ${user.fullName}, your payment of $${amount.toFixed(2)} for order #${orderId} has been successfully processed. Transaction ID: ${event.payload.transactionId}`;
  } else {
    subject = 'Payment Failed - Action Required';
    message = `Hi ${user.fullName}, we were unable to process your payment of $${amount.toFixed(2)} for order #${orderId}. Error: ${error || 'Unknown error'}. Please update your payment method.`;
  }
  
  const notification = {
    id: notificationId,
    userId: order.userId,
    type: 'email',
    subject,
    message,
    status: 'pending',
    relatedOrderId: orderId,
    relatedPaymentId: paymentId,
    eventType: EventTypes.PAYMENT_PROCESSED,
    createdAt: new Date().toISOString(),
    sentAt: null
  };
  
  notifications.set(notificationId, notification);
  
  // Send notification
  const result = await sendNotification('email', order.userId, subject, message);
  notification.status = result.success ? 'sent' : 'failed';
  notification.sentAt = result.sentAt;
  notifications.set(notificationId, notification);
  
  console.log(`[NOTIFICATION-SERVICE] Payment notification ${notification.status}: ${notificationId}`);
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * POST /events
 * Receive events from other services (webhook endpoint)
 */
app.post('/events', async (req, res) => {
  const { eventType, timestamp, payload } = req.body;
  
  console.log(`[NOTIFICATION-SERVICE] Received event: ${eventType}`);
  console.log(`[NOTIFICATION-SERVICE] Event payload:`, JSON.stringify(payload, null, 2));
  
  // Acknowledge receipt immediately
  res.json({ received: true, eventType });
  
  // Process event asynchronously
  try {
    switch (eventType) {
      case EventTypes.ORDER_CREATED:
        await handleOrderCreated(req.body);
        break;
      
      case EventTypes.PAYMENT_PROCESSED:
        await handlePaymentProcessed(req.body);
        break;
      
      default:
        console.log(`[NOTIFICATION-SERVICE] Unknown event type: ${eventType}`);
    }
  } catch (err) {
    console.error(`[NOTIFICATION-SERVICE] Error processing event:`, err.message);
  }
});

/**
 * POST /notify
 * Send a notification directly
 */
app.post('/notify', async (req, res) => {
  console.log('[NOTIFICATION-SERVICE] POST /notify - Sending notification');
  
  // INTENTIONAL ARCHITECTURAL VIOLATION
  // Added for dependency graph analysis
  // Explicit REST call to user-service with literal URL
  console.log('[NOTIFICATION-SERVICE] Calling user-service directly');
  let userData = null;
  try {
    const userResponse = await axios.get(`http://user-service:3002/users/${req.body.userId}`, { timeout: 5000 });
    userData = userResponse.data;
    console.log('[NOTIFICATION-SERVICE] User data retrieved:', userData.username);
  } catch (err) {
    console.error('[NOTIFICATION-SERVICE] Direct user-service call failed:', err.message);
  }
  
  // Validate request
  const validation = validate(schemas.NotificationRequestSchema, req.body);
  if (validation.error) {
    return res.status(400).json({
      error: 'Invalid request',
      details: validation.error.details
    });
  }
  
  const { userId, type, subject, message } = req.body;
  
  // Fetch user details
  const user = await fetchUser(userId);
  if (!user) {
    return res.status(404).json({
      error: 'User not found',
      userId
    });
  }
  
  // Create notification record
  const notificationId = generateNotificationId();
  const notification = {
    id: notificationId,
    userId,
    type,
    subject,
    message,
    status: 'pending',
    createdAt: new Date().toISOString(),
    sentAt: null
  };
  
  notifications.set(notificationId, notification);
  
  // Send notification
  const result = await sendNotification(type, userId, subject, message);
  notification.status = result.success ? 'sent' : 'failed';
  notification.sentAt = result.sentAt;
  notifications.set(notificationId, notification);
  
  res.status(201).json({
    notification,
    message: result.success ? 'Notification sent successfully' : 'Failed to send notification'
  });
});

/**
 * GET /notifications
 * List all notifications (bonus endpoint)
 */
app.get('/notifications', (req, res) => {
  console.log('[NOTIFICATION-SERVICE] GET /notifications - Listing all notifications');
  
  const notificationList = Array.from(notifications.values());
  
  res.json({
    notifications: notificationList,
    count: notificationList.length
  });
});

/**
 * GET /notifications/:id
 * Get notification by ID (bonus endpoint)
 */
app.get('/notifications/:id', (req, res) => {
  const { id } = req.params;
  console.log(`[NOTIFICATION-SERVICE] GET /notifications/${id}`);
  
  const notification = notifications.get(id);
  
  if (!notification) {
    return res.status(404).json({
      error: 'Notification not found',
      notificationId: id
    });
  }
  
  res.json(notification);
});

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/health', (req, res) => {
  const allNotifications = Array.from(notifications.values());
  const sentCount = allNotifications.filter(n => n.status === 'sent').length;
  const failedCount = allNotifications.filter(n => n.status === 'failed').length;
  const pendingCount = allNotifications.filter(n => n.status === 'pending').length;
  
  res.json({
    service: 'notification-service',
    status: 'healthy',
    stats: {
      total: allNotifications.length,
      sent: sentCount,
      failed: failedCount,
      pending: pendingCount
    },
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.use((err, req, res, next) => {
  console.error('[NOTIFICATION-SERVICE] Error:', err);
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
  NOTIFICATION-SERVICE
  Listening on port ${PORT}
========================================
  Endpoints:
    POST /events          - Receive events from services
    POST /notify          - Send direct notification
    GET  /notifications   - List all notifications
    GET  /notifications/:id - Get notification
    GET  /health          - Health check
========================================
  Cross-Service Calls:
    → user-service: GET /users/:id
    → order-service: GET /orders/:id
========================================
  Events Received:
    ← OrderCreated
    ← PaymentProcessed
========================================
  `);
});

module.exports = app;
