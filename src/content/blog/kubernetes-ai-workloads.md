---
heroImage: "/images/linkedin/1767083071852.jpg"
title: "Running AI Workloads on Kubernetes: GPU Orchestration Best Practices"
description: "Learn how to configure Kubernetes for AI/ML workloads. GPU scheduling, node affinity, resource quotas, and monitoring for GPU clusters."
pubDate: 2025-06-28
tags: ["ai", "kubernetes", "devops", "infrastructure"]
image: "https://images.unsplash.com/photo-1667372393119-3d4c48d07fc9?w=1200&h=675&fit=crop"
readingTime: "14 min read"
---

Kubernetes has become the de facto platform for orchestrating AI workloads, but running GPU-intensive applications requires careful configuration beyond the default scheduler settings.

## GPU Scheduling in Kubernetes

The NVIDIA device plugin exposes GPUs as schedulable resources. But default scheduling doesn't account for GPU topology, memory, or interconnect — factors that significantly impact ML training performance.

### Key Configuration

```yaml
resources:
  limits:
    nvidia.com/gpu: 4
  requests:
    nvidia.com/gpu: 4
```

## Node Affinity and Topology

For multi-node training, placing workers on the same physical switch or NVLink domain dramatically improves performance. Use node affinity rules and topology labels to control placement.

## Resource Quotas and Multi-Tenancy

GPU time is expensive. Resource quotas prevent team A from consuming all available GPUs, while PriorityClasses ensure critical training jobs preempt lower-priority inference workloads.

## Monitoring GPU Utilization

NVIDIA DCGM (Data Center GPU Manager) provides detailed GPU metrics that integrate with Prometheus. Track utilization, memory usage, temperature, and power consumption to optimize cluster efficiency.

## Conclusion

Kubernetes provides the primitives for GPU orchestration, but effective AI infrastructure requires deep understanding of both Kubernetes and GPU hardware characteristics.
