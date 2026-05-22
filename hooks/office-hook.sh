#!/bin/sh
# The Office — hook bridge. Registered on Claude Code hook events; forwards
# the event JSON to the local daemon. Designed to NEVER slow down or block a
# session: it fire-and-forgets a curl with tight timeouts and always exits 0.
PORT="${OFFICE_PORT:-4317}"
payload="$(cat)"
# Detach so the agent's loop never waits on us, even if the daemon is down.
(
  printf '%s' "$payload" | curl -s -m 0.5 --connect-timeout 0.2 \
    -X POST -H 'content-type: application/json' \
    --data-binary @- "http://localhost:${PORT}/hook" >/dev/null 2>&1
) &
exit 0
