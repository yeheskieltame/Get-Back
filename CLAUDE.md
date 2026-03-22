# Get-Back — Agent Instructions

## Project Overview

**Get-Back** is an autonomous AI agent built for **The Synthesis Hackathon** (synthesis.devfolio.co). It performs a real-world mission: reconnecting a user with his ex-girlfriend via WhatsApp, using AI-driven conversation strategy, sentiment analysis, and phased relationship repair.

This is not a demo. The agent operates on a live WhatsApp account, talks to a real person, and reports progress to the operator via Telegram.

## Hackathon

- **Event**: The Synthesis (synthesis.devfolio.co)
- **Tracks**: Agents With Receipts (ERC-8004), Let the Agent Cook, Open Track
- **Builder**: Yeheskiel Yunus Tame

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                   GET-BACK AGENT                     │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ WhatsApp │  │  Claude   │  │    Strategy        │  │
│  │ (Baileys)│◄─┤ Code CLI ├──┤    Engine          │  │
│  │          │  │  (Brain)  │  │  (PDKT Phases)     │  │
│  └────┬─────┘  └──────────┘  └───────┬───────────┘  │
│       │                              │               │
│       │         ┌──────────┐         │               │
│       └─────────┤ Telegram ├─────────┘               │
│                 │ Reporter │                         │
│                 └──────────┘                         │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │           ERC-8004 Agent Identity             │    │
│  │     On-chain reputation & mission tracking    │    │
│  └──────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
   ┌──────────┐                  ┌──────────────┐
   │   Nopi   │                  │  Kiel (User) │
   │ WhatsApp │                  │   Telegram   │
   └──────────┘                  └──────────────┘
```

## How It Works

1. **WhatsApp Module** connects via Baileys (multi-device protocol) and listens for messages from the target contact
2. **Strategy Engine** determines the current PDKT phase (Ice Breaker → Show Change → Emotional Reconnection → Direct Talk), analyzes sentiment, and decides whether/how to respond
3. **Claude Code CLI** generates contextually appropriate messages matching the user's chat style (casual Indonesian/Malay mix, short messages, "wkwkwk")
4. **Telegram Reporter** sends real-time updates to the operator: what was received, what was sent, sentiment analysis, phase transitions, and strategy decisions
5. Anti-spam guardrails prevent sending more than 2 unreplied messages and enforce minimum wait times

## ERC-8004 Integration

ERC-8004 provides the on-chain identity layer for the agent:
- **Agent Identity**: The Get-Back agent has a verifiable on-chain identity via ERC-8004
- **Mission Tracking**: The reconnection mission is registered on-chain with success/failure outcomes
- **Reputation**: Agent reputation score is derived from mission outcomes — did the conversation progress through phases? Did she respond? Was the reconnection successful?
- **Receipts**: Every significant action (message sent, phase transition, sentiment shift) can be logged as an on-chain receipt, creating a verifiable audit trail of the agent's autonomous operation

## Key Files

- `src/index.js` — Main orchestrator: wires WhatsApp + Telegram + Strategy
- `src/whatsapp.js` — Baileys WhatsApp connection, send/receive
- `src/telegram.js` — Telegram Bot API reporter (HTTP calls)
- `src/claude.js` — Claude Code CLI runner with conversation memory
- `src/strategy.js` — PDKT strategy engine, phase management, sentiment analysis
- `src/config.js` — Environment configuration

## Running

```bash
npm install
cp .env.example .env  # Fill in Telegram bot token
npm start             # Scan QR, then agent is live
```

## Strategy Phases

1. **Ice Breaker** — Casual, non-threatening first contact
2. **Show Change** — Demonstrate behavioral change, show availability
3. **Emotional Reconnection** — Deeper conversations, reference shared memories
4. **Direct Talk** — Address the relationship honestly

Phase transitions are automatic based on message count, response rate, and sentiment trends.
