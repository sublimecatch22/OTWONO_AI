-- An agent may report to another agent.
--
-- This is the tree the agents screen draws: an orchestrator at the top and the
-- specialists it dispatches beneath it. The column is nullable and defaults to
-- NULL, so every agent that exists today stays exactly as it is — a flat list
-- is a forest of roots.
--
-- ON DELETE SET NULL rather than CASCADE: deleting a manager must never delete
-- the people under it. They become roots and keep every other setting.
ALTER TABLE agents
  ADD COLUMN parent_agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL;

CREATE INDEX idx_agents_parent ON agents(parent_agent_id);
