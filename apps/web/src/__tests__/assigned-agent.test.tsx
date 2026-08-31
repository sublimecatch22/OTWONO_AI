import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AssignedAgent, assignmentLabel } from '../components/AssignedAgent';
import type { Agent } from '../api/types';

function agent(id: string, name: string): Pick<Agent, 'id' | 'name'> {
  return { id, name };
}

const TEAM = [agent('a1', 'Ada'), agent('boss', 'Executive Orchestrator')];

describe('the assigned agent on a task row', () => {
  it('names the agent that is doing the work', () => {
    expect(assignmentLabel('a1', 'boss', TEAM)).toBe('Assigned to Ada');
  });

  it('does not name anyone while the agent list is still loading', () => {
    expect(assignmentLabel('a1', 'boss', undefined)).toBe('Assigned to an agent');
  });

  it('admits when the assigned agent has since been deleted', () => {
    expect(assignmentLabel('gone', 'boss', TEAM)).toBe(
      'Assigned to an agent that no longer exists',
    );
  });

  it('says who picks up a task the plan left unassigned', () => {
    // The planner drops a role you do not have rather than inventing an agent,
    // and the engine then falls back to the project's orchestrator. Saying only
    // "unassigned" would imply nothing will happen, which is not true.
    expect(assignmentLabel(null, 'boss', TEAM)).toBe(
      'Nobody is assigned, so the orchestrator (Executive Orchestrator) will do it',
    );
  });

  it('names the fallback without a name while the agent list is loading', () => {
    expect(assignmentLabel(null, 'boss', undefined)).toBe(
      'Nobody is assigned, so the orchestrator will do it',
    );
  });

  it('warns when nobody is assigned and there is no orchestrator either', () => {
    // This is the one combination that cannot run at all, and the run fails
    // with exactly this complaint. Better to see it before pressing the button.
    expect(assignmentLabel(null, null, TEAM)).toBe(
      'Nobody is assigned, and there is no orchestrator to fall back on',
    );
  });

  it('renders the wording into the row', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <AssignedAgent assignedId="a1" orchestratorId="boss" />
      </QueryClientProvider>,
    );
    expect(screen.getByText('Assigned to an agent')).toBeInTheDocument();
  });
});
