---
title: "Prototyping AI workflows for Aqueduct"
type: prototype
status: done
targets: feature
themes:
  - prototyping
  - geospatial
tags:
  - visualization
  - uncertainty
---

# Prototyping AI workflows for Aqueduct

> Several Aqueduct experiments explored how AI capabilities might augment or even restructure components of Aqueduct in the future. Experiments included prototypes for querying and interpreting water-risk data, and proof-of-concept improvements to the technical stack and data systems. 

## Before

### What problem or question does this address?

Aqueduct had a significant backlog of requests and feedback, which were taken as demand signals. This included requests from users and a steering committee. Some users, for example, were already pulling data for individual sites and translating them into a climate disclosure format (TCFD), suggesting a workflow people wanted help with. 

An update to how Aqueduct organized and served its data gave the product team a chance to try some of those ideas. The experiments were trying to answer: "which requests could the new data stack handle directly?", "Where might an LLM be helpful", "when a model contributed to an answer, could the user understand this contribution?"

### What does this experiment actually do?

This brief brings together several Aqueduct experiments. Each explored a different question. Across the prototypes, the team built or tried the following:

* **Inspectable map queries.** An LLM wrote SQL within limits set by the application. The interface showed the resulting query, and requests were visible as they were processed in the browser.
* **Links between answers and places.** The application recognized HydroBASINS identifiers in a text response and linked them to the corresponding basins on the map.
* **Different ways to show uncertainty.** The team used a stand-in ensemble dataset to explore how to display variation among its model outputs. 
* **A browser-based eval runner.** The team built a harness to test individual AI steps. For example, to test utilizing a lightweight AI model to rout a user query to the intended topic, such as water demand. 
* **A footprint calculator.** The simple calculator estimating emissions from model use, allowing the user to change input variables, such as the assumed emissions per token and the electricity grid serving the data center.

### What signals are we looking for?

*These questions reconstruct the aims of the experiments from a retrospective interview.*

* Can the application run a model-assisted query and show enough of its work for someone to trace the response back to the data?
* Does that visibility help people judge whether to trust an answer?
* Does a prototype address a recurring request well enough that the Aqueduct team chooses to carry it into the combined demo?

### What are the boundaries?

The work took place over two sprints under a tight deadline, with real stand-in datasets where the intended Aqueduct data was not yet available. The AI features ran with users’ own API keys and no application-side AI backend. Feedback during development generally came from one or two Aqueduct colleagues.

---

## Learnings

* A real stand-in dataset can help a team make decisions about data it has yet to publish, and support experimentation. In Aqueduct, working with existing publishing conventions and spatial resolutions gave the team a concrete basis for discussing what resolution its own data should support. *(LA4: Internal efficiency and workflow)*
* An LLM may be capable of writing SQL inside a geospatial application while leaving the query open for users to inspect. Aqueduct combined model-written SQL, application guardrails, and client-side processing in a working map prototype. *(LA1: AI capabilities for external users)*
* Standardized identifiers can give users a way to validate AI responses. Aqueduct recognized HydroBASINS IDs in the response text and connected them to the corresponding features on the map. *(LA2: Reliability and trust)*

---

## After

**Outcome:** The experiments showed that several of the approaches, such as model-assisted queries and inspectable geographic references, are technical feasible. Whether they are ultimately valuable or impactful (for example, in increasing external user trust) remains open. 

### Signal check

* **Can someone trace a response back to the data? — Confirmed in the prototype.** The interface exposed SQL and client-side requests, and connected basin references in the answer to the map.
* **Did visibility increase trust? — Inconclusive.** Trust was an explicit design goal. Feedback from a small internal group helped refine the designs, but did not establish how external users judged the answers.
* **Did a requested workflow make it into the combined demo? — Pending.** The Aqueduct team may be incorporating the location-based supply-and-demand lookup into the product.

### What happened?

The supply-and-demand lookup began with a recurring request that staff handled manually. Reorganizing CSV data into Parquet made it possible to offer that analysis for a selected location in the application. The team incorporated it into the larger prototype; staff time savings were not measured. *(LA4: Internal efficiency and workflow)*

The team tried several visual treatments for ensemble uncertainty. Variation in one band of the stand-in data made some designs a poor fit. These attempted variations may be useful / inspiration for other non-Aquaduct teams at WRI. *(LA 2: Reliability and trust)*

The footprint calculator may have a future connection to other WRI initiatives on calculating environmental footprint of AI products. *(LA 4: Sustainable systems)*

### What would you recommend?

Several experiments show promise for further work. Explore an eval approach to understand "can an agent use Aqueduct data correctly on its first attempt?" Contribute some ideas to the team working on AI-related design patterns (maybe at the WRI product studio). 

### What decisions and tradeoffs came up along the way?

Building separate prototypes and experiments let the team try several responses to documented requests in a short time. For teams taking such an expedited approach, it would be helpful to have a framework to assist with synthesis, prioritization and decision making to get the most out of the experiments for the product's roadmap and next steps. 
