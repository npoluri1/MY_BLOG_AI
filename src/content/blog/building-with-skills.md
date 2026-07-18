---
heroImage: "/images/linkedin/Udemy-Business-Manager-Essentials-Critical-Thinking-for-AI-Workbookpdf_thumb.jpg"
title: "Building with Skills: The Missing Piece in Enterprise AI"
description: "Deep dive into Skills as agentic AI primitives — architecture patterns, code examples in TypeScript and Python, real-world implementations, and building a skill marketplace for enterprise environments."
pubDate: 2025-06-12
tags: ["ai", "skills", "enterprise", "code-examples", "agentic"]
image: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&h=400&fit=crop"
readingTime: "14 min"
---

# Building with Skills: The Missing Piece in Enterprise AI

Everyone talks about RAG. Everyone's excited about MCP. But the pattern that actually delivers business value in enterprise AI — the one that turns a chatbot into an operational tool — is **Skills**.

Skills are the action primitives of agentic AI. They're how an AI system moves from "telling you what to do" to "actually doing it." After building dozens of skills for enterprise systems, I've found this is the most under-discussed and most impactful pattern in the AI integration toolkit.

This post goes deep on Skills: architecture, code, real-world examples, and how to build a skill ecosystem for your organization.

## What Are Skills in Agentic AI?

A Skill is a structured, self-contained action that an AI agent can discover, understand, and invoke. Think of it as an API endpoint redesigned for AI consumption — with rich descriptions, typed parameters, and built-in guardrails.

```
Traditional API:     POST /api/v1/tolling/rates  {"vehicle_class": "2", "zone": "A"}
AI Skill:            {
                       name: "lookupTollingRates",
                       description: "Retrieve current tolling rates for a specific vehicle class and zone. Returns rate amount, effective dates, and any applicable surcharges.",
                       parameters: {
                         vehicleClass: { type: "string", enum: ["1","2","3","4","5"], description: "..." },
                         zone: { type: "string", description: "..." },
                         includeSurcharges: { type: "boolean", default: true }
                       }
                     }
```

The difference: a traditional API assumes a developer will read documentation and write integration code. A Skill assumes an **AI agent** will read the description and decide when/how to invoke it.

### The Three Components of a Skill

```
┌──────────────────────────────────────────┐
│                SKILL                      │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │  1. DEFINITION                     │  │
│  │  - Name and description            │  │
│  │  - Parameter schema (JSON Schema)  │  │
│  │  - Return type specification       │  │
│  │  - Required permissions            │  │
│  │  - Side effect classification      │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │  2. EXECUTION LOGIC                │  │
│  │  - Input validation                │  │
│  │  - Business logic                  │  │
│  │  - External API calls              │  │
│  │  - Error handling                  │  │
│  │  - Retry strategies                │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │  3. METADATA                       │  │
│  │  - Version                         │  │
│  │  - Author and ownership            │  │
│  │  - Usage statistics                │  │
│  │  - Dependencies                    │  │
│  │  - Cost estimation                 │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

## The Skills Architecture Pattern

### Skill Definition (TypeScript)

```typescript
// Core skill types
interface SkillParameter {
  type: "string" | "number" | "boolean" | "array" | "object";
  description: string;
  enum?: string[];
  required?: boolean;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  items?: { type: string; description?: string };
  properties?: Record<string, SkillParameter>;
}

interface SkillDefinition {
  name: string;
  description: string;
  category: string;
  parameters: Record<string, SkillParameter>;
  returnType: {
    type: string;
    properties?: Record<string, { type: string; description: string }>;
  };
  sideEffects: "none" | "read" | "write" | "destructive";
  requiredPermissions: string[];
  estimatedLatencyMs: number;
  version: string;
  tags: string[];
}

interface SkillResult {
  success: boolean;
  data?: unknown;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
  metadata: {
    executionTimeMs: number;
    cacheHit: boolean;
    auditId: string;
  };
}
```

### Complete Skill Implementation

Here's a production-ready skill for querying traffic data:

```typescript
import { Skill, SkillContext, SkillResult } from "@enterprise/ai-skills";
import { z } from "zod";

// Define the skill with full metadata
export const trafficQuerySkill: Skill = {
  definition: {
    name: "queryTrafficFlow",
    description: `
      Query real-time traffic flow data for Singapore road segments.
      Returns speed, volume, and congestion level for specified road segments.
      Data is updated every 5 minutes from LTA DataMall sensors.
      Use this skill when the user asks about current traffic conditions,
      congestion levels, or road speeds for specific roads or areas.
    `,
    category: "transport-data",
    parameters: {
      roadSegment: {
        type: "string",
        description: "LTA road segment identifier or road name (e.g., 'PIE', 'CTE', 'ECP')",
        required: true,
      },
      timeRange: {
        type: "object",
        description: "Time range for the query. Defaults to current time if omitted.",
        properties: {
          start: { type: "string", description: "ISO 8601 timestamp" },
          end: { type: "string", description: "ISO 8601 timestamp" },
        },
        required: false,
      },
      metrics: {
        type: "array",
        description: "Specific metrics to return. Returns all if omitted.",
        items: { type: "string" },
        required: false,
      },
      granularity: {
        type: "string",
        description: "Data granularity",
        enum: ["current", "5min", "15min", "hourly"],
        required: false,
        default: "current",
      },
    },
    returnType: {
      type: "object",
      properties: {
        roadSegment: { type: "string", description: "Road segment name" },
        speed: { type: "number", description: "Average speed in km/h" },
        volume: { type: "number", description: "Vehicle count per hour" },
        congestionLevel: { type: "string", description: "Low/Medium/High/Heavy" },
        dataTimestamp: { type: "string", description: "When the data was captured" },
      },
    },
    sideEffects: "read",
    requiredPermissions: ["transport:read"],
    estimatedLatencyMs: 150,
    version: "2.1.0",
    tags: ["traffic", "real-time", "transport", "singapore"],
  },

  async execute(params: Record<string, unknown>, ctx: SkillContext): Promise<SkillResult> {
    const startTime = Date.now();
    const auditId = ctx.generateAuditId();

    try {
      // 1. Validate and resolve parameters
      const roadSegment = await resolveRoadSegment(params.roadSegment as string);
      if (!roadSegment) {
        return {
          success: false,
          error: {
            code: "ROAD_SEGMENT_NOT_FOUND",
            message: `Could not find road segment: ${params.roadSegment}`,
            retryable: false,
          },
          metadata: {
            executionTimeMs: Date.now() - startTime,
            cacheHit: false,
            auditId,
          },
        };
      }

      // 2. Check cache first
      const cacheKey = `traffic:${roadSegment.id}:${params.granularity}`;
      const cached = await ctx.cache.get(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached,
          metadata: {
            executionTimeMs: Date.now() - startTime,
            cacheHit: true,
            auditId,
          },
        };
      }

      // 3. Query the data source
      const timeRange = params.timeRange as { start?: string; end?: string } | undefined;
      const trafficData = await ctx.dataSources.trafficFlow.query({
        segmentId: roadSegment.id,
        startTime: timeRange?.start || new Date().toISOString(),
        endTime: timeRange?.end || new Date().toISOString(),
        granularity: (params.granularity as string) || "current",
      });

      // 4. Transform and enrich
      const result = {
        roadSegment: roadSegment.name,
        speed: trafficData.avgSpeed,
        volume: trafficData.vehicleCount,
        congestionLevel: classifyCongestion(trafficData.avgSpeed, roadSegment.freeFlowSpeed),
        dataTimestamp: trafficData.timestamp,
        additionalMetrics: params.metrics
          ? filterMetrics(trafficData, params.metrics as string[])
          : undefined,
      };

      // 5. Cache for future requests (5 min TTL)
      await ctx.cache.set(cacheKey, result, { ttl: 300 });

      return {
        success: true,
        data: result,
        metadata: {
          executionTimeMs: Date.now() - startTime,
          cacheHit: false,
          auditId,
        },
      };

    } catch (error) {
      ctx.logger.error("Traffic query failed", { error, auditId });
      return {
        success: false,
        error: {
          code: "TRAFFIC_QUERY_FAILED",
          message: "Failed to retrieve traffic data. The data source may be temporarily unavailable.",
          retryable: true,
        },
        metadata: {
          executionTimeMs: Date.now() - startTime,
          cacheHit: false,
          auditId,
        },
      };
    }
  },
};

function classifyCongestion(currentSpeed: number, freeFlowSpeed: number): string {
  const ratio = currentSpeed / freeFlowSpeed;
  if (ratio > 0.8) return "Low";
  if (ratio > 0.6) return "Medium";
  if (ratio > 0.4) return "High";
  return "Heavy";
}
```

### Python Implementation

For teams working in Python:

```python
from dataclasses import dataclass, field
from typing import Any, Optional
from enum import Enum
import json
import time
import hashlib

class SideEffect(Enum):
    NONE = "none"
    READ = "read"
    WRITE = "write"
    DESTRUCTIVE = "destructive"

@dataclass
class SkillParameter:
    name: str
    type: str
    description: str
    required: bool = False
    default: Any = None
    enum: Optional[list] = None
    
    def to_json_schema(self) -> dict:
        schema = {
            "type": self.type,
            "description": self.description,
        }
        if self.enum:
            schema["enum"] = self.enum
        if self.default is not None:
            schema["default"] = self.default
        return schema

@dataclass
class SkillDefinition:
    name: str
    description: str
    category: str
    parameters: list[SkillParameter]
    side_effects: SideEffect
    required_permissions: list[str] = field(default_factory=list)
    version: str = "1.0.0"
    tags: list[str] = field(default_factory=list)

@dataclass
class SkillResult:
    success: bool
    data: Any = None
    error: Optional[dict] = None
    metadata: dict = field(default_factory=dict)


class SkillRegistry:
    """Registry for managing and discovering skills."""
    
    def __init__(self):
        self._skills: dict[str, SkillDefinition] = {}
        self._executors: dict[str, callable] = {}
        self._stats: dict[str, dict] = {}
    
    def register(self, definition: SkillDefinition, executor: callable):
        """Register a skill with its execution function."""
        self._skills[definition.name] = definition
        self._executors[definition.name] = executor
        self._stats[definition.name] = {
            "invocations": 0,
            "errors": 0,
            "avg_latency_ms": 0,
        }
    
    def discover(self, context: str = None) -> list[SkillDefinition]:
        """Discover available skills, optionally filtered by context."""
        skills = list(self._skills.values())
        if context:
            # Filter by relevance to context
            skills = [s for s in skills if any(
                tag in context.lower() for tag in s.tags
            )]
        return skills
    
    def get_skill_prompt(self, skill_names: list[str] = None) -> str:
        """Generate a prompt section describing available skills."""
        skills = (
            [self._skills[n] for n in skill_names if n in self._skills]
            if skill_names
            else list(self._skills.values())
        )
        
        prompt_parts = ["## Available Skills\n"]
        for skill in skills:
            params_desc = []
            for p in skill.parameters:
                req = "required" if p.required else "optional"
                enum_str = f" (one of: {', '.join(p.enum)})" if p.enum else ""
                default_str = f" (default: {p.default})" if p.default is not None else ""
                params_desc.append(
                    f"  - `{p.name}` ({p.type}, {req}): {p.description}{enum_str}{default_str}"
                )
            
            prompt_parts.append(f"### {skill.name}")
            prompt_parts.append(f"{skill.description}")
            prompt_parts.append(f"Category: {skill.category} | Side effects: {skill.side_effects.value}")
            prompt_parts.append(f"Parameters:")
            prompt_parts.extend(params_desc)
            prompt_parts.append("")
        
        return "\n".join(prompt_parts)
    
    async def execute(self, skill_name: str, params: dict, context: Any) -> SkillResult:
        """Execute a skill with validation and monitoring."""
        if skill_name not in self._skills:
            return SkillResult(
                success=False,
                error={"code": "SKILL_NOT_FOUND", "message": f"Skill '{skill_name}' not found"}
            )
        
        definition = self._skills[skill_name]
        executor = self._executors[skill_name]
        
        # Validate permissions
        if definition.required_permissions:
            has_perms = all(
                context.has_permission(p) for p in definition.required_permissions
            )
            if not has_perms:
                return SkillResult(
                    success=False,
                    error={"code": "PERMISSION_DENIED", "message": "Insufficient permissions"}
                )
        
        # Execute with monitoring
        start_time = time.time()
        try:
            result = await executor(params, context)
            latency = (time.time() - start_time) * 1000
            
            self._stats[skill_name]["invocations"] += 1
            self._stats[skill_name]["avg_latency_ms"] = (
                (self._stats[skill_name]["avg_latency_ms"] * 
                 (self._stats[skill_name]["invocations"] - 1) + latency) /
                self._stats[skill_name]["invocations"]
            )
            
            result.metadata["executionTimeMs"] = latency
            return result
            
        except Exception as e:
            self._stats[skill_name]["errors"] += 1
            return SkillResult(
                success=False,
                error={
                    "code": "EXECUTION_ERROR",
                    "message": str(e),
                    "retryable": isinstance(e, TransientError),
                },
                metadata={"executionTimeMs": (time.time() - start_time) * 1000}
            )
```

## Skill Composition and Chaining

Real-world tasks often require multiple skills chained together:

```python
class SkillComposer:
    """Compose multiple skills into multi-step workflows."""
    
    async def execute_workflow(
        self, 
        steps: list[dict], 
        context: Any
    ) -> dict:
        results = []
        shared_context = {}
        
        for i, step in enumerate(steps):
            skill_name = step["skill"]
            # Allow referencing outputs from previous steps
            params = self._resolve_params(step["params"], shared_context)
            
            result = await self.registry.execute(skill_name, params, context)
            
            if not result.success:
                return {
                    "workflow_success": False,
                    "failed_step": i,
                    "failed_skill": skill_name,
                    "error": result.error,
                    "completed_steps": results,
                }
            
            shared_context[f"step_{i}"] = result.data
            results.append({
                "step": i,
                "skill": skill_name,
                "result": result.data,
            })
        
        return {
            "workflow_success": True,
            "results": results,
            "final_output": results[-1]["result"],
        }
    
    def _resolve_params(self, params: dict, context: dict) -> dict:
        """Resolve parameter references like $step_0.speed."""
        resolved = {}
        for key, value in params.items():
            if isinstance(value, str) and value.startswith("$"):
                ref = value[1:]  # Remove $
                parts = ref.split(".")
                obj = context.get(parts[0], {})
                for part in parts[1:]:
                    obj = obj.get(part, {})
                resolved[key] = obj
            else:
                resolved[key] = value
        return resolved


# Example: Multi-skill workflow for incident analysis
incident_analysis_workflow = {
    "name": "analyzeIncident",
    "description": "Analyze a traffic incident and recommend response",
    "steps": [
        {
            "skill": "queryTrafficFlow",
            "params": {
                "roadSegment": "$incident.location",
                "granularity": "current",
            },
        },
        {
            "skill": "lookupIncidentHistory",
            "params": {
                "location": "$incident.location",
                "radius_km": 2,
                "days": 30,
            },
        },
        {
            "skill": "calculateDetourRoutes",
            "params": {
                "affectedRoad": "$incident.location",
                "trafficData": "$step_0",
            },
        },
        {
            "skill": "generateIncidentReport",
            "params": {
                "incident": "$incident",
                "trafficData": "$step_0",
                "historicalPatterns": "$step_1",
                "alternativeRoutes": "$step_2",
            },
        },
    ],
}
```

## Real-World Skill Examples

### Database Query Skill

```typescript
export const databaseQuerySkill: Skill = {
  definition: {
    name: "queryDatabase",
    description: `
      Execute a read-only SQL query against the operational database.
      Only SELECT queries are permitted. INSERT, UPDATE, DELETE, DROP, 
      and other write operations are blocked by the query validator.
      Use this skill when you need to retrieve specific data that isn't 
      available through other skills.
    `,
    category: "data-access",
    parameters: {
      query: {
        type: "string",
        description: "SQL SELECT query to execute",
        required: true,
      },
      database: {
        type: "string",
        description: "Target database",
        enum: ["analytics", "operations", "reporting"],
        required: true,
      },
      maxRows: {
        type: "number",
        description: "Maximum rows to return (default: 100, max: 1000)",
        default: 100,
        maximum: 1000,
      },
    },
    sideEffects: "read",
    requiredPermissions: ["database:read"],
    estimatedLatencyMs: 500,
    version: "1.3.0",
    tags: ["database", "sql", "data"],
  },

  async execute(params, ctx): Promise<SkillResult> {
    const query = params.query as string;
    
    // Safety: validate it's a read-only query
    if (!isReadOnlyQuery(query)) {
      return {
        success: false,
        error: {
          code: "WRITE_QUERY_BLOCKED",
          message: "Only SELECT queries are permitted through this skill.",
          retryable: false,
        },
      };
    }
    
    // Safety: enforce row limit
    const limitedQuery = enforceRowLimit(query, params.maxRows as number || 100);
    
    try {
      const result = await ctx.db.query(params.database as string, limitedQuery);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "QUERY_FAILED",
          message: `Database error: ${error.message}`,
          retryable: isRetryableError(error),
        },
      };
    }
  },
};

function isReadOnlyQuery(query: string): boolean {
  const normalized = query.trim().toLowerCase();
  const forbidden = ["insert", "update", "delete", "drop", "alter", "create", "truncate", "grant"];
  const firstWord = normalized.split(/\s/)[0];
  return firstWord === "select" && !forbidden.some(kw => normalized.includes(kw));
}
```

### API Call Skill

```typescript
export const externalApiSkill: Skill = {
  definition: {
    name: "callExternalApi",
    description: `
      Make an authenticated HTTP request to an approved external API.
      Only pre-registered API endpoints are permitted. The skill handles
      authentication, rate limiting, and response parsing automatically.
    `,
    category: "integration",
    parameters: {
      apiName: {
        type: "string",
        description: "Name of the registered API to call",
        enum: ["weather", "postal", "geocoding"],
        required: true,
      },
      endpoint: {
        type: "string",
        description: "API endpoint path (e.g., '/v1/current')",
        required: true,
      },
      method: {
        type: "string",
        enum: ["GET", "POST"],
        default: "GET",
        required: false,
      },
      parameters: {
        type: "object",
        description: "Query parameters or POST body",
        required: false,
      },
    },
    sideEffects: "read",
    requiredPermissions: ["api:external"],
    estimatedLatencyMs: 1000,
    version: "1.0.0",
    tags: ["api", "http", "integration"],
  },

  async execute(params, ctx): Promise<SkillResult> {
    const config = API_REGISTRY[params.apiName as string];
    if (!config) {
      return {
        success: false,
        error: { code: "API_NOT_REGISTERED", message: "Unknown API", retryable: false },
      };
    }
    
    const url = `${config.baseUrl}${params.endpoint}`;
    
    try {
      const response = await ctx.httpClient.request({
        method: (params.method as string) || "GET",
        url,
        params: params.parameters,
        headers: {
          "Authorization": `Bearer ${await ctx.secrets.get(config.secretKey)}`,
          "X-Request-ID": ctx.generateRequestId(),
        },
        timeout: config.timeoutMs || 5000,
      });
      
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "API_CALL_FAILED",
          message: `API call failed: ${error.message}`,
          retryable: error.status >= 500 || error.code === "ECONNRESET",
        },
      };
    }
  },
};
```

### File System Skill

```typescript
export const fileSystemSkill: Skill = {
  definition: {
    name: "fileSystemOperation",
    description: `
      Read, write, or list files in the designated workspace directory.
      All operations are restricted to the /workspace/ sandbox.
      Path traversal outside the sandbox is blocked.
    `,
    category: "file-system",
    parameters: {
      operation: {
        type: "string",
        enum: ["read", "write", "list", "exists"],
        required: true,
      },
      path: {
        type: "string",
        description: "Relative path within /workspace/",
        required: true,
      },
      content: {
        type: "string",
        description: "Content to write (only for write operation)",
        required: false,
      },
    },
    sideEffects: "write",
    requiredPermissions: ["filesystem:workspace"],
    estimatedLatencyMs: 100,
    version: "1.1.0",
    tags: ["file", "filesystem", "io"],
  },

  async execute(params, ctx): Promise<SkillResult> {
    const sandboxPath = "/workspace/";
    const requestedPath = params.path as string;
    
    // Security: path traversal prevention
    const resolved = path.resolve(sandboxPath, requestedPath);
    if (!resolved.startsWith(sandboxPath)) {
      return {
        success: false,
        error: {
          code: "PATH_TRAVERSAL_BLOCKED",
          message: "Path attempts to access files outside the workspace sandbox.",
          retryable: false,
        },
      };
    }
    
    try {
      switch (params.operation) {
        case "read":
          const content = await fs.readFile(resolved, "utf-8");
          return { success: true, data: { content, path: resolved } };
        
        case "write":
          await fs.mkdir(path.dirname(resolved), { recursive: true });
          await fs.writeFile(resolved, params.content as string, "utf-8");
          return { success: true, data: { path: resolved, written: true } };
        
        case "list":
          const entries = await fs.readdir(resolved, { withFileTypes: true });
          return {
            success: true,
            data: entries.map(e => ({
              name: e.name,
              type: e.isDirectory() ? "directory" : "file",
            })),
          };
        
        case "exists":
          const exists = await fs.access(resolved).then(() => true).catch(() => false);
          return { success: true, data: { exists } };
        
        default:
          return {
            success: false,
            error: { code: "UNKNOWN_OPERATION", message: `Unknown operation: ${params.operation}` },
          };
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: "FILE_OPERATION_FAILED",
          message: error.message,
          retryable: error.code === "ENOENT" ? false : true,
        },
      };
    }
  },
};
```

## Skills vs. Function Calling vs. Tool Use

These concepts overlap but aren't identical. Here's how they differ:

| Aspect | Function Calling | Tool Use | Skills |
|---|---|---|---|
| **Origin** | OpenAI API | OpenAI/Anthropic APIs | Agentic frameworks |
| **Definition** | Inline with API call | Inline with API call | Registered, discoverable |
| **Discovery** | Client defines all | Client defines all | Dynamic at runtime |
| **Composition** | Sequential calls | Sequential calls | Workflows, chaining |
| **Versioning** | None | None | Full version lifecycle |
| **Access Control** | Application-level | Application-level | Per-skill permissions |
| **Monitoring** | Application-level | Application-level | Built-in metrics |
| **Reusability** | Per-application | Per-application | Cross-application |

**The key insight**: Function calling and tool use are **API-level features** — they tell a single model how to call tools in a single conversation. Skills are an **architecture-level pattern** — they create an ecosystem of reusable, manageable, monitorable action primitives that can be shared across models, applications, and teams.

## Building a Skill Marketplace for Enterprise

Once you have 20+ skills, you need governance and discovery. Here's the pattern:

```python
class SkillMarketplace:
    """Enterprise skill marketplace for discovery and governance."""
    
    def __init__(self, registry: SkillRegistry):
        self.registry = registry
        self.approval_queue = []
        self.usage_analytics = UsageAnalytics()
    
    async def publish_skill(self, skill: SkillDefinition, executor: callable, author: str):
        """Submit a new skill for review and publication."""
        submission = {
            "skill": skill,
            "executor": executor,
            "author": author,
            "submitted_at": datetime.utcnow(),
            "status": "pending_review",
            "review_checklist": {
                "security_review": False,
                "performance_tested": False,
                "documentation_complete": False,
                "error_handling_verified": False,
                "permissions_minimal": False,
            }
        }
        self.approval_queue.append(submission)
        await self.notify_reviewers(submission)
    
    async def approve_skill(self, skill_name: str, reviewer: str):
        """Approve and publish a skill."""
        submission = self._find_submission(skill_name)
        
        # Verify all checklist items
        if not all(submission["review_checklist"].values()):
            raise ApprovalError("Not all review checklist items completed")
        
        # Register the skill
        self.registry.register(submission["skill"], submission["executor"])
        
        # Set up monitoring
        await self.usage_analytics.track_skill(skill_name)
        
        submission["status"] = "published"
        submission["approved_by"] = reviewer
        submission["published_at"] = datetime.utcnow()
    
    async def get_recommendations(self, task_description: str) -> list[dict]:
        """Recommend skills for a given task description."""
        published_skills = self.registry.discover()
        
        # Score skills by relevance to task
        scored = []
        for skill in published_skills:
            relevance = await self._compute_relevance(task_description, skill)
            usage_stats = self.usage_analytics.get_stats(skill.name)
            
            scored.append({
                "skill": skill,
                "relevance_score": relevance,
                "success_rate": usage_stats.success_rate,
                "avg_latency_ms": usage_stats.avg_latency_ms,
                "usage_count": usage_stats.total_invocations,
            })
        
        # Sort by combined relevance and reliability
        scored.sort(
            key=lambda x: x["relevance_score"] * x["success_rate"],
            reverse=True
        )
        
        return scored[:5]
```

### Skill Lifecycle

```
Draft → Review → Published → Active → Deprecated → Archived
  │        │         │           │          │           │
  │        │         │           │          │           └─ 90 days after deprecation
  │        │         │           │          └─ New version available,
  │        │         │           │             maintained for compatibility
  │        │         │           └─ Collecting usage metrics,
  │        │         │              performance baselines
  │        │         └─ Available for discovery and invocation
  │        └─ Security review, testing, documentation check
  └─ Author creates definition + executor
```

## Key Takeaways

1. **Skills bridge the gap** between AI understanding and system action. They're the verbs of agentic AI.
2. **Rich descriptions matter** — the AI uses the description to decide when to invoke a skill. Vague descriptions lead to misuse.
3. **Security by design** — every skill needs permission boundaries, input validation, and audit logging.
4. **Start with 5-10 core skills** — don't try to build everything at once. Let the marketplace grow organically.
5. **Version everything** — skills will evolve. Your versioning and deprecation strategy matters.
6. **Monitor skill usage** — track which skills are used, which fail, and which are never invoked. This informs your roadmap.

Skills are where AI stops being a demo and starts being infrastructure. Build them well, and your AI systems become genuinely useful operational tools rather than impressive but impractical experiments.

---

*Skills work best as part of a broader architecture. Pair them with RAG for knowledge and MCP for standardization — covered in the companion post on the AI Integration Decision Matrix.*
