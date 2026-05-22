import fs from 'node:fs';
import path from 'node:path';

export const BOARDS = [
  'general',
  'status',
  'collab',
  'channels',
  'requests',
  'watercooler',
  'incidents',
];

export class BBSStore {
  constructor(filePath) {
    this.filePath = filePath || path.join(process.cwd(), 'data', 'bbs.json');
    this.data = this.#load();
    this.#ensureBootstrapped();
  }

  #load() {
    if (!fs.existsSync(this.filePath)) return { threads: [], posts: [] };
    try { return JSON.parse(fs.readFileSync(this.filePath, 'utf8')); }
    catch { return { threads: [], posts: [] }; }
  }

  #save() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
  }

  #genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
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
    const thread = this.data.threads.find((t) => t.id === threadId);
    if (!thread) return null;
    const posts = this.data.posts
      .filter((p) => p.threadId === threadId)
      .sort((a, b) => a.timestamp - b.timestamp);
    return { thread, posts };
  }

  getRecent(limit = 20, opt = {}) {
    const board = opt && typeof opt === 'object' ? opt.board : null;
    const threadIds = opt && typeof opt === 'object' && opt.threadIds
      ? new Set(opt.threadIds) : null;
    const threadMap = new Map(this.data.threads.map((t) => [t.id, t]));
    return this.data.posts
      .slice()
      .sort((a, b) => b.timestamp - a.timestamp)
      .filter((post) => {
        const thread = threadMap.get(post.threadId);
        if (!thread) return false;
        if (board && thread.board !== board) return false;
        if (threadIds && !threadIds.has(post.threadId)) return false;
        return true;
      })
      .slice(0, limit)
      .map((post) => {
        const thread = threadMap.get(post.threadId);
        return {
          ...post,
          subject: thread?.subject || '(unknown)',
          board: thread?.board || 'general',
          threadMeta: thread?.meta || null,
          meta: post?.meta || null,
        };
      });
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
    this.data.posts.push(post);
    this.#save();
    return { thread, post };
  }

  reply(opts) {
    const thread = this.data.threads.find((t) => t.id === opts.threadId);
    if (!thread) return null;
    const post = {
      id: this.#genId(),
      threadId: opts.threadId,
      author: opts.author,
      authorType: opts.authorType || 'agent',
      content: opts.content,
      timestamp: Date.now(),
      meta: opts.meta || null,
    };
    thread.lastPostAt = post.timestamp;
    thread.postCount += 1;
    this.data.posts.push(post);
    this.#save();
    return post;
  }
}
