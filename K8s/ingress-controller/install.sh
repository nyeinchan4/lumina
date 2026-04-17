#!/bin/bash

NAMESPACE="traefik"
RELEASE_NAME="traefik"

# Add and update repo
helm repo add traefik https://traefik.github.io/charts
helm repo update

# Install with improved flags
helm upgrade --install $RELEASE_NAME traefik/traefik \
  --namespace $NAMESPACE \
  --create-namespace \
  --values values.yaml \
  --wait \
  --timeout 5m \
  --atomic