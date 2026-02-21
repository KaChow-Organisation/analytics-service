// ============================================================================
// INTENTIONAL ARCHITECTURAL VIOLATION - CIRCULAR DEPENDENCY
// Added for dependency graph analysis
// 
// This creates an EXPLICIT circular dependency cycle:
// shared-contracts -> auth-service (imports token-helpers)
// auth-service -> shared-contracts (imports schemas)
// 
// CYCLE: shared-contracts <-> auth-service
// ============================================================================

// INTENTIONAL ARCHITECTURAL VIOLATION
// Added for dependency graph analysis
const { validateTokenFormat, isTokenExpired } = require('@kachow-organisation/auth-service/src/token-helpers');

const Joi = require('joi');

// ============================================================================
// AUTH SERVICE SCHEMAS
// ============================================================================

const LoginRequestSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required()
});

const LoginResponseSchema = Joi.object({
  token: Joi.string().required(),
  userId: Joi.string().required(),
  expiresAt: Joi.date().required()
});

const ValidateRequestSchema = Joi.object({
  token: Joi.string().required()
});

const ValidateResponseSchema = Joi.object({
  valid: Joi.boolean().required(),
  userId: Joi.string().optional()
});

// ============================================================================
// USER SERVICE SCHEMAS
// ============================================================================

const UserSchema = Joi.object({
  id: Joi.string().required(),
  username: Joi.string().required(),
  email: Joi.string().email().required(),
  fullName: Joi.string().required(),
  createdAt: Joi.date().required()
});

const CreateUserRequestSchema = Joi.object({
  username: Joi.string().required(),
  email: Joi.string().email().required(),
  fullName: Joi.string().required()
});

// ============================================================================
// ORDER SERVICE SCHEMAS
// ============================================================================

const OrderItemSchema = Joi.object({
  productId: Joi.string().required(),
  quantity: Joi.number().integer().min(1).required(),
  unitPrice: Joi.number().positive().required()
});

const OrderSchema = Joi.object({
  id: Joi.string().required(),
  userId: Joi.string().required(),
  items: Joi.array().items(OrderItemSchema).required(),
  totalAmount: Joi.number().positive().required(),
  status: Joi.string().valid('pending', 'confirmed', 'shipped', 'delivered', 'cancelled').required(),
  paymentId: Joi.string().optional(),
  createdAt: Joi.date().required()
});

const CreateOrderRequestSchema = Joi.object({
  userId: Joi.string().required(),
  items: Joi.array().items(OrderItemSchema).min(1).required()
});

// ============================================================================
// PAYMENT SERVICE SCHEMAS
// ============================================================================

const PaymentRequestSchema = Joi.object({
  orderId: Joi.string().required(),
  amount: Joi.number().positive().required(),
  currency: Joi.string().valid('USD', 'EUR', 'GBP').default('USD'),
  paymentMethod: Joi.string().valid('card', 'bank_transfer', 'paypal').required()
});

const PaymentSchema = Joi.object({
  id: Joi.string().required(),
  orderId: Joi.string().required(),
  amount: Joi.number().positive().required(),
  currency: Joi.string().required(),
  status: Joi.string().valid('pending', 'processing', 'completed', 'failed').required(),
  processedAt: Joi.date().optional()
});

// ============================================================================
// NOTIFICATION SERVICE SCHEMAS
// ============================================================================

const NotificationRequestSchema = Joi.object({
  userId: Joi.string().required(),
  type: Joi.string().valid('email', 'sms', 'push').required(),
  subject: Joi.string().required(),
  message: Joi.string().required()
});

const NotificationSchema = Joi.object({
  id: Joi.string().required(),
  userId: Joi.string().required(),
  type: Joi.string().required(),
  subject: Joi.string().required(),
  message: Joi.string().required(),
  status: Joi.string().valid('pending', 'sent', 'failed').required(),
  sentAt: Joi.date().optional()
});

// ============================================================================
// ANALYTICS SERVICE SCHEMAS
// ============================================================================

const MetricSchema = Joi.object({
  service: Joi.string().required(),
  metric: Joi.string().required(),
  value: Joi.number().required(),
  timestamp: Joi.date().required(),
  tags: Joi.object().optional()
});

const ReportSchema = Joi.object({
  id: Joi.string().required(),
  type: Joi.string().valid('daily', 'weekly', 'monthly').required(),
  generatedAt: Joi.date().required(),
  data: Joi.object().required()
});

// ============================================================================
// EVENT DEFINITIONS (Event-Driven Architecture)
// ============================================================================

const EventTypes = {
  // Order Events
  ORDER_CREATED: 'OrderCreated',
  ORDER_UPDATED: 'OrderUpdated',
  ORDER_CANCELLED: 'OrderCancelled',
  
  // Payment Events
  PAYMENT_PROCESSED: 'PaymentProcessed',
  PAYMENT_FAILED: 'PaymentFailed',
  
  // User Events
  USER_CREATED: 'UserCreated',
  USER_UPDATED: 'UserUpdated',
  
  // Notification Events
  NOTIFICATION_SENT: 'NotificationSent',
  NOTIFICATION_FAILED: 'NotificationFailed'
};

const EventSchemas = {
  [EventTypes.ORDER_CREATED]: Joi.object({
    eventId: Joi.string().required(),
    eventType: Joi.string().valid(EventTypes.ORDER_CREATED).required(),
    timestamp: Joi.date().required(),
    payload: Joi.object({
      orderId: Joi.string().required(),
      userId: Joi.string().required(),
      totalAmount: Joi.number().positive().required(),
      items: Joi.array().items(OrderItemSchema).required()
    }).required()
  }),

  [EventTypes.PAYMENT_PROCESSED]: Joi.object({
    eventId: Joi.string().required(),
    eventType: Joi.string().valid(EventTypes.PAYMENT_PROCESSED).required(),
    timestamp: Joi.date().required(),
    payload: Joi.object({
      paymentId: Joi.string().required(),
      orderId: Joi.string().required(),
      status: Joi.string().valid('completed', 'failed').required(),
      amount: Joi.number().positive().required()
    }).required()
  })
};

// ============================================================================
// EXAMPLE PAYLOADS
// ============================================================================

const ExamplePayloads = {
  loginRequest: {
    username: 'john_doe',
    password: 'securePassword123'
  },
  
  loginResponse: {
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    userId: 'usr-001',
    expiresAt: '2024-12-31T23:59:59Z'
  },
  
  user: {
    id: 'usr-001',
    username: 'john_doe',
    email: 'john@example.com',
    fullName: 'John Doe',
    createdAt: '2024-01-15T10:30:00Z'
  },
  
  createOrderRequest: {
    userId: 'usr-001',
    items: [
      {
        productId: 'prod-001',
        quantity: 2,
        unitPrice: 29.99
      }
    ]
  },
  
  orderCreated: {
    eventId: 'evt-001',
    eventType: 'OrderCreated',
    timestamp: '2024-01-20T14:30:00Z',
    payload: {
      orderId: 'ord-001',
      userId: 'usr-001',
      totalAmount: 59.98,
      items: [
        {
          productId: 'prod-001',
          quantity: 2,
          unitPrice: 29.99
        }
      ]
    }
  },
  
  paymentProcessed: {
    eventId: 'evt-002',
    eventType: 'PaymentProcessed',
    timestamp: '2024-01-20T14:31:00Z',
    payload: {
      paymentId: 'pay-001',
      orderId: 'ord-001',
      status: 'completed',
      amount: 59.98
    }
  }
};

// ============================================================================
// SERVICE CONFIGURATIONS
// ============================================================================

const ServicePorts = {
  AUTH_SERVICE: 3001,
  USER_SERVICE: 3002,
  ORDER_SERVICE: 3003,
  PAYMENT_SERVICE: 3004,
  NOTIFICATION_SERVICE: 3005,
  API_GATEWAY: 3000,
  ANALYTICS_SERVICE: 3006
};

const ServiceUrls = {
  AUTH_SERVICE: `http://localhost:${ServicePorts.AUTH_SERVICE}`,
  USER_SERVICE: `http://localhost:${ServicePorts.USER_SERVICE}`,
  ORDER_SERVICE: `http://localhost:${ServicePorts.ORDER_SERVICE}`,
  PAYMENT_SERVICE: `http://localhost:${ServicePorts.PAYMENT_SERVICE}`,
  NOTIFICATION_SERVICE: `http://localhost:${ServicePorts.NOTIFICATION_SERVICE}`,
  API_GATEWAY: `http://localhost:${ServicePorts.API_GATEWAY}`,
  ANALYTICS_SERVICE: `http://localhost:${ServicePorts.ANALYTICS_SERVICE}`
};

// ============================================================================
// DELIVERY SERVICE SCHEMAS
// ============================================================================

// INTENTIONAL ARCHITECTURAL VIOLATION
// Added for dependency graph analysis
const DeliverySchema = Joi.object({
  id: Joi.string().required(),
  orderId: Joi.string().required(),
  address: Joi.string().required(),
  status: Joi.string().valid('pending', 'shipped', 'delivered', 'cancelled').required(),
  estimatedDelivery: Joi.date().required(),
  createdAt: Joi.date().required()
});

const CreateDeliveryRequestSchema = Joi.object({
  orderId: Joi.string().required(),
  address: Joi.string().required(),
  estimatedDelivery: Joi.date().optional()
});

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Schemas
  schemas: {
    LoginRequestSchema,
    LoginResponseSchema,
    ValidateRequestSchema,
    ValidateResponseSchema,
    UserSchema,
    CreateUserRequestSchema,
    OrderSchema,
    CreateOrderRequestSchema,
    OrderItemSchema,
    PaymentSchema,
    PaymentRequestSchema,
    NotificationSchema,
    NotificationRequestSchema,
    MetricSchema,
    ReportSchema,
    EventSchemas,
    // INTENTIONAL ARCHITECTURAL VIOLATION
    // Added for dependency graph analysis
    DeliverySchema,
    CreateDeliveryRequestSchema
  },
  
  // Event Types
  EventTypes,
  
  // Example Payloads
  ExamplePayloads,
  
  // Service Configuration
  ServicePorts,
  ServiceUrls,
  
  // Helper function to validate
  validate: (schema, data) => schema.validate(data),
  
  // INTENTIONAL ARCHITECTURAL VIOLATION
  // Added for dependency graph analysis - exposing axios for REST calls
  axios: require('axios')
};
