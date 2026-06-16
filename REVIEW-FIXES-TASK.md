# ACE — Fixes + Alibaba Cloud Integration

## Phase 1 — Low-risk fixes
- [x] 1. ESLint config: disable react/prop-types, react-in-jsx-scope; add node env for config files
- [x] 2. Fix hooks bugs: CoachChat (App.jsx) conditional useMemo
- [x] 3. Fix Trajectory.jsx conditional useMemo
- [x] 4. Rename useQuickPrompt -> applyQuickPrompt (MultiChat.jsx)
- [x] 5. Clean dead imports/vars (no-unused-vars)
- [x] 6. Remove empty nordicvoice-forge/
- [x] 7. npm audit fix
- [x] 8. Verify lint clean + build passes

## Phase 2 — Security: serverless LLM proxy
- [x] 9. Create api/llm.js Vercel serverless proxy (Claude + OpenAI + Alibaba)
- [x] 10. Keys server-side via env vars (per-provider)
- [x] 11. Refactor claude.js / openai.js to call proxy instead of provider directly
- [x] 12. Keep PII scrub client-side before send (defense in depth)

## Phase 3 — Alibaba Cloud (DashScope) provider
- [x] 13. src/api/alibaba.js — OpenAI-compatible, intl endpoint
- [x] 14. Models: qwen3.7-max, qwen3.7-plus, deepseek-v4-flash, qwen-max, qwen-plus
- [x] 15. Wire into provider routing + Settings UI (key + model picker)
- [x] 16. Update gate hasAnyApiKey to include Alibaba

## Phase 4 — Supabase auth gating (replace passphrase gate)
- [x] 17. Real auth gate: require Supabase session instead of hardcoded hash
- [x] 18. Keep browse-mode fallback decision
- [x] 19. Update gate.js + Layout/App entry

## Verify
- [x] build (clean) + lint (0 errors, 13 react-refresh warnings) — verified
