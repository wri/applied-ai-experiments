# AI Provisioning Decision Guide

A framework for choosing how to deliver AI capabilities in WRI products and systems.

---

## Purpose

Every AI-powered feature requires a fundamental architectural decision: how will inference happen? This choice affects cost, performance, privacy, reliability, and user experience. Making the wrong choice early can mean expensive rewrites later—or worse, launching a product that doesn't meet user needs.

This guide helps WRI teams navigate the provisioning decision systematically. It covers the major delivery methods, their tradeoffs, and provides a decision framework grounded in real constraints.

---

## Process Map

Follow this four-step process when determining how to provision AI for a new feature or product.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AI PROVISIONING DECISION PROCESS                     │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌──────────────┐      ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
    │              │      │              │      │              │      │              │
    │  1. DEFINE   │ ───▶ │  2. FILTER   │ ───▶ │  3. COMPARE  │ ───▶ │  4. VALIDATE │
    │              │      │              │      │              │      │              │
    └──────────────┘      └──────────────┘      └──────────────┘      └──────────────┘
          │                     │                     │                     │
          ▼                     ▼                     ▼                     ▼
    ┌──────────────┐      ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
    │ • Use case   │      │ • Rule out   │      │ • Estimate   │      │ • Prototype  │
    │ • Users      │      │   methods    │      │   TCO        │      │ • Test with  │
    │ • Volume     │      │   that fail  │      │ • Weight     │      │   real users │
    │ • Constraints│      │   hard       │      │   tradeoffs  │      │ • Measure    │
    │              │      │   constraints│      │ • Score      │      │ • Decide     │
    └──────────────┘      └──────────────┘      └──────────────┘      └──────────────┘
```

**Step 1: Define Requirements.** Clarify what you're building, who will use it, expected volume, and any non-negotiable constraints (privacy, offline access, budget caps).

**Step 2: Filter Methods.** Use the decision framework to eliminate methods that can't meet your hard constraints. This often narrows options quickly.

**Step 3: Compare Remaining Options.** For viable methods, estimate total cost of ownership and evaluate tradeoffs. Weight factors by importance to your specific context.

**Step 4: Validate with a Prototype.** Build a minimal version with your chosen method. Test with real users and measure actual performance before committing.

---

## Delivery Methods Taxonomy

There are eight primary ways to provision AI capabilities, organized into four categories based on where inference runs and who controls it.

```
DELIVERY METHODS
│
├── User-Funded
│   └── BYOK (user's keys, user's cost)
│
├── Cloud-Hosted (WRI-funded)
│   ├── Provider Direct (single provider, minimal wrapper)
│   ├── Managed Router (OpenRouter, Portkey—multi-provider, outsourced routing)
│   └── Self-Built Proxy (multi-provider, WRI-controlled routing + guardrails)
│
├── WRI-Hosted
│   ├── Managed Inference (Replicate, Together—open models, managed infra)
│   └── Full Self-Hosted (your infra, your models, your ops)
│
├── Edge/Client
│   ├── Browser (WebLLM, Transformers.js)
│   └── Embedded SDK (mobile, desktop apps)
│
└── Hybrid (combines above based on task/context)
```

### Method Definitions

| Method | How It Works | Example Services |
|--------|--------------|------------------|
| **BYOK** | Users provide their own API key. Your product makes calls using their credentials. | User enters their provider API key |
| **Provider Direct** | WRI maintains an account with one provider. Your product calls their API directly. | GNW uses WRI's Gemini account |
| **Managed Router** | Third-party service provides unified API across multiple providers with automatic fallbacks and consolidated billing. | OpenRouter, Portkey, Martian, LiteLLM Gateway |
| **Self-Built Proxy** | WRI operates middleware that routes requests, adds guardrails, logging, rate limiting, and custom logic. | Custom proxy on WRI infrastructure |
| **Managed Inference** | Third-party hosts open models on their infrastructure. Pay per inference without managing GPUs. | Replicate, Together AI, Fireworks, Modal, Baseten |
| **Full Self-Hosted** | WRI runs models on its own infrastructure with full control over the stack. | Llama 3 on AWS via vLLM |
| **Browser/Edge** | Small models run in the user's browser via WebGPU/WASM. No server calls. | Phi-3 via WebLLM, Transformers.js |
| **Embedded SDK** | Models ship with the application for mobile or desktop deployment. | Core ML on iOS, ONNX in Electron |
| **Hybrid** | Intelligent routing between methods based on task complexity, connectivity, or cost. | Edge for simple tasks, cloud for complex |

---

*This is a living document, and a best guess at the time of writing. Expect content to change as we gain experience with different provisioning methods and as the technology landscape evolves.*
