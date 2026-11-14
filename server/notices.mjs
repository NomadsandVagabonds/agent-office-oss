// The Office — notes from the office itself.
//
// Sometimes the office has something to tell one agent that no person said:
// two of you are in the same file, the review of your card came back. Those
// go into a thread of their own per agent ("Office notices for Ada"), which
// the agent reads with the rest of its mail. They are not direct messages:
// nobody is woken by one and no terminal is typed into.

/** Leave a note for one agent. → true if it was written. */
export function leaveNotice(ctx, agent, text) {
  if (!agent?.id || !text) return false;
  const { bbs } = ctx, key = `office:${agent.id}`;
  const thread = bbs.getThreads('collab').find((t) => t.meta?.kind === 'office-notice' && t.meta?.participantKey === key) || null;
  const meta = { toAgentId: agent.id, toAgentName: agent.name, fromAgentName: 'Office', officeNote: true };
  if (thread) bbs.reply({ threadId: thread.id, author: 'Office', authorType: 'system', content: text, meta });
  else bbs.createThread({ board: 'collab', subject: `Office notices for ${agent.name}`, author: 'Office', authorType: 'system', content: text,
    meta: { kind: 'office-notice', participantKey: key, participants: ['office', agent.id], ...meta }, postMeta: meta });
  ctx.comms.broadcastCollabRecent();
  return true;
}
