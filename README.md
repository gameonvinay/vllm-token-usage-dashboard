# vLLM Dashboard

Real-time token usage and metrics dashboard for vLLM inference servers.

## Features

- **Token Usage** — Live prompt, generation, and cached token counts with per-second rates
- **Cache Performance** — KV cache hit rates, GPU/CPU cache utilization
- **MTP Speculative Decoding** — Acceptance rates (shown automatically when speculative decoding is active)
- **Engine Health** — Running/waiting request counts, engine saturation status
- **Usage Over Time** — Historical charts broken down by hour, weekday, week, month, and year
- **Data Export/Import** — Backup and restore metrics data as JSON

## Data Storage

All metrics are stored locally in your browser:

- **`localStorage`** key `vllm-dashboard-v2` — Rolling sparkline history (60 data points), time-bucketed aggregates (hourly, daily, weekly, monthly, yearly), and lifetime counters
- **`localStorage`** keys `vllm-server-url` and `vllm-poll-interval` — User-configured server URL and polling interval

No data is sent anywhere — the dashboard polls your vLLM server's `/metrics` and `/v1/models` endpoints and stores everything in the browser.

## Quick Start

### Prerequisites

- Node.js 18+
- A running vLLM server with the `/metrics` endpoint exposed (Prometheus format)

### Development

```bash
npm install
npm run dev
```

This starts the dev server on `http://localhost:5173` with proxying to your vLLM server.

### Build

```bash
npm run build
npm run preview
```

The `dist/` directory contains a static build you can serve with any HTTP server.

## Configuration

Copy `.env.example` to `.env` and adjust:

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_VLLM_BASE_URL` | `http://localhost:8000` | Your vLLM server's base URL |
| `VITE_POLL_INTERVAL_MS` | `5000` | How often to poll metrics (in milliseconds) |

You can also change the server URL and poll interval at runtime via the settings modal (⚙️ button). These changes are persisted in `localStorage`.

## vLLM Server Requirements

The dashboard expects your vLLM server to expose:

- `GET /metrics` — Prometheus-formatted metrics
- `GET /v1/models` — OpenAI-compatible model info endpoint

The dashboard supports both vLLM v0 and v1 metric formats, including:
- `vllm:prompt_tokens_total`, `vllm:generation_tokens_total`
- `vllm:gpu_cache_usage_perc` (with `pool_name` labels for v1)
- `vllm:prefix_cache_hits_total`, `vllm:prefix_cache_queries_total`
- `vllm:spec_decode_num_accepted_tokens_total`, `vllm:spec_decode_num_draft_tokens_total`
- `vllm:num_requests_running`, `vllm:num_requests_waiting`
- `vllm:request_success_total`

## License

MIT
