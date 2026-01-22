#!/usr/bin/env bash
set -euo pipefail

REGISTRY="${REGISTRY:-omaralmansoori}"
TAG="${1:-latest}"

usage() {
  cat <<USAGE
Build and push EventVue Docker images to Docker Hub.

Usage: $0 [tag]
  tag   Optional image tag (defaults to "latest").

Environment variables:
  REGISTRY   Docker Hub namespace (defaults to "omaralmansoori").

The script builds images used by the production and core/edge Compose bundles:
  - eventvue-server
  - eventvue-client
  - eventvue-scraper-service
  - eventvue-whatsapp-service
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

images=(
  "server . server/Dockerfile"
  "client . client/Dockerfile"
  "scraper-service . scraper-service/Dockerfile"
  "whatsapp-service whatsapp-service whatsapp-service/Dockerfile"
)

for image in "${images[@]}"; do
  read -r name context dockerfile <<<"${image}"
  tag="${REGISTRY}/eventvue-${name}:${TAG}"
  echo "\n=== Building ${tag} (context: ${context}, dockerfile: ${dockerfile}) ==="
  docker build -t "${tag}" -f "${dockerfile}" "${context}"
  echo "\n=== Pushing ${tag} ==="
  docker push "${tag}"
done

echo "\nAll images built and pushed with tag '${TAG}' to namespace '${REGISTRY}'."
