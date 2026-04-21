# Lumina - Fullstack Auth App (React + Node.js + PostgreSQL)

Simple project with:
- Create account (no verification)
- Login
- Show `Welcome, username` after login
- Colorful frontend theme

## Stack

- Frontend: React (Vite)
- Backend: Node.js + Express
- Database: PostgreSQL (AWS RDS)
- Infrastructure: Terraform (AWS EKS + RDS + VPC)
- Ingress: Traefik (NodePort on EKS)
- CI/CD: GitHub Actions + ArgoCD Image Updater (GitOps)

## Project Structure

```
Lumina/
├── app/
│   ├── backend/                        # Node.js + Express API
│   └── frontend/                       # React (Vite)
├── K8s/
│   ├── base/
│   │   ├── backend/
│   │   │   ├── deployment.yaml
│   │   │   ├── service.yaml
│   │   │   ├── ingress.yaml
│   │   │   ├── kustomization.yaml
│   │   │   └── secret.yaml             # RDS credentials (gitignored)
│   │   └── frontend/
│   │       ├── deployment.yaml
│   │       ├── service.yaml
│   │       ├── ingress.yaml
│   │       └── kustomization.yaml
│   ├── overlays/
│   │   ├── dev/
│   │   │   ├── backend/
│   │   │   │   └── kustomization.yaml  # image tag: dev
│   │   │   └── frontend/
│   │   │       └── kustomization.yaml  # image tag: dev
│   ├── ingress-controller/
│   │   ├── install.sh
│   │   └── values.yaml
│   └── argocd/
│       ├── install.sh
│       ├── backend-app.yaml
│       ├── frontend-app.yaml
│       └── dockerhub-secret.yaml       # Image Updater credentials (gitignored)
├── .github/
│   └── workflows/
│       ├── backend-dev.yml             # Build & push backend :dev image
│       └── frontend-dev.yml            # Build & push frontend :dev image
└── terraform/
    ├── DEV/                            # Root module (entry point)
    └── modules/
        ├── networking/                 # VPC, subnets, IGW, NAT
        ├── eks_cluster/                # EKS control plane + IAM
        ├── eks_cluster_nodes/          # Self-managed nodes + ASG
        └── rds/                        # PostgreSQL RDS instance
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

Table creation runs automatically from `app/backend/database/init.sql`.

### 2) Start Backend

```bash
cd app/backend
npm install
npm run dev
```

Backend runs on `http://localhost:4000`. Environment file: `app/backend/.env`.

### 3) Start Frontend

```bash
cd app/frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`.

---

## Docker

Build images:

```bash
docker build -t lumina-backend:dev ./app/backend
docker build -t lumina-frontend:dev \
  --build-arg VITE_API_URL=http://localhost:4000 \
  ./app/frontend
```

Run containers:

```bash
docker run -d --name lumina-postgres -p 5432:5432 \
  -e POSTGRES_DB=coredb \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  postgres:16

docker run -d --name lumina-backend -p 4000:4000 --env-file app/backend/.env.docker lumina-backend:dev
docker run -d --name lumina-frontend -p 8080:80 lumina-frontend:dev
```

- Frontend available at `http://localhost:8080`
- Vite variables are baked at build time — pass `VITE_API_URL` via `--build-arg`
- Remove existing containers first if needed: `docker rm -f lumina-frontend lumina-backend lumina-postgres`

---

## CI/CD Pipeline (GitHub Actions + ArgoCD Image Updater)

### How it works

```
Push code to app/backend or app/frontend
        ↓
GitHub Actions
  ├── Build Docker image
  └── Push to Docker Hub (:dev tag)
              ↓
  ArgoCD Image Updater polls Docker Hub every 2 min
  detects digest change on :dev tag
              ↓
  ArgoCD syncs rolling restart to EKS (lumina-dev namespace)
```

### GitHub Secrets Required

| Secret | Description |
|---|---|
| `DOCKERHUB_USERNAME` | Docker Hub username |
| `DOCKERHUB_TOKEN` | Docker Hub access token |

### Workflows

| Workflow | Trigger | What it does |
|---|---|---|
| `backend-dev.yml` | Push to `app/backend/**` | Builds & pushes `lumina-backend:dev` |
| `frontend-dev.yml` | Push to `app/frontend/**` | Builds & pushes `lumina-frontend:dev` |

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

### Outputs

```bash
terraform output rds_endpoint       # Use as DB_HOST in secret.yaml
terraform output eks_node_role_arn  # Use in aws-auth-cm.yaml
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

### 1) Configure kubectl

```bash
aws eks update-kubeconfig --region us-east-1 --name dev-cluster
kubectl get nodes
```

Nodes will show `NotReady` until `aws-auth` is applied.

### 2) Apply aws-auth ConfigMap

```bash
cd terraform/DEV
terraform output eks_node_role_arn
```

Update `rolearn` in `terraform/aws-auth-cm.yaml` then apply:

```bash
kubectl apply -f terraform/aws-auth-cm.yaml
kubectl get nodes   # should show Ready
```

### 3) Install Traefik Ingress Controller


```bash
cd K8s/ingress-controller
bash install.sh
```

Verify:

```bash
kubectl -n traefik get pods
kubectl -n traefik get svc
kubectl get ingressclass
```

### 4) Install ArgoCD

```bash
cd K8s/argocd
bash install.sh
```

Access ArgoCD UI via port-forward:

```bash
kubectl port-forward svc/argocd-server -n argocd 8443:443
# open https://localhost:8443
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath='{.data.password}' | base64 -d
```

### 5) Create Docker Hub credentials for Image Updater

Fill in `K8s/argocd/dockerhub-secret.yaml` then apply:

```bash
kubectl apply -f K8s/argocd/dockerhub-secret.yaml
```

### 6) Apply DB Secret (one-time, gitignored)

Fill in `K8s/base/backend/secret.yaml` with RDS credentials:

```yaml
stringData:
  DB_HOST: "<terraform output rds_endpoint>"
  DB_PORT: "5432"
  DB_NAME: "coredb"
  DB_USER: "postgres"
  DB_PASSWORD: "<your-db-password>"
  JWT_SECRET: "<your-jwt-secret>"
  DB_SSL: "true"
```

Apply to `lumina-dev` namespace:

```bash
kubectl create namespace lumina-dev --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f K8s/base/backend/secret.yaml -n lumina-dev
```

### 7) Register ArgoCD Applications

```bash
kubectl apply -f K8s/argocd/backend-app.yaml
kubectl apply -f K8s/argocd/frontend-app.yaml
```

ArgoCD will create the `lumina-dev` namespace and deploy all resources automatically.

Verify:

```bash
kubectl get applications -n argocd
kubectl get all -n lumina-dev
```

### 8) Test with port-forward or ingress 

```bash
kubectl port-forward svc/lumina-frontend-service 8080:80 -n lumina-dev &
kubectl port-forward svc/lumina-backend-service 4000:4000 -n lumina-dev &
```

Open `http://localhost:8080`.

### How DB Credentials Work

```
RDS (Terraform) → secret.yaml (manual) → K8s Secret → backend Pod (envFrom)
```

> `secret.yaml` is gitignored — never commit real credentials.

---

## Notes

- No email verification required for account creation
- Passwords are hashed with bcrypt
- Login accepts username or email
- All resources deployed to `lumina-dev` namespace
- ArgoCD Image Updater detects new `:dev` image digest and triggers rolling restart automatically
