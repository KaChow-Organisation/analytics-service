# Internal Architecture & Dependency Documentation
# user-service
# KaChow-Organisation

## Service Overview

### Purpose of the Service
The user-service manages user profiles and user lifecycle operations within the KaChow microservices ecosystem. It handles user registration, profile retrieval, and user updates.

### Business Responsibility
- Create new user accounts
- Retrieve user profile information
- Store user demographic and contact data
- Emit user lifecycle events

### Domain Boundaries
**Owned by this service:**
- User profile data (name, email, contact information)
- User creation timestamps
- User identifiers (UUID generation)

**NOT owned by this service:**
- User authentication credentials (owned by auth-service)
- User passwords (owned by auth-service)
- User permissions and roles

## Role in the Overall System

### Architectural Position
The user-service is a core domain service that provides user data to other services. It is called by order-service (for order creation), notification-service (for contact information), and order-service (for user lookup).

### Service Interactions
| Direction | Service | Purpose |
|-----------|---------|---------|
| Called by | order-service | User validation during order creation |
| Called by | notification-service | User contact info for notifications |
| Calls | auth-service | Validate admin tokens |
| Produces to | analytics-service | UserCreated events |

### Upstream and Downstream Services
- **Upstream:** order-service, notification-service, analytics-service (via events)
- **Downstream:** auth-service (for token validation)

## API Surface

### Endpoint: POST /users

**Visibility:** Public

**Request Body:**
```
{
  "username": string (required),
  "email": string (required),
  "fullName": string (required)
}
```

**Response 201:**
```
{
  "id": string,
  "username": string,
  "email": string,
  "fullName": string,
  "createdAt": string (ISO 8601)
}
```

**Error Responses:**
- 400: Validation error
- 409: Username or email already exists
- 500: Internal server error

---

### Endpoint: GET /users

**Visibility:** Public

**Response 200:**
```
{
  "users": [
    {
      "id": string,
      "username": string,
      "email": string,
      "fullName": string,
      "createdAt": string (ISO 8601)
    }
  ],
  "count": number
}
```

---

### Endpoint: GET /users/:id

**Visibility:** Public

**Path Parameters:**
- id: string (required)

**Response 200:**
```
{
  "id": string,
  "username": string,
  "email": string,
  "fullName": string,
  "createdAt": string (ISO 8601)
}
```

**Error Responses:**
- 404: User not found

---

### Endpoint: GET /health

**Visibility:** Internal/Operational

**Response 200:**
```
{
  "service": "user-service",
  "status": "healthy",
  "userCount": number,
  "timestamp": string (ISO 8601)
}
```

## Dependencies

### REST Dependencies
| Target Service | Endpoint | Purpose | Criticality |
|----------------|----------|---------|-------------|
| auth-service | POST /validate | Token validation | MEDIUM |

### Event Dependencies
**Produces:**
| Event Type | Destination | Purpose |
|------------|-------------|---------|
| UserCreated | analytics-service POST /events | Analytics tracking |

**Consumes:** None

### Shared Contracts
| Contract | Source | Purpose |
|----------|--------|---------|
| CreateUserRequestSchema | shared-contracts | Request validation |
| UserSchema | shared-contracts | Data structure |
| ServicePorts | shared-contracts | Port configuration |
| ServiceUrls | shared-contracts | Service URLs |
| EventTypes | shared-contracts | Event type constants |

## Data Ownership & Models

### Internal Data Structures

**users (Array)**
- Storage: In-memory array
- Fields: id, username, email, fullName, createdAt
- Lifecycle: Pre-populated with demo data, appended on creation, never persisted

### Service-Boundary Violations
**None:** This service does not access other services' data directly.

## Cross-Service Flows

### User Creation Flow
1. Client calls POST /users with user data
2. user-service validates request against CreateUserRequestSchema
3. user-service checks for duplicate username/email
4. If valid, creates user with generated UUID
5. Stores user in users array
6. Emits UserCreated event to analytics-service
7. Returns created user to client

### User Retrieval Flow
1. Client calls GET /users/:id
2. user-service searches users array by id
3. If found, returns user object
4. If not found, returns 404

## Architectural Risks & Violations

### Risk: In-Memory Data Loss
**Severity:** HIGH

**Description:** User data stored in-memory only. Service restart loses all user records.

**Blast Radius:** Complete user data loss on deployment.

**Mitigation:** Implement PostgreSQL or MongoDB for persistence.

---

### Risk: No Authentication on Endpoints
**Severity:** CRITICAL

**Description:** User endpoints are publicly accessible without authentication.

**Blast Radius:** Anyone can create users, retrieve all user data.

**Mitigation:** Add auth-service token validation middleware.

---

### Risk: Duplicate Check Race Condition
**Severity:** MEDIUM

**Description:** Username/email duplicate check and insert are not atomic.

**Blast Radius:** Duplicate users possible under concurrent creation.

**Mitigation:** Use database unique constraints.

---

### Risk: Circular Dependency Potential
**Severity:** MEDIUM

**Description:** auth-service and user-service both deal with users. auth-service has in-memory users, user-service is supposed to be the source of truth.

**Blast Radius:** Data inconsistency between services.

**Mitigation:** auth-service should call user-service for credential verification instead of local store.

## Versioning & Change Impact

### API Versioning Strategy
None. No versioning implemented.

### Dependency Fragility
- **auth-service dependency:** Token validation failure blocks user operations
- **shared-contracts schema changes:** Breaking changes require updates

### High-Risk Changes
- User schema changes break order-service and notification-service
- ID format changes break downstream references
- Endpoint path changes break api-gateway routing

## Operational Considerations

### Failure Modes
| Failure | Impact | Mitigation |
|---------|--------|------------|
| Service unavailable | Cannot create or retrieve users | Load balancer with multiple instances |
| Data loss | All user data lost | Persistent storage |
| auth-service down | Token validation fails | Graceful degradation without auth |

### Retry Expectations
None. No retry mechanism for external calls.

### Timeout Sensitivity
- auth-service validation: 5000ms default

### Observability Gaps
- No metrics on user creation rate
- No tracking of duplicate user attempts
- No alerting on data store size
- No audit logging of user operations

## Recommended Improvements

### Data Persistence
1. Replace in-memory store with PostgreSQL
2. Add database connection pooling
3. Implement data migration strategy
4. Add backup and disaster recovery

### Security
1. Add authentication middleware using auth-service
2. Implement authorization (admin vs regular users)
3. Add input sanitization
4. Implement PII data encryption

### Architecture
1. Remove auth-service dependency (move auth to gateway)
2. Add user update and delete endpoints
3. Implement soft delete for user records
4. Add user search and filtering

### Operational
1. Add metrics: user creation rate, retrieval latency
2. Implement structured logging
3. Add health check with database connectivity
4. Create operational runbook for data recovery
