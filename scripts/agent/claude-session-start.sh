#!/usr/bin/env bash
# Claude Code SessionStart hook (.claude/settings.json). Claude Code sources
# $CLAUDE_ENV_FILE before every Bash tool call, so the shell is fixed here once
# per session instead of in every command.
#
# 1. fnm's `--use-on-cd` alias. The agent's shell snapshot keeps `cd` aliased
#    to __fnmcd but not fnm's per-shell variables, so its `fnm use` fails and
#    returns non-zero: `cd dir && cmd` silently skipped `cmd`. Drop the alias.
# 2. Node 24 (.node-version) first on PATH, so npm's child processes cannot
#    fall back to an older system Node.
set -u

[ -n "${CLAUDE_ENV_FILE:-}" ] || exit 0

root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
want="$(tr -d '[:space:]' < "$root/.node-version" 2>/dev/null)"

fnm_dir="${FNM_DIR:-}"
if [ -z "$fnm_dir" ]; then
  if [ -n "${APPDATA:-}" ]; then
    fnm_dir="$APPDATA/fnm"
  else
    fnm_dir="${XDG_DATA_HOME:-$HOME/.local/share}/fnm"
  fi
fi
if command -v cygpath >/dev/null 2>&1; then
  fnm_dir="$(cygpath -u "$fnm_dir")"
fi

node_bin=""
if [ -n "$want" ]; then
  install="$(ls -1d "$fnm_dir"/node-versions/v"$want".*/installation 2>/dev/null | sort -V | tail -1)"
  if [ -x "$install/node.exe" ]; then
    node_bin="$install"
  elif [ -x "$install/bin/node" ]; then
    node_bin="$install/bin"
  fi
fi

{
  echo 'unalias cd 2>/dev/null || true'
  if [ -n "$node_bin" ]; then
    printf 'export PATH="%s:$PATH"\n' "$node_bin"
  fi
} >> "$CLAUDE_ENV_FILE"

if [ -n "$node_bin" ]; then
  echo "Bash tool: Node $("$node_bin/node" --version 2>/dev/null) from fnm is first on PATH; use Bash, not PowerShell, for npm."
else
  echo "Bash tool: no fnm Node $want install found; follow docs/LOCAL_DEVELOPMENT.md before running npm."
fi
