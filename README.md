# 🛡️ ShadowVault — Private DeFi on Midnight

> **A privacy-preserving token vault on the Midnight blockchain.**
> Deposit & withdraw tokens without revealing your identity or balance.
> Only the Total Value Locked (TVL) is public — everything else is ZK-private.

```
   🏆 Midnight Hackathon — DeFi Track
   📅 July 2026
```

---

## 📋 Table of Contents

- [The Pitch](#-the-pitch)
- [How It Works](#-how-it-works)
- [Smart Contract Architecture](#-smart-contract-architecture)
- [Privacy Model](#-privacy-model)
- [Tech Stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Quick Start](#-quick-start)
- [Usage](#-usage)
- [Project Structure](#-project-structure)
- [Judging Criteria](#-judging-criteria)
- [What's Next](#-whats-next)

---

<img width="2189" height="1850" alt="shadow vault dashboard" src="https://github.com/user-attachments/assets/c5ed953a-1ea0-4cb9-bfb1-c34a9401224a" />


## 🎯 The Pitch

**Problem:** Every DeFi protocol today (Aave, Compound, Uniswap) exposes every transaction on a public ledger. Your deposits, withdrawals, wallet balances — all visible. Whales get front-run. Trading strategies are copied. Privacy doesn't exist.

**Solution:** ShadowVault uses **Midnight's zero-knowledge capabilities** to create a DeFi vault where individual balances and transaction identities are hidden by ZK proofs. Only the aggregate TVL is public.

**How:** When Alice withdraws 10 SVT, the `withdraw` circuit generates a ZK proof that:
- The vault has enough tokens ✅
- The recipient is valid ✅
- **But NOT who triggered it** 🔒
- **And NOT how much anyone else has** 🔒

---

## ⚙️ How It Works

```
                    ┌──────────────────────────────────┐
                    │        SHADOWVAULT CONTRACT       │
                    │                                  │
                    │   Ledger (public):               │
                    │   ├─ token_color: Bytes<32>     │
                    │   ├─ initialized: Boolean       │
                    │   └─ owner: Bytes<32>          │
                    │                                  │
                    │   Circuits:                      │
                    │   ├─ initialize()  → mint 10K   │
                    │   ├─ fundUser()    → send tokens│
                    │   │                 to user  ✅  │
                    │   ├─ deposit()     → validate   │
                    │   │                 deposit      │
                    │   └─ withdraw()    → ZK send    │
                    │                    tokens  ✅   │
                    └──────────┬───────────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                    ▼
    ┌──────────┐        ┌──────────┐        ┌──────────┐
    │  Alice   │        │   Bob    │        │  TVL     │
    │  190 SVT │        │  100 SVT │        │ 10,000   │
    │  🔒 priv │        │  🔒 priv │        │  📊 pub  │
    └──────────┘        └──────────┘        └──────────┘
```

### User Flow

| Step | Action | What Happens On-Chain | Privacy |
|------|--------|----------------------|---------|
| 1 | Alice connects wallet | Server funds Alice via `fundUser` circuit → **200 REAL SVT** sent to her wallet | ✅ |
| 2 | Alice deposits 50 | `deposit` circuit validates on-chain. Her persona balance increases. | 🔒 Only Alice knows her deposit |
| 3 | Alice withdraws 30 | `withdraw` circuit → ZK proof generated → **30 REAL SVT** sent to her wallet | 🔒 Caller identity hidden |
| 4 | Bob connects | Server funds Bob via `fundUser` → **100 REAL SVT** | ✅ |
| 5 | Bob checks balance | Bob sees 100 SVT. **Cannot see Alice's 190.** | 🔒 ZK-private |
| 6 | TVL stays 10,000 | Only the aggregate is public on-chain | 📊 Public for audits |

---

## 📜 Smart Contract Architecture

### Language: **Compact** (Midnight's ZK-native language)

```compact
// Core data structures (public ledger fields)
export ledger token_color: Bytes<32>;   // Token identifier
export ledger initialized: Boolean;      // Vault state
export ledger owner: Bytes<32>;          // Contract owner

// Constructor
constructor(ownerSecret: Bytes<32>) { ... }

// Circuits:
initialize(ownerSecret, supply)     → Mint 10,000 SVT to vault
fundUser(ownerSecret, recipient, amount) → Send REAL tokens to user
deposit(amount)                     → Validate deposit, track balance privately
withdraw(recipient, amount)         → ZK proof → send REAL tokens to wallet
```

### Circuit Details

| Circuit | Inputs | Public Data | Private Data | Token Movement |
|---------|--------|-------------|--------------|----------------|
| `initialize` | ownerSecret, supply | domain, supply, contract address | ownerSecret | ✅ Mints 10K to vault |
| `fundUser` | ownerSecret, recipient, amount | amount, recipient | ownerSecret | ✅ Sends tokens to user |
| `deposit` | amount | amount | — | ✅ Validated on-chain |
| `withdraw` | recipient, amount | amount, recipient | **caller identity** | ✅ Sends tokens to wallet |

### Why `disclose()` Matters

In Midnight, **everything is private by default**. The `disclose()` keyword explicitly marks data as public:

```compact
// In the withdraw circuit — only amount & recipient are public:
sendUnshielded(
  token_color,
  disclose(amount),           // ← public: needed for verification
  right<ContractAddress, UserAddress>(disclose(recipient)),  // ← public
);
// The CALLER'S identity is NEVER disclosed — that's the privacy win.
```

---

## 🔒 Privacy Model

| What | Visibility | How |
|------|-----------|-----|
| **Your balance** | 🔒 **You only** | Tracked in private state (server-side, per-persona) |
| **Your transaction** | 🔒 **You only** | ZK proof proves validity without revealing identity |
| **TVL (total locked)** | 📊 **Everyone** | Public ledger field on Midnight |
| **Token contract** | 📊 **Everyone** | Midnight indexer makes it queryable |
| **Who called withdraw** | 🔒 **Hidden** | Not stored in any ledger field |

### Why This Matters for DeFi

- **Whales** can manage positions without being targeted
- **Institutions** can participate without exposing strategy
- **Users** get financial privacy — a basic right, not a luxury
- **Auditors** can still verify TVL and solvency

---

## 🛠️ Tech Stack

```
Layer          │ Technology
───────────────┼──────────────────────────────
Blockchain     │ Midnight (local devnet)
Smart Contract │ Compact + CompactStdLib
Backend        │ TypeScript + Node.js
Wallet SDK     │ @midnight-ntwrk/midnight-js-*
Frontend       │ HTML/CSS/JS (vanilla, no framework)
Devnet         │ Docker (midnight-local-dev)
Proof Server   │ midnight-proof-server
Database       │ LevelDB (wallet private state)
```

### Key Packages

| Package | Purpose |
|---------|---------|
| `@midnight-ntwrk/midnight-js-contracts` | Deploy & call smart contracts |
| `@midnight-ntwrk/midnight-js-indexer-public-data-provider` | Query chain state |
| `@midnight-ntwrk/wallet-sdk` | Wallet management & DUST |
| `@midnight-ntwrk/midnight-js-level-private-state-provider` | Persistent private state |
| `compact` compiler | Compile `.compact` → WASM + ZK circuits |

---

## 📦 Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| [Docker](https://docker.com) | 24+ | Midnight local devnet |
| [Node.js](https://nodejs.org) | ^22.21 | Runtime |
| [compact](https://docs.midnight.network) compiler | 0.31.1 | Compile contracts |
| [Lace Wallet](https://lace.io) (optional) | Latest | Browser wallet |

### Install the Compact Compiler

```bash
curl -sSf https://compact.updateless.dev/install.sh | bash
export PATH="$HOME/.local/bin:$PATH"
compact update --version 0.31.1
compact --version  # → 0.31.1
```

---

## 🚀 Quick Start

### 1. Start the Local Devnet

```bash
git clone https://github.com/midnight-ntwrk/midnight-local-dev.git ~/midnight-local-dev
cd ~/midnight-local-dev
npm install
docker compose -f standalone.yml up -d --wait
```

Verify all 3 services are healthy:

```bash
docker compose -f standalone.yml ps
# → midnight-node          healthy
# → midnight-indexer       healthy
# → midnight-proof-server  healthy
```

### 2. Clone & Install

```bash
git clone https://github.com/Jonniie/shadowvault.git shadowvault
cd shadowvault
npm install
```

### 3. Deploy & Start the Dashboard

```bash
npx tsx src/deploy-and-serve.ts
```

This will:
1. Deploy the ShadowVault contract to the local devnet
2. Fund Alice (200 SVT) and Bob (100 SVT) via `fundUser` — **REAL on-chain transactions**
3. Start the dashboard at **http://localhost:3030**

Wait for output like:

```
  🛡️  ShadowVault LIVE — REAL token flows
  ───────────────────────────────────
  Dashboard: http://localhost:3030
  Contract:  089f…db
  Token:     c22…33
  Vault:     9,700 SVT (10,000 - 300 funded)
  Alice:     👩‍💻 200 SVT funded (REAL on-chain tx)
  Bob:       🧑‍🔧 100 SVT funded (REAL on-chain tx)
```

### 4. Open the Dashboard

Navigate to **http://localhost:3030** in your browser.

---

## 🎮 Usage

### Web Dashboard

| Element | What It Does |
|---------|-------------|
| **TVL** | Live vault balance — changes with every transaction |
| **Alice / Bob buttons** | Connect as that persona |
| **Private balance** | Your balance — only visible to you 🔒 |
| **Wallet balance** | Real on-chain SVT in the connected wallet |
| **Withdraw** | Enter amount → click send → ZK proof → tokens arrive in your wallet |
| **Deposit** | Enter amount → click add → **mints tokens to vault on-chain** → private balance updates |
| **Terminal log** | Transaction history (clears per persona for privacy) |
| **Contract panel** | Live contract details from the Midnight indexer |
| **Privacy model** | Explains how ZK keeps data private |

### Demo Flow (2-minute video)
[Demo](https://youtu.be/79GmTu2eHoE?si=ESh9E1f2nGE8leQR)

Every transaction returns a verifiable on-chain transaction hash.

---

---

## 📁 Project Structure

```
shadowvault/
├── contracts/
│   └── shadow-vault.compact     ← Compact smart contract source
├── src/
│   ├── managed/
│   │   └── shadow-vault/        ← Compiled contract artifacts
│   │       ├── contract/         ←   TypeScript wrappers & types
│   │       ├── keys/             ←   ZK proving keys
│   │       └── zkir/             ←   ZK circuit IR
│   ├── deploy-and-serve.ts      ← Main entry: deploy + HTTP server
│   ├── config.ts                ← Midnight network configuration
│   ├── wallet.ts                ← Wallet provider & sync
│   ├── providers.ts             ← Midnight providers setup
│   └── contract.ts              ← Contract module exports
├── dashboard.html               ← Live dashboard (served by server)
├── package.json
├── tsconfig.json
├── .env.example
└── README.md                    ← This file
```

### Key Files

| File | Purpose |
|------|---------|
| `contracts/shadow-vault.compact` | The smart contract — 4 circuits |
| `src/deploy-and-serve.ts` | Deploys contract, funds users, starts web server |
| `dashboard.html` | Single-page dashboard with all UI |
| `src/wallet.ts` | Midnight wallet integration (genesis seed) |
| `src/providers.ts` | Indexer, proof server, private state providers |

---

## 📊 Judging Criteria

| Criterion | How ShadowVault Addresses It |
|-----------|------------------------------|
| **Technology** | Built on Midnight's **Compact** language — ZK-native. The `withdraw` circuit generates real zero-knowledge proofs on a local devnet. |
| **Originality** | Privacy-preserving DeFi vault. Most DeFi is fully transparent — ShadowVault hides individual balances while keeping TVL public. |
| **Execution** | Working contract (4 circuits), deployed and tested. Live dashboard with real-time data. CLI support. REST API. |
| **Completion** | End-to-end flow: deploy → fund users → deposit → withdraw → privacy demo with persona switching. |
| **Documentation** | This README with architecture, setup, code walkthrough, and demo script. |
| **Business Value** | Whales, institutions, and privacy-conscious users need this. Real product gap in current DeFi. |

---

## 🧪 Testing

The project has been tested on a local devnet:

```
✅ Contract compiles (4 circuits)
✅ Contract deploys and initializes (10,000 SVT minted)
✅ fundUser sends REAL tokens to users (200 Alice, 100 Bob)
✅ deposit circuit mints new tokens to vault (REAL on-chain)
✅ withdraw circuit generates ZK proof, sends REAL tokens to wallet
✅ Transaction hashes shown for every on-chain action
✅ Persona switching preserves privacy (different balances)
✅ Dashboard auto-refreshes from Midnight indexer
```

### Running Tests Manually

```bash
# Check contract state
curl http://localhost:3030/api/state

# Connect as Alice
curl -X POST http://localhost:3030/api/connect \
  -H "Content-Type: application/json" \
  -d '{"persona":"alice"}'

# Deposit 50
curl -X POST http://localhost:3030/api/deposit \
  -H "Content-Type: application/json" \
  -d '{"amount":50}'

# Withdraw 30 (takes ~60s for ZK proof + block finality)
curl -X POST http://localhost:3030/api/withdraw \
  -H "Content-Type: application/json" \
  -d '{"amount":30}'

# Switch personas (privacy preserved)
curl -X POST http://localhost:3030/api/disconnect
curl -X POST http://localhost:3030/api/connect \
  -H "Content-Type: application/json" \
  -d '{"persona":"bob"}'
```

---

## 🗺️ What's Next

If this were a production project:

- [ ] **Wallet-to-contract transfers** — send tokens from user wallet to vault address (SDK limitation)
- [ ] **Yield generation** — deposited tokens earn yield via lending/staking
- [ ] **Multi-wallet support** — each user connects their own Lace wallet
- [ ] **Persistent private state** — balances survive server restarts (LevelDB)
- [ ] **Deploy to testnet** — move from local devnet to Midnight testnet
- [ ] **Audit** — formal verification of ZK circuits

---

## 🙏 Acknowledgments

- **Midnight Foundation** — for the hackathon and the Midnight blockchain
- **Major League Hacking** — for organizing
- **Compact language team** — for the ZK-native smart contract language

---

<div align="center">

**Built with 🔒 for the Midnight Hackathon**

[Devpost Submission](https://devpost.com/software/shadow-vault)

</div>
