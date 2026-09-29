# Short-lived typing activity with continuing authorization

PetPal shows generic typing activity only inside the active conversation. Sharing defaults on and can be disabled by the participant; the preference controls outgoing activity without hiding activity from others.

Authenticated RPCs derive the participant from the session and recheck membership, account availability, blocks and conversation lifecycle on every read or write. Direct client access to typing rows is denied. The database holds at most one current row per conversation and participant, containing a server timestamp and no draft text, keystrokes or history. Explicit stop deletes that row; activity older than six seconds is ignored.

The client polls the active visible thread approximately every two seconds and refreshes outgoing activity at most every three seconds. Stops bypass that throttle. Local expiry removes stale indicators even when the next request fails. Background, offline, account and thread changes stop timers and invalidate late responses; typing failures never block ordinary messages.

This accepts modest indicator latency and a small RPC polling cost in exchange for checking current authorization instead of treating earlier realtime channel membership as continuing permission. It uses the existing Supabase infrastructure and adds no presence service.
