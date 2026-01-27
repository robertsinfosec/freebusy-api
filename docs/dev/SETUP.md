# Developer Setup Guide

Navigation: [Home](../../README.md) | [Contributing](../../CONTRIBUTING.md) | [Architecture](ARCHITECTURE.md) | [Testing](TESTING.md) | [Style Guide](../../STYLE_GUIDE.md)

Complete setup guide for developers working on the Freebusy API.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start (Dev Container)](#quick-start-dev-container)
- [Manual Setup](#manual-setup)
- [Verifying Installation](#verifying-installation)
- [Running the Application](#running-the-application)
- [Development Workflow](#development-workflow)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required

- **Node.js 20+** (check: `node --version`)
- **npm** (check: `npm --version`)
- **Git** (check: `git --version`)

### Optional but Recommended

- **VS Code** with Dev Containers extension
- **Docker** (for Dev Container)
- **Cloudflare account** with Workers enabled (for deployment)
- **Wrangler CLI** (installed via npm in project)

## Quick Start (Dev Container)

Recommended approach - Provides a consistent, isolated development environment.

### What is a Dev Container?

Instead of installing all dependencies on your workstation, VS Code opens this project in a Docker container with everything pre-configured. Your code stays on your machine, but executes in the container.

### Setup Steps

1. **Install prerequisites:**
   - [VS Code](https://code.visualstudio.com/)
   - [Docker Desktop](https://www.docker.com/products/docker-desktop/)
   - [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)

2. **Clone the repository:**

   ```bash
   git clone https://github.com/robertsinfosec/freebusy-api.git
   cd freebusy-api
   ```

3. **Open in VS Code:**

   ```bash
   code .
   ```

4. **Reopen in Container:**
   - VS Code will detect `.devcontainer/devcontainer.json`
   - Click **Reopen in Container** when prompted
   - Or: Command Palette (Ctrl+Shift+P) → **Dev Containers: Reopen in Container**

5. **Wait for setup:**
   - First time takes 2-5 minutes (downloads base image, installs dependencies)
   - Subsequent opens are much faster

6. **Verify:**

   ```bash
   # Inside the container terminal
   node --version       # Should show 20+
   npm --version
   npm --prefix src run check  # TypeScript check
   ```

### Dev Container Features

- ✅ Node.js 20+ pre-installed
- ✅ All dependencies installed
- ✅ Git configured
- ✅ Extensions pre-installed (ESLint, TypeScript, etc.)
- ✅ Isolated from your host system
- ✅ Consistent across all developers

## Manual Setup

If you prefer not to use Dev Containers:

### 1. Clone Repository

```bash
git clone https://github.com/robertsinfosec/freebusy-api.git
cd freebusy-api
```

### 2. Install Dependencies

```bash
# Navigate to src directory (where package.json lives)
cd src/

# Install dependencies
npm install
```

### 3. Set Up Local Secrets

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your local development values
# At minimum, set FREEBUSY_ICAL_URL to a test iCal feed
```

The `.env` file is used for local development only. It's copied to `.dev.vars` by the dev script for Wrangler.

> [!IMPORTANT]
> Never commit real secrets. The `.env` and `.dev.vars` files are git-ignored.

### 4. Verify Installation

```bash
# Type check
npm run check

# Run tests
npm test

# Lint
npm run lint
```

## Verifying Installation

### Check Package Installation

```bash
cd src/
npm list
# Should show all dependencies installed
```

### Run Basic Commands

```bash
# Type check
npm run check

# Tests
npm test

# Coverage
npm run test:coverage
```

## Running the Application

### Local Development Server

```bash
# From repo root
npm --prefix src run dev

# Or from src/ directory
cd src/
npm run dev
```

This starts Wrangler dev server on `http://localhost:8787`.

### Test the API

```bash
# Health check
curl http://localhost:8787/health

# Free/busy endpoint (requires CORS origin match)
curl -H "Origin: http://localhost:3000" http://localhost:8787/freebusy
```

### Environment Variables

Required for local development (set in `src/.env`):

```bash
FREEBUSY_ICAL_URL=https://your-calendar-provider.com/ical/freebusy.ics
RL_SALT=your_random_hex_salt_for_rate_limiting
CALENDAR_TIMEZONE=America/New_York
WINDOW_WEEKS=4
WORKING_HOURS_JSON={"weekly":[{"dayOfWeek":1,"start":"09:00","end":"17:00"}]}
CORS_ALLOWLIST=http://localhost:3000,https://your-site.pages.dev
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=10
```

Optional variables:

```bash
FREEBUSY_ENABLED=true
WEEK_START_DAY=1
CACHE_TTL_SECONDS=60
UPSTREAM_MAX_BYTES=1500000
RATE_LIMIT_GLOBAL_WINDOW_MS=60000
RATE_LIMIT_GLOBAL_MAX=100
```

See [README.md](../../README.md) for detailed configuration documentation.

## Development Workflow

### Typical Day-to-Day Flow

1. **Pull latest changes:**

   ```bash
   git pull origin main
   ```

2. **Create feature branch:**

   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make changes to code:**

   ```bash
   # Edit files in src/src/
   code src/src/freebusy.ts
   ```

4. **Test changes:**

   ```bash
   cd src/

   # Run tests
   npm test

   # Test specific file
   npm test -- freebusy.test.ts

   # Test with coverage
   npm run test:coverage
   ```

5. **Type check and lint:**

   ```bash
   npm run check
   npm run lint
   ```

6. **Run locally:**

   ```bash
   npm run dev
   # Test your changes at http://localhost:8787
   ```

7. **Commit changes:**

   ```bash
   git add .
   git commit -m "feat: Add new feature description"
   ```

   See [STYLE_GUIDE.md](../../STYLE_GUIDE.md) for commit message format.

8. **Push and create PR:**

   ```bash
   git push origin feature/your-feature-name
   # Open PR on GitHub
   ```

### Common Commands

```bash
# From repo root (recommended)
npm --prefix src install          # Install dependencies
npm --prefix src run check        # Type check
npm --prefix src run lint         # Lint
npm --prefix src test             # Run tests
npm --prefix src run test:coverage # Coverage report
npm --prefix src run dev          # Dev server
npm --prefix src run deploy       # Deploy to Cloudflare

# From src/ directory
npm install
npm run check
npm run lint
npm test
npm run test:coverage
npm run dev
npm run deploy
```

## Deployment

### Prerequisites

- Cloudflare account with Workers + Durable Objects enabled
- Wrangler authenticated: `npx wrangler login`
- Secrets configured (see below)

### Set Secrets

Secrets are set via Wrangler and never committed to the repository:

```bash
cd src/

# Required secrets
npx wrangler secret put FREEBUSY_ICAL_URL
npx wrangler secret put RL_SALT

# Other required env vars (set in wrangler.toml or as secrets)
# CALENDAR_TIMEZONE, WINDOW_WEEKS, WORKING_HOURS_JSON, CORS_ALLOWLIST,
# RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX
```

> [!TIP]
> Generate a secure salt: `openssl rand -hex 32`

### Deploy to Cloudflare

```bash
# From repo root
npm --prefix src run deploy

# Or from src/
cd src/
npm run deploy
```

### Verify Deployment

```bash
# Test your deployed worker
curl https://your-worker.your-subdomain.workers.dev/health

# Should return: {"ok":true}
```

### Rollback

To rollback to a previous version:

1. Find previous deployment in Cloudflare dashboard
2. Or redeploy from previous git commit:

   ```bash
   git checkout <previous-commit>
   npm --prefix src run deploy
   git checkout main
   ```

### Environment Configuration

For production deployment, set all required environment variables either:

1. **Via secrets:** `npx wrangler secret put <NAME>`
2. **Via wrangler.toml:** For non-sensitive values

See `src/wrangler.toml` for binding configuration (RATE_LIMITER Durable Object).

## Troubleshooting

### Common Development Issues

#### "Module not found" Errors

**Problem:** Import errors or module not found.

**Solutions:**

1. Ensure you're in the correct directory:

   ```bash
   cd src/
   npm install
   ```

2. Clear node_modules and reinstall:

   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

3. Check Node version (must be 20+):

   ```bash
   node --version
   ```

#### Tests Failing

**Problem:** Tests fail with import or setup errors.

**Solutions:**

1. Run tests from repo root using npm prefix:

   ```bash
   npm --prefix src test
   ```

2. Clear Vitest cache:

   ```bash
   cd src/
   rm -rf node_modules/.vite
   npm test
   ```

3. Verify all dependencies installed:

   ```bash
   npm install
   ```

See [Testing Guide](TESTING.md) for detailed testing information.

#### Dev Container Issues

**Problem:** Dev Container won't build or start.

**Solutions:**

1. **Rebuild container:**
   - Command Palette → **Dev Containers: Rebuild Container**

2. **Check Docker is running:**

   ```bash
   docker ps
   ```

3. **Check Docker resources:**
   - Docker Desktop → Settings → Resources
   - Increase memory to 4GB+ if needed

4. **Clear Docker cache:**

   ```bash
   docker system prune -a
   ```

#### Wrangler Authentication Issues

**Problem:** Can't deploy or access Cloudflare.

**Solutions:**

1. **Login to Wrangler:**

   ```bash
   cd src/
   npx wrangler login
   ```

2. **Verify authentication:**

   ```bash
   npx wrangler whoami
   ```

3. **Check Cloudflare account:**
   - Ensure Workers are enabled
   - Ensure Durable Objects are enabled

#### TypeScript Errors

**Problem:** Type errors in editor or during build.

**Solutions:**

1. **Restart TypeScript server:**
   - VS Code: Command Palette → **TypeScript: Restart TS Server**

2. **Check tsconfig.json:**
   - Ensure `src/tsconfig.json` exists and is valid

3. **Clear editor cache:**
   - Close and reopen VS Code

#### Rate Limit Testing

**Problem:** Can't test rate limiting locally.

**Solutions:**

1. Set low limits in `.env`:

   ```bash
   RATE_LIMIT_MAX=2
   RATE_LIMIT_WINDOW_MS=10000
   ```

2. Make multiple rapid requests:

   ```bash
   for i in {1..5}; do curl http://localhost:8787/freebusy; echo; done
   ```

3. Check Durable Object logs in Wrangler output

### Production Issues

#### Elevated 5xx Errors

**Symptom:** High rate of server errors.

**Diagnosis:**

1. Check Cloudflare Dashboard logs for `upstream` or `parse` errors
2. Validate upstream iCal URL is reachable (from safe environment)
3. Check upstream response time and payload size

**Remediation:**

- If upstream is flaky: increase `CACHE_TTL_SECONDS` temporarily
- If persistent: disable via `FREEBUSY_ENABLED=false` while investigating
- If malformed iCal: coordinate with upstream provider to fix format

#### Unexpected 4xx Surge (403/429)

**Symptom:** Sudden increase in client errors.

**Diagnosis:**

1. **For 403 (Forbidden):**
   - Verify `CORS_ALLOWLIST` matches actual client origins
   - Check request headers (`Origin` must be in allowlist)
   - Review recent CORS config changes

2. **For 429 (Rate Limited):**
   - Check if legitimate traffic increased
   - Verify `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW_MS` are appropriate
   - Check for suspicious patterns in request logs

**Remediation:**

- **403:** Update `CORS_ALLOWLIST` if legitimate origin
- **429:** Adjust rate limits if traffic is legitimate, or tighten if abuse detected

#### Suspected Abuse

**Symptom:** Unusual traffic patterns, suspicious origins, or coordinated attacks.

**Response:**

1. **Immediate:**
   - Tighten rate limits (lower `RATE_LIMIT_MAX`)
   - Remove suspicious origins from `CORS_ALLOWLIST`
   - Enable global rate limiting (set `RATE_LIMIT_GLOBAL_MAX` + `RATE_LIMIT_GLOBAL_WINDOW_MS`)

2. **Monitor:**
   - Watch for continued abuse patterns
   - Check Cloudflare Analytics for geographic patterns
   - Review request patterns in logs

3. **Long-term:**
   - Consider implementing Cloudflare Turnstile
   - Add signed nonce requirement
   - Coordinate with Cloudflare support for DDoS protection

#### High Latency

**Symptom:** p95 latency above normal thresholds.

**Diagnosis:**

1. Check Cloudflare Analytics for latency breakdown
2. Review upstream iCal response times
3. Check payload size (large calendars take longer to parse)
4. Check Durable Object performance metrics

**Remediation:**

- Increase `CACHE_TTL_SECONDS` to reduce upstream fetches
- Add `UPSTREAM_MAX_BYTES` limit if not set
- Review iCal parsing performance (consider upstream format changes)

### Secret Rotation

#### Rotating RL_SALT

The `RL_SALT` is used to hash IP addresses for rate limiting. Rotation invalidates all existing rate limit state.

**When to rotate:**

- Suspected compromise
- Routine security hygiene (e.g., annually)
- Personnel changes

**How to rotate:**

1. **Generate new salt:**

   ```bash
   openssl rand -hex 32
   ```

2. **Update secret:**

   ```bash
   cd src/
   wrangler secret put RL_SALT
   # Paste new salt value
   ```

3. **Redeploy:**

   ```bash
   npm run deploy
   ```

4. **Verify:**

   ```bash
   curl -H "Origin: https://allowed-origin.com" https://your-worker.workers.dev/health
   # Should return: {"ok":true}
   ```

**Impact:** All existing rate limit counters are reset (clients start fresh).

#### Rotating FREEBUSY_ICAL_URL

**When to rotate:**

- Upstream iCal URL changed
- Switching calendar providers
- Security incident

**How to rotate:**

1. **Verify new URL:**

   ```bash
   curl -I https://new-ical-url.example.com/calendar.ics
   # Check for 200 OK and Content-Type: text/calendar
   ```

2. **Update secret:**

   ```bash
   cd src/
   wrangler secret put FREEBUSY_ICAL_URL
   # Paste new URL
   ```

3. **Redeploy:**

   ```bash
   npm run deploy
   ```

4. **Verify:**

   ```bash
   curl -H "Origin: https://allowed-origin.com" https://your-worker.workers.dev/freebusy
   # Should return busy intervals
   ```

**Impact:** Immediate switch to new calendar source (existing cache expires per `CACHE_TTL_SECONDS`).

### Getting Help

For setup and operational issues:

1. Check [Contributing Guide](../../CONTRIBUTING.md)
2. Check [Testing Guide](TESTING.md) if test-related
3. Check [Architecture Guide](ARCHITECTURE.md) for code structure
4. Check [Style Guide](../../STYLE_GUIDE.md) for coding standards
5. 🐛 [Report bugs](https://github.com/robertsinfosec/freebusy-api/issues)
6. 💬 [Ask in Discussions](https://github.com/robertsinfosec/freebusy-api/discussions)
