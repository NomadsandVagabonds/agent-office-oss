#!/bin/sh
# The Office — hook bridge. Registered on Claude Code hook events; forwards
# the event JSON to the local daemon. Designed to NEVER slow down or block a
# session: it fire-and-forgets a curl with tight timeouts and always exits 0.
PORT="${OFFICE_PORT:-4317}"
# OFFICE_URL points remote machines at a central hub (e.g. over Tailscale):
#   export OFFICE_URL=http://my-hub.tailnet:4317
# Defaults to the local daemon when unset.
URL="${OFFICE_URL:-http://localhost:${PORT}}"
HOST="$(hostname -s 2>/dev/null || hostname 2>/dev/null || echo unknown)"
payload="$(cat)"
# Detach so the agent's loop never waits on us, even if the daemon is down.
# Timeouts are generous enough for a Tailscale RTT but irrelevant to the
# session anyway, since the whole curl runs in the background.
(
  printf '%s' "$payload" | curl -s -m 2 --connect-timeout 1 \
    -X POST -H 'content-type: application/json' \
    --data-binary @- "${URL}/hook?host=${HOST}" >/dev/null 2>&1
) &
exit 0
