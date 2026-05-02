import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import {
  isDestructive,
  matchableInputs,
  normalizeName,
  producerStrength,
  resourceForParam,
  resourcesForToolText,
  resourceLabel,
  toolText,
} from "./resource-rules.ts";
import type {
  CandidateTool,
  DependencyEdge,
  DependencyGraph,
  NormalizedParam,
  NormalizedTool,
  TargetCandidates,
} from "./types.ts";

const MAX_EDGES_PER_TARGET = 9;
const MAX_EDGES_PER_INPUT = 3;

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(path.split("/").slice(0, -1).join("/"), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function regexForField(field: string): RegExp {
  const normalized = normalizeName(field);
  const pattern = normalized
    .replace(/_ids$/, "[-_ ]?ids?")
    .replace(/_id$/, "[-_ ]?ids?")
    .replace(/_/g, "[-_ ]?");
  return new RegExp(`\\b${pattern}\\b`, "i");
}

function sameField(a: string, b: string): boolean {
  return normalizeName(a) === normalizeName(b);
}

function sourceRequiresInput(source: NormalizedTool, input: NormalizedParam): boolean {
  return source.requiredInputs.some((param) => sameField(param.path, input.path) || sameField(param.name, input.name));
}

function isSpecificProducerForInput(input: NormalizedParam, source: NormalizedTool): boolean {
  const inputName = normalizeName(input.path);
  const text = toolText(source);
  const slugName = `${source.slug} ${source.name}`;

  if (/label/.test(inputName)) {
    if (!/\blabels?\b/i.test(slugName) || !/\b(list|search|find|get|create)\b/i.test(slugName)) return false;
    if (/\brunner\b/i.test(slugName)) return false;
    if (/\bissue\b/i.test(toolText(source)) && /\bissue\b/i.test(input.description ?? "")) return /\b(issue|repository)\b/i.test(slugName);
    return true;
  }
  if (/issue_number|issue_id/.test(inputName)) {
    if (/\blabels?\b|\bcomments?\b|\btimeline\b|\breactions?\b/i.test(slugName)) return false;
    return /\b(list.*issues?|search.*issues?|find.*issues?|get.*issues?|create.*issues?|repository issues?)\b/i.test(
      slugName,
    );
  }
  if (/pull_number|pull_request/.test(inputName)) {
    if (/\b(review|comment|reaction|protection)\b/i.test(slugName) && !/\bget a pull request\b/i.test(slugName)) return false;
    return /\b(list.*pull requests?|search.*pull requests?|find.*pull requests?|get.*pull requests?|create.*pull requests?|pull requests? associated)\b/i.test(
      slugName,
    );
  }
  if (/thread_id/.test(inputName)) {
    return /\bthreads?\b/i.test(slugName) || /\bfetch emails\b/i.test(slugName);
  }
  if (/message_id|message_ids|messageids/.test(inputName)) {
    return /\b(messages?|emails?)\b/i.test(text) && /\b(list|search|find|fetch|get|create)\b/i.test(slugName);
  }
  if (/recipient|email|send_as|from_email|extra_recipients/.test(inputName)) {
    if (/from_email/.test(inputName)) {
      return /\b(get profile|list send-as|send-as alias)\b/i.test(text) && !/smime|s\/mime/i.test(slugName);
    }
    return /\b(search people|get contacts|get people|permission id for email)\b/i.test(text);
  }
  if (/calendar_id|calendarid/.test(inputName)) {
    return /\bcalendars?\b/i.test(text) && /\b(list|search|find|get|create)\b/i.test(slugName);
  }
  if (/rule_id|ruleid/.test(inputName)) {
    return /\b(acl|access control)\b/i.test(slugName) && /\b(list|search|find|get|create|watch)\b/i.test(slugName);
  }
  if (/spreadsheet/.test(inputName)) {
    return /\bspreadsheets?\b/i.test(text) && /\b(list|search|find|get|create)\b/i.test(slugName);
  }
  if (/sheet_id|sheet_name|sheetid/.test(inputName)) {
    return /\bsheets?\b/i.test(text) && /\b(list|search|find|get|create|add)\b/i.test(slugName);
  }
  if (/file_id|fileid|document_id|documentid/.test(inputName)) {
    return /\b(files?|folders?|documents?|drive)\b/i.test(text) && /\b(list|search|find|get|create|copy)\b/i.test(slugName);
  }
  if (/comment_id|reply_id/.test(inputName)) {
    return /\b(comments?|replies|reply)\b/i.test(text) && /\b(list|search|find|get|create)\b/i.test(slugName);
  }
  if (/repo|owner|repository|org|username/.test(inputName)) {
    return /\b(repos?|repositories|organizations?|users?|members|collaborators)\b/i.test(text) && /\b(list|search|find|get)\b/i.test(slugName);
  }

  return true;
}

function sourceCanProduceInput(
  target: NormalizedTool,
  source: NormalizedTool,
  candidate: CandidateTool,
  input: NormalizedParam,
): { confidence: number; reason: string; resource?: string } | null {
  if (target.slug === source.slug) return null;
  if (target.toolkit !== source.toolkit) return null;
  if (isDestructive(source)) return null;

  const strength = producerStrength(source);
  if (strength <= 0) return null;

  const inputResources = resourceForParam(input, target);
  if (inputResources.length === 0) return null;

  const sourceResources = resourcesForToolText(source);
  const overlap = inputResources.filter((resource) => sourceResources.includes(resource));
  const text = toolText(source);
  const mentionsInput = regexForField(input.path).test(text) || regexForField(input.name).test(text);
  const sourceNeedsSameInput = sourceRequiresInput(source, input);

  if (sourceNeedsSameInput) return null;

  if (overlap.length === 0 && !mentionsInput) return null;
  if (!isSpecificProducerForInput(input, source)) return null;

  const onlyWeakRepo =
    overlap.every((resource) => resource === "github_repository" || resource === "github_org") &&
    /^(repo|owner|org)$/i.test(input.name);

  if (onlyWeakRepo && !/\b(list|search|find|get).*(repo|repository|org|organization)|\b(repo|repository|org|organization).*(list|search|find|get)\b/i.test(text)) {
    return null;
  }

  let confidence = 0.58;
  if (overlap.length > 0) confidence += 0.16;
  if (mentionsInput) confidence += 0.12;
  confidence += Math.min(strength, 4) * 0.035;
  confidence += Math.min(candidate.score, 30) / 300;
  if (onlyWeakRepo) confidence -= 0.08;
  confidence = Math.max(0.62, Math.min(0.96, confidence));

  if (confidence < 0.68) return null;

  const resource = overlap[0] ?? inputResources[0] ?? "related_resource";
  const sourceVerb = source.name.match(/\b(List|Search|Find|Fetch|Get|Create|Insert)\b/i)?.[0] ?? "Provides";
  const reason = `${sourceVerb} ${resourceLabel(resource)} information that can satisfy '${input.path}' before running ${target.slug}.`;

  return {
    confidence: Number(confidence.toFixed(2)),
    reason,
    resource,
  };
}

function rankEdges(edges: DependencyEdge[]): DependencyEdge[] {
  const byInputCount = new Map<string, number>();
  const selected: DependencyEdge[] = [];

  for (const edge of edges.sort((a, b) => b.confidence - a.confidence || a.from.localeCompare(b.from))) {
    const input = edge.satisfies[0] ?? "unknown";
    const count = byInputCount.get(input) ?? 0;
    if (count >= MAX_EDGES_PER_INPUT) continue;

    selected.push(edge);
    byInputCount.set(input, count + 1);
    if (selected.length >= MAX_EDGES_PER_TARGET) break;
  }

  return selected;
}

async function loadLlmEdges(): Promise<DependencyEdge[]> {
  if (!existsSync("data/llm/decisions")) return [];

  const edges: DependencyEdge[] = [];
  for (const file of await readdir("data/llm/decisions")) {
    if (!file.endsWith(".json")) continue;
    edges.push(...(await readJson<DependencyEdge[]>(`data/llm/decisions/${file}`)));
  }
  return edges.map((edge) => ({ ...edge, source: edge.source === "verified" ? "verified" : "llm" }));
}

async function main(): Promise<void> {
  const tools = await readJson<NormalizedTool[]>("data/normalized/all_tools.json");
  const toolsBySlug = new Map(tools.map((tool) => [tool.slug, tool]));
  const candidates = await readJson<TargetCandidates[]>("data/candidates/all_candidates.json");
  const edgeMap = new Map<string, DependencyEdge>();

  for (const targetCandidates of candidates) {
    const target = toolsBySlug.get(targetCandidates.target.slug);
    if (!target) continue;

    const inputs = matchableInputs(target);
    const edgesForTarget: DependencyEdge[] = [];

    for (const candidate of targetCandidates.candidates) {
      const source = toolsBySlug.get(candidate.slug);
      if (!source) continue;

      for (const input of inputs) {
        const produced = sourceCanProduceInput(target, source, candidate, input);
        if (!produced) continue;

        edgesForTarget.push({
          from: source.slug,
          to: target.slug,
          satisfies: [input.path],
          resource: produced.resource,
          confidence: produced.confidence,
          reason: produced.reason,
          source: "rules",
        });
      }
    }

    for (const edge of rankEdges(edgesForTarget)) {
      edgeMap.set(`${edge.from}->${edge.to}:${edge.satisfies.join(",")}`, edge);
    }
  }

  for (const edge of await loadLlmEdges()) {
    edgeMap.set(`${edge.from}->${edge.to}:${edge.satisfies.join(",")}`, edge);
  }

  const graph: DependencyGraph = {
    generatedAt: new Date().toISOString(),
    model: "rules+optional-llm",
    nodes: tools,
    edges: [...edgeMap.values()].sort((a, b) => a.to.localeCompare(b.to) || b.confidence - a.confidence),
  };

  await writeJson("data/dependency_graph.json", graph);
  await writeJson("data/dependency_edges.json", graph.edges);

  const sourceCounts = graph.edges.reduce<Record<string, number>>((acc, edge) => {
    acc[edge.source] = (acc[edge.source] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`Built graph with ${graph.nodes.length} nodes and ${graph.edges.length} edges.`);
  console.log(sourceCounts);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
