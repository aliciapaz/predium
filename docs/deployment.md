# Deployment

Kamal deploy of a single production environment to one DigitalOcean droplet, served at
`https://app.prediumapp.org`. The apex `prediumapp.org` is the marketing page, served by
GitHub Pages from the `gh-pages` branch.

There is no self sign-up (`:registerable` is off) and production sends no email
(`perform_deliveries = false`), so accounts exist only when an admin creates them and invite
links are handed out manually; see [Accounts](#accounts).

## Releases

Run **Actions > Deploy > Run workflow** with `deploy`. Migrations run on boot through
`bin/docker-entrypoint` (`db:prepare`).

Rollback: re-run the Deploy workflow from an earlier tag or branch (**Use workflow from**).

## Console

Kamal runs only in CI, so reach the console over SSH:

```bash
ssh root@<droplet-ip>
docker exec -it $(docker ps -q -f label=service=predium -f label=role=web) bin/rails console
```

## Accounts

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

## Secrets

All secrets live in GitHub Actions repository secrets. Nothing is stored in the repo or on a
laptop, and there is no `RAILS_MASTER_KEY`: the app does not use Rails credentials.

| Secret | What it is |
|--------|------------|
| `SSH_PRIVATE_KEY` | Private half of a deploy-only SSH key whose public half is in the droplet's `/root/.ssh/authorized_keys` |
| `DEPLOY_HOST` | Droplet IP. A secret only to keep it out of the public repo |
| `SECRET_KEY_BASE` | Output of `bin/rails secret`. Rotating it signs everyone out |
| `POSTGRES_PASSWORD` | Password for the `predium` Postgres role, shared by the accessory and the app |
| `R2_ACCOUNT_ID` | Cloudflare account ID, the subdomain of the R2 S3 endpoint |
| `R2_ACCESS_KEY_ID` | Access key of the R2 API token scoped to the `predium-production` bucket |
| `R2_SECRET_ACCESS_KEY` | Secret of that same token |

The registry login uses the workflow's own `GITHUB_TOKEN`, so GHCR needs no extra secret.
`.kamal/secrets` only maps these environment variables through and must never hold literal
values.

GitHub secrets are write-only. If you need to recover `POSTGRES_PASSWORD`, read it from the
running container over SSH (`docker exec predium-db env`).

## What runs on the droplet

- **kamal-proxy:** TLS via Let's Encrypt, zero-downtime swaps, health checks on `/up`
- **App container (`predium-web-*`):** Rails 8.1 on Puma behind Thruster, Solid Queue in-process (`SOLID_QUEUE_IN_PUMA`)
- **Postgres accessory (`predium-db`):** Postgres 16, data in `/root/predium-db/data` on the host. Holds the primary, cache, queue and cable databases, which `db:prepare` creates on first boot.
- **Active Storage:** not on the droplet; uploads go to the `predium-production` Cloudflare R2 bucket (see [File storage](#file-storage))

## File storage

Attachments (form photos, generated PDFs) live in Cloudflare R2, so losing the droplet does not
lose them. The bucket is private: Rails hands out short-lived signed URLs.

To recreate it:

1. In the Cloudflare dashboard, **R2 > Create bucket** named `predium-production`. Leave public access off.
2. **R2 > Manage API tokens > Create API token** with **Object Read & Write**, scoped to that bucket only.
3. Store the token's Access Key ID and Secret Access Key as `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`, and the account ID shown on the R2 overview page as `R2_ACCOUNT_ID`.
4. Make sure `.kamal/secrets` maps all three (`R2_ACCOUNT_ID=$R2_ACCOUNT_ID`, and so on), or Kamal will not pass them to the app.
5. After deploying, confirm the app can reach the bucket from the console:

   ```ruby
   blob = ActiveStorage::Blob.create_and_upload!(io: StringIO.new("ok"), filename: "r2-check.txt")
   blob.download # => "ok"
   blob.purge
   ```

Browser direct uploads would also need a CORS rule on the bucket allowing `PUT` from
`https://app.prediumapp.org`. Nothing uses them yet.

## Rebuilding the server

The current droplet is Ubuntu 26.04 LTS, Regular 2 GB / 1 vCPU, in NYC3. To recreate it:

1. Create the droplet with SSH-key login only, IPv4 only and monitoring on. Do not go below 2 GB: the app and Postgres share the box.
2. Attach a DigitalOcean Cloud Firewall allowing inbound TCP 22, 80 and 443 from all IPv4. Use it instead of `ufw`, which Docker bypasses for published ports. SSH stays open to all sources because GitHub's runner IPs change; key-only login protects it. Port 80 must stay open for Let's Encrypt renewals.
3. Point the `app.prediumapp.org` `A` record at the new IP and update `DEPLOY_HOST`.
4. Generate a new deploy key, append its public half to `/root/.ssh/authorized_keys`, and replace `SSH_PRIVATE_KEY` with the private half.
5. Run **Actions > Deploy > Run workflow** with `setup`. This installs Docker, boots Postgres and deploys the app.
6. On a fresh database, create the first super admin from the console:

   ```ruby
   user = User.new(email: "you@example.com", first_name: "First", last_name: "Last",
     password: "a-long-password", platform_role: :super_admin)
   user.skip_confirmation!
   user.save!
   ```
