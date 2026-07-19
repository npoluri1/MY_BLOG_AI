---
title: "The meter picks the winners"
description: "What is measured gets optimised."
pubDate: 2025-06-12
tags:
  - "metrics"
category: ["metrics"]
primaryCategory: "process-maturity"
author: "Devlin Liles"
sourceUrl: "https://www.devlinliles.com/the-meter-picks-the-winners/"
readingTime: "6 min read"
---
# The meter picks the winners

What is measured gets optimised.

## The problem

Most teams approach the meter picks the winners from the wrong angle. The visible symptom tells you something is off; the underlying mechanism is what actually matters. Without diagnosing the mechanism, you end up treating symptoms indefinitely.

The common failure pattern is to optimise the *measurement* rather than the *outcome*. Teams report metrics that move in the desired direction without asking whether those metrics capture what matters. Once you stop checking the underlying mechanism, you risk producing a system that satisfies its own dashboards while failing the user.

## A workable mental model

Think of the system in three layers. At the top is intent: what outcome are we trying to produce? In the middle is the *mechanism*: the chain of decisions and actions that convert intent into observed outcome. At the bottom is *observation*: how we measure whether the mechanism actually delivered what we wanted.

    +--------------------+      +--------------------+      +--------------------+
    |       Intent       | ---> |     Mechanism     | ---> |     Observation   |
    +--------------------+      +--------------------+      +--------------------+
      what we want             how we get there             how we measure success

Most teams optimise observation because it is the easiest layer to instrument. The hard work is keeping the three layers aligned: when observation drifts from intent, the mechanism has changed without anyone noticing.

## Practical implications

The first practical move is to *name* the model. Many teams adopt this kind of framework implicitly; few write it down and review it quarterly. Without a written model, every new hire reads a different implicit framework out of the codebase and team norms.

The second move is to make the categories explicit. Each piece of work should be classifiable as either "intent", "mechanism", or "observation". A team that can quickly categorise its work has the foundation for prioritising what to invest in next.

## Why this matters in the agent era

In AI-assisted delivery, the *mechanism* layer has been compressed by agents. What used to take weeks now takes hours. Without a corresponding shift in *intent clarity*, the system produces faster output of unclear value. With a corresponding shift in *observation*, teams can identify which mechanisms are worth accelerating and which are not.

The compounding: as agent output accelerates, the cost of misalignment between intent and observation grows. Teams that treat intent badly will run further in the wrong direction faster.

## Closing

This kind of work isnt glamorous. It is also the work that separates teams that accumulate capability over years from teams that churn on a quarterly cadence.

Adopt the framing. Write down the model. Categorise the work. Re-align intent and observation quarterly.

---

**Originally published by [Devlin Liles](https://www.devlinliles.com/) on 2025-06-12.** [Read the original on devlinliles.com ->](https://www.devlinliles.com/the-meter-picks-the-winners/)