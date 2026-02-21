# Internal Architecture & Dependency Documentation
# notification-service
# KaChow-Organisation

## Service Overview

### Purpose of the Service
The notification-service handles event-driven notifications and direct notification requests across the KaChow microservices ecosystem. It consumes events from order and payment services and sends notifications to users.

### Business Responsibility
- Consume order and payment events
- Send email, SMS, and push notifications
- Query user and order data for notification context
- Track notification delivery status

### Domain Boundaries
**Owned by this service:**
- Notification records and status
- Notification templates (basic)
- Notification delivery tracking

**NOT owned by this service:**
- User contact data (queried from user-service)
- Order details (queried from order-service)
- Payment details (received via events)

## Role in the Overall System

### Architectural Position
The notification-service is an event-driven consumer service that reacts to order and payment events. It bridges the event-driven and request-response patterns by making REST calls to enrich event data.

### Service Interactions
| Direction | Service | Purpose |
|-----------|---------|---------|
| Consumes from | order-service | OrderCreated events |
| Consumes from | payment-service | PaymentProcessed events |
| Calls | user-service | Get user contact info |
| Calls | order-service | Get order details |
| Called by | api-gateway | Direct notifications |

### Upstream and Downstream Services
- **Upstream:** order-service (events), payment-service (events), api-gateway
- **Downstream:** user-service, order-service

## API Surface

### Endpoint: POST /events

**Visibility:** Internal (event webhook)

**Request Body:**
```
{
  "eventType": string (required),
  "timestamp": string (ISO 8601) (required),
  "payload": object (required)
}
```

**Supported Event Types:**
- OrderCreated
- PaymentProcessed

**Response 200:**
```
{
  "received": true,
  "eventType": string,
  "timestamp": string (ISO 8601)
}
```

---

### Endpoint: POST /notify

**Visibility:** Public

**Request Body:**
```
{
  "userId": string (required),
  "type": string (required),
  "subject": string (required),
  "message": string (required)
}
```

**Response 201:**
```
{
  "id": string,
  "userId": string,
  "type": string,
  "status": "sent",
  "sentAt": string (ISO 8601)
}
```

---

### Endpoint: GET /notifications

**Visibility:** Public

**Response 200:**
```
{
  "notifications": [
    {
      "id": string,
      "userId": string,
      "type": string,
      "subject": string,
      "status": string,
      "sentAt": string (ISO 8601)
    }
  ],
  "count": number
}
```

---

### Endpoint: GET /notifications/:id

**Visibility:** Public

**Path Parameters:**
- id: string (required)

**Response 200:**
```
{
  "id": string,
  "userId": string,
  "type": string,
  "subject": string,
  "message": string,
  "status": string,
  "sentAt": string (ISO 8601)
}
```

**Error Responses:**
- 404: Notification not found

---

### Endpoint: GET /health

**Visibility:** Internal/Operational

**Response 200:**
```
{
  "service": "notification-service",
  "status": "healthy",
  "notificationCount": number,
  "timestamp": string (ISO 8601)
}
```

## Dependencies

### REST Dependencies
| Target Service | Endpoint | Purpose | Criticality |
|----------------|----------|---------|-------------|
| user-service | GET /users/:id | Get user contact info | MEDIUM |
| order-service | GET /orders/:id | Get order details | MEDIUM |

### Event Dependencies
**Produces:** None

**Consumes:**
| Event Type | Source | Purpose |
|------------|--------|---------|
| OrderCreated | order-service | Send order confirmation |
| PaymentProcessed | payment-service | Send payment receipt |

### Shared Contracts
| Contract | Source | Purpose |
|----------|--------|---------|
| NotificationRequestSchema | shared-contracts | Request validation |
| ServicePorts | shared-contracts | Port configuration |
| ServiceUrls | shared-contracts | Service URLs |
| EventTypes | shared-contracts | Event type constants |

## Data Ownership & Models

### Internal Data Structures

**notifications (Array)**
- Storage: In-memory array
- Fields: id, userId, type, subject, message, status, sentAt
- Lifecycle: Created on event or POST, never persisted

### Service-Boundary Violations
**None:** This service queries other services for data rather than accessing directly.

## Cross-Service Flows

### Order Created Notification Flow
1. order-service emits OrderCreated event
2. notification-service receives event via POST /events
3. notification-service extracts userId and orderId from payload
4. Calls user-service GET /users/:id to get email
5. Calls order-service GET /orders/:id to get order details
6. Composes notification with order and user data
7. Sends mock notification
8. Stores notification record

### Direct Notification Flow
1. Client calls POST /notify
2. notification-service validates request
3. Calls user-service to verify user exists
4. Sends mock notification
5. Stores notification record
6. Returns confirmation

## Architectural Risks & Violations

### Risk: In-Memory Data Loss
**Severity:** HIGH

**Description:** Notification records stored in-memory only. Service restart loses all history.

**Blast Radius:** Complete notification history loss on deployment.

**Mitigation:** Implement persistent storage.

---

### Risk: Mock Notification Sending
**Severity:** CRITICAL

**Description:** Notifications are simulated (logged to console). No actual email/SMS/push delivery.

**Blast Radius:** Users never receive notifications in production.

**Mitigation:** Integrate with SendGrid, Twilio, or Firebase.

---

### Risk: Synchronous Internal Calls
**Severity:** MEDIUM

**Description:** Event processing blocks on user-service and order-service calls.

**Blast Radius:** Slow event processing if dependencies slow.

**Mitigation:** Implement async processing with queue.

---

### Risk: No Retry for Failed Notifications
**Severity:** HIGH

**Description:** Failed notifications are not retried.

**Blast Radius:** Notification loss on transient failures.

**Mitigation:** Implement retry with exponential backoff.

---

### Risk: Circular Dependency Risk
**Severity:** MEDIUM

**Description:** notification-service calls order-service. If order-service later calls notification-service, circular dependency forms.

**Blast Radius:** Circular dependency prevents independent deployment.

**Mitigation:** Ensure order-service never calls notification-service directly.

## Versioning & Change Impact

### API Versioning Strategy
None. No versioning implemented.

### Dependency Fragility
- **user-service dependency:** Notification enrichment fails if user-service down
- **order-service dependency:** Order notification enrichment fails if order-service down
- **shared-contracts schema changes:** Breaking changes require updates

### High-Risk Changes
- Notification schema changes break consumers
- Event payload structure changes break enrichment

## Operational Considerations

### Failure Modes
| Failure | Impact | Mitigation |
|---------|--------|------------|
| Service unavailable | Notifications not sent | Queue-based event processing |
| user-service down | Enrichment fails, notifications delayed | Circuit breaker |
| order-service down | Order enrichment fails | Circuit breaker |
| Data loss | Notification history lost | Persistent storage |

### Retry Expectations
None. No retry mechanism.

### Timeout Sensitivity
- user-service calls: 5000ms
- order-service calls: 5000ms

### Observability Gaps
- No metrics on notification delivery rate
- No tracking of notification failures
- No alerting on queue depth

## Recommended Improvements

### Notification Integration
1. Integrate with SendGrid for email
2. Integrate with Twilio for SMS
3. Integrate with Firebase for push notifications
4. Add notification template management

### Architecture
1. Implement message queue for event processing
2. Add async notification sending
3. Implement retry with exponential backoff
4. Add dead letter queue for failed notifications

### Data Persistence
1. Replace in-memory store with database
2. Add notification history retention
3. Implement delivery tracking
4. Add analytics on notification engagement

### Operational
1. Add metrics: notification rate, delivery rate, failure rate
2. Implement alerting on notification failures
3. Add distributed tracing
4. Create operational runbook
