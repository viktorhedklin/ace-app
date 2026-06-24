import { useState } from 'react';
import { Search } from 'lucide-react';

const CHAINS = [
  { name: 'Bitcoin', symbol: 'BTC', network: 'BTC', icon: '₿', confirmations: 1, minDeposit: '0.0001', minWithdrawal: '0.001', withdrawalFee: '0.0004', memo: false, speed: 'Slow (10–60 min)', notes: 'Original blockchain. Segwit addresses (bc1...) are recommended.', explorer: 'https://mempool.space/tx/', explorerName: 'Mempool' },
  { name: 'Ethereum', symbol: 'ETH', network: 'ERC-20', icon: 'Ξ', confirmations: 6, minDeposit: '0.01', minWithdrawal: '0.01', withdrawalFee: '0.003', memo: false, speed: 'Medium (2–10 min)', notes: 'Supports ETH and all ERC-20 tokens. Check token contract address.', explorer: 'https://etherscan.io/tx/', explorerName: 'Etherscan' },
  { name: 'TRON', symbol: 'TRX', network: 'TRC-20', icon: '🔺', confirmations: 20, minDeposit: '1', minWithdrawal: '1', withdrawalFee: '1', memo: false, speed: 'Fast (1–3 min)', notes: 'Most popular for USDT. Very low fees. No memo required.', explorer: 'https://tronscan.org/#/transaction/', explorerName: 'Tronscan' },
  { name: 'BNB Smart Chain', symbol: 'BNB', network: 'BEP-20', icon: '🟡', confirmations: 15, minDeposit: '0.01', minWithdrawal: '0.01', withdrawalFee: '0.0005', memo: false, speed: 'Fast (1–5 min)', notes: 'BEP-20 only — NOT BEP-2. Common confusion point.', explorer: 'https://bscscan.com/tx/', explorerName: 'BscScan' },
  { name: 'Ripple', symbol: 'XRP', network: 'XRP', icon: '💎', confirmations: 6, minDeposit: '10', minWithdrawal: '0.25', withdrawalFee: '0.25', memo: true, speed: 'Fast (3–10 sec)', notes: '⚠️ MEMO/Destination Tag is MANDATORY. Missing memo = permanent loss.', explorer: 'https://xrpscan.com/tx/', explorerName: 'XRPScan' },
  { name: 'Stellar', symbol: 'XLM', network: 'XLM', icon: '⭐', confirmations: 1, minDeposit: '1', minWithdrawal: '1', withdrawalFee: '0.01', memo: true, speed: 'Fast (3–5 sec)', notes: '⚠️ MEMO is mandatory for Stellar deposits.', explorer: 'https://stellarchain.io/tx/', explorerName: 'StellarChain' },
  { name: 'Solana', symbol: 'SOL', network: 'SOL', icon: '◎', confirmations: 1, minDeposit: '0.01', minWithdrawal: '0.01', withdrawalFee: '0.01', memo: false, speed: 'Very Fast (<1 min)', notes: 'SPL tokens. Very fast finality.', explorer: 'https://solscan.io/tx/', explorerName: 'Solscan' },
  { name: 'Polygon', symbol: 'MATIC', network: 'MATIC', icon: '🟣', confirmations: 200, minDeposit: '1', minWithdrawal: '0.1', withdrawalFee: '0.1', memo: false, speed: 'Fast (2–5 min)', notes: 'High confirmation count (200) is normal for Polygon.', explorer: 'https://polygonscan.com/tx/', explorerName: 'PolygonScan' },
  { name: 'Avalanche C-Chain', symbol: 'AVAX', network: 'AVAX-C', icon: '🔴', confirmations: 20, minDeposit: '0.1', minWithdrawal: '0.1', withdrawalFee: '0.01', memo: false, speed: 'Fast (1–3 min)', notes: 'C-Chain only. NOT X-Chain or P-Chain.', explorer: 'https://snowtrace.io/tx/', explorerName: 'Snowtrace' },
  { name: 'Optimism', symbol: 'OP', network: 'OP', icon: '🔵', confirmations: 15, minDeposit: '0.01', minWithdrawal: '0.01', withdrawalFee: '0.001', memo: false, speed: 'Fast (1–5 min)', notes: 'L2 on Ethereum. Bridge withdrawals to L1 take 7 days.', explorer: 'https://optimistic.etherscan.io/tx/', explorerName: 'OP Etherscan' },
  { name: 'Arbitrum One', symbol: 'ARB', network: 'ARB', icon: '🔷', confirmations: 15, minDeposit: '0.01', minWithdrawal: '0.01', withdrawalFee: '0.001', memo: false, speed: 'Fast (1–5 min)', notes: 'L2 on Ethereum. Fast deposits; bridge exit takes 7 days.', explorer: 'https://arbiscan.io/tx/', explorerName: 'Arbiscan' },
  { name: 'Litecoin', symbol: 'LTC', network: 'LTC', icon: '🩶', confirmations: 4, minDeposit: '0.001', minWithdrawal: '0.01', withdrawalFee: '0.001', memo: false, speed: 'Fast (2–5 min)', notes: 'Faster than Bitcoin with lower fees.', explorer: 'https://blockchair.com/litecoin/transaction/', explorerName: 'Blockchair' },
  { name: 'Dogecoin', symbol: 'DOGE', network: 'DOGE', icon: '🐕', confirmations: 6, minDeposit: '10', minWithdrawal: '5', withdrawalFee: '5', memo: false, speed: 'Medium (5–10 min)', notes: 'Popular meme coin. Lower confirmations needed.', explorer: 'https://dogechain.info/tx/', explorerName: 'Dogechain' },
  { name: 'Cardano', symbol: 'ADA', network: 'ADA', icon: '💠', confirmations: 15, minDeposit: '1', minWithdrawal: '1', withdrawalFee: '1', memo: false, speed: 'Medium (5–15 min)', notes: 'Cardano native chain.', explorer: 'https://cardanoscan.io/transaction/', explorerName: 'Cardanoscan' },
  { name: 'Polkadot', symbol: 'DOT', network: 'DOT', icon: '⚫', confirmations: 10, minDeposit: '1', minWithdrawal: '1', withdrawalFee: '0.1', memo: false, speed: 'Medium (5–10 min)', notes: 'Substrate-based. Not EVM compatible.', explorer: 'https://polkadot.subscan.io/extrinsic/', explorerName: 'Subscan' },
  { name: 'Bitcoin Cash', symbol: 'BCH', network: 'BCH', icon: '🟢', confirmations: 12, minDeposit: '0.001', minWithdrawal: '0.001', withdrawalFee: '0.0001', memo: false, speed: 'Medium (5–15 min)', notes: 'BTC fork with larger blocks. Use CashAddr (bitcoincash:...) format.', explorer: 'https://blockchair.com/bitcoin-cash/transaction/', explorerName: 'Blockchair' },
  { name: 'EOS', symbol: 'EOS', network: 'EOS', icon: '⬛', confirmations: 1, minDeposit: '1', minWithdrawal: '1', withdrawalFee: '0.1', memo: true, speed: 'Fast (<1 min)', notes: '⚠️ MEMO required — usually the destination account name.', explorer: 'https://bloks.io/transaction/', explorerName: 'Bloks' },
  { name: 'Tezos', symbol: 'XTZ', network: 'XTZ', icon: '🔷', confirmations: 2, minDeposit: '1', minWithdrawal: '1', withdrawalFee: '0.1', memo: false, speed: 'Fast (1–3 min)', notes: 'Self-amending PoS chain.', explorer: 'https://tzkt.io/', explorerName: 'TzKT' },
  { name: 'Cosmos Hub', symbol: 'ATOM', network: 'ATOM', icon: '⚛️', confirmations: 10, minDeposit: '0.1', minWithdrawal: '0.1', withdrawalFee: '0.01', memo: true, speed: 'Fast (1–2 min)', notes: '⚠️ MEMO often required when depositing from exchanges into Cosmos addresses.', explorer: 'https://www.mintscan.io/cosmos/txs/', explorerName: 'Mintscan' },
  { name: 'Algorand', symbol: 'ALGO', network: 'ALGO', icon: '⚪', confirmations: 1, minDeposit: '0.1', minWithdrawal: '0.1', withdrawalFee: '0.001', memo: true, speed: 'Very Fast (<10 sec)', notes: '⚠️ MEMO (Note field) required for deposits to some wallets/exchanges.', explorer: 'https://allo.info/tx/', explorerName: 'Allo.info' },
  { name: 'NEAR Protocol', symbol: 'NEAR', network: 'NEAR', icon: '🌐', confirmations: 1, minDeposit: '0.1', minWithdrawal: '0.1', withdrawalFee: '0.01', memo: false, speed: 'Very Fast (<5 sec)', notes: 'Sharded PoS chain. Implicit and named accounts both supported.', explorer: 'https://nearblocks.io/txns/', explorerName: 'NearBlocks' },
  { name: 'Fantom', symbol: 'FTM', network: 'FTM', icon: '👻', confirmations: 20, minDeposit: '1', minWithdrawal: '1', withdrawalFee: '0.2', memo: false, speed: 'Fast (1–3 min)', notes: 'EVM-compatible Opera chain.', explorer: 'https://ftmscan.com/tx/', explorerName: 'FtmScan' },
  { name: 'Aptos', symbol: 'APT', network: 'APT', icon: '🅰️', confirmations: 1, minDeposit: '0.1', minWithdrawal: '0.1', withdrawalFee: '0.01', memo: false, speed: 'Very Fast (<5 sec)', notes: 'Move-language chain. Fast finality.', explorer: 'https://explorer.aptoslabs.com/txn/', explorerName: 'Aptos Explorer' },
  { name: 'Sui', symbol: 'SUI', network: 'SUI', icon: '💧', confirmations: 1, minDeposit: '0.1', minWithdrawal: '0.1', withdrawalFee: '0.01', memo: false, speed: 'Very Fast (<5 sec)', notes: 'Move-language chain. Object-centric data model.', explorer: 'https://suiscan.xyz/mainnet/tx/', explorerName: 'SuiScan' },
  { name: 'Toncoin', symbol: 'TON', network: 'TON', icon: '💎', confirmations: 1, minDeposit: '1', minWithdrawal: '1', withdrawalFee: '0.05', memo: true, speed: 'Fast (<30 sec)', notes: '⚠️ MEMO/comment often required when depositing to exchange wallets.', explorer: 'https://tonscan.org/tx/', explorerName: 'Tonscan' },
  { name: 'Base', symbol: 'ETH (Base)', network: 'Base', icon: '🔵', confirmations: 15, minDeposit: '0.005', minWithdrawal: '0.005', withdrawalFee: '0.0005', memo: false, speed: 'Fast (1–5 min)', notes: 'Coinbase L2 on Ethereum. Used mainly for ETH/USDC transfers.', explorer: 'https://basescan.org/tx/', explorerName: 'BaseScan' },
  { name: 'zkSync Era', symbol: 'ETH (zkSync)', network: 'zkSync Era', icon: '🟪', confirmations: 1, minDeposit: '0.005', minWithdrawal: '0.005', withdrawalFee: '0.0005', memo: false, speed: 'Fast (1–5 min)', notes: 'ZK-rollup L2 on Ethereum.', explorer: 'https://explorer.zksync.io/tx/', explorerName: 'zkSync Explorer' },
  { name: 'Filecoin', symbol: 'FIL', network: 'FIL', icon: '🗄️', confirmations: 30, minDeposit: '1', minWithdrawal: '1', withdrawalFee: '0.05', memo: false, speed: 'Medium (5–15 min)', notes: 'Decentralized storage network.', explorer: 'https://filfox.info/en/message/', explorerName: 'Filfox' },
  { name: 'Internet Computer', symbol: 'ICP', network: 'ICP', icon: '♾️', confirmations: 1, minDeposit: '0.1', minWithdrawal: '0.1', withdrawalFee: '0.0001', memo: false, speed: 'Very Fast (<5 sec)', notes: 'Sub-second finality on most transfers.', explorer: 'https://dashboard.internetcomputer.org/transaction/', explorerName: 'ICP Dashboard' },
  { name: 'Hedera', symbol: 'HBAR', network: 'HBAR', icon: 'ℏ', confirmations: 1, minDeposit: '1', minWithdrawal: '1', withdrawalFee: '0.01', memo: true, speed: 'Very Fast (3–5 sec)', notes: '⚠️ MEMO field required for most exchange deposits.', explorer: 'https://hashscan.io/mainnet/transaction/', explorerName: 'HashScan' },
  { name: 'Flow', symbol: 'FLOW', network: 'FLOW', icon: '🌊', confirmations: 1, minDeposit: '1', minWithdrawal: '1', withdrawalFee: '0.05', memo: false, speed: 'Fast (10–30 sec)', notes: 'Used for NFT/gaming ecosystems (Dapper Labs).', explorer: 'https://www.flowscan.io/tx/', explorerName: 'FlowScan' },
  { name: 'Injective', symbol: 'INJ', network: 'INJ', icon: '🟦', confirmations: 5, minDeposit: '0.1', minWithdrawal: '0.1', withdrawalFee: '0.01', memo: false, speed: 'Fast (1–2 min)', notes: 'Cosmos SDK app-chain for derivatives/DeFi.', explorer: 'https://explorer.injective.network/transaction/', explorerName: 'Injective Explorer' },
  { name: 'Sei', symbol: 'SEI', network: 'SEI', icon: '🔺', confirmations: 5, minDeposit: '1', minWithdrawal: '1', withdrawalFee: '0.05', memo: false, speed: 'Fast (1–2 min)', notes: 'Cosmos SDK chain optimized for trading throughput.', explorer: 'https://www.mintscan.io/sei/txs/', explorerName: 'Mintscan' },
  { name: 'Celestia', symbol: 'TIA', network: 'TIA', icon: '🌌', confirmations: 5, minDeposit: '0.1', minWithdrawal: '0.1', withdrawalFee: '0.01', memo: false, speed: 'Fast (1–2 min)', notes: 'Modular data-availability chain.', explorer: 'https://www.mintscan.io/celestia/txs/', explorerName: 'Mintscan' },
  { name: 'Moonbeam', symbol: 'GLMR', network: 'GLMR', icon: '🌙', confirmations: 15, minDeposit: '1', minWithdrawal: '1', withdrawalFee: '0.1', memo: false, speed: 'Fast (1–3 min)', notes: 'EVM-compatible Polkadot parachain.', explorer: 'https://moonscan.io/tx/', explorerName: 'Moonscan' },
  { name: 'Gnosis Chain', symbol: 'GNO', network: 'Gnosis', icon: '🦉', confirmations: 15, minDeposit: '0.01', minWithdrawal: '0.01', withdrawalFee: '0.001', memo: false, speed: 'Fast (1–3 min)', notes: 'EVM chain settled by xDai; common for stablecoin transfers.', explorer: 'https://gnosisscan.io/tx/', explorerName: 'GnosisScan' },
  { name: 'Kaspa', symbol: 'KAS', network: 'KAS', icon: '🔶', confirmations: 10, minDeposit: '10', minWithdrawal: '10', withdrawalFee: '1', memo: false, speed: 'Fast (1–2 min)', notes: 'GHOSTDAG-based PoW chain with high block rate.', explorer: 'https://explorer.kaspa.org/txs/', explorerName: 'Kaspa Explorer' },
  { name: 'Theta Network', symbol: 'THETA', network: 'THETA', icon: '🟪', confirmations: 6, minDeposit: '1', minWithdrawal: '1', withdrawalFee: '0.1', memo: false, speed: 'Fast (1–3 min)', notes: 'Video-delivery focused chain.', explorer: 'https://explorer.thetatoken.org/txs/', explorerName: 'Theta Explorer' },
  { name: 'ICON', symbol: 'ICX', network: 'ICX', icon: '🔵', confirmations: 6, minDeposit: '1', minWithdrawal: '1', withdrawalFee: '0.1', memo: false, speed: 'Fast (1–3 min)', notes: 'Interoperability-focused chain (BTP).', explorer: 'https://tracker.icon.community/transaction/', explorerName: 'ICON Tracker' },
  { name: 'Harmony', symbol: 'ONE', network: 'ONE', icon: '🔷', confirmations: 15, minDeposit: '10', minWithdrawal: '10', withdrawalFee: '1', memo: false, speed: 'Fast (1–3 min)', notes: 'Sharded EVM-compatible chain.', explorer: 'https://explorer.harmony.one/tx/', explorerName: 'Harmony Explorer' },
  { name: 'Waves', symbol: 'WAVES', network: 'WAVES', icon: '🌊', confirmations: 2, minDeposit: '0.1', minWithdrawal: '0.1', withdrawalFee: '0.01', memo: true, speed: 'Fast (1–2 min)', notes: '⚠️ MEMO (attachment) sometimes required for exchange routing.', explorer: 'https://wavesexplorer.com/tx/', explorerName: 'Waves Explorer' },
  { name: 'Zcash', symbol: 'ZEC', network: 'ZEC', icon: '🛡️', confirmations: 12, minDeposit: '0.01', minWithdrawal: '0.01', withdrawalFee: '0.0001', memo: false, speed: 'Medium (5–15 min)', notes: 'Only transparent (t-addr) deposits are supported — shielded (z-addr) transfers cannot be credited.', explorer: 'https://blockchair.com/zcash/transaction/', explorerName: 'Blockchair' },
  { name: 'Conflux', symbol: 'CFX', network: 'CFX', icon: '🟩', confirmations: 30, minDeposit: '10', minWithdrawal: '10', withdrawalFee: '0.5', memo: false, speed: 'Fast (1–3 min)', notes: 'Tree-Graph consensus chain, large user base in Asia.', explorer: 'https://www.confluxscan.io/tx/', explorerName: 'ConfluxScan' },
  { name: 'Chiliz Chain', symbol: 'CHZ', network: 'CHZ', icon: '⚽', confirmations: 15, minDeposit: '10', minWithdrawal: '10', withdrawalFee: '1', memo: false, speed: 'Fast (1–3 min)', notes: 'EVM-compatible chain for fan-token ecosystem.', explorer: 'https://chiliscan.com/tx/', explorerName: 'ChilizScan' },
  { name: 'Mantle', symbol: 'MNT', network: 'Mantle', icon: '🟢', confirmations: 15, minDeposit: '0.01', minWithdrawal: '0.01', withdrawalFee: '0.001', memo: false, speed: 'Fast (1–5 min)', notes: 'EVM-compatible L2 on Ethereum with modular DA.', explorer: 'https://explorer.mantle.xyz/tx/', explorerName: 'Mantle Explorer' },
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
        <h1 className="text-xl font-bold text-fg-0">🔗 Chain Lookup</h1>
        <p className="text-sm text-fg-2">Network info, confirmations, minimums and key notes</p>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 flex items-center gap-2 bg-bg-1 border border-border-0 focus-within:border-hero/50 rounded-xl px-4 py-3">
          <Search size={15} className="text-fg-2 shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, symbol or network..."
            className="flex-1 bg-transparent text-sm text-fg-0 placeholder-fg-2 outline-none"
          />
        </div>
        <button
          onClick={() => setMemoOnly(!memoOnly)}
          className={`px-4 rounded-xl text-sm font-medium transition-all border ${memoOnly ? 'bg-crit/20 border-crit/40 text-crit' : 'bg-bg-1 border-border-0 text-fg-1'}`}
        >
          ⚠️ Memo required
        </button>
      </div>

      {/* Memo warning banner */}
      {memoOnly && (
        <div className="bg-crit/10 border border-crit/30 rounded-xl px-4 py-3 text-sm text-crit">
          ⚠️ These networks require a MEMO/Tag. Missing memo = funds likely unrecoverable. Always verify before processing.
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-0">
              {['Network', 'Symbol', 'Confirmations', 'Min Deposit', 'Min Withdraw', 'Fee', 'Memo', 'Speed', 'Notes'].map(h => (
                <th key={h} className="text-left pb-3 pr-4 text-xs text-fg-2 font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-0/50">
            {filtered.map(chain => (
              <tr key={chain.symbol} className="hover:bg-bg-1/50 transition-colors">
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{chain.icon}</span>
                    <div>
                      <p className="font-medium text-fg-0 whitespace-nowrap">{chain.name}</p>
                      <p className="text-xs text-fg-2">{chain.network}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3 pr-4 font-mono text-hero font-medium">{chain.symbol}</td>
                <td className="py-3 pr-4 text-fg-1">{chain.confirmations}</td>
                <td className="py-3 pr-4 text-fg-1">{chain.minDeposit}</td>
                <td className="py-3 pr-4 text-fg-1">{chain.minWithdrawal}</td>
                <td className="py-3 pr-4 text-fg-1">{chain.withdrawalFee}</td>
                <td className="py-3 pr-4">
                  {chain.memo
                    ? <span className="text-xs bg-crit/20 text-crit px-2 py-0.5 rounded font-medium">YES ⚠️</span>
                    : <span className="text-xs bg-ok/20 text-ok px-2 py-0.5 rounded">No</span>
                  }
                </td>
                <td className="py-3 pr-4 text-fg-1 whitespace-nowrap text-xs">{chain.speed}</td>
                <td className="py-3 text-xs text-fg-2 max-w-xs">{chain.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-center text-fg-2 py-8">No chains match your search</p>
        )}
      </div>
    </div>
  );
}
