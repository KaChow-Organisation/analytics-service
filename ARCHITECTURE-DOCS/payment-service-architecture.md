# Internal Architecture & Dependency Documentation
# payment-service
# KaChow-Organisation

## Service Overview

### Purpose of the Service
The payment-service handles payment processing and payment lifecycle management within the KaChow microservices ecosystem. It processes payments, tracks payment status, and handles refunds.

### Business Responsibility
- Process payments for orders
- Track payment status and history
- Handle refund requests
- Emit payment lifecycle events
- Integrate with payment gateways (mock)

### Domain Boundaries
**Owned by this service:**
- Payment records and status
- Payment transaction history
- Refund records
- Payment method information

**NOT owned by this service:**
- Order data (owned by order-service)
- User financial data (PII)
- Actual payment gateway integration

## Role in the Overall System

### Architectural Position
The payment-service is a supporting domain service called by order-service during order processing. It operates independently and notifies other services of payment events.

### Service Interactions
| Direction | Service | Purpose |
|-----------|---------|---------|
| Called by | order-service | Process order payments |
| Called by | api-gateway | Refund operations |
| Produces to | notification-service | PaymentProcessed events |
| Produces to | analytics-service | PaymentProcessed, PaymentFailed events |

### Upstream and Downstream Services
- **Upstream:** order-service, api-gateway, notification-service (via events), analytics-service (via events)
- **Downstream:** None

## API Surface

### Endpoint: POST /payments

**Visibility:** Internal (called by order-service)

**Request Body:**
```
{
  "orderId": string (required),
  "amount": number (required),
  "currency": string (default: "USD"),
  "paymentMethod": string (required)
}
```

**Response 201:**
```
{
  "id": string,
  "orderId": string,
  "amount": number,
  "currency": string,
  "status": "completed" | "failed",
  "transactionId": string,
  "processedAt": string (ISO 8601)
}
```

**Error Responses:**
- 400: Validation error
- 500: Payment processing error

---

### Endpoint: GET /payments

**Visibility:** Public

**Response 200:**
```
{
  "payments": [
    {
      "id": string,
      "orderId": string,
      "amount": number,
      "currency": string,
      "status": string,
      "processedAt": string (ISO 8601)
    }
  ],
  "count": number
}
```

---

### Endpoint: GET /payments/:id

**Visibility:** Public

**Path Parameters:**
- id: string (required)

**Response 200:**
```
{
  "id": string,
  "orderId": string,
  "amount": number,
  "currency": string,
  "status": string,
  "transactionId": string,
  "processedAt": string (ISO 8601)
}
```

**Error Responses:**
- 404: Payment not found

---

### Endpoint: POST /payments/:id/refund

**Visibility:** Public

**Path Parameters:**
- id: string (required)

**Response 200:**
```
{
  "id": string,
  "originalPaymentId": string,
  "amount": number,
  "status": "refunded",
  "refundedAt": string (ISO 8601)
}
```

**Error Responses:**
- 404: Payment not found
- 400: Payment already refunded

---

### Endpoint: GET /health

**Visibility:** Internal/Operational

**Response 200:**
```
{
  "service": "payment-service",
  "status": "healthy",
  "paymentCount": number,
  "timestamp": string (ISO 8601)
}
```

## Dependencies

### REST Dependencies
| Target Service | Endpoint | Purpose | Criticality |
|----------------|----------|---------|-------------|
| None | - | No outbound REST calls | - |

### Event Dependencies
**Produces:**
| Event Type | Destination | Purpose |
|------------|-------------|---------|
| PaymentProcessed | notification-service POST /events | Payment notification |
| PaymentProcessed | analytics-service POST /events | Analytics tracking |
| PaymentFailed | analytics-service POST /events | Failure tracking |

**Consumes:** None

### Shared Contracts
| Contract | Source | Purpose |
|----------|--------|---------|
| PaymentRequestSchema | shared-contracts | Request validation |
| PaymentSchema | shared-contracts | Data structure |
| ServicePorts | shared-contracts | Port configuration |
| ServiceUrls | shared-contracts | Service URLs |
| EventTypes | shared-contracts | Event type constants |

## Data Ownership & Models

### Internal Data Structures

**payments (Array)**
- Storage: In-memory array
- Fields: id, orderId, amount, currency, status, transactionId, processedAt, refundedAt
- Lifecycle: Created on POST, updated on refund, never persisted

### Service-Boundary Violations
**None:** This service does not access other services' data.

## Cross-Service Flows

### Payment Processing Flow
1. order-service calls POST /payments with payment details
2. payment-service validates request against PaymentRequestSchema
3. payment-service simulates payment gateway call
4. Creates payment record with status (80% success rate)
5. Emits PaymentProcessed or PaymentFailed event
6. Returns payment record to order-service

### Refund Flow
1. Client calls POST /payments/:id/refund via API Gateway
2. payment-service finds payment by id
3. Validates payment is not already refunded
4. Updates payment status to "refunded"
5. Returns refund confirmation

## Architectural Risks & Violations

### Risk: In-Memory Data Loss
**Severity:** HIGH

**Description:** Payment data stored in-memory only. Service restart loses all payment records.

**Blast Radius:** Complete payment history loss on deployment.

**Mitigation:** Implement PostgreSQL with persistent storage.

---

### Risk: Mock Payment Processing
**Severity:** CRITICAL

**Description:** Payment processing is simulated with random success/failure. No actual payment gateway integration.

**Blast Radius:** Cannot process real payments in production.

**Mitigation:** Integrate with Stripe, PayPal, or other payment provider.

---

### Risk: No Idempotency
**Severity:** HIGH

**Description:** Duplicate payment requests create multiple payment records.

**Blast Radius:** Double-charging possible.

**Mitigation:** Add idempotency key support.

---

### Risk: Best-Effort Event Publishing
**Severity:** MEDIUM

**Description:** Events sent via HTTP without retry or confirmation.

**Blast Radius:** Event loss if downstream services unavailable.

**Mitigation:** Implement message queue with persistence.

---

### Risk: No PCI Compliance
**Severity:** CRITICAL

**Description:** Payment service handles payment data without PCI DSS compliance measures.

**Blast Radius:** Regulatory violation, data breach risk.

**Mitigation:** Use tokenized payment methods, integrate with compliant payment processor.

## Versioning & Change Impact

### API Versioning Strategy
None. No versioning implemented.

### Dependency Fragility
- **shared-contracts schema changes:** Breaking changes require updates

### High-Risk Changes
- Payment schema changes break downstream consumers
- Status enum changes break integrations
- Currency handling changes affect calculations

## Operational Considerations

### Failure Modes
| Failure | Impact | Mitigation |
|---------|--------|------------|
| Service unavailable | Cannot process payments | Load balancer with multiple instances |
| Data loss | All payment history lost | Persistent storage |
| Mock gateway failure | Payments fail | Implement real gateway integration |

### Retry Expectations
None. No retry mechanism.

### Timeout Sensitivity
- Payment processing: synchronous, no timeout handling

### Observability Gaps
- No metrics on payment success/failure rates
- No tracking of refund rates
- No alerting on payment processing latency
- No audit logging of payment operations

## Recommended Improvements

### Payment Integration
1. Integrate with Stripe or PayPal API
2. Implement webhook handling for async payment updates
3. Add support for multiple payment methods
4. Implement 3D Secure authentication

### Data Persistence
1. Replace in-memory store with PostgreSQL
2. Add database transaction support
3. Implement audit logging for all payment operations
4. Add backup and disaster recovery

### Security
1. Implement PCI DSS compliance measures
2. Add payment method tokenization
3. Implement fraud detection
4. Add PII data encryption

### Architecture
1. Add idempotency key support
2. Implement async payment processing
3. Add payment reconciliation
4. Implement chargeback handling
