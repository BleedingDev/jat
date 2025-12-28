#!/bin/bash
#
# Extract timing data from a HAR file (removes response bodies)
# Usage: extract-har-timings.sh input.har > timings.json
#

HAR_FILE="${1:-}"

if [[ -z "$HAR_FILE" ]] || [[ ! -f "$HAR_FILE" ]]; then
    echo "Usage: $0 <har-file>" >&2
    echo "Output: JSON with URL, method, status, timing info (no response bodies)" >&2
    exit 1
fi

jq '[.log.entries[] | {
  url: .request.url,
  method: .request.method,
  status: .response.status,
  time_ms: .time,
  timings: .timings,
  started: .startedDateTime,
  size: .response.content.size
}] | sort_by(-.time_ms)' "$HAR_FILE"
