---
title: "The AI Integration Decision Matrix: When to Use RAG vs Skills vs MCP"
description: "A practical decision framework for choosing between RAG, Skills, and Model Context Protocol (MCP) in enterprise AI architectures. Includes decision trees, comparison matrices, and hybrid patterns from real-world implementations."
pubDate: 2025-06-22
tags: ["ai", "decision-framework", "enterprise", "rag", "mcp", "skills"]
image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=400&fit=crop"
readingTime: "13 min"
---

# The AI Integration Decision Matrix: When to Use RAG vs Skills vs MCP

After deploying dozens of AI integrations across enterprise systems — from ERP2 tolling platforms to public transport fare settlement — I've seen teams waste months pursuing the wrong architectural approach. The question isn't whether to use AI, but **how** to connect it to your systems. Three dominant patterns have emerged: RAG (Retrieval-Augmented Generation), Skills (agentic action primitives), and MCP (Model Context Protocol). Each solves a fundamentally different problem.

This post gives you a decision framework — not theory, but patterns forged from production deployments at scale.

## The Three Patterns, Distilled

Before diving into the decision matrix, let's establish what each pattern actually does in practice.

### RAG: Giving AI Knowledge It Doesn't Have

RAG augments a language model's responses by retrieving relevant documents at query time and injecting them into the prompt context.

```
User Query → Embed Query → Vector Search → Retrieve Top-K Documents → Construct Prompt → LLM → Response
```

**Core value**: The model accesses your private, proprietary, or real-time data without fine-tuning.

**When it shines**: When the problem is fundamentally about **information retrieval and synthesis**. The AI needs to read, understand, and reference your documents to answer questions.

### Skills: Giving AI Actions It Can't Perform

Skills are structured, composable action primitives that an AI agent can invoke to interact with external systems. Think of them as the "verbs" available to an agent.

```json
{
  "name": "queryTrafficData",
  "description": "Query real-time traffic flow data for a given road segment",
  "parameters": {
    "roadSegmentId": { "type": "string", "description": "The LTA road segment identifier" },
    "timeRange": { "type": "object", "properties": { "start": {"type": "string"}, "end": {"type": "string"} } }
  }
}
```

**Core value**: The model can **do things** — write to databases, call APIs, execute code, trigger workflows.

**When it shines**: When the problem requires **action, not just answers**. The AI needs to affect external systems.

### MCP: The Universal Adapter Layer

MCP (Model Context Protocol) standardizes how AI models discover and interact with external tools and data sources. It's the USB-C of AI integrations — a single protocol that works across models.

```
MCP Server (tool provider) ←→ MCP Client (AI application) ←→ LLM
```

**Core value**: Build tool integrations once, use them across any MCP-compatible model (Claude, GPT, Gemini, local models).

**When it shines**: When you need **vendor-agnostic tool integration** and want to avoid rebuilding connectors for every new model.

## The Decision Tree

Here's the decision framework I use at the start of every AI integration project:

```
START: What does the AI need to do?
│
├─► "Answer questions using our data"
│   ├─► Data is unstructured (docs, PDFs, wikis)?
│   │   └─► RAG
│   ├─► Data is structured (databases, spreadsheets)?
│   │   ├─► Simple lookups? ──► RAG with structured index
│   │   └─ Complex analytics? ──► Skills (SQL execution)
│   └─► Data changes frequently (real-time)?
│       └─► RAG with live indexing pipeline
│
├─► "Perform actions on external systems"
│   ├─► Actions are well-defined and repeatable?
│   │   └─► Skills
│   ├─► Actions need to work across multiple models?
│   │   └─► MCP-wrapped Skills
│   └─► Actions are complex, multi-step workflows?
│       └─► Skills with orchestration layer
│
├─► "Both knowledge AND actions"
│   └─► Combined Architecture
│       ├─► RAG for knowledge retrieval
│       ├─► Skills/MCP for system actions
│       └─► Orchestrator agent to route between them
│
└─► "Standardize tool access across models"
    └─► MCP
        ├─► One-time server build
        ├─► Works with any MCP client
        └─► Centralized tool management
```

## Scenario-Based Decision Walkthroughs

### Scenario 1: Internal Documentation Q&A

> "We need customer service agents to answer questions using our 50,000-page knowledge base."

**Decision: RAG**

**Why**: The core problem is information retrieval from unstructured documents. Actions aren't needed — just accurate, sourced answers.

**Implementation pattern**:
```
Documents → Chunking Pipeline → Vector Store (Pinecone/Weaviate)
                                      ↓
User Question → Embed → Vector Search → Context Injection → LLM → Answer
                                      ↓
                               Source Attribution
```

**Key decisions within RAG**:
- Chunk size: 512 tokens for FAQ-style docs, 1024 for technical manuals
- Embedding model: `text-embedding-3-large` for multilingual docs
- Retrieval: Hybrid search (vector + BM25) for better recall
- Reranking: Cross-encoder reranker to improve precision

**Cost profile**: Low ongoing cost per query ($0.001-0.01), moderate infrastructure cost for vector store.

### Scenario 2: Automated Report Generation

> "We need the AI to pull data from three databases, generate an Excel report, and email it to stakeholders."

**Decision: Skills**

**Why**: This is fundamentally about **actions** — querying databases, transforming data, generating files, sending emails. The AI is orchestrating a workflow, not answering questions.

**Implementation pattern**:
```typescript
const reportSkill: Skill = {
  name: "generateMonthlyReport",
  description: "Generate monthly traffic analytics report",
  parameters: {
    month: { type: "string", format: "YYYY-MM" },
    recipients: { type: "array", items: { type: "string" } }
  },
  execute: async (params) => {
    const trafficData = await db.query(TRAFFIC_SQL, params.month);
    const fareData = await db.query(FARE_SQL, params.month);
    const report = await excelGenerator.create(trafficData, fareData);
    await emailService.send(params.recipients, report);
    return { status: "sent", reportId: report.id };
  }
};
```

**Key decisions within Skills**:
- Skill granularity: One skill per action vs. composite skills
- Error handling: Retry logic, rollback procedures, dead letter queues
- Permissions: What system access each skill requires

### Scenario 3: Multi-Model Tool Integration

> "We're evaluating Claude, GPT-4, and Gemini for different use cases. We don't want to rebuild our tool integrations for each model."

**Decision: MCP**

**Why**: MCP provides a standardized protocol. Build your tool servers once, and any MCP-compatible client can discover and use them.

**Implementation pattern**:
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Claude API  │    │   GPT-4 API  │    │  Gemini API  │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                  │                  │
       └──────────┬───────┘──────────┬───────┘
                  │                  │
           ┌──────▼──────┐   ┌──────▼──────┐
           │  MCP Client  │   │  MCP Client  │
           └──────┬──────┘   └──────┬──────┘
                  │                  │
           ┌──────▼──────────────────▼──────┐
           │         MCP Servers             │
           │  ┌────────┐ ┌────────┐ ┌──────┐│
           │  │ DB Tool│ │Email   │ │API   ││
           │  │ Server │ │Server  │ │Server││
           │  └────────┘ └────────┘ └──────┘│
           └────────────────────────────────┘
```

**Key decisions within MCP**:
- Transport: stdio (local) vs. SSE (remote)
- Authentication: OAuth 2.0 for remote MCP servers
- Capabilities: What to expose (tools, resources, prompts)

### Scenario 4: Intelligent Operations Platform

> "We need an AI assistant that can answer questions about system health AND take corrective actions — restart services, adjust parameters, escalate alerts."

**Decision: Combined Architecture (RAG + Skills/MCP)**

**Why**: This requires both **knowledge** (system docs, runbooks, historical incidents) and **actions** (system remediation).

**Implementation pattern**:
```
                    ┌──────────────────┐
                    │  Orchestrator    │
                    │  Agent           │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
       ┌──────▼──────┐ ┌────▼────┐ ┌──────▼──────┐
       │  RAG Pipeline │ │  Skills │ │  MCP Layer  │
       │  (Knowledge)  │ │  (Actions)│ │ (Standardized)│
       └──────┬──────┘ └────┬────┘ └──────┬──────┘
              │              │              │
       ┌──────▼──────┐ ┌────▼────┐ ┌──────▼──────┐
       │ Vector Store │ │ System  │ │  Tool       │
       │ + Documents  │ │ APIs    │ │  Servers    │
       └─────────────┘ └─────────┘ └─────────────┘
```

## Comparison Matrix

| Dimension | RAG | Skills | MCP |
|---|---|---|---|
| **Primary Purpose** | Knowledge retrieval | System actions | Tool standardization |
| **Complexity** | Medium | Medium-High | Medium |
| **Latency Impact** | +200-500ms (retrieval) | +100-2000ms (action) | +50-150ms (protocol) |
| **Cost Model** | Vector DB + embeddings | Compute per action | Server hosting |
| **Maintenance** | Index pipeline upkeep | Skill code maintenance | Protocol compliance |
| **Scalability** | Horizontal (shard vectors) | Horizontal (skill instances) | Horizontal (server pools) |
| **Model Dependency** | Low (embedding model) | Low-Medium | Very Low (protocol) |
| **Vendor Lock-in** | Medium (vector DB) | Low | Very Low |
| **Best For** | Q&A over documents | Automation workflows | Multi-model tool access |
| **Worst For** | Real-time actions | Pure knowledge tasks | Single-model projects |

## Hybrid Architecture Patterns

### Pattern 1: RAG-Enhanced Skills

Skills that use RAG internally to make better decisions:

```python
class IntelligentTollingSkill:
    """A skill that retrieves context before taking action."""
    
    async def execute(self, params):
        # Step 1: RAG retrieval for context
        relevant_policies = await self.rag.retrieve(
            f"tolling policy for vehicle class {params.vehicle_class}"
        )
        relevant_rates = await self.rag.retrieve(
            f"current rate structure zone {params.zone}"
        )
        
        # Step 2: Use context to determine action
        rate = self.calculate_rate(
            params.vehicle_class, 
            params.zone, 
            relevant_rates
        )
        
        # Step 3: Apply business rules from policy
        adjusted_rate = self.apply_policy_adjustments(
            rate, 
            relevant_policies
        )
        
        # Step 4: Execute the action
        result = await self.tolling_api.charge(params.vehicle_id, adjusted_rate)
        
        return {
            "rate_applied": adjusted_rate,
            "policy_references": [p.id for p in relevant_policies],
            "transaction_id": result.id
        }
```

### Pattern 2: MCP-Wrapped RAG

Exposing RAG capabilities through MCP so any model can access your knowledge base:

```typescript
// MCP Server that wraps a RAG pipeline
const ragServer = new MCPServer({
  name: "knowledge-base",
  tools: [
    {
      name: "search_documentation",
      description: "Search internal documentation for relevant information",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Natural language search query" },
          category: { type: "string", enum: ["policies", "technical", "procedures"] },
          maxResults: { type: "number", default: 5 }
        },
        required: ["query"]
      }
    }
  ]
});

ragServer.tool("search_documentation", async ({ query, category, maxResults }) => {
  const results = await ragPipeline.retrieve(query, {
    filter: category ? { category } : undefined,
    topK: maxResults
  });
  
  return {
    content: results.map(r => ({
      type: "text",
      text: `[Source: ${r.metadata.title}]\n${r.text}`
    }))
  };
});
```

### Pattern 3: Skill Discovery via MCP

Using MCP's discovery mechanism to let agents dynamically find available skills:

```typescript
// MCP Resources expose available skills as discoverable resources
server.resource("skills", "skills://available", async (uri) => {
  const skills = await skillRegistry.listAll();
  return {
    contents: [{
      uri: uri.href,
      mimeType: "application/json",
      text: JSON.stringify(skills.map(s => ({
        name: s.name,
        description: s.description,
        parameters: s.schema,
        category: s.category,
        requiredPermissions: s.permissions
      })))
    }]
  };
});
```

## Migration Strategies

### From Direct API Calls → Skills

If your current system has AI making direct API calls:

1. **Catalog existing API interactions** — log every external call the AI makes
2. **Group by function** — identify natural skill boundaries
3. **Define schemas** — formalize parameters with JSON Schema
4. **Wrap incrementally** — convert one API group at a time
5. **Add safeguards** — implement validation, retry, and rollback in the skill layer

### From Skills → MCP

If you have a working Skills system and want standardization:

1. **Build MCP adapter** — create an MCP server that wraps existing skills
2. **Map skill schemas to MCP tool schemas** — usually 1:1 with minor differences
3. **Test with MCP client** — verify tool discovery and invocation work
4. **Migrate consumers gradually** — switch one model/client at a time
5. **Decommission direct skill interfaces** — once all clients use MCP

### From RAG → Combined (Adding Actions)

If you have RAG and need to add capabilities:

1. **Identify action triggers** — when should a RAG response lead to an action?
2. **Define action skills** — what operations are needed?
3. **Build routing logic** — classifier or LLM-based to decide "answer" vs "act"
4. **Implement confirmation flow** — critical for actions with side effects
5. **Add audit trail** — log all actions taken based on RAG-retrieved context

## Real Project: ERP2 Rate Management

Here's a simplified version of a decision process for an ERP2 rate management system:

**Initial requirement**: "Operators need to look up current tolling rates and propose changes."

**Decision process**:

```
Step 1: What does the AI need to do?
├─► "Look up rates" → Knowledge → RAG candidate
├─► "Propose changes" → Action → Skills candidate
└─► Both needed → Combined architecture

Step 2: Compliance requirements?
├─► All changes require audit trail → Skills need audit middleware
├─► Rate data is sensitive → RAG needs access controls
└─► Proposals go through approval → Skills need workflow state

Step 3: Future requirements?
├─► Multiple AI models may be used → Add MCP layer
├─► Rate data shared across systems → MCP for rate access
└─► Decision: Build MCP server from day one

Final Architecture:
├─► MCP Server: "rate-knowledge" (RAG for rate docs/policies)
├─► MCP Server: "rate-management" (Skills for CRUD operations)
└─► Client: Claude-powered operator assistant
```

**Result**: A system where operators can ask natural language questions about rates ("What's the current peak hour rate for Class 2 vehicles in Zone A?") and take actions ("Draft a rate change proposal for off-peak discounts").

## Decision Checklist

Use this checklist when starting a new AI integration project:

- [ ] **Problem type**: Is this about knowledge, actions, or both?
- [ ] **Data source**: Structured, unstructured, or mixed?
- [ ] **Multi-model**: Will you use more than one LLM vendor?
- [ ] **Latency requirements**: Can you tolerate retrieval overhead?
- [ ] **Side effects**: Can the AI safely take actions without confirmation?
- [ ] **Compliance**: Do actions need audit trails?
- [ ] **Team expertise**: Does your team know vector databases, or APIs, or both?
- [ ] **Timeline**: Need a quick prototype or a production system?

## The Key Insight

The decision between RAG, Skills, and MCP isn't a technology choice — it's a **problem decomposition** choice. Most real-world systems need elements of all three. Start with the dominant need, then layer in the others as requirements evolve.

The biggest mistake I've seen is teams forcing everything into one pattern. A RAG system trying to perform actions becomes an unreliable automation nightmare. A Skills-only system that needs knowledge will hallucinate answers. An MCP-only setup without the right skills or knowledge is just an empty protocol.

**Start simple. Decompose the problem. Let the architecture emerge from the requirements.**

---

*Next up: How these patterns play out in production government systems — with real lessons from Singapore's transport infrastructure.*
