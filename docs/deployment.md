# Deployment

> Predium v2 — Kamal deployment to DigitalOcean.

---

## Infrastructure Overview

```
┌─────────────────────────────────────────────┐
│  DigitalOcean Droplet                       │
│                                             │
│  ┌─────────────┐  ┌──────────────────────┐  │
│  │  PostgreSQL  │  │  App Container       │  │
│  │  (managed or │  │  ├─ Rails (Puma)     │  │
│  │   local)     │  │  ├─ Solid Queue      │  │
│  │             │  │  └─ Solid Cache      │  │
│  └─────────────┘  └──────────────────────┘  │
│                                             │
│  ┌──────────────────────┐                   │
│  │  Kamal Proxy         │                   │
│  │  (SSL termination,   │                   │
│  │   zero-downtime)     │                   │
│  └──────────────────────┘                   │
└─────────────────────────────────────────────┘
```

**Components:**
- **App server:** Rails 8.1 running on Puma inside a Docker container
- **Database:** PostgreSQL 16 (DigitalOcean Managed Database or local install)
- **Background jobs:** Solid Queue (runs in the same container or a separate process)
- **Caching:** Solid Cache (database-backed, no Redis)
- **Proxy:** Kamal Proxy handles SSL termination, zero-downtime deploys, and request routing
- **Node.js:** Required in the container for `vl2png` (Vega-Lite chart → PNG for PDFs)

---

## Dockerfile

Multi-stage build for minimal production image.

```dockerfile
# syntax=docker/dockerfile:1
ARG RUBY_VERSION=3.3
ARG NODE_VERSION=22

# Stage 1: Base
FROM docker.io/library/ruby:$RUBY_VERSION-slim AS base
WORKDIR /rails
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
    curl \
    libjemalloc2 \
    libvips \
    postgresql-client && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives
ENV RAILS_ENV="production" \
    BUNDLE_DEPLOYMENT="1" \
    BUNDLE_PATH="/usr/local/bundle" \
    BUNDLE_WITHOUT="development:test"

# Stage 2: Build
FROM base AS build
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
    build-essential \
    git \
    libpq-dev \
    pkg-config && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

# Install Node.js for vl2png
RUN curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - && \
    apt-get install --no-install-recommends -y nodejs && \
    npm install -g vega-lite vega-cli

COPY Gemfile Gemfile.lock ./
RUN bundle install && \
    rm -rf ~/.bundle/ "${BUNDLE_PATH}"/ruby/*/cache \
    "${BUNDLE_PATH}"/ruby/*/bundler/gems/*/.git && \
    bundle exec bootsnap precompile --gemfile

COPY . .
RUN bundle exec bootsnap precompile app/ lib/ && \
    SECRET_KEY_BASE_DUMMY=1 ./bin/rails assets:precompile

# Stage 3: Production
FROM base AS production

# Install Node.js runtime for vl2png
RUN curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - && \
    apt-get install --no-install-recommends -y nodejs && \
    npm install -g vega-lite vega-cli && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

COPY --from=build "${BUNDLE_PATH}" "${BUNDLE_PATH}"
COPY --from=build /rails /rails

RUN groupadd --system --gid 1000 rails && \
    useradd rails --uid 1000 --gid 1000 --create-home --shell /bin/bash && \
    chown -R rails:rails db log storage tmp
USER 1000:1000

ENTRYPOINT ["/rails/bin/docker-entrypoint"]
EXPOSE 3000
CMD ["./bin/rails", "server"]
```

---

## Kamal Configuration

### `config/deploy.yml`

```yaml
service: predium

image: your-registry/predium

servers:
  web:
    hosts:
      - YOUR_DROPLET_IP
    labels:
      traefik.http.routers.predium.rule: Host(`predium.cl`)
    options:
      memory: 512m

proxy:
  ssl: true
  host: predium.cl

registry:
  server: ghcr.io
  username:
    - KAMAL_REGISTRY_USERNAME
  password:
    - KAMAL_REGISTRY_PASSWORD

builder:
  arch: amd64

env:
  clear:
    RAILS_ENV: production
    RAILS_LOG_TO_STDOUT: "1"
    RAILS_SERVE_STATIC_FILES: "1"
    SOLID_QUEUE_IN_PUMA: "1"
  secret:
    - RAILS_MASTER_KEY
    - DATABASE_URL
    - SECRET_KEY_BASE

volumes:
  - "predium_storage:/rails/storage"

asset_path: /rails/public/assets

readiness_delay: 5

accessories:
  db:
    image: postgres:16
    host: YOUR_DROPLET_IP
    port: "127.0.0.1:5432:5432"
    env:
      clear:
        POSTGRES_DB: predium_production
      secret:
        - POSTGRES_USER
        - POSTGRES_PASSWORD
    directories:
      - data:/var/lib/postgresql/data
    volumes:
      - "predium_db:/var/lib/postgresql/data"
```

**Notes:**
- `SOLID_QUEUE_IN_PUMA: "1"` runs Solid Queue within the Puma process (suitable for single-server deploys)
- For higher volume, run Solid Queue as a separate container using Kamal's `servers` config
- The `db` accessory can be removed if using DigitalOcean Managed PostgreSQL

### `.kamal/secrets`

```bash
KAMAL_REGISTRY_USERNAME=your-github-username
KAMAL_REGISTRY_PASSWORD=your-ghcr-token
RAILS_MASTER_KEY=$(cat config/master.key)
DATABASE_URL=postgres://predium:password@localhost:5432/predium_production
SECRET_KEY_BASE=$(bin/rails secret)
POSTGRES_USER=predium
POSTGRES_PASSWORD=secure-password-here
```

---

## DigitalOcean Setup

### Droplet Specifications

| Spec | Recommended |
|------|-------------|
| Size | 2 GB RAM / 1 vCPU (minimum); 4 GB / 2 vCPU (recommended) |
| OS | Ubuntu 24.04 LTS |
| Region | Choose closest to primary user base |
| Storage | 50 GB SSD |

### Initial Server Setup

```bash
# 1. SSH into droplet
ssh root@YOUR_DROPLET_IP

# 2. Create deploy user
adduser deploy
usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy

# 3. Install Docker
curl -fsSL https://get.docker.com | sh
usermod -aG docker deploy

# 4. Configure firewall
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### Database Option A: Local PostgreSQL (via Kamal accessory)

Defined in `config/deploy.yml` as an accessory (see above). Data persists in a Docker volume.

### Database Option B: DigitalOcean Managed Database

- Create a Managed PostgreSQL cluster in the DO console
- Set `DATABASE_URL` to the connection string provided by DO
- Remove the `db` accessory from `config/deploy.yml`
- Benefits: automated backups, failover, no maintenance

---

## SSL via Let's Encrypt

Kamal Proxy handles SSL automatically:

1. Set `proxy.ssl: true` and `proxy.host: predium.cl` in `config/deploy.yml`
2. Ensure DNS A record points `predium.cl` to the droplet IP
3. On first deploy, Kamal Proxy requests a Let's Encrypt certificate
4. Certificate auto-renews before expiration

No manual certbot configuration needed.

---

## Solid Queue Configuration

### `config/solid_queue.yml`

```yaml
default: &default
  dispatchers:
    - polling_interval: 1
      batch_size: 500
  workers:
    - queues: "*"
      threads: 3
      processes: 1
      polling_interval: 0.1

development:
  <<: *default

production:
  <<: *default
  workers:
    - queues: "*"
      threads: 5
      processes: 1
      polling_interval: 0.1
```

### Queue Usage

| Job | Queue | Notes |
|-----|-------|-------|
| `PdfGenerationJob` | `default` | Generates diagnosis PDF via Prawn |
| `FormSyncJob` | `default` | Processes offline form payloads received from client sync |
| Devise emails | `default` | Confirmation, reset, invitation emails |

All jobs use the `default` queue. Separate queues added only if priority differentiation is needed.

---

## CI/CD with GitHub Actions

### `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: predium_test
          POSTGRES_PASSWORD: password
          POSTGRES_DB: predium_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    env:
      RAILS_ENV: test
      DATABASE_URL: postgres://predium_test:password@localhost:5432/predium_test

    steps:
      - uses: actions/checkout@v4

      - uses: ruby/setup-ruby@v1
        with:
          bundler-cache: true

      - name: Setup database
        run: bin/rails db:schema:load

      - name: Run tests
        run: bundle exec rspec --format documentation

      - name: Upload coverage
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage/

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ruby/setup-ruby@v1
        with:
          bundler-cache: true
      - run: bundle exec rubocop

  deploy:
    needs: [test, lint]
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: ruby/setup-ruby@v1
        with:
          bundler-cache: true

      - uses: webfactory/ssh-agent@v0.9.0
        with:
          ssh-private-key: ${{ secrets.SSH_PRIVATE_KEY }}

      - name: Deploy with Kamal
        env:
          KAMAL_REGISTRY_USERNAME: ${{ github.actor }}
          KAMAL_REGISTRY_PASSWORD: ${{ secrets.GITHUB_TOKEN }}
          RAILS_MASTER_KEY: ${{ secrets.RAILS_MASTER_KEY }}
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          SECRET_KEY_BASE: ${{ secrets.SECRET_KEY_BASE }}
        run: |
          gem install kamal
          kamal deploy
```

---

## Environment Variables

### Required in Production

| Variable | Description | Where Set |
|----------|-------------|-----------|
| `RAILS_MASTER_KEY` | Decrypts `config/credentials.yml.enc` | `.kamal/secrets` + GitHub Secrets |
| `DATABASE_URL` | PostgreSQL connection string | `.kamal/secrets` + GitHub Secrets |
| `SECRET_KEY_BASE` | Rails session/cookie signing | `.kamal/secrets` + GitHub Secrets |
| `RAILS_ENV` | Environment name | `config/deploy.yml` (clear) |
| `RAILS_LOG_TO_STDOUT` | Log to stdout for Docker | `config/deploy.yml` (clear) |
| `RAILS_SERVE_STATIC_FILES` | Serve assets from Rails | `config/deploy.yml` (clear) |
| `SOLID_QUEUE_IN_PUMA` | Run queue in Puma process | `config/deploy.yml` (clear) |

### Rails Credentials

Sensitive config stored in `config/credentials.yml.enc` (encrypted, checked into git):

```yaml
# config/credentials.yml.enc (decrypted view)
# Edit with: bin/rails credentials:edit

secret_key_base: <generated>
```

No external API keys needed for v2.0. Future additions (e.g., email service, error tracking) go here.

---

## Deployment Commands

```bash
# First deploy (sets up server, proxy, accessories)
kamal setup

# Subsequent deploys
kamal deploy

# View logs
kamal app logs

# Rails console on production
kamal app exec "bin/rails console"

# Run migrations
kamal app exec "bin/rails db:migrate"

# Rollback to previous version
kamal rollback

# Check app status
kamal details
```

---

## Monitoring and Maintenance

### Logs

- Application logs: `kamal app logs` (stdout from Puma)
- Solid Queue logs: included in app logs (runs in-process)
- PostgreSQL logs: `kamal accessory logs db` (if using local PG)

### Backups

- **Managed DB:** Automated daily backups by DigitalOcean
- **Local DB:** Set up a cron job on the droplet:

```bash
# /home/deploy/backup.sh
#!/bin/bash
docker exec predium-db-1 pg_dump -U predium predium_production | \
  gzip > /home/deploy/backups/predium_$(date +%Y%m%d_%H%M%S).sql.gz

# Keep last 30 days
find /home/deploy/backups -name "*.sql.gz" -mtime +30 -delete
```

### Health Checks

- Kamal Proxy performs health checks on the app container (`/up` endpoint)
- Configure monitoring (e.g., UptimeRobot) for `https://predium.cl/up`

### Storage

- Active Storage files stored in `predium_storage` Docker volume
- For production, consider DigitalOcean Spaces (S3-compatible) for scalable file storage
- Configure via `config/storage.yml`:

```yaml
production:
  service: Disk  # or :s3_compatible for DO Spaces
  root: <%= Rails.root.join("storage") %>
```
