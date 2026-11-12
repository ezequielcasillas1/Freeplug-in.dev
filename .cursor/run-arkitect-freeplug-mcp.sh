#!/usr/bin/env bash
# Launches Arkitect MCP v2.1.1 (GitHub portable) scoped to Freeplug-in.dev.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_ROOT="${REPO_ROOT}/freeplug-landing"
VENDOR_DIR="${REPO_ROOT}/.arkitect/vendor"
ZIP_NAME="arkitect-mcp-server-2.1.1-portable.zip"
RELEASE_URL="https://github.com/ezequielcasillas1/Arkitect-MCP.AI/releases/download/v2.1.1/arkitect-mcp-server-2.1.0-portable.zip"
PORTABLE_DIR="${VENDOR_DIR}/arkitect-mcp-server-2.1.0-portable"
STDIO="${PORTABLE_DIR}/dist/stdio.js"

if [[ ! -f "${STDIO}" ]]; then
  mkdir -p "${VENDOR_DIR}"
  tmp="${VENDOR_DIR}/${ZIP_NAME}"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL -o "${tmp}" "${RELEASE_URL}"
  else
    wget -q -O "${tmp}" "${RELEASE_URL}"
  fi
  unzip -q -o "${tmp}" -d "${VENDOR_DIR}"
fi

export ARKITECT_DEFAULT_REPO_PATH="${APP_ROOT}"
export ARKITECT_HOST_REPO_PATH="${REPO_ROOT}"
export ARKITECT_ANALYZER="${ARKITECT_ANALYZER:-mock}"
export ARKITECT_SKIP_DESKTOP_BRIDGE="${ARKITECT_SKIP_DESKTOP_BRIDGE:-1}"
export ARKITECT_REPORT_DIR="${ARKITECT_REPORT_DIR:-${REPO_ROOT}/.arkitect/reports}"
export ARKITECT_AUDIT_FAIL_THRESHOLD="${ARKITECT_AUDIT_FAIL_THRESHOLD:-high}"

# Build-only public env for verify_codebase (no secrets). Override in cloud agent secrets if needed.
export NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-https://YOUR_PROJECT.supabase.co}"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ARKITECT_BUILD_PLACEHOLDER_ANON_KEY}"
export NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-http://127.0.0.1:3000}"

exec node "${STDIO}"
