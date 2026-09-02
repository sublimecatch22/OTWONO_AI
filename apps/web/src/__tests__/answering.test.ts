import { describe, expect, it } from 'vitest';

import { agentValue, answeringFor, choicesFor, teamValue, valueFor } from '../lib/answering';

const agents = [
  { id: 'a1', name: 'Ada' },
  { id: 'boss', name: 'Executive Orchestrator' },
];

const teams = [
  { id: 'w1', name: 'Q3 Operations', kind: 'office' as const, coordinator_agent_id: 'boss' },
  { id: 'w2', name: 'Unled', kind: 'lab' as const, coordinator_agent_id: null },
];

const kindLabel = (kind: string) => (kind === 'office' ? 'Office' : 'Lab');

describe('choosing who answers', () => {
  it('offers every agent and every team', () => {
    const { agents: people, teams: groups } = choicesFor(agents, teams, kindLabel);
    expect(people.map((c) => c.label)).toEqual(['Ada', 'Executive Orchestrator']);
    expect(groups[0]).toMatchObject({ value: 'team:w1', label: 'Q3 Operations — Office' });
  });

  it('offers a leaderless team but says why it cannot be picked', () => {
    // Dropping it from the list would read as a bug in the application rather
    // than a gap in the team.
    const { teams: groups } = choicesFor(agents, teams, kindLabel);
    expect(groups[1]).toMatchObject({ value: 'team:w2', disabled: true });
    expect(groups[1]!.label).toContain('nobody is in charge yet');
  });

  it('resolves a team to the agent that leads it, and keeps the team', () => {
    expect(answeringFor(teamValue('w1'), teams)).toEqual({
      agentId: 'boss',
      workspaceId: 'w1',
    });
  });

  it('resolves an agent to itself, out of any team', () => {
    expect(answeringFor(agentValue('a1'), teams)).toEqual({ agentId: 'a1', workspaceId: null });
  });

  it('resolves nobody rather than half a change when a team has gone', () => {
    expect(answeringFor(teamValue('deleted'), teams)).toEqual({
      agentId: null,
      workspaceId: null,
    });
    expect(answeringFor(teamValue('w2'), teams)).toEqual({ agentId: null, workspaceId: null });
  });

  it('shows the team when the chosen agent is the one leading it', () => {
    expect(valueFor('boss', 'w1', teams)).toBe('team:w1');
  });

  it('shows the agent when it is in a team it does not lead', () => {
    // Ada is in the office but does not run it, so the honest label is Ada.
    expect(valueFor('a1', 'w1', teams)).toBe('agent:a1');
  });

  it('shows nobody when nobody is chosen', () => {
    expect(valueFor(null, null, teams)).toBe('');
    expect(valueFor(null, 'w1', teams)).toBe('');
  });
});
