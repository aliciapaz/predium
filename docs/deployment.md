# Deployment

Kamal deploy of a single production environment to one DigitalOcean droplet, served at
`https://app.prediumapp.org`. The apex `prediumapp.org` is the marketing page, served by
GitHub Pages from the `gh-pages` branch.

There is no self sign-up (`:registerable` is off), so accounts exist only when an admin
creates them. Invite and password-reset emails go out through Resend when the
`RESEND_API_KEY` secret is set; without it production sends nothing and links come from the
console. See [Accounts](#accounts) and [Email](#email).

## Releases

Run **Actions > Deploy > Run workflow** with `deploy`. Migrations run on boot through
`bin/docker-entrypoint` (`db:prepare`).

Rollback: re-run the Deploy workflow from an earlier tag or branch (**Use workflow from**).

If a deploy fails with `kamal-proxy version ... is too old` (a Kamal gem upgrade raised the
minimum proxy version), run the workflow with `proxy reboot -y`, then `deploy` again. The
reboot drops traffic for a few seconds while the proxy restarts.

## Console

Kamal runs only in CI, so reach the console over SSH:

```bash
ssh root@<droplet-ip>
docker exec -it $(docker ps -q -f label=service=predium -f label=role=web) bin/rails console
```

## Accounts

**Invite someone:** add them from an organization's members page in the app. This creates the
pending account and membership and emails the invite. Org admins reach the members page from the **Organización** tab; super admins open the
organization under **Admin > Organizations** and click **Miembros**, without needing to join it.

If email is off (no `RESEND_API_KEY`), generate the link in the console instead:

```ruby
user = User.find_by!(email: "peer@example.com")
user.invite! { |u| u.skip_invitation = true }
Rails.application.routes.url_helpers.accept_user_invitation_url(
  invitation_token: user.raw_invitation_token, host: "app.prediumapp.org", protocol: "https"
)
```

Send the printed URL directly. Running the snippet again issues a new link and invalidates
the old one. Without email, password resets also need the console.

## Email

Mail goes through [Resend](https://resend.com) over SMTP from `Predium <hola@prediumapp.org>`
(set in `ApplicationMailer`; Devise inherits it through `parent_mailer`). The free tier
(3,000 emails a month, 100 a day) covers invite and password-reset volume. Do not
self-host a mail server on the droplet: a new IP has no sending reputation, so mail lands in
spam, and DigitalOcean blocks outbound ports 25, 465 and 587 by default (which is why the app
uses Resend's alternate port 2587). Amazon SES is the cheaper option at
scale but needs more setup (AWS account, sandbox exit); Postmark is the upgrade if
deliverability becomes a problem.

To turn it on:

1. Add `prediumapp.org` in Resend (region São Paulo, Return-Path `send`, tracking off) and
   create the records it lists under Namecheap **Advanced DNS > Host Records**: the
   `resend._domainkey` TXT, the `rsend` and `send` CNAMEs, and the `_dmarc` TXT. None of them
   is an MX record, so Mail Settings stay as they are and Namecheap's email forwarding keeps
   working; forward `hola@` to a real inbox there to receive replies. Leave Resend's
   receiving off.
2. Create a sending-only API key in Resend and save it as the `RESEND_API_KEY` GitHub Actions
   secret. It reaches the app through the Kamal secrets file and `env.secret` in
   `config/deploy.yml`.
3. Deploy. `perform_deliveries` turns on when the key is present.

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
| `RESEND_API_KEY` | Optional. Sending-only Resend API key; when it is set, the app sends email (see [Email](#email)) |

The registry login uses the workflow's own `GITHUB_TOKEN`, so GHCR needs no extra secret.
`.kamal/secrets` only maps these environment variables through and must never hold literal
values.

GitHub secrets are write-only. If you need to recover `POSTGRES_PASSWORD`, read it from the
running container over SSH (`docker exec predium-db env`).

## What runs on the droplet

- **kamal-proxy:** TLS via Let's Encrypt, zero-downtime swaps, health checks on `/up`
- **App container (`predium-web-*`):** Rails 8.1 on Puma behind Thruster, Solid Queue in-process (`SOLID_QUEUE_IN_PUMA`)
- **Postgres accessory (`predium-db`):** Postgres 16, data in `/root/predium-db/data` on the host. Holds the primary, cache, queue and cable databases, which `db:prepare` creates on first boot.
- **Active Storage:** local disk in the `predium_storage` Docker volume

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
