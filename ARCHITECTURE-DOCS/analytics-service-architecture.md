# Internal Architecture & Dependency Documentation
# analytics-service
# KaChow-Organisation

## Service Overview

### Purpose of the Service
The analytics-service collects, aggregates, and reports on system-wide events and metrics for the KaChow microservices ecosystem. It serves as the central observability and business intelligence layer.

### Business Responsibility
- Receive events from all domain services via webhooks
- Store and aggregate metrics from events
- Generate time-based reports (daily, weekly, monthly)
- Provide query capabilities for metrics and events

### Domain Boundaries
**Owned by this service:**
- Event records (received from other services)
- Aggregated metrics (computed from events)
- Generated reports (time-based aggregations)
- Analytics-specific queries and views

**NOT owned by this service:**
- Order data (maintains event-derived copies only)
- User data (references from events only)
- Payment data (references from events only)

## Role in the Overall System

### Architectural Position
The analytics-service is an event-driven consumer service that sits downstream from all domain services. It is a read-only consumer in the ecosystem.

### Service Interactions
| Direction | Service | Purpose |
|-----------|---------|---------|
| Receives from | order-service | OrderCreated, OrderUpdated events |
| Receives from | payment-service | PaymentProcessed events |
| Receives from | user-service | UserCreated events |
| Called by | api-gateway | Metrics queries, report generation |

### Upstream and Downstream Services
- **Upstream:** order-service, payment-service, user-service (event sources), api-gateway
- **Downstream:** None (no outbound calls)

## API Surface

### Endpoint: POST /events

**Visibility:** Internal (event webhook)

**Request Body:**
```
{
  "eventType": string (required),
  "timestamp": string (ISO 8601) (required),
  "payload": object (required),
  "eventId": string (optional)
}
```

**Supported Event Types:**
- OrderCreated
- OrderUpdated
- PaymentProcessed
- UserCreated

**Response 200:**
```
{
  "received": true,
  "eventType": string,
  "timestamp": string (ISO 8601)
}
```

---

### Endpoint: GET /metrics

**Visibility:** Public

**Query Parameters:**
- service: Filter by service name (optional)
- metric: Filter by metric name (optional)
- from: Start timestamp (ISO 8601) (optional)
- to: End timestamp (ISO 8601) (optional)
- limit: Maximum results (default: 100) (optional)

**Response 200:**
```
{
  "metrics": [...],
  "count": number,
  "summary": {aggregations},
  "totalRecorded": number,
  "filters": {applied filters}
}
```

---

### Endpoint: POST /metrics

**Visibility:** Public

**Request Body:**
```
{
  "service": string (required),
  "metric": string (required),
  "value": number (required),
  "tags": object (optional)
}
```

**Response 201:**
```
{
  "metric": {metric object},
  "message": "Metric recorded successfully"
}
```

**Error Responses:**
- 400: Invalid metric (missing required fields)

---

### Endpoint: GET /reports

**Visibility:** Public

**Query Parameters:**
- type: "daily" | "weekly" | "monthly" (default: "daily")
- service: Filter by service name (optional)

**Response 200:**
```
{
  "id": string,
  "type": string,
  "service": string | "all",
  "generatedAt": string (ISO 8601),
  "periodStart": string (ISO 8601),
  "periodEnd": string (ISO 8601),
  "totalEvents": number,
  "data": [...]
}
```

---

### Endpoint: GET /reports/:id

**Visibility:** Public

**Path Parameters:**
- id: string (required)

**Response 200:** Same as GET /reports

**Error Responses:**
- 404: Report not found

---

### Endpoint: GET /events

**Visibility:** Public

**Query Parameters:**
- type: Filter by event type (optional)
- from: Start timestamp (ISO 8601) (optional)
- to: End timestamp (ISO 8601) (optional)
- limit: Maximum results (default: 50) (optional)

**Response 200:**
```
{
  "events": [...],
  "count": number,
  "totalRecorded": number,
  "eventTypes": string[]
}
```

---

### Endpoint: GET /orders/summary (VIOLATION)

**Visibility:** Public

**Purpose:** Reconstruct order summary from event data

**Response 200:**
```
{
  "warning": "This endpoint violates service boundaries",
  "source": "Event reconstruction (may be incomplete/stale)",
  "orderSummary": [...],
  "count": number
}
```

---

### Endpoint: GET /health

**Visibility:** Internal/Operational

**Response 200:**
```
{
  "service": "analytics-service",
  "status": "healthy",
  "stats": {
    "totalEvents": number,
    "totalMetrics": number,
    "totalReports": number,
    "eventTypes": number
  },
  "recordedEventTypes": string[],
  "timestamp": string (ISO 8601)
}
```

## Dependencies

### REST Dependencies
| Target Service | Endpoint | Purpose | Criticality |
|----------------|----------|---------|-------------|
| None | - | No outbound REST calls | - |

### Event Dependencies
**Produces:** None

**Consumes:**
| Event Type | Source | Metric Generated |
|------------|--------|------------------|
| ORDER_CREATED | order-service | order-service.orders_created |
| ORDER_UPDATED | order-service | (no metric) |
| PAYMENT_PROCESSED | payment-service | payment-service.payments_successful/failed |
| USER_CREATED | user-service | user-service.users_created |

### Shared Contracts
| Contract | Source | Purpose |
|----------|--------|---------|
| ServicePorts | shared-contracts | Port configuration |
| EventTypes | shared-contracts | Event type constants |
| MetricSchema | shared-contracts | Metric data structure |
| ReportSchema | shared-contracts | Report data structure |

## Data Ownership & Models

### Internal Data Structures

**events (Array)**
- Storage: In-memory array
- Fields: eventType, timestamp, payload, receivedAt, eventId
- Lifecycle: Appended when events received, never deleted

**metrics (Array)**
- Storage: In-memory array
- Fields: id, service, metric, value, timestamp, tags
- Lifecycle: Created during event processing, never deleted

**reports (Map)**
- Storage: In-memory Map
- Fields: id, type, service, generatedAt, periodStart, periodEnd, totalEvents, data
- Lifecycle: Created on GET /reports, stored for retrieval

### Service-Boundary Violations

**VIOLATION: GET /orders/summary endpoint**

**Severity:** HIGH

**Description:** This endpoint reconstructs order data from events instead of calling order-service API. Data may be incomplete, stale, or inconsistent.

**Proper Approach:** Call GET /orders on order-service for order data.

## Cross-Service Flows

### Event Ingestion Flow
1. Domain service emits event
2. Domain service calls POST /analytics/events
3. analytics-service receives event
4. analytics-service validates event structure
5. analytics-service stores event in events array
6. analytics-service processes event to generate metrics
7. analytics-service returns acknowledgment to caller

### Metric Query Flow
1. Client calls GET /analytics/metrics via API Gateway
2. analytics-service applies query filters
3. analytics-service sorts by timestamp (newest first)
4. analytics-service limits results
5. analytics-service computes summary statistics
6. Response returned with filtered metrics and summary

### Report Generation Flow
1. Client calls GET /analytics/reports?type=daily
2. analytics-service determines time period
3. analytics-service filters metrics for time period
4. analytics-service aggregates by service and metric
5. analytics-service computes statistics
6. analytics-service stores report in reports Map
7. Response returned with report data

## Architectural Risks & Violations

### VIOLATION: Direct Order Data Access
**Severity:** HIGH

**Description:** GET /orders/summary reconstructs order data from events, violating service boundaries.

**Blast Radius:** Stale or incomplete order data returned, data inconsistency.

**Proper Approach:** Remove this endpoint or proxy to order-service.

---

### Risk: In-Memory Data Loss
**Severity:** HIGH

**Description:** All analytics data is in-memory only. Service restart loses all historical events and metrics.

**Blast Radius:** Complete loss of analytics history.

**Mitigation:** Migrate to time-series database (InfluxDB, TimescaleDB).

---

### Risk: Unbounded Memory Growth
**Severity:** CRITICAL

**Description:** Events and metrics are never deleted. Continuous operation will exhaust available memory.

**Blast Radius:** Service crash, analytics data loss.

**Mitigation:** Implement data retention policy, persistent storage.

---

### Risk: Best-Effort Event Processing
**Severity:** MEDIUM

**Description:** Events are processed synchronously but errors during metric generation do not fail the request.

**Blast Radius:** Missing metrics for some events.

---

### Risk: No Event Ordering Guarantees
**Severity:** MEDIUM

**Description:** Events may arrive out of order. Order status reconstruction from events may produce incorrect state.

**Blast Radius:** Inaccurate analytics.

**Proper Approach:** Use event streaming platform (Kafka) with ordering guarantees.

## Versioning & Change Impact

### API Versioning Strategy
None. No API versioning implemented.

### Dependency Fragility
- Event schema changes require analytics-service metric generation updates
- New event types require new metric generation logic

### High-Risk Changes
- Metric schema changes break report generation
- Event type name changes break metric generation
- Event payload structure changes break metric extraction

## Operational Considerations

### Failure Modes
| Failure | Impact | Mitigation |
|---------|--------|------------|
| Service unavailable | Analytics data loss during downtime | Event persistence at source |
| Memory exhaustion | Service crash, all data lost | Data retention policy, persistent storage |
| Event processing error | Single event not converted to metrics | Error logging |
| Report generation failure | No report created | Retry mechanism |

### Retry Expectations
None. No retry mechanism for any operations.

### Timeout Sensitivity
- Report generation: Depends on data volume
- Metric queries: O(n) where n = metrics array size

### Event Loss Risks
MEDIUM. Events are received via HTTP. If analytics-service is down, events are lost unless source services implement retry.

### Observability Gaps
- No metrics on event ingestion rate
- No tracking of metric generation success rate
- No monitoring of memory usage trends
- No alerting on data loss

## Recommended Improvements

### Data Persistence
1. Replace in-memory storage with time-series database (InfluxDB)
2. Add data warehouse for long-term analytics (BigQuery)
3. Implement data retention and archiving policies
4. Add backup and disaster recovery procedures

### Event Infrastructure
1. Replace HTTP event receiving with message queue (Kafka, RabbitMQ)
2. Implement event sourcing pattern
3. Add event schema validation with schema registry
4. Implement dead letter queue for failed events

### Architecture Compliance
1. Remove GET /orders/summary endpoint
2. Create order-service client for proper data access
3. Document all data dependencies

### Operational
1. Add metrics on event ingestion rate
2. Implement alerting for data loss
3. Add distributed tracing for event flows
4. Create analytics dashboard for operations
