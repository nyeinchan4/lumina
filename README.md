# Lumina - Fullstack Auth App (React + Node.js + PostgreSQL)

Simple project with:
- Create account (no verification)
- Login
- Show `Welcome, username` after login
- Colorful frontend theme

## Stack

- Frontend: React (Vite)
- Backend: Node.js + Express
- Database: PostgreSQL (local Docker or AWS RDS)
- Infrastructure: Terraform (AWS EKS + RDS + VPC)
- Ingress: Traefik on EKS (Classic ELB via AWS Cloud Controller)

## Project Structure

```
Lumina/
├── backend/                        # Node.js + Express API
├── frontend/                       # React (Vite)
├── k8s/
│   └── base/
│       ├── frontend/
│       │   ├── deployment.yaml
│       │   └── service.yaml
│       └── backend/
│           ├── deployment.yaml
│           ├── service.yaml
│           └── secret.yaml         # RDS credentials (gitignored)
├── K8s/
│   └── ingress-controller/
│       ├── install.sh
│       └── values.yaml
├── terraform/
│   ├── DEV/                        # Root module (entry point)
│   └── modules/
│       ├── networking/             # VPC, subnets, IGW, NAT
│       ├── eks_cluster/            # EKS control plane + IAM
│       ├── eks_cluster_nodes/      # Self-managed nodes + ASG
│       └── rds/                    # PostgreSQL RDS instance
└── kubernetes/                     # Legacy manifests (reference only)
```

## API Endpoints

- `POST /api/auth/register`
  - body: `{ "username": "demo", "email": "demo@mail.com", "password": "secret123" }`
- `POST /api/auth/login`
  - body: `{ "identifier": "demo", "password": "secret123" }`

---

## Local Development

### 1) Start PostgreSQL

```bash
docker compose up -d
```

Starts PostgreSQL on `localhost:5432`:
- Database: `auth_app`
- User: `postgres`
- Password: `postgres`

Table creation runs automatically from `backend/database/init.sql`.

### 2) Start Backend

```bash
cd backend
npm install
npm run dev
```

Backend runs on `http://localhost:4000`. Environment file: `backend/.env`.

### 3) Start Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`.

---

## Docker

Build images:

```bash
docker build -t lacygu-backend:latest ./backend
docker build -t lacygu-frontend:latest --build-arg VITE_API_URL=http://localhost:4000 ./frontend
```

Run containers:

```bash
docker run -d --name lacygu-postgres -p 35432:5432 \
  -e POSTGRES_DB=postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  postgres:16

docker run -d --name lacygu-backend -p 4000:4000 --env-file backend/.env.docker lacygu-backend:latest
docker run -d --name lacygu-frontend -p 8080:80 lacygu-frontend:latest
```

- Frontend available at `http://localhost:8080`
- Vite variables are baked at build time — pass `VITE_API_URL` via `--build-arg`
- Remove existing containers first if needed: `docker rm -f lacygu-frontend lacygu-backend lacygu-postgres`

---

## Terraform (AWS Infrastructure)

### Prerequisites

- AWS credentials configured
- Terraform >= 1.0

### Provision

```bash
cd terraform/DEV
terraform init
terraform plan -var="db_password=yourpassword"
terraform apply -var="db_password=yourpassword"
```

This provisions:
- VPC with public/private subnets (tagged for EKS ELB discovery)
- EKS cluster (`dev-cluster`) with self-managed node group (2x `t3.medium`)
- RDS PostgreSQL (`db.t3.micro`, private subnets, no public access)

### Get RDS Endpoint

```bash
terraform output rds_endpoint
```

### Modules

| Module | Description |
|---|---|
| `networking` | VPC, subnets, IGW, NAT Gateway, route tables |
| `eks_cluster` | EKS control plane, IAM role |
| `eks_cluster_nodes` | Launch template, ASG, node IAM role |
| `rds` | RDS PostgreSQL instance, subnet group, security group |

> **KodeKloud note:** `performance_insights` and `iam_database_authentication` are disabled due to sandbox IAM restrictions. `authentication_mode` is set to `API_AND_CONFIG_MAP` to match the pre-created cluster state.

---

## Kubernetes (EKS)

### Install Traefik Ingress Controller

```bash
cd K8s/ingress-controller
bash install.sh
```

Verify:

```bash
kubectl -n traefik get pods
kubectl -n traefik get svc        # EXTERNAL-IP should show ELB hostname
kubectl get ingressclass
```

Traefik creates a `Service type=LoadBalancer` which triggers AWS to provision a Classic ELB automatically.

### Deploy Application

**1) Fill in RDS credentials in `k8s/base/backend/secret.yaml`:**

```yaml
stringData:
  DB_HOST: "<terraform output rds_endpoint>"
  DB_PORT: "5432"
  DB_NAME: "appdb"
  DB_USER: "postgres"
  DB_PASSWORD: "<your-db-password>"
```

**2) Apply manifests:**

```bash
kubectl apply -f k8s/base/backend/secret.yaml
kubectl apply -f k8s/base/backend/deployment.yaml
kubectl apply -f k8s/base/backend/service.yaml
kubectl apply -f k8s/base/frontend/deployment.yaml
kubectl apply -f k8s/base/frontend/service.yaml
```

### How DB Credentials Work

```
RDS (Terraform) → secret.yaml → K8s Secret → backend Pod (env vars via envFrom)
```

The backend deployment uses `envFrom.secretRef` to load all keys from the secret as environment variables (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`).

> `secret.yaml` is gitignored — never commit real credentials.

---

## Notes

- No email verification required for account creation
- Passwords are hashed with bcrypt
- Login accepts username or email
- For in-cluster frontend-to-backend communication, use `http://lumina-backend-service:4000`
