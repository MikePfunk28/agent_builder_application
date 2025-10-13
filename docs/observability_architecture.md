# Observability Architecture

## Overview

The agent builder generates agents with comprehensive observability using AWS native services and OpenTelemetry standards.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      Agent Application                           │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Python Agent Code (Strands)                              │  │
│  │  - Standard logging                                       │  │
│  │  - OpenTelemetry instrumentation                         │  │
│  │  - Optional LangSmith integration                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                    │
│                              ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  OpenTelemetry SDK                                        │  │
│  │  - TracerProvider                                         │  │
│  │  - SpanProcessor                                          │  │
│  │  - OTLP Exporter                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                    │
└──────────────────────────────┼────────────────────────────────────┘
                               │
                               ▼
        ┌─────────────────────────────────────────────┐
        │   AWS OpenTelemetry Distro (ADOT)           │
        │   - Collector                                │
        │   - AWS X-Ray exporter                      │
        │   - CloudWatch exporter                     │
        └─────────────────────────────────────────────┘
                               │
                ┌──────────────┴───────────────┐
                ▼                              ▼
    ┌──────────────────────┐      ┌──────────────────────┐
    │   CloudWatch Logs    │      │     AWS X-Ray        │
    │   - Log streams      │      │   - Traces           │
    │   - Log groups       │      │   - Service map      │
    │   - Insights         │      │   - Analytics        │
    └──────────────────────┘      └──────────────────────┘
                │                              │
                └──────────────┬───────────────┘
                               ▼
                ┌──────────────────────────────┐
                │   CloudWatch Dashboards      │
                │   - Metrics                  │
                │   - Alarms                   │
                │   - GenAI Observability      │
                └──────────────────────────────┘
```

## Components

### 1. Application Logging

**Standard Python Logging**
- Configured via `logging.basicConfig()`
- Level controlled by `LOG_LEVEL` environment variable
- Format: `%(asctime)s - %(name)s - %(levelname)s - %(message)s`
- Output: stdout (captured by CloudWatch in AgentCore)

```python
# Configure logging
logging.basicConfig(
    level=os.getenv('LOG_LEVEL', 'INFO'),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    force=True
)
logger = logging.getLogger(__name__)
```

### 2. OpenTelemetry Tracing

**Tracer Setup**
```python
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter

# Create tracer provider
trace_provider = TracerProvider()

# Configure OTLP exporter
otlp_exporter = OTLPSpanExporter(
    endpoint=os.getenv('OTEL_EXPORTER_OTLP_ENDPOINT', 'localhost:4317'),
    insecure=True
)

# Add span processor
trace_provider.add_span_processor(BatchSpanProcessor(otlp_exporter))
trace.set_tracer_provider(trace_provider)

tracer = trace.get_tracer(__name__)
```

**Span Creation**
```python
with tracer.start_as_current_span("agent_invocation") as span:
    # Add attributes
    span.set_attribute("agent.name", "MyAgent")
    span.set_attribute("agent.model", "claude-sonnet-4-5")
    span.set_attribute("message.length", len(user_message))
    
    # Process request
    result = await agent.run(user_message)
    
    # Add response attributes
    span.set_attribute("response.length", len(str(result)))
    span.set_attribute("status", "success")
```

### 3. AWS CloudWatch Integration

**Log Groups**
- Automatic creation by AgentCore
- Path: `/aws/bedrock-agentcore/runtimes/{agent-name}`
- Retention: Configurable (default: 7 days)

**Log Streams**
- One stream per container instance
- Format: `{date}/{instance-id}`

**CloudWatch Insights**
```sql
-- Find errors in last hour
fields @timestamp, @message
| filter @message like /ERROR/
| sort @timestamp desc
| limit 20

-- Track request latency
fields @timestamp, duration
| filter message like /Processing message/
| stats avg(duration), max(duration), min(duration) by bin(5m)
```

### 4. AWS X-Ray Tracing

**Service Map**
- Visualize request flow
- Track dependencies
- Identify bottlenecks

**Trace Analysis**
- Request-level tracing
- Segment timeline
- Error tracking
- Latency analysis

**Trace Attributes**
```json
{
  "agent.name": "MyAgent",
  "agent.model": "claude-sonnet-4-5",
  "message.length": 45,
  "response.length": 234,
  "status": "success",
  "aws.region": "us-east-1",
  "aws.account": "123456789012"
}
```

### 5. CloudWatch Metrics

**Standard Metrics**
- `Invocations`: Total requests
- `Duration`: Request processing time
- `Errors`: Error count
- `Throttles`: Throttled requests

**Custom Metrics**
```python
# Publish custom metrics
cloudwatch = boto3.client('cloudwatch')
cloudwatch.put_metric_data(
    Namespace='AgentCore/Agents',
    MetricData=[
        {
            'MetricName': 'TokensUsed',
            'Value': tokens_used,
            'Unit': 'Count',
            'Dimensions': [
                {'Name': 'AgentName', 'Value': 'MyAgent'},
                {'Name': 'Model', 'Value': 'claude-sonnet-4-5'}
            ]
        }
    ]
)
```

## Monitoring Dashboards

### 1. CloudWatch Dashboard

**Widgets**
- Request rate (requests/min)
- Average latency (ms)
- Error rate (%)
- P50, P90, P99 latency
- Token usage
- Cost estimation

### 2. X-Ray Analytics

**Queries**
- Slowest endpoints
- Error breakdown
- Request distribution
- Dependency performance

### 3. GenAI Observability (CloudWatch)

**Features**
- Model performance metrics
- Token usage tracking
- Cost analysis
- Quality metrics

## Alerting

### CloudWatch Alarms

**Error Rate Alarm**
```yaml
MetricName: Errors
Threshold: 5
EvaluationPeriods: 2
ComparisonOperator: GreaterThanThreshold
AlarmActions:
  - arn:aws:sns:us-east-1:123456789012:agent-alerts
```

**Latency Alarm**
```yaml
MetricName: Duration
Statistic: Average
Threshold: 5000  # 5 seconds
EvaluationPeriods: 3
ComparisonOperator: GreaterThanThreshold
```

**Cost Alarm**
```yaml
MetricName: TokensUsed
Threshold: 1000000
EvaluationPeriods: 1
ComparisonOperator: GreaterThanThreshold
```

## Optional: LangSmith Integration

### Setup

```python
# Initialize only if API key provided
langsmith_enabled = False
if os.getenv('LANGSMITH_API_KEY'):
    try:
        from langsmith import Client as LangSmithClient
        langsmith_client = LangSmithClient()
        langsmith_enabled = True
        logger.info('LangSmith monitoring enabled')
    except ImportError:
        logger.warning('langsmith package not installed')
else:
    logger.info('LangSmith monitoring disabled')
```

### Features (when enabled)
- Request/response tracing
- Prompt versioning
- A/B testing
- Human feedback collection
- Dataset management

## Querying and Analysis

### CloudWatch Logs Insights Queries

**Request Performance**
```sql
fields @timestamp, message, duration
| filter ispresent(duration)
| stats avg(duration) as avg_duration, 
        max(duration) as max_duration, 
        min(duration) as min_duration 
  by bin(5m)
```

**Error Analysis**
```sql
fields @timestamp, @message
| filter @message like /ERROR/ or level = "ERROR"
| parse @message /(?<error_type>\w+Error): (?<error_msg>.*)/
| stats count() by error_type
```

**Token Usage**
```sql
fields @timestamp, tokens_used, model
| filter ispresent(tokens_used)
| stats sum(tokens_used) as total_tokens by model
```

### X-Ray Analytics Queries

**Find Slow Traces**
```
service("MyAgent") AND duration > 5
```

**Error Distribution**
```
service("MyAgent") AND error = true
```

**Dependency Analysis**
```
edge(service("MyAgent"), service("BedrockAPI"))
```

## Best Practices

### 1. Structured Logging

```python
logger.info("Message processed", extra={
    "message_id": message_id,
    "user_id": user_id,
    "duration_ms": duration,
    "model": model_name,
    "tokens_used": tokens
})
```

### 2. Span Attributes

```python
span.set_attribute("http.method", "POST")
span.set_attribute("http.status_code", 200)
span.set_attribute("user.id", user_id)
span.set_attribute("model.name", model_name)
```

### 3. Error Tracking

```python
try:
    result = await agent.run(message)
except Exception as e:
    span.set_attribute("error", True)
    span.set_attribute("error.type", type(e).__name__)
    span.set_attribute("error.message", str(e))
    logger.error("Agent error", exc_info=True)
    raise
```

### 4. Performance Monitoring

```python
import time

start_time = time.time()
result = await agent.run(message)
duration = (time.time() - start_time) * 1000

logger.info(f"Request completed in {duration:.2f}ms")
span.set_attribute("duration_ms", duration)
```

## Cost Optimization

### CloudWatch Logs
- Set retention periods (7 days for dev, 30 days for prod)
- Use log filtering to reduce volume
- Archive old logs to S3

### X-Ray Tracing
- Sample traces in production (e.g., 10% of requests)
- Use adaptive sampling for errors
- Disable in development if not needed

### CloudWatch Metrics
- Use metric filters instead of custom metrics when possible
- Aggregate metrics before publishing
- Set appropriate retention periods

## Security

### Access Control
- Use IAM policies to restrict access to logs and traces
- Enable CloudWatch Logs encryption
- Use VPC endpoints for private access

### Data Protection
- Sanitize sensitive data before logging
- Use CloudWatch Logs data protection
- Implement log redaction for PII

### Audit
- Enable CloudTrail for API access logging
- Monitor unusual access patterns
- Set up alerts for unauthorized access

## Troubleshooting

### No Traces in X-Ray
1. Check ADOT collector is running
2. Verify OTLP endpoint configuration
3. Check IAM permissions for X-Ray
4. Review agent logs for exporter errors

### Missing Logs
1. Verify CloudWatch Logs permissions
2. Check log group exists
3. Review retention settings
4. Check container stdout/stderr

### High Costs
1. Review log retention periods
2. Reduce trace sampling rate
3. Filter unnecessary logs
4. Archive old data to S3

## References

- [AWS X-Ray Developer Guide](https://docs.aws.amazon.com/xray/)
- [CloudWatch Logs User Guide](https://docs.aws.amazon.com/cloudwatch/latest/logs/)
- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [AWS ADOT Documentation](https://aws-otel.github.io/)
- [LangSmith Documentation](https://docs.smith.langchain.com/)
