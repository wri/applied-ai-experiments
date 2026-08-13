---
title: "Building and sharing AI demos cheaply"
summary: "Static as a design constraint. Bring-your-own-key plus a keyless replay path, and reusable scaffolding."
themes: [prototyping, cost-perf]
related_experiments:
  - ai-web-map-exploration
  - semantic-document-search
  - structured-output-lab
  - ask-ten-times
  - ai-provisioning-guide
date: 2026-08-11
featured: false
status: published
---


We want demos that are easy to publish, cost almost nothing to run, and are safe to share broadly.

## The pattern

The most reliable setup is layered:

| Layer | Visitor experience |
| ----- | ------------------ |
| Static site | Full interface, no backend |
| Replay or mock | Keyless experience using recorded output |
| Bring-your-own-key | Live model calls |
| In-browser models | Live results with no API key |

We started off with just a bring-your-own-key approach for live inference, but it quickly became clear that key access is a hurdle. To make it easier to share, we added a keyless replay or mock layer.

The key design decision is to make the replay layer good enough to stand on its own. To acheive that it's a streaming response that gets put through the same path as live responses.


## What we learned

Several experiments reinforced the same idea.  
* **AI Web Map Exploration** used mock responses by default and BYOK for live runs.
* **Semantic Document Search** moved inference into the browser entirely.
* **Structured Output Lab** showed that cheaper models are often good enough for constrained extraction tasks.

The broader lesson is simple: constraints on demo infrastructure are part of the product design. Creative solutions make demos more accessible, and should be handled with care. A demo should make clear whether the user is seeing live, replayed, or simulated behavior.

Shared packages in the repo such as `llm-lab`, `byo-keys`, and `ui` turn that behavior into infrastructure. A new demo inherits the pattern rather than rebuilding it. Reusable components and packages make the next demo cheaper to build.
