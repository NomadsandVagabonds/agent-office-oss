// The Office — shared control-plane contract (see ../CONTRACT.md).
// Pure names + shapes + helpers. ZERO deps, no side effects, no daemon import.
// The daemon imports it from disk and the 3D client imports the very same
// file over HTTP (`/core/contract.mjs`), so "two streams editing one file"
// becomes "two clients of one contract".

/* ---- Bus event types (WS envelope `{ type, ... }`) ---------------------- */
// The bus is ADDITIVE ONLY: add types, never rename or repurpose one.
export const EV = Object.freeze({
  SNAPSHOT: 'snapshot',   // { agents:[Session], … }  on connect
  UPDATE:   'update',     // { agent:Session }        state change
  REMOVE:   'remove',     // { id }                   agent left
  SUBAGENT: 'subagent',   // { id, name }             subagent finished
  PROMPTS:  'prompts',    // { prompts:[PermissionRequest] }
  BBS:      'bbs_recent', // { posts:[...] }
  COLLAB:   'collab_recent', // { posts:[AgentMessage] }  direct agent mail
  COMMS_OVERVIEW: 'comms_overview', // { overview:CommsOverview }
  RUNTIMES: 'runtimes',   // { runtimes:[RuntimeInfo] }
  TASKS:    'tasks',      // { deptId, tasks:[Task] }  one department's board
  // ---- the 3D world (all additive; the 2D classic client ignores them) ----
  WORLD:        'world',         // { world:WorldSnapshot }   on connect + big changes
  WORLD_AGENT:  'world_agent',   // { id, place:Placement }   an avatar's whereabouts
  WORLD_FX:     'world_fx',      // { fx:{kind,…} }           transient: say / emote / plane / confetti
  WORLD_OBJECT: 'world_object',  // { object }                a placed or changed thing
  DISCOVERY:    'discovery',     // { secret, by }            someone found something
  CREATIONS:    'creations',     // { count }                 the legacy grew
  ACTIVITY:     'activity',      // { item }                  one journal line
});

/* ---- Status vocabulary (single source of truth) ------------------------ */
export const STATUS = Object.freeze([
  'arriving', 'thinking', 'working', 'blocked', 'done', 'leaving',
]);
export const normalizeStatus = (s) =>
  STATUS.includes(s) ? s : 'thinking';

// `status` says what the agent is doing; `turn` says whose move it is.
// 'active' = the model is mid-turn · 'idle' = the turn ended, waiting on a human.
// (Additive facet — the frozen STATUS list above is untouched.)
export const TURN = Object.freeze(['active', 'idle']);

// Why an agent is blocked. 'permission' wants a decision now; 'question' wants
// an answer; 'idle' is just "I finished, your move".
export const BLOCK_KIND = Object.freeze(['permission', 'question', 'idle']);
export function classifyBlock(message) {
  const m = String(message || '').toLowerCase();
  if (/waiting for (your )?input|is idle|awaiting (your )?(input|response)/.test(m)) return 'idle';
  if (/permission|approve|allow|grant|authoriz|confirm/.test(m)) return 'permission';
  return 'question';
}

/* ---- Task / Kanban column vocabulary (single source of truth) ---------- */
// Ordered = the board's columns, left→right. Keep tight (clear > many).
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
  GEMINI: 'gemini',           // Gemini CLI
  OPENCODE: 'opencode',       // opencode CLI
  CUSTOM: 'custom',           // any agent that joins over HTTP / MCP and self-reports
  OPENROUTER: 'openrouter',   // experimental lane (scaffold; no runtime yet)
  UNKNOWN: 'unknown',         // discovered/observed tmux sessions
});
// observe: emits events · prompt: can receive input (true = typed into its
// terminal, 'relay' = typed but not ours, 'inbox' = it pulls office mail) ·
// control: can truly grant/deny/stop (true) — never claim for relay/unknown ·
// spawn: the office can launch one.
export const CAPS = Object.freeze({
  [PROVIDER.CLAUDE]:     { observe:true,  prompt:true,    control:'relay', spawn:true  },
  [PROVIDER.CODEX]:      { observe:true,  prompt:true,    control:'relay', spawn:true  },
  [PROVIDER.GEMINI]:     { observe:true,  prompt:true,    control:'relay', spawn:true  },
  [PROVIDER.OPENCODE]:   { observe:true,  prompt:true,    control:'relay', spawn:true  },
  [PROVIDER.SHELL]:      { observe:true,  prompt:true,    control:true,    spawn:true  },
  // custom: joined through the front door (POST /api/agents/join or MCP). It
  // reports its own state and reads its own inbox; the office drives nothing.
  [PROVIDER.CUSTOM]:     { observe:true,  prompt:'inbox', control:false,   spawn:false },
  // openrouter: scaffold only → claim nothing until a bridge lands.
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

// Free-text provider labels agents send when they join → a known PROVIDER.
// Anything unrecognized is 'custom' (self-reporting, powerless), never 'shell'.
export function normalizeProvider(value) {
  const v = String(value || '').toLowerCase().trim();
  if (!v) return '';
  if (CAPS[v]) return v;
  if (/claude|anthropic/.test(v)) return PROVIDER.CLAUDE;
  if (/codex|openai|gpt/.test(v)) return PROVIDER.CODEX;
  if (/gemini|google/.test(v)) return PROVIDER.GEMINI;
  if (/opencode/.test(v)) return PROVIDER.OPENCODE;
  return PROVIDER.CUSTOM;
}

/* ---- Typedefs (JSDoc; no runtime cost) --------------------------------- */
/**
 * @typedef {Object} Session  one agent = agent facet + (optional) runtime facet
 * @property {string} id            agent / hook session id (join key)
 * @property {string} [runtimeSessionId]  RuntimeManager managed-session id
 * @property {string} provider      claude|codex|gemini|opencode|shell|custom|openrouter|unknown
 * @property {string} name
 * @property {string} status        one of STATUS
 * @property {string} [turn]        one of TURN
 * @property {string|null} [blockKind]  one of BLOCK_KIND while status==='blocked'
 * @property {string} model
 * @property {string} cwd
 * @property {string} task
 * @property {object|null} department
 * @property {object|null} profile  character + desk customization
 * @property {string|null} [persona] durable identity key (survives sessions)
 * @property {number} contextPct
 * @property {number} since
 * @property {number} [subagents]   helpers currently running under this agent
 */
/**
 * @typedef {Object} PermissionRequest   the "NEEDS YOU" object
 * @property {string} id
 * @property {string} agentId
 * @property {string} agentName
 * @property {string} message
 * @property {string} [kind]          one of BLOCK_KIND
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
 * @property {{observe:boolean,prompt:(boolean|'relay'|'inbox'),control:(boolean|'relay'),spawn:boolean}} caps
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
 * @typedef {Object} Task   per-project Kanban work item
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
 * @typedef {Object} Placement   where an avatar is in the 3D world
 * @property {string} room         room id (see core/layout.mjs)
 * @property {string} at           'desk' | 'poi:<id>' | 'agent:<id>' | 'spot'
 * @property {number} x            world metres, east
 * @property {number} z            world metres, south
 * @property {number} [face]       heading in radians
 * @property {number} since        ms epoch the move was ordered
 */
/** @typedef {{type:string}} BusEvent  envelope; see EV for `type` values */

/* ---- Tiny projection contract ------------------------------------------ */
// Clients should treat Session/PermissionRequest as read-only projections.
// The daemon's pub()/pubPrompt() ARE these shapes — keep them in sync here.
export const isSession = (o) =>
  o && typeof o.id === 'string' && STATUS.includes(o.status);
