# Internal Architecture & Dependency Documentation
# api-gateway
# KaChow-Organisation

## Service Overview

### Purpose of the Service
The api-gateway serves as the unified entry point for all client requests to the KaChow microservices ecosystem. It handles request routing and provides a single endpoint for external consumers.

### Business Responsibility
- Route incoming requests to appropriate backend services
- Provide a single public-facing API endpoint
- Handle cross-cutting concerns (logging, error handling)
- Aggregate service health information
- Shield internal service structure from external clients

### Domain Boundaries
**Owned by this service:**
- Request routing logic and path mapping
- Request/response transformation (minimal)
- Client-facing API structure

**NOT owned by this service:**
- Business logic (delegated to domain services)
- Data persistence
- Authentication/authorization decisions (delegated to auth-service)
- Service discovery

## Role in the Overall System

### Architectural Position
The api-gateway sits at the edge of the architecture as the single entry point. All external traffic flows through this service before reaching domain services. It is a stateless routing layer.

### Service Interactions
| Direction | Service | Purpose |
|-----------|---------|---------|
| Routes to | auth-service | Authentication routing |
| Routes to | user-service | User management routing |
| Routes to | order-service | Order management routing |
| Routes to | payment-service | Payment routing |
| Routes to | notification-service | Notification routing |
| Routes to | analytics-service | Analytics routing |
| Called by | External clients | All API operations |

### Upstream and Downstream Services
- **Upstream:** External clients, web applications, mobile apps
- **Downstream:** All domain services (auth, user, order, payment, notification, analytics)

## API Surface

### Route: /auth/*

**Target:** auth-service (port 3001)
**Timeout:** 10000ms

**Methods:** All HTTP methods forwarded

**Path Mapping:**
- POST /auth/login -> auth-service POST /login
- POST /auth/validate -> auth-service POST /validate
- GET /auth/health -> auth-service GET /health

---

### Route: /users/*

**Target:** user-service (port 3002)
**Timeout:** 10000ms

**Methods:** All HTTP methods forwarded

**Path Mapping:**
- GET /users -> user-service GET /users
- GET /users/:id -> user-service GET /users/:id
- POST /users -> user-service POST /users
- GET /users/health -> user-service GET /health

---

### Route: /orders/*

**Target:** order-service (port 3003)
**Timeout:** 15000ms

**Methods:** All HTTP methods forwarded

**Path Mapping:**
- POST /orders -> order-service POST /orders
- GET /orders -> order-service GET /orders
- GET /orders/:id -> order-service GET /orders/:id
- PUT /orders/:id/status -> order-service PUT /orders/:id/status
- GET /orders/health -> order-service GET /health

---

### Route: /payments/*

**Target:** payment-service (port 3004)
**Timeout:** 15000ms

**Methods:** All HTTP methods forwarded

**Path Mapping:**
- POST /payments -> payment-service POST /payments
- GET /payments -> payment-service GET /payments
- GET /payments/:id -> payment-service GET /payments/:id
- POST /payments/:id/refund -> payment-service POST /payments/:id/refund
- GET /payments/health -> payment-service GET /health

---

### Route: /notifications/*

**Target:** notification-service (port 3005)
**Timeout:** 10000ms

**Methods:** All HTTP methods forwarded

**Path Mapping:**
- POST /notifications/events -> notification-service POST /events
- POST /notifications/notify -> notification-service POST /notify
- GET /notifications -> notification-service GET /notifications
- GET /notifications/:id -> notification-service GET /notifications/:id
- GET /notifications/health -> notification-service GET /health

---

### Route: /analytics/*

**Target:** analytics-service (port 3006)
**Timeout:** 10000ms

**Methods:** All HTTP methods forwarded

**Path Mapping:**
- POST /analytics/events -> analytics-service POST /events
- GET /analytics/metrics -> analytics-service GET /metrics
- POST /analytics/metrics -> analytics-service POST /metrics
- GET /analytics/reports -> analytics-service GET /reports
- GET /analytics/reports/:id -> analytics-service GET /reports/:id
- GET /analytics/events -> analytics-service GET /events
- GET /analytics/health -> analytics-service GET /health

---

### Endpoint: POST /internal/service-status (UNDOCUMENTED)

**Visibility:** Internal/Undocumented

**Purpose:** Check health status of all backend services

**Response 200:**
```
{
  "gateway": "api-gateway",
  "timestamp": string (ISO 8601),
  "services": [
    {
      "name": string,
      "url": string,
      "status": "up" | "down",
      "responseTime": string | null,
      "error": string | null
    }
  ],
  "warning": "This is an undocumented internal endpoint"
}
```

---

### Endpoint: GET /health

**Visibility:** Internal/Operational

**Response 200:**
```
{
  "service": "api-gateway",
  "status": "healthy",
  "timestamp": string (ISO 8601),
  "routes": ["list of routes"]
}
```

---

### Endpoint: GET /

**Visibility:** Public

**Response 200:**
```
{
  "name": "KaChow API Gateway",
  "version": "1.0.0",
  "description": "Unified entry point for KaChow microservices",
  "services": {service map}
}
```

---

### Error Responses

| Status | Condition | Response |
|--------|-----------|----------|
| 404 | Path not matching any route | {"error": "Not found", "message": "Path not found"} |
| 503 | Downstream service unavailable | {"error": "{Service} unavailable", "message": error} |
| 500 | Gateway error | {"error": "Gateway error", "message": error} |

## Dependencies

### REST Dependencies
| Target Service | Endpoint | Purpose | Criticality |
|----------------|----------|---------|-------------|
| auth-service | All endpoints | Authentication routing | CRITICAL |
| user-service | All endpoints | User management routing | CRITICAL |
| order-service | All endpoints | Order management routing | CRITICAL |
| payment-service | All endpoints | Payment routing | CRITICAL |
| notification-service | All endpoints | Notification routing | CRITICAL |
| analytics-service | All endpoints | Analytics routing | CRITICAL |

### Event Dependencies
**Produces:** None

**Consumes:** None

### Shared Contracts
| Contract | Source | Purpose |
|----------|--------|---------|
| ServicePorts | shared-contracts | Port configuration |
| ServiceUrls | shared-contracts | Target service URLs (violation) |

## Data Ownership & Models

### Internal Data Structures
None. The api-gateway is stateless.

### Service-Boundary Violations
None for data access.

## Cross-Service Flows

### Request Routing Flow
1. Client sends request to api-gateway (port 3000)
2. Gateway logs request (method, path, timestamp)
3. Gateway matches path prefix to service route table
4. Gateway constructs target URL from ServiceUrls + path
5. Gateway forwards request with timeout
6. Gateway receives response from target service
7. Gateway returns response to client

### Error Handling Flow
1. Downstream service returns error response
2. Gateway forwards error status and body to client
3. Downstream service is unreachable
4. Gateway returns 503 with error message
5. Path does not match any route
6. Gateway returns 404 with available routes list

### Service Health Check Flow
1. Internal request to POST /internal/service-status
2. Gateway queries /health endpoint on each service
3. Gateway aggregates results into status report
4. Response returned with service statuses

## Architectural Risks & Violations

### VIOLATION: Hardcoded Service URLs
**Severity:** CRITICAL

**Description:** Gateway directly imports hardcoded service URLs from shared-contracts. This prevents dynamic scaling and service discovery.

**Blast Radius:** Deployment inflexibility, difficulty scaling services independently.

**Proper Approach:** Use service discovery (Consul, Eureka, Kubernetes DNS).

---

### VIOLATION: Undocumented Endpoint
**Severity:** MEDIUM

**Description:** POST /internal/service-status is explicitly undocumented but accessible externally.

**Blast Radius:** Security risk if endpoint reveals sensitive information.

**Proper Approach:** Document all endpoints or implement authentication.

---

### Risk: No Authentication at Gateway
**Severity:** CRITICAL

**Description:** Gateway does not perform authentication or authorization checks.

**Blast Radius:** Unauthorized access to any endpoint if backend services lack auth.

**Mitigation:** Implement JWT validation middleware.

---

### Risk: No Rate Limiting
**Severity:** HIGH

**Description:** No rate limiting implemented. Clients can make unlimited requests.

**Blast Radius:** Backend service overload, denial of service.

**Mitigation:** Implement rate limiting per client/IP.

---

### Risk: No Caching
**Severity:** MEDIUM

**Description:** No caching layer exists. Identical requests repeatedly hit backend services.

**Blast Radius:** Unnecessary backend load, increased latency.

**Mitigation:** Implement response caching for GET endpoints.

## Versioning & Change Impact

### API Versioning Strategy
None. No API versioning at gateway level.

### Dependency Fragility
- **All backend services:** Hard dependency on service availability
- **shared-contracts:** Tight coupling to ServiceUrls configuration
- **Port configuration:** Hardcoded in shared-contracts

### High-Risk Changes
- Service URL changes require shared-contracts update and redeployment
- New service addition requires gateway route addition
- Route path changes break client integrations

## Operational Considerations

### Failure Modes
| Failure | Impact | Mitigation |
|---------|--------|------------|
| Gateway unavailable | Complete API outage | Load balancer with multiple instances |
| Backend service unavailable | Specific routes return 503 | Circuit breaker |
| Timeout exceeded | Client receives 503 | Adjust timeout configuration |

### Retry Expectations
None. Gateway does not retry failed requests.

### Timeout Sensitivity
- Standard routes: 10000ms
- Order/Payment routes: 15000ms
- Health checks (internal): 3000ms

### Observability Gaps
- No metrics on request rate per route
- No tracking of backend response times
- No monitoring of error rate by service
- No distributed tracing correlation

## Recommended Improvements

### Service Discovery
1. Replace hardcoded URLs with service discovery
2. Use environment-based configuration
3. Implement health check-based routing
4. Add load balancing across instances

### Security
1. Implement JWT validation middleware
2. Add rate limiting per client/IP
3. Implement API key authentication
4. Add request/response logging

### Performance
1. Add response caching for appropriate endpoints
2. Implement request coalescing
3. Add compression for responses
4. Implement connection pooling

### Resilience
1. Add circuit breaker for each backend service
2. Implement retry with exponential backoff
3. Add bulkhead pattern
4. Implement graceful degradation

### Operational
1. Add distributed tracing
2. Implement structured logging
3. Add metrics (request rate, latency, error rate)
4. Create operational dashboard
