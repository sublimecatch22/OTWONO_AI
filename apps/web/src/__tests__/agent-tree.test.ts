import { describe, expect, it } from 'vitest';

import { buildAgentTree, descendantsOf } from '../lib/agentTree';

interface Row {
  id: string;
  parent_agent_id: string | null;
}

const rows = (...pairs: [string, string | null][]): Row[] =>
  pairs.map(([id, parent_agent_id]) => ({ id, parent_agent_id }));

/** Every id the tree renders, so nothing can be silently lost. */
function idsIn(nodes: ReturnType<typeof buildAgentTree<Row>>): string[] {
  return nodes.flatMap((node) => [node.agent.id, ...idsIn(node.children)]);
}

describe('the agent tree', () => {
  it('puts specialists under the agent they report to', () => {
    const tree = buildAgentTree(rows(['boss', null], ['a', 'boss'], ['b', 'boss']));
    expect(tree).toHaveLength(1);
    const boss = tree[0]!;
    expect(boss.agent.id).toBe('boss');
    expect(boss.children.map((c) => c.agent.id)).toEqual(['a', 'b']);
  });

  it('nests to any depth', () => {
    const tree = buildAgentTree(rows(['top', null], ['mid', 'top'], ['low', 'mid']));
    expect(tree[0]!.children[0]!.children[0]!.agent.id).toBe('low');
  });

  it('leaves a flat list flat', () => {
    const tree = buildAgentTree(rows(['a', null], ['b', null]));
    expect(tree.map((n) => n.agent.id)).toEqual(['a', 'b']);
  });

  it('shows an agent whose manager is not in the list, rather than hiding it', () => {
    // The manager may be archived, filtered out, or deleted between requests.
    // Dropping the agent would make it unreachable in the interface.
    const tree = buildAgentTree(rows(['orphan', 'gone']));
    expect(idsIn(tree)).toEqual(['orphan']);
  });

  it('breaks a loop instead of hanging, and keeps everyone in it', () => {
    // Two agents pointing at each other should be impossible — the service
    // refuses it. If it happens anyway, the screen must still render.
    const tree = buildAgentTree(rows(['a', 'b'], ['b', 'a']));
    expect(idsIn(tree).sort()).toEqual(['a', 'b']);
  });

  it('survives an agent that reports to itself', () => {
    const tree = buildAgentTree(rows(['self', 'self']));
    expect(idsIn(tree)).toEqual(['self']);
  });

  it('finds everyone at or below an agent', () => {
    const all = rows(['top', null], ['mid', 'top'], ['low', 'mid'], ['other', null]);
    expect([...descendantsOf(all, 'top')].sort()).toEqual(['low', 'mid', 'top']);
    expect([...descendantsOf(all, 'low')]).toEqual(['low']);
  });

  it('does not loop for ever when looking for descendants of a cycle', () => {
    expect([...descendantsOf(rows(['a', 'b'], ['b', 'a']), 'a')].sort()).toEqual(['a', 'b']);
  });
});
