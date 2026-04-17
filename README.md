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
- CI/CD: GitHub Actions + ArgoCD (GitOps)

## Project Structure

```
Lumina/
├── app/
│   ├── backend/                    # Node.js + Express API
│   └── frontend/                   # React (Vite)
├── K8s/
│   ├── base/
│   │   ├── frontend/
│   │   │   ├── deployment.yaml
│   │   │   └── service.yaml
│   │   └── backend/
│   │       ├── deployment.yaml
│   │       ├── service.yaml
│   │       └── secret.yaml         # RDS credentials (gitignored)
│   ├── ingress-controller/
│   │   ├── install.sh
│   │   └── values.yaml
│   └── argocd/
│       ├── install.sh
│       ├── backend-app.yaml
│       └── frontend-app.yaml
├── .github/
│   └── workflows/
│       ├── backend.yml             # Build, push, update image tag
│       └── frontend.yml            # Build, push, update image tag
└── terraform/
    ├── DEV/                        # Root module (entry point)
    └── modules/
        ├── networking/             # VPC, subnets, IGW, NAT
        ├── eks_cluster/            # EKS control plane + IAM
        ├── eks_cluster_nodes/      # Self-managed nodes + ASG
        └── rds/                    # PostgreSQL RDS instance
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
docker build -t lumina-backend:latest ./app/backend
docker build -t lumina-frontend:latest --build-arg VITE_API_URL=http://localhost:4000 ./app/frontend
```

Run containers:

```bash
docker run -d --name lumina-postgres -p 5432:5432 \
  -e POSTGRES_DB=appdb \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  postgres:16

docker run -d --name lumina-backend -p 4000:4000 --env-file app/backend/.env.docker lumina-backend:latest
docker run -d --name lumina-frontend -p 8080:80 lumina-frontend:latest
```

- Frontend available at `http://localhost:8080`
- Vite variables are baked at build time — pass `VITE_API_URL` via `--build-arg`
- Remove existing containers first if needed: `docker rm -f lumina-frontend lumina-backend lumina-postgres`

---

## CI/CD Pipeline (GitHub Actions + ArgoCD)

### How it works

```
Push code to main
      ↓
GitHub Actions
  ├── Build Docker image
  ├── Push to Docker Hub (tagged with git SHA)
  └── Commit new image tag to k8s/base/*/deployment.yaml
                ↓
          ArgoCD detects Git change
                ↓
          ArgoCD syncs deployment to EKS automatically
```

### GitHub Secrets Required

| Secret | Description |
|---|---|
| `DOCKERHUB_USERNAME` | Docker Hub username |
| `DOCKERHUB_TOKEN` | Docker Hub access token |
| `VITE_API_URL` | Backend URL baked into frontend image (e.g. `http://<elb-hostname>`) |
| `GH_PAT` | GitHub Personal Access Token with `repo` scope — allows Actions to push image tag commits back to the repo |

> Generate `GH_PAT` at: GitHub → Settings → Developer Settings → Personal Access Tokens

### Workflows

| Workflow | Trigger | What it does |
|---|---|---|
| `backend.yml` | Push to `app/backend/**` | Builds & pushes backend image, updates `k8s/base/backend/deployment.yaml` |
| `frontend.yml` | Push to `app/frontend/**` | Builds & pushes frontend image, updates `k8s/base/frontend/deployment.yaml` |

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

### 1) Configure kubectl

After `terraform apply`, update your local kubeconfig to connect to the cluster:

```bash
aws eks update-kubeconfig --region us-east-1 --name dev-cluster
```

Verify connection:

```bash
kubectl get nodes
```

Nodes will show `NotReady` at this point — that's expected until `aws-auth` is applied.

### 2) Apply aws-auth ConfigMap

This allows the worker nodes to join the cluster. Get the node IAM role ARN from Terraform output first:

```bash
cd terraform/DEV
terraform output eks_node_role_arn
```

Then update `rolearn` in `terraform/aws-auth-cm.yaml` with the actual ARN:

```yaml
data:
  mapRoles: |
    - rolearn: arn:aws:iam::<account-id>:role/<node-role-name>
      username: system:node:{{EC2PrivateDNSName}}
      groups:
        - system:bootstrappers
        - system:nodes
```

Apply it:

```bash
kubectl apply -f terraform/aws-auth-cm.yaml
```

Verify nodes are ready:

```bash
kubectl get nodes
```

All nodes should show `Ready` status within a few minutes.

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

### Install ArgoCD

```bash
cd K8s/argocd
bash install.sh
```

Get admin password and URL:

```bash
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d
kubectl -n argocd get svc argocd-server -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
```

### Register ArgoCD Applications

**1) Update `repoURL` in both app manifests:**

```yaml
# K8s/argocd/backend-app.yaml and frontend-app.yaml
source:
  repoURL: https://github.com/<your-username>/<your-repo>.git
```

**2) Apply:**

```bash
kubectl apply -f K8s/argocd/backend-app.yaml
kubectl apply -f K8s/argocd/frontend-app.yaml
```

ArgoCD will now automatically sync any changes to `K8s/base/` to the EKS cluster.

### DB Credentials (One-time setup)

**1) Fill in RDS credentials in `K8s/base/backend/secret.yaml`:**

```yaml
stringData:
  DB_HOST: "<terraform output rds_endpoint>"
  DB_PORT: "5432"
  DB_NAME: "appdb"
  DB_USER: "postgres"
  DB_PASSWORD: "<your-db-password>"
  JWT_SECRET: "<your-jwt-secret>"
```

**2) Apply the secret manually (it is gitignored):**

```bash
kubectl apply -f K8s/base/backend/secret.yaml
```

### How DB Credentials Work

```
RDS (Terraform) → secret.yaml → K8s Secret → backend Pod (env vars via envFrom)
```

> `secret.yaml` is gitignored — never commit real credentials.

---

## Notes

- No email verification required for account creation
- Passwords are hashed with bcrypt
- Login accepts username or email
- For in-cluster frontend-to-backend communication, use `http://lumina-backend-service:4000`
