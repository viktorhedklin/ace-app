// ─── Local Semantic Search ────────────────────────────────────────────────────
// TF-IDF cosine similarity with intent-phrase expansion.
// 100% client-side. No embeddings API needed.
// "User intent" language → Bybit KB article matches.

import { BYBIT_KB } from '@/data/bybitKB';

// Intent phrases map colloquial support language to Bybit domain terms
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

// Build article doc vector (title + subtitle + domain + keyPoints + agentTips)
function buildDocVector(article) {
  const text = [
    article.title,
    article.subtitle || '',
    article.domain,
    ...(article.keyPoints || []),
    ...(article.agentTips || []),
  ].join(' ');
  return termFreq(tokenize(text));
}

// Lazily built — computed once per session
let _docVectors = null;
function getDocVectors() {
  if (!_docVectors) {
    _docVectors = BYBIT_KB.map(article => ({ article, vector: buildDocVector(article) }));
  }
  return _docVectors;
}

// Main export — search by user intent, returns ranked KB articles
export function semanticSearch(query, limit = 5) {
  if (!query?.trim()) return [];
  const expanded = expandQuery(query);
  const qv = termFreq(tokenize(expanded));
  return getDocVectors()
    .map(({ article, vector }) => ({ article, score: cosineSim(qv, vector) }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(r => r.article);
}
