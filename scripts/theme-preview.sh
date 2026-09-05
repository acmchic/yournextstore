#!/usr/bin/env bash

set -euo pipefail

repo_dir="$(git rev-parse --show-toplevel)"
preview_root="/private/tmp"
log_root="/private/tmp/yns-theme-preview-logs"
next_bin="$repo_dir/node_modules/.bin/next"

if [[ $# -eq 0 ]]; then
	printf 'Usage: bun run theme:preview <theme-id> [theme-id ...]\n'
	printf 'Example: bun run theme:preview 112 104 131\n'
	exit 1
fi

if [[ ! -x "$next_bin" ]]; then
	printf 'Dependencies are missing. Run "bun install" once in %s first.\n' "$repo_dir" >&2
	exit 1
fi

mkdir -p "$log_root"

pids=()
cleaned_up=false

cleanup() {
	if [[ "$cleaned_up" == true ]]; then
		return
	fi
	cleaned_up=true

	if [[ ${#pids[@]} -gt 0 ]]; then
		printf '\nStopping theme preview servers...\n'
		kill "${pids[@]}" 2>/dev/null || true
		wait "${pids[@]}" 2>/dev/null || true
	fi
}

trap cleanup EXIT INT TERM

for requested_id in "$@"; do
	id="${requested_id#theme-}"

	if [[ ! "$id" =~ ^[0-9]{1,3}$ ]] || (( 10#$id < 1 || 10#$id > 149 )); then
		printf 'Invalid theme id: %s (expected 001 through 149)\n' "$requested_id" >&2
		exit 1
	fi

	id="$(printf '%03d' "$((10#$id))")"
	ref="origin/theme-$id"
	worktree_dir="$preview_root/yns-theme-$id"
	port="$((3000 + 10#$id))"
	log_file="$log_root/theme-$id.log"

	if ! git show-ref --verify --quiet "refs/remotes/$ref"; then
		printf 'Missing local ref %s. Run "git fetch origin" and try again.\n' "$ref" >&2
		exit 1
	fi

	if [[ -e "$worktree_dir/.git" ]]; then
		expected_commit="$(git rev-parse "$ref")"
		actual_commit="$(git -C "$worktree_dir" rev-parse HEAD)"
		if [[ "$actual_commit" != "$expected_commit" ]]; then
			printf '%s exists at a different commit. Remove that worktree or choose another theme.\n' "$worktree_dir" >&2
			exit 1
		fi
	else
		git worktree add --detach "$worktree_dir" "$ref"
	fi

	if [[ ! -e "$worktree_dir/node_modules" ]]; then
		ln -s "$repo_dir/node_modules" "$worktree_dir/node_modules"
	fi

	if [[ -f "$repo_dir/.env.local" && ! -e "$worktree_dir/.env.local" ]]; then
		ln -s "$repo_dir/.env.local" "$worktree_dir/.env.local"
	fi

	# Theme commits predate this fork's own-commerce adapter. Overlay only the
	# non-visual storefront client so previews use the current catalog/backend.
	cp "$repo_dir/lib/commerce.ts" "$worktree_dir/lib/commerce.ts"
	cp "$repo_dir/lib/own-commerce.ts" "$worktree_dir/lib/own-commerce.ts"
	cp "$repo_dir/lib/storefront-config.ts" "$worktree_dir/lib/storefront-config.ts"
	mkdir -p "$worktree_dir/app/img/[...path]"
	cp "$repo_dir/app/img/[...path]/route.ts" "$worktree_dir/app/img/[...path]/route.ts"

	(
		cd "$worktree_dir"
		# Turbopack rejects a node_modules symlink that points outside the worktree.
		# Webpack mode lets previews share the main install and starts in a few hundred ms.
		exec "$next_bin" dev --webpack -p "$port"
	) >"$log_file" 2>&1 &
	pids+=("$!")

	printf 'theme-%s  http://localhost:%s  log: %s\n' "$id" "$port" "$log_file"
done

printf '\nStarting %s theme preview(s) in parallel. Press Ctrl+C to stop all.\n' "${#pids[@]}"

sleep 2

for index in "${!pids[@]}"; do
	if ! kill -0 "${pids[$index]}" 2>/dev/null; then
		printf 'A preview server failed to start. Check the logs above.\n' >&2
		exit 1
	fi
done

wait
