/** Agents: templates, editing, version history, packages and the test console. */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, ApiError } from '../api/client';
import type {
  Agent,
  AgentTemplateSummary,
  Capability,
  ConnectionsResponse,
  ConnectionTest,
  SourcesResponse,
} from '../api/types';
import { Badge, Button, Card, EmptyState, Field, Notice, Spinner } from '../components/primitives';
import { useUi } from '../state/ui';

const CAPABILITY_LABELS: Record<Capability, string> = {
  file_read: 'Read authorised files',
  file_write: 'Write files into a project folder',
  knowledge_search: 'Search your knowledge index',
  http_fetch: 'Fetch approved web pages',
  artifact_create: 'Create project deliverables',
  budget_record: 'Record simulated expenses',
  marketplace_publish: 'Publish marketplace listings',
  relay_sync: 'Send approved metadata to your account',
};

const OFF_DEVICE: Capability[] = ['http_fetch', 'relay_sync', 'marketplace_publish'];

/**
 * "Temperature" is a sampling knob, and it does not describe anything a person
 * setting up an agent is deciding. Worse, the newest models reject the
 * parameter outright, so a number in this box is not even reliably doing what
 * it says.
 *
 * These are the three choices that actually differ, named for what they mean
 * for the work. The number is still stored, and still editable under Advanced
 * for anyone who wants it.
 */
const APPROACHES = {
  close: {
    label: 'Stay close to the brief',
    temperature: 0.1,
    description: 'Repeatable and literal. For review, verification and figures.',
  },
  balanced: {
    label: 'Balanced',
    temperature: 0.5,
    description: 'The default. Follows the brief, with room to phrase things well.',
  },
  explore: {
    label: 'Explore alternatives',
    temperature: 0.9,
    description: 'Offers options and unasked-for angles. For design and drafting.',
  },
} as const;

type ApproachKey = keyof typeof APPROACHES;

/**
 * Which approach a stored number falls under, so a hand-set value still shows
 * something true rather than resetting to a default.
 *
 * Bands, not nearest-neighbour: the templates ship values that land exactly
 * between two anchors — the Designer's 0.7 is equidistant from 0.5 and 0.9 —
 * and nearest-neighbour resolved those ties by whichever key happened to come
 * first. A boundary that has to be decided is better decided here, in the
 * open, than by object key order. Both boundaries belong to the more
 * exploratory band, so 0.7 reads as exploring rather than balanced.
 */
function approachFor(temperature: number): ApproachKey {
  if (temperature < 0.3) return 'close';
  if (temperature < 0.7) return 'balanced';
  return 'explore';
}

function TemplatePicker({
  templates,
  busy,
  onCreate,
}: {
  templates: AgentTemplateSummary[];
  busy: boolean;
  onCreate: (template: AgentTemplateSummary) => void;
}) {
  const [key, setKey] = useState('');
  const chosen = templates.find((template) => template.key === key) ?? null;

  if (templates.length === 0) return <p className="muted">No templates are available.</p>;

  return (
    <div className="stack">
      <Field label="Template">
        {({ id }) => (
          <select
            id={id}
            className="select"
            value={key}
            onChange={(event) => setKey(event.target.value)}
          >
            <option value="">Choose a template…</option>
            {templates.map((template) => (
              <option key={template.key} value={template.key}>
                {template.name}
              </option>
            ))}
          </select>
        )}
      </Field>
      {chosen && <p className="muted">{chosen.description}</p>}
      <Button disabled={!chosen || busy} onClick={() => chosen && onCreate(chosen)}>
        {busy ? 'Creating…' : 'Create agent'}
      </Button>
    </div>
  );
}

/**
 * The models a connection actually reports, rather than a box to type one into.
 * A typed model name that the runtime does not have fails at the first message,
 * which is a long way from where the mistake was made.
 */
function ModelField({
  connectionId,
  value,
  onChange,
}: {
  connectionId: string | null;
  value: string | null;
  onChange: (model: string | null) => void;
}) {
  const test = useQuery({
    queryKey: ['connections', connectionId, 'models'],
    enabled: Boolean(connectionId),
    queryFn: () => api.post<ConnectionTest>(`/api/connections/${connectionId}/test`, {}),
  });

  const models = test.data?.models ?? [];
  // A model set on another connection, or before this one was reachable, must
  // still be visible — silently dropping it would look like the agent lost its
  // model.
  const unlisted = value && !models.some((model) => model.id === value) ? value : null;

  return (
    <Field label="Model" hint={connectionId ? undefined : 'Choose a connection first.'}>
      {({ id, describedBy }) => (
        <select
          id={id}
          aria-describedby={describedBy}
          className="select"
          disabled={!connectionId}
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value || null)}
        >
          <option value="">Connection default</option>
          {unlisted && (
            <option value={unlisted}>{unlisted} (not offered by this connection)</option>
          )}
          {models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.id}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

export function AgentsScreen() {
  const client = useQueryClient();
  const toast = useUi((state) => state.toast);
  const [selected, setSelected] = useState<string | null>(null);

  const agents = useQuery({ queryKey: ['agents'], queryFn: () => api.get<Agent[]>('/api/agents') });
  const templates = useQuery({
    queryKey: ['agents', 'templates'],
    queryFn: () => api.get<AgentTemplateSummary[]>('/api/agents/templates'),
  });

  const seed = useMutation({
    mutationFn: () => api.post<Agent[]>('/api/agents/templates/seed'),
    onSuccess: (created) => {
      client.invalidateQueries({ queryKey: ['agents'] });
      toast({
        tone: 'positive',
        body:
          created.length === 0
            ? 'Every shipped agent already exists.'
            : `Added ${created.length} agent(s).`,
      });
    },
  });

  const createFromTemplate = useMutation({
    mutationFn: (template: AgentTemplateSummary) =>
      api.post<Agent>('/api/agents', {
        name: `${template.name} (copy)`,
        from_template: template.key,
      }),
    onSuccess: (agent) => {
      client.invalidateQueries({ queryKey: ['agents'] });
      setSelected(agent.id);
    },
  });

  const importAgent = useMutation({
    mutationFn: (packageJson: unknown) =>
      api.post<Agent>('/api/agents/import', { package: packageJson }),
    onSuccess: (agent) => {
      client.invalidateQueries({ queryKey: ['agents'] });
      setSelected(agent.id);
      toast({ tone: 'positive', body: `Imported ${agent.name}. Choose a connection for it.` });
    },
    onError: (error) =>
      toast({
        tone: 'negative',
        title: 'That package was refused',
        body: error instanceof ApiError ? error.message : String(error),
      }),
  });

  return (
    <div className="screen">
      <header className="screen__head">
        <div>
          <h1>Agents</h1>
          <p className="screen__lede">
            An agent is a set of instructions, a model, and a narrow list of things it is allowed to
            do. Editing one records a version you can go back to.
          </p>
        </div>
        <div className="row row--tight">
          <label className="btn btn--secondary btn--md">
            <span>Import a package</span>
            <input
              type="file"
              accept="application/json,.json"
              className="visually-hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                try {
                  importAgent.mutate(JSON.parse(await file.text()));
                } catch {
                  toast({ tone: 'negative', body: 'That file is not valid JSON.' });
                }
                event.target.value = '';
              }}
            />
          </label>
          <Button variant="primary" busy={seed.isPending} onClick={() => seed.mutate()}>
            Restore shipped agents
          </Button>
        </div>
      </header>

      <div className="split">
        <div className="split__list">
          {agents.isLoading && <Spinner label="Loading agents" />}
          {agents.data?.length === 0 && (
            <EmptyState
              title="No agents yet"
              description="OTWONO ships ten to start from."
              action={
                <Button variant="primary" onClick={() => seed.mutate()}>
                  Add the shipped agents
                </Button>
              }
            />
          )}
          <ul className="stack">
            {(agents.data ?? []).map((agent) => (
              <li key={agent.id}>
                <button
                  type="button"
                  className={`listbutton${selected === agent.id ? ' listbutton--active' : ''}`}
                  onClick={() => setSelected(agent.id)}
                  aria-current={selected === agent.id ? 'true' : undefined}
                >
                  <strong>{agent.name}</strong>
                  <span className="muted">{agent.role}</span>
                  <span className="row row--wrap">
                    {agent.capabilities.length === 0 ? (
                      <Badge tone="neutral">no tools</Badge>
                    ) : (
                      agent.capabilities.map((capability) => (
                        <Badge
                          key={capability}
                          tone={OFF_DEVICE.includes(capability) ? 'caution' : 'neutral'}
                        >
                          {capability}
                        </Badge>
                      ))
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <Card title="Start from a template">
            <TemplatePicker
              templates={templates.data ?? []}
              busy={createFromTemplate.isPending}
              onCreate={(template) => createFromTemplate.mutate(template)}
            />
          </Card>
        </div>

        <div className="split__detail">
          {selected ? (
            <AgentEditor agentId={selected} onDeleted={() => setSelected(null)} />
          ) : (
            <EmptyState
              title="Choose an agent"
              description="Pick one on the left to see and change how it behaves."
            />
          )}
        </div>
      </div>
    </div>
  );
}

function AgentEditor({ agentId, onDeleted }: { agentId: string; onDeleted: () => void }) {
  const client = useQueryClient();
  const toast = useUi((state) => state.toast);
  const [draft, setDraft] = useState<Partial<Agent> | null>(null);
  const [testInput, setTestInput] = useState('Introduce yourself in one sentence.');
  const [testOutput, setTestOutput] = useState<{
    output: string;
    system_message: string;
    elapsed_ms: number;
    model: string;
  } | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const agent = useQuery({
    queryKey: ['agent', agentId],
    queryFn: () => api.get<Agent>(`/api/agents/${agentId}`),
  });
  const connections = useQuery({
    queryKey: ['connections'],
    queryFn: () => api.get<ConnectionsResponse>('/api/connections'),
  });
  const sources = useQuery({
    queryKey: ['knowledge', 'sources'],
    queryFn: () => api.get<SourcesResponse>('/api/knowledge/sources'),
  });
  const versions = useQuery({
    queryKey: ['agent', agentId, 'versions'],
    queryFn: () =>
      api.get<{ version: number; note: string | null; created_at: string }[]>(
        `/api/agents/${agentId}/versions`,
      ),
  });

  const save = useMutation({
    mutationFn: (patch: Record<string, unknown>) => api.put<Agent>(`/api/agents/${agentId}`, patch),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['agent', agentId] });
      client.invalidateQueries({ queryKey: ['agents'] });
      setDraft(null);
      toast({ tone: 'positive', body: 'Saved. The previous version is in the history below.' });
    },
    onError: (error) =>
      toast({ tone: 'negative', body: error instanceof ApiError ? error.message : String(error) }),
  });

  const restore = useMutation({
    mutationFn: (version: number) =>
      api.post<Agent>(`/api/agents/${agentId}/versions/${version}/restore`),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['agent', agentId] });
      client.invalidateQueries({ queryKey: ['agent', agentId, 'versions'] });
      toast({ tone: 'positive', body: 'Restored as a new version. Nothing was lost.' });
    },
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/api/agents/${agentId}`),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['agents'] });
      onDeleted();
    },
  });

  const runTest = useMutation({
    mutationFn: () =>
      api.post<{ output: string; system_message: string; elapsed_ms: number; model: string }>(
        `/api/agents/${agentId}/test`,
        { message: testInput },
      ),
    onSuccess: (result) => {
      setTestOutput(result);
      setTestError(null);
    },
    onError: (error) => {
      setTestOutput(null);
      setTestError(error instanceof ApiError ? error.message : String(error));
    },
  });

  if (agent.isLoading) return <Spinner label="Loading the agent" />;
  if (!agent.data) return <Notice tone="negative">That agent could not be loaded.</Notice>;

  const current = { ...agent.data, ...draft };
  const dirty = draft !== null && Object.keys(draft).length > 0;
  const change = (patch: Partial<Agent>) => setDraft((prev) => ({ ...(prev ?? {}), ...patch }));

  return (
    <div className="stack">
      <Card
        title={current.name}
        description={`Version ${agent.data.version}`}
        actions={
          <>
            <Button
              size="sm"
              onClick={async () => {
                const pkg = await api.get(`/api/agents/${agentId}/export`);
                const blob = new Blob([JSON.stringify(pkg, null, 2)], {
                  type: 'application/json',
                });
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement('a');
                anchor.href = url;
                anchor.download = `${current.name?.replace(/\W+/g, '-').toLowerCase()}.otwono-agent.json`;
                anchor.click();
                URL.revokeObjectURL(url);
              }}
            >
              Export
            </Button>
            <Button size="sm" variant="danger" onClick={() => remove.mutate()}>
              Delete
            </Button>
          </>
        }
      >
        <div className="grid grid--two">
          <Field label="Name">
            {({ id }) => (
              <input
                id={id}
                className="input"
                value={current.name ?? ''}
                onChange={(event) => change({ name: event.target.value })}
              />
            )}
          </Field>
          <Field label="Role">
            {({ id }) => (
              <input
                id={id}
                className="input"
                value={current.role ?? ''}
                onChange={(event) => change({ role: event.target.value })}
              />
            )}
          </Field>
        </div>

        <Field
          label="Instructions"
          hint="What this agent should do, and how. OTWONO adds its own rules about honesty and untrusted content on top."
        >
          {({ id, describedBy }) => (
            <textarea
              id={id}
              aria-describedby={describedBy}
              className="textarea"
              rows={10}
              value={current.system_instructions ?? ''}
              onChange={(event) => change({ system_instructions: event.target.value })}
            />
          )}
        </Field>

        <div className="grid grid--two">
          <Field label="Connection">
            {({ id }) => (
              <select
                id={id}
                className="select"
                value={current.provider_connection_id ?? ''}
                onChange={(event) => change({ provider_connection_id: event.target.value || null })}
              >
                <option value="">Not chosen</option>
                {(connections.data?.connections ?? []).map((connection) => (
                  <option key={connection.id} value={connection.id}>
                    {connection.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <ModelField
            connectionId={current.provider_connection_id ?? null}
            value={current.model ?? null}
            onChange={(model) => change({ model })}
          />
        </div>

        <div className="grid grid--three">
          <Field
            label="Approach"
            hint="How much latitude this agent takes. A reviewer should stay close to the brief; a designer usually should not."
          >
            {({ id, describedBy }) => (
              <select
                id={id}
                aria-describedby={describedBy}
                className="select"
                value={approachFor(current.parameters?.temperature ?? 0.7)}
                onChange={(event) =>
                  change({
                    parameters: {
                      ...(current.parameters ?? {
                        top_p: null,
                        max_output_tokens: null,
                        stop: [],
                        extra: {},
                      }),
                      temperature: APPROACHES[event.target.value as ApproachKey].temperature,
                    },
                  })
                }
              >
                {(Object.keys(APPROACHES) as ApproachKey[]).map((key) => (
                  <option key={key} value={key}>
                    {APPROACHES[key].label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Maximum steps">
            {({ id }) => (
              <input
                id={id}
                className="input"
                type="number"
                min={1}
                max={200}
                value={current.max_steps ?? 12}
                onChange={(event) => change({ max_steps: Number(event.target.value) })}
              />
            )}
          </Field>
          <Field label="Timeout (seconds)">
            {({ id }) => (
              <input
                id={id}
                className="input"
                type="number"
                min={1}
                max={3600}
                value={current.timeout_seconds ?? 120}
                onChange={(event) => change({ timeout_seconds: Number(event.target.value) })}
              />
            )}
          </Field>
        </div>

        <fieldset className="fieldset">
          <legend>What this agent may do</legend>
          <p className="muted">
            Each of these still needs your permission the first time it is used.
          </p>
          {(Object.keys(CAPABILITY_LABELS) as Capability[]).map((capability) => (
            <label className="checkbox" key={capability}>
              <input
                type="checkbox"
                checked={(current.capabilities ?? []).includes(capability)}
                onChange={(event) => {
                  const next = event.target.checked
                    ? [...(current.capabilities ?? []), capability]
                    : (current.capabilities ?? []).filter((value) => value !== capability);
                  change({ capabilities: next });
                }}
              />
              <span>
                {CAPABILITY_LABELS[capability]}
                {OFF_DEVICE.includes(capability) && (
                  <>
                    {' '}
                    <Badge tone="caution">can leave this device</Badge>
                  </>
                )}
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset className="fieldset">
          <legend>Knowledge this agent may search</legend>
          {(sources.data?.sources ?? []).filter((s) => s.authorised).length === 0 ? (
            <p className="muted">No folders are authorised yet.</p>
          ) : (
            (sources.data?.sources ?? [])
              .filter((source) => source.authorised)
              .map((source) => (
                <label className="checkbox" key={source.id}>
                  <input
                    type="checkbox"
                    checked={(current.knowledge_source_ids ?? []).includes(source.id)}
                    onChange={(event) => {
                      const next = event.target.checked
                        ? [...(current.knowledge_source_ids ?? []), source.id]
                        : (current.knowledge_source_ids ?? []).filter((id) => id !== source.id);
                      change({ knowledge_source_ids: next });
                    }}
                  />
                  <span>{source.label}</span>
                </label>
              ))
          )}
        </fieldset>

        <div className="row row--tight">
          <Button
            variant="primary"
            disabled={!dirty}
            busy={save.isPending}
            onClick={() => save.mutate(draft ?? {})}
          >
            Save changes
          </Button>
          <Button disabled={!dirty} onClick={() => setDraft(null)}>
            Discard
          </Button>
        </div>
      </Card>

      <Card
        title="Test console"
        description="One turn, with no tools and nothing saved. It shows the exact instructions the model was given."
      >
        <Field label="Message">
          {({ id }) => (
            <textarea
              id={id}
              className="textarea"
              rows={3}
              value={testInput}
              onChange={(event) => setTestInput(event.target.value)}
            />
          )}
        </Field>
        <Button variant="primary" busy={runTest.isPending} onClick={() => runTest.mutate()}>
          Run test
        </Button>

        {testError && <Notice tone="negative">{testError}</Notice>}
        {testOutput && (
          <div className="stack">
            <p className="muted">
              {testOutput.model} · {testOutput.elapsed_ms} ms
            </p>
            <pre className="output">{testOutput.output}</pre>
            <details>
              <summary>What the model was told</summary>
              <pre className="output">{testOutput.system_message}</pre>
            </details>
          </div>
        )}
      </Card>

      <Card title="Version history">
        {versions.data?.length ? (
          <ul className="stack">
            {versions.data.map((version) => (
              <li key={version.version} className="row">
                <div>
                  <strong>Version {version.version}</strong>
                  <p className="muted">{version.note ?? 'No note'}</p>
                </div>
                <Button
                  size="sm"
                  disabled={version.version === agent.data?.version}
                  onClick={() => restore.mutate(version.version)}
                >
                  Restore
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No history yet.</p>
        )}
      </Card>
    </div>
  );
}
