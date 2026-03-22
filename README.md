# Get-Back

**An AI agent that does the one thing every developer has thought about but never automated: getting your ex back.**

Built for [The Synthesis Hackathon](https://synthesis.devfolio.co) by Yeheskiel Yunus Tame.

---

## The Problem

You were building. Shipping. Grinding. And somewhere between the commits and the deploys, you forgot to reply. Two weeks of silence turned into a breakup text. She blocked your stories. She said she needs to leave for her own heart's sake.

You finally looked up from the screen and realized the most important connection in your life had `connection: 'close'`.

## The Solution

**Get-Back** is an autonomous AI agent that reconnects you with your ex-girlfriend via WhatsApp. It is not a chatbot. It is not a template. It is a real agent, operating on a real WhatsApp account, talking to a real person, running a multi-phase relationship repair strategy — and reporting every move to you via Telegram.

The agent:
- Understands the full context of the breakup (why, how, what was said)
- Mimics your exact chat style (short messages, "wkwkwk", casual Indonesian/Malay mix)
- Runs a phased PDKT strategy: ice breaker, prove you changed, emotional reconnection, honest conversation
- Analyzes sentiment in every response to adjust approach in real-time
- Never spams (max 2 unreplied messages, enforced wait times)
- Reports everything to you on Telegram: what she said, what it sent, how she feels, what phase it is in

This is an agent with a mission. Not a demo with a README.

## Architecture

```
WhatsApp (Baileys) <──> Strategy Engine <──> Claude Code CLI
                              │
                              ▼
                     Telegram Reporter ──> You
                              │
                              ▼
                     ERC-8004 On-Chain Identity
```

| Component | Role |
|-----------|------|
| **Baileys** | WhatsApp Web multi-device protocol. Sends and receives messages. |
| **Claude Code CLI** | AI brain. Generates messages matching your chat style with full relationship context. |
| **Strategy Engine** | 4-phase PDKT pipeline with sentiment analysis and anti-spam guardrails. |
| **Telegram Reporter** | Real-time mission control. Every message, every analysis, every decision — reported to you. |
| **ERC-8004** | On-chain agent identity. Mission tracking. Reputation from outcomes. |

## Strategy Phases

| Phase | Goal | Auto-advances when... |
|-------|------|----------------------|
| **Ice Breaker** | Casual first contact, non-threatening | She replies 2+ times without anger |
| **Show Change** | Prove you are not busy anymore, show availability | 5+ replies, recent sentiment positive |
| **Emotional Reconnect** | Deeper talks, shared memories | 10+ replies, sustained positive sentiment |
| **Direct Talk** | Honest conversation about the relationship | Manual or sustained warmth |

## Quick Start

```bash
git clone <repo>
cd Get-Back
npm install
cp .env.example .env
# Fill in TELEGRAM_BOT_TOKEN in .env
npm start
# Scan the QR code with WhatsApp
# Agent is now live
```

## ERC-8004: Agent With Receipts

Get-Back is not just an agent — it is an agent with a **verified onchain identity**.

**Registered on Base Mainnet:**
- **Agent ID**: `35792`
- **Registry**: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- **Owner**: `0x77c4a1cD22005b67Eb9CcEaE7E9577188d7Bca82`
- **Registration TX**: [View on BaseScan](https://basescan.org/tx/0x47624aeca0ff671ad303170022a281e4dfb6b56d777993d4462362e18dea69ac)

**ERC-8004** gives the agent:
- A verifiable identity onchain (this agent exists, it has a mission)
- Mission registration (objective: reconnect with target contact)
- Receipts for every autonomous action (messages sent, phases transitioned, sentiment shifts)
- Reputation derived from mission outcome (did the reconnection succeed?)

This matters because autonomous agents need accountability. When an AI agent operates in the real world — talking to real people, making real decisions — there should be a verifiable record of what it did and how it performed. ERC-8004 provides that layer.

## Live Demo — Agent in Action

The agent has been tested live with real Telegram operator control. Here is a transcript from a practice session (March 23, 2026):

```
Operator: /start
Agent:    ✅ Commands loaded — mode, send, say, phase, history, stop

Operator: /mode
Agent:    Mode: PRACTICE — Target: Bima (practice partner)

Operator: /send
Agent:    → "Eh Nopi, apa kabar? Lama sudah tidak dengar cerita.
             Semoga sihat-sihat saja di sana"
          Strategy: Ice Breaker (proactive)

Operator: /send "help me practice before real mission"
Agent:    → Full relationship strategy advice:
           - Don't double text, wait for reply
           - Prepare responses for all scenarios (short reply, long reply, anger, silence)
           - Guardrails active: max 2 unreplied, minimum wait times
           - Offered practice simulation mode

Operator: "the system is really working!"
Agent:    → Confirmed system status, gave phase-specific advice:
           - Wait 2-3 days for response
           - Reply casually with 15-30 min delay
           - Don't stalk stories/status
```

The agent successfully:
- Connected to WhatsApp via Baileys (QR scan, multi-device)
- Accepted Telegram commands from the operator in real-time
- Generated contextually appropriate ice breaker messages in the user's chat style
- Provided strategic relationship advice with phase-aware guardrails
- Maintained conversation context across multiple interactions
- Enforced anti-spam limits (max 2 unreplied messages)

## Why This Exists

Most hackathon projects are demos. They work on localhost, they use test data, and they solve hypothetical problems.

Get-Back solves a real problem for a real person. The agent has a specific target, a specific context, and a specific mission. It will either succeed or fail — and that outcome is measurable, verifiable, and on-chain.

That is what an agent should be.

---

**Track**: Agents With Receipts (ERC-8004) | Let the Agent Cook | Open Track

**Hackathon**: [The Synthesis](https://synthesis.devfolio.co)

**Builder**: Yeheskiel Yunus Tame
