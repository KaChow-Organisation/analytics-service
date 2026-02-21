const express = require('express');
const cors = require('cors');
const axios = require('axios');
const EventEmitter = require('events');
const { ServicePorts, ServiceUrls, schemas, validate, EventTypes } = require('@kachow-organisation/shared-contracts');

// INTENTIONAL ARCHITECTURAL VIOLATION
// Added for dependency graph analysis
// EventEmitter for publishing events
const eventEmitter = new EventEmitter();

// In-memory payment store (simulating a database)
const payments = new Map();

// Pre-seed some payments for demo
payments.set('pay-001', {
  id: 'pay-001',
  orderId: 'ord-001',
  amount: 109.97,
  currency: 'USD',
  status: 'completed',
  paymentMethod: 'card',
  processedAt: '2024-01-20T10:05:00Z',
  transactionId: 'txn_1234567890'
});

const app = express();
const PORT = ServicePorts.PAYMENT_SERVICE;

// Middleware
app.use(cors());
app.use(express.json());

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function generatePaymentId() {
  return `pay-${Date.now().toString(36)}${Math.random().toString(36).substr(2, 5)}`;
}

function generateEventId() {
  return `evt-${Date.now().toString(36)}${Math.random().toString(36).substr(2, 5)}`;
}

function generateTransactionId() {
  return `txn_${Math.random().toString(36).substr(2, 15)}${Date.now().toString(36).substr(2, 5)}`;
}

/**
 * Simulate payment processing with mock logic
 * In production, this would integrate with Stripe, PayPal, etc.
 */
async function processPayment(paymentDetails) {
  const { amount, paymentMethod } = paymentDetails;
  
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Mock success rate: 90% successful
  const success = Math.random() > 0.1;
  
  if (success) {
    return {
      status: 'completed',
      transactionId: generateTransactionId(),
      message: 'Payment processed successfully'
    };
  } else {
    return {
      status: 'failed',
      error: 'Payment declined by processor',
      message: 'Your payment method was declined. Please try again.'
    };
  }
}

/**
 * Emit event to event bus
 */
async function emitEvent(eventType, payload) {
  const event = {
    eventId: generateEventId(),
    eventType,
    timestamp: new Date().toISOString(),
    payload
  };
  
  console.log(`[PAYMENT-SERVICE] Emitting event: ${eventType}`);
  console.log(`[PAYMENT-SERVICE] Event payload:`, JSON.stringify(event, null, 2));
  
  // INTENTIONAL ARCHITECTURAL VIOLATION
  // Added for dependency graph analysis
  // Emit via EventEmitter for local listeners
  eventEmitter.emit(eventType, event);
  console.log(`[PAYMENT-SERVICE] Event emitted via EventEmitter: ${eventType}`);
  
  // Send to notification-service
  try {
    await axios.post(`${ServiceUrls.NOTIFICATION_SERVICE}/events`, event, { timeout: 5000 });
    console.log(`[PAYMENT-SERVICE] Event sent to notification-service`);
  } catch (err) {
    console.log(`[PAYMENT-SERVICE] Failed to notify notification-service:`, err.message);
  }
  
  // Send to analytics-service
  try {
    await axios.post(`${ServiceUrls.ANALYTICS_SERVICE}/events`, event, { timeout: 5000 });
    console.log(`[PAYMENT-SERVICE] Event sent to analytics-service`);
  } catch (err) {
    console.log(`[PAYMENT-SERVICE] Failed to notify analytics-service:`, err.message);
  }
  
  return event;
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * POST /payments
 * Create and process a new payment
 */
app.post('/payments', async (req, res) => {
  console.log('[PAYMENT-SERVICE] POST /payments - Creating payment');
  console.log('[PAYMENT-SERVICE] Request body:', JSON.stringify(req.body, null, 2));
  
  // Validate request
  const validation = validate(schemas.PaymentRequestSchema, req.body);
  if (validation.error) {
    return res.status(400).json({
      error: 'Invalid request',
      details: validation.error.details
    });
  }
  
  const { orderId, amount, currency, paymentMethod } = req.body;
  
  try {
    // Step 1: Create payment record (status: pending)
    const paymentId = generatePaymentId();
    const payment = {
      id: paymentId,
      orderId,
      amount,
      currency: currency || 'USD',
      status: 'pending',
      paymentMethod,
      createdAt: new Date().toISOString(),
      processedAt: null,
      transactionId: null
    };
    
    payments.set(paymentId, payment);
    console.log(`[PAYMENT-SERVICE] Payment record created: ${paymentId}`);
    
    // INTENTIONAL ARCHITECTURAL VIOLATION
    // Added for dependency graph analysis
    // Step 1.5: Validate with auth-service before processing
    console.log(`[PAYMENT-SERVICE] Validating payment authorization`);
    try {
      const authResponse = await axios.post(`http://auth-service:3001/validate`, {
        token: req.headers.authorization || 'mock-token'
      }, { timeout: 5000 });
      console.log(`[PAYMENT-SERVICE] Auth validation:`, authResponse.data.valid);
    } catch (err) {
      console.error(`[PAYMENT-SERVICE] Auth validation warning:`, err.message);
    }
    
    // Step 2: Process payment (async simulation)
    console.log(`[PAYMENT-SERVICE] Processing payment...`);
    const processResult = await processPayment({ amount, paymentMethod });
    
    // Step 3: Update payment record with result
    payment.status = processResult.status;
    payment.processedAt = new Date().toISOString();
    
    if (processResult.status === 'completed') {
      payment.transactionId = processResult.transactionId;
    } else {
      payment.error = processResult.error;
    }
    
    payments.set(paymentId, payment);
    console.log(`[PAYMENT-SERVICE] Payment processed: ${processResult.status}`);
    
    // Step 4: Emit PaymentProcessed event
    await emitEvent(EventTypes.PAYMENT_PROCESSED, {
      paymentId,
      orderId,
      status: payment.status,
      amount,
      currency: payment.currency,
      transactionId: payment.transactionId,
      processedAt: payment.processedAt,
      error: payment.error || null
    });
    
    // Step 5: Return response
    const response = {
      id: paymentId,
      orderId,
      amount,
      currency: payment.currency,
      status: payment.status,
      paymentMethod,
      transactionId: payment.transactionId,
      processedAt: payment.processedAt
    };
    
    if (payment.status === 'failed') {
      response.error = payment.error;
      return res.status(402).json(response); // Payment Required
    }
    
    console.log(`[PAYMENT-SERVICE] Payment completed successfully: ${paymentId}`);
    res.status(201).json(response);
    
  } catch (error) {
    console.error('[PAYMENT-SERVICE] Error processing payment:', error);
    res.status(500).json({
      error: 'Failed to process payment',
      message: error.message
    });
  }
});

/**
 * GET /payments/:id
 * Get payment details by ID
 */
app.get('/payments/:id', (req, res) => {
  const { id } = req.params;
  console.log(`[PAYMENT-SERVICE] GET /payments/${id} - Fetching payment`);
  
  const payment = payments.get(id);
  
  if (!payment) {
    return res.status(404).json({
      error: 'Payment not found',
      paymentId: id
    });
  }
  
  res.json(payment);
});

/**
 * GET /payments
 * List all payments (bonus endpoint)
 */
app.get('/payments', (req, res) => {
  console.log('[PAYMENT-SERVICE] GET /payments - Listing all payments');
  
  const paymentList = Array.from(payments.values());
  
  res.json({
    payments: paymentList,
    count: paymentList.length
  });
});

/**
 * POST /payments/:id/refund
 * Refund a payment (bonus endpoint)
 */
app.post('/payments/:id/refund', async (req, res) => {
  const { id } = req.params;
  console.log(`[PAYMENT-SERVICE] POST /payments/${id}/refund - Processing refund`);
  
  const payment = payments.get(id);
  
  if (!payment) {
    return res.status(404).json({
      error: 'Payment not found',
      paymentId: id
    });
  }
  
  if (payment.status !== 'completed') {
    return res.status(400).json({
      error: 'Cannot refund',
      message: `Payment status is ${payment.status}, only completed payments can be refunded`
    });
  }
  
  // Simulate refund processing
  await new Promise(resolve => setTimeout(resolve, 500));
  
  payment.status = 'refunded';
  payment.refundedAt = new Date().toISOString();
  payment.refundTransactionId = generateTransactionId();
  payments.set(id, payment);
  
  // Emit refund event
  await emitEvent(EventTypes.PAYMENT_FAILED, {
    paymentId: id,
    orderId: payment.orderId,
    reason: 'refund',
    amount: payment.amount,
    refundedAt: payment.refundedAt,
    refundTransactionId: payment.refundTransactionId
  });
  
  res.json({
    payment,
    message: 'Payment refunded successfully'
  });
});

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/health', (req, res) => {
  // Calculate some metrics
  const allPayments = Array.from(payments.values());
  const completedCount = allPayments.filter(p => p.status === 'completed').length;
  const failedCount = allPayments.filter(p => p.status === 'failed').length;
  const pendingCount = allPayments.filter(p => p.status === 'pending').length;
  
  res.json({
    service: 'payment-service',
    status: 'healthy',
    stats: {
      total: allPayments.length,
      completed: completedCount,
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
  console.error('[PAYMENT-SERVICE] Error:', err);
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
  PAYMENT-SERVICE
  Listening on port ${PORT}
========================================
  Endpoints:
    POST /payments           - Create payment
    GET  /payments/:id       - Get payment by ID
    GET  /payments           - List all payments
    POST /payments/:id/refund - Refund payment
    GET  /health             - Health check
========================================
  Events Emitted:
    → PaymentProcessed
    → PaymentFailed (for refunds)
========================================
  Pre-seeded Payments: ${payments.size}
========================================
  Note: Payment processing is simulated
  with 90% success rate for demo
========================================
  `);
});

module.exports = app;
