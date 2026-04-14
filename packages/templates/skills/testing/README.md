1. What knowledge topics should be covered?

Testing AI-generated code requires a fundamental shift in strategy. AI agents are excellent at writing code that passes standard functional "happy path" tests, but they introduce unique, systemic failure modes that traditional testing misses.

    Knowledge Conflicting Hallucinations (KCHs): AI agents frequently invent non-existent API parameters or subtle semantic errors that evade linters and compile successfully but fail at runtime. The testing agent must understand how to catch these.

    Type System Misuse: In languages like TypeScript, AI agents are up to 9x more likely to rely on the any keyword or use constructs that bypass strict type-checking compared to human developers.

    Hidden Production Bugs: Agents consistently generate code with race conditions, resource and memory leaks, and connection pool exhaustion. The testing agent needs deep knowledge of concurrency and asynchronous state testing.

    Mutation and Property-Based Testing: Because AI can easily "game" basic unit tests, the agent must understand mutation testing—injecting deliberate faults into the codebase to verify that the test suite actually catches them.

2. What commands should exist?

The commands should guide the agent to act as a rigorous QA engineer, managing the full testing lifecycle and pipeline health.

    seed-test-data: Offloads the complex constraint-solving required for test data. It provisions isolated databases and generates schema-compliant synthetic data without cross-test state leakage.

    generate-mutations: Injects deliberate bugs (like swapping + for - or removing function calls) to calculate a "mutation score," ensuring the AI's test suite actually catches regressions.

    heal-test: Acts as an automated maintenance routine for E2E tests. If a UI element changes, this command replays failing steps, inspects the new DOM to locate equivalent elements, and updates the locator/assertion.

    diagnose-flakiness: Analyzes CI execution logs and pass/fail histories to categorize intermittent failures (e.g., identifying if the root cause is an async wait, a data race, or an order dependency).

3. What are the non-negotiables?

These rules prevent brittle suites and the "boy who cried wolf" syndrome in CI/CD pipelines.

    Absolute Data Isolation: Tests must never share database state. Every test or suite execution must run against a fresh, isolated dataset (via transactions, snapshots, or in-memory DBs) to prevent order-dependency failures and state leakage.

    No Static Pauses: For E2E testing, the use of hardcoded sleeps (e.g., Thread.sleep(5000)) is strictly forbidden. The agent must enforce dynamic, auto-waiting mechanisms for specific UI states or network requests.

    Quarantine, Don't Ignore: If a test is flagged as flaky, it must be quarantined immediately so it doesn't block the deployment pipeline. However, it must remain tracked for remediation, not just blindly rerun until it passes.

    Strict Pipeline Speed Limits: CI pipelines should have a strict duration limit (ideally 5 to 10 minutes) for critical feedback paths. Long-running test suites must be aggressively split and executed in parallel across multiple runners.

4. Stack callouts?

Your proposed stack is excellent and aligns perfectly with modern best practices. I would only suggest one specific addition to address the AI-code quality gap.

    Unit/Integration: Vitest is the modern standard for the JS/TS ecosystem.

    E2E: Playwright is the absolute leader, offering superior auto-waiting, trace viewers, and native AI-agent integration hooks.

    Component: Testing Library remains the gold standard for testing accessibility and user behavior rather than implementation details.

    Contract Testing: Pact is the definitive choice. It replaces brittle, slow E2E microservice tests by validating interactions between providers and consumers in isolation.

    Load Testing: k6 is highly recommended due to its developer-friendly JavaScript DSL and excellent CI integration. Artillery is a great, lightweight alternative.

    Mutation Testing (Recommended Addition): Explicitly call out Stryker. As AI generates more of your logic, using Stryker to mutate the code and test your tests is the best way to prevent false confidence.