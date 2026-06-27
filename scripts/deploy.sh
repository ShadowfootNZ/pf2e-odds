#!/usr/bin/env bash

set -euo pipefail

required_vars=(
  SSH_HOST
  SSH_USER
  REMOTE_PATH
  SSH_PRIVATE_KEY
)

for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "Missing required environment variable: ${var_name}" >&2
    exit 1
  fi
done

SSH_PORT="${SSH_PORT:-22}"
DEPLOY_DIR="${DEPLOY_DIR:-.}"
SSH_STRICT_HOST_KEY_CHECKING="${SSH_STRICT_HOST_KEY_CHECKING:-no}"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "${tmp_dir}"' EXIT

key_file="${tmp_dir}/deploy_key"

printf '%s\n' "${SSH_PRIVATE_KEY}" > "${key_file}"
chmod 600 "${key_file}"

ssh_opts=(
  -i "${key_file}"
  -p "${SSH_PORT}"
  -o BatchMode=yes
  -o StrictHostKeyChecking="${SSH_STRICT_HOST_KEY_CHECKING}"
)

ssh "${ssh_opts[@]}" "${SSH_USER}@${SSH_HOST}" "mkdir -p '${REMOTE_PATH}'"
ssh "${ssh_opts[@]}" "${SSH_USER}@${SSH_HOST}" "find '${REMOTE_PATH}' -mindepth 1 -maxdepth 1 -exec rm -rf {} +"

tar \
  --create \
  --gzip \
  --file - \
  --directory "${DEPLOY_DIR}" \
  --exclude ".git" \
  --exclude ".github" \
  --exclude ".DS_Store" \
  --exclude ".claude" \
  --exclude "scripts" \
  . | ssh "${ssh_opts[@]}" "${SSH_USER}@${SSH_HOST}" "tar -xzf - -C '${REMOTE_PATH}'"

echo "Deploy complete: ${SSH_USER}@${SSH_HOST}:${REMOTE_PATH}"
