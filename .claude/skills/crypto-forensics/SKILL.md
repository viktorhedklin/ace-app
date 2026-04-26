---
name: crypto-forensics
description: Use when investigating smart contract behavior, tracing funds across multiple hops, decoding contract interactions, identifying suspicious patterns (rug pulls, approval exploits, phishing contracts), or analyzing security incidents. Triggers include contract addresses that need investigation, multi-hop transfers, approve/transferFrom patterns, questions about what a contract actually does, or any "is this address safe?" question. Complements bybit-support-triage for cases that go beyond a single TX.
---

# Crypto Forensics

For cases that go deeper than "decode one TX". Use this when you need to understand what a contract does, trace fund flows across hops, or assess whether an address/contract is malicious.

## Investigation pattern

1. **Pull the contract source code** if verified on the explorer. If unverified, that's itself a signal — note it and proceed with behavioral analysis only.
2. **Identify the contract pattern**: router, proxy, aggregator, bridge, DEX, lending pool, NFT marketplace, custom. Each has known signatures in the method calls.
3. **Trace fund flow**: start from the victim/source address, follow internal transfers, note every contract hop and the net balance change at each.
4. **Check token approvals**: `approve()` calls grant spending permission. Unlimited approvals to unknown contracts are the most common drain vector — always check if the victim had approved the draining contract prior to the incident.
5. **Cross-reference the receiving addresses**: check if they're labeled (CEX deposit, mixer, sanctioned entity), their balance history, and whether they've been involved in prior incidents.

## Red flags to watch for

- **Unverified contract** that holds significant TVL or receives many approvals.
- **Proxy contract** with an upgradeable implementation controlled by a single EOA (not a multisig/timelock).
- **Permit signatures** (EIP-2612) signed off-chain and used to drain an account — victim won't see a transaction they authorized, because the approval happened via signature.
- **Same-block sandwich pattern**: attacker TX right before + right after a victim's swap.
- **"Address poisoning"**: transfers of 0 value from lookalike addresses (same prefix/suffix), trying to trick the user into copying the wrong address from their history.
- **Fake deposit addresses**: scammer sends the user a 0-value TX from an address that looks like their real deposit address so it appears in their wallet history.

## Sanctions / compliance overlay

For Bybit EU context specifically:

- Check receiving addresses against public OFAC / EU consolidated sanctions lists before recommending any action.
- If funds are flowing toward a sanctioned entity, this escalates immediately — document and stop any action that could be interpreted as facilitating the flow.
- North Korean / Lazarus-linked addresses are a known pattern in exchange hack proceeds. Note: this was relevant to the Feb 2025 Bybit incident — attribution was Lazarus Group, ~$1.5B drained via third-party wallet provider compromise.

## Output format for forensics reports

**Subject**: [address / TX / contract being investigated]

**Classification**: [verified legit / unverified but benign / suspicious / malicious / sanctioned]

**What it does** (1-3 sentences, paraphrased from code or behavior)

**Fund flow** (bulleted hops, with net balance changes)

**Risk signals** (concrete observations, not vibes)

**Recommended action** (what the customer / Viktor / L2 should do next)

## Things to never do

- Never attribute an incident to a specific threat actor without a cited source. "Looks like Lazarus" is a guess; "Chainalysis attributed to Lazarus in [report]" is a claim.
- Never tell a customer their funds are recoverable if they're in a known mixer or have been bridged to a non-cooperative chain. Be honest about the low odds.
- Never run "recovery" tools or share them with customers — recovery scam services are themselves a secondary scam vector.