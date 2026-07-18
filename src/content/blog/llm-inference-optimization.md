---
title: "LLM Inference Optimization: From KV Cache to Speculative Decoding"
description: "Deep dive into LLM serving optimizations including KV cache management, FlashAttention, speculative decoding, and continuous batching for maximum throughput."
pubDate: 2025-07-05
tags: ["ai", "machine-learning", "performance", "infrastructure"]
image: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&h=675&fit=crop"
readingTime: "18 min read"
---

Running Large Language Models in production requires understanding the微妙 balance between latency, throughput, and cost. This guide covers the key optimization techniques used in modern LLM serving systems.

## The KV Cache Bottleneck

The Key-Value cache is the fundamental memory structure in transformer inference. Every token generation requires attention over all previous tokens, and the KV cache stores these precomputed values. But VRAM is finite, and KV cache growth is the primary bottleneck for long-context serving.

### Memory Calculation

For a 70B parameter model with 80 layers, 64 heads, and head dimension 128:
- Per-token KV cache: ~1MB
- 128K context window: ~128GB just for KV cache
- This exceeds the VRAM of even 8x H100 GPUs

## FlashAttention: IO-Aware Attention

FlashAttention revolutionized transformer efficiency by reformulating attention computation to be IO-aware. Instead of materializing the full attention matrix, it computes attention in blocks that fit in GPU SRAM.

### Key Insights
- Memory usage goes from O(N²) to O(N)
- 2-4x speedup on modern GPUs
- Enables much longer context windows

## Speculative Decoding

The decode phase of LLM inference is memory-bandwidth bound — each token generation requires loading the entire model weights. Speculative decoding trades compute for bandwidth by using a smaller draft model to generate candidate tokens that the larger model verifies in parallel.

## Continuous Batching

Static batching wastes GPU cycles when requests have different lengths. Continuous batching (also called in-flight batching) allows new requests to join a batch as others complete, dramatically improving GPU utilization.

## Conclusion

LLM optimization is a rapidly evolving field. The key is understanding the hardware constraints — memory bandwidth, VRAM capacity, and interconnect topology — and designing serving systems that work with these constraints rather than against them.
