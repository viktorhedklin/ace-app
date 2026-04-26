---
name: bybit-support-triage
description: Use this skill when Viktor is handling a Bybit customer support ticket that involves a crypto transaction, missing deposit, withdrawal issue, or on-chain transaction hash. Triggers include pasted TX hashes, explorer screenshots (Etherscan/BscScan/Monadscan/etc.), deposit addresses, wallet addresses, phrases like "user came in to livechat", "missing deposit", "stuck withdrawal", "wrong network", or any time a transaction status needs to be decoded before responding to a customer. Do NOT use for general account questions (KYC, verification, fees) that don't involve an on-chain transaction.
---

# Bybit Support Triage

This skill codifies the decision tree for decoding crypto transactions in a customer support context. The goal is to produce a crisp triage summary that Viktor can act on — what happened on-chain, what likely went wrong, and what information to get from the customer before escalating.

## Step 1: Identify what kind of transaction this is

Look at the "To" field of the transaction first:

- **Plain EOA (externally-owned address)** → simple transfer. The "To" address is the actual recipient. If the customer expected Bybit to credit this, the "To" must match their Bybit deposit address exactly.
- **Smart contract** (has a contract label, shows internal transactions, or shows a contract icon) → the top-level "To" is the contract, NOT the recipient. Look at the **internal transactions** section to find where the funds actually ended up.
- **MetaMask Delegation Manager / EIP-7702 delegated EOA** → legitimate smart account feature. The real recipient is in the internal transfer. This is normal, not a red flag.

## Step 2: Verify the three critical match points

For any "missing deposit" case, all three must be true for Bybit to auto-credit:

1. **Correct token** — is the token the customer sent the same one Bybit issued the address for? (Sending USDT to a USDC-only address fails.)
2. **Correct network** — Bybit deposit addresses are network-specific. An EVM address on Ethereum, Arbitrum, BSC, Polygon, Monad, etc. may all look identical (`0x...`) but only one will credit. This is the #1 cause of "missing deposit" cases.
3. **Correct recipient** — the actual end recipient (after unwrapping any contract hops) must exactly match the deposit address Bybit generated for this customer.

## Step 3: Read transaction status correctly

- **"Success" on the explorer ≠ credited by Bybit.** It only means the EVM executed the call. A successful TX to the wrong network/token/address is still lost from Bybit's perspective.
- **Confirmations matter.** If the TX is very recent and below the required confirmation threshold for that network, credit may just be pending — not lost.
- **Zero value with internal transfers** is normal for smart contract interactions. Don't read "Value: 0" as "no money moved" — check internal transfers.

## Step 4: Questions to ask the customer before escalating

Always get these before opening a ticket or involving L2:

1. On the Bybit deposit page, which **coin** did you select?
2. Which **network** did you select?
3. Can you send a screenshot of the deposit address Bybit showed you?
4. From which wallet/exchange did you send the funds?
5. Which network did you select on the sending side?

If the customer selected different networks on the two sides, this is a **wrong-network send** and goes into the self-recovery / lost-deposit flow — not a standard missing-deposit trace.

## Step 5: Output format

When Viktor shares a TX, respond with this structure:

**Triage summary**
- Type: [plain transfer / smart contract interaction / delegated EOA]
- Real recipient: `0x...`
- Token + network: [e.g. MON on Monad]
- Status: [success / pending / failed]

**Most likely cause**
- One-line hypothesis of what went wrong.

**Questions for the customer**
- Only the ones actually needed to confirm/refute the hypothesis. Don't ask all five if three are already answered.

**Next step**
- Self-recovery / standard missing-deposit trace / escalate to L2 / credit should arrive soon (if pending).

## Things to never do

- Never guess whether Bybit supports a specific token+network combo. Check current support or tell Viktor to verify.
- Never include the customer's UID, email, or full wallet address in any output that might get logged or sent to an external service. If you need to reference them, use last-4 or placeholder.
- Never recommend the customer try to cancel or reverse a confirmed on-chain transaction. Those are immutable.