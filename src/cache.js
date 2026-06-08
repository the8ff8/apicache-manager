#!/usr/bin/env node
// 💾 apicache-manager — Smart API Response Caching Layer

const http   = require('http');
const https  = require('https');
const { URL } = require('url');

const GREEN  = '\x1b[32m'; const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m'; const CYAN   = '\x1b[36m';
const BOLD   = '\x1b[1m';  const DIM    = '\x1b[2m';
const NC     = '\x1b[0m';

// ── Cache store ───────────────────────────────────────────
class CacheStore {
  constructor() {
    this.store    = new Map();
    this.stats    = { hits: 0, misses: 0, sets: 0, evictions: 0 };
    this.routeTTLs = {
      '/api/config':   3600,
      '/api/products': 300,
      '/api/users':    60,
      '/api/auth':     0,    // never cache
    };
  }

  getTTL(path) {
    for (const [pattern, ttl] of Object.entries(this.routeTTLs)) {
      if (path.startsWith(pattern)) return ttl;
    }
    return 30; // default 30s
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) { this.stats.misses++; return null; }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.stats.misses++;
      this.stats.evictions++;
      return null;
    }
    this.stats.hits++;
    entry.hits++;
    return entry;
  }

  set(key, value, ttlSeconds) {
    if (ttlSeconds <= 0) return;
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
      cachedAt:  new Date().toISOString(),
      hits:      0,
      ttl:       ttlSeconds,
    });
    this.stats.sets++;
  }

  flush(pattern = null) {
    if (!pattern) { const n = this.store.size; this.store.clear(); return n; }
    let n = 0;
    for (const key of this.store.keys()) {
      if (key.includes(pattern)) { this.store.delete(key); n++; }
    }
    return n;
  }

  hitRate() {
    const total = this.stats.hits + this.stats.misses;
    return total ? ((this.stats.hits / total) * 100).toFixed(1) : '0.0';
  }

  dashboard() {
    const routes = {};
    for (const [key, entry] of this.store.entries()) {
      const route = key.split(':')[0];
      if (!routes[route]) routes[route] = { hits: 0, cached: 0 };
      routes[route].hits   += entry.hits;
      routes[route].cached++;
    }

    console.log(`\n${CYAN}${BOLD}💾 apicache-manager — Cache Dashboard${NC}\n`);
    console.log('─'.repeat(65));
    console.log(`${BOLD}${'Route'.padEnd(30)} ${'Hits'.padEnd(8)} ${'TTL'.padEnd(8)} Status${NC}`);
    console.log('─'.repeat(65));

    for (const [route, info] of Object.entries(routes)) {
      const ttl = this.getTTL(route);
      console.log(`${route.padEnd(30)} ${String(info.hits).padEnd(8)} ${String(ttl+'s').padEnd(8)} ${GREEN}cached${NC}`);
    }

    const totalReq = this.stats.hits + this.stats.misses;
    console.log('─'.repeat(65));
    console.log(`\n  ${BOLD}Hits:${NC}     ${GREEN}${this.stats.hits}${NC}`);
    console.log(`  ${BOLD}Misses:${NC}   ${YELLOW}${this.stats.misses}${NC}`);
    console.log(`  ${BOLD}Hit Rate:${NC} ${GREEN}${this.hitRate()}%${NC}`);
    console.log(`  ${BOLD}Cached:${NC}   ${this.store.size} entries\n`);
  }
}

// ── Proxy server ──────────────────────────────────────────
function startProxy(targetUrl, port = 3002, cache) {
  const target = new URL(targetUrl);

  const server = http.createServer((req, res) => {
    const start   = Date.now();
    const cacheKey = `${req.url}:${req.method}`;
    const ttl      = cache.getTTL(req.url);

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Cache-Manager', 'apicache-manager/1.0');

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    // Only cache GET requests
    if (req.method === 'GET' && ttl > 0) {
      const cached = cache.get(cacheKey);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-TTL', Math.round((cached.expiresAt - Date.now()) / 1000) + 's');
        res.writeHead(200);
        res.end(cached.value);
        const ms = Date.now() - start;
        console.log(`${GREEN}HIT   ${NC} ${req.url.padEnd(35)} ${DIM}[${ms}ms] ${GREEN}← cache${NC}`);
        return;
      }
    }

    // Forward to target
    const opts = {
      hostname: target.hostname,
      port:     target.port || 80,
      path:     req.url,
      method:   req.method,
      headers:  { ...req.headers, host: target.hostname },
    };

    const lib     = target.protocol === 'https:' ? https : http;
    const proxyReq = lib.request(opts, (proxyRes) => {
      let body = '';
      proxyRes.on('data', c => body += c);
      proxyRes.on('end', () => {
        if (req.method === 'GET' && proxyRes.statusCode === 200 && ttl > 0) {
          cache.set(cacheKey, body, ttl);
          res.setHeader('X-Cache', 'MISS');
        }
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        res.end(body);
        const ms = Date.now() - start;
        console.log(`${YELLOW}MISS  ${NC} ${req.url.padEnd(35)} ${DIM}[${ms}ms] → upstream${NC}`);
      });
    });

    proxyReq.on('error', (e) => {
      res.writeHead(502);
      res.end(JSON.stringify({ error: 'Upstream error', detail: e.message }));
    });
    req.pipe(proxyReq);
  });

  server.listen(port, () => {
    console.log(`\n${CYAN}${BOLD}💾 apicache-manager${NC}`);
    console.log(`${GREEN}Proxy:${NC}  http://localhost:${port}`);
    console.log(`${GREEN}Target:${NC} ${targetUrl}`);
    console.log(`${DIM}Route TTLs configured. Ctrl+C to stop.\n${NC}`);
    console.log('─'.repeat(55));
  });

  return server;
}

function runDemo() {
  const cache = new CacheStore();

  // Simulate some cache activity
  const routes = ['/api/users', '/api/products', '/api/config', '/api/users/42'];
  routes.forEach((route, i) => {
    const ttl = cache.getTTL(route);
    if (ttl > 0) cache.set(route + ':GET', JSON.stringify({ data: `mock-${i}` }), ttl);
  });

  // Simulate hits and misses
  for (let i = 0; i < 891;  i++) cache.get('/api/users:GET');
  for (let i = 0; i < 2341; i++) cache.get('/api/products:GET');
  for (let i = 0; i < 42;   i++) cache.get('/api/config:GET');
  for (let i = 0; i < 203;  i++) { cache.stats.misses += 1; }

  cache.dashboard();
}

const args   = process.argv.slice(2);
const cmd    = args[0] || 'demo';
const target = args[1];
const port   = parseInt(args[args.indexOf('--port') + 1]) || 3002;
const cache  = new CacheStore();

console.log(`\n${CYAN}${BOLD}💾 apicache-manager${NC}\n`);

if (cmd === 'demo') {
  runDemo();
} else if (cmd === 'serve' && target) {
  startProxy(target, port, cache);
} else if (cmd === 'stats') {
  cache.dashboard();
} else if (cmd === 'flush') {
  const pattern = args[args.indexOf('--pattern') + 1];
  const n = cache.flush(pattern);
  console.log(`${GREEN}✅ Flushed ${n} cache entries${NC}\n`);
} else {
  console.log(`Usage:`);
  console.log(`  node src/cache.js demo`);
  console.log(`  node src/cache.js serve http://api.example.com --port 3002`);
  console.log(`  node src/cache.js stats`);
  console.log(`  node src/cache.js flush`);
  console.log(`  node src/cache.js flush --pattern "/api/users"\n`);
}
