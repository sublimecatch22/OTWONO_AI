/**
 * The agent tree.
 *
 * An agent may report to another. The list becomes a forest: orchestrators at
 * the top, the specialists they dispatch beneath them. Anything that is not a
 * clean tree is flattened rather than hidden — an agent whose manager is not in
 * the list (archived, filtered out, deleted between two requests) is shown as a
 * root, and a cycle that reached the database anyway is broken instead of
 * looping forever. Nothing this function is given may vanish from what it
 * returns.
 */

import type { Agent } from '../api/types';

export interface TreeNode<T> {
  agent: T;
  children: TreeNode<T>[];
}

type Parented = Pick<Agent, 'id'> & { parent_agent_id: string | null };

/**
 * Build the forest. Order within each level is the order the agents arrived
 * in, which the API already sorts by name.
 */
export function buildAgentTree<T extends Parented>(agents: T[]): TreeNode<T>[] {
  const byId = new Map(agents.map((agent) => [agent.id, agent]));
  const nodes = new Map<string, TreeNode<T>>(
    agents.map((agent) => [agent.id, { agent, children: [] }]),
  );

  const roots: TreeNode<T>[] = [];
  for (const agent of agents) {
    const node = nodes.get(agent.id)!;
    const parentId = agent.parent_agent_id;
    const parent = parentId ? nodes.get(parentId) : undefined;
    // No manager, a manager we cannot see, or a chain that comes back round:
    // all three mean "show it at the top", never "drop it".
    if (!parent || climbReaches(agent.id, parentId!, byId)) {
      roots.push(node);
    } else {
      parent.children.push(node);
    }
  }
  return roots;
}

/**
 * Walking up from `from`, do we arrive back at `target` — or at a loop that
 * does not involve it? Either way the chain cannot be drawn as a tree.
 */
function climbReaches<T extends Parented>(
  target: string,
  from: string,
  byId: Map<string, T>,
): boolean {
  const seen = new Set<string>();
  let cursor: string | null = from;
  while (cursor) {
    if (cursor === target) return true;
    if (seen.has(cursor)) return true;
    seen.add(cursor);
    cursor = byId.get(cursor)?.parent_agent_id ?? null;
  }
  return false;
}

/**
 * Every id at or below `agentId`, including itself.
 *
 * Used to keep the "reports to" picker honest: an agent may not be put under
 * one of its own reports, and offering the choice only to refuse it is worse
 * than not offering it.
 */
export function descendantsOf<T extends Parented>(agents: T[], agentId: string): Set<string> {
  const childrenOf = new Map<string, string[]>();
  for (const agent of agents) {
    if (!agent.parent_agent_id) continue;
    const siblings = childrenOf.get(agent.parent_agent_id) ?? [];
    siblings.push(agent.id);
    childrenOf.set(agent.parent_agent_id, siblings);
  }

  const found = new Set<string>([agentId]);
  const queue = [agentId];
  while (queue.length > 0) {
    for (const child of childrenOf.get(queue.pop()!) ?? []) {
      if (found.has(child)) continue;
      found.add(child);
      queue.push(child);
    }
  }
  return found;
}
