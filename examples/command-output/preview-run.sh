#!/bin/sh

if [ "$#" -eq 0 ]; then
  printf '%s\n' 'Usage: sh preview-run.sh command [argument ...]' >&2
  exit 64
fi

log=$(umask 077 && mktemp "${TMPDIR:-/tmp}/command-output.XXXXXX") || {
  printf '%s\n' 'Could not create output log; command was not run.' >&2
  exit 125
}

printf 'Full output: %s\n' "$log" >&2
if "$@" >"$log" 2>&1; then
  result=0
else
  result=$?
fi

if ! head -n 120 "$log"; then
  printf '%s\n' 'Could not display preview; full output remains in the log.' >&2
fi

exit "$result"
