---
title: "LangChain vs. LangGraph: Moving from Chains to Cyclic State Graphs"
description: "Understand the limits of sequential chains and learn how LangGraph represents agents as stateful, cyclic graphs with conditional routing and persistent memory."
pubDate: 2026-07-17
heroImage: "/images/linkedin/1769171391352.jpg"
category: ["ai", "machine-learning"]
author: "Naga Siva Poluri"
---

# LangChain vs. LangGraph: Moving from Chains to Cyclic State Graphs

Understand the limits of sequential chains and learn how LangGraph represents agents as stateful, cyclic graphs with conditional routing and persistent memory.

![LangChain vs. LangGraph](/_astro/cover_image.DqSOv5-I.jpg)

*Autonomous AI Agents & Frameworks Series: ← [OpenClaw in Action: Connecting WhatsApp to Automated Workflows](/blog/openclaw-whatsapp-workflows/) (Previous) | [Token Economics, LLM Gateways, and Router9](/blog/token-economics-llm-gateways-router9/) (Next) →*

### Prior Reading Material

Before exploring graph-based agent architectures, ensure you understand the foundational concepts:

- [The Landscape of Agentic AI: From Single-Agent Scripts to Multi-Agent Networks](/blog/landscape-of-agentic-ai/) — Analyzing the ReAct pattern, context windows, and multi-agent coordination graphs.
- [Building Agentic AI Platforms: Architecture Patterns for Autonomous Systems](/blog/building-agentic-ai-platforms/) — Production architecture patterns for tool orchestration, memory management, and safety guardrails.
- [Building with Skills: The Missing Piece in Enterprise AI](/blog/building-with-skills/) — Skills as agentic AI primitives with architecture patterns and code examples.

---

## The Limits of Sequential Chains

LangChain's core abstraction — the **chain** — is a linear pipeline: input → LLM → output. For simple Q&A or single-step tool calls, this works perfectly. But real-world agents need to:

- **Loop** until a condition is satisfied (e.g., retry a failed API call)
- **Branch** based on intermediate results (e.g., route to different tools)
- **Remember** state across iterations (e.g., accumulated context)
- **Recover** from errors mid-execution

Chains force you to flatten these patterns into awkward `while` loops or recursive calls outside the framework. You end up managing state manually, which defeats the purpose of using a framework.

## Enter LangGraph: Agents as State Machines

LangGraph replaces the linear chain with a **directed cyclic graph** where:

- **Nodes** are functions (LLM calls, tool invocations, custom logic)
- **Edges** are transitions between nodes
- **State** is a typed dictionary passed through the graph
- **Conditional edges** enable branching based on state

```
                    ┌──────────┐
                    │  START   │
                    └────┬─────┘
                         │
                    ┌────▼─────┐
                    │  Agent   │
                    │  Node    │
                    └────┬─────┘
                         │
                   ┌─────▼──────┐
                   │  Condition │
                   │  (tool?)   │
                   └──┬──────┬──┘
                      │      │
                ┌─────▼──┐ ┌─▼──────┐
                │  Tool  │ │  END   │
                │  Node  │ └────────┘
                └────┬───┘
                     │
                     └──→ Agent Node (loop)
```

### Core Concepts

**1. State as a Typed Dictionary**

```python
from typing import TypedDict, Annotated
from langgraph.graph import StateGraph

class AgentState(TypedDict):
    messages: Annotated[list, "Conversation history"]
    tool_results: list
    iteration_count: int
    should_continue: bool
```

State is the single source of truth. Every node reads from and writes to this dictionary. No global variables, no external stores — just a clean, typed data flow.

**2. Nodes as Functions**

```python
def agent_node(state: AgentState) -> dict:
    """Call the LLM with current messages."""
    response = llm.invoke(state["messages"])
    return {
        "messages": state["messages"] + [response],
        "iteration_count": state["iteration_count"] + 1
    }

def tool_node(state: AgentState) -> dict:
    """Execute tools based on the last message."""
    last_message = state["messages"][-1]
    results = execute_tools(last_message.tool_calls)
    return {"tool_results": results}
```

**3. Conditional Edges**

```python
def should_use_tool(state: AgentState) -> str:
    last_message = state["messages"][-1]
    if last_message.tool_calls and state["iteration_count"] < 5:
        return "tool"
    return "end"

graph = StateGraph(AgentState)
graph.add_node("agent", agent_node)
graph.add_node("tool", tool_node)

graph.set_entry_point("agent")
graph.add_conditional_edges("agent", should_use_tool, {
    "tool": "tool",
    "end": END
})
graph.add_edge("tool", "agent")  # Loop back!

app = graph.compile()
```

The `tool → agent` edge creates the **cyclic** behavior — the agent can loop, retry, and adapt until it reaches a satisfactory conclusion.

## Side-by-Side Comparison

| Feature | LangChain Chain | LangGraph |
|---|---|---|
| Flow | Linear (A → B → C) | Cyclic (A → B → A) |
| State | Passed manually | Typed dictionary |
| Branching | Limited (Router Chains) | Native conditional edges |
| Error Recovery | Custom try/catch | Node-level retry logic |
| Human-in-the-Loop | Difficult | Built-in breakpoints |
| Persistence | External (Redis, etc.) | Checkpointer API |
| Debugging | Log inspection | Graph visualization |

## When to Use Which

**Use LangChain Chains when:**
- Building simple RAG pipelines
- Chaining prompt → LLM → parser
- No loops or branching needed
- Rapid prototyping

**Use LangGraph when:**
- Agent needs to loop (multi-step reasoning)
- Multiple tools with conditional routing
- State must persist across interactions
- You need human approval gates
- Building production multi-agent systems

## A Practical Example: Research Agent

Here's a LangGraph agent that researches a topic by searching, reading, and summarizing — looping until it has enough information:

```python
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

def research_agent(state):
    messages = state["messages"]
    response = llm.invoke(messages)
    return {"messages": messages + [response]}

def search_tool(state):
    query = state["messages"][-1].content
    results = web_search(query)
    return {"messages": state["messages"] + [
        ToolMessage(content=str(results), tool_call_id="search")
    ]}

def evaluate(state):
    last = state["messages"][-1].content
    if "SUFFICIENT" in last:
        return "summarize"
    if state["iteration_count"] > 5:
        return "summarize"
    return "search"

graph = StateGraph(AgentState)
graph.add_node("agent", research_agent)
graph.add_node("search", search_tool)
graph.add_node("summarize", lambda s: {
    "messages": s["messages"] + [
        HumanMessage(content="Provide final summary now.")
    ]
})

graph.set_entry_point("agent")
graph.add_conditional_edges("agent", evaluate, {
    "search": "search",
    "summarize": "summarize"
})
graph.add_edge("search", "agent")
graph.add_edge("summarize", END)

# Persistent memory for multi-turn
memory = MemorySaver()
app = graph.compile(checkpointer=memory)
```

The agent loops through search → evaluate → search until it decides it has enough context, then summarizes. The `MemorySaver` enables conversation persistence across sessions.

## What's Next

Now that you understand graph-based agent architectures, the next question is economics: **[Token Economics, LLM Gateways, and Router9](/blog/token-economics-llm-gateways-router9/)** — how to calculate cost-per-token, set up open-source LLM gateways, and implement intelligent routing for multi-model deployments.

---

*Part of the [Autonomous AI Agents & Frameworks Series](/blog/landscape-of-agentic-ai/). Previous: [OpenClaw in Action](/blog/openclaw-whatsapp-workflows/) | Next: [Token Economics & Router9](/blog/token-economics-llm-gateways-router9/)*
