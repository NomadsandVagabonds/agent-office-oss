// Shared retention and rate limits for the visitors' book and its stores.
export const KEEP = Object.freeze({ top: 100, latest: 100, showTop: 25, showLatest: 30 });
export const AGAIN = Object.freeze({ hit: 1800, in: 15, sign: 20, same: 90 * 86400 });
