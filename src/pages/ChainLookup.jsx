import { useState } from 'react';
import { Search } from 'lucide-react';

const CHAINS = [
  { name: 'Bitcoin', symbol: 'BTC', network: 'BTC', icon: '₿', confirmations: 1, minDeposit: '0.0001', minWithdrawal: '0.001', withdrawalFee: '0.0004', memo: false, speed: 'Slow (10–60 min)', notes: 'Original blockchain. Segwit addresses (bc1...) are recommended.' },
  { name: 'Ethereum', symbol: 'ETH', network: 'ERC-20', icon: 'Ξ', confirmations: 6, minDeposit: '0.01', minWithdrawal: '0.01', withdrawalFee: '0.003', memo: false, speed: 'Medium (2–10 min)', notes: 'Supports ETH and all ERC-20 tokens. Check token contract address.' },
  { name: 'TRON', symbol: 'TRX', network: 'TRC-20', icon: '🔺', confirmations: 20, minDeposit: '1', minWithdrawal: '1', withdrawalFee: '1', memo: false, speed: 'Fast (1–3 min)', notes: 'Most popular for USDT. Very low fees. No memo required.' },
  { name: 'BNB Smart Chain', symbol: 'BNB', network: 'BEP-20', icon: '🟡', confirmations: 15, minDeposit: '0.01', minWithdrawal: '0.01', withdrawalFee: '0.0005', memo: false, speed: 'Fast (1–5 min)', notes: 'BEP-20 only — NOT BEP-2. Common confusion point.' },
  { name: 'Ripple', symbol: 'XRP', network: 'XRP', icon: '💎', confirmations: 6, minDeposit: '10', minWithdrawal: '0.25', withdrawalFee: '0.25', memo: true, speed: 'Fast (3–10 sec)', notes: '⚠️ MEMO/Destination Tag is MANDATORY. Missing memo = permanent loss.' },
  { name: 'Stellar', symbol: 'XLM', network: 'XLM', icon: '⭐', confirmations: 1, minDeposit: '1', minWithdrawal: '1', withdrawalFee: '0.01', memo: true, speed: 'Fast (3–5 sec)', notes: '⚠️ MEMO is mandatory for Stellar deposits.' },
  { name: 'Solana', symbol: 'SOL', network: 'SOL', icon: '◎', confirmations: 1, minDeposit: '0.01', minWithdrawal: '0.01', withdrawalFee: '0.01', memo: false, speed: 'Very Fast (<1 min)', notes: 'SPL tokens. Very fast finality.' },
  { name: 'Polygon', symbol: 'MATIC', network: 'MATIC', icon: '🟣', confirmations: 200, minDeposit: '1', minWithdrawal: '0.1', withdrawalFee: '0.1', memo: false, speed: 'Fast (2–5 min)', notes: 'High confirmation count (200) is normal for Polygon.' },
  { name: 'Avalanche C-Chain', symbol: 'AVAX', network: 'AVAX-C', icon: '🔴', confirmations: 20, minDeposit: '0.1', minWithdrawal: '0.1', withdrawalFee: '0.01', memo: false, speed: 'Fast (1–3 min)', notes: 'C-Chain only. NOT X-Chain or P-Chain.' },
  { name: 'Optimism', symbol: 'OP', network: 'OP', icon: '🔵', confirmations: 15, minDeposit: '0.01', minWithdrawal: '0.01', withdrawalFee: '0.001', memo: false, speed: 'Fast (1–5 min)', notes: 'L2 on Ethereum. Bridge withdrawals to L1 take 7 days.' },
  { name: 'Arbitrum One', symbol: 'ARB', network: 'ARB', icon: '🔷', confirmations: 15, minDeposit: '0.01', minWithdrawal: '0.01', withdrawalFee: '0.001', memo: false, speed: 'Fast (1–5 min)', notes: 'L2 on Ethereum. Fast deposits; bridge exit takes 7 days.' },
  { name: 'Litecoin', symbol: 'LTC', network: 'LTC', icon: '🩶', confirmations: 4, minDeposit: '0.001', minWithdrawal: '0.01', withdrawalFee: '0.001', memo: false, speed: 'Fast (2–5 min)', notes: 'Faster than Bitcoin with lower fees.' },
  { name: 'Dogecoin', symbol: 'DOGE', network: 'DOGE', icon: '🐕', confirmations: 6, minDeposit: '10', minWithdrawal: '5', withdrawalFee: '5', memo: false, speed: 'Medium (5–10 min)', notes: 'Popular meme coin. Lower confirmations needed.' },
  { name: 'Cardano', symbol: 'ADA', network: 'ADA', icon: '💠', confirmations: 15, minDeposit: '1', minWithdrawal: '1', withdrawalFee: '1', memo: false, speed: 'Medium (5–15 min)', notes: 'Cardano native chain.' },
  { name: 'Polkadot', symbol: 'DOT', network: 'DOT', icon: '⚫', confirmations: 10, minDeposit: '1', minWithdrawal: '1', withdrawalFee: '0.1', memo: false, speed: 'Medium (5–10 min)', notes: 'Substrate-based. Not EVM compatible.' },
];

export default function ChainLookup() {
  const [search, setSearch] = useState('');
  const [memoOnly, setMemoOnly] = useState(false);

  const filtered = CHAINS.filter(c => {
    const q = search.toLowerCase();
    const match = !q || c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q) || c.network.toLowerCase().includes(q);
    return match && (!memoOnly || c.memo);
  });

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100">🔗 Chain Lookup</h1>
        <p className="text-sm text-slate-500">Network info, confirmations, minimums and key notes</p>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 flex items-center gap-2 bg-slate-900 border border-slate-700 focus-within:border-yellow-400/50 rounded-xl px-4 py-3">
          <Search size={15} className="text-slate-500 shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, symbol or network..."
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 outline-none"
          />
        </div>
        <button
          onClick={() => setMemoOnly(!memoOnly)}
          className={`px-4 rounded-xl text-sm font-medium transition-all border ${memoOnly ? 'bg-red-500/20 border-red-500/40 text-red-400' : 'bg-slate-900 border-slate-700 text-slate-400'}`}
        >
          ⚠️ Memo required
        </button>
      </div>

      {/* Memo warning banner */}
      {memoOnly && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300">
          ⚠️ These networks require a MEMO/Tag. Missing memo = funds likely unrecoverable. Always verify before processing.
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              {['Network', 'Symbol', 'Confirmations', 'Min Deposit', 'Min Withdraw', 'Fee', 'Memo', 'Speed', 'Notes'].map(h => (
                <th key={h} className="text-left pb-3 pr-4 text-xs text-slate-500 font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {filtered.map(chain => (
              <tr key={chain.symbol} className="hover:bg-slate-900/50 transition-colors">
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{chain.icon}</span>
                    <div>
                      <p className="font-medium text-slate-100 whitespace-nowrap">{chain.name}</p>
                      <p className="text-xs text-slate-500">{chain.network}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3 pr-4 font-mono text-yellow-400 font-medium">{chain.symbol}</td>
                <td className="py-3 pr-4 text-slate-300">{chain.confirmations}</td>
                <td className="py-3 pr-4 text-slate-300">{chain.minDeposit}</td>
                <td className="py-3 pr-4 text-slate-300">{chain.minWithdrawal}</td>
                <td className="py-3 pr-4 text-slate-300">{chain.withdrawalFee}</td>
                <td className="py-3 pr-4">
                  {chain.memo
                    ? <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded font-medium">YES ⚠️</span>
                    : <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">No</span>
                  }
                </td>
                <td className="py-3 pr-4 text-slate-400 whitespace-nowrap text-xs">{chain.speed}</td>
                <td className="py-3 text-xs text-slate-500 max-w-xs">{chain.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-center text-slate-600 py-8">No chains match your search</p>
        )}
      </div>
    </div>
  );
}
