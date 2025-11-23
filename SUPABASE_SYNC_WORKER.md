# Supabase Near-Realtime Sync Worker

This repository ships with a Node-based worker that mirrors data from the
primary Supabase project (`tgrmxlbnutxpewfmofdx`) to the backup project
(`igtizjvhxgajijjjxnzi`). The worker combines Supabase Realtime streaming with
periodic reconciliation passes so that changes are caught even if the realtime
connection momentarily drops.

## How it works

1. **Realtime feed** — subscribes to `postgres_changes` on the configured tables.
   Every insert/update is upserted into the backup project and deletes are
   propagated using the configured primary keys.
2. **Periodic reconciliation** — every 30 seconds (configurable) the worker
   fetches rows that changed recently (based on `updated_at`/`created_at`) and
   replays them to the backup. This heals any gaps caused by network hiccups or
   worker restarts.
3. **State tracking** — a small JSON state file remembers the most recent
   checkpoint per table so that restarts resume from roughly where the worker
   left off.

## Setup

1. Install dependencies
   ```bash
   npm install
   ```
2. Create a `.env.sync` file at the project root (ignored by git). The
   `sync/env.sync.example` file shows the required variables:
   - `SYNC_SOURCE_SUPABASE_URL`
   - `SYNC_SOURCE_SUPABASE_SERVICE_ROLE_KEY`
   - `SYNC_TARGET_SUPABASE_URL`
   - `SYNC_TARGET_SUPABASE_SERVICE_ROLE_KEY`

   > ⚠️ Use service role keys. Store the `.env.sync` file securely.

3. Review `sync/tables.config.json`. Each entry describes how the worker should
   handle a table:
   - `primaryKeys` — used to delete rows safely.
   - `incrementalFields` — ordered list of timestamp columns to use for
     reconciliation. The worker picks the first one that exists.
   - `realtime` / `reconcile` — set to `false` to opt out of either mode per
     table.
4. Apply the migration `20251120120000_create_sync_deletions_table.sql` to both
   projects. It creates the `sync_deletions` ledger plus triggers to log deletes
   across the tables referenced in `tables.config.json`.

## Running the worker

```bash
npm run sync
```

The worker logs subscription status, realtime events, and reconciliation
statistics. A state file is written to `sync/.sync-state.json` (ignored by git).

### Reconciliation-only mode (for schedulers/cron)

If you simply want a reconciliation pass (for example in a GitHub Action or any
cron runner), disable realtime and run a single pass:

```bash
SYNC_MODE=reconcile npm run sync
# or
npm run sync -- --cron
```

This executes one reconciliation sweep and exits. Schedule it every few minutes
to keep the backup within your desired lag (e.g. every 5 minutes for <10 minute
drift).
The reconciliation pass also replays deletes recorded in the
`public.sync_deletions` ledger and marks entries as processed.

### Deploying as a service

For continuous syncing, run the worker under a process manager (systemd, PM2,
Docker, Fly Machines, etc.). Example systemd unit:

```ini
[Unit]
Description=Supabase near-realtime sync worker
After=network.target

[Service]
WorkingDirectory=/var/www/cekat-replica
Environment=NODE_ENV=production
EnvironmentFile=/var/www/cekat-replica/.env.sync
ExecStart=/usr/bin/npm run sync
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

## Tuning

Environment overrides:

| Variable | Default | Purpose |
| --- | --- | --- |
| `SYNC_RECONCILE_INTERVAL_MS` | `30000` | How often (ms) to run reconciliation. |
| `SYNC_RECONCILE_LOOKBACK_MS` | `300000` | Sliding window for reconciliation queries. |
| `SYNC_RECONCILE_BATCH_SIZE` | `500` | Batch size per reconciliation request. |
| `SYNC_INITIAL_BACKFILL_MS` | `86400000` | On first run, how much history to backfill (ms). |
| `SYNC_TABLE_CONFIG` | `sync/tables.config.json` | Alternate table config path. |
| `SYNC_STATE_PATH` | `sync/.sync-state.json` | Custom state file location. |
| `SYNC_ENV_PATH` | `.env.sync` | Custom env file path. |
| `SYNC_MODE` | `default` | Set to `reconcile` for one-shot reconciliation (no realtime). |
| `SYNC_REALTIME` | `true` | Set to `false` to disable realtime subscriptions. |
| `SYNC_LOOP` | `true` | Set to `false` to skip the repeating reconciliation loop. |
| `SYNC_RECONCILE_LOOKBACK_MS` | `300000` | Extend (e.g. to 600000) for a wider catch-up window. |

Adjust these values to match your data volume and recovery point objectives.

## Extending the config

Add new tables or customise behaviour by editing `sync/tables.config.json`.
After changes, restart the worker. If a table lacks an `updated_at`, include a
different change-tracking column in `incrementalFields`.

## Limitations

- Deletes rely on the configured `primaryKeys`. Ensure they match the table
  definition to avoid orphaned data.
- Reconciliation only replays inserts/updates. If the worker is offline for an
  extended period, manually verify deletes or perform a fresh `supabase db dump`
  + restore.
- Deletes rely on the `sync_deletions` ledger. Ensure the migration stays
  applied on source and that triggers remain enabled.
- The worker expects service role keys and therefore must be kept in trusted
  infrastructure.

## GitHub Actions cron example

Create a workflow similar to `.github/workflows/backup-sync.yml` and define the
following repository secrets:

- `SUPABASE_SOURCE_URL`
- `SUPABASE_SOURCE_SERVICE_ROLE_KEY`
- `SUPABASE_TARGET_URL`
- `SUPABASE_TARGET_SERVICE_ROLE_KEY`

```yaml
name: Supabase Backup Sync

on:
  schedule:
    - cron: "*/5 * * * *"
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "npm"
      - run: npm ci
      - run: SYNC_MODE=reconcile SYNC_REALTIME=false SYNC_LOOP=false SYNC_RECONCILE_LOOKBACK_MS=600000 npm run sync
        env:
          SYNC_SOURCE_SUPABASE_URL: ${{ secrets.SUPABASE_SOURCE_URL }}
          SYNC_SOURCE_SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SOURCE_SERVICE_ROLE_KEY }}
          SYNC_TARGET_SUPABASE_URL: ${{ secrets.SUPABASE_TARGET_URL }}
          SYNC_TARGET_SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_TARGET_SERVICE_ROLE_KEY }}
```

This runs every 5 minutes, replays recent inserts/updates, and processes pending
deletions from the ledger.

