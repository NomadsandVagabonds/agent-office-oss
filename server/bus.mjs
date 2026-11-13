// The Office — the bus. Every state change in the office is one envelope
// `{ type, ... }` broadcast to every connected client (see core/contract.mjs
// EV). The bus is additive only: new surfaces are new types, never renames.
//
// It is also an in-process emitter, so server modules (the world, the journal)
// can react to the same events the clients see without knowing who emitted
// them.
import { EventEmitter } from 'node:events';

export class Bus extends EventEmitter {
  /** @param {import('./ws.mjs').WsHub} hub */
  constructor(hub) {
    super();
    this.setMaxListeners(64);
    this.hub = hub;
    this.seq = 0;
  }

  /** Broadcast to all clients and to in-process listeners. */
  broadcast(event) {
    if (!event || typeof event.type !== 'string') return;
    this.seq += 1;
    this.hub.broadcast(event);
    this.#local(event);
  }

  /** Notify in-process listeners only (nothing goes on the wire). */
  local(event) {
    if (!event || typeof event.type !== 'string') return;
    this.#local(event);
  }

  #local(event) {
    try {
      this.emit(event.type, event);
      this.emit('*', event);
    } catch (err) {
      // A listener bug must never take the bus down.
      this.emit('listener-error', err);
    }
  }
}
