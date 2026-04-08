# k6 Load Test

## Prerequisites

Install k6: https://grafana.com/docs/k6/latest/set-up/install-k6/

```bash
# macOS
brew install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D68
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

## Seed Test Users

Before running the load test, seed test users in your database. Each virtual user logs in with `loadtest+vu{N}@example.com`.

```bash
# Example: seed 1000 test users via a script or API
node tests/load/seed-users.js
```

## Run

```bash
# Full load test (25 minutes, up to 1000 VUs)
k6 run tests/load/k6-load-test.js

# Against staging
k6 run -e BASE_URL=https://staging-api.yourdomain.com -e WS_URL=wss://staging-api.yourdomain.com tests/load/k6-load-test.js

# Quick smoke test (reduced load)
k6 run --vus 10 --duration 30s tests/load/k6-load-test.js
```

## Thresholds

| Metric | Threshold | Description |
|--------|-----------|-------------|
| `http_req_duration` p95 | < 500ms | 95th percentile response time |
| `http_req_duration` p99 | < 2000ms | 99th percentile response time |
| `http_req_failed` | < 5% | HTTP error rate |
| `api_errors` | < 5% | Application error rate |
| `login_failures` | < 50 | Total login failures |
| `ws_errors` | < 100 | WebSocket errors |
| `iteration_duration` p95 | < 10s | Full user flow time |

## Output to JSON

```bash
k6 run --out json=results.json tests/load/k6-load-test.js
```
