---
title: "MCP vs RAG vs Skills: The 3 Core Pillars of Enterprise AI Integration"
description: "A deep technical comparison of Model Context Protocol, Retrieval Augmented Generation, and AI Skills — the three foundational patterns for enterprise AI integration. With architecture diagrams, code examples, and a decision framework."
pubDate: 2025-07-12
tags: ["ai", "mcp", "rag", "skills", "enterprise", "agentic"]
image: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=1200&h=675&fit=crop"
readingTime: "16 min read"
---

Every enterprise AI integration project eventually converges on three fundamental patterns: Model Context Protocol (MCP) for tool connectivity, Retrieval Augmented Generation (RAG) for knowledge grounding, and Skills for domain-specific capability encapsulation. Understanding when to use each — and how they compose — is the difference between an AI system that demos well and one that runs in production for years.

## The Three Pillars Defined

### What is MCP (Model Context Protocol)?

MCP is an open protocol standardized by Anthropic that provides a universal interface for AI models to interact with external tools, data sources, and services. Think of it as the USB-C of AI integrations — one standardized connector that works across any model, any provider, any framework.

```
┌──────────────────────────────────────────────────┐
│                  MCP Architecture                │
│                                                  │
│  ┌─────────┐    MCP Protocol    ┌─────────────┐ │
│  │  LLM    │◄─────────────────►│ MCP Server  │ │
│  │ Client  │   JSON-RPC 2.0    │  (Tools)    │ │
│  └─────────┘                   └──────┬──────┘ │
│                                       │        │
│                    ┌──────────────────┼────┐   │
│                    │                  │    │   │
│               ┌────▼───┐  ┌───────▼──┐ │   │
│               │Database│  │API Gateway│ │   │
│               └────────┘  └──────────┘ │   │
│                                  ┌─────▼───┐ │
│                                  │ File Sys│ │
│                                  └─────────┘ │
└──────────────────────────────────────────────────┘
```

MCP servers expose three primitives:

- **Tools**: Functions the model can call (query database, send email, create ticket)
- **Resources**: Data the model can read (file contents, API responses, database rows)
- **Prompts**: Pre-built prompt templates for common workflows

Here's a minimal MCP server in TypeScript:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "enterprise-query-server",
  version: "1.0.0",
});

// Define a tool that queries the enterprise data warehouse
server.tool(
  "query_data_warehouse",
  "Execute a read-only SQL query against the enterprise data warehouse",
  {
    query: z.string().describe("The SQL query to execute (SELECT only)"),
    date_range: z.object({
      start: z.string().describe("Start date in YYYY-MM-DD format"),
      end: z.string().describe("End date in YYYY-MM-DD format"),
    }).optional().describe("Date range filter for temporal queries"),
  },
  async ({ query, date_range }) => {
    // Safety: enforce read-only queries
    if (!query.trim().toUpperCase().startsWith("SELECT")) {
      return {
        content: [{ type: "text", text: "Error: Only SELECT queries are permitted." }],
        isError: true,
      };
    }

    const result = await executeQuery(query, date_range);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// Define a resource that exposes system status
server.resource(
  "system_status",
  "status://enterprise/api-status",
  async (uri) => ({
    contents: [{
      uri: uri.href,
      mimeType: "application/json",
      text: JSON.stringify(await getSystemStatus()),
    }],
  })
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

### What is RAG (Retrieval Augmented Generation)?

RAG augments LLM outputs by retrieving relevant context from external knowledge bases before generation. Instead of relying solely on the model's parametric memory, RAG injects factual, up-to-date, domain-specific information into the prompt context window.

```
┌─────────────────────────────────────────────────────┐
│                  RAG Pipeline                       │
│                                                     │
│  User Query                                        │
│      │                                             │
│      ▼                                             │
│  ┌──────────┐   ┌──────────┐   ┌───────────────┐  │
│  │ Embed    │──►│ Vector   │──►│ Reranker      │  │
│  │ Query    │   │ Search   │   │ (Cross-Enc)   │  │
│  └──────────┘   └──────────┘   └───────┬───────┘  │
│                                         │          │
│                                         ▼          │
│                                  ┌─────────────┐  │
│                                  │ Context     │  │
│                                  │ Assembly    │  │
│                                  └──────┬──────┘  │
│                                         │          │
│                                         ▼          │
│  ┌──────────┐   ┌──────────┐   ┌─────────────┐   │
│  │  LLM     │◄──│ Prompt   │◄──│ Retrieved   │   │
│  │Generate  │   │ Template │   │ Chunks      │   │
│  └──────────┘   └──────────┘   └─────────────┘   │
└─────────────────────────────────────────────────────┘
```

A production RAG pipeline involves multiple stages:

```python
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_community.vectorstores import Chroma
from langchain.retrievers import ContextualCompressionRetriever
from langchain.retrievers.document_compressors import CrossEncoderReranker
from langchain_community.cross_encoders import HuggingFaceCrossEncoder

# Stage 1: Ingestion with semantic chunking
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200,
    length_function=len,
    separators=["\n\n", "\n", ". ", " ", ""],
)

# Stage 2: Embedding with domain-adapted model
embeddings = OpenAIEmbeddings(
    model="text-embedding-3-large",
    dimensions=3072,
)

# Stage 3: Vector store with metadata filtering
vectorstore = Chroma(
    collection="enterprise_knowledge",
    embedding_function=embeddings,
    metadata_config={
        "hnsw:space": "cosine",
    },
)

# Stage 4: Hybrid retrieval with reranking
base_retriever = vectorstore.as_retriever(
    search_type="mmr",
    search_kwargs={"k": 20, "fetch_k": 50},
)

cross_encoder = HuggingFaceCrossEncoder(model_name="BAAI/bge-reranker-v2-m3")
 compressor = CrossEncoderReranker(model=cross_encoder, top_n=5)

retriever = ContextualCompressionRetriever(
    base_compressor=compressor,
    base_retriever=base_retriever,
)

# Stage 5: Generation with citation tracking
def rag_query(question: str, filters: dict = None) -> dict:
    docs = retriever.invoke(question)
    
    context = "\n\n---\n\n".join([
        f"[Source: {doc.metadata.get('source', 'unknown')}]\n{doc.page_content}"
        for doc in docs
    ])
    
    prompt = f"""Answer the question based on the provided context.
    Always cite your sources using [Source: ...] notation.
    
    Context:
    {context}
    
    Question: {question}
    
    Answer:"""
    
    llm = ChatOpenAI(model="gpt-4o", temperature=0)
    response = llm.invoke(prompt)
    
    return {
        "answer": response.content,
        "sources": [doc.metadata for doc in docs],
        "retrieval_count": len(docs),
    }
```

### What are Skills?

Skills are encapsulated, domain-specific capabilities that AI agents can discover, compose, and invoke. Unlike MCP (which provides raw tool access) or RAG (which provides knowledge), Skills bundle together prompts, tools, workflows, and guardrails into reusable units of expertise.

```
┌─────────────────────────────────────────────────┐
│               Skills Architecture               │
│                                                 │
│  ┌───────────────────────────────────────────┐  │
│  │              Agent Runtime               │  │
│  │                                           │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐   │  │
│  │  │ Skill A │ │ Skill B │ │ Skill C │   │  │
│  │  │(Finance)│ │(Legal)  │ │(Ops)    │   │  │
│  │  └────┬────┘ └────┬────┘ └────┬────┘   │  │
│  │       │           │           │         │  │
│  │       ▼           ▼           ▼         │  │
│  │  ┌─────────────────────────────────┐    │  │
│  │  │      Skill Composition Engine   │    │  │
│  │  └─────────────────────────────────┘    │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  Each Skill contains:                          │
│  • System prompt with domain expertise          │
│  • Tool definitions (MCP servers)               │
│  • Knowledge context (RAG collections)          │
│  • Guardrails and validation rules              │
│  • Example inputs/outputs                       │
└─────────────────────────────────────────────────┘
```

A Skill definition in practice looks like this:

```yaml
# skills/fraud-detection/SKILL.md
name: fraud-detection
description: >
  Analyze financial transactions for fraudulent patterns,
  generate risk scores, and recommend actions.
version: 2.1.0
triggers:
  - "check transaction"
  - "fraud analysis"
  - "risk score"
  - "suspicious activity"

tools:
  - mcp-server: transaction-db
    tools: [query_transactions, get_customer_profile]
  - mcp-server: risk-engine
    tools: [calculate_risk_score, get_fraud_rules]

knowledge:
  - collection: fraud-patterns-2025
    description: "Known fraud patterns and typologies"
  - collection: regulatory-guidelines
    description: "AML/CFT regulatory requirements"

prompts:
  system: |
    You are a senior fraud analyst with expertise in
    transaction monitoring and suspicious activity detection.
    
    When analyzing transactions:
    1. Check against known fraud patterns
    2. Assess behavioral anomalies
    3. Evaluate regulatory thresholds
    4. Generate risk score (0-100)
    5. Recommend: APPROVE, REVIEW, or BLOCK
    
    Always explain your reasoning. Never skip validation steps.

guardrails:
  - type: output_validation
    rule: "Risk score must be between 0 and 100"
  - type: action_restriction
    rule: "BLOCK decisions require human confirmation"
  - type: pii_filter
    rule: "Mask NRIC and account numbers in outputs"

examples:
  - input: "Analyze transaction TXN-2025-8834 for potential fraud"
    output: |
      Transaction Analysis: TXN-2025-8834
      Risk Score: 72/100
      Pattern: Unusual geographic pattern (3 countries in 2 hours)
      Recommendation: REVIEW
      Reasoning: Customer's typical pattern shows single-country...
```

## Detailed Comparison

| Dimension | MCP | RAG | Skills |
|---|---|---|---|
| **Primary Purpose** | Tool connectivity | Knowledge retrieval | Domain capability |
| **Abstraction Level** | Low (raw tools) | Medium (knowledge) | High (expertise) |
| **State Management** | Stateless per call | Stateless per query | Stateful workflows |
| **Composition** | Servers expose tools | Pipelines retrieve | Skills compose agents |
| **Discovery** | Server capabilities | Collection schemas | Skill registry |
| **Error Handling** | Tool-level errors | Retrieval failures | Workflow-level recovery |
| **Caching** | Response caching | Semantic caching | Plan caching |
| **Governance** | Per-tool auth | Data access policies | Business rules |
| **Latency** | Low (direct calls) | Medium (search + gen) | Variable (workflow) |
| **Best For** | System integration | Document Q&A | Complex automation |

## When to Use Each Approach

### Use MCP When:

- You need to connect AI models to existing enterprise systems (databases, APIs, message queues)
- Multiple agents need access to the same tooling
- You want model-agnostic tool definitions
- You need fine-grained permission control per tool

### Use RAG When:

- The answer exists in your organization's documents, policies, or knowledge bases
- You need citation and provenance tracking
- The information changes frequently and must stay current
- Domain knowledge is too large or specialized for model training

### Use Skills When:

- You need end-to-end domain workflows, not just individual tools or knowledge
- Multiple steps must be orchestrated with business logic
- Guardrails and validation are critical to the workflow
- You want reusable capabilities that compose across agents

## How They Work Together

The real power emerges when all three patterns compose into a unified architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                    Enterprise AI Platform                   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  Agent Layer                        │   │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐     │   │
│  │  │ Banking   │  │ Compliance│  │ Customer  │     │   │
│  │  │ Agent     │  │ Agent     │  │ Service   │     │   │
│  │  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘     │   │
│  └────────┼──────────────┼──────────────┼─────────────┘   │
│           │              │              │                   │
│  ┌────────▼──────────────▼──────────────▼─────────────┐   │
│  │              Skills Composition Layer              │   │
│  │  [Loan Underwriting] [AML Check] [KYC Verify]    │   │
│  └────────┬──────────────┬──────────────┬─────────────┘   │
│           │              │              │                   │
│  ┌────────▼──────┐ ┌─────▼──────┐ ┌────▼──────┐          │
│  │  MCP Servers  │ │    RAG     │ │  MCP      │          │
│  │  ─────────── │ │ Pipelines  │ │  Servers  │          │
│  │  Core Banking │ │ ───────── │ │ ──────── │          │
│  │  Payment GW   │ │ Policy KB │ │ KYC API  │          │
│  │  CRM System   │ │ Risk Docs │ │ Identity │          │
│  └───────────────┘ └────────────┘ └───────────┘          │
└─────────────────────────────────────────────────────────────┘
```

### Real-World Example: Loan Processing

Consider a bank's loan approval workflow. The three pillars work together seamlessly:

1. **RAG** retrieves the customer's credit history, current policies, and regulatory requirements
2. **MCP** connects to the core banking system to verify account status, the credit bureau API for scores, and the document management system for uploaded evidence
3. **Skills** orchestrate the entire underwriting workflow: risk assessment, policy compliance check, approval routing, and conditional offer generation

```python
# Skill definition composing RAG + MCP
class LoanUnderwritingSkill:
    def __init__(self):
        self.rag = RAGPipeline(
            collections=["credit-policies", "regulatory-guidelines", "risk-models"],
            reranker="BAAI/bge-reranker-v2-m3",
        )
        self.mcp_tools = MCPRouter(servers=[
            "core-banking-server",
            "credit-bureau-server",
            "document-mgmt-server",
        ])
    
    async def execute(self, application_id: str) -> UnderwritingDecision:
        # RAG: Retrieve relevant policies and risk models
        policies = await self.rag.query(
            f"loan approval policies for application type",
            filters={"region": "SG", "product_type": "personal_loan"},
        )
        
        # MCP: Pull live data from external systems
        credit_score = await self.mcp_tools.call(
            "credit-bureau-server",
            "get_credit_score",
            {"application_id": application_id},
        )
        
        account_status = await self.mcp_tools.call(
            "core-banking-server",
            "get_account_status",
            {"application_id": application_id},
        )
        
        # Compose context and make decision
        context = assemble_underwriting_context(
            policies=policies,
            credit_score=credit_score,
            account_status=account_status,
        )
        
        decision = await self.llm.generate(
            prompt=UNDERWRITING_PROMPT,
            context=context,
            guardrails=self.guardrails,
        )
        
        return decision
```

## Real-World Patterns from Government and Banking

### Government: Citizen Service Agent

In Singapore's public sector, citizen-facing service agents combine all three pillars:

- **RAG** grounds responses in the latest policy documents, eligibility criteria, and procedural guides — ensuring citizens get accurate, policy-compliant information
- **MCP** connects to backend systems like Singpass authentication, CPF databases, HDB records, and license registries — enabling the agent to take action, not just provide information
- **Skills** encapsulate entire service workflows like "Apply for Housing Grant" or "Renew Vehicle License" — bundling the prompts, tools, knowledge, and business rules into a single composable unit

### Banking: Anti-Money Laundering (AML) Investigation

AML investigation teams use AI agents that demonstrate the full integration pattern:

- **RAG** searches across millions of historical SARs (Suspicious Activity Reports), case studies, and regulatory circulars to find relevant precedents
- **MCP** queries transaction monitoring systems, sanctions lists (OFAC, UN, EU), and corporate registries to pull real-time data
- **Skills** orchestrate the investigation workflow: initial triage, deep analysis, evidence gathering, report generation, and escalation routing

## Decision Framework

When approaching an enterprise AI integration, use this decision tree:

```
Start
  │
  ▼
Does the task need live data from external systems?
  ├── YES → MCP (connect to those systems)
  │         Does the task also need domain knowledge?
  │           ├── YES → MCP + RAG
  │           └── NO  → MCP only
  │
  └── NO
      ▼
      Does the task need knowledge from documents/knowledge bases?
        ├── YES → RAG
        │         Does the task involve multi-step workflows?
        │           ├── YES → RAG + Skills
        │           └── NO  → RAG only
        │
        └── NO
            ▼
            Does the task need domain-specific reasoning and guardrails?
              ├── YES → Skills
              └── NO  → Direct LLM prompt (no integration needed)
```

### Key Questions for Architecture Decisions

1. **Freshness**: Does the data change frequently? → RAG for dynamic knowledge, MCP for live system data
2. **Action**: Does the agent need to do something, not just answer? → MCP for write operations
3. **Complexity**: Is this a multi-step business process? → Skills for orchestration
4. **Governance**: Are there compliance requirements? → Skills with guardrails
5. **Reusability**: Will this capability be used across agents? → Skills for composition
6. **Scale**: Will many agents need this data? → MCP servers as shared infrastructure

## Conclusion

MCP, RAG, and Skills are not competing patterns — they are complementary layers of a mature enterprise AI architecture. MCP provides the nervous system connecting models to the outside world. RAG provides the memory grounding models in organizational knowledge. Skills provide the expertise enabling models to perform complex, governed workflows.

The organizations that get AI integration right are the ones that understand this composition and build their architectures accordingly. Start with the simplest pattern that works for your use case, and compose upward as complexity demands.

In the next post, we'll explore the failure patterns that plague enterprise AI implementations — and the engineering practices that prevent them.
