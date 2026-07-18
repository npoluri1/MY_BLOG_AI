---
heroImage: "/images/linkedin/1767082368232.jpg"
title: "Inference Optimizations: Speeding up Prefill and Decode"
description: "Explore advanced LLM serving optimizations. Learn how FlashAttention, chunked prefill, speculative decoding, and KV cache eviction speed up TTFT and inter-token latency."
pubDate: 2025-07-17
tags: ["ai", "llm", "inference", "optimization", "flashattention", "speculative-decoding", "performance"]
image: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&h=675&fit=crop"
readingTime: "18 min read"
series: "AI Inference Deep-Dive Series"
part: 5
prevPost: "The Landscape of LLM Inference Engines: Open Source vs. Enterprise"
nextPost: "Token Economics, LLM Gateways, and Router9"
---

In local and cloud LLM serving, performance is governed by two main metrics: **Time to First Token (TTFT)** and **Inter-Token Latency (ITL)**.

- **TTFT** is dominated by the **prefill phase**, which processes the input prompt and is compute-bound.
- **ITL** is dominated by the **decode phase**, which generates tokens one-by-one and is memory-bandwidth-bound.

Optimizing an inference engine requires addressing these distinct bottlenecks. In this fifth post of the AI Inference Deep-Dive Series, we'll analyze the technical implementations of key optimizations: FlashAttention and chunked prefill for the prefill phase, alongside speculative decoding and KV cache compression for the decode phase.

## Phase 1: Prefill Optimizations (Improving TTFT)

### 1. FlashAttention: IO-Aware Attention

In standard attention, calculating query-key-value (Q, K, V) matrices requires writing intermediate attention weights (S, P) to high-bandwidth global memory (HBM), and reading them back for the final output. As context length grows, this creates a memory read/write bottleneck.

FlashAttention resolves this by partitioning input matrices into blocks and loading them into fast GPU SRAM. Using online softmax scaling, it calculates attention incrementally without storing the massive intermediate attention matrices in HBM:

```
Standard Attention: Massive HBM I/O Overhead
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  GPU Register │────▶│  HBM: Q, K, V│────▶│  GPU Register │
└──────────────┘     └──────────────┘     └──────────────┘
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  HBM: Attn   │────▶│  GPU Register │────▶│  HBM: Output │
│  Weights S,P │     │              │     │              │
└──────────────┘     └──────────────┘     └──────────────┘

FlashAttention: In-SRAM Tiling & Softmax
┌──────────────┐                    ┌──────────────┐
│   GPU SRAM   │◀──────────────────│  HBM: Q, K, V│
│  (Tiled)     │──────────────────▶│  HBM: Output │
└──────────────┘                    └──────────────┘
```

By avoiding HBM roundtrips, FlashAttention speeds up attention computations by **2x to 4x** while remaining mathematically exact.

### 2. Chunked Prefill

During high-concurrency serving, incoming requests with long prompts block ongoing decode loops. This is because a large prefill takes a long time on the GPU, creating a "prefill bubble" that stalls token generation for other users.

**Chunked Prefill** solves this by dividing long prompts into smaller chunks (e.g. 512 tokens). Instead of executing a single 4096-token prefill, the engine processes one chunk, runs a round of decode steps for active requests, processes the next chunk, and repeats.

```
Without Chunked Prefill:
Request A: [====PREFILL 4096 tokens====] [decode] [decode] ...
Request B:                          [waiting...] [decode] [decode] ...

With Chunked Prefill (chunk=512):
Request A: [PREFILL 512] [decode] [PREFILL 512] [decode] ...
Request B:          [decode] [PREFILL 512] [decode] ...
```

This evens out inter-token latency and prevents user requests from stalling.

## Phase 2: Decode Optimizations (Improving ITL & Throughput)

### 1. Speculative Decoding

Because the decode phase is memory-bound, the GPU spends most of its time loading the model's weights from HBM to SRAM for every single token generated.

**Speculative Decoding** bypasses this by pairing a large target model (e.g. Llama-3-70B) with a much smaller draft model (e.g. Llama-3-8B).

1. The draft model rapidly generates a sequence of K candidate tokens (cheap memory reads).
2. The target model processes all K tokens in parallel in a single forward pass (which is compute-bound, utilizing GPU cores efficiently).
3. The target model accepts or rejects the candidate tokens based on logit verification.

If 4 out of 5 candidate tokens are accepted, the engine gets 4 tokens for the memory-access cost of a single target-model forward pass, speeding up serving by **1.5x to 2.5x**.

```
Speculative Decoding Flow:
┌─────────────┐    K tokens    ┌─────────────┐
│ Draft Model │───────────────▶│ Target Model │
│ (Llama-8B)  │                │ (Llama-70B)  │
└─────────────┘                └──────┬──────┘
                                      │
                              ┌───────▼───────┐
                              │   Validation   │
                              │ Accept/Reject  │
                              └───────┬───────┘
                                      │
                          ┌───────────▼───────────┐
                          │  Accepted: 4/5 tokens  │
                          │  Speedup: ~2x          │
                          └───────────────────────┘
```

### 2. KV Cache Compression & Eviction

Maintaining KV caches for thousands of tokens consumes substantial VRAM, limiting batch sizes.

**H2O (Heavy Hitter Oracle)**: Keeps only the most important tokens in cache by tracking which tokens receive the highest attention scores.

**StreamingLLM**: Keeps only "attention sinks" (the first few tokens) and the most recent tokens, discarding intermediate ones. This allows models to run on infinite text streams with a fixed-size cache memory footprint.

```
Full KV Cache (1000 tokens):
[T1][T2][T3][T4]...[T997][T998][T999][T1000]
 ^^^                       ^^^^^^^^^^^^^^^^^^^
 Attention Sinks           Recent Tokens

StreamingLLM (Fixed Budget = 100 tokens):
[T1][T2][T3][T4]..............[T997][T998][T999][T1000]
 ^^^                           ^^^^^^^^^^^^^^^^^^^^^^^^
 Kept (Sinks)                   Kept (Recent Window)
```

## Summary of Optimization Techniques

| Optimization | Targeted Phase | Primary Bottleneck | Performance Impact |
|---|---|---|---|
| FlashAttention | Prefill | Memory Bandwidth (HBM IO) | Lower TTFT, better scaling at long context |
| Chunked Prefill | Prefill | Scheduling Bubble / Compute Stalls | Lower Inter-Token Latency (ITL) variance |
| Speculative Decoding | Decode | Memory Bandwidth (Weight loading) | Up to 2.5x faster Generation Speed (ITL) |
| KV Cache Compression | Decode | VRAM Capacity (VRAM Bloat) | Higher Max Batch Size, higher overall throughput |

## Hands-On: Speculative Decoding Simulator

To understand the validation mechanism of speculative decoding, here's a Python simulator:

```python
# speculative_decoding_simulator.py
import random

def simulate_speculative_decoding():
    # Vocabulary mapping
    vocab = ["the", "quick", "brown", "fox", "jumps", "over", "lazy", "dog"]
    
    # Draft model candidate generation (fast, but prone to errors)
    draft_tokens = ["the", "quick", "red", "fox", "leaps"]
    
    # Target model validation distribution (ground-truth probabilities)
    target_acceptance_probabilities = {
        "the": 0.99,
        "quick": 0.95,
        "red": 0.05,    # Target prefers "brown"
        "fox": 0.90,
        "leaps": 0.10   # Target prefers "jumps"
    }
    
    accepted_tokens = []
    rejected_at = None
    
    print("=== SPECULATIVE DECODING VALIDATION ===")
    print(f"Draft Model Candidates: {draft_tokens}")
    
    for i, token in enumerate(draft_tokens):
        prob = target_acceptance_probabilities.get(token, 0.0)
        if random.random() < prob:
            accepted_tokens.append(token)
            print(f"✅ Token '{token}' accepted (Prob: {prob:.2f})")
        else:
            rejected_at = i
            print(f"❌ Token '{token}' REJECTED (Prob: {prob:.2f})")
            corrected_token = "brown" if token == "red" else "jumps"
            accepted_tokens.append(corrected_token)
            print(f"🔧 Target model corrected to: '{corrected_token}'")
            break
            
    print(f"\nFinal sequence: {' '.join(accepted_tokens)}")

if __name__ == "__main__":
    simulate_speculative_decoding()
```

If the draft model proposes a wrong token (e.g. "red" instead of "brown"), the target model rejects it, appends the correct token, and halts validation of subsequent tokens.

## What's Next?

Optimizing prefill and decode speeds is essential for single-instance engines, but when dealing with thousands of users, managing scaling across multiple nodes requires robust orchestration.

In our next post, **Token Economics, LLM Gateways, and Router9**, we'll dive into cost calculations, token economics, and setting up gateways for local-to-cloud fallback!

---

*This post is part of the AI Inference Deep-Dive Series. Follow me for more insights on building production-ready AI systems.*
