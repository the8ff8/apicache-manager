# 💾 apicache-manager

> Smart API response caching layer with TTL management, cache invalidation, and hit-rate analytics.

[![CI](https://img.shields.io/github/actions/workflow/status/yourusername/apicache-manager/ci.yml?style=for-the-badge)](https://github.com/yourusername/apicache-manager/actions)
[![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](./LICENSE)
[![Codespace Ready](https://img.shields.io/badge/Codespace-Ready-green?style=for-the-badge&logo=github)](https://codespaces.new/yourusername/apicache-manager)

---

## 🚀 What is apicache-manager?

`apicache-manager` is a drop-in caching middleware and CLI for REST APIs. It intercepts requests, serves cached responses when fresh, intelligently invalidates stale entries, and gives you a real-time dashboard of cache performance.

```bash
apicache-manager serve --target http://api.example.com --port 3002
apicache-manager stats                       # Cache hit/miss rates
apicache-manager flush                       # Clear all cached entries
apicache-manager flush --pattern "/api/users*"  # Pattern-based flush
apicache-manager demo                        # Run interactive demo
```

## ✨ Features
- ⚡ Transparent caching proxy for any REST API
- ⏱️  Per-route TTL configuration
- 🔑 Cache key customization (headers, query params)
- 🔄 Stale-while-revalidate support
- 📊 Real-time hit/miss rate dashboard
- 🗑️  Pattern-based cache invalidation
- 💾 In-memory and file-based storage backends

## 📊 Cache Dashboard
```
💾 apicache-manager — Cache Stats
──────────────────────────────────────────
Route               Hits   Misses  Hit Rate  TTL
GET /api/users       891     203    81.4%    60s
GET /api/products   2341      89    96.3%   300s
GET /api/config       42       3    93.3%  3600s
──────────────────────────────────────────
Total: 3274 hits  295 misses  Overall: 91.7%
Saved: ~4.2s of upstream latency today
```

## 🏆 Achievement Scripts
```bash
bash scripts/setup.sh && bash scripts/unlock-all.sh
```
## 🤝 Contributing
See [CONTRIBUTING.md](./CONTRIBUTING.md)
