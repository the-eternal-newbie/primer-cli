# /setup-observability

Inject structured logging, distributed tracing, and SLO/SLI metric
definitions into a backend service.

## Before executing

Read `docs/skills/backend/knowledge/distributed-resilience.md` section
on the resilience checklist.
Read `docs/skills/backend/knowledge/agentic-backends.md` section on
how agent traffic differs.

## Steps

1. Install OpenTelemetry SDK for the target stack:

   **Node.js:**
```bash
   pnpm add @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node \
     @opentelemetry/exporter-trace-otlp-http @opentelemetry/sdk-metrics
```

   **Python (FastAPI):**
```bash
   pip install opentelemetry-sdk opentelemetry-instrumentation-fastapi \
     opentelemetry-exporter-otlp
```

   **.NET:**
```bash
   dotnet add package OpenTelemetry.Extensions.Hosting
   dotnet add package OpenTelemetry.Instrumentation.AspNetCore
```

   **Java (Spring Boot):**
```xml
   <dependency>
     <groupId>io.micrometer</groupId>
     <artifactId>micrometer-tracing-bridge-otel</artifactId>
   </dependency>
```

2. Configure the OpenTelemetry SDK at application startup:

   **Node.js:**
```typescript
   // instrumentation.ts — loaded before all other modules
   import { NodeSDK } from '@opentelemetry/sdk-node';
   import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
   import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

   const sdk = new NodeSDK({
     traceExporter: new OTLPTraceExporter({
       url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
     }),
     instrumentations: [getNodeAutoInstrumentations()],
     serviceName: process.env.SERVICE_NAME,
   });

   sdk.start();
```

   **FastAPI:**
```python
   from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
   from opentelemetry.sdk.trace import TracerProvider
   from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter

   provider = TracerProvider()
   provider.add_span_processor(
     BatchSpanProcessor(OTLPSpanExporter())
   )
   trace.set_tracer_provider(provider)
   FastAPIInstrumentor.instrument_app(app)
```

3. Implement structured logging with trace correlation:

   **Node.js:**
```typescript
   import { trace } from '@opentelemetry/api';
   import pino from 'pino';

   const logger = pino({ level: 'info' });

   export function createLogger(context: string) {
     return {
       info: (msg: string, data?: object) => {
         const span = trace.getActiveSpan();
         logger.info({
           ...data,
           context,
           traceId: span?.spanContext().traceId,
           spanId: span?.spanContext().spanId,
         }, msg);
       },
       error: (msg: string, error?: Error, data?: object) => {
         const span = trace.getActiveSpan();
         logger.error({
           ...data,
           context,
           traceId: span?.spanContext().traceId,
           error: error?.message,
           stack: error?.stack,
         }, msg);
       },
     };
   }
```

4. Define SLIs and SLOs for the service:

   | SLI | Measurement | SLO target |
   |---|---|---|
   | Availability | Successful responses / total requests | 99.9% |
   | Latency (p50) | Median response time | < 100ms |
   | Latency (p99) | 99th percentile response time | < 500ms |
   | Error rate | 5xx responses / total requests | < 0.1% |

```typescript
   // Register SLI metrics
   const requestDuration = meter.createHistogram('http.request.duration', {
     description: 'HTTP request duration in milliseconds',
     unit: 'ms',
     boundaries: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
   });

   const requestCount = meter.createCounter('http.request.count', {
     description: 'Total HTTP requests',
   });

   const errorCount = meter.createCounter('http.error.count', {
     description: 'Total HTTP errors (5xx)',
   });
```

5. Add custom span attributes for agent traffic identification:
```typescript
   const span = trace.getActiveSpan();
   span?.setAttributes({
     'caller.type': isAgentRequest(req) ? 'agent' : 'human',
     'caller.id': req.headers['x-agent-id'] ?? req.user?.id,
     'request.idempotency_key': req.headers['idempotency-key'],
   });
```

6. Configure the OpenTelemetry Collector as a sidecar:
```yaml
   # otel-collector.yaml
   receivers:
     otlp:
       protocols:
         grpc: { endpoint: 0.0.0.0:4317 }
         http: { endpoint: 0.0.0.0:4318 }
   processors:
     batch:
       timeout: 5s
       send_batch_size: 1000
     resource:
       attributes:
         - key: environment
           value: ${ENVIRONMENT}
           action: upsert
   exporters:
     otlp:
       endpoint: ${OBSERVABILITY_BACKEND_ENDPOINT}
   service:
     pipelines:
       traces:
         receivers: [otlp]
         processors: [batch, resource]
         exporters: [otlp]
```

## Do not

- Never log sensitive data (PII, credentials, tokens) in structured logs
- Never use console.log/print for production logging —
  use structured loggers with trace correlation
- Never define SLOs after incidents — define them before deployment
- Never skip the OpenTelemetry Collector sidecar in production —
  direct exporter connections add latency to the hot path