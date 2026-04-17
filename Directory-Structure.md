.
├── app/                        # Application Source Code
│   ├── frontend/               # React/Vue/Next.js code
│   │   └── Dockerfile
│   └── backend/                # Node.js/Python/Go code
│       └── Dockerfile
├── k8s/                        # Kubernetes Manifests (The "Source of Truth")
│   ├── base/                   # Common resources
│   │   ├── frontend/
│   │   │   ├── deployment.yaml
│   │   │   └── service.yaml
│   │   └── backend/
│   │       ├── deployment.yaml
│   │       └── service.yaml
│   └── addons/                 # Cluster-wide components
│       ├── ingress-controller/ # Nginx or AWS Load Balancer Controller
│       ├── argocd/             # ArgoCD installation manifests
│       └── external-secrets/   # (Optional) For RDS credentials
├── terraform/                  # (If using) For RDS and VPC setup
│   └── main.tf
└── README.md