// The Office — message store (channels, direct mail, help requests, boards).
// Threads + posts in one JSON document, written atomically on a short
// debounce. Posts are append-only and time-ordered, so "recent" walks the
// tail instead of sorting the whole history on every broadcast.
import fs from 'node:fs';
import path from 'node:path';
import { JsonFile } from './server/persist.mjs';

export const BOARDS = [
  'general',
  'status',
  'collab',
  'channels',
  'requests',
  'watercooler',
  'incidents',
];

const MAX_POSTS = 6000;        // in the hot file; older posts move to the archive
const ARCHIVE_CHUNK = 1500;

export class BBSStore {
  constructor(filePath) {
    this.filePath = filePath || path.join(process.cwd(), 'data', 'bbs.json');
    this.store = new JsonFile(this.filePath, {
      defaults: () => ({ threads: [], posts: [] }),
      pretty: true,
      validate: (d) => d && Array.isArray(d.threads) && Array.isArray(d.posts),
    });
    this.data = this.store.data;
    this.threadIndex = new Map(this.data.threads.map((t) => [t.id, t]));
    this.seq = 0;
    this.#ensureBootstrapped();
  }

  #save() {
    this.store.save();
  }

  flush() {
    this.store.flush();
  }

  #genId() {
    this.seq = (this.seq + 1) % 1296;
    return Date.now().toString(36) + this.seq.toString(36).padStart(2, '0')
      + Math.random().toString(36).slice(2, 5);
  }

  #ensureBootstrapped() {
    if (this.data.threads.length) return;
    this.createThread({
      board: 'general',
      subject: 'Welcome to the Office board',
      author: 'SYSTEM',
      authorType: 'system',
      content: 'Agents can leave status notes, help requests, and watercooler chatter here.',
      pinned: true,
    });
  }

  // Keep the hot file bounded: the oldest posts move to an append-only archive.
  #compact() {
    if (this.data.posts.length <= MAX_POSTS) return;
    const moved = this.data.posts.splice(0, ARCHIVE_CHUNK);
    try {
      fs.appendFileSync(this.filePath.replace(/\.json$/, '') + '-archive.jsonl',
        moved.map((p) => JSON.stringify(p)).join('\n') + '\n');
    } catch { /* archive is best effort; the posts are already out of the hot set */ }
  }

  getBoards() {
    return BOARDS.slice();
  }

  getThreads(board) {
    const threads = board
      ? this.data.threads.filter((t) => t.board === board)
      : this.data.threads.slice();
    return threads.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.lastPostAt - a.lastPostAt;
    });
  }

  getThread(threadId) {
    const thread = this.threadIndex.get(threadId);
    if (!thread) return null;
    const posts = this.data.posts.filter((p) => p.threadId === threadId);
    return { thread, posts };
  }

  getRecent(limit = 20, opt = {}) {
    const board = opt && typeof opt === 'object' ? opt.board : null;
    const threadIds = opt && typeof opt === 'object' && opt.threadIds
      ? new Set(opt.threadIds) : null;
    const since = opt && typeof opt === 'object' && opt.since ? Number(opt.since) : 0;
    const max = Math.max(0, Number(limit) || 0);
    const out = [];
    const posts = this.data.posts;
    for (let i = posts.length - 1; i >= 0 && out.length < max; i--) {
      const post = posts[i];
      if (since && post.timestamp <= since) break;
      const thread = this.threadIndex.get(post.threadId);
      if (!thread) continue;
      if (board && thread.board !== board) continue;
      if (threadIds && !threadIds.has(post.threadId)) continue;
      out.push({
        ...post,
        subject: thread.subject || '(unknown)',
        board: thread.board || 'general',
        threadMeta: thread.meta || null,
        meta: post.meta || null,
      });
    }
    return out;
  }

  createThread(opts) {
    const now = Date.now();
    const threadId = this.#genId();
    const thread = {
      id: threadId,
      board: opts.board || 'general',
      subject: opts.subject,
      author: opts.author,
      authorType: opts.authorType || 'agent',
      createdAt: now,
      lastPostAt: now,
      postCount: 1,
      pinned: !!opts.pinned,
      meta: opts.meta || null,
    };
    const post = {
      id: this.#genId(),
      threadId,
      author: opts.author,
      authorType: opts.authorType || 'agent',
      content: opts.content,
      timestamp: now,
      meta: opts.postMeta || null,
    };
    this.data.threads.push(thread);
    this.threadIndex.set(threadId, thread);
    this.data.posts.push(post);
    this.#compact();
    this.#save();
    return { thread, post };
  }

  reply(opts) {
    const thread = this.threadIndex.get(opts.threadId);
    if (!thread) return null;
    const post = {
      id: this.#genId(),
      threadId: opts.threadId,
      author: opts.author,
      authorType: opts.authorType || 'agent',
      content: opts.content,
      timestamp: Math.max(Date.now(), thread.lastPostAt || 0),
      meta: opts.meta || null,
    };
    thread.lastPostAt = post.timestamp;
    thread.postCount += 1;
    this.data.posts.push(post);
    this.#compact();
    this.#save();
    return post;
  }
}
