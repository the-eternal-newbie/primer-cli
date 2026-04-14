# Agentic Backend Architecture

AI agents interact with backends fundamentally differently from human
users. A frontend user makes one request per interaction. An AI agent
executing a multi-step task may make dozens of sequential tool calls,
each dependent on the previous, within a single logical operation.
Backends not designed for this pattern will fail under agent load.

## How Agent Traffic Differs

| Characteristic | Human frontend | AI agent |
|---|---|---|
| Request pattern | Sparse, user-paced | Bursty, programmatic |
| Context per request | Stateless (session cookie) | Large context window carried per call |
| Sequential dependency | Rare | High — tool calls chain |
| Retry behavior | Manual (user clicks again) | Automatic, aggressive |
| Error tolerance | Low (user sees error) | High (agent retries silently) |
| Session duration | Minutes | Hours (long-horizon tasks) |
| Token volume | Zero | Thousands per operation |

---

## Server-Side Context Caching

The most common agent performance failure: re-sending the full system
prompt and conversation history on every tool call. At 4,000 tokens
per call and 20 tool calls per task, this is 80,000 tokens of redundant
processing.

**Prefix caching (Anthropic Claude, OpenAI):**
```typescript
// Structure prompts to maximize cache hits
// Stable content (system prompt, tools) → goes first, cached
// Dynamic content (conversation history, new input) → goes last

const messages = [
  {
    role: 'system',
    content: systemPrompt, // stable — will be cached after first call
  },
  ...conversationHistory, // grows with each turn
  {
    role: 'user',
    content: newUserMessage, // dynamic — never cached
  },
];

// Explicitly mark cacheable blocks (Anthropic)
const response = await anthropic.messages.create({
  model: 'claude-opus-4-5',
  system: [
    {
      type: 'text',
      text: systemPrompt,
      cache_control: { type: 'ephemeral' }, // cache this block
    },
  ],
  messages,
});
```

**Server-side session store for agent context:**
```typescript
// Store conversation state server-side — don't send full history on every call
interface AgentSession {
  id: string;
  systemPrompt: string;
  conversationHistory: Message[];
  toolResults: Map<string, unknown>;
  createdAt: Date;
  lastActiveAt: Date;
  ttl: number; // seconds
}

async function continueAgentSession(
  sessionId: string,
  newMessage: string
): Promise<AgentResponse> {
  const session = await sessionStore.get(sessionId);

  // Send only the delta — not the full history
  const response = await llm.complete({
    context: session.id, // server-side context reference
    message: newMessage,
  });

  await sessionStore.update(sessionId, {
    lastActiveAt: new Date(),
    conversationHistory: [...session.conversationHistory, response],
  });

  return response;
}
```

---

## Stateful Continuation Design

Long-horizon agent tasks (research, code generation, data processing)
can run for minutes or hours. HTTP request-response is the wrong
transport for these — connections time out, load balancers interrupt,
clients disconnect.

**Async task pattern:**
```typescript
// 1. Client submits task — gets a task ID immediately
POST /agent/tasks
→ { taskId: 'task_abc123', status: 'queued' }

// 2. Task executes asynchronously in a worker
// 3. Client polls or subscribes for completion
GET /agent/tasks/task_abc123
→ { taskId: 'task_abc123', status: 'running', progress: 0.4 }

// 4. Or use Server-Sent Events for streaming progress
GET /agent/tasks/task_abc123/stream
→ event: progress { step: 'analyzing_codebase', percent: 40 }
→ event: progress { step: 'generating_tests', percent: 70 }
→ event: complete { result: { ... } }
```

**Streaming intermediate results:**
```typescript
// FastAPI streaming response for long-running agent tasks
@router.get("/agent/tasks/{task_id}/stream")
async def stream_task(task_id: str):
    async def generate():
        async for event in agent_executor.stream(task_id):
            yield f"event: {event.type}\ndata: {json.dumps(event.data)}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
```

---

## Execution Layer vs Policy Layer Separation

When backends execute code on behalf of AI agents, the execution
environment must be strictly isolated from the policy enforcement layer.

```
Policy Layer (always trusted):
  - Validates agent identity and permissions
  - Evaluates what the agent is allowed to do
  - Never executes untrusted code
  - Immutable during agent execution

Execution Layer (always sandboxed):
  - Runs agent-generated or agent-directed code
  - Isolated per task (container, VM, or WASM sandbox)
  - No access to policy layer internals
  - Terminated automatically after task completion or timeout
  - No persistent state between executions
```

**Implementation:**
```typescript
// Policy layer: validate before execution
async function validateAndExecute(
  agentId: string,
  task: AgentTask
): Promise<TaskResult> {
  // Policy check — never skip
  const permitted = await policyEngine.check({
    agent: agentId,
    action: task.type,
    resource: task.targetResource,
  });

  if (!permitted) throw new ForbiddenError('Agent not permitted for this task');

  // Execution in isolated environment
  const sandbox = await SandboxManager.create({
    image: 'agent-executor:latest',
    timeout: 300_000, // 5 minute max
    memoryMb: 512,
    networkAccess: task.requiresNetwork ? 'restricted' : 'none',
  });

  try {
    return await sandbox.execute(task);
  } finally {
    await sandbox.destroy(); // always clean up
  }
}
```

---

## Rate Limiting for Agent Traffic

Agent traffic requires different rate limit configurations than
human traffic. Agents make many sequential calls in rapid succession
for a single logical task — a sliding window that rejects the 11th
call in a minute will break the agent's task mid-execution.

**Token bucket is preferred for agent traffic:**
```typescript
// Allow bursts for tool-calling sequences
// Replenish slowly to prevent runaway loops
const agentLimiter = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.tokenBucket(
    50,   // max burst: 50 calls
    '1m', // replenish window
    10    // replenish 10 tokens per window
  ),
  prefix: 'rl:agent',
});
```

Apply separate limits per agent identity, not per IP — agents may
share infrastructure IPs in orchestration environments.