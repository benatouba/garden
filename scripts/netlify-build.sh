#!/usr/bin/env bash
set -euo pipefail

if [ -z "${OBSIDIAN_SOURCE_GIT_TOKEN:-}" ] && [ -n "${GITHUB_TOKEN:-}" ]; then
  export OBSIDIAN_SOURCE_GIT_TOKEN="$GITHUB_TOKEN"
fi

npm ci --prefer-offline
npm run build:vivere
