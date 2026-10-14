# KVFlow

A browser-based discrete-event simulator of multi-turn agents competing for a shared KV-cache. It compares least-recently-used eviction with a causal trajectory-aware retention heuristic.

## Question

When many agents grow a conversation, pause for tools, then return, which prefixes should stay in a limited KV budget? LRU keeps whatever was touched last. The alternative scores near-term return probability times estimated recompute cost, divided by a footprint penalty, using only information available at the decision.

## Run locally

```bash
pnpm install
pnpm test
pnpm lint
pnpm build
pnpm dev
```

Optional multi-seed summary:

```bash
pnpm benchmark
```

Open `http://localhost:3000`. The default experiment (coding agents, 25 launched, 8 GiB, seed 42) is computed on load.

Share a configuration with query params:

`/?preset=code&agents=25&memory=8&seed=42&policy=trajectory-aware`

## What is simulated

- Seeded synthetic workloads (coding, terminal, research, adversarial)
- One FIFO inference worker
- Prefill and decode as consecutive virtual-time spans
- Asynchronous tool waits
- Logical context that survives eviction
- Physical KV that does not
- All-or-nothing per-agent cache entries
- Protected reservations for the in-flight request
- Capacity invariant: reserved bytes never exceed the budget

Policies never see future tool completion times or future turns. Both policies receive the same immutable exogenous workload.

## Stack

Next.js App Router, TypeScript, Tailwind CSS, Recharts, Vitest. Static export. No backend, database, auth, or API keys.
