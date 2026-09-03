//! Boardroom and Think Tank sessions end to end.

use otwono_agent_core::executor::scripted::ScriptedExecutor;
use otwono_agent_core::executor::AgentOutcome;
use otwono_agent_core::seed::seed_templates;
use otwono_agent_core::session::SessionRunner;
use otwono_store::repo::agents::AgentRepo;
use otwono_store::repo::workspaces::{NewWorkspace, WorkspaceRepo};
use otwono_store::Db;
use otwono_types::workspace::{ClaimKind, SessionOutcome, SessionStage, WorkspaceKind};

fn workspace_with_three_agents(db: &Db, kind: WorkspaceKind, name: &str) -> String {
    seed_templates(db).unwrap();
    let agents = AgentRepo::new(db);
    for mut agent in agents.list(None, true).unwrap() {
        agent.model = Some("test-model".into());
        agents.update(&agent, None).unwrap();
    }

    let workspaces = WorkspaceRepo::new(db);
    let workspace = workspaces.create(NewWorkspace::named(kind, name)).unwrap();
    for (position, key) in [
        "executive-orchestrator",
        "security-reviewer",
        "budget-reviewer",
    ]
    .iter()
    .enumerate()
    {
        let agent = agents.get_by_template_key(key).unwrap().unwrap();
        workspaces
            .add_member(&workspace.id, &agent.id, &agent.role, position == 0)
            .unwrap();
    }
    workspace.id
}

const SYNTHESIS: &str = "\
## Synthesis

The group concluded that shipping should wait until the audit closes.

## Dissent

Budget Reviewer preferred shipping on Friday and accepting the audit risk.

## Unresolved questions

- Who signs off the audit?
- What is the rollback plan?

## Recommended decision

Delay the release to Monday.";

#[tokio::test]
async fn a_boardroom_runs_positions_critique_and_synthesis() {
    let db = Db::open_in_memory().unwrap();
    let workspace_id = workspace_with_three_agents(&db, WorkspaceKind::Boardroom, "Board");
    let workspaces = WorkspaceRepo::new(&db);
    let session = workspaces
        .create_session(&workspace_id, "Should we ship on Friday?", None, None)
        .unwrap();
    assert_eq!(session.stage, SessionStage::Positions);

    let executor = ScriptedExecutor::responding(|turn| {
        let last = turn.messages.last().unwrap().content.clone();
        Ok(if last.contains("You are running this deliberation") {
            AgentOutcome::text("VERDICT: SETTLED")
        } else if last.contains("You are chairing this session") {
            AgentOutcome::text(SYNTHESIS)
        } else if last.contains("BEGIN POSITIONS") {
            AgentOutcome::text("SPECULATION: I still think Monday is safer.")
        } else {
            AgentOutcome::text("SOURCED: audit-plan.md (page 2) says the audit closes Monday.")
        })
    });

    let finished = SessionRunner::new(&db, &executor)
        .run(&session.id)
        .await
        .unwrap();

    assert_eq!(finished.stage, SessionStage::Completed);
    assert!(finished
        .synthesis
        .unwrap()
        .contains("wait until the audit closes"));
    assert!(finished
        .dissent_summary
        .unwrap()
        .contains("Budget Reviewer preferred shipping on Friday"));
    assert_eq!(finished.unresolved_questions.len(), 2);
    assert_eq!(
        finished.recommended_decision.as_deref(),
        Some("Delay the release to Monday.")
    );

    // Three positions, three critiques, the orchestrator's review, one synthesis.
    assert_eq!(finished.outcome, Some(SessionOutcome::Settled));
    assert_eq!(finished.round, 1, "settled on the first round");
    let contributions = workspaces.contributions(&session.id).unwrap();
    assert_eq!(contributions.len(), 8);
    assert_eq!(
        contributions
            .iter()
            .filter(|c| c.stage == SessionStage::Positions)
            .count(),
        3
    );
    assert_eq!(
        contributions
            .iter()
            .filter(|c| c.stage == SessionStage::Critique)
            .count(),
        3
    );
    assert_eq!(
        contributions
            .iter()
            .filter(|c| c.stage == SessionStage::Synthesis)
            .count(),
        1
    );
}

#[tokio::test]
async fn positions_are_taken_before_anyone_has_seen_another_position() {
    let db = Db::open_in_memory().unwrap();
    let workspace_id = workspace_with_three_agents(&db, WorkspaceKind::Boardroom, "Board");
    let session = WorkspaceRepo::new(&db)
        .create_session(&workspace_id, "Ship?", None, None)
        .unwrap();

    let executor = ScriptedExecutor::responding(|turn| {
        let last = turn.messages.last().unwrap().content.clone();
        Ok(if last.contains("You are running this deliberation") {
            AgentOutcome::text("VERDICT: SETTLED")
        } else if last.contains("You are chairing this session") {
            AgentOutcome::text(SYNTHESIS)
        } else {
            AgentOutcome::text("A view.")
        })
    });
    SessionRunner::new(&db, &executor)
        .run(&session.id)
        .await
        .unwrap();

    let calls = executor.calls.lock().unwrap();
    // The first three calls are the position round; none may contain another
    // participant's answer.
    for turn in calls.iter().take(3) {
        let prompt = turn.messages.last().unwrap().content.clone();
        assert!(
            !prompt.contains("BEGIN POSITIONS"),
            "a position was asked for with other positions in view"
        );
        assert!(prompt.contains("before hearing anyone else's"));
    }
}

#[tokio::test]
async fn contributions_record_whether_they_were_sourced_or_speculation() {
    let db = Db::open_in_memory().unwrap();
    let workspace_id = workspace_with_three_agents(&db, WorkspaceKind::ThinkTank, "Tank");
    let workspaces = WorkspaceRepo::new(&db);
    let session = workspaces
        .create_session(&workspace_id, "What should we research next?", None, None)
        .unwrap();

    let executor = ScriptedExecutor::responding(|turn| {
        let last = turn.messages.last().unwrap().content.clone();
        Ok(if last.contains("You are running this deliberation") {
            AgentOutcome::text("VERDICT: SETTLED")
        } else if last.contains("You are chairing this session") {
            AgentOutcome::text(
                "## Research brief\n\nFocus on retention.\n\n## Open questions\n\n- Which cohort?",
            )
        } else if last.contains("BEGIN POSITIONS") {
            AgentOutcome::text("SPECULATION: retention may matter more than acquisition.")
        } else {
            AgentOutcome::text("SOURCED: metrics.csv (rows 2-51) shows churn rising.")
        })
    });
    SessionRunner::new(&db, &executor)
        .run(&session.id)
        .await
        .unwrap();

    let contributions = workspaces.contributions(&session.id).unwrap();
    let positions: Vec<_> = contributions
        .iter()
        .filter(|c| c.stage == SessionStage::Positions)
        .collect();
    assert!(positions.iter().all(|c| c.claim_kind == ClaimKind::Sourced));

    let critiques: Vec<_> = contributions
        .iter()
        .filter(|c| c.stage == SessionStage::Critique)
        .collect();
    assert!(critiques
        .iter()
        .all(|c| c.claim_kind == ClaimKind::Speculation));
}

#[tokio::test]
async fn a_session_needs_at_least_two_participants() {
    let db = Db::open_in_memory().unwrap();
    seed_templates(&db).unwrap();
    let agents = AgentRepo::new(&db);
    let mut agent = agents.get_by_template_key("planner").unwrap().unwrap();
    agent.model = Some("test-model".into());
    let agent = agents.update(&agent, None).unwrap();

    let workspaces = WorkspaceRepo::new(&db);
    let workspace = workspaces
        .create(NewWorkspace::named(
            WorkspaceKind::Boardroom,
            "Lonely board",
        ))
        .unwrap();
    let session = workspaces
        .create_session(&workspace.id, "Ship?", None, None)
        .unwrap();

    let executor = ScriptedExecutor::with_replies(vec![]);
    let runner = SessionRunner::new(&db, &executor);
    let error = runner.run(&session.id).await.unwrap_err().to_string();
    assert!(error.contains("has no agents"), "{error}");

    workspaces
        .add_member(&workspace.id, &agent.id, "Planning", true)
        .unwrap();
    let error = runner.run(&session.id).await.unwrap_err().to_string();
    assert!(error.contains("at least two agents"), "{error}");
}

#[tokio::test]
async fn a_finished_session_cannot_be_run_again() {
    let db = Db::open_in_memory().unwrap();
    let workspace_id = workspace_with_three_agents(&db, WorkspaceKind::Boardroom, "Board");
    let session = WorkspaceRepo::new(&db)
        .create_session(&workspace_id, "Ship?", None, None)
        .unwrap();

    let executor = ScriptedExecutor::responding(|turn| {
        let last = turn.messages.last().unwrap().content.clone();
        Ok(if last.contains("You are running this deliberation") {
            AgentOutcome::text("VERDICT: SETTLED")
        } else if last.contains("You are chairing this session") {
            AgentOutcome::text(SYNTHESIS)
        } else {
            AgentOutcome::text("A view.")
        })
    });
    let runner = SessionRunner::new(&db, &executor);
    runner.run(&session.id).await.unwrap();

    let error = runner.run(&session.id).await.unwrap_err().to_string();
    assert!(error.contains("already finished"), "{error}");
}

#[tokio::test]
async fn the_chair_defaults_to_the_workspace_coordinator() {
    let db = Db::open_in_memory().unwrap();
    let workspace_id = workspace_with_three_agents(&db, WorkspaceKind::Boardroom, "Board");
    let workspaces = WorkspaceRepo::new(&db);
    let session = workspaces
        .create_session(&workspace_id, "Ship?", None, None)
        .unwrap();
    assert!(session.chair_agent_id.is_none());

    let executor = ScriptedExecutor::responding(|turn| {
        let last = turn.messages.last().unwrap().content.clone();
        Ok(if last.contains("You are running this deliberation") {
            AgentOutcome::text("VERDICT: SETTLED")
        } else if last.contains("You are chairing this session") {
            AgentOutcome::text(SYNTHESIS)
        } else {
            AgentOutcome::text("A view.")
        })
    });
    let finished = SessionRunner::new(&db, &executor)
        .run(&session.id)
        .await
        .unwrap();

    let coordinator = workspaces
        .get(&workspace_id)
        .unwrap()
        .unwrap()
        .coordinator_agent_id;
    assert_eq!(finished.chair_agent_id, coordinator);
}

// ---------------------------------------------------------------------------
// The deliberation loop: what makes it stop, and what it says when it does.
// ---------------------------------------------------------------------------

/// A responder that keeps a count, so a test can decide what the orchestrator
/// says on each successive round.
fn deliberating(
    verdicts: Vec<&'static str>,
) -> impl Fn(&otwono_agent_core::executor::AgentTurn) -> anyhow::Result<AgentOutcome> {
    let seen = std::sync::Mutex::new(0usize);
    move |turn: &otwono_agent_core::executor::AgentTurn| {
        let last = turn.messages.last().unwrap().content.clone();
        if last.contains("You are running this deliberation") {
            let mut n = seen.lock().unwrap();
            let verdict = verdicts.get(*n).copied().unwrap_or("VERDICT: SETTLED");
            *n += 1;
            return Ok(AgentOutcome::text(verdict));
        }
        if last.contains("You are chairing this session") {
            return Ok(AgentOutcome::text(SYNTHESIS));
        }
        Ok(AgentOutcome::text("A view."))
    }
}

#[tokio::test]
async fn the_team_goes_round_again_when_the_orchestrator_is_not_satisfied() {
    let db = Db::open_in_memory().unwrap();
    let workspace_id = workspace_with_three_agents(&db, WorkspaceKind::Boardroom, "Board");
    let workspaces = WorkspaceRepo::new(&db);
    let session = workspaces
        .create_session(&workspace_id, "Ship?", None, None)
        .unwrap();

    // Not satisfied first time, with a specific gap; satisfied second time.
    let executor = ScriptedExecutor::responding(deliberating(vec![
        "VERDICT: MORE WORK NEEDED\nGAPS:\n- The cost estimate cites no source",
    ]));
    let finished = SessionRunner::new(&db, &executor)
        .run(&session.id)
        .await
        .unwrap();

    assert_eq!(finished.outcome, Some(SessionOutcome::Settled));
    assert_eq!(finished.round, 2, "it went round a second time");

    let contributions = workspaces.contributions(&session.id).unwrap();
    // Round two asks for revisions, not fresh positions.
    assert_eq!(
        contributions
            .iter()
            .filter(|c| c.stage == SessionStage::Revision)
            .count(),
        3
    );
    assert!(contributions.iter().all(|c| c.round >= 1 && c.round <= 2));

    // And the revision round was aimed at what the orchestrator actually said.
    let calls = executor.calls.lock().unwrap();
    let revision = calls
        .iter()
        .find(|turn| {
            turn.messages
                .last()
                .unwrap()
                .content
                .contains("still missing")
        })
        .expect("a revision was asked for");
    assert!(revision
        .messages
        .last()
        .unwrap()
        .content
        .contains("The cost estimate cites no source"));
}

#[tokio::test]
async fn it_stops_at_the_round_budget_and_does_not_call_the_result_agreed() {
    let db = Db::open_in_memory().unwrap();
    let workspace_id = workspace_with_three_agents(&db, WorkspaceKind::Boardroom, "Board");
    let workspaces = WorkspaceRepo::new(&db);
    let session = workspaces
        .create_session(&workspace_id, "Ship?", None, Some(2))
        .unwrap();
    assert_eq!(session.max_rounds, 2);

    // Never satisfied, and asking for something different each time so it is
    // the budget that stops it rather than the stall rule.
    let executor = ScriptedExecutor::responding(deliberating(vec![
        "VERDICT: MORE WORK NEEDED\nGAPS:\n- No rollback plan",
        "VERDICT: MORE WORK NEEDED\nGAPS:\n- No owner for the audit",
        "VERDICT: MORE WORK NEEDED\nGAPS:\n- Still nothing on timing",
    ]));
    let finished = SessionRunner::new(&db, &executor)
        .run(&session.id)
        .await
        .unwrap();

    assert_eq!(finished.outcome, Some(SessionOutcome::BudgetSpent));
    assert_eq!(finished.round, 2, "it stopped at the budget, not before");
    assert!(
        !finished.outcome.unwrap().is_agreed(),
        "a result that ran out of road is not an agreed result"
    );
    assert_eq!(
        finished.outstanding,
        vec!["No owner for the audit".to_string()]
    );

    // The chair was told not to write it up as though the group agreed.
    let calls = executor.calls.lock().unwrap();
    let synthesis = calls
        .iter()
        .rev()
        .find(|t| {
            t.messages
                .last()
                .unwrap()
                .content
                .contains("You are chairing")
        })
        .unwrap();
    let prompt = synthesis.messages.last().unwrap().content.clone();
    assert!(prompt.contains("did not settle"), "{prompt}");
    assert!(prompt.contains("ran out of rounds"), "{prompt}");
}

#[tokio::test]
async fn asking_for_the_same_thing_twice_ends_it_rather_than_going_again() {
    // A model that repeats itself will repeat itself for ever. Spending the
    // whole budget on it costs the user minutes for nothing.
    let db = Db::open_in_memory().unwrap();
    let workspace_id = workspace_with_three_agents(&db, WorkspaceKind::Boardroom, "Board");
    let workspaces = WorkspaceRepo::new(&db);
    let session = workspaces
        .create_session(&workspace_id, "Ship?", None, Some(6))
        .unwrap();

    let same = "VERDICT: MORE WORK NEEDED\nGAPS:\n- The cost estimate cites no source";
    let executor = ScriptedExecutor::responding(deliberating(vec![same, same, same, same]));
    let finished = SessionRunner::new(&db, &executor)
        .run(&session.id)
        .await
        .unwrap();

    assert_eq!(finished.outcome, Some(SessionOutcome::Stalled));
    assert_eq!(finished.round, 2, "it did not spend the other four rounds");

    let calls = executor.calls.lock().unwrap();
    let synthesis = calls
        .iter()
        .rev()
        .find(|t| {
            t.messages
                .last()
                .unwrap()
                .content
                .contains("You are chairing")
        })
        .unwrap();
    assert!(synthesis
        .messages
        .last()
        .unwrap()
        .content
        .contains("came back unanswered"));
}

#[tokio::test]
async fn any_team_can_deliberate_not_only_a_boardroom() {
    // Refusing this to an Office was an arbitrary line, and a group of agents
    // arguing towards an answer is what the application is for.
    let db = Db::open_in_memory().unwrap();
    let workspace_id = workspace_with_three_agents(&db, WorkspaceKind::Office, "Q3 Operations");
    let session = WorkspaceRepo::new(&db)
        .create_session(&workspace_id, "Ship?", None, None)
        .unwrap();

    let executor = ScriptedExecutor::responding(deliberating(vec![]));
    let finished = SessionRunner::new(&db, &executor)
        .run(&session.id)
        .await
        .unwrap();
    assert_eq!(finished.outcome, Some(SessionOutcome::Settled));
}

#[tokio::test]
async fn a_round_budget_outside_the_allowed_range_is_refused() {
    let db = Db::open_in_memory().unwrap();
    let workspace_id = workspace_with_three_agents(&db, WorkspaceKind::Boardroom, "Board");
    let workspaces = WorkspaceRepo::new(&db);

    let error = workspaces
        .create_session(&workspace_id, "Ship?", None, Some(0))
        .unwrap_err()
        .to_string();
    assert!(error.contains("between 1 and 6"), "{error}");

    let error = workspaces
        .create_session(&workspace_id, "Ship?", None, Some(99))
        .unwrap_err()
        .to_string();
    assert!(error.contains("between 1 and 6"), "{error}");
}
