// ─── NVIDIA side-feature toggles ────────────────────────────────────────────
// Both features route scrubbed text to NVIDIA's free-tier NIM endpoint, which
// logs/trains on all inputs+outputs and disclaims customer-facing use. Off by
// default — Viktor opts in knowingly per Settings' disclosure.

const QA_CRITIC_KEY = 'ace_nvidia_qa_critic_enabled';
const WEB_KNOWLEDGE_KEY = 'ace_nvidia_web_knowledge_enabled';

export function isQaCriticEnabled() {
  return localStorage.getItem(QA_CRITIC_KEY) === 'true';
}

export function setQaCriticEnabled(on) {
  localStorage.setItem(QA_CRITIC_KEY, on ? 'true' : 'false');
}

export function isWebKnowledgeEnabled() {
  return localStorage.getItem(WEB_KNOWLEDGE_KEY) === 'true';
}

export function setWebKnowledgeEnabled(on) {
  localStorage.setItem(WEB_KNOWLEDGE_KEY, on ? 'true' : 'false');
}
