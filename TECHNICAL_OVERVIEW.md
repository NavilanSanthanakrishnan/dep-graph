# Technical Overview

## Stack

- **TypeScript / Node.js** - core pipeline, graph construction, rendering scripts.
- **Composio SDK (`@composio/core`)** - fetches raw GitHub and Google Super tools.
- **Zod** - validates structured LLM edge decisions.
- **OpenRouter** - optional LLM adjudication for ambiguous dependency candidates.
- **StepFun `stepfun/step-3.5-flash`** - configured as the default optional inference model.
- **3d-force-graph + Three.js** - interactive Obsidian-style 3D graph visualization.
- **Playwright** - local visual QA screenshot capture.
- **Python inline helper** - used inside `upload.sh` only to redact API-key-looking tokens from collected agent session traces before upload.

## Core Idea

The project builds an agent-planning dependency graph over Composio tools.

An edge means:

```text
source tool -> target tool
```

The source tool can help obtain an ID, reference, email, issue number, thread ID, file ID, repository name, or other prerequisite needed before the target tool can run safely.

## Pipeline

### 1. Fetch tools

File: `src/fetch-and-normalize.ts`

Fetches raw Composio tools for:

```text
github
googlesuper
```

Outputs:

```text
data/raw/github_tools.json
data/raw/googlesuper_tools.json
data/raw/all_tools.json
```

### 2. Normalize schemas

Files:

```text
src/normalize.ts
src/types.ts
```

Transforms raw Composio schemas into cleaner records:

```text
slug
name
toolkit
description
tags
requiredInputs
optionalInputs
outputs
```

Outputs:

```text
data/normalized/*.json
data/summary/tool_inventory.md
```

### 3. Generate candidates

Files:

```text
src/resource-rules.ts
src/candidates.ts
```

Uses resource-aware heuristics to find likely precursor tools. It maps fields like:

```text
thread_id -> gmail_thread
issue_number -> github_issue
pull_number -> github_pull_request
file_id -> google_drive_file
recipient_email -> email_address_or_contact
calendar_id -> google_calendar
```

Then it scores candidates using:

- same toolkit
- resource overlap
- matching input names
- producer verbs like `list`, `search`, `find`, `fetch`, `get`, `create`
- penalties for destructive tools
- specificity filters to avoid noisy matches

Output:

```text
data/candidates/all_candidates.json
```

### 4. Build dependency graph

File: `src/build-rule-graph.ts`

Turns candidate sets into confidence-scored edges and merges any successful LLM decisions.

Outputs:

```text
data/dependency_edges.json
data/dependency_graph.json
```

Current graph:

```text
1305 nodes
3477 dependency edges
849 target tools with dependencies
```

### 5. Optional LLM adjudication

Files:

```text
src/openrouter.ts
src/infer-dependencies.ts
```

The LLM is used as a judge, not as the only source of truth. The deterministic candidate generator first narrows the search space, then the LLM chooses true precursor edges from the candidates.

Outputs:

```text
data/llm/decisions/
data/llm/errors/
```

### 6. Render 3D visualization

File:

```text
src/render-graph.ts
```

Creates:

```text
dependency_graph.html
```

Features:

- 3D force-directed graph
- GitHub and Google Super color clusters
- search
- toolkit filtering
- confidence filtering
- clickable node details
- clickable edge reasons
- explanation tab
- embedded full graph data

### 7. Visual QA

Screenshots:

```text
screenshots/dependency_graph_3d.png
screenshots/dependency_graph_explanation.png
```

Captured with Playwright to verify the graph loads and the explanation tab renders correctly.

## Scripts

```bash
npm run inventory          # fetch + normalize tools
npm run graph:candidates   # build precursor candidate sets
npm run graph:build        # build final dependency graph
npm run graph:render       # render 3D HTML visualization
npm run graph:infer        # optional OpenRouter adjudication
npm run typecheck          # TypeScript validation
```

## Why This Approach

The raw Composio output schemas are generic:

```text
data
error
successful
```

So exact schema output-to-input matching is not enough. The project instead uses resource-aware matching over tool names, descriptions, input fields, and action verbs. This gives a more useful graph for agent planning.

## Submission Safety

`upload.sh` keeps agent session tracing enabled, but redacts secret-looking tokens before zipping:

```text
OpenRouter-style keys
Composio-style API keys
OPENROUTER_API_KEY assignments
COMPOSIO_API_KEY assignments
```

The redaction helper is a short inline Python script because Python is reliable for recursive text regex replacement across collected session artifacts.
