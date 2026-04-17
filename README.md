# Lumina - Fullstack Auth App (React + Node.js + PostgreSQL)

Simple project with:
- Create account (no verification)
- Login
- Show `Welcome, username` after login
- Colorful frontend theme

## Stack
- Frontend: React (Vite)
- Backend: Node.js + Express
- Database: PostgreSQL

## 1) Start PostgreSQL

Use Docker:

```bash
docker compose up -d
```

This starts PostgreSQL on `localhost:5432` with:
- Database: `auth_app`
- User: `postgres`
- Password: `postgres`

Table creation script runs automatically from `backend/database/init.sql`.

## 2) Start Backend

```bash
cd backend
npm install
npm run dev
```

Backend runs on `http://localhost:4000`.

Environment file is already included in `backend/.env`.

## 3) Start Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`.

## API Endpoints

- `POST /api/auth/register`
  - body: `{ "username": "demo", "email": "demo@mail.com", "password": "secret123" }`
- `POST /api/auth/login`
  - body: `{ "identifier": "demo", "password": "secret123" }`

## Notes

- No email verification is required for account creation.
- Passwords are hashed with bcrypt.
- Login accepts username or email.

## Docker Notes (Backend + Frontend)

- Backend Docker env file: `backend/.env.docker`
- Frontend Docker env file: `frontend/.env.docker`

Recommended image names:

- `lacygu-frontend`
- `lacygu-backend`
- `lacygu-postgres`

Build images:

```bash
docker build -t lacygu-backend:latest ./backend
docker build -t lacygu-frontend:latest --build-arg VITE_API_URL=http://localhost:4000 ./frontend
```

Run PostgreSQL container:

```bash
docker run -d --name lacygu-postgres -p 35432:5432 \
  -e POSTGRES_DB=postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  postgres:16
```

Run backend container:

```bash
docker run -d --name lacygu-backend -p 4000:4000 --env-file backend/.env.docker lacygu-backend:latest
```

Run frontend container:

```bash
docker run -d --name lacygu-frontend -p 8080:80 lacygu-frontend:latest
```

Important:

- Vite variables are baked during build, so frontend API URL must be passed using `--build-arg` when building the image.
- Open frontend at `http://localhost:8080`.
- If a container name already exists, remove it first:

```bash
docker rm -f lacygu-frontend lacygu-backend lacygu-postgres
```

## Kubernetes Ingress (Traefik)

This project uses Traefik as the Ingress Controller for local Kubernetes.

Install Traefik Ingress Controller:

```bash
helm repo add traefik https://traefik.github.io/charts
helm repo update
kubectl create namespace traefik --dry-run=client -o yaml | kubectl apply -f -
helm upgrade --install traefik traefik/traefik -n traefik \
  --set ingressClass.enabled=true \
  --set ingressClass.isDefaultClass=true \
  --set providers.kubernetesIngress.enabled=true \
  --set image.registry=ghcr.io \
  --set image.repository=traefik/traefik \
  --set image.tag=v3.6.11
```

Verify installation:

```bash
kubectl -n traefik get pods
kubectl -n traefik get svc
kubectl get ingressclass
```

Expected ingress class:

- Name: `traefik`
- Controller: `traefik.io/ingress-controller`

Apply project Kubernetes resources:

```bash
kubectl apply -f kubernetes/lacygu-backend-manifest.yml
kubectl apply -f kubernetes/lacygu-frontend-manifest.yml
kubectl apply -f kubernetes/kacygu-ingress.yml
```

Notes:

- If Docker Hub image pull has EOF issues, use the GHCR image settings shown above.
- For frontend-to-backend communication in-cluster, use backend service DNS such as `http://lacygu-backend-service:4000`.
