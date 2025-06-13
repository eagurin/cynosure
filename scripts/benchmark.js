#!/usr/bin/env node
/**
 * Cynosure Bridge Performance Benchmark Script
 * Tests various endpoints and measures performance metrics
 */

import fetch from 'node-fetch';
import { performance } from 'node:perf_hooks';

const BASE_URL = process.env.BENCHMARK_URL || 'http://localhost:3000';
const CONCURRENT_REQUESTS = parseInt(process.env.CONCURRENT_REQUESTS || '10');
const TOTAL_REQUESTS = parseInt(process.env.TOTAL_REQUESTS || '100');
const TEST_DURATION = parseInt(process.env.TEST_DURATION || '30'); // seconds

class BenchmarkRunner {
  constructor() {
    this.results = {
      health: [],
      models: [],
      chatCompletions: [],
      embeddings: [],
      githubWebhook: []
    };
  }

  async measureRequest(url, options = {}) {
    const start = performance.now();
    try {
      const response = await fetch(url, {
        timeout: 30000,
        ...options
      });
      const end = performance.now();
      const duration = end - start;
      
      return {
        success: response.ok,
        status: response.status,
        duration,
        size: parseInt(response.headers.get('content-length') || '0')
      };
    } catch (error) {
      const end = performance.now();
      return {
        success: false,
        status: 0,
        duration: end - start,
        error: error.message,
        size: 0
      };
    }
  }

  async benchmarkHealthEndpoint() {
    console.log('🏥 Benchmarking Health Endpoint...');
    const results = [];
    
    for (let i = 0; i < TOTAL_REQUESTS; i++) {
      const result = await this.measureRequest(`${BASE_URL}/health`);
      results.push(result);
      
      if (i % 10 === 0) {
        process.stdout.write(`\rProgress: ${i}/${TOTAL_REQUESTS}`);
      }
    }
    
    this.results.health = results;
    console.log(`\n✅ Health endpoint benchmark completed`);
  }

  async benchmarkModelsEndpoint() {
    console.log('📋 Benchmarking Models Endpoint...');
    const results = [];
    
    for (let i = 0; i < Math.min(TOTAL_REQUESTS, 50); i++) {
      const result = await this.measureRequest(`${BASE_URL}/v1/models`);
      results.push(result);
      
      if (i % 5 === 0) {
        process.stdout.write(`\rProgress: ${i}/${Math.min(TOTAL_REQUESTS, 50)}`);
      }
    }
    
    this.results.models = results;
    console.log(`\n✅ Models endpoint benchmark completed`);
  }

  async benchmarkChatCompletions() {
    console.log('💬 Benchmarking Chat Completions...');
    const results = [];
    
    const payload = {
      model: 'gpt-4',
      messages: [
        { role: 'user', content: 'Hello, this is a benchmark test message.' }
      ],
      max_tokens: 50
    };
    
    for (let i = 0; i < Math.min(TOTAL_REQUESTS, 20); i++) {
      const result = await this.measureRequest(`${BASE_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-key'
        },
        body: JSON.stringify(payload)
      });
      results.push(result);
      
      if (i % 2 === 0) {
        process.stdout.write(`\rProgress: ${i}/${Math.min(TOTAL_REQUESTS, 20)}`);
      }
    }
    
    this.results.chatCompletions = results;
    console.log(`\n✅ Chat completions benchmark completed`);
  }

  async benchmarkEmbeddings() {
    console.log('🔢 Benchmarking Embeddings...');
    const results = [];
    
    const payload = {
      model: 'text-embedding-3-small',
      input: 'This is a test sentence for embedding generation.'
    };
    
    for (let i = 0; i < Math.min(TOTAL_REQUESTS, 30); i++) {
      const result = await this.measureRequest(`${BASE_URL}/v1/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-key'
        },
        body: JSON.stringify(payload)
      });
      results.push(result);
      
      if (i % 3 === 0) {
        process.stdout.write(`\rProgress: ${i}/${Math.min(TOTAL_REQUESTS, 30)}`);
      }
    }
    
    this.results.embeddings = results;
    console.log(`\n✅ Embeddings benchmark completed`);
  }

  async benchmarkConcurrentRequests() {
    console.log('🚀 Benchmarking Concurrent Requests...');
    
    const promises = [];
    for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
      promises.push(this.measureRequest(`${BASE_URL}/health`));
    }
    
    const start = performance.now();
    const results = await Promise.all(promises);
    const end = performance.now();
    
    const totalDuration = end - start;
    const successCount = results.filter(r => r.success).length;
    
    console.log(`✅ Concurrent requests completed:`);
    console.log(`   - ${CONCURRENT_REQUESTS} requests in ${totalDuration.toFixed(2)}ms`);
    console.log(`   - ${successCount}/${CONCURRENT_REQUESTS} successful`);
    console.log(`   - ${(CONCURRENT_REQUESTS / (totalDuration / 1000)).toFixed(2)} requests/second`);
    
    return { results, totalDuration, successCount };
  }

  calculateStats(results) {
    if (results.length === 0) return null;
    
    const successful = results.filter(r => r.success);
    const durations = successful.map(r => r.duration);
    const sizes = successful.map(r => r.size);
    
    if (durations.length === 0) {
      return {
        count: results.length,
        successRate: 0,
        avgDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        p95Duration: 0,
        p99Duration: 0,
        avgSize: 0,
        throughput: 0
      };
    }
    
    durations.sort((a, b) => a - b);
    const p95Index = Math.floor(durations.length * 0.95);
    const p99Index = Math.floor(durations.length * 0.99);
    
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);
    const avgDuration = totalDuration / durations.length;
    const avgSize = sizes.reduce((sum, s) => sum + s, 0) / sizes.length;
    
    return {
      count: results.length,
      successRate: (successful.length / results.length) * 100,
      avgDuration: avgDuration,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      p95Duration: durations[p95Index] || 0,
      p99Duration: durations[p99Index] || 0,
      avgSize: avgSize,
      throughput: 1000 / avgDuration // requests per second
    };
  }

  printReport() {
    console.log('\n📊 BENCHMARK REPORT');
    console.log('='.repeat(50));
    
    const endpoints = [
      { name: 'Health', results: this.results.health },
      { name: 'Models', results: this.results.models },
      { name: 'Chat Completions', results: this.results.chatCompletions },
      { name: 'Embeddings', results: this.results.embeddings }
    ];
    
    endpoints.forEach(({ name, results }) => {
      const stats = this.calculateStats(results);
      if (!stats || stats.count === 0) {
        console.log(`\n${name}: No data`);
        return;
      }
      
      console.log(`\n${name}:`);
      console.log(`  Requests: ${stats.count}`);
      console.log(`  Success Rate: ${stats.successRate.toFixed(1)}%`);
      console.log(`  Average Duration: ${stats.avgDuration.toFixed(2)}ms`);
      console.log(`  Min Duration: ${stats.minDuration.toFixed(2)}ms`);
      console.log(`  Max Duration: ${stats.maxDuration.toFixed(2)}ms`);
      console.log(`  95th Percentile: ${stats.p95Duration.toFixed(2)}ms`);
      console.log(`  99th Percentile: ${stats.p99Duration.toFixed(2)}ms`);
      console.log(`  Average Size: ${stats.avgSize.toFixed(0)} bytes`);
      console.log(`  Throughput: ${stats.throughput.toFixed(2)} req/s`);
    });
    
    console.log('\n🎯 PERFORMANCE ASSESSMENT');
    console.log('='.repeat(50));
    
    const healthStats = this.calculateStats(this.results.health);
    if (healthStats && healthStats.avgDuration < 50) {
      console.log('✅ Health endpoint: Excellent (<50ms)');
    } else if (healthStats && healthStats.avgDuration < 100) {
      console.log('🟡 Health endpoint: Good (50-100ms)');
    } else {
      console.log('🔴 Health endpoint: Needs improvement (>100ms)');
    }
    
    const chatStats = this.calculateStats(this.results.chatCompletions);
    if (chatStats && chatStats.avgDuration < 2000) {
      console.log('✅ Chat completions: Excellent (<2s)');
    } else if (chatStats && chatStats.avgDuration < 5000) {
      console.log('🟡 Chat completions: Good (2-5s)');
    } else {
      console.log('🔴 Chat completions: Needs improvement (>5s)');
    }
    
    const embeddingStats = this.calculateStats(this.results.embeddings);
    if (embeddingStats && embeddingStats.avgDuration < 500) {
      console.log('✅ Embeddings: Excellent (<500ms)');
    } else if (embeddingStats && embeddingStats.avgDuration < 1000) {
      console.log('🟡 Embeddings: Good (500ms-1s)');
    } else {
      console.log('🔴 Embeddings: Needs improvement (>1s)');
    }
  }

  async run() {
    console.log('🚀 Starting Cynosure Bridge Benchmark');
    console.log(`Target: ${BASE_URL}`);
    console.log(`Concurrent Requests: ${CONCURRENT_REQUESTS}`);
    console.log(`Total Requests per endpoint: ${TOTAL_REQUESTS}`);
    console.log('='.repeat(50));
    
    try {
      // Check if server is running
      const healthCheck = await this.measureRequest(`${BASE_URL}/health`);
      if (!healthCheck.success) {
        throw new Error(`Server not responding at ${BASE_URL}/health`);
      }
      
      console.log('✅ Server is running\n');
      
      // Run benchmarks
      await this.benchmarkHealthEndpoint();
      await this.benchmarkModelsEndpoint();
      await this.benchmarkEmbeddings();
      await this.benchmarkChatCompletions();
      
      // Concurrent test
      await this.benchmarkConcurrentRequests();
      
      // Generate report
      this.printReport();
      
    } catch (error) {
      console.error('❌ Benchmark failed:', error.message);
      process.exit(1);
    }
  }
}

// Run benchmark if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const benchmark = new BenchmarkRunner();
  benchmark.run().catch(console.error);
}

export default BenchmarkRunner;