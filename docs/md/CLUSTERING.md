Super Agent Clustering

Roles and Access
- Master Agent: org-wide access; can assign agents and reassign AI Agents.
- Super Agent: full access only to their own Agents and AI Agents.
- Agent: self + assigned channels.

Ownership Rules
- 1 Master → many Super Agents.
- 1 Super Agent → many Agents; many AI Agents.
- Each Agent belongs to exactly one Super Agent per org.
- Each AI Agent belongs to exactly one Super Agent (non-null super_agent_id).

Database
- super_agent_members(org_id, super_agent_id, agent_user_id, created_at)
  UNIQUE(org_id, agent_user_id); FKs to auth.users and orgs.
- ai_profiles.super_agent_id uuid NOT NULL (FK to auth.users); indexed.

RLS
- Master Agent: org-wide read/write on both tables.
- Super Agent: read/insert/delete own super_agent_members; read/update own ai_profiles.

Backfill
- Existing ai_profiles were assigned to superagent@example.com (fallback: any super_agent in org).

UI Operations
- Human Agents → Clustering: select a Super Agent, then assign/unassign Agents and attach/reassign AI Agents.
- Platform creation: Super Agent → filtered AI Agents → filtered Agents.

Hooks
- useHumanAgents adds super_agent_id for agents.
- useAIAgents supports setFilterBySuper(superId).

Validation
- UI blocks selecting Agents/AI Agents attached to another Super Agent; DB uniqueness enforces this.

Troubleshooting
- If access is denied, verify role and org membership; ensure mappings exist; verify ai_profiles.super_agent_id.

