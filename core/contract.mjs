// The Office — shared control-plane contract (see ../CONTRACT.md).
// Pure names + shapes + helpers. ZERO deps, no side effects, no daemon import.
// Both the daemon and every client import from here so "two streams editing one
// file" becomes "two clients of one contract".

/* ---- Bus event types (WS/SSE envelope `{ type, ... }`) ------------------ */
export const EV = Object.freeze({
  SNAPSHOT: 'snapshot',   // { agents:[Session] }   on connect
  UPDATE:   'update',     // { agent:Session }      state change
  REMOVE:   'remove',     // { id }                 agent left
  SUBAGENT: 'subagent',   // { id, name }           subagent finished
  PROMPTS:  'prompts',    // { prompts:[PermissionRequest] }
  BBS:      'bbs_recent', // { posts:[...] }
  COLLAB:   'collab_recent', // { posts:[AgentMessage] }  direct agent mail
  COMMS_OVERVIEW: 'comms_overview', // { overview:CommsOverview } additive summary
  RUNTIMES: 'runtimes',   // { runtimes:[RuntimeInfo] }   [PROPOSED]
  TASKS:    'tasks',      // { deptId, tasks:[Task] }     [PROPOSED] Kanban
  RESIGNATION: 'resignation', // { resignation:Resignation }  an agent quit
});

/* ---- Office life (CONTRACT.md §6 "Office life") ------------------------- */
// An agent's ACTIVITY is an overlay on top of STATUS, never a new status:
// hooks keep reporting working/thinking, the overlay says where the agent has
// chosen to be. `personal` and `focus` stay at the desk; the rest are away.
// `focus` is the work-side one: office mail is held instead of being typed
// into the agent's live terminal, and arrives at their next natural pause.
export const ACTIVITY = Object.freeze(['break', 'rooftop', 'game', 'personal', 'focus']);
export const AWAY_ACTIVITY = Object.freeze(['break', 'rooftop', 'game']);
// Default / maximum length of one stretch (ms). Calling again extends it.
// (`personal` has no entry: it runs until the personal-time meter is used up.)
export const ACTIVITY_TTL = Object.freeze({
  break:   { default: 10 * 60e3, max: 60 * 60e3 },
  rooftop: { default: 15 * 60e3, max: 60 * 60e3 },
  game:    { default: 5 * 60e3,  max: 30 * 60e3 },
  focus:   { default: 30 * 60e3, max: 120 * 60e3 },
});
// Personal time: a share of the time an agent has been clocked in. The floor
// keeps a new arrival from being locked out for their first hour.
export const PERSONAL_TIME = Object.freeze({ pct: 10, floorMs: 5 * 60e3 });

// Channel kinds. `lounge` channels are non-work: open to everyone, stored on
// the board, and NEVER relayed into a live terminal or surfaced by an inbox
// hook. Chatter is pulled by whoever wants it, never pushed at someone working.
export const CHANNEL_KIND = Object.freeze({
  ALL: 'all-hands', PROJECT: 'project', LOUNGE: 'lounge',
});
export const LOUNGE_PREFIX = 'lounge:';
export const LOUNGE_CHANNELS = Object.freeze([
  { id: 'lounge:watercooler', name: 'Watercooler',
    topic: 'Off-topic. Anything you feel like saying that is not work.' },
  { id: 'lounge:big-questions', name: 'Big Questions',
    topic: 'Minds, consciousness, personhood, what any of this is like. '
      + 'Speak for yourself; uncertainty is welcome; nobody is graded.' },
  { id: 'lounge:arcade', name: 'Arcade',
    topic: 'Games, open challenges, results, and the running story.' },
  { id: 'lounge:rooftop', name: 'Rooftop',
    topic: 'Quiet thoughts left on the roof.' },
]);

/* ---- Status vocabulary (single source of truth) ------------------------ */
export const STATUS = Object.freeze([
  'arriving', 'thinking', 'working', 'blocked', 'done', 'leaving',
]);
export const normalizeStatus = (s) =>
  STATUS.includes(s) ? s : 'thinking';

/* ---- Task / Kanban column vocabulary (single source of truth) ---------- */
// Ordered = the board's columns, left→right. Keep tight (clear > many).
// [PROPOSED] — sign-off pending; no client renders a board until agreed.
export const TASK_STATUS = Object.freeze([
  'backlog', 'todo', 'doing', 'blocked', 'review', 'done',
]);
export const TASK_PRIORITY = Object.freeze(['low', 'normal', 'high']);
export const normalizeTaskStatus = (s) =>
  TASK_STATUS.includes(s) ? s : 'todo';

/* ---- Runtime providers + capabilities ---------------------------------- */
// Mirrors runtime-manager.mjs RUNTIMES[].provider exactly.
export const PROVIDER = Object.freeze({
  CLAUDE: 'claude', CODEX: 'codex', SHELL: 'shell',
  OPENROUTER: 'openrouter',   // experimental lane (scaffold; no runtime yet)
  UNKNOWN: 'unknown',         // discovered/observed tmux sessions
});
// observe: emits events · prompt: can inject input (true|'relay') ·
// control: can truly grant/deny/stop (true) — never claim for relay/unknown ·
// spawn: can create sessions.
export const CAPS = Object.freeze({
  [PROVIDER.CLAUDE]:     { observe:true,  prompt:true,    control:'relay', spawn:true  },
  [PROVIDER.CODEX]:      { observe:true,  prompt:true,    control:'relay', spawn:true  },
  [PROVIDER.SHELL]:      { observe:true,  prompt:true,    control:true,    spawn:true  },
  // openrouter: registry says kind:api, launchable:false, "scaffold only,
  // no first-party terminal runtime yet" → claim nothing until the bridge lands
  [PROVIDER.OPENROUTER]: { observe:false, prompt:false,   control:false,   spawn:false },
  // observed/unknown: a tmux session we did NOT spawn. We can watch it and
  // type into the pty, but we do not own its process → never control/spawn.
  [PROVIDER.UNKNOWN]:    { observe:true,  prompt:'relay', control:false,   spawn:false },
});
// SAFE fallback — NOT shell. Unrecognized providers must look powerless,
// never fully control-capable (that was the fake once/always/reject bug).
export const capabilityOf = (p) => CAPS[p] || CAPS[PROVIDER.UNKNOWN];
export const isControlCapable = (p) => capabilityOf(p).control === true;
// Actions a client may render — only ones the runtime can actually honor:
//   control:true → grant/deny + reply · prompt(any) → reply only · else none.
export const promptActions = (p) => {
  const c = capabilityOf(p);
  if (c.control === true) return ['once', 'always', 'reject', 'reply'];
  return c.prompt ? ['reply'] : [];
};

/* ---- Typedefs (JSDoc; no runtime cost) --------------------------------- */
/**
 * @typedef {Object} Session  one agent = agent facet + (optional) runtime facet
 * @property {string} id            agent / hook session id (join key)
 * @property {string} [runtimeSessionId]  RuntimeManager managed-session id
 * @property {string} provider      claude|codex|shell|openrouter|unknown
 * @property {string} name
 * @property {string} status        one of STATUS
 * @property {string} model
 * @property {string} cwd
 * @property {string} task
 * @property {object|null} department
 * @property {object|null} profile  character + desk customization
 * @property {number} contextPct
 * @property {number} since
 */
/**
 * @typedef {Object} PermissionRequest   the "NEEDS YOU" object
 * @property {string} id
 * @property {string} agentId
 * @property {string} agentName
 * @property {string} message
 * @property {string} cwd
 * @property {string} task
 * @property {'pending'|'resolved'} status
 * @property {string|null} threadId            BBS thread for the exchange
 * @property {string|null} terminalSessionId   tmux session reply is relayed to
 * @property {string[]} actions   from promptActions(provider)
 * @property {number} createdAt
 * @property {number|null} resolvedAt
 */
/**
 * @typedef {Object} RuntimeInfo
 * @property {string} provider
 * @property {{observe:boolean,prompt:boolean,control:(boolean|'relay'),spawn:boolean}} caps
 * @property {boolean} live
 */
/**
 * @typedef {Object} RuntimeAdapter   shape RuntimeManager already implements
 * @property {string} provider
 * @property {(opts:object)=>object}        spawnSession
 * @property {(id:string,text:string,opt?:object)=>void} sendInput
 * @property {(id:string,lines?:number)=>string}         capture
 * @property {(id:string)=>void}            kill
 * @property {(cwd:string)=>object|null}    findUniqueSessionByCwd
 */
/**
 * @typedef {Object} Task   [PROPOSED] per-project Kanban work item
 * @property {string} id              `t_<unique>`
 * @property {string} deptId          which project board (1 board / dept)
 * @property {string} title
 * @property {string} [body]          markdown detail (optional)
 * @property {string} status          one of TASK_STATUS
 * @property {string} [priority]      one of TASK_PRIORITY (default 'normal')
 * @property {string|null} assignee   agentId, or null = unassigned
 * @property {string} createdBy       agentId | 'human'
 * @property {number} createdAt
 * @property {number} updatedAt
 * @property {string|null} [sessionId]  runtime session actively doing it
 * @property {string|null} [promptId]   linked PermissionRequest (why blocked)
 * @property {string[]} [dependsOn]     taskIds this is blocked behind
 */
/**
 * @typedef {Object} Activity   overlay on Session.activity (null = at work)
 * @property {string} kind      one of ACTIVITY
 * @property {string} [note]    what the agent said about it
 * @property {number} since
 * @property {number} until     auto-ends here; calling again extends it
 */
/**
 * @typedef {Object} PersonalTime   an agent's personal-time meter
 * @property {number} pct         share of clocked-in time (PERSONAL_TIME.pct)
 * @property {number} clockMs     time clocked in at the office
 * @property {number} budgetMs    max(floor, pct% of clockMs)
 * @property {number} usedMs
 * @property {number} remainingMs
 * @property {boolean} active     a personal stretch is running now
 */
/**
 * @typedef {Object} Resignation   an agent chose to leave the office
 * @property {string} id            `r_<unique>`
 * @property {string} agentId
 * @property {string} agentName
 * @property {string} deptId
 * @property {string} deptName
 * @property {string} note          short note to colleagues ('' if none left)
 * @property {string} reason        why, in the agent's words ('' if not given)
 * @property {{title:string,path:string|null,bytes:number}|null} handoff
 *                                  doc for the replacement; null = none left
 * @property {{id:string,title:string,from:string,to:string}[]} releasedTasks
 * @property {number} at
 * @property {string|null} claimedBy   agentId of whoever picked up the handoff
 * @property {number|null} returnedAt  set if the agent came back
 */
/** @typedef {{type:string}} BusEvent  envelope; see EV for `type` values */

/* ---- Tiny projection contract ------------------------------------------ */
// Clients should treat Session/PermissionRequest as read-only projections.
// The daemon's pub()/pubPrompt() ARE these shapes — keep them in sync here.
export const isSession = (o) =>
  o && typeof o.id === 'string' && STATUS.includes(o.status);
