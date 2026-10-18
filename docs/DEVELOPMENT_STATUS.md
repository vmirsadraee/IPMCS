# IPMCS Development Status

## Project Direction
Build a robust, resume-worthy Project Management Control System inspired
by established project-control practices and NASA handbooks.

Quality and sound execution logic take priority over rushing or UI polish.

## Latest Confirmed Git Milestone
- Branch: main
- Commit: 40ccd7b
- Message: Add task execution reports and readiness integration
- Remote: origin/main
- Last confirmed state: local main and origin/main were aligned.

## Implemented and Previously Tested

### Task / WBS
- Hierarchical tasks and weighted progress.
- Supported progress types: manual, quantity, weighted.
- Top-level task weights must total 100.
- Included child task weights must total 100 for weighted parents.

### Dependencies and Execution Readiness
- TaskDependency model and dependency/readiness logic exist.
- Readiness states include Ready and Blocked.
- Successor readiness propagation has been implemented.
- Do not rebuild this subsystem unless a concrete defect is found.

### Execution Reports
- Periodic execution reports are stored by task and report date.
- Duplicate reports for the same task/date are rejected.
- An opening execution baseline is retained.
- Actual cumulative quantity = opening baseline + periodic report quantities.
- Quantity corrections retain a history and require a reason.
- Previously tested in an isolated database:
  opening quantity 50 + reports 120 and 150 = 320;
  correcting 120 to 130 produces 330;
  correction history is retained;
  duplicate task/date is rejected with HTTP 409.
- Frontend build and Python compilation previously passed.
- User confirmed the execution-report UI and Correct action work.

## Current Known Git State
- Latest confirmed commit: 40ccd7b.
- `backend/backups/` appears as untracked and is intentionally not committed.
- No other working-tree changes were shown in the latest status output.
- Recheck Git state when beginning a new coding session; do not assume
  uncommitted changes have been committed.

## Immediate Next Phase
Move forward with execution constraints and how they affect task readiness.
First identify the existing implementation and extend it without duplicating
the dependency/readiness engine.

Potential scope:
1. Define practical execution constraints for a task.
2. Determine how constraints affect Ready/Blocked and blocking reasons.
3. Support multiple constraints where appropriate.
4. Test the behavior with isolated test data.
5. Update this file when the milestone and test results are confirmed.

Do not expand scope into costs or unrelated UI polish during this phase.

## Working Rules
- Do not repeat completed phases without a specific bug or requirement.
- Git history and this file are the project handoff reference.
- Preserve the real SQLite database and backup files.
- Prefer isolated tests before testing against real project data.
- Commit stable milestones, not every small edit.
- For code changes, provide complete updated files, exact changed line
  numbers, a concise explanation, and test commands.
- Default UI language: English; Persian is also supported.
- Keep desktop control-center and mobile monitoring needs in mind,
  but prioritize execution logic first.

## Session Handoff
At the end of each meaningful session, update this file with:
- completed work;
- files changed;
- tests run and their results;
- commit hash if committed;
- the single next task.
