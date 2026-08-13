---
title: "Thinking outside the (chat) box"
summary: "Chat is one form an AI feature can take, not the container for all of them — and rarely the best one."
themes: [patterns, prototyping, geospatial]
related_experiments:
  - ai-web-map-exploration
  - mcp-web-map
  - concept-map
  - structured-output-lab
  - wri-asset-locator
date: 2026-08-11
featured: true
status: published
---

An AI assistant chat window is an easy default interface for an AI feature. Across our prototypes, a more interesting pattern was to treat chat as one option among many.

## A simple frame

Looking at the flow of an AI interaction, we can oversimplify the lifecycle into a few component parts: What initiates the interaction? What context does the model have access to, what reasoning is performed, and what is the result?

Chat gives one familiar answer: the user types, the model responds, and the output is text. But other combinations often fit the shape of a task or product feature better.

| Pattern             | Example outcome                         |
| ------------------- | --------------------------------------- |
| Chat                | A written response                      |
| Embedded analysis   | An annotation or contextual panel       |
| Interface action    | A change to the app or data             |
| Artifact generation | A report, file, or other durable output |

A useful implementation pattern showed up repeatedly: let the model produce structured data, then let deterministic code decide what to render or change.

## What we learned

* **Concept Map** used the model to generate nodes and edges rather than prose.
* **Structured Output Lab** turned text into a validated table.
* **AI Web Map Exploration** used the map itself as the interaction surface.

In each case, the AI worked better when it was embedded in the task instead of placed next to it in a chat window.

Chat still works well when users need to compose several actions in natural language. The form is familiar, and you can do a lot with it. But thinking outside the chat box, and reaching for other modalities and product surfaces in the application makes for a richer and more integrated experience.
