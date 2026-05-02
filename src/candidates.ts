import { mkdir, readFile, writeFile } from "node:fs/promises";
import {
  isDestructive,
  isPotentialProducer,
  matchableInputs,
  normalizeName,
  producerStrength,
  resourceForParam,
  resourcesForToolText,
  toolText,
} from "./resource-rules.ts";
import type { CandidateTool, NormalizedTool, TargetCandidates } from "./types.ts";

const DEFAULT_MAX_CANDIDATES = 40;

type ScoredCandidate = CandidateTool & {
  resourceOverlap: string[];
};

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(path.split("/").slice(0, -1).join("/"), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function matchingTerms(target: NormalizedTool, source: NormalizedTool): string[] {
  const targetTerms = new Set(
    `${target.slug} ${target.name} ${target.description}`
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((term) => term.length >= 4),
  );

  return `${source.slug} ${source.name} ${source.description}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => targetTerms.has(term))
    .filter((term, index, arr) => arr.indexOf(term) === index)
    .slice(0, 8);
}

function scoreSourceForTarget(target: NormalizedTool, source: NormalizedTool): ScoredCandidate | null {
  if (target.slug === source.slug) return null;

  const meaningfulInputs = matchableInputs(target);
  if (meaningfulInputs.length === 0) return null;

  const targetResources = new Set(
    meaningfulInputs.flatMap((param) => resourceForParam(param, target)),
  );
  const sourceResources = new Set(resourcesForToolText(source));
  const overlap = [...targetResources].filter((resource) => sourceResources.has(resource));
  const terms = matchingTerms(target, source);
  const sourceText = toolText(source);
  const targetText = toolText(target);
  const sourceProducerStrength = producerStrength(source);

  let score = 0;
  const reasons: string[] = [];

  if (target.toolkit === source.toolkit) {
    score += 1.5;
    reasons.push("same toolkit");
  }

  if (overlap.length > 0) {
    score += overlap.length * 5;
    reasons.push(`resource overlap: ${overlap.join(", ")}`);
  }

  for (const input of meaningfulInputs) {
    const normalizedInput = normalizeName(input.path);
    if (new RegExp(`\\b${normalizedInput.replace(/_/g, "[-_ ]?")}s?\\b`, "i").test(sourceText)) {
      score += 4;
      reasons.push(`mentions input ${input.path}`);
    }

    const leaf = normalizeName(input.name);
    if (leaf !== normalizedInput && new RegExp(`\\b${leaf.replace(/_/g, "[-_ ]?")}s?\\b`, "i").test(sourceText)) {
      score += 2;
      reasons.push(`mentions field ${input.name}`);
    }
  }

  if (isPotentialProducer(source)) {
    score += sourceProducerStrength;
    reasons.push(`producer verb strength ${sourceProducerStrength}`);
  }

  if (terms.length > 0) {
    score += Math.min(terms.length, 4);
    reasons.push(`shared terms: ${terms.slice(0, 5).join(", ")}`);
  }

  // Cross-toolkit edges are rare and should be earned by strong semantic evidence.
  if (target.toolkit !== source.toolkit && overlap.length === 0) {
    score -= 3;
  }

  if (isDestructive(source)) {
    score -= 2.5;
    reasons.push("source is destructive, lower priority as provider");
  }

  // Avoid noisy edges from generic repo/list tools unless they match a concrete resource.
  if (/^(owner|repo|org)$/i.test(meaningfulInputs.map((param) => param.name).join("|")) && overlap.length === 0) {
    score -= 2;
  }

  if (score < 5) return null;

  return {
    slug: source.slug,
    name: source.name,
    toolkit: source.toolkit,
    description: source.description,
    requiredInputs: source.requiredInputs.map((param) => param.path),
    score: Number(score.toFixed(2)),
    reasons: [...new Set(reasons)].slice(0, 8),
    resourceOverlap: overlap,
  };
}

export function buildCandidatesForTool(
  target: NormalizedTool,
  allTools: NormalizedTool[],
  maxCandidates = DEFAULT_MAX_CANDIDATES,
): TargetCandidates | null {
  const meaningfulInputs = matchableInputs(target);
  if (meaningfulInputs.length === 0) return null;

  const candidates = allTools
    .map((source) => scoreSourceForTarget(target, source))
    .filter((candidate): candidate is ScoredCandidate => candidate !== null)
    .sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug))
    .slice(0, maxCandidates)
    .map(({ resourceOverlap: _resourceOverlap, ...candidate }) => candidate);

  if (candidates.length === 0) return null;

  return {
    target: {
      slug: target.slug,
      name: target.name,
      toolkit: target.toolkit,
      description: target.description,
      requiredInputs: target.requiredInputs.map((param) => param.path),
      matchableInputs: meaningfulInputs.map((param) => param.path),
    },
    candidates,
  };
}

export async function buildAllCandidates(options: {
  inputPath?: string;
  outputPath?: string;
  maxCandidates?: number;
} = {}): Promise<TargetCandidates[]> {
  const inputPath = options.inputPath ?? "data/normalized/all_tools.json";
  const outputPath = options.outputPath ?? "data/candidates/all_candidates.json";
  const tools = await readJson<NormalizedTool[]>(inputPath);
  const allCandidates = tools
    .map((target) => buildCandidatesForTool(target, tools, options.maxCandidates))
    .filter((target): target is TargetCandidates => target !== null);

  await writeJson(outputPath, allCandidates);
  return allCandidates;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const maxArg = process.argv.find((arg) => arg.startsWith("--max="));
  const maxCandidates = maxArg ? Number(maxArg.split("=")[1]) : DEFAULT_MAX_CANDIDATES;
  const allCandidates = await buildAllCandidates({ maxCandidates });
  console.log(`Built candidate sets for ${allCandidates.length} target tools.`);
  console.log("Wrote data/candidates/all_candidates.json");
}
