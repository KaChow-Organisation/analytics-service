# Internal Architecture & Dependency Documentation
# order-service
# KaChow-Organisation

## Service Overview

### Purpose of the Service
The order-service manages order lifecycle and orchestrates order-related operations across the KaChow microservices ecosystem. It handles order creation, status management, and coordinates with payment and user services.

### Business Responsibility
- Create and manage customer orders
- Validate order data and user existence
- Coordinate payment processing
- Track order status throughout lifecycle
- Emit order lifecycle events

### Domain Boundaries
**Owned by this service:**
- Order records and status
- Order items and pricing
- Order lifecycle state machine
- Order creation timestamps

**NOT owned by this service:**
- User profile data (owned by user-service)
- Payment processing (owned by payment-service)
- Inventory management

## Role in the Overall System

### Architectural Position
The order-service is a core transactional service that orchestrates the order-to-payment flow. It acts as a coordinator between user-service (for user validation) and payment-service (for payment processing).

### Service Interactions
| Direction | Service | Purpose |
|-----------|---------|---------|
| Called by | api-gateway | Order operations |
| Calls | user-service | Validate user existence |
| Calls | payment-service | Process order payments |
| Produces to | notification-service | OrderCreated events |
| Produces to | analytics-service | OrderCreated, OrderUpdated events |

### Upstream and Downstream Services
- **Upstream:** api-gateway, notification-service (via events), analytics-service (via events)
- **Downstream:** user-service, payment-service

## API Surface

### Endpoint: POST /orders

**Visibility:** Public

**Request Body:**
```
{
  "userId": string (required),
  "items": [
    {
      "productId": string (required),
      "quantity": number (required),
      "unitPrice": number (required)
    }
  ]
}
```

**Response 201:**
```
{
  "id": string,
  "userId": string,
  "items": [...],
  "totalAmount": number,
  "status": "pending",
  "createdAt": string (ISO 8601)
}
```

**Error Responses:**
- 400: Validation error
- 404: User not found
- 500: Payment processing failed

---

### Endpoint: GET /orders

**Visibility:** Public

**Response 200:**
```
{
  "orders": [
    {
      "id": string,
      "userId": string,
      "items": [...],
      "totalAmount": number,
      "status": string,
      "createdAt": string (ISO 8601)
    }
  ],
  "count": number
}
```

---

### Endpoint: GET /orders/:id

**Visibility:** Public

**Path Parameters:**
- id: string (required)

**Response 200:**
```
{
  "id": string,
  "userId": string,
  "items": [...],
  "totalAmount": number,
  "status": string,
  "createdAt": string (ISO 8601)
}
```

**Error Responses:**
- 404: Order not found

---

### Endpoint: PUT /orders/:id/status

**Visibility:** Public

**Path Parameters:**
- id: string (required)

**Request Body:**
```
{
  "status": string (required)
}
```

**Response 200:**
```
{
  "id": string,
  "status": string,
  "updatedAt": string (ISO 8601)
}
```

---

### Endpoint: GET /health

**Visibility:** Internal/Operational

**Response 200:**
```
{
  "service": "order-service",
  "status": "healthy",
  "orderCount": number,
  "timestamp": string (ISO 8601)
}
```

## Dependencies

### REST Dependencies
| Target Service | Endpoint | Purpose | Criticality |
|----------------|----------|---------|-------------|
| user-service | GET /users/:id | User validation | CRITICAL |
| payment-service | POST /payments | Payment processing | CRITICAL |

### Event Dependencies
**Produces:**
| Event Type | Destination | Purpose |
|------------|-------------|---------|
| OrderCreated | notification-service POST /events | Order notification |
| OrderCreated | analytics-service POST /events | Analytics tracking |
| OrderUpdated | analytics-service POST /events | Status change tracking |

**Consumes:** None

### Shared Contracts
| Contract | Source | Purpose |
|----------|--------|---------|
| CreateOrderRequestSchema | shared-contracts | Request validation |
| OrderSchema | shared-contracts | Data structure |
| ServicePorts | shared-contracts | Port configuration |
| ServiceUrls | shared-contracts | Service URLs |
| EventTypes | shared-contracts | Event type constants |

## Data Ownership & Models

### Internal Data Structures

**orders (Array)**
- Storage: In-memory array
- Fields: id, userId, items, totalAmount, status, createdAt, updatedAt
- Lifecycle: Created on POST, updated on PUT, never persisted

### Service-Boundary Violations
**None:** This service calls other services for data rather than accessing directly.

## Cross-Service Flows

### Order Creation Flow
1. Client calls POST /orders with order data
2. order-service validates request against CreateOrderRequestSchema
3. order-service calls user-service GET /users/:id to validate user
4. If user valid, calculates total amount from items
5. Calls payment-service POST /payments to process payment
6. If payment successful, creates order record
7. Emits OrderCreated event to notification-service and analytics-service
8. Returns created order to client

### Order Status Update Flow
1. Client calls PUT /orders/:id/status
2. order-service finds order by id
3. Updates order status
4. Emits OrderUpdated event to analytics-service
5. Returns updated order

## Architectural Risks & Violations

### Risk: In-Memory Data Loss
**Severity:** HIGH

**Description:** Order data stored in-memory only. Service restart loses all order records.

**Blast Radius:** Complete order history loss on deployment.

**Mitigation:** Implement PostgreSQL with persistent storage.

---

### Risk: Synchronous Orchestration
**Severity:** HIGH

**Description:** Order creation blocks on user-service and payment-service calls.

**Blast Radius:** User-service or payment-service latency affects order creation. Cascading failures possible.

**Mitigation:** Implement async order processing with saga pattern.

---

### Risk: Best-Effort Event Publishing
**Severity:** MEDIUM

**Description:** Events are sent via HTTP POST without retry or confirmation.

**Blast Radius:** Event loss if notification-service or analytics-service is unavailable.

**Mitigation:** Implement event queue (RabbitMQ, Kafka) with persistence.

---

### Risk: No Compensation for Failed Payments
**Severity:** MEDIUM

**Description:** If payment fails after order creation, no cleanup occurs.

**Blast Radius:** Orphan orders with failed payments in system.

**Mitigation:** Implement saga compensation pattern.

---

### Risk: No Inventory Check
**Severity:** HIGH

**Description:** Orders can be created without verifying product availability.

**Blast Radius:** Overselling, order fulfillment failures.

**Mitigation:** Add inventory-service integration.

## Versioning & Change Impact

### API Versioning Strategy
None. No versioning implemented.

### Dependency Fragility
- **user-service dependency:** Order creation fails if user-service unavailable
- **payment-service dependency:** Order creation fails if payment-service unavailable
- **shared-contracts schema changes:** Breaking changes require updates

### High-Risk Changes
- Order schema changes break downstream consumers
- Status enum changes break integrations
- Endpoint path changes break api-gateway routing

## Operational Considerations

### Failure Modes
| Failure | Impact | Mitigation |
|---------|--------|------------|
| Service unavailable | Cannot create or retrieve orders | Load balancer with multiple instances |
| user-service down | Order creation fails | Circuit breaker with degraded mode |
| payment-service down | Orders cannot be paid | Async payment processing |
| Data loss | All order history lost | Persistent storage |

### Retry Expectations
None. No retry mechanism for external calls.

### Timeout Sensitivity
- user-service calls: 5000ms default
- payment-service calls: 10000ms default

### Observability Gaps
- No metrics on order creation rate
- No tracking of payment success/failure
- No alerting on order processing latency
- No distributed tracing across service calls

## Recommended Improvements

### Data Persistence
1. Replace in-memory store with PostgreSQL
2. Add database transaction support
3. Implement event sourcing for order history
4. Add backup and disaster recovery

### Architecture
1. Implement saga pattern for distributed transactions
2. Add async order processing with message queue
3. Add inventory-service integration
4. Implement order cancellation flow

### Resilience
1. Add circuit breakers for user-service and payment-service
2. Implement retry with exponential backoff
3. Add fallback for payment processing
4. Implement graceful degradation

### Operational
1. Add metrics: order rate, payment success rate, latency
2. Implement distributed tracing
3. Add alerting on order processing failures
4. Create operational runbook for order recovery
