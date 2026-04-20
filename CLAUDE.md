# CLAUDE.md — Project Context for AI Assistants

This file provides essential context about the **Lumina** project for AI coding assistants (Claude, Copilot, etc.). Read this before making any changes.

---

## Project Overview

**Lumina** is a production-style fullstack authentication app deployed on AWS EKS using a GitOps workflow. It is built as a **DevOps learning project** to demonstrate end-to-end infrastructure and CI/CD pipeline design.

| Layer | Technology |
|---|---|
| Frontend | React (Vite) |
| Backend | Node.js + Express |
| Database | PostgreSQL (local Docker or AWS RDS) |
| Container Registry | Docker Hub |
| Infrastructure | Terraform (AWS: EKS + RDS + VPC) |
| Kubernetes | EKS (self-managed nodes, `t3.medium`) |
| Ingress | Traefik (via Classic ELB on AWS) |
| GitOps / CD | ArgoCD |
| CI | GitHub Actions |

---

## Repository Structure

```
Lumina/
├── CLAUDE.md                       # ← AI assistant context (this file)
├── README.md                       # Human-readable project overview
├── Directory-Structure.md          # High-level directory map
├── .gitignore
├── app/
│   ├── backend/                    # Node.js + Express API
│   │   ├── database/init.sql       # DB schema (auto-run on Docker startup)
│   │   ├── .env                    # Local dev env vars (gitignored)
│   │   └── .env.docker             # Docker run env vars (gitignored)
│   └── frontend/                   # React (Vite) SPA
├── K8s/
│   ├── base/
│   │   ├── frontend/               # frontend Deployment + Service YAMLs
│   │   └── backend/                # backend Deployment + Service + Secret YAMLs
│   ├── overlays/                   # Kustomize overlays (env-specific patches)
│   ├── ingress-controller/
│   │   ├── install.sh              # Installs Traefik via Helm
│   │   └── values.yaml             # Traefik Helm values
│   └── argocd/
│       ├── install.sh              # Installs ArgoCD
│       ├── backend-app.yaml        # ArgoCD Application CR for backend
│       └── frontend-app.yaml       # ArgoCD Application CR for frontend
├── .github/
│   └── workflows/
│       ├── backend.yml             # CI: build, push, update image tag
│       └── frontend.yml            # CI: build, push, update image tag
└── terraform/
    ├── DEV/                        # Root module — entry point for `terraform apply`
    ├── aws-auth-cm.yaml            # aws-auth ConfigMap for EKS node authorization
    └── modules/
        ├── networking/             # VPC, subnets, IGW, NAT Gateway, route tables
        ├── eks_cluster/            # EKS control plane + IAM role
        ├── eks_cluster_nodes/      # Launch template, ASG, node IAM role
        └── rds/                    # PostgreSQL RDS instance, subnet group, SG
```

---

## API Endpoints

| Method | Path | Body |
|---|---|---|
| `POST` | `/api/auth/register` | `{ username, email, password }` |
| `POST` | `/api/auth/login` | `{ identifier, password }` |

- `identifier` accepts either username **or** email.
- Passwords are hashed with **bcrypt**.
- Auth responses return a **JWT**.

---

## Local Development

### Prerequisites
- Docker + Docker Compose
- Node.js >= 18
- (Optional) AWS CLI + Terraform >= 1.0

### Start Local Stack

```bash
# 1. Start PostgreSQL
docker compose up -d

# 2. Start Backend (http://localhost:4000)
cd app/backend && npm install && npm run dev

# 3. Start Frontend (http://localhost:5173)
cd app/frontend && npm install && npm run dev
```

Local DB config (from `docker-compose.yml`):
- Host: `localhost:5432`
- Database: `auth_app`
- User: `postgres`
- Password: `postgres`

---

## CI/CD Pipeline (GitHub Actions → ArgoCD)

```
Push to main
  ↓
GitHub Actions workflow triggers
  ├── Build Docker image
  ├── Push to Docker Hub (tagged with git SHA)
  └── Commit updated image tag → K8s/base/*/deployment.yaml
        ↓
  ArgoCD detects Git change → syncs to EKS automatically
```

### GitHub Secrets Required

| Secret | Purpose |
|---|---|
| `DOCKERHUB_USERNAME` | Docker Hub login |
| `DOCKERHUB_TOKEN` | Docker Hub access token |
| `VITE_API_URL` | Backend URL baked into frontend image at build time |
| `GH_PAT` | GitHub PAT (`repo` scope) — allows Actions to push image tag commits |

### Workflow Triggers

| Workflow | Trigger Path |
|---|---|
| `backend.yml` | `app/backend/**` |
| `frontend.yml` | `app/frontend/**` |

---

## Terraform Infrastructure (AWS)

### Modules

| Module | Provisions |
|---|---|
| `networking` | VPC, public/private subnets, IGW, NAT Gateway, route tables |
| `eks_cluster` | EKS control plane, IAM role for cluster |
| `eks_cluster_nodes` | Launch template, Auto Scaling Group, node IAM role |
| `rds` | PostgreSQL RDS (`db.t3.micro`), subnet group, security group |

### Provisioning

```bash
cd terraform/DEV
terraform init
terraform plan  -var="db_password=<yourpassword>"
terraform apply -var="db_password=<yourpassword>"
```

### Key Design Decisions & Constraints

- **Self-managed nodes** (not managed node groups) — uses Launch Template + ASG.
- **EKS `authentication_mode`** is set to `API_AND_CONFIG_MAP` — required because the cluster was pre-created in the KodeKloud sandbox environment.
- **`performance_insights`** and **`iam_database_authentication`** are **disabled** — IAM sandbox restrictions prevent these.
- Subnets are tagged with `kubernetes.io/role/elb` and `kubernetes.io/role/internal-elb` for EKS ELB auto-discovery.
- `aws_eip` does **not** use `vpc = true` (deprecated in newer AWS provider versions).

### aws-auth ConfigMap

After `terraform apply`, nodes must be authorized via `terraform/aws-auth-cm.yaml`:

```bash
# Get node role ARN
terraform output eks_node_role_arn

# Update rolearn in aws-auth-cm.yaml, then apply
kubectl apply -f terraform/aws-auth-cm.yaml
```

---

## Kubernetes Setup (EKS)

### Connect to Cluster

```bash
aws eks update-kubeconfig --region us-east-1 --name dev-cluster
kubectl get nodes
```

### Install Traefik Ingress

```bash
cd K8s/ingress-controller
bash install.sh
```

### Install ArgoCD

```bash
cd K8s/argocd
bash install.sh

# Get admin password
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath='{.data.password}' | base64 -d

# Get ArgoCD server URL
kubectl -n argocd get svc argocd-server \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
```

### Register Applications in ArgoCD

Update `repoURL` in `K8s/argocd/backend-app.yaml` and `frontend-app.yaml`, then:

```bash
kubectl apply -f K8s/argocd/backend-app.yaml
kubectl apply -f K8s/argocd/frontend-app.yaml
```

### DB Secret (One-time Manual Step)

`K8s/base/backend/secret.yaml` is **gitignored**. Fill it with RDS credentials and apply manually:

```bash
kubectl apply -f K8s/base/backend/secret.yaml
```

---

## Key Conventions

- **Image tags**: Always use the git commit SHA (not `latest`) in `K8s/base/*/deployment.yaml`. GitHub Actions updates this automatically.
- **Secrets**: Never commit secrets. `secret.yaml`, `.env`, and `.env.docker` are gitignored.
- **Frontend API URL**: `VITE_API_URL` is baked at Docker build time using `--build-arg`. It cannot be changed at runtime.
- **In-cluster backend URL**: Use `http://lumina-backend-service:4000` for frontend → backend communication inside the cluster.
- **Terraform state**: Managed locally (no remote backend configured). Treat `terraform/DEV/terraform.tfstate` as sensitive — do not commit it.
- **AWS Region**: `us-east-1`
- **EKS Cluster Name**: `dev-cluster`
- **Node type**: `t3.medium`, 2 nodes min/desired

---

## Gitignore Highlights

The following are intentionally excluded from version control:

- `app/backend/.env` and `.env.docker`
- `K8s/base/backend/secret.yaml`
- `terraform/DEV/terraform.tfstate*`
- `terraform/DEV/.terraform/`
- `node_modules/`
- Docker build artifacts

---

## Notes for AI Assistants

- When modifying Terraform, always check the **module interface** (`variables.tf` and `outputs.tf`) before editing `main.tf`.
- Do **not** add `vpc = true` to `aws_eip` — this attribute was deprecated.
- Do **not** enable `performance_insights` or `iam_database_authentication` on RDS — sandbox IAM blocks these.
- When changing Kubernetes manifests, prefer editing files under `K8s/base/` unless environment-specific changes are needed (use `K8s/overlays/` for those).
- `VITE_*` environment variables are build-time only — they **cannot** be injected as runtime K8s environment variables.
- ArgoCD watches `K8s/base/` — any committed changes there will be auto-synced to the cluster.
