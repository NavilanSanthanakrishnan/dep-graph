import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { buildAllCandidates } from "./candidates.ts";
import { getOpenRouterKeys, openRouterChat, parseJsonObject } from "./openrouter.ts";
import type { DependencyEdge, DependencyGraph, NormalizedTool, TargetCandidates } from "./types.ts";

const DEFAULT_MODEL = "stepfun/step-3.5-flash";
const DEFAULT_CONCURRENCY = 6;
const DEFAULT_MIN_CONFIDENCE = 0.65;

const DecisionSchema = z.object({
  edges: z
    .array(
      z.object({
        sourceTool: z.string(),
        satisfies: z.array(z.string()).min(1),
        resource: z.string().optional(),
        reason: z.string().min(8),
        confidence: z.number().min(0).max(1),
      }),
    )
    .default([]),
});

type Decision = z.infer<typeof DecisionSchema>;

type CliOptions = {
  prepareOnly: boolean;
  limit?: number;
  offset: number;
  concurrency: number;
  maxCandidates: number;
  model: string;
  minConfidence: number;
  force: boolean;
};

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const getNumber = (name: string, fallback?: number) => {
    const value = args.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1];
    return value === undefined ? fallback : Number(value);
  };
  const getString = (name: string, fallback: string) =>
    args.find((arg) => arg.startsWith(`--${name}=`))?.split("=").slice(1).join("=") ?? fallback;

  return {
    prepareOnly: args.includes("--prepare-only"),
    limit: getNumber("limit"),
    offset: getNumber("offset", 0) ?? 0,
    concurrency: getNumber("concurrency", DEFAULT_CONCURRENCY) ?? DEFAULT_CONCURRENCY,
    maxCandidates: getNumber("max-candidates", 40) ?? 40,
    model: getString("model", DEFAULT_MODEL),
    minConfidence: getNumber("min-confidence", DEFAULT_MIN_CONFIDENCE) ?? DEFAULT_MIN_CONFIDENCE,
    force: args.includes("--force"),
  };
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(path.split("/").slice(0, -1).join("/"), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function decisionPath(targetSlug: string): string {
  return `data/llm/decisions/${targetSlug}.json`;
}

function buildPrompt(targetCandidates: TargetCandidates, compact = false): string {
  const target = targetCandidates.target;
  const candidateLines = targetCandidates.candidates
    .map(
      (candidate, index) =>
        `${index + 1}. ${candidate.slug} | ${candidate.name} | inputs: ${
          candidate.requiredInputs.join(", ") || "none"
        } | whyCandidate: ${candidate.reasons.slice(0, compact ? 2 : 4).join("; ")} | desc: ${candidate.description.slice(
          0,
          compact ? 80 : 180,
        )}`,
    )
    .join("\n\n");

  return `We are building a dependency graph for Composio agent tools.

Task:
For the TARGET tool, choose which CANDIDATE tools are useful precursor actions.
A precursor is valid only if it can obtain, discover, create, list, search, or resolve information needed before running the target tool.

Important rules:
- Return JSON only.
- Do not invent tool slugs.
- Only choose from the candidate list.
- Do not include an edge just because tools are topically related.
- Each edge must name the target input/prerequisite it satisfies.
- Prefer high-signal source tools like list/search/find/fetch/get/create.
- Avoid noisy generic edges unless they directly satisfy a concrete missing reference.
- If no candidate is a real precursor, return {"edges":[]}.

TARGET:
slug: ${target.slug}
name: ${target.name}
toolkit: ${target.toolkit}
requiredInputs: ${target.requiredInputs.join(", ") || "none"}
matchableInputs: ${target.matchableInputs.join(", ") || "none"}
description: ${target.description.slice(0, compact ? 140 : 360)}

CANDIDATES:
${candidateLines}

Output schema:
{
  "edges": [
    {
      "sourceTool": "EXISTING_CANDIDATE_SLUG",
      "satisfies": ["input_or_prerequisite_name"],
      "resource": "optional_resource_name",
      "reason": "One sentence explaining exactly what this source provides.",
      "confidence": 0.0
    }
  ]
}`;
}

async function inferOne(
  targetCandidates: TargetCandidates,
  key: string,
  model: string,
  minConfidence: number,
): Promise<DependencyEdge[]> {
  const run = async (candidateSet: TargetCandidates, compact: boolean) =>
    openRouterChat({
      key,
      model,
      temperature: 0,
      maxTokens: compact ? 14000 : 9000,
      messages: [
        {
          role: "system",
          content:
            "You are a precise API/tool dependency analyst. Output only JSON. Reject weak topical matches.",
        },
        { role: "user", content: buildPrompt(candidateSet, compact) },
      ],
    });

  let candidateSet = targetCandidates;
  let content: string;
  try {
    content = await run(candidateSet, false);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/finish_reason=length|message content/i.test(message) || targetCandidates.candidates.length <= 8) {
      throw error;
    }
    candidateSet = {
      ...targetCandidates,
      candidates: targetCandidates.candidates.slice(0, 8),
    };
    content = await run(candidateSet, true);
  }

  let decision: Decision;
  try {
    decision = DecisionSchema.parse(parseJsonObject(content));
  } catch {
    decision = { edges: [] };
  }
  const candidateSlugs = new Set(candidateSet.candidates.map((candidate) => candidate.slug));
  const matchableInputs = new Set([
    ...targetCandidates.target.requiredInputs,
    ...targetCandidates.target.matchableInputs,
  ]);

  return decision.edges
    .filter((edge) => candidateSlugs.has(edge.sourceTool))
    .filter((edge) => edge.sourceTool !== targetCandidates.target.slug)
    .filter((edge) => edge.confidence >= minConfidence)
    .filter((edge) => edge.satisfies.some((item) => matchableInputs.has(item) || item.length >= 3))
    .map((edge) => ({
      from: edge.sourceTool,
      to: targetCandidates.target.slug,
      satisfies: edge.satisfies,
      resource: edge.resource,
      confidence: Number(edge.confidence.toFixed(2)),
      reason: edge.reason,
      source: "llm" as const,
    }));
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (attempt === attempts) break;
      const isRetryable = /429|500|502|503|504|rate|timeout/i.test(message);
      if (!isRetryable) break;
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt ** 2));
    }
  }
  throw lastError;
}

async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      const item = items[index];
      if (item !== undefined) await worker(item, index);
    }
  });
  await Promise.all(workers);
}

async function loadOrBuildCandidates(maxCandidates: number): Promise<TargetCandidates[]> {
  const path = "data/candidates/all_candidates.json";
  if (existsSync(path)) return readJson<TargetCandidates[]>(path);
  return buildAllCandidates({ maxCandidates });
}

async function assembleGraph(model: string): Promise<DependencyGraph> {
  const tools = await readJson<NormalizedTool[]>("data/normalized/all_tools.json");
  const edgeMap = new Map<string, DependencyEdge>();

  if (existsSync("data/llm/decisions")) {
    const { readdir } = await import("node:fs/promises");
    for (const file of await readdir("data/llm/decisions")) {
      if (!file.endsWith(".json")) continue;
      const edges = await readJson<DependencyEdge[]>(`data/llm/decisions/${file}`);
      for (const edge of edges) {
        edgeMap.set(`${edge.from}->${edge.to}:${edge.satisfies.join(",")}`, edge);
      }
    }
  }

  const graph: DependencyGraph = {
    generatedAt: new Date().toISOString(),
    model,
    nodes: tools,
    edges: [...edgeMap.values()].sort((a, b) => a.to.localeCompare(b.to) || b.confidence - a.confidence),
  };

  await writeJson("data/dependency_graph.json", graph);
  await writeJson("data/dependency_edges.json", graph.edges);
  return graph;
}

async function main(): Promise<void> {
  const options = parseArgs();
  const candidates = await buildAllCandidates({ maxCandidates: options.maxCandidates });
  console.log(`Prepared ${candidates.length} target candidate sets.`);
  console.log("Wrote data/candidates/all_candidates.json");

  if (options.prepareOnly) return;

  const keys = getOpenRouterKeys();
  if (keys.length === 0) {
    console.log("No OPENROUTER_API_KEY or OPENROUTER_API_KEYS found; skipping LLM inference.");
    console.log("Set one of those env vars and rerun `npm run graph:infer`.");
    return;
  }

  const selected = candidates.slice(options.offset, options.limit ? options.offset + options.limit : undefined);
  await mkdir("data/llm/decisions", { recursive: true });
  await mkdir("data/llm/errors", { recursive: true });

  let completed = 0;
  let failed = 0;

  await runPool(selected, options.concurrency, async (targetCandidates, index) => {
    const path = decisionPath(targetCandidates.target.slug);
    if (!options.force && existsSync(path)) {
      completed++;
      return;
    }

    const key = keys[index % keys.length]!;
    try {
      const edges = await withRetry(() =>
        inferOne(targetCandidates, key, options.model, options.minConfidence),
      );
      await writeJson(path, edges);
      completed++;
      if (completed % 25 === 0 || edges.length > 0) {
        console.log(
          `[${completed}/${selected.length}] ${targetCandidates.target.slug}: ${edges.length} edges`,
        );
      }
    } catch (error) {
      failed++;
      await writeJson(`data/llm/errors/${targetCandidates.target.slug}.json`, {
        target: targetCandidates.target.slug,
        error: error instanceof Error ? error.message : String(error),
      });
      console.error(`Failed ${targetCandidates.target.slug}: ${error instanceof Error ? error.message : error}`);
    }
  });

  const graph = await assembleGraph(options.model);
  console.log(`LLM inference completed: ${completed} completed, ${failed} failed.`);
  console.log(`Graph edges: ${graph.edges.length}`);
  console.log("Wrote data/dependency_graph.json and data/dependency_edges.json");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
