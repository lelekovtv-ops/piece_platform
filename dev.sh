#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# dev.sh — Start all backend services + API gateway in parallel
# Usage: ./dev.sh
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

PIDS=()
SERVICES=()

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ---------------------------------------------------------------------------
# Cleanup on exit
# ---------------------------------------------------------------------------
cleanup() {
  echo ""
  log_info "Shutting down services..."
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill -SIGTERM "$pid" 2>/dev/null || true
    fi
  done

  sleep 2

  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill -SIGKILL "$pid" 2>/dev/null || true
    fi
  done

  log_info "All services stopped."
  exit 0
}

trap cleanup SIGINT SIGTERM

# ---------------------------------------------------------------------------
# Check infrastructure containers
# ---------------------------------------------------------------------------
check_infra() {
  local missing=()

  for container in mongodb redis nats; do
    if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -q "$container"; then
      missing+=("$container")
    fi
  done

  if [ ${#missing[@]} -gt 0 ]; then
    log_error "Infrastructure containers not running: ${missing[*]}"
    log_info "Run 'pnpm run infra' or 'docker compose up -d mongodb redis nats' first."
    exit 1
  fi

  log_info "Infrastructure containers OK (mongodb, redis, nats)"
}

# ---------------------------------------------------------------------------
# Wait for a service health endpoint
# ---------------------------------------------------------------------------
wait_for_health() {
  local name="$1"
  local port="$2"
  local max_attempts=20
  local attempt=0

  while [ $attempt -lt $max_attempts ]; do
    if curl -sf "http://localhost:${port}/health" > /dev/null 2>&1; then
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 1
  done

  log_warn "${name} did not become healthy on port ${port} within ${max_attempts}s"
  return 1
}

# ---------------------------------------------------------------------------
# Start a service
# ---------------------------------------------------------------------------
start_service() {
  local name="$1"
  local dir="$2"

  if [ ! -f "$dir/src/index.js" ]; then
    log_warn "Skipping $name — no src/index.js found"
    return
  fi

  log_info "Starting ${CYAN}${name}${NC}..."
  (cd "$dir" && node --watch src/index.js) &
  local pid=$!
  PIDS+=("$pid")
  SERVICES+=("$name (PID $pid)")
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  log_info "Starting piece development environment..."
  echo ""

  check_infra
  echo ""

  # Start API Gateway
  local gateway_dir="$PROJECT_ROOT/tools/api-gateway"
  if [ -d "$gateway_dir" ]; then
    start_service "api-gateway" "$gateway_dir"
  fi

  # Start all backend services
  for service_dir in "$PROJECT_ROOT"/apps/backend/*/; do
    if [ -d "$service_dir" ]; then
      local service_name
      service_name="$(basename "$service_dir")"
      start_service "$service_name" "$service_dir"
    fi
  done

  echo ""
  log_info "Waiting for services to become healthy..."
  sleep 3

  echo ""
  log_info "===== Running Services ====="
  for svc in "${SERVICES[@]}"; do
    echo -e "  ${GREEN}✓${NC} $svc"
  done
  echo ""
  log_info "Press Ctrl+C to stop all services."
  echo ""

  # Wait indefinitely
  wait
}

main "$@"
