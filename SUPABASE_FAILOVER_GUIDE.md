# Supabase Failover Routing Guide
## RTO ≤ 30 minutes, RPO ≤ 15 minutes

This guide outlines implementing failover routing with DNS/Cloudflare to achieve:
- **RTO (Recovery Time Objective)**: ≤ 30 minutes (system recovery time)
- **RPO (Recovery Point Objective)**: ≤ 15 minutes (maximum data loss)

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Database Replication Strategy](#database-replication-strategy)
4. [DNS Failover with Cloudflare](#dns-failover-with-cloudflare)
5. [Application-Level Failover](#application-level-failover)
6. [Monitoring & Alerting](#monitoring--alerting)
7. [Testing Procedures](#testing-procedures)
8. [Cost Considerations](#cost-considerations)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Cloudflare DNS                       │
│  Primary: api-primary.cekat.com  →  Supabase Primary        │
│  Backup:  api-backup.cekat.com   →  Supabase Backup         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Failover Logic (Health Checks + Auto-Switch)      │     │
│  └────────────────────────────────────────────────────┘     │
│                            │                                │
│             ┌──────────────┴──────────────┐                 │
│             ▼                             ▼                 │
│     ┌───────────────┐            ┌───────────────┐          │
│     │ Supabase      │            │ Supabase      │          │
│     │ Primary       │◄──Replicate│ Backup        │          │
│     │ Project       │  (PITR)    │ Project       │          │
│     └───────────────┘            └───────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

### 1. Supabase Projects Setup
- **Primary Project**: Your main Supabase project
- **Backup Project**: Separate Supabase project in different region (recommended)
- Both projects should have the same schema (use migrations)

### 2. Cloudflare Account
- Pro plan or higher (for DNS failover features)
- Access to DNS settings and Health Checks
- API tokens for automation

### 3. Monitoring Tools
- Uptime monitoring (Cloudflare, Pingdom, or custom)
- Database replication monitoring
- Alert system (email, Slack, PagerDuty)

---

## Database Replication Strategy

### Option 1: Supabase Point-in-Time Recovery (PITR) + Read Replicas

Supabase provides automated backups, but for ≤15 minute RPO, you need:

1. **Enable PITR Backups**:
   ```sql
   -- In Supabase Dashboard → Database → Backups
   -- Enable Point-in-Time Recovery (PITR)
   -- Backup frequency: Every 15 minutes
   ```

2. **Create Read Replica** (if available in your plan):
   - Go to Database → Replicas
   - Create replica in different region
   - Use for failover read operations

3. **Manual Replication Script** (if PITR + replicas aren't sufficient):

```bash
#!/bin/bash
# sync-backup.sh - Run every 15 minutes via cron

# Export from primary
pg_dump $PRIMARY_DB_URL > backup.sql

# Import to backup
psql $BACKUP_DB_URL < backup.sql

# Log sync time
echo "$(date): Backup synced" >> /var/log/supabase-sync.log
```

**Cron Setup** (every 15 minutes):
```bash
*/15 * * * * /path/to/sync-backup.sh
```

### Option 2: Logical Replication (PostgreSQL Native)

For real-time replication:

```sql
-- On PRIMARY database
CREATE PUBLICATION supabase_replication FOR ALL TABLES;

-- On BACKUP database
CREATE SUBSCRIPTION supabase_subscription
CONNECTION 'host=primary-db.supabase.co port=5432 dbname=postgres user=replicator password=xxx'
PUBLICATION supabase_replication;
```

**Limitations**: 
- Requires direct database access (service role)
- May not work with Supabase managed hosting
- Consider Supabase Enterprise plan for native replication

### Option 3: Application-Level Replication

Write to both databases simultaneously:

```typescript
// src/lib/supabaseFailover.ts
import { createClient } from '@supabase/supabase-js';

const primaryClient = createClient(
  process.env.VITE_SUPABASE_PRIMARY_URL!,
  process.env.VITE_SUPABASE_PRIMARY_KEY!
);

const backupClient = createClient(
  process.env.VITE_SUPABASE_BACKUP_URL!,
  process.env.VITE_SUPABASE_BACKUP_KEY!
);

async function writeWithReplication(table: string, data: any) {
  // Write to primary
  const primaryResult = await primaryClient.from(table).insert(data);
  
  // Async write to backup (fire and forget)
  backupClient.from(table).insert(data).catch(err => {
    console.error('Backup write failed:', err);
    // Log to monitoring service
  });
  
  return primaryResult;
}
```

---

## DNS Failover with Cloudflare

### Step 1: Set Up Health Checks

1. **Create Health Check in Cloudflare**:
   - Go to **Traffic → Health Checks**
   - Create new health check:
     ```
     Name: supabase-primary-health
     Type: HTTP
     URL: https://YOUR_PRIMARY_PROJECT.supabase.co/rest/v1/
     Expected Status: 200-299
     Interval: 1 minute
     Timeout: 5 seconds
     Retries: 2
     ```

2. **Create Backup Health Check**:
   ```
   Name: supabase-backup-health
   Type: HTTP
   URL: https://YOUR_BACKUP_PROJECT.supabase.co/rest/v1/
   Expected Status: 200-299
   Interval: 1 minute
   ```

### Step 2: Configure DNS Records

1. **Primary Record** (High Priority):
   ```
   Type: CNAME
   Name: api
   Target: YOUR_PRIMARY_PROJECT.supabase.co
   Proxy: Proxied (Orange Cloud)
   TTL: Auto
   Priority: 10
   Health Check: supabase-primary-health
   ```

2. **Backup Record** (Low Priority):
   ```
   Type: CNAME
   Name: api
   Target: YOUR_BACKUP_PROJECT.supabase.co
   Proxy: Proxied (Orange Cloud)
   TTL: Auto
   Priority: 20
   Health Check: supabase-backup-health
   ```

### Step 3: Configure Failover Rules

Using Cloudflare Load Balancing (requires Business plan or higher):

1. **Create Pool**:
   ```
   Name: supabase-pool
   Health Check: supabase-primary-health
   ```

2. **Add Origins**:
   - Primary: `YOUR_PRIMARY_PROJECT.supabase.co` (Priority 10)
   - Backup: `YOUR_BACKUP_PROJECT.supabase.co` (Priority 20)

3. **Create Load Balancer**:
   ```
   Name: api.cekat.com
   Pool: supabase-pool
   Health Check Interval: 1 minute
   Failover Threshold: 2 consecutive failures
   ```

### Alternative: Cloudflare Workers (Works with Free Plan)

```javascript
// cloudflare-worker-failover.js
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const PRIMARY_URL = 'https://YOUR_PRIMARY_PROJECT.supabase.co';
  const BACKUP_URL = 'https://YOUR_BACKUP_PROJECT.supabase.co';
  
  // Try primary first
  try {
    const response = await fetch(`${PRIMARY_URL}${new URL(request.url).pathname}`, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      signal: AbortSignal.timeout(5000) // 5s timeout
    });
    
    if (response.ok) {
      return response;
    }
  } catch (error) {
    console.log('Primary failed, switching to backup');
  }
  
  // Fallback to backup
  try {
    const response = await fetch(`${BACKUP_URL}${new URL(request.url).pathname}`, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      signal: AbortSignal.timeout(5000)
    });
    return response;
  } catch (error) {
    return new Response('All databases unavailable', { status: 503 });
  }
}
```

Deploy via Cloudflare Dashboard → Workers → Create Worker

---

## Application-Level Failover

### Client-Side Failover Implementation

```typescript
// src/lib/supabaseFailover.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

interface SupabaseConfig {
  url: string;
  key: string;
  name: string;
}

const PRIMARY: SupabaseConfig = {
  url: import.meta.env.VITE_SUPABASE_URL,
  key: import.meta.env.VITE_SUPABASE_ANON_KEY,
  name: 'primary'
};

const BACKUP: SupabaseConfig = {
  url: import.meta.env.VITE_SUPABASE_BACKUP_URL,
  key: import.meta.env.VITE_SUPABASE_BACKUP_KEY,
  name: 'backup'
};

class SupabaseFailoverClient {
  private primary: SupabaseClient;
  private backup: SupabaseClient;
  private current: SupabaseClient;
  private isPrimaryHealthy: boolean = true;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.primary = createClient(PRIMARY.url, PRIMARY.key);
    this.backup = createClient(BACKUP.url, BACKUP.key);
    this.current = this.primary;
    
    // Start health checks
    this.startHealthChecks();
  }

  private async checkHealth(client: SupabaseClient): Promise<boolean> {
    try {
      const { error } = await client.from('health_check').select('id').limit(1).single();
      return !error;
    } catch {
      return false;
    }
  }

  private async startHealthChecks() {
    // Check every 30 seconds
    this.healthCheckInterval = setInterval(async () => {
      const primaryHealthy = await this.checkHealth(this.primary);
      
      if (!primaryHealthy && this.isPrimaryHealthy) {
        console.warn('Primary database unhealthy, switching to backup');
        this.current = this.backup;
        this.isPrimaryHealthy = false;
        
        // Notify monitoring
        this.notifyFailover('primary', 'backup');
      } else if (primaryHealthy && !this.isPrimaryHealthy) {
        console.log('Primary database recovered, switching back');
        this.current = this.primary;
        this.isPrimaryHealthy = true;
        
        // Notify monitoring
        this.notifyFailover('backup', 'primary');
      }
    }, 30000); // 30 seconds
  }

  private async notifyFailover(from: string, to: string) {
    // Send to monitoring service (e.g., Sentry, LogRocket, custom API)
    try {
      await fetch('/api/monitoring/failover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, timestamp: new Date().toISOString() })
      });
    } catch (error) {
      console.error('Failed to notify failover:', error);
    }
  }

  async executeWithFailover<T>(
    operation: (client: SupabaseClient) => Promise<T>
  ): Promise<T> {
    // Try current (primary or backup)
    try {
      return await operation(this.current);
    } catch (error: any) {
      // If current is primary, try backup
      if (this.current === this.primary) {
        console.warn('Primary operation failed, trying backup');
        try {
          return await operation(this.backup);
        } catch (backupError) {
          throw new Error(`Both primary and backup failed: ${backupError}`);
        }
      } else {
        // Current is backup and failed, throw error
        throw error;
      }
    }
  }

  getClient(): SupabaseClient {
    return this.current;
  }

  getPrimary(): SupabaseClient {
    return this.primary;
  }

  getBackup(): SupabaseClient {
    return this.backup;
  }

  isUsingBackup(): boolean {
    return this.current === this.backup;
  }

  destroy() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }
}

export const failoverClient = new SupabaseFailoverClient();

// Wrapper for protected supabase client
export async function withFailover<T>(
  operation: (client: SupabaseClient) => Promise<T>
): Promise<T> {
  return failoverClient.executeWithFailover(operation);
}
```

### Update Supabase Client Usage

```typescript
// src/lib/supabase.ts
import { failoverClient } from './supabaseFailover';
import { protectedSupabase } from './supabaseProtected';

// Use failover client instead of direct client
export const supabase = failoverClient.getClient();

// For operations that need failover
export async function queryWithFailover<T>(
  query: (client: SupabaseClient) => Promise<T>
): Promise<T> {
  return failoverClient.executeWithFailover(query);
}
```

### Create Health Check Table

```sql
-- supabase/migrations/YYYYMMDD_health_check_table.sql
CREATE TABLE IF NOT EXISTS public.health_check (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now()
);

-- Insert dummy record for health checks
INSERT INTO public.health_check (id) VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;

-- Grant access for health checks
GRANT SELECT ON public.health_check TO anon;
GRANT SELECT ON public.health_check TO authenticated;
```

---

## Monitoring & Alerting

### 1. Health Check Monitoring

```typescript
// src/lib/monitoring.ts
interface HealthCheckResult {
  primary: boolean;
  backup: boolean;
  timestamp: string;
  latency: {
    primary: number;
    backup: number;
  };
}

export async function checkDatabaseHealth(): Promise<HealthCheckResult> {
  const startPrimary = performance.now();
  const primaryHealthy = await checkSupabaseHealth(PRIMARY_URL);
  const primaryLatency = performance.now() - startPrimary;

  const startBackup = performance.now();
  const backupHealthy = await checkSupabaseHealth(BACKUP_URL);
  const backupLatency = performance.now() - startBackup;

  const result: HealthCheckResult = {
    primary: primaryHealthy,
    backup: backupHealthy,
    timestamp: new Date().toISOString(),
    latency: {
      primary: primaryLatency,
      backup: backupLatency
    }
  };

  // Send to monitoring service
  if (!primaryHealthy) {
    await sendAlert('PRIMARY_DB_DOWN', result);
  }

  return result;
}

async function checkSupabaseHealth(url: string): Promise<boolean> {
  try {
    const response = await fetch(`${url}/rest/v1/health_check?select=id&limit=1`, {
      headers: {
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
      },
      signal: AbortSignal.timeout(5000)
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Run every 1 minute
setInterval(checkDatabaseHealth, 60000);
```

### 2. Alert Configuration

Set up alerts for:
- Primary database down → Switch to backup
- Backup database down → Alert but continue with primary
- Both databases down → Critical alert
- Failover event → Log and notify team
- Replication lag > 15 minutes → Alert

### 3. Cloudflare Analytics

Monitor in Cloudflare Dashboard:
- DNS query distribution (primary vs backup)
- Health check pass/fail rates
- Response times
- Failover events

---

## Testing Procedures

### 1. Failover Test (Monthly)

```bash
#!/bin/bash
# test-failover.sh

echo "Testing failover scenario..."

# 1. Simulate primary failure (block primary endpoint)
# 2. Verify automatic switch to backup (within 30 seconds)
# 3. Verify application still works
# 4. Restore primary
# 5. Verify switch back to primary

# Expected results:
# - Failover time: < 30 seconds
# - No data loss
# - Application continues working
```

### 2. RPO Test (Quarterly)

1. Make changes to primary database
2. Simulate failure immediately
3. Check backup database
4. Verify data is present (should be ≤ 15 minutes old)
5. Measure actual RPO

### 3. RTO Test (Quarterly)

1. Simulate complete failure
2. Start timer
3. Manually failover to backup
4. Verify application is operational
5. Stop timer (should be ≤ 30 minutes)

### 4. Disaster Recovery Drill (Annually)

Full scenario:
1. Primary region completely down
2. DNS failover activated
3. Backup database promoted
4. Application reconnected
5. Measure full recovery time

---

## Cost Considerations

### Supabase Costs
- **Primary Project**: Your current plan
- **Backup Project**: Same plan (or lower tier if read-only)
- **Storage**: 2x storage costs (primary + backup)
- **Bandwidth**: Replication bandwidth

### Cloudflare Costs
- **DNS**: Free plan works (limited features)
- **Health Checks**: Pro plan ($20/month) or Business plan ($200/month)
- **Load Balancing**: Business plan ($200/month) or Enterprise
- **Workers**: Free tier (100,000 requests/day)

### Estimated Monthly Costs
- **Small Scale**: $40-100/month (2x Supabase + Cloudflare Pro)
- **Medium Scale**: $200-500/month (2x Supabase + Cloudflare Business)
- **Enterprise**: Custom pricing

---

## Implementation Checklist

### Phase 1: Setup (Week 1)
- [ ] Create backup Supabase project
- [ ] Set up database replication (PITR or logical)
- [ ] Configure Cloudflare DNS records
- [ ] Set up health checks
- [ ] Deploy health check table migration

### Phase 2: Application (Week 2)
- [ ] Implement failover client in application
- [ ] Update all Supabase client usage
- [ ] Add monitoring and alerting
- [ ] Test failover logic locally

### Phase 3: Testing (Week 3)
- [ ] Run failover test
- [ ] Run RPO test
- [ ] Run RTO test
- [ ] Document results
- [ ] Fix any issues

### Phase 4: Production (Week 4)
- [ ] Deploy to staging
- [ ] Run full DR drill
- [ ] Deploy to production
- [ ] Monitor for 1 week
- [ ] Document runbook

---

## Best Practices

1. **Automate Everything**: No manual steps in failover
2. **Test Regularly**: Monthly failover tests, quarterly DR drills
3. **Monitor Constantly**: Real-time health checks and alerts
4. **Document Runbooks**: Clear procedures for team
5. **Version Control**: Keep all configs in Git
6. **Backup Backups**: Have a third-tier backup if budget allows
7. **Geographic Distribution**: Primary and backup in different regions
8. **Regular Backups**: Even with replication, keep daily/weekly backups

---

## Troubleshooting

### Issue: Failover Not Triggering
- Check health check configuration
- Verify DNS TTL settings
- Check Cloudflare Load Balancer rules

### Issue: Data Not Replicating
- Verify replication job is running
- Check network connectivity
- Review replication logs

### Issue: High RTO
- Automate more steps
- Reduce health check intervals
- Use faster DNS propagation (lower TTL)

### Issue: RPO > 15 minutes
- Increase replication frequency
- Use logical replication instead of batch sync
- Consider application-level dual-write

---

## Additional Resources

- [Supabase Backup Documentation](https://supabase.com/docs/guides/platform/backups)
- [Cloudflare Load Balancing](https://developers.cloudflare.com/load-balancing/)
- [PostgreSQL Logical Replication](https://www.postgresql.org/docs/current/logical-replication.html)
- [DNS Failover Best Practices](https://developers.cloudflare.com/dns/manage-dns-records/reference/dns-failover/)

---

**Last Updated**: 2025-01-02
**Version**: 1.0




