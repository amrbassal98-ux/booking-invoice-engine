# BookingInvoiceEngine

A production-grade, multi-tenant booking and invoice engine with integrated Stripe payment processing. Built as a distributed microservices architecture with Kubernetes-native deployment manifests, containerized workloads, and a hardened security posture.

---

## Project Overview

BookingInvoiceEngine enables service providers (doctors, consultants, freelancers) to manage availability slots, accept bookings from clients, and process payments through Stripe. The system supports full multi-tenancy with role-based access control (RBAC) across four roles: `tenant_admin`, `provider`, `staff`, and `customer`.

### Core Capabilities

- **Multi-Tenant Workspace Isolation** — Each tenant's data is scoped via JWT claims and enforced at the database query level.
- **Role-Based Access Control** — Four-tier RBAC with middleware-enforced route protection on both API and frontend.
- **Stripe Payment Integration** — PaymentIntent-based checkout with webhook reconciliation for asynchronous payment confirmation.
- **Invitation System** — Token-based workspace invitations with 7-day expiry, supporting both existing and new user onboarding.
- **Concurrency-Safe Booking** — PostgreSQL `FOR UPDATE` row locking prevents double-booking race conditions.
- **Kubernetes Hardened** — Rootless SecurityContext, NetworkPolicy isolation, PodDisruptionBudgets, and Secrets-only credential management.

---

## System Architecture Matrix

| Component | Local Runtime | Container Image | K8s Workload | Port | Health Check |
|-----------|--------------|-----------------|--------------|------|-------------|
| **Frontend** | Vite dev server (React 19) | `nginx:alpine` (multi-stage) | `frontend-deployment` (2 replicas) | 80 | `GET /` (HTTP) |
| **Backend** | Node.js 20 + Express 5 | `node:20-alpine` | `backend-deployment` (2 replicas) | 5000 | `GET /health` (HTTP) |
| **Database** | PostgreSQL 16 (local) | `postgres:16-alpine` | `postgres-deployment` (1 replica) | 5432 | `pg_isready -U postgres` (exec) |

### Architecture Diagram

```
                    ┌─────────────────────────────────────────┐
                    │           Kubernetes Cluster             │
                    │                                         │
  Internet ───────► │  frontend-svc (NodePort:30080)          │
                    │    └─► Nginx (port 80)                  │
                    │         ├─ /              → SPA (React) │
                    │         └─ /api/*         ──────────┐   │
                    │                                     │   │
                    │  backend-svc (ClusterIP:5000)       │   │
                    │    └─► Express.js (port 5000)  ◄────┘   │
                    │         └─► PostgreSQL (5432)           │
                    │              └─► PVC (5Gi, RWO)         │
                    │                                         │
                    │  NetworkPolicy: frontend→backend→db     │
                    └─────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React, Vite, React Router, Tailwind CSS, Axios | 19, 6, 7, 4, 1.x |
| Backend | Node.js, Express, PostgreSQL (`pg`), JWT, bcryptjs | 20, 5, latest |
| Payments | Stripe SDK (`stripe`, `@stripe/react-stripe-js`) | Latest |
| Database | PostgreSQL | 16-alpine |
| Containerization | Docker (multi-stage builds) | Latest |
| API Docs | Swagger UI, swagger-jsdoc, swagger-ui-express | Latest |
| Orchestration | Kubernetes (Deployments, Services, ConfigMaps, Secrets, PVC, NetworkPolicy, PDB) | 1.28+ |
| CI/CD | GitHub Actions | Latest |

---

## Local Development Setup

### Prerequisites

- **Node.js 20+** (via [nvm](https://github.com/nvm-sh/nvm) recommended)
- **Docker & Docker Compose** (v2+)
- **PostgreSQL 16** (local install or via Docker)

### Quick Start with Docker Compose

```bash
# Clone the repository
git clone <repository-url>
cd booking-invoice-engine

# Start all services (PostgreSQL + Backend + Frontend)
docker compose up --build
```

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | `http://localhost:3000` | React SPA |
| Backend API | `http://localhost:5000` | Express API |
| PostgreSQL | `localhost:5432` | Database |

### Manual Setup (WSL 2 / Linux)

#### 1. Database

```bash
# Start PostgreSQL (via Docker or local install)
docker run -d --name postgres-dev \
  -e POSTGRES_DB=booking_engine \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=dev_password \
  -p 5432:5432 \
  postgres:16-alpine

# Bootstrap schema
psql postgresql://postgres:dev_password@localhost:5432/booking_engine \
  -f backend/src/__tests__/schema.sql
```

#### 2. Backend

```bash
cd backend

# Install NVM and Node.js 20 (if not installed)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install 20
nvm use 20

# Install dependencies
npm ci

# Create environment file
cat > .env << EOF
DATABASE_URL=postgresql://postgres:dev_password@localhost:5432/booking_engine
JWT_SECRET=dev-jwt-secret-change-in-production
STRIPE_SECRET_KEY=sk_test_placeholder
STRIPE_WEBHOOK_SECRET=whsec_placeholder
SKIP_WEBHOOK_SIGNATURE=true
PORT=5000
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
EOF

# Start the server
node server.js
```

#### 3. Frontend

```bash
cd frontend

# Install dependencies
npm ci

# Create environment file
cat > .env << EOF
VITE_API_BASE_URL=http://localhost:5000/api
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_placeholder
EOF

# Start dev server
npm run dev
```

### Running Tests

```bash
cd backend

# Run integration tests (requires running PostgreSQL)
npm test

# Run Stripe webhook mock tests
node src/__tests__/stripe-webhook-mock.test.js

# Run concurrency stress test
node src/__tests__/booking-concurrency-stress.test.js
```

---

## CI/CD Testing Pipeline

The project uses GitHub Actions for automated testing with a localized PostgreSQL service container.

### Pipeline Configuration

**File:** `.github/workflows/ci.yml`

**Triggers:** Push to `main`, Pull requests targeting `main`

### Pipeline Stages

| Stage | Action | Description |
|-------|--------|-------------|
| 1. Checkout | `actions/checkout@v4` | Clones the repository |
| 2. Setup Node | `actions/setup-node@v4` | Installs Node.js 20 with npm cache |
| 3. Install deps | `npm ci` | Clean install of backend dependencies |
| 4. Bootstrap DB | `psql -f schema.sql` | Applies database schema to CI PostgreSQL |
| 5. Start server | `node server.js &` | Launches backend in background |
| 6. Health check | `curl /health` | Waits up to 15s for server readiness |
| 7. Integration tests | `npm test` | Runs Vitest integration test suite |
| 8. Webhook mocks | `stripe-webhook-mock.test.js` | Validates Stripe webhook processing |
| 9. Stress test | `booking-concurrency-stress.test.js` | Tests concurrent booking race conditions |

### Service Container

```yaml
services:
  postgres:
    image: postgres:16-alpine
    env:
      POSTGRES_DB: ci_test_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - 5432:5432
    options: >-
      --health-cmd="pg_isready -U postgres"
      --health-interval=5s
      --health-timeout=3s
      --health-retries=10
```

---

## Security Scanning

This project uses [Snyk](https://snyk.io/) for automated security scanning across both open-source dependencies and application code.

### Dependency Scanning (`snyk test`)

Scans third-party packages in `package-lock.json` for known vulnerabilities (CVEs).

```bash
# Scan backend dependencies
cd backend && snyk test

# Scan frontend dependencies
cd frontend && snyk test
```

**Remediation:** Transitive dependency vulnerabilities are resolved via npm `overrides` in `package.json` to pin safe versions without waiting for upstream maintainers.

### Static Application Security Testing (`snyk code test`)

Performs SAST analysis on application source code to detect security anti-patterns such as:

- Information disclosure (e.g., `X-Powered-By` header exposure)
- Unvalidated input from HTTP request bodies
- Insecure cryptographic usage
- SQL injection, XSS, and path traversal patterns

```bash
# Run SAST scan
snyk code test

# Generate JSON report for CI integration
snyk code test --json > snyk_sast_report.json
```

### Vulnerabilities Remediated

| Vulnerability | Severity | File | Remediation |
|--------------|----------|------|-------------|
| Prototype Pollution in `@apidevtools/json-schema-ref-parser` | Medium | `package.json` | npm override to `^15.3.6` |
| X-Powered-By header information disclosure | Low | `src/app.js` | `app.disable('x-powered-by')` |
| Unchecked type from request body (`currency`) | Low | `bookingController.js` | Added `typeof` validation |
| Unchecked type from request body (`email`) | Low | `tenantController.js` | Added `typeof` validation |
| Unsafe `.toString()` on request body | Medium | `stripeWebhookController.js` | Replaced with `TextDecoder` + type guards |

---

## Kubernetes Staging Deployment

### Prerequisites

- [Minikube](https://minikube.sigs.k8s.io/) or a Kubernetes cluster (v1.28+)
- [kubectl](https://kubernetes.io/docs/tasks/tools/) configured
- [Docker](https://docs.docker.com/get-docker/) for building images

### Step 1: Build Container Images

```bash
# Start Minikube Docker environment
eval $(minikube docker-env)

# Build backend image
docker build -t booking-engine-backend:latest ./backend

# Build frontend image
docker build -t booking-engine-frontend:latest ./frontend
```

### Step 2: Configure Secrets

Before applying manifests, replace placeholder values in `k8s/secrets.yaml`:

```yaml
stringData:
  DATABASE_USER: "postgres"
  DATABASE_PASSWORD: "<your-real-db-password>"
  DATABASE_URL: "postgresql://postgres:<your-real-db-password>@postgres-svc:5432/booking_engine"
  JWT_SECRET: "<generate-with-openssl-rand-base64-32>"
  STRIPE_SECRET_KEY: "<your-real-stripe-secret-key>"
  STRIPE_WEBHOOK_SECRET: "<your-real-stripe-webhook-secret>"
```

### Step 3: Apply Manifests

```bash
# Apply all resources
kubectl apply -f k8s/

# Or apply in order
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/database-pvc.yaml
kubectl apply -f k8s/database-deployment.yaml
kubectl apply -f k8s/database-service.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/backend-service.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/frontend-service.yaml
kubectl apply -f k8s/network-policy.yaml
kubectl apply -f k8s/pdb.yaml
```

### Step 4: Verify Deployment

```bash
# Check pod status
kubectl get pods -l app=booking-engine

# Check services
kubectl get svc -l app=booking-engine

# Check network policies
kubectl get networkpolicies -l app=booking-engine

# Check PDBs
kubectl get pdb -l app=booking-engine

# Access the application
minikube service frontend-svc --url
```

### Manifest Security Features

| Feature | Implementation | File |
|---------|---------------|------|
| **Secrets Isolation** | All credentials in `app-secrets` Secret, referenced via `secretKeyRef` | `secrets.yaml`, `*-deployment.yaml` |
| **Rootless Containers** | `runAsNonRoot: true`, `runAsUser` set per workload | All `*-deployment.yaml` |
| **Capability Dropping** | `capabilities.drop: [ALL]` on all containers | All `*-deployment.yaml` |
| **Network Segmentation** | Tier-isolated NetworkPolicies (frontend→backend→db) | `network-policy.yaml` |
| **Disruption Protection** | PodDisruptionBudgets with `minAvailable: 1` | `pdb.yaml` |
| **Data Persistence** | 5Gi PVC with `ReadWriteOnce` access mode | `database-pvc.yaml` |
| **Health Management** | Readiness, liveness, and startup probes on all tiers | All `*-deployment.yaml` |

---

## API Reference

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/login` | None | Authenticate user, return JWT |
| `POST` | `/api/tenants/onboard` | None | Register tenant or accept invite |

### Availability Slots

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `POST` | `/api/availabilities` | JWT | `tenant_admin`, `provider` | Create slot |
| `GET` | `/api/availabilities` | JWT | Any | List slots (scoped by role) |
| `GET` | `/api/availabilities/:id` | JWT | Any | Get single slot |
| `PUT` | `/api/availabilities/:id` | JWT | `tenant_admin`, `provider` | Update slot |
| `DELETE` | `/api/availabilities/:id` | JWT | `tenant_admin`, `provider` | Delete slot |

### Bookings

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `POST` | `/api/bookings` | JWT | `customer` | Create direct booking |
| `POST` | `/api/bookings/checkout` | JWT | `customer` | Create Stripe PaymentIntent |
| `GET` | `/api/bookings` | JWT | Any | List bookings |
| `GET` | `/api/bookings/:id` | JWT | Any | Get booking with invoice |
| `PATCH` | `/api/bookings/:id/status` | JWT | `tenant_admin`, `staff` | Update status |

### Invitations

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `POST` | `/api/invitations` | JWT | `tenant_admin` | Create invitation |
| `POST` | `/api/invitations/accept` | None | Public | Accept invitation by token |

### Public

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/public/availabilities` | None | List unbooked slots |
| `GET` | `/api/public/availabilities/:id` | None | Get unbooked slot |

### Webhooks

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/webhooks/stripe` | Stripe Signature | Stripe event receiver |

### Health

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/health` | None | Liveness/readiness probe |

---

## Interactive API Documentation (Swagger UI)

The backend serves an interactive OpenAPI 3.0.0 specification via Swagger UI at the `/api-docs` endpoint. This provides a browsable, testable documentation interface for all 19 API endpoints.

### Accessing Swagger UI

| Environment | URL |
|-------------|-----|
| Local development | `http://localhost:5000/api-docs` |
| Kubernetes (via port-forward) | `kubectl port-forward svc/backend-svc 5000:5000` → `http://localhost:5000/api-docs` |
| Raw OpenAPI JSON | `http://localhost:5000/api-docs.json` |

### Configuration File

**File:** `backend/src/config/swagger.js`

The OpenAPI specification is generated from JSDoc annotations in route and controller files using `swagger-jsdoc`. The configuration defines:

- **Metadata** — API title, version, description, contact, and license
- **Server** — Base URL (`/api`)
- **Security** — BearerAuth (JWT) scheme applied globally
- **Schemas** — 8 reusable component schemas (`Error`, `User`, `Workspace`, `AvailabilitySlot`, `Booking`, `Invoice`, `Invitation`, `HealthCheck`)
- **Scan paths** — JSDoc blocks in `routes/*.js`, `controllers/*.js`, and `app.js` are aggregated into the spec

### Documented Endpoints

All 19 endpoints across 7 tag groups are fully documented:

| Tag | Endpoints | Description |
|-----|-----------|-------------|
| **Auth** | `POST /auth/login` | JWT authentication |
| **Tenants** | `POST /tenants/onboard` | Tenant registration / invitation flow |
| **Users** | `GET /users/providers` | List providers/staff (admin only) |
| **Availabilities** | 5 CRUD endpoints | Slot management with overlap detection |
| **Bookings** | 5 endpoints | Booking lifecycle + Stripe checkout |
| **Invitations** | 2 endpoints | Token-based workspace invitations |
| **Webhooks** | `POST /webhooks/stripe` | Stripe event receiver |
| **Public** | 2 endpoints | Unauthenticated slot browsing |
| **Health** | `GET /health` | Kubernetes probe endpoint |

### Dependencies

```json
{
  "swagger-jsdoc": "^6.2.8",
  "swagger-ui-express": "^5.0.1"
}
```

### How It Works

1. JSDoc `@openapi` blocks are placed directly above route definitions in `backend/src/routes/*.js`
2. `swagger-jsdoc` scans the configured paths and aggregates all `@openapi` blocks into a single OpenAPI 3.0.0 JSON spec
3. `swagger-ui-express` serves the interactive Swagger UI at `/api-docs`
4. The raw JSON spec is also available at `/api-docs.json` for code generation tools

---

## Project Structure

```
booking-invoice-engine/
├── .github/workflows/
│   └── ci.yml                          # GitHub Actions CI pipeline
├── backend/
│   ├── .dockerignore                   # Docker build exclusions
│   ├── .env                            # Local environment (git-ignored)
│   ├── Dockerfile                      # Node.js Alpine production image
│   ├── package.json                    # Backend dependencies
│   ├── server.js                       # Express server entrypoint
│   └── src/
│       ├── app.js                      # Express app bootstrap + CORS + routes
│       ├── config/
│       │   ├── db.js                   # PostgreSQL connection pool
│       │   └── swagger.js             # OpenAPI 3.0.0 spec configuration
│       ├── controllers/
│       │   ├── authController.js       # Login + JWT issuance
│       │   ├── availabilityController.js # Slot CRUD with overlap detection
│       │   ├── bookingController.js    # Booking lifecycle + Stripe checkout
│       │   ├── invitationController.js # Invitation create/accept
│       │   ├── stripeWebhookController.js # Stripe event processing
│       │   ├── tenantController.js     # Tenant onboarding
│       │   └── userController.js       # User directory queries
│       ├── middleware/
│       │   └── authMiddleware.js       # JWT auth + RBAC middleware
│       └── routes/
│           ├── authRoutes.js
│           ├── availabilityRoutes.js
│           ├── bookingRoutes.js
│           ├── invitationRoutes.js
│           ├── publicAvailabilityRoutes.js
│           ├── stripeWebhookRoutes.js
│           ├── tenantRoutes.js
│           └── userRoutes.js
├── frontend/
│   ├── .dockerignore                   # Docker build exclusions
│   ├── .env.example                    # Environment template
│   ├── Dockerfile                      # Multi-stage: build + nginx:alpine
│   ├── nginx.conf                      # Nginx config with security headers
│   ├── package.json                    # Frontend dependencies
│   └── src/
│       ├── api/
│       │   └── axios.js                # Axios client with interceptors
│       ├── App.jsx                     # Root component + routing table
│       ├── components/
│       │   ├── InviteProviderForm.jsx  # Invitation form
│       │   ├── Layout.jsx             # Nav bar + workspace switcher
│       │   ├── ProtectedRoute.jsx      # Auth + RBAC route guard
│       │   ├── SlotCard.jsx           # Availability slot display card
│       │   └── StripeProvider.jsx     # Stripe Elements wrapper
│       ├── context/
│       │   └── AuthContext.jsx         # Global auth state provider
│       ├── main.jsx                    # React entrypoint
│       └── pages/
│           ├── AcceptInvitation.jsx    # Invitation acceptance flow
│           ├── AdminDashboard.jsx      # Slot/booking/team management
│           ├── BookingForm.jsx         # Slot booking + Stripe checkout
│           ├── Login.jsx              # Login + workspace selector
│           ├── PublicDashboard.jsx     # Public slot browsing
│           ├── Register.jsx           # Tenant registration
│           ├── SlotForm.jsx           # Slot create/edit form
│           └── Unauthorized.jsx       # 403 access denied
├── k8s/
│   ├── backend-deployment.yaml        # Backend pods + probes + security
│   ├── backend-service.yaml           # Backend ClusterIP service
│   ├── configmap.yaml                 # Non-sensitive configuration
│   ├── database-deployment.yaml       # PostgreSQL pods + PVC mount
│   ├── database-pvc.yaml              # 5Gi PersistentVolumeClaim
│   ├── database-service.yaml          # PostgreSQL ClusterIP service
│   ├── frontend-deployment.yaml       # Frontend pods + probes + security
│   ├── frontend-service.yaml          # Frontend NodePort service
│   ├── network-policy.yaml            # Tier-isolated network policies
│   ├── pdb.yaml                       # PodDisruptionBudgets
│   └── secrets.yaml                   # Sensitive credentials (Secret)
├── docker-compose.yml                 # Local development orchestration
└── LICENSE                            # Apache 2.0
```

---

## License

Apache License 2.0
