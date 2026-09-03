//! Workspaces: Chat, Office, Lab, Boardroom, Think Tank.

use serde::{Deserialize, Serialize};
use std::fmt;

use crate::error::{DomainError, DomainResult};
use crate::ids::Timestamp;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkspaceKind {
    Chat,
    Office,
    Lab,
    Boardroom,
    ThinkTank,
}

impl WorkspaceKind {
    pub const ALL: [WorkspaceKind; 5] = [
        WorkspaceKind::Chat,
        WorkspaceKind::Office,
        WorkspaceKind::Lab,
        WorkspaceKind::Boardroom,
        WorkspaceKind::ThinkTank,
    ];

    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Chat => "chat",
            Self::Office => "office",
            Self::Lab => "lab",
            Self::Boardroom => "boardroom",
            Self::ThinkTank => "think_tank",
        }
    }

    pub const fn display_name(self) -> &'static str {
        match self {
            Self::Chat => "Chat",
            Self::Office => "Office",
            Self::Lab => "Lab",
            Self::Boardroom => "Boardroom",
            Self::ThinkTank => "Think Tank",
        }
    }

    pub const fn purpose(self) -> &'static str {
        match self {
            Self::Chat => "A conversation with one selected model or agent.",
            Self::Office => "A standing team of agents doing repeated operational work.",
            Self::Lab => "A place to test prompts, models and agent settings safely.",
            Self::Boardroom => "A structured decision session ending in a chair's synthesis.",
            Self::ThinkTank => "Research and ideation, separating sourced claims from speculation.",
        }
    }

    /// Whether the workspace runs a structured multi-agent session rather than
    /// a free conversation.
    pub const fn is_session_based(self) -> bool {
        matches!(self, Self::Boardroom | Self::ThinkTank)
    }

    pub fn parse(value: &str) -> DomainResult<Self> {
        Self::ALL
            .into_iter()
            .find(|k| k.as_str() == value)
            .ok_or_else(|| {
                DomainError::validation("workspace_kind", format!("unknown kind {value:?}"))
            })
    }
}

impl fmt::Display for WorkspaceKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workspace {
    pub id: String,
    pub kind: WorkspaceKind,
    pub name: String,
    pub description: String,
    pub icon: String,
    /// Instructions shared by every agent in this workspace.
    pub shared_instructions: String,
    pub knowledge_source_ids: Vec<String>,
    /// The Office executive / Boardroom chair / Think Tank editor.
    pub coordinator_agent_id: Option<String>,
    pub favorite: bool,
    pub archived: bool,
    pub created_at: Timestamp,
    pub updated_at: Timestamp,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceMember {
    pub workspace_id: String,
    pub agent_id: String,
    /// The job title this agent holds in this workspace.
    pub job_role: String,
    pub is_coordinator: bool,
    pub ordinal: u32,
}

/// The stages a deliberation moves through.
///
/// Positions and Critique repeat: each round after the first replaces
/// Positions with Revision, and Review is where the orchestrator decides
/// whether to send the team round again.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SessionStage {
    /// Each participant states an independent position or proposal.
    Positions,
    /// Participants challenge each other's assumptions.
    Critique,
    /// The orchestrator decides whether this is good enough, and if not says
    /// exactly what is missing.
    Review,
    /// Each participant revises its position against what the orchestrator
    /// said was missing.
    Revision,
    /// The chair or editor writes the synthesis.
    Synthesis,
    Completed,
    Failed,
}

impl SessionStage {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Positions => "positions",
            Self::Critique => "critique",
            Self::Review => "review",
            Self::Revision => "revision",
            Self::Synthesis => "synthesis",
            Self::Completed => "completed",
            Self::Failed => "failed",
        }
    }

    /// The stage that follows this one when the deliberation is not going
    /// round again. Whether it goes round again is the orchestrator's call at
    /// `Review`, not something a state machine can know, so `Review` points at
    /// `Synthesis` here and the engine sends it back to `Revision` when the
    /// orchestrator asks for more.
    pub const fn next(self) -> Option<Self> {
        match self {
            Self::Positions | Self::Revision => Some(Self::Critique),
            Self::Critique => Some(Self::Review),
            Self::Review => Some(Self::Synthesis),
            Self::Synthesis => Some(Self::Completed),
            Self::Completed | Self::Failed => None,
        }
    }

    pub fn parse(value: &str) -> DomainResult<Self> {
        match value {
            "positions" => Ok(Self::Positions),
            "critique" => Ok(Self::Critique),
            "review" => Ok(Self::Review),
            "revision" => Ok(Self::Revision),
            "synthesis" => Ok(Self::Synthesis),
            "completed" => Ok(Self::Completed),
            "failed" => Ok(Self::Failed),
            other => Err(DomainError::validation(
                "stage",
                format!("unknown stage {other:?}"),
            )),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: String,
    pub workspace_id: String,
    pub question: String,
    pub stage: SessionStage,
    pub chair_agent_id: Option<String>,
    /// Written by the chair at the Synthesis stage.
    pub synthesis: Option<String>,
    pub dissent_summary: Option<String>,
    pub unresolved_questions: Vec<String>,
    pub recommended_decision: Option<String>,
    /// Which round the deliberation is on, counting from 1.
    #[serde(default = "one")]
    pub round: u32,
    /// The backstop: how many rounds it may run before it stops and reports
    /// what it has. Not the stopping rule — the orchestrator's judgment is.
    #[serde(default = "default_max_rounds")]
    pub max_rounds: u32,
    /// Why it ended. `None` while it is still running.
    #[serde(default)]
    pub outcome: Option<SessionOutcome>,
    /// What the orchestrator said was still missing, the last time it looked.
    #[serde(default)]
    pub outstanding: Vec<String>,
    pub created_at: Timestamp,
    pub updated_at: Timestamp,
}

fn one() -> u32 {
    1
}

/// Three rounds by default: enough for a position, a challenge to it, and a
/// revision that answers the challenge.
pub const DEFAULT_MAX_ROUNDS: u32 = 3;

/// Above this a deliberation costs more time than any answer is worth,
/// especially against a model running on the user's own machine.
pub const MAX_ROUNDS_CEILING: u32 = 6;

fn default_max_rounds() -> u32 {
    DEFAULT_MAX_ROUNDS
}

/// Why a deliberation stopped.
///
/// Only `Settled` means the orchestrator was satisfied. A synthesis produced
/// under either of the others is the best the team had when it ran out of
/// road, and must never be shown as though it were agreed.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SessionOutcome {
    /// The orchestrator judged the answer good enough.
    Settled,
    /// A round said nothing the round before it had not already said.
    /// Going again would spend time without buying anything.
    Stalled,
    /// It ran out of rounds while the orchestrator still wanted more.
    BudgetSpent,
}

impl SessionOutcome {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Settled => "settled",
            Self::Stalled => "stalled",
            Self::BudgetSpent => "budget_spent",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "settled" => Some(Self::Settled),
            "stalled" => Some(Self::Stalled),
            "budget_spent" => Some(Self::BudgetSpent),
            _ => None,
        }
    }

    /// Whether the result may be described as agreed.
    pub const fn is_agreed(self) -> bool {
        matches!(self, Self::Settled)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ClaimKind {
    /// Backed by a citation from an authorised source.
    Sourced,
    /// The agent's own reasoning, explicitly not a sourced fact.
    Speculation,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionContribution {
    pub id: String,
    pub session_id: String,
    pub agent_id: String,
    pub agent_name: String,
    pub stage: SessionStage,
    /// Which round this was said in, counting from 1.
    #[serde(default = "one")]
    pub round: u32,
    pub content: String,
    pub claim_kind: ClaimKind,
    #[serde(default)]
    pub citations: Vec<crate::chat::Citation>,
    pub created_at: Timestamp,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_workspace_kind_is_described() {
        for kind in WorkspaceKind::ALL {
            assert!(!kind.display_name().is_empty());
            assert!(kind.purpose().ends_with('.'));
            assert_eq!(WorkspaceKind::parse(kind.as_str()).unwrap(), kind);
        }
    }

    #[test]
    fn a_deliberation_runs_positions_critique_review_then_synthesis() {
        let mut stage = SessionStage::Positions;
        let mut seen = vec![stage];
        while let Some(next) = stage.next() {
            stage = next;
            seen.push(stage);
        }
        // Review sits between the critique and the write-up: it is where the
        // orchestrator either accepts the answer or sends the team back to
        // Revision, which this walk cannot show because it is a judgment
        // rather than a transition.
        assert_eq!(
            seen,
            vec![
                SessionStage::Positions,
                SessionStage::Critique,
                SessionStage::Review,
                SessionStage::Synthesis,
                SessionStage::Completed
            ]
        );
        assert!(SessionStage::Failed.next().is_none());
    }

    #[test]
    fn only_boardrooms_and_think_tanks_run_sessions() {
        assert!(WorkspaceKind::Boardroom.is_session_based());
        assert!(WorkspaceKind::ThinkTank.is_session_based());
        assert!(!WorkspaceKind::Office.is_session_based());
        assert!(!WorkspaceKind::Chat.is_session_based());
    }

    #[test]
    fn a_revision_round_rejoins_at_the_critique() {
        assert_eq!(SessionStage::Revision.next(), Some(SessionStage::Critique));
    }

    #[test]
    fn only_a_settled_deliberation_may_be_called_agreed() {
        assert!(SessionOutcome::Settled.is_agreed());
        assert!(!SessionOutcome::Stalled.is_agreed());
        assert!(!SessionOutcome::BudgetSpent.is_agreed());
    }

    #[test]
    fn every_outcome_survives_a_trip_through_the_database() {
        for outcome in [
            SessionOutcome::Settled,
            SessionOutcome::Stalled,
            SessionOutcome::BudgetSpent,
        ] {
            assert_eq!(SessionOutcome::parse(outcome.as_str()), Some(outcome));
        }
        assert_eq!(SessionOutcome::parse("something else"), None);
    }

    #[test]
    fn every_stage_survives_a_trip_through_the_database() {
        for stage in [
            SessionStage::Positions,
            SessionStage::Critique,
            SessionStage::Review,
            SessionStage::Revision,
            SessionStage::Synthesis,
            SessionStage::Completed,
            SessionStage::Failed,
        ] {
            assert_eq!(SessionStage::parse(stage.as_str()).unwrap(), stage);
        }
    }
}
