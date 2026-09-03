/**
 * Deliberations: a team of agents arguing towards an answer.
 *
 * This is what the application is for. A question goes to a team, every agent
 * states a position, everyone challenges everyone else, and the orchestrator
 * decides whether that is good enough — sending them round again, aimed at
 * what is missing, until it is satisfied or the rounds run out.
 *
 * The screen's job is to make the difference between those endings impossible
 * to miss. An answer nobody settled on must never look like one they did.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, ApiError } from '../api/client';
import type {
  DeliberationSummary,
  SessionContribution,
  SessionDetail,
  SessionOutcome,
  WorkspaceSummary,
} from '../api/types';
import { Markdown } from '../components/Markdown';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Notice,
  Spinner,
  TimeAgo,
} from '../components/primitives';
import { useUi } from '../state/ui';

const ROUND_CHOICES = [1, 2, 3, 4, 5, 6];

/** How each ending is described, and how loudly. */
const OUTCOMES: Record<
  SessionOutcome,
  { label: string; tone: 'positive' | 'caution'; blurb: string }
> = {
  settled: {
    label: 'Settled',
    tone: 'positive',
    blurb: 'The orchestrator judged the answer good enough to act on.',
  },
  stalled: {
    label: 'Not settled — went in circles',
    tone: 'caution',
    blurb:
      'The orchestrator asked for the same things two rounds running and did not get them. This is the best the team had, not an agreed answer.',
  },
  budget_spent: {
    label: 'Not settled — ran out of rounds',
    tone: 'caution',
    blurb:
      'The orchestrator still wanted more when the rounds ran out. This is the best the team had, not an agreed answer. Run it again with more rounds if it is worth the time.',
  },
};

const STAGE_LABELS: Record<string, string> = {
  positions: 'Opening position',
  critique: 'Critique',
  review: 'The orchestrator’s call',
  revision: 'Revised position',
  synthesis: 'Write-up',
};

export function DeliberationsScreen() {
  const client = useQueryClient();
  const toast = useUi((state) => state.toast);
  const [open, setOpen] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [teamId, setTeamId] = useState('');
  const [rounds, setRounds] = useState(3);

  const teams = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => api.get<WorkspaceSummary[]>('/api/workspaces'),
  });
  const deliberations = useQuery({
    queryKey: ['deliberations'],
    queryFn: () => api.get<DeliberationSummary[]>('/api/deliberations'),
  });

  const start = useMutation({
    mutationFn: async () => {
      const session = await api.post<SessionDetail>(`/api/workspaces/${teamId}/sessions`, {
        question: question.trim(),
        max_rounds: rounds,
      });
      // Created and run in one press: a deliberation nobody started is not a
      // useful thing to have made.
      return api.post<SessionDetail>(
        `/api/workspaces/${teamId}/sessions/${session.id}/run`,
        undefined,
      );
    },
    onSuccess: (session) => {
      setQuestion('');
      setOpen(session.id);
      client.invalidateQueries({ queryKey: ['deliberations'] });
      client.invalidateQueries({ queryKey: ['session', session.id] });
      const outcome = session.outcome ? OUTCOMES[session.outcome] : null;
      toast({
        tone: outcome?.tone === 'positive' ? 'positive' : 'caution',
        body: outcome ? `${outcome.label} after ${session.round} round(s).` : 'It finished.',
      });
    },
    onError: (error) =>
      toast({
        tone: 'negative',
        title: 'That deliberation could not run',
        body: error instanceof ApiError ? error.message : String(error),
      }),
  });

  const chosen = (teams.data ?? []).find((team) => team.id === teamId);
  // Two agents is the minimum for there to be anything to reconcile, and the
  // engine refuses below that. Say so before the button is pressed.
  const tooSmall = Boolean(chosen && chosen.member_count < 2);
  const canStart = question.trim().length > 0 && teamId !== '' && !tooSmall;

  return (
    <div className="screen">
      <header className="screen__head">
        <div>
          <h1>Deliberations</h1>
          <p className="screen__lede">
            Put a question to a team. They argue it out, and the orchestrator decides when the
            answer is good enough.
          </p>
        </div>
      </header>

      <Card title="Ask a team something">
        <div className="stack">
          <Field label="The question">
            {({ id }) => (
              <textarea
                id={id}
                className="textarea"
                rows={3}
                value={question}
                placeholder="Should we ship on Friday, and what would have to be true for that to be safe?"
                onChange={(event) => setQuestion(event.target.value)}
              />
            )}
          </Field>

          <div className="grid grid--two">
            <Field label="Team">
              {({ id }) => (
                <select
                  id={id}
                  className="select"
                  value={teamId}
                  onChange={(event) => setTeamId(event.target.value)}
                >
                  <option value="">Choose a team</option>
                  {(teams.data ?? []).map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name} — {team.member_count} agent
                      {team.member_count === 1 ? '' : 's'}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field
              label="Rounds at most"
              hint="The backstop, not the stopping rule — it stops as soon as the orchestrator is satisfied. Every round is one turn per agent plus a critique, so on a local model more rounds means minutes, not seconds."
            >
              {({ id, describedBy }) => (
                <select
                  id={id}
                  aria-describedby={describedBy}
                  className="select"
                  value={rounds}
                  onChange={(event) => setRounds(Number(event.target.value))}
                >
                  {ROUND_CHOICES.map((n) => (
                    <option key={n} value={n}>
                      {n} round{n === 1 ? '' : 's'}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>

          {tooSmall && (
            <Notice tone="caution" title="That team cannot deliberate yet">
              {chosen?.name} has {chosen?.member_count} agent
              {chosen?.member_count === 1 ? '' : 's'}. A deliberation needs at least two, so there
              is something to reconcile. Add another on the team’s page.
            </Notice>
          )}

          <div className="row">
            <Button
              variant="primary"
              busy={start.isPending}
              disabled={!canStart}
              onClick={() => start.mutate()}
            >
              Start the deliberation
            </Button>
            {start.isPending && (
              <span className="muted">
                Running. Every agent answers in turn, so this takes as long as the model does.
              </span>
            )}
          </div>
        </div>
      </Card>

      {deliberations.isLoading && <Spinner label="Loading deliberations" />}

      {deliberations.data?.length === 0 && !deliberations.isLoading && (
        <EmptyState
          title="Nothing has been deliberated yet"
          description="Put a question to a team above. You will see every position, every challenge, and the orchestrator's reasoning for stopping."
        />
      )}

      {(deliberations.data ?? []).map((session) => (
        <DeliberationCard
          key={session.id}
          summary={session}
          open={open === session.id}
          onToggle={() => setOpen(open === session.id ? null : session.id)}
        />
      ))}
    </div>
  );
}

function DeliberationCard({
  summary,
  open,
  onToggle,
}: {
  summary: DeliberationSummary;
  open: boolean;
  onToggle: () => void;
}) {
  const detail = useQuery({
    queryKey: ['session', summary.id],
    enabled: open,
    queryFn: () =>
      api.get<SessionDetail>(`/api/workspaces/${summary.workspace_id}/sessions/${summary.id}`),
  });

  const outcome = summary.outcome ? OUTCOMES[summary.outcome] : null;

  return (
    <Card title={summary.question}>
      <div className="row row--between">
        <span className="muted">
          {summary.workspace_name} · {summary.round} of {summary.max_rounds} round
          {summary.max_rounds === 1 ? '' : 's'} · <TimeAgo value={summary.updated_at} />
        </span>
        {outcome ? (
          <Badge tone={outcome.tone}>{outcome.label}</Badge>
        ) : (
          <Badge tone="info">{STAGE_LABELS[summary.stage] ?? summary.stage}</Badge>
        )}
      </div>

      {outcome && outcome.tone !== 'positive' && (
        <Notice tone="caution" title={outcome.label}>
          {outcome.blurb}
          {summary.outstanding.length > 0 && (
            <>
              {' '}
              Still missing:
              <ul>
                {summary.outstanding.map((gap) => (
                  <li key={gap}>{gap}</li>
                ))}
              </ul>
            </>
          )}
        </Notice>
      )}

      {summary.synthesis && (
        <details open>
          <summary>{outcome?.tone === 'positive' ? 'The answer' : 'The best they had'}</summary>
          <Markdown source={summary.synthesis} />
        </details>
      )}

      {summary.dissent_summary && (
        <details>
          <summary>Who disagreed</summary>
          <Markdown source={summary.dissent_summary} />
        </details>
      )}

      <Button onClick={onToggle}>{open ? 'Hide how they got there' : 'How they got there'}</Button>

      {open && detail.isLoading && <Spinner label="Loading the transcript" />}
      {open && detail.data && <Transcript contributions={detail.data.contributions} />}
    </Card>
  );
}

/** The argument itself, grouped by round so the back-and-forth is legible. */
function Transcript({ contributions }: { contributions: SessionContribution[] }) {
  const rounds = [...new Set(contributions.map((c) => c.round))].sort((a, b) => a - b);
  return (
    <div className="stack">
      {rounds.map((round) => (
        <section key={round}>
          <h3>Round {round}</h3>
          <ul className="stack">
            {contributions
              .filter((c) => c.round === round)
              .map((c) => (
                <li key={c.id}>
                  <div className="row row--between">
                    <strong>{c.agent_name}</strong>
                    <span className="row">
                      <Badge tone={c.stage === 'review' ? 'accent' : 'neutral'}>
                        {STAGE_LABELS[c.stage] ?? c.stage}
                      </Badge>
                      <Badge tone={c.claim_kind === 'sourced' ? 'positive' : 'neutral'}>
                        {c.claim_kind === 'sourced' ? 'sourced' : 'speculation'}
                      </Badge>
                    </span>
                  </div>
                  <Markdown source={c.content} />
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
