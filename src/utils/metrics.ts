/**
 * Metrics and Monitoring Utilities
 */

interface RequestMetrics {
  total: number;
  successful: number;
  failed: number;
  avgDuration: number;
  totalDuration: number;
}

interface EndpointMetrics {
  [endpoint: string]: RequestMetrics;
}

class MetricsCollector {
  private metrics: EndpointMetrics = {};
  private startTimes: Map<string, number> = new Map();

  startRequest(requestId: string, endpoint: string): void {
    this.startTimes.set(requestId, Date.now());

    if (!this.metrics[endpoint]) {
      this.metrics[endpoint] = {
        total: 0,
        successful: 0,
        failed: 0,
        avgDuration: 0,
        totalDuration: 0,
      };
    }

    this.metrics[endpoint].total++;
  }

  endRequest(requestId: string, endpoint: string, success: boolean): void {
    const startTime = this.startTimes.get(requestId);
    if (!startTime) return;

    const duration = Date.now() - startTime;
    this.startTimes.delete(requestId);

    const metric = this.metrics[endpoint];
    if (!metric) return;

    metric.totalDuration += duration;
    metric.avgDuration = metric.totalDuration / metric.total;

    if (success) {
      metric.successful++;
    } else {
      metric.failed++;
    }
  }

  getMetrics(): EndpointMetrics {
    return { ...this.metrics };
  }

  getSystemMetrics() {
    return {
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      cpu: process.cpuUsage(),
      platform: process.platform,
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
    };
  }

  getHealthStatus() {
    const memory = process.memoryUsage();
    const uptime = process.uptime();

    // Simple health checks
    const memoryUsagePercent = (memory.heapUsed / memory.heapTotal) * 100;
    const isHealthy = memoryUsagePercent < 90 && uptime > 0;

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      checks: {
        memory: {
          status: memoryUsagePercent < 90 ? 'pass' : 'fail',
          value: `${memoryUsagePercent.toFixed(2)}%`,
          threshold: '90%',
        },
        uptime: {
          status: uptime > 0 ? 'pass' : 'fail',
          value: `${uptime}s`,
        },
      },
      timestamp: new Date().toISOString(),
    };
  }

  reset(): void {
    this.metrics = {};
    this.startTimes.clear();
  }
}

// Global metrics collector instance
export const metricsCollector = new MetricsCollector();

// Prometheus-style metrics formatter
export function formatPrometheusMetrics(metrics: EndpointMetrics): string {
  let output = '';

  // Total requests
  output += '# HELP cynosure_requests_total Total number of requests\n';
  output += '# TYPE cynosure_requests_total counter\n';
  for (const [endpoint, metric] of Object.entries(metrics)) {
    output += `cynosure_requests_total{endpoint="${endpoint}"} ${metric.total}\n`;
  }

  // Successful requests
  output += '# HELP cynosure_requests_successful_total Number of successful requests\n';
  output += '# TYPE cynosure_requests_successful_total counter\n';
  for (const [endpoint, metric] of Object.entries(metrics)) {
    output += `cynosure_requests_successful_total{endpoint="${endpoint}"} ${metric.successful}\n`;
  }

  // Failed requests
  output += '# HELP cynosure_requests_failed_total Number of failed requests\n';
  output += '# TYPE cynosure_requests_failed_total counter\n';
  for (const [endpoint, metric] of Object.entries(metrics)) {
    output += `cynosure_requests_failed_total{endpoint="${endpoint}"} ${metric.failed}\n`;
  }

  // Average duration
  output += '# HELP cynosure_request_duration_ms Average request duration in milliseconds\n';
  output += '# TYPE cynosure_request_duration_ms gauge\n';
  for (const [endpoint, metric] of Object.entries(metrics)) {
    output += `cynosure_request_duration_ms{endpoint="${endpoint}"} ${metric.avgDuration}\n`;
  }

  // System metrics
  const memory = process.memoryUsage();
  output += '# HELP cynosure_memory_usage_bytes Memory usage in bytes\n';
  output += '# TYPE cynosure_memory_usage_bytes gauge\n';
  output += `cynosure_memory_usage_bytes{type="heap_used"} ${memory.heapUsed}\n`;
  output += `cynosure_memory_usage_bytes{type="heap_total"} ${memory.heapTotal}\n`;
  output += `cynosure_memory_usage_bytes{type="rss"} ${memory.rss}\n`;

  output += '# HELP cynosure_uptime_seconds Process uptime in seconds\n';
  output += '# TYPE cynosure_uptime_seconds gauge\n';
  output += `cynosure_uptime_seconds ${process.uptime()}\n`;

  return output;
}

// Request timing middleware
export function createMetricsMiddleware() {
  return async (request: any, reply: any) => {
    const requestId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const endpoint = request.url || 'unknown';

    metricsCollector.startRequest(requestId, endpoint);

    // Track completion after response is sent
    reply.raw.on('finish', () => {
      const success = reply.statusCode < 400;
      metricsCollector.endRequest(requestId, endpoint, success);
    });
  };
}

export { MetricsCollector };
