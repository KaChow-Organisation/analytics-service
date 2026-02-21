# Internal Architecture & Dependency Documentation
# auth-service
# KaChow-Organisation

## Service Overview

### Purpose of the Service
The auth-service provides authentication and authorization capabilities for the KaChow microservices ecosystem. It issues authentication tokens and validates tokens for subsequent service interactions.

### Business Responsibility
- Authenticate users via username and password credentials
- Issue authentication tokens upon successful login
- Validate tokens presented by other services
- Maintain a registry of authenticated users

### Domain Boundaries
**Owned by this service:**
- Authentication tokens (JWT-like tokens in-memory)
- User credential records (username, hashed passwords)
- Token validation state

**NOT owned by this service:**
- User profile data (owned by user-service)
- Authorization roles and permissions
- Session management

## Role in the Overall System

### Architectural Position
The auth-service is a foundational security service that all other services depend on for identity verification. It sits in the critical path for protected operations.

### Service Interactions
| Direction | Service | Purpose |
|-----------|---------|---------|
| Called by | api-gateway | Token validation on protected routes |
| Called by | user-service | User creation authentication |
| Called by | order-service | Order creation authorization |
| Called by | notification-service | Notification sending authorization |

### Upstream and Downstream Services
- **Upstream:** api-gateway, user-service, order-service, notification-service
- **Downstream:** None (auth-service does not call other services)

## API Surface

### Endpoint: POST /login

**Visibility:** Public

**Request Body:**
```
{
  "username": string (required),
  "password": string (required)
}
```

**Response 200:**
```
{
  "token": string,
  "user": {
    "id": string,
    "username": string,
    "email": string
  },
  "expiresAt": string (ISO 8601)
}
```

**Error Responses:**
- 401: Invalid credentials
- 400: Validation error (missing fields)
- 500: Internal server error

---

### Endpoint: POST /validate

**Visibility:** Internal (service-to-service)

**Request Body:**
```
{
  "token": string (required)
}
```

**Response 200:**
```
{
  "valid": boolean,
  "user": {
    "id": string,
    "username": string,
    "email": string
  }
}
```

**Response 401:**
```
{
  "valid": false,
  "error": "Invalid or expired token"
}
```

---

### Endpoint: GET /health

**Visibility:** Internal/Operational

**Response 200:**
```
{
  "service": "auth-service",
  "status": "healthy",
  "timestamp": string (ISO 8601)
}
```

## Dependencies

### REST Dependencies
| Target Service | Endpoint | Purpose | Criticality |
|----------------|----------|---------|-------------|
| None | - | auth-service has no outbound REST calls | - |

### Event Dependencies
**Produces:** None

**Consumes:** None

### Shared Contracts
| Contract | Source | Purpose |
|----------|--------|---------|
| LoginRequestSchema | shared-contracts | Request validation |
| ValidateRequestSchema | shared-contracts | Request validation |
| ServicePorts | shared-contracts | Port configuration |

## Data Ownership & Models

### Internal Data Structures

**users (Array)**
- Storage: In-memory array
- Fields: id, username, password, email, createdAt
- Lifecycle: Pre-populated at startup, never persisted

**tokens (Map)**
- Storage: In-memory Map
- Fields: token -> { user, expiresAt }
- Lifecycle: Created on login, expires after 24 hours

### Service-Boundary Violations
**None:** This service does not access other services' data.

## Cross-Service Flows

### Authentication Flow
1. Client calls POST /login with credentials
2. auth-service validates username and password against users array
3. If valid, generates token and stores in tokens Map
4. Returns token to client

### Token Validation Flow
1. Calling service calls POST /validate with token
2. auth-service checks tokens Map for token existence
3. If found and not expired, returns user information
4. If not found or expired, returns invalid response

## Architectural Risks & Violations

### Risk: In-Memory Token Storage
**Severity:** HIGH

**Description:** Tokens are stored in-memory only. Service restart invalidates all active sessions.

**Blast Radius:** All users must re-authenticate after deployment.

**Mitigation:** Implement Redis or persistent token store.

---

### Risk: Plaintext Password Storage
**Severity:** CRITICAL

**Description:** Passwords stored in users array are plaintext (mock implementation).

**Blast Radius:** Complete credential exposure if memory is compromised.

**Mitigation:** Implement bcrypt hashing before storage.

---

### Risk: Mock JWT Implementation
**Severity:** MEDIUM

**Description:** Tokens are base64-encoded JSON, not cryptographically signed JWTs.

**Blast Radius:** Token forgery possible if token format is known.

**Mitigation:** Implement proper JWT with RS256 signing.

---

### Risk: No Token Refresh Mechanism
**Severity:** MEDIUM

**Description:** No refresh token flow. Users must re-login after 24 hours.

**Blast Radius:** Poor user experience, potential workflow interruption.

---

### Risk: No Rate Limiting
**Severity:** HIGH

**Description:** Login endpoint has no brute-force protection.

**Blast Radius:** Credential stuffing attacks possible.

**Mitigation:** Implement rate limiting per IP/username.

## Versioning & Change Impact

### API Versioning Strategy
None. No versioning implemented.

### Dependency Fragility
- **shared-contracts schema changes:** Breaking changes require all services to update
- **Token format changes:** All consuming services must update simultaneously

### High-Risk Changes
- Token format modification breaks all validation
- Authentication flow changes require coordinated updates
- Port changes require api-gateway reconfiguration

## Operational Considerations

### Failure Modes
| Failure | Impact | Mitigation |
|---------|--------|------------|
| Service unavailable | All protected endpoints fail | Implement HA with load balancer |
| Memory exhaustion | Token loss, all sessions invalidated | Persistent token store |
| Clock drift | Token expiry issues | NTP synchronization |

### Retry Expectations
None. No retry mechanism for token validation.

### Timeout Sensitivity
- Token validation: synchronous, no timeout handling
- No external calls to timeout

### Observability Gaps
- No metrics on login success/failure rates
- No tracking of active token count
- No alerting on authentication anomalies
- No audit logging of authentication events

## Recommended Improvements

### Security
1. Implement bcrypt password hashing
2. Replace mock tokens with proper JWT (RS256)
3. Add rate limiting on login endpoint
4. Implement account lockout after failed attempts
5. Add audit logging for all authentication events
6. Implement MFA support

### Resilience
1. Migrate tokens to Redis for persistence
2. Implement token refresh mechanism
3. Add circuit breaker for downstream (if any added)
4. Implement graceful shutdown with token persistence

### Operational
1. Add metrics: login success rate, active sessions, validation latency
2. Implement structured logging with trace IDs
3. Add health check with token store status
4. Create operational runbook for token emergencies

### Architecture
1. Separate token issuance from validation (microservice split)
2. Implement OAuth2/OIDC compliance
3. Add SSO integration capability
4. Create authentication event stream for analytics
