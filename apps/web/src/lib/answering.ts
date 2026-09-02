/**
 * Choosing who answers: one agent, or a team.
 *
 * A team is a workspace — an Office, Lab, Boardroom or Think Tank is already a
 * named roster of agents with somebody in charge (decision D-017). Picking a
 * team therefore means two things at once: the work belongs to that workspace,
 * so its shared instructions apply, and the workspace's coordinator is the
 * agent that answers.
 *
 * A team with nobody in charge cannot answer. It is still offered, but
 * disabled and labelled with the reason, because a team that silently vanishes
 * from the list looks like a bug in the application rather than a gap in the
 * team.
 */

import type { Agent, WorkspaceSummary } from '../api/types';

export interface Choice {
  /** The `<option>` value: `agent:<id>` or `team:<id>`. */
  value: string;
  label: string;
  /** True when the option cannot be chosen, with `reason` saying why. */
  disabled?: boolean;
}

/** What a chosen option means in terms the API understands. */
export interface Answering {
  agentId: string | null;
  workspaceId: string | null;
}

export const NOBODY = '';

type Named = Pick<Agent, 'id' | 'name'>;
type Team = Pick<WorkspaceSummary, 'id' | 'name' | 'kind' | 'coordinator_agent_id'>;

export function agentValue(id: string): string {
  return `agent:${id}`;
}

export function teamValue(id: string): string {
  return `team:${id}`;
}

/**
 * The options for a picker, agents first and then teams.
 *
 * `kindLabel` turns a workspace kind into the word a person sees, so the list
 * reads "Q3 Operations — Office" rather than exposing the enum.
 */
export function choicesFor(
  agents: Named[],
  teams: Team[],
  kindLabel: (kind: Team['kind']) => string,
): { agents: Choice[]; teams: Choice[] } {
  return {
    agents: agents.map((agent) => ({ value: agentValue(agent.id), label: agent.name })),
    teams: teams.map((team) => {
      const led = Boolean(team.coordinator_agent_id);
      return {
        value: teamValue(team.id),
        label: led
          ? `${team.name} — ${kindLabel(team.kind)}`
          : `${team.name} — ${kindLabel(team.kind)} (nobody is in charge yet)`,
        disabled: !led,
      };
    }),
  };
}

/**
 * The value a picker should show for a conversation, project or task that
 * already has an agent and possibly a workspace.
 *
 * A workspace whose coordinator is the chosen agent reads as "this is the
 * team"; the same agent in a workspace it does not lead reads as that agent,
 * because that is what it is.
 */
export function valueFor(
  agentId: string | null,
  workspaceId: string | null,
  teams: Team[],
): string {
  if (workspaceId && agentId) {
    const team = teams.find((candidate) => candidate.id === workspaceId);
    if (team?.coordinator_agent_id === agentId) return teamValue(workspaceId);
  }
  return agentId ? agentValue(agentId) : NOBODY;
}

/**
 * Turn a chosen option back into an agent and a workspace.
 *
 * Choosing a team it cannot resolve — deleted between the render and the
 * click, or somehow with no coordinator — yields nobody rather than a
 * half-applied change.
 */
export function answeringFor(value: string, teams: Team[]): Answering {
  if (value.startsWith('team:')) {
    const team = teams.find((candidate) => candidate.id === value.slice(5));
    if (!team?.coordinator_agent_id) return { agentId: null, workspaceId: null };
    return { agentId: team.coordinator_agent_id, workspaceId: team.id };
  }
  if (value.startsWith('agent:')) {
    // Leaving a team behind: the agent answers for itself from here on.
    return { agentId: value.slice(6), workspaceId: null };
  }
  return { agentId: null, workspaceId: null };
}
