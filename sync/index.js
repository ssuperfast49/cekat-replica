import fs from "fs";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import WebSocket from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defaultEnvPath = path.resolve(__dirname, "..", ".env.sync");
const envPath = process.env.SYNC_ENV_PATH ?? defaultEnvPath;
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

if (typeof globalThis.WebSocket === "undefined") {
  globalThis.WebSocket = WebSocket;
}

const requiredEnvVars = [
  "SYNC_SOURCE_SUPABASE_URL",
  "SYNC_SOURCE_SUPABASE_SERVICE_ROLE_KEY",
  "SYNC_TARGET_SUPABASE_URL",
  "SYNC_TARGET_SUPABASE_SERVICE_ROLE_KEY",
];

const missingEnv = requiredEnvVars.filter((key) => !process.env[key]);
if (missingEnv.length) {
  console.error(
    `[sync] Missing required environment variables: ${missingEnv.join(", ")}`,
  );
  console.error(
    "[sync] Copy sync/env.sync.example to .env.sync and fill in your credentials.",
  );
  process.exit(1);
}

const configPath =
  process.env.SYNC_TABLE_CONFIG ?? path.resolve(__dirname, "tables.config.json");
if (!fs.existsSync(configPath)) {
  console.error(`[sync] Could not find tables config at ${configPath}`);
  process.exit(1);
}

const rawConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
const tableDefaults = {
  schema: "public",
  realtime: true,
  reconcile: true,
  incrementalFields: ["updated_at", "created_at"],
  ...(rawConfig?.defaults ?? {}),
};
const tables = (rawConfig?.tables ?? []).map((table) => ({
  ...tableDefaults,
  ...table,
}));
const reconciliationDefaults = {
  batchSize: 500,
  intervalMs: 30_000,
  lookbackMs: 5 * 60_000,
  initialBackfillMs: 24 * 60 * 60_000,
  ...(rawConfig?.reconciliation ?? {}),
};

const syncOptions = {
  reconcileIntervalMs: Number(
    process.env.SYNC_RECONCILE_INTERVAL_MS ?? reconciliationDefaults.intervalMs,
  ),
  reconcileLookbackMs: Number(
    process.env.SYNC_RECONCILE_LOOKBACK_MS ?? reconciliationDefaults.lookbackMs,
  ),
  reconcileBatchSize: Number(
    process.env.SYNC_RECONCILE_BATCH_SIZE ?? reconciliationDefaults.batchSize,
  ),
  initialBackfillMs: Number(
    process.env.SYNC_INITIAL_BACKFILL_MS ??
      reconciliationDefaults.initialBackfillMs,
  ),
};

const statePath = path.resolve(
  process.cwd(),
  process.env.SYNC_STATE_PATH ?? "sync/.sync-state.json",
);

const state = loadState(statePath);

const DELETION_LOG_TABLE = "sync_deletions";

const argv = new Set(process.argv.slice(2));
const envMode = (process.env.SYNC_MODE ?? "").toLowerCase();
let mode = "default";
if (envMode === "reconcile" || envMode === "cron" || envMode === "once") {
  mode = "reconcile";
}
if (argv.has("--reconcile-only") || argv.has("--cron") || argv.has("--once")) {
  mode = "reconcile";
}
if (argv.has("--default")) {
  mode = "default";
}
const realtimeDisabled =
  (process.env.SYNC_REALTIME ?? "true").toLowerCase() === "false" ||
  argv.has("--no-realtime");
const loopDisabled =
  (process.env.SYNC_LOOP ?? "true").toLowerCase() === "false" ||
  argv.has("--once");

const runRealtime = mode === "default" && !realtimeDisabled;
const runReconciliationLoop = mode === "default" && !loopDisabled;
const runSingleReconciliation = mode === "reconcile";

const sourceClient = createClient(
  process.env.SYNC_SOURCE_SUPABASE_URL,
  process.env.SYNC_SOURCE_SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { "X-Client-Info": "cekat-sync-worker/0.1" } },
    realtime: { params: { eventsPerSecond: 30 } },
  },
);

const targetClient = createClient(
  process.env.SYNC_TARGET_SUPABASE_URL,
  process.env.SYNC_TARGET_SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { "X-Client-Info": "cekat-sync-worker/0.1" } },
  },
);

const tableMetaMap = new Map();
const tableList = [];
const realtimeChannels = [];
const eventQueue = [];
let processingQueue = false;
let shuttingDown = false;

function sourceFrom(table) {
  const schema = table.schema ?? "public";
  return schema === "public"
    ? sourceClient.from(table.name)
    : sourceClient.schema(schema).from(table.name);
}

function targetFrom(table) {
  const schema = table.schema ?? "public";
  return schema === "public"
    ? targetClient.from(table.name)
    : targetClient.schema(schema).from(table.name);
}

async function main() {
  console.log("[sync] Starting Supabase real-time + reconciliation worker");
  console.log(
    `[sync] Loaded ${tables.length} table definitions from ${path.relative(process.cwd(), configPath)}`,
  );
  console.log(`[sync] Mode=${mode} realtime=${runRealtime} loop=${runReconciliationLoop}`);

  for (const table of tables) {
    const incrementalField = await resolveIncrementalField(table);
    if (!incrementalField && table.reconcile) {
      console.warn(
        `[sync][${table.name}] No incremental field available; disabling reconciliation for this table.`,
      );
    }
    const meta = {
      ...table,
      incrementalField,
      lastRealtimeEventAt: null,
      active: table.skip !== true,
    };
    const key = `${meta.schema ?? "public"}:${meta.name}`;
    meta.key = key;
    tableMetaMap.set(key, meta);
    tableList.push(meta);
    if (!meta.active) {
      console.warn(
        `[sync][${table.name}] Replication disabled because the table is unavailable.`,
      );
    }
  }

  if (runRealtime) {
    await startRealtime();
  } else {
    console.log("[sync] Realtime stream disabled.");
  }

  if (runSingleReconciliation) {
    console.log("[sync] Running single reconciliation pass...");
    await reconcileAllTables();
    persistState(statePath, state);
    await shutdown();
    return;
  }

  startReconciliationLoop();

  console.log("[sync] Worker ready. Press Ctrl+C to exit.");
}

async function resolveIncrementalField(table) {
  const candidates = Array.isArray(table.incrementalFields)
    ? table.incrementalFields
    : table.incrementalFields
      ? [table.incrementalFields]
      : [];
  for (const field of candidates) {
    const { error } = await sourceFrom(table)
      .select(field)
      .limit(1);
    if (!error) {
      return field;
    }
    console.warn(
      `[sync][${table.name}] Cannot use incremental field "${field}": ${error.message}`,
    );
    if (error.code === "42P01") {
      table.skip = true;
      console.warn(
        `[sync][${table.name}] Table not found in source project; disabling replication.`,
      );
      return null;
    }
  }
  return null;
}

async function startRealtime() {
  const realtimeTables = tableList.filter(
    (table) => table.active !== false && table.realtime !== false,
  );
  if (!realtimeTables.length) {
    console.log("[sync] No tables configured for realtime replication.");
    return;
  }

  for (const table of realtimeTables) {
    const channel = sourceClient
      .channel(`realtime:${table.schema ?? "public"}:${table.name}`)
      .on(
        "postgres_changes",
        { event: "*", schema: table.schema ?? "public", table: table.name },
        (payload) => {
          enqueueEvent({ type: "realtime", table, payload });
        },
      );

    await channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log(`[sync][${table.name}] realtime subscribed`);
      } else if (status === "CHANNEL_ERROR") {
        console.error(
          `[sync][${table.name}] realtime channel error; data may be stale until the next reconciliation.`,
        );
      } else if (status === "TIMED_OUT") {
        console.warn(
          `[sync][${table.name}] realtime channel timed out; attempting to reconnect.`,
        );
      } else if (status === "CLOSED") {
        console.warn(
          `[sync][${table.name}] realtime channel closed; awaiting reconnect.`,
        );
      }
    });
    realtimeChannels.push(channel);
  }
}

function startReconciliationLoop() {
  if (!runReconciliationLoop) {
    console.log("[sync] Periodic reconciliation loop disabled.");
    return;
  }
  if (!syncOptions.reconcileIntervalMs) {
    console.log("[sync] Reconciliation interval disabled.");
    return;
  }

  setInterval(async () => {
    if (shuttingDown) return;
    await reconcileAllTables();
    persistState(statePath, state);
  }, syncOptions.reconcileIntervalMs);
}

async function reconcileAllTables() {
  for (const table of tableList) {
    if (table.active === false) continue;
    if (table.reconcile === false) continue;
    if (!table.incrementalField) continue;
    try {
      await reconcileTable(table);
    } catch (error) {
      console.error(
        `[sync][${table.name}] reconciliation failed: ${error.message}`,
      );
    }
  }
  await processDeletionLog();
}

function enqueueEvent(event) {
  eventQueue.push(event);
  if (!processingQueue) {
    void processQueue();
  }
}

async function processQueue() {
  processingQueue = true;
  while (eventQueue.length && !shuttingDown) {
    const event = eventQueue.shift();
    try {
      if (event.type === "realtime") {
        await processRealtimeEvent(event.table, event.payload);
      }
    } catch (error) {
      console.error(
        `[sync][${event.table.name}] realtime event failed: ${error.message}`,
      );
    }
  }
  processingQueue = false;
}

async function processRealtimeEvent(table, payload) {
  const meta = table;
  if (!meta || meta.active === false) return;

  const eventType = payload.eventType;
  const row = eventType === "DELETE" ? payload.old : payload.new;
  if (!row) {
    console.warn(
      `[sync][${table.name}] realtime payload missing row data, skipping.`,
    );
    return;
  }

  if (eventType === "DELETE") {
    await withRetry(() => deleteRow(meta, payload.old));
  } else {
    await withRetry(() => upsertRows(meta, [payload.new]));
  }

  meta.lastRealtimeEventAt = new Date().toISOString();
}

async function reconcileTable(table) {
  if (table.active === false) return;
  if (!table.incrementalField) {
    await reconcileFullTable(table);
    return;
  }
  const now = Date.now();
  const stateKey = table.key ?? table.name;
  const lastState = state[stateKey] ?? {};
  const sinceFromState = lastState.cursor
    ? new Date(lastState.cursor).getTime()
    : null;
  const lookbackStart = now - syncOptions.reconcileLookbackMs;
  const initialBackfillStart =
    lastState.cursor || lastState.initialized
      ? lookbackStart
      : now - syncOptions.initialBackfillMs;
  const sinceMs = Math.min(
    lookbackStart,
    sinceFromState ?? initialBackfillStart,
  );
  const sinceIso = new Date(sinceMs).toISOString();

  let page = 0;
  let total = 0;

  while (!shuttingDown) {
    const from = page * syncOptions.reconcileBatchSize;
    const to = from + syncOptions.reconcileBatchSize - 1;
    let query = sourceFrom(table)
      .select("*")
      .order(table.incrementalField, { ascending: true })
      .gte(table.incrementalField, sinceIso)
      .range(from, to);

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }
    if (!data?.length) break;

    await withRetry(() => upsertRows(table, data));
    total += data.length;

    if (data.length < syncOptions.reconcileBatchSize) {
      break;
    }
    page += 1;
  }

  const lastCursor = new Date().toISOString();
  state[stateKey] = {
    cursor: lastCursor,
    initialized: true,
    lastSyncedAt: lastCursor,
    lastBatchCount: total,
  };

  if (total) {
    console.log(
      `[sync][${table.name}] reconciled ${total} rows since ${sinceIso}`,
    );
  }
}

async function reconcileFullTable(table) {
  const stateKey = table.key ?? table.name;
  let page = 0;
  let total = 0;
  while (!shuttingDown) {
    const from = page * syncOptions.reconcileBatchSize;
    const to = from + syncOptions.reconcileBatchSize - 1;
    let query = sourceFrom(table).select("*");
    const orderField =
      table.primaryKeys && table.primaryKeys.length
        ? table.primaryKeys[0]
        : null;
    if (orderField) {
      query = query.order(orderField, { ascending: true });
    }
    query = query.range(from, to);
    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }
    if (!data?.length) break;
    await withRetry(() => upsertRows(table, data));
    total += data.length;
    if (data.length < syncOptions.reconcileBatchSize) {
      break;
    }
    page += 1;
  }
  state[stateKey] = {
    cursor: null,
    initialized: true,
    lastSyncedAt: new Date().toISOString(),
    lastBatchCount: total,
    fullScan: true,
  };
  if (total) {
    console.log(`[sync][${table.name}] reconciled ${total} rows (full scan)`);
  }
}

async function upsertRows(table, rows) {
  if (!rows?.length) return;
  const { error } = await targetFrom(table).upsert(rows, {
    returning: "minimal",
  });
  if (error) {
    throw new Error(error.message);
  }
}

async function deleteRow(table, oldRow) {
  if (!oldRow) {
    throw new Error("delete payload missing row");
  }
  const pk = Array.isArray(table.primaryKeys) ? table.primaryKeys : [];
  if (!pk.length) {
    throw new Error(
      `[sync][${table.name}] Delete skipped: table has no primaryKeys defined in config.`,
    );
  }
  let query = targetFrom(table).delete();
  for (const key of pk) {
    if (oldRow[key] === undefined) {
      throw new Error(
        `[sync][${table.name}] Delete skipped: missing key "${key}" in payload.`,
      );
    }
    query = query.eq(key, oldRow[key]);
  }
  const { error } = await query;
  if (error) {
    throw new Error(error.message);
  }
}

async function withRetry(fn, options = {}) {
  const { attempts = 5, delayMs = 500 } = options;
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const backoff = delayMs * attempt;
      console.warn(
        `[sync] attempt ${attempt} failed: ${error.message}; retrying in ${backoff}ms`,
      );
      await wait(backoff);
    }
  }
  throw lastError;
}

function loadState(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch (error) {
    console.warn(`[sync] failed to load state file: ${error.message}`);
  }
  return {};
}

function persistState(filePath, data) {
  try {
    const directory = path.dirname(filePath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.warn(`[sync] failed to persist state: ${error.message}`);
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processDeletionLog() {
  const meta = tableMetaMap.get(`public:${DELETION_LOG_TABLE}`);
  if (!meta || meta.active === false) return;

  const batchSize = syncOptions.reconcileBatchSize || 500;
  let totalProcessed = 0;

  while (!shuttingDown) {
    const { data, error } = await sourceClient
      .from(DELETION_LOG_TABLE)
      .select("id, table_name, payload")
      .is("processed_at", null)
      .order("id", { ascending: true })
      .limit(batchSize);

    if (error) {
      throw new Error(error.message);
    }

    if (!data?.length) {
      break;
    }

    const processedIds = [];

    for (const entry of data) {
      const payload = entry.payload;
      if (!payload || typeof payload !== "object") {
        console.warn(
          `[sync][${DELETION_LOG_TABLE}] Skipping log ${entry.id}: payload missing or invalid.`,
        );
        processedIds.push(entry.id);
        continue;
      }

      const targetTable =
        tableMetaMap.get(`public:${entry.table_name}`) ??
        tableMetaMap.get(entry.table_name);
      if (!targetTable) {
        console.warn(
          `[sync][${DELETION_LOG_TABLE}] Skipping log ${entry.id}: unknown table ${entry.table_name}.`,
        );
        processedIds.push(entry.id);
        continue;
      }

      try {
        await withRetry(() => deleteRow(targetTable, payload));
        processedIds.push(entry.id);
        totalProcessed += 1;
      } catch (err) {
        console.error(
          `[sync][${DELETION_LOG_TABLE}] Failed to delete ${entry.table_name} row for log ${entry.id}: ${err.message}`,
        );
      }
    }

    if (processedIds.length) {
      const nowIso = new Date().toISOString();
      try {
        await withRetry(() =>
          sourceClient
            .from(DELETION_LOG_TABLE)
            .update({ processed_at: nowIso })
            .in("id", processedIds),
        );
      } catch (err) {
        console.error(
          `[sync][${DELETION_LOG_TABLE}] Failed to mark logs processed: ${err.message}`,
        );
        break;
      }
    }

    if (data.length < batchSize) {
      break;
    }
  }

  if (totalProcessed) {
    console.log(
      `[sync][${DELETION_LOG_TABLE}] Processed ${totalProcessed} deletion entries.`,
    );
  }

  state[`public:${DELETION_LOG_TABLE}`] = {
    lastSyncedAt: new Date().toISOString(),
    lastBatchCount: totalProcessed,
  };
}

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("[sync] Shutting down...");
  for (const channel of realtimeChannels) {
    try {
      await channel.unsubscribe();
    } catch {
      // ignore
    }
  }
  persistState(statePath, state);
  console.log("[sync] Goodbye.");
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

void main().catch((error) => {
  console.error("[sync] Fatal error", error);
  process.exit(1);
});

