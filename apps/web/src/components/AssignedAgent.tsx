/**
 * Who is doing this task.
 *
 * The orchestrator's plan names a role for each task, and that role is matched
 * against the agents you actually have — one it invents is dropped rather than
 * conjured, which leaves the task with nobody on it. A task with nobody on it
 * still runs: the project's orchestrator picks it up. Both facts are worth
 * seeing, because together they are how you tell whether the work was shared
 * out or quietly kept by one agent.
 */

import { useQuery } from '@tanstack/react-query';

import { api } from '../api/client';
import type { Agent } from '../api/types';

type Named = Pick<Agent, 'id' | 'name'>;

function nameOf(id: string | null, agents: Named[] | undefined): string | null {
  if (!id || !agents) return null;
  return agents.find((agent) => agent.id === id)?.name ?? null;
}

/**
 * The words for one assignment, given the agents that currently exist.
 *
 * `agents` is undefined while the list is still loading, or if it failed to
 * load. We then say the task is assigned without naming anyone: naming the
 * wrong agent is worse than naming none.
 */
export function assignmentLabel(
  assignedId: string | null,
  orchestratorId: string | null,
  agents: Named[] | undefined,
): string {
  if (assignedId) {
    const name = nameOf(assignedId, agents);
    if (name) return `Assigned to ${name}`;
    return agents ? 'Assigned to an agent that no longer exists' : 'Assigned to an agent';
  }

  // Unassigned. The engine falls back to the project's orchestrator, so say
  // that rather than implying nothing will happen.
  if (!orchestratorId) {
    return 'Nobody is assigned, and there is no orchestrator to fall back on';
  }
  const name = nameOf(orchestratorId, agents);
  return name
    ? `Nobody is assigned, so the orchestrator (${name}) will do it`
    : 'Nobody is assigned, so the orchestrator will do it';
}

export function AssignedAgent({
  assignedId,
  orchestratorId,
}: {
  assignedId: string | null;
  orchestratorId: string | null;
}) {
  // The same query key every other screen uses, so this shares one cached
  // list rather than fetching once per task row.
  const agents = useQuery({ queryKey: ['agents'], queryFn: () => api.get<Agent[]>('/api/agents') });
  return <span className="muted">{assignmentLabel(assignedId, orchestratorId, agents.data)}</span>;
}
