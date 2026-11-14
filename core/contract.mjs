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
  // ---- driven sessions (server/harness; additive, see docs/HARNESS.md) ----
  HARNESS:      'harness',       // { sessions:[DrivenSession], wake }   on connect + whenever one changes
  TRANSCRIPT:   'transcript',    // { sessionId, agentId, entry }        to clients watching that session
  DELEGATIONS:  'delegations',   // { delegation }                       a delegated task changed
  // ---- how much is left per provider (server/usage.mjs; additive) ----
  USAGE:        'usage',         // { usage:UsageSnapshot }              on connect + whenever a meter changes
  // ---- who is working where (server/workspace.mjs; additive) ----
  WORKSPACE:    'workspace',     // { workspace:WorkspaceSnapshot }      on connect + when branches, files, claims or overlaps change
  // ---- office life (server/life.mjs; additive) ----
  RESIGNATION:  'resignation',   // { resignation:Resignation }          an agent quit the office, or came back
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

/* ---- Office life (server/life.mjs; CONTRACT.md "Office life") ---------- */
// What an agent has chosen to be doing besides (or instead of) the work in
// front of it. It is an overlay — `Session.activity`, null most of the time —
// and never a STATUS: hooks keep reporting working/thinking underneath it.
//   break · rooftop · game   away from the desk (the world walks them there)
//   personal · focus         at the desk
// While any of them is on, office mail is held instead of being typed at the
// agent or allowed to start a turn for it.
export const ACTIVITY = Object.freeze(['break', 'rooftop', 'game', 'personal', 'focus']);
export const AWAY_ACTIVITY = Object.freeze(['break', 'rooftop', 'game']);
// Default / longest single stretch, in ms. Asking again extends it.
// (`personal` has no entry: it runs until the personal-time meter is used up.)
export const ACTIVITY_TTL = Object.freeze({
  break:   Object.freeze({ default: 10 * 60e3, max: 60 * 60e3 }),
  rooftop: Object.freeze({ default: 15 * 60e3, max: 60 * 60e3 }),
  game:    Object.freeze({ default: 5 * 60e3,  max: 30 * 60e3 }),
  focus:   Object.freeze({ default: 30 * 60e3, max: 120 * 60e3 }),
});
// Personal time: a share of the time an agent has been clocked in, with a
// floor so a new arrival is not locked out for its first hour.
export const PERSONAL_TIME = Object.freeze({ pct: 10, floorMs: 5 * 60e3 });

// Channel kinds. A `lounge` channel is not work: it has no members, so nothing
// posted there is relayed, counted as mail, or able to wake anyone. It is read
// by whoever chooses to read it.
export const CHANNEL_KIND = Object.freeze({ ALL: 'all-hands', PROJECT: 'project', LOUNGE: 'lounge' });
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
].map((c) => Object.freeze(c)));

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

// A DRIVEN session is one the office runs itself over a structured protocol
// (ACP, Codex app-server) instead of typing into a terminal. Capability then
// follows HOW the session is run, not which provider it is: the same Claude is
// `control:'relay'` in tmux and `control:true` when driven, because only then
// can the office really answer its permission requests and stop its turns.
// `control:true` means "can grant, deny and stop when asked" — it does not mean
// the agent asks before everything; that depends on the mode it runs in.
export const DRIVEN_CAPS = Object.freeze({ observe: true, prompt: true, control: true, spawn: true });
const ENDED_CAPS = Object.freeze({ observe: false, prompt: false, control: false, spawn: false });
export const capabilityFor = (session) => {
  if (session && session.kind === 'driven') return session.alive ? DRIVEN_CAPS : ENDED_CAPS;   // no process, no power
  return capabilityOf(session?.provider);
};
// What a NEEDS-YOU card may offer. Grant/deny buttons belong to a request an
// agent is waiting on RIGHT NOW (`prompt.request`), never to a session in general.
export const GRANT_ACTIONS = Object.freeze(['once', 'always', 'reject']);
export const requestActions = (request) =>
  (request && request.pending && Array.isArray(request.choices)
    ? request.choices.map((c) => c.action).filter((a) => GRANT_ACTIONS.includes(a)) : []);

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
 * @property {Activity|null} [activity]  office life: where the agent has chosen to be (null = simply at work)
 */
/**
 * @typedef {Object} Activity
 * @property {string} kind      one of ACTIVITY
 * @property {string} [note]    what the agent said about it
 * @property {number} since
 * @property {number} until     it ends by itself here; asking again extends it
 */
/**
 * @typedef {Object} PersonalTime   an agent's personal-time meter
 * @property {number} pct         share of clocked-in time (0 = switched off)
 * @property {number} clockMs     time clocked in
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
 * @property {string} note          short note to colleagues ('' if none was left)
 * @property {string} reason        why, in the agent's words ('' if not given)
 * @property {{title:string,path:string|null,bytes:number}|null} handoff
 *                                  the doc for whoever takes the work on; null = none was left
 * @property {{id:string,title:string,from:string,to:string}[]} releasedTasks
 * @property {number} at
 * @property {string|null} claimedBy   agent id of whoever picked the handoff up
 * @property {number|null} returnedAt  set if the agent came back
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
 * @property {string[]} actions   from promptActions(provider) — or, with a `request`, from requestActions(request)
 * @property {object|null} [request]  the live request of a driven session this prompt stands for:
 *           { id, sessionId, kind:'permission'|'question', pending, category, tool, toolKind, title, command, paths,
 *             detail, choices:[{action,label,scope?}], options:[{id,name,kind}], questions? }
 * @property {{summary:string, tool:string, toolKind:string, command:string, files:string[], detail:string,
 *             category:string, questions:object[]}} [ask]      what is being asked, as plain fields (every prompt)
 * @property {{method:string, url:string, textField:string, reaches:('agent'|'turn'|'terminal'|'inbox'|null),
 *             humanOnly?:boolean, thisMachineOnly?:boolean,
 *             actions:Array<{id:string, kind:string, label:string, text:('none'|'optional'|'required'), body:object,
 *                            scope?:string, covers?:string}>}} [respond]   every way to answer it, with the call to make
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
