// ─── Local Semantic Search ────────────────────────────────────────────────────
// TF-IDF cosine similarity with intent-phrase expansion + hybrid retrieval.
// 100% client-side. No embeddings API needed.
// Retrieval pipeline: domain hard-filter → tag/caseType refinement → TF-IDF rank.

import { BYBIT_KB } from '@/data/bybitKB';
import { list as storageList, NAMESPACES } from '@/lib/storage';

// Intent phrases map colloquial support language to Bybit domain terms.
// Used for query expansion during semantic ranking.
const INTENT_EXPANSIONS = [
  { triggers: ['cant log', 'locked out', 'cant access', 'not logging in', 'sign in fail'], expand: 'login account access blocked suspended' },
  { triggers: ['verify', 'id check', 'kyc', 'documents', 'identity', 'passport', 'selfie'], expand: 'KYC verification identity documents' },
  { triggers: ['missing deposit', 'not received', 'deposit missing', 'where is my crypto', 'coin not arrived'], expand: 'deposit blockchain confirmations missing crypto' },
  { triggers: ['withdraw fail', 'cant withdraw', 'withdrawal stuck', 'withdrawal rejected'], expand: 'withdrawal crypto failed blocked' },
  { triggers: ['payment sent buyer', 'seller wont release', 'p2p problem', 'trade dispute', 'peer problem'], expand: 'P2P dispute payment buyer seller escrow' },
  { triggers: ['bank transfer', 'sepa', 'wire transfer', 'eur deposit', 'fiat not arrived', 'euro'], expand: 'SEPA bank fiat deposit EUR Europe' },
  { triggers: ['card declined', 'card fail', 'payment card', 'credit card', 'debit card'], expand: 'card decline payment failed fiat' },
  { triggers: ['hacked', 'unauthorized login', 'someone accessed', 'fraud', 'scam', 'account compromised'], expand: 'security hack unauthorized fraud account' },
  { triggers: ['wrong network', 'sent wrong chain', 'erc20 trc20', 'wrong blockchain', 'lost crypto network'], expand: 'network blockchain wrong chain crypto loss' },
  { triggers: ['eu', 'europe', 'mica', 'gdpr', 'eu regulation', 'uk', 'restricted country'], expand: 'EU MiCA regulation compliance SEPA Europe' },
  { triggers: ['travel rule', 'compliance check', 'source of funds'], expand: 'Travel Rule compliance KYC EDD regulation' },
  { triggers: ['reset 2fa', 'lost authenticator', 'google auth', 'two factor', '2fa'], expand: '2FA Google Authenticator reset security account' },
  { triggers: ['promo', 'campaign', 'bonus', 'reward', 'cashback'], expand: 'campaign promotion bonus reward trading' },
];

// Maps query keywords to domain names. Used when caller doesn't specify a domain
// (Tier 2 — infer domain from the question itself).
const DOMAIN_HINTS = {
  KYC: ['kyc', 'verification', 'verify', 'identity', 'passport', 'selfie', 'edd', 'id check'],
  P2P: ['p2p', 'peer-to-peer', 'dispute', 'appeal', 'buyer', 'seller', 'escrow', 'advertiser', 'merchant'],
  Security: ['hack', 'hacked', 'unauthorized', 'compromised', 'fraud', '2fa', 'phishing', 'reset', 'suspicious login'],
  Crypto: ['blockchain', 'network', 'chain', 'txid', 'tx hash', 'deposit', 'withdraw', 'erc20', 'trc20', 'bep20', 'wrong network'],
  Fiat: ['sepa', 'bank', 'eur', 'fiat', 'iban', 'swift', 'payment provider'],
  Card: ['card', 'decline', 'bybit card', 'apple pay', 'google pay', 'visa', 'mastercard'],
  Account: ['login', 'access', 'suspended', 'limits', 'email change', 'phone change', 'close account'],
};

// Tokenize and normalize text
function tokenize(text) {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

// Count term frequencies
function termFreq(tokens) {
  const tf = {};
  tokens.forEach(t => { tf[t] = (tf[t] || 0) + 1; });
  return tf;
}

// Cosine similarity between two TF maps
function cosineSim(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0, normA = 0, normB = 0;
  keys.forEach(k => {
    const va = a[k] || 0, vb = b[k] || 0;
    dot += va * vb;
    normA += va * va;
    normB += vb * vb;
  });
  return normA && normB ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
}

// Expand query using intent map
function expandQuery(query) {
  const lower = query.toLowerCase();
  const expansions = [];
  INTENT_EXPANSIONS.forEach(({ triggers, expand }) => {
    if (triggers.some(t => lower.includes(t))) expansions.push(expand);
  });
  return query + (expansions.length ? ' ' + expansions.join(' ') : '');
}

// Build article doc vector. Accepts both the bundled BYBIT_KB shape
// (keyPoints/agentTips) and the flatter cloud/Sentinel shape (content).
// Missing fields are silently skipped — tokenize handles empty strings.
function buildDocVector(article) {
  const text = [
    article.title,
    article.subtitle || '',
    article.domain || article.category || '',
    ...(article.domains || []),
    ...(article.tags || []),
    article.caseType || '',
    ...(article.keyPoints || []),
    ...(article.agentTips || []),
    article.content || '',
  ].join(' ');
  return termFreq(tokenize(text));
}

// Bundled KB vectors — computed once, never change per session.
let _bundledVectors = null;
function getBundledVectors() {
  if (!_bundledVectors) {
    _bundledVectors = BYBIT_KB.map(article => ({ article, vector: buildDocVector(article) }));
  }
  return _bundledVectors;
}

// Cloud article vectors — rebuilt when the underlying row set changes.
// Keyed by the article-row count + a rough content hash so Sentinel autosync
// invalidates the cache without a manual reload.
let _cloudVectors = null;
let _cloudCacheKey = '';

function getCloudVectors() {
  const rows = storageList(NAMESPACES.KB).filter(r => r.key.startsWith('article_'));
  const active = rows
    .map(r => r.value)
    .filter(a => a && a.active !== false);
  // Cheap cache key — count + first/last ids. Good enough: if Sentinel upserts
  // a new row or updates an existing one, the key will differ.
  const key = `${active.length}:${active[0]?.id || ''}:${active[active.length - 1]?.id || ''}`;
  if (_cloudVectors && _cloudCacheKey === key) return _cloudVectors;
  _cloudCacheKey = key;
  _cloudVectors = active.map(article => ({
    article: { ...article, source: article.source || 'cloud' },
    vector: buildDocVector(article),
  }));
  return _cloudVectors;
}

// Combined doc set — bundled + cloud. Used for every retrieval call.
function getDocVectors() {
  return [...getBundledVectors(), ...getCloudVectors()];
}

// Infer candidate domains from a free-text query (Tier 2 fallback)
export function inferDomains(query) {
  if (!query?.trim()) return [];
  const lower = query.toLowerCase();
  const hits = [];
  for (const [domain, keywords] of Object.entries(DOMAIN_HINTS)) {
    if (keywords.some(k => lower.includes(k))) hits.push(domain);
  }
  return hits;
}

// Does an article belong to any of the provided domains?
// Checks both `domain` (singular, legacy) and `domains` (array, new).
function articleMatchesDomain(article, domainList) {
  if (!domainList?.length) return true;
  if (domainList.includes(article.domain)) return true;
  if (article.domains?.some(d => domainList.includes(d))) return true;
  return false;
}

// Does an article match any of the provided tags?
function articleMatchesTags(article, tagList) {
  if (!tagList?.length) return true;
  if (!article.tags?.length) return false;
  return article.tags.some(t => tagList.includes(t));
}

// ═══ MAIN RETRIEVAL API ═════════════════════════════════════════════════════════
//
// Hybrid retrieval pipeline — use this for ACE prompt injection.
//
// Tier 1: Domain hard-filter (if `domains` passed, only those articles qualify).
// Tier 2: If no domain passed, infer from query; if nothing infers, search everything.
// Tier 3: Optional tag filter within the domain subset.
// Tier 4: TF-IDF cosine rank + intent expansion → top `limit` articles.
//
// Fallback: if a filter yields fewer than 3 candidates, widen the net rather
// than starve the model of context.
//
// Params:
//   query   — the user's message (string)
//   options — { domains?, tags?, caseType?, limit?, minCandidates? }
//
// Returns: ranked array of KB articles (length ≤ limit).

export function retrieveArticles(query, options = {}) {
  const {
    domains,
    tags,
    caseType,
    limit = 5,
    minCandidates = 3,
  } = options;

  if (!query?.trim()) return [];

  const allDocs = getDocVectors();

  // Tier 1: domain hard-filter (if caller provided domains)
  let candidates = allDocs;
  let effectiveDomains = domains;

  // Tier 2: if no domains passed, try inferring from the query
  if (!effectiveDomains?.length) {
    const inferred = inferDomains(query);
    if (inferred.length) effectiveDomains = inferred;
  }

  if (effectiveDomains?.length) {
    const filtered = allDocs.filter(d => articleMatchesDomain(d.article, effectiveDomains));
    // Fallback: if domain filter is too aggressive, go back to all docs
    if (filtered.length >= minCandidates) candidates = filtered;
  }

  // Tier 3: tag filter (soft — only applies if any articles in the candidate set have tags)
  if (tags?.length) {
    const tagFiltered = candidates.filter(d => articleMatchesTags(d.article, tags));
    if (tagFiltered.length >= minCandidates) candidates = tagFiltered;
  }

  // Tier 3b: case type filter (exact match on SOP code)
  if (caseType) {
    const ctFiltered = candidates.filter(d => d.article.caseType === caseType);
    if (ctFiltered.length >= 1) candidates = ctFiltered;
  }

  // Tier 4: semantic rank with intent expansion
  const expanded = expandQuery(query);
  const qv = termFreq(tokenize(expanded));

  return candidates
    .map(({ article, vector }) => ({ article, score: cosineSim(qv, vector) }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(r => r.article);
}

// Legacy export — unchanged signature for existing callers (semanticSearch(query, limit))
export function semanticSearch(query, limit = 5) {
  return retrieveArticles(query, { limit });
}
