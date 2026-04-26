---
name: secure-build
description: Use when adding, modifying, or reviewing code that touches authentication, API credentials, user data, external service integrations, or the PII scrubbing boundary. Also use for any security audit request ("audit this", "is this safe?", "check for vulnerabilities"). Triggers include new env vars, new API client code, changes to auth flows, changes to data that leaves the local machine, or any request for a security review. This skill enforces the lessons from the Ace co-pilot Base44 removal audit.
---

# Secure Build — audit-in-the-loop

This skill codifies the security patterns that came out of Ace's Base44 removal audit. Use it both proactively (while writing code) and reactively (when asked to review).

## The core invariants for Ace (and any similar local AI tool)

1. **No secrets in committed files.** API keys live in env vars, the OS keychain, or input prompts. Never in `.json`, `.md`, `.ts`, or `.env.example` as real values. `.env` files are in `.gitignore` or nothing is safe.
2. **No unscrubbed data leaves the machine.** Every outbound API call that includes user/customer content must pass through the PII scrubber. Audit this at every integration point, not just the main one.
3. **Authentication at every external boundary.** If the app exposes any HTTP endpoint (even on localhost), it requires auth. "It's just local" is not a security model — other processes on the machine can still hit localhost.
4. **Explicit data flow.** For any user-supplied input, you should be able to trace on paper: input → validation → scrubbing → storage/transmission → output. If any step is fuzzy, that's where the bug will be.

## Audit checklist (run this on every significant change)

**Secrets**
- [ ] Any hardcoded strings matching `sk-`, `fc-`, `ghp_`, `pk_`, `AKIA`, UUIDs, or long hex?
- [ ] Any `.env` files with real values that could get committed?
- [ ] Is the config reading from process.env at runtime, not at build time?

**Data flow**
- [ ] Does every outbound HTTP call pass through the scrubber for user-generated content?
- [ ] Is there logging that might capture raw PII before scrubbing?
- [ ] Are error messages sanitized before being returned to the UI / written to disk?

**Auth & access**
- [ ] Are there any endpoints/IPC handlers without auth?
- [ ] Can another process on the same machine connect and read/write state?
- [ ] Are file permissions on stored credentials restrictive (0600, not 0644)?

**Dependencies**
- [ ] Are new packages from trusted publishers? (check npm publisher, download counts, recent activity)
- [ ] Does the dependency pull in network-capable sub-dependencies unexpectedly?
- [ ] Is the lockfile committed and pinned?

**Error handling**
- [ ] Any silent catches (`catch (e) {}`)?
- [ ] Do error paths leak sensitive info in messages or stack traces?
- [ ] Is there a retry loop that could hammer an API and leak usage patterns?

## Severity rubric

- **Critical**: secret exposure, unscrubbed PII leaving machine, unauthenticated endpoint, RCE path. Stop and fix now.
- **High**: partial PII leak (e.g. in logs), missing rate limit on sensitive op, dependency from untrusted source. Fix before next release.
- **Medium**: weak error sanitization, missing test coverage on security path, unnecessary permission grant. Fix this sprint.
- **Low**: style issue, missing doc comment on security-relevant function. Fix when convenient.

## Common false positives

- "The API key is in the config but it's loaded from env" → confirm the env var actually resolves at runtime before raising.
- "This catch block looks silent" → confirm it's not rethrown further up the stack before flagging.
- "This endpoint has no auth" → confirm it's actually exposed externally, not a dev-only IPC handler on a random high port.

## When running a full audit

Use `sequential-thinking` MCP for multi-file audits. Structure the final report as:

1. **Scope**: what was audited (files, commits, features)
2. **Findings**: table of Critical / High / Medium / Low with file:line references
3. **Recommendations**: concrete fixes, in priority order
4. **Open questions**: things you couldn't determine without more context

Cross-validate critical findings with a second approach (e.g. grep + manual read + ast analysis) before reporting them — Ace's Base44 audit found a real critical issue that could have been missed without this.

## Things to never do

- Never auto-apply a "fix" for a critical security issue without showing Viktor the diff first.
- Never suggest disabling a security check to make a test pass — find the real cause.
- Never report findings with certainty above what the evidence supports. "Potential issue in X, needs Viktor to confirm data flow" is better than "Critical: X is exposed" when you haven't traced it end-to-end.