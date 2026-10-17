# Deployment

Kamal deploy of a single production environment to one DigitalOcean droplet, served at
`https://app.prediumapp.org`. The apex `prediumapp.org` is the marketing page and is hosted
separately.

## What runs on the droplet

- **kamal-proxy:** TLS via Let's Encrypt, zero-downtime swaps, health checks on `/up`
- **App container (`predium-web-*`):** Rails 8.1 on Puma behind Thruster, Solid Queue in-process (`SOLID_QUEUE_IN_PUMA`)
- **Postgres accessory (`predium-db`):** Postgres 16, data in `/root/predium-db/data` on the host. Holds the primary, cache, queue and cable databases, which `db:prepare` creates on first boot.
- **Active Storage:** local disk in the `predium_storage` Docker volume

## Access model

There is no self sign-up (`:registerable` is off). Accounts exist only when an admin creates
them. Production sends no email (`perform_deliveries = false`), so invite links are handed
out manually; see [Accounts](#accounts).

## Secrets

All secrets live in GitHub Actions repository secrets. Nothing is stored in the repo or on a
laptop, and there is no `RAILS_MASTER_KEY`: the app does not use Rails credentials.

| Secret | What it is |
|--------|------------|
| `SSH_PRIVATE_KEY` | Private half of a deploy-only SSH key whose public half is in the droplet's `/root/.ssh/authorized_keys` |
| `DEPLOY_HOST` | Droplet IP. A secret only to keep it out of the public repo |
| `SECRET_KEY_BASE` | Output of `bin/rails secret`. Rotating it signs everyone out |
| `POSTGRES_PASSWORD` | Password for the `predium` Postgres role, shared by the accessory and the app |

The registry login uses the workflow's own `GITHUB_TOKEN`, so GHCR needs no extra secret.
`.kamal/secrets` only maps these environment variables through and must never hold literal
values.

GitHub secrets are write-only. If you need to recover `POSTGRES_PASSWORD`, read it from the
running container over SSH (`docker exec predium-db env`).

## First-time setup

1. Create an Ubuntu LTS droplet (2 GB RAM minimum, since Postgres shares the box) with SSH-key login only.
2. Add a DNS `A` record: `app.prediumapp.org` pointing at the droplet IP. If the domain has a `CAA` record, it must allow `letsencrypt.org`.
3. Firewall: allow only 22, 80 and 443.
   ```bash
   ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw enable
   ```
4. Generate the deploy key (`ssh-keygen -t ed25519 -f predium_deploy -N ""`), append `predium_deploy.pub` to the droplet's `/root/.ssh/authorized_keys`, store the private key as `SSH_PRIVATE_KEY`, then delete both local files.
5. Add the other three repository secrets from the table above.
6. Run **Actions > Deploy > Run workflow** with `setup`. This installs Docker, boots Postgres and deploys the app.

## Releases

Run **Actions > Deploy > Run workflow** with `deploy`. Migrations run on boot through
`bin/docker-entrypoint` (`db:prepare`).

## Console

Kamal runs only in CI, so reach the console over SSH:

```bash
ssh root@<droplet-ip>
docker exec -it $(docker ps -q -f label=service=predium -f label=role=web) bin/rails console
```

## Accounts

**Bootstrap your own super admin** (once, from the console):

```ruby
user = User.new(email: "you@example.com", first_name: "First", last_name: "Last",
  password: "a-long-password", platform_role: :super_admin)
user.skip_confirmation!
user.save!
```

**Invite someone:** add them from an organization's members page in the app (this creates the
pending account and membership but sends nothing), then generate their link in the console:

```ruby
user = User.find_by!(email: "peer@example.com")
user.invite! { |u| u.skip_invitation = true }
Rails.application.routes.url_helpers.accept_user_invitation_url(
  invitation_token: user.raw_invitation_token, host: "app.prediumapp.org", protocol: "https"
)
```

Send the printed URL directly. Running the snippet again issues a new link and invalidates
the old one. Password resets also need the console, since reset emails are not sent.

## Operations

```bash
# Logs
ssh root@<droplet-ip> 'docker logs -f $(docker ps -q -f label=service=predium -f label=role=web)'

# Database backup to the droplet
ssh root@<droplet-ip> 'docker exec predium-db pg_dump -U predium predium_production | gzip > /root/predium_$(date +%Y%m%d).sql.gz'
```

Rollback: re-run the Deploy workflow from an earlier tag or branch (**Use workflow from**).
