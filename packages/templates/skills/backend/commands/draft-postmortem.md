# /draft-postmortem

Generate a blameless incident review with timeline, contributing
factors, and structural follow-up improvements.

## Before executing

Read `docs/skills/backend/knowledge/distributed-resilience.md`
section on the resilience checklist — postmortem action items should
address gaps in this checklist.

## Steps

1. Gather the incident record:
   - Incident start and end timestamps (from monitoring, not memory)
   - Detection time (when alerts fired or users reported)
   - Mitigation time (when the immediate fix was applied)
   - Resolution time (when the service fully recovered)
   - Blast radius (users/tenants/endpoints affected)
   - Business impact (revenue, SLO breach, user-facing minutes of downtime)

2. Construct the timeline from telemetry:

   [TIMESTAMP] Event description — evidence source
   [TIMESTAMP] Event description — evidence source
   Example:
   [14:23:01] Latency p99 on /v1/payments began rising — Grafana dashboard
   [14:24:15] Error rate exceeded 1% — alerting threshold
   [14:24:18] PagerDuty alert triggered — on-call engineer notified
   [14:31:00] Engineer identified database connection pool exhaustion — logs
   [14:33:45] Connection pool limit increased, error rate began recovering
   [14:38:00] Error rate returned below 0.1% — incident resolved

3. Document the root cause analysis:

   **Root cause:** (The single technical condition that failed)

   **Trigger:** (What caused the root cause to manifest at this moment)

   **Contributing factors:** (Conditions that amplified the impact)
   - Missing circuit breaker allowed load to cascade to database
   - Connection pool limit not adjusted after 3× traffic growth
   - Alert threshold set too high — detected 8 minutes after onset

4. Assess detection and response quality:
   - Time to detect: [minutes from incident start to alert]
   - Time to mitigate: [minutes from alert to first mitigation action]
   - Time to resolve: [minutes from mitigation to full recovery]
   - Was monitoring adequate? What signals were missing?
   - Was the runbook followed? Was a runbook available?

5. Generate action items — each must be:
   - Specific (not "improve monitoring" but "add p99 latency alert
     on /v1/payments with 500ms threshold")
   - Assigned to a named owner
   - Given a deadline
   - Classified as: prevent recurrence / improve detection /
     reduce time to mitigate

   Action items:
   PREVENT:
   [ ] Add circuit breaker to database connection layer
   Owner: <engineer> | Due: <date>
   DETECT:
   [ ] Add p99 latency alert at 300ms threshold for all /v1/* endpoints
   Owner: <engineer> | Due: <date>
   MITIGATE:
   [ ] Document connection pool tuning runbook with decision thresholds
   Owner: <engineer> | Due: <date>

6. Apply the blameless postmortem principle:
   - Systems and processes failed — not people
   - Focus on what conditions allowed the failure, not who caused it
   - Every action item targets a process or system change,
     never individual performance

7. Share the postmortem within 5 business days of the incident:
   - With the team that owns the service
   - With stakeholders who were impacted
   - In the shared incident knowledge base for cross-team learning

## Do not

- Never assign blame to individuals in postmortem documentation
- Never list action items without owners and deadlines —
  they will not be completed
- Never close a postmortem without at least one action item
  that improves detection or reduces time to mitigate
- Never wait more than 5 business days — memory fades and
  context is lost