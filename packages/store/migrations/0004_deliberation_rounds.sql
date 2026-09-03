-- A session becomes a deliberation that can run more than once round.
--
-- The old shape was three stages in a fixed line: positions, critique,
-- synthesis, done. The chair wrote up whatever came back and never got to say
-- "this is not good enough yet". These columns let the orchestrator send the
-- team round again, aimed at the gaps it names, and let the record say which
-- round each contribution belongs to.
--
-- Every column has a default that reproduces the old behaviour for rows that
-- already exist: a finished single-round session reads as round 1 of 1.

ALTER TABLE sessions ADD COLUMN round INTEGER NOT NULL DEFAULT 1;

-- The backstop, not the stopping rule. The orchestrator's own judgment ends a
-- deliberation; this is what stops it running all night when that judgment
-- never arrives.
ALTER TABLE sessions ADD COLUMN max_rounds INTEGER NOT NULL DEFAULT 3;

-- Why it stopped: 'settled' (the orchestrator was satisfied), 'stalled' (a
-- round added nothing the round before it had not already said), or
-- 'budget_spent' (it ran out of rounds while still unsettled). NULL until it
-- finishes. A synthesis produced under anything but 'settled' must never be
-- presented as agreed.
ALTER TABLE sessions ADD COLUMN outcome TEXT;

-- What the orchestrator said was still missing, the last time it looked.
ALTER TABLE sessions ADD COLUMN outstanding TEXT NOT NULL DEFAULT '[]';

ALTER TABLE session_contributions ADD COLUMN round INTEGER NOT NULL DEFAULT 1;
CREATE INDEX idx_contributions_round ON session_contributions(session_id, round, ordinal);

-- Show the Deliberations tab to people who already have preferences saved.
--
-- The visible tabs are a stored list, so a screen added after someone first
-- ran the application is invisible to them for ever unless it is put there.
-- This is a one-time append: hide it afterwards and it stays hidden, because
-- nothing re-adds it.
UPDATE settings
   SET value = json_insert(value, '$.visible_tabs[#]', 'deliberations')
 WHERE key = 'preferences'
   AND json_valid(value)
   AND json_type(value, '$.visible_tabs') = 'array'
   AND NOT EXISTS (
         SELECT 1 FROM json_each(settings.value, '$.visible_tabs')
          WHERE json_each.value = 'deliberations'
       );
