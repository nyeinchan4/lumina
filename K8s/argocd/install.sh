#!/bin/bash

NAMESPACE="argocd"

echo "Installing ArgoCD..."

# Create namespace
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# Install ArgoCD
kubectl apply -n $NAMESPACE -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for ArgoCD to be ready
echo "Waiting for ArgoCD pods to be ready..."
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=argocd-server -n $NAMESPACE --timeout=300s

# Install ArgoCD Image Updater
echo "Installing ArgoCD Image Updater..."
kubectl apply -n $NAMESPACE -f https://raw.githubusercontent.com/argoproj-labs/argocd-image-updater/stable/manifests/install.yaml

echo ""
echo "ArgoCD installed successfully!"
echo ""
echo "Get admin password:"
echo "  kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d"
echo ""
echo "Access ArgoCD UI via port-forward:"
echo "  kubectl port-forward svc/argocd-server -n argocd 8443:443"
echo "  Open https://localhost:8443"
echo ""
echo "Login with username: admin"
