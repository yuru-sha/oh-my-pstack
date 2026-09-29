# Portable pstack runtime contract

This file is the host-neutral binding for the imported pstack skills. Read it before
using any instruction that mentions a task runner, model, transcript, question tool,
skill path, or long-running loop.

## Host selection

Use an explicit host identity supplied by the active runtime, when available. Never
identify the current host from `command -v` or the presence of a CLI executable:
those only show installation, not which agent owns the current session. Do not
infer host identity from undocumented environment variables. If the active runtime
does not identify itself, report the host as unknown and use only capabilities
verified from the live tool inventory.

For OMP, the task tool's live agent inventory is authoritative. The bundled OMP
task agents are `scout`, `reviewer`, `security-reviewer`, `task`, and `sonic`;
project, user, and extension agents can add names. Never treat a canonical pstack
role as a host agent name without applying the OMP mapping.

When a capability is unavailable, preserve the workflow gate and use the nearest
truthful local equivalent. Do not claim a child, review, transcript, or live check
happened unless the host reported it.

## Canonical roles

| pstack role | Required behavior |
| --- | --- |
| `explorer` | Read-only repository reconnaissance and trace reduction. |
| `watcher` | Observe one exact state transition, then terminate. |
| `planner` | Technical architecture, decomposition, and sequencing. |
| `designer` | Product, interaction, or alternative design candidates. |
| `reviewer` | Independent code, protocol, behavioral, or security review. |
| `researcher` | Source-verified external documentation and API research. |
| `synthesizer` | Adjudicate frozen reports without changing their evidence. |
| `implementer` | Bounded implementation or test changes with explicit ownership. |
| `owner` | One coupled implementation session retained through its lifecycle. |
| `mechanical` | Fully specified low-judgment edits. |

Map these roles using the live host's agent or task names. OMP's bundled task
agents are `scout`, `reviewer`, `security-reviewer`, `task`, and `sonic`.
Project, user, and extension agents may add names. The live inventory wins.
The OMP adapter maps `explorer` and `watcher` to `scout`, `reviewer` and
`synthesizer` to `reviewer`, implementation and general roles to `task`, and
low-judgment mechanical work to `sonic`. `planner`, `designer`, and `researcher`
map to `task` with their canonical role preserved in the brief. Do not pass
canonical role labels directly as agent names. Stop if a canonical role has no
adapter mapping. Claude Code and Codex may expose different names.

Every child brief must stand alone. It must name its goal, role, writable scope,
acceptance criteria, verification command, forbidden scope, and report format. A
child does not spawn another child unless the host explicitly supports nested
delegation and the active playbook requires it.

## Models

Model inventory is not model delegation. A host may list models that the current
conversation can use without exposing any task or subagent facility that can send
a child to one of those models. Native Pi has this boundary: `pi --list-models`
and `/model` select the single active conversation model, while Pi does not
include built-in subagents.

For native Pi, install the maintained `pi-subagents` package when per-role models
or parallel children are required:

```bash
pi install npm:pi-subagents
```

Restart Pi and run `/subagents-doctor`. Once the `subagent` tool is visible,
configure its `subagents.agentOverrides` in `.pi/settings.json`. The package's
built-in agents map to pstack roles as follows: `scout` for `explorer` and
`watcher`, `researcher` for `researcher`, `worker` for `implementer` and
`mechanical`, `reviewer` for `reviewer`, `oracle` for planning and synthesis, and
`delegate` for an `owner`.

Use concrete `provider/model-id` values only when the host exposes per-child model
selection and the value was confirmed in the live inventory. Use role aliases only
when the host explicitly documents a role-to-model mapping. `inherit-parent` means
the current conversation's model only when the host can pass it to a child. A
missing role entry means the host default. A panel is a list of role or model
choices, and its size controls fan-out.

When the host has models but no child delegation, do not write a role mapping that
looks active. Report the capability gap and tell the user to switch Pi's single
active model with `/model` or `pi --model provider/model-id`. Workflow skills still
run on that active model, but panel and child-agent behavior is unavailable unless
the user installs a host extension or uses a different runtime that provides it.

The optional configuration path is `$PSTACK_CONFIG`. If it is unset, use
`.pstack/config.md` in the current project for project-local settings. Do not write
to a vendor-specific home directory unless the host explicitly asks for it.

## OMP child model provenance

Report configured, resolved, and invoked models as separate facts. Child self-report
is not runtime evidence.

| Evidence | Source | Meaning |
|---|---|---|
| Configured | `.omp/config.yml` `task.agentModelOverrides`, agent definition, or `modelRoles` | Expected routing only. It does not prove that a child ran or which model it invoked. |
| Resolved | Child session JSONL `model_change` and `resolvedModelIsFallback` | The model OMP resolved for that child session, with fallback state when recorded. |
| Invoked | Assistant `message.provider` and `message.model`; `model_usage` with `purpose` and `role` | Assistant message metadata identifies each invocation. Keep auxiliary usage records separate. |
| Self-reported | Child text | A claim by the child. Never use it to override persisted runtime evidence. |

After an OMP Task finishes:

1. Record the child task ID returned by `task`.
2. Locate the matching `<task-id>.jsonl` in the parent's session artifact directory. The
   filename uses the task ID, such as `ProvenanceChild.jsonl`. Read its session header
   and confirm `parentSession` points to the parent session file. For `/path/parent.jsonl`,
   the artifact directory is `/path/parent/`. A parent without a persisted session may
   use a temporary artifact directory.
3. Inspect every `model_change` entry in order. Preserve its `role`, `model`, and
   `resolvedModelIsFallback`. If fallback metadata is absent, report it as unknown,
   never as `false`. A role-specific entry such as `subagent:<task-id>` identifies
   the child assignment.
4. Inspect each `model_usage` entry and keep its `purpose` and `role`. Inspect
   assistant `message` entries for `provider`, `model`, and `usage`.
5. Report assistant invocation models in chronological order. Keep repeated entries
   when the model changes away and back. Summarize one model only when every
   invocation agrees. Keep auxiliary `model_usage` calls separate.
6. Compare the configured selector, resolved entries, and invocation records. Do
   not infer fallback from a difference between configured and invoked values.

The test-only JSONL fixture in `scripts/omp-session-provenance.test.mjs` covers these
entry types, missing fields, auxiliary usage, and model transitions. The workflow
still reads the persisted child session as its runtime evidence.

When only configuration is available, report `resolved: unavailable`,
`invoked: unavailable`, and `fallback: unknown`. If the JSONL lacks a particular
event type, report only that field as unavailable and retain other observed
provenance. If the child JSONL cannot be located or contains no model evidence,
report `unavailable`; do not substitute `.omp/config.yml`, Task's textual output,
or the child's self-report.

When reporting model routing, use a compact record with `phase`, `agent`,
`canonical role`, `configured`, `resolved`, `invoked`, `fallback`, and `evidence`.
Keep every model transition when a child used more than one invocation model.
Do not require every workflow to print a provenance table.

OMP refreshes task routing settings before each Task spawn. A prior controlled
same-parent test confirmed that changing `task.agentModelOverrides` applies to
subsequently spawned children. This does not claim that OMP reloads every setting
or changes an already running child.

## Questions and interaction

Use the host's structured user-interaction tool when it exists. Otherwise ask one
focused question in the normal conversation. Never invent a vendor-specific question
tool name.
An observable fact belongs to a probe or verification run, not a user question.

## Skills and paths

Invoke skills by their host-supported name, normally `/skill:<name>` or `$name`.
Read a skill with the host's resource reader using `skill://<skill-name>`. For a
file under that skill, use `skill://<skill-name>/<relative-path>`. The first path
segment is always the actual skill name, not the name of the currently active
skill. Resolve relative Markdown links against the file that contains them; do
not turn a relative path into a URI prefixed with the active skill name.
A Python REPL's `%load` loads source into Python; it does not invoke a skill.
Use the host's skill invocation or resource reader instead of passing a skill URI
to `%load`.

Within this package, sibling files are under `skills/<name>/`. Do not use a
vendor-specific plugin path or assume a global installation path.

OpenCode's native Agent Skills loader looks in `.opencode/skills/` for a project or
`~/.config/opencode/skills/` globally. When installing this repository for
OpenCode, copy the contents of this package's `skills/` directory into one of
those locations. OpenCode loads a skill on demand through its native `skill`
tool; it does not automatically scan an arbitrary cloned repository directory.
OpenCode's built-in primary and subagents are the delegation surface. Use the
host's `opencode.json` or `opencode.jsonc` model configuration and live agent
inventory rather than assuming Pi's `pi-subagents` settings apply.

## Transcripts and history

Transcript-dependent skills accept an explicit transcript directory or host history
resource. Prefer `$PSTACK_TRANSCRIPTS_DIR` when the host does not expose a history
resource. Never scan another project or a global vendor transcript tree. If no
transcript source is available, report the gap and continue only with evidence that
does not require it.

## Long-running work and verification

Use the host's durable goal, watcher, or loop facility when available. Otherwise keep
the predicate and checkpoint in a project-local decision trail. A timed heartbeat is
only a fallback. Re-arm a watcher after every state-changing wave.

The root coordinator owns user interaction, approvals, integration, and final
verification. A worker report is evidence, not proof. The root must inspect artifacts
and run the promised checks on the integrated result.

## OMP Task workspace roots (v18.4.2)

In the checked OMP v18.4.2 runtime, a Task's cwd comes from the parent session
unless native isolation is selected. Creating an OMP worktree does not rebind the
parent session or a later Task; relative file-tool paths follow the child session
root. A result path such as `local://...` or `agent://...` is an artifact channel,
not evidence of the child's cwd or source root.

The Task API has no caller-supplied cwd or existing-worktree path. `isolated:true`
creates an OMP-managed temporary root from the parent repository at dispatch.
Record the task ID and parent root/HEAD. When a child session log is available,
verify its `cwd` and `parentSession`, the child's Git root/HEAD, and actual
resolved file-tool paths before accepting changes. Treat returned patch/branch
paths as result artifacts, not workspace roots.

Native `isolated:true` is available only when the live Task schema exposes it and
`task.isolation.enabled` is true, with plan mode off. It separates workspace roots;
it is not a Git worktree or OS filesystem sandbox, and does not promise containment
for absolute paths, `..`, symlinks, or external effects. To keep a verification
run from auto-applying successful isolated changes, set
`task.isolation.apply: false` in OMP settings. This is a setting, not a Task item
argument; its default is `true`. Inspect returned patch or branch metadata and
integrate deliberately.

Single writers may use the current checkout; shared read-only work and research
alongside one writer need no worktree. Concurrent writers require separate actual
execution roots or proven non-overlapping write sets. If neither is available,
fail closed rather than dispatching writers into a shared checkout.

Before dispatch, capture this parent baseline:

```bash
git rev-parse --show-toplevel
git rev-parse HEAD
git status --porcelain=v1 --untracked-files=all
git diff --binary HEAD | git hash-object --stdin
```

Repeat and compare all four outputs after children finish. The digest covers
tracked content, including dirty files; status lists untracked paths, not their
content. Git status and diff omit ignored files and external state. Preserve or
fingerprint any untracked or ignored/generated path the child may touch. If the
parent changes unexpectedly, stop and preserve the evidence; do not auto-revert.
