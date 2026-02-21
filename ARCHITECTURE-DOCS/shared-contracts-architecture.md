# Internal Architecture & Dependency Documentation
# shared-contracts
# KaChow-Organisation

## Service Overview

### Purpose of the Repository
The shared-contracts repository serves as a centralized package containing validation schemas, event definitions, service configurations, and example payloads for the KaChow microservices ecosystem. It is distributed as an npm package and consumed by all domain services.

### Business Responsibility
- Define and export Joi validation schemas for all service APIs
- Define event type constants for event-driven communication
- Provide service URL and port configurations
- Supply example payloads for documentation and testing
- Offer a centralized validation helper function

### Domain Boundaries
**Owned by this repository:**
- Schema definitions (Joi validation schemas)
- Event type constants
- Service configuration constants
- Example payload definitions

**NOT owned by this repository:**
- Business logic
- Service implementations
- Runtime state
- Infrastructure concerns

## Role in the Overall System

### Architectural Position
The shared-contracts repository is a cross-cutting dependency used by all services. It sits outside the runtime service topology but is imported at build time by every domain service. It acts as a contract definition layer that creates coupling between services.

### Service Interactions
| Consumer | Contracts Used | Purpose |
|----------|----------------|---------|
| auth-service | LoginRequestSchema, ValidateRequestSchema, ServicePorts | Request validation, port config |
| user-service | CreateUserRequestSchema, ServicePorts, ServiceUrls, EventTypes | Validation, config, events |
| order-service | CreateOrderRequestSchema, OrderItemSchema, ServicePorts, ServiceUrls, EventTypes | Validation, config, events |
| payment-service | PaymentRequestSchema, PaymentSchema, ServicePorts, ServiceUrls, EventTypes | Validation, config, events |
| notification-service | NotificationRequestSchema, ServicePorts, ServiceUrls, EventTypes | Validation, config, events |
| api-gateway | ServicePorts, ServiceUrls | Routing configuration |
| analytics-service | ServicePorts, EventTypes, MetricSchema, ReportSchema | Config, event processing |

### Upstream and Downstream Services
- **Upstream:** None (consumed by all services)
- **Downstream:** All domain services depend on this package

## API Surface (Package Exports)

### Module Export Structure
```
{
  schemas: {
    // Auth Service Schemas
    LoginRequestSchema: Joi.ObjectSchema,
    LoginResponseSchema: Joi.ObjectSchema,
    ValidateRequestSchema: Joi.ObjectSchema,
    ValidateResponseSchema: Joi.ObjectSchema,
    
    // User Service Schemas
    UserSchema: Joi.ObjectSchema,
    CreateUserRequestSchema: Joi.ObjectSchema,
    
    // Order Service Schemas
    OrderSchema: Joi.ObjectSchema,
    CreateOrderRequestSchema: Joi.ObjectSchema,
    OrderItemSchema: Joi.ObjectSchema,
    
    // Payment Service Schemas
    PaymentSchema: Joi.ObjectSchema,
    PaymentRequestSchema: Joi.ObjectSchema,
    
    // Notification Service Schemas
    NotificationSchema: Joi.ObjectSchema,
    NotificationRequestSchema: Joi.ObjectSchema,
    
    // Analytics Service Schemas
    MetricSchema: Joi.ObjectSchema,
    ReportSchema: Joi.ObjectSchema,
    
    // Event Schemas
    EventSchemas: { [eventType]: Joi.ObjectSchema }
  },
  
  EventTypes: {
    ORDER_CREATED: "OrderCreated",
    ORDER_UPDATED: "OrderUpdated",
    ORDER_CANCELLED: "OrderCancelled",
    PAYMENT_PROCESSED: "PaymentProcessed",
    PAYMENT_FAILED: "PaymentFailed",
    USER_CREATED: "UserCreated",
    USER_UPDATED: "UserUpdated",
    NOTIFICATION_SENT: "NotificationSent",
    NOTIFICATION_FAILED: "NotificationFailed"
  },
  
  ExamplePayloads: {
    loginRequest: Object,
    loginResponse: Object,
    user: Object,
    createOrderRequest: Object,
    orderCreated: Object,
    paymentProcessed: Object
  },
  
  ServicePorts: {
    AUTH_SERVICE: 3001,
    USER_SERVICE: 3002,
    ORDER_SERVICE: 3003,
    PAYMENT_SERVICE: 3004,
    NOTIFICATION_SERVICE: 3005,
    API_GATEWAY: 3000,
    ANALYTICS_SERVICE: 3006
  },
  
  ServiceUrls: {
    AUTH_SERVICE: "http://localhost:3001",
    USER_SERVICE: "http://localhost:3002",
    ORDER_SERVICE: "http://localhost:3003",
    PAYMENT_SERVICE: "http://localhost:3004",
    NOTIFICATION_SERVICE: "http://localhost:3005",
    API_GATEWAY: "http://localhost:3000",
    ANALYTICS_SERVICE: "http://localhost:3006"
  },
  
  validate: (schema: Joi.Schema, data: any) => Joi.ValidationResult
}
```

### Schema Details

**LoginRequestSchema**
- username: string (required)
- password: string (required)

**CreateUserRequestSchema**
- username: string (required)
- email: string, email format (required)
- fullName: string (required)

**CreateOrderRequestSchema**
- userId: string (required)
- items: array of OrderItemSchema, min 1 (required)

**OrderItemSchema**
- productId: string (required)
- quantity: integer, min 1 (required)
- unitPrice: positive number (required)

**PaymentRequestSchema**
- orderId: string (required)
- amount: positive number (required)
- currency: "USD" | "EUR" | "GBP", default "USD" (optional)
- paymentMethod: "card" | "bank_transfer" | "paypal" (required)

**NotificationRequestSchema**
- userId: string (required)
- type: "email" | "sms" | "push" (required)
- subject: string (required)
- message: string (required)

## Dependencies

### Package Dependencies
| Dependency | Version | Purpose |
|------------|---------|---------|
| joi | ^17.9.2 | Schema definition and validation |

### REST Dependencies
None. This is a library package, not a runtime service.

### Event Dependencies
None. This package defines event types but does not participate in event flow.

### Consumers
All KaChow microservices consume this package:
- auth-service
- user-service
- order-service
- payment-service
- notification-service
- api-gateway
- analytics-service

## Data Ownership & Models

### Schema Ownership
**Owned by this package:**
- Joi schema definitions
- Event type string constants
- Service port mappings
- Example payload structures

**NOT owned by this package:**
- Runtime data
- Actual service configurations (values are hardcoded defaults)
- Business logic

### Service-Boundary Violations
None in the traditional sense, but the entire package represents an architectural violation (see section 7).

## Cross-Service Flows

### Schema Change Propagation
1. Schema is modified in shared-contracts
2. Package version is updated
3. All consuming services must update their dependency
4. All services must be redeployed
5. Breaking changes require coordinated deployment

### Event Type Coordination
1. New event type added to shared-contracts EventTypes
2. Publisher service updated to emit new event
3. Consumer services updated to handle new event
4. Shared-contracts provides the common string constant

### Configuration Distribution
1. ServicePorts and ServiceUrls defined in shared-contracts
2. Services import and use these values
3. Changing port requires updating shared-contracts
4. All services must be updated to receive new configuration

## Architectural Risks & Violations

### VIOLATION: Tight Coupling via Shared Contracts
**Severity:** CRITICAL

**Description:** Having a shared contracts package creates tight coupling between all services. When one service's schema changes, all services must update their shared-contracts dependency.

**Blast Radius:** Cascading updates across all services for any contract change. Deployment coordination complexity. Version drift if services update at different rates.

**Proper Approach:** Each service should own and publish its own contracts. Services should share contracts via consumer-driven contract testing (Pact) or API registries.

---

### VIOLATION: Backwards Dependency Direction
**Severity:** HIGH

**Description:** The shared-contracts package "knows" about all services (schemas for each service, event types for all services). This is backwards - services should define their own contracts.

**Blast Radius:** shared-contracts becomes a bottleneck. Changes require cross-team coordination. Deployment dependencies created.

**Proper Approach:** Each service defines and exports its own schemas. Event types should be defined by the event schema registry.

---

### VIOLATION: Hardcoded Configuration
**Location:** ServicePorts, ServiceUrls
**Severity:** MEDIUM

**Description:** Service URLs are hardcoded to localhost. This prevents environment-specific configuration and makes containerized deployment difficult.

**Blast Radius:** Deployment configuration conflicts, difficulty running in different environments.

**Proper Approach:** Use environment variables for service discovery, integrate with Consul or Kubernetes DNS.

---

### Risk: Version Compatibility
**Severity:** HIGH

**Description:** Different services may use different versions of shared-contracts, leading to schema incompatibilities. No enforcement of version consistency.

**Blast Radius:** Runtime validation failures, event deserialization errors.

**Mitigation:** Implement strict version management, automated compatibility checking.

---

### Risk: Breaking Changes
**Severity:** MEDIUM

**Description:** Changes to schemas in shared-contracts can break consuming services without explicit notice.

**Blast Radius:** Service failures after deployment.

**Mitigation:** Implement semantic versioning, deprecation warnings, backward compatibility support.

---

### Risk: Deployment Bottleneck
**Severity:** HIGH

**Description:** shared-contracts updates require coordination across all teams. This creates a deployment bottleneck and slows down independent service releases.

**Blast Radius:** Reduced deployment velocity, release train coordination overhead.

## Versioning & Change Impact

### Versioning Strategy
**Current:** Package uses semantic versioning (1.0.0) but there is no formal versioning strategy for schema evolution.

**Schema Versioning:** Not implemented. Schema changes are breaking changes by default.

### Dependency Fragility
- Breaking schema changes: Require updates in all consuming services
- New event types: Require coordination between publisher and consumers
- Port configuration changes: Require all services to update

### High-Risk Changes
- Schema field removal or type changes: Break validation in consuming services
- Event type name changes: Break event routing
- Port number changes: Break service communication

## Operational Considerations

### Failure Modes
| Failure | Impact | Mitigation |
|---------|--------|------------|
| Package version conflict | Runtime validation errors | Version lockfile management |
| Schema mismatch | API request/response failures | Contract testing |
| Breaking change deployment | Service outages | Blue-green deployment |

### Package Management
- Published as @kachow-organisation/shared-contracts
- Version controlled via package.json
- Distributed via npm registry

### Build Process
- No build step required (pure Node.js)
- Joi dependency must be installed by consuming services

### Observability Gaps
- No visibility into which services use which schema versions
- No tracking of schema validation failure rates
- No monitoring of contract drift between services

## Recommended Improvements

### Decentralize Contracts
1. Remove shared-contracts package
2. Each service defines and exports its own schemas
3. Services publish contracts to API registry (Swagger/OpenAPI)
4. Implement consumer-driven contract testing with Pact

### Event Schema Management
1. Use schema registry (Confluent Schema Registry, AWS Glue)
2. Define event schemas in Avro or JSON Schema
3. Implement schema evolution with backward compatibility
4. Add schema validation at message broker level

### Configuration Management
1. Remove hardcoded ServicePorts and ServiceUrls
2. Use environment variables for configuration
3. Implement service discovery (Consul, Eureka, Kubernetes DNS)
4. Add configuration validation on startup

### Versioning Strategy
1. Implement strict semantic versioning
2. Maintain backward compatibility for at least one major version
3. Add deprecation warnings before breaking changes
4. Provide migration guides for schema changes

### Testing and Validation
1. Add contract tests between services
2. Implement schema compatibility checking in CI/CD
3. Add automated API compatibility testing
4. Create schema change review process

### Alternative Approaches
Consider these alternatives to the shared-contracts pattern:

1. **API-First Design:** Use OpenAPI specifications that services implement
2. **Consumer-Driven Contracts:** Services define expectations of their consumers
3. **Schema Registry:** Central registry with versioning and compatibility checking
4. **gRPC/Protobuf:** Strongly typed contracts with code generation
5. **GraphQL:** Schema-defined API with federated ownership

## Why This Package Exists

The shared-contracts package was created to:
1. Provide a quick start for the microservices architecture demo
2. Ensure consistency during initial development
3. Simplify the learning curve for team members

## Why It Should Be Removed

1. Violates microservices autonomy principle
2. Creates deployment coupling
3. Becomes a bottleneck for service evolution
4. Prevents independent service versioning
5. Violates domain-driven design bounded context principles

## Migration Path

To migrate away from shared-contracts:

**Phase 1: Per-Service Schemas**
- Move each service's schemas into the service repository
- Export schemas from service modules
- Update services to import schemas from service packages

**Phase 2: API Registry**
- Set up Swagger/OpenAPI registry
- Publish service API specifications
- Implement client generation from specs

**Phase 3: Event Schema Registry**
- Implement Confluent Schema Registry or equivalent
- Migrate events to Avro/JSON Schema
- Add schema validation at broker level

**Phase 4: Contract Testing**
- Implement Pact for consumer-driven contracts
- Add contract tests to CI/CD
- Remove shared-contracts dependency

**Phase 5: Service Discovery**
- Implement environment-based configuration
- Remove ServicePorts and ServiceUrls from shared-contracts
- Use service discovery for inter-service communication
