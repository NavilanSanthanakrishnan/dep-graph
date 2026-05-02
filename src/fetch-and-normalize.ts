import { Composio } from "@composio/core";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { normalizeTool, summarizeTool } from "./normalize.ts";
import type { NormalizedTool, RawComposioTool, ToolkitSlug } from "./types.ts";

const TOOLKITS: ToolkitSlug[] = ["github", "googlesuper"];
const LIMIT_PER_TOOLKIT = 2000;

function loadDotEnv(): void {
  if (!existsSync(".env")) return;

  const raw = readFileSync(".env", "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalsAt = trimmed.indexOf("=");
    if (equalsAt === -1) continue;

    const key = trimmed.slice(0, equalsAt).trim();
    const value = trimmed.slice(equalsAt + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

function unwrapTools(response: unknown): RawComposioTool[] {
  if (Array.isArray(response)) return response as RawComposioTool[];

  const maybeObject = response as { items?: unknown };
  if (Array.isArray(maybeObject.items)) return maybeObject.items as RawComposioTool[];

  throw new Error("Unexpected Composio tools response shape: expected an array or { items: [] }.");
}

async function fetchToolkitTools(composio: Composio, toolkit: ToolkitSlug): Promise<RawComposioTool[]> {
  const response = await composio.tools.getRawComposioTools({
    toolkits: [toolkit],
    limit: LIMIT_PER_TOOLKIT,
  });

  return unwrapTools(response);
}

function markdownSummary(tools: NormalizedTool[], fetchedAt: string): string {
  const byToolkit = new Map<string, NormalizedTool[]>();
  for (const tool of tools) {
    const list = byToolkit.get(tool.toolkit) ?? [];
    list.push(tool);
    byToolkit.set(tool.toolkit, list);
  }

  const lines = [
    "# Tool Inventory",
    "",
    `Generated: ${fetchedAt}`,
    `Total tools: ${tools.length}`,
    "",
  ];

  for (const [toolkit, toolkitTools] of [...byToolkit.entries()].sort()) {
    const deprecated = toolkitTools.filter((tool) => tool.isDeprecated).length;
    const withRequiredInputs = toolkitTools.filter((tool) => tool.requiredInputs.length > 0).length;

    lines.push(`## ${toolkit}`);
    lines.push("");
    lines.push(`Tools: ${toolkitTools.length}`);
    lines.push(`Deprecated: ${deprecated}`);
    lines.push(`Tools with required inputs: ${withRequiredInputs}`);
    lines.push("");
    lines.push("### First 25 Tools");
    lines.push("");
    lines.push(...toolkitTools.slice(0, 25).map(summarizeTool));
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

async function normalizeExistingRaw(): Promise<void> {
  const fetchedAt = new Date().toISOString();
  const allNormalized: NormalizedTool[] = [];

  await mkdir("data/normalized", { recursive: true });
  await mkdir("data/summary", { recursive: true });

  for (const toolkit of TOOLKITS) {
    const rawPath = `data/raw/${toolkit}_tools.json`;
    if (!existsSync(rawPath)) {
      throw new Error(`Missing ${rawPath}; run with COMPOSIO_API_KEY first to fetch raw tools.`);
    }

    const raw = unwrapTools(await readJson(rawPath));
    const normalized = raw.map((tool) => normalizeTool(tool, toolkit));
    allNormalized.push(...normalized);

    await writeJson(`data/normalized/${toolkit}_tools.json`, normalized);
  }

  await writeJson("data/normalized/all_tools.json", allNormalized);
  await writeFile("data/summary/tool_inventory.md", markdownSummary(allNormalized, fetchedAt), "utf8");
}

async function selfTest(): Promise<void> {
  const sample: RawComposioTool = {
    slug: "GOOGLESUPER_ACL_DELETE",
    name: "Delete ACL Rule",
    description: "Deletes an access control rule from a Google Calendar.",
    toolkit: { slug: "googlesuper", name: "Google Super" },
    inputParameters: {
      type: "object",
      required: ["rule_id", "calendar_id"],
      properties: {
        rule_id: { type: "string", description: "ACL rule ID." },
        calendar_id: { type: "string", description: "Calendar ID." },
        options: {
          type: "object",
          properties: {
            send_updates: { type: "boolean" },
          },
        },
      },
    },
    outputParameters: {
      type: "object",
      properties: {
        data: { type: "string" },
        error: { type: "string" },
        successful: { type: "boolean" },
      },
    },
  };

  console.log(JSON.stringify(normalizeTool(sample), null, 2));
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));

  if (args.has("--self-test")) {
    await selfTest();
    return;
  }

  if (args.has("--normalize-existing")) {
    await normalizeExistingRaw();
    console.log("Normalized existing raw tool files.");
    return;
  }

  loadDotEnv();

  if (!process.env.COMPOSIO_API_KEY) {
    throw new Error(
      "COMPOSIO_API_KEY is not set. Run `COMPOSIO_API_KEY=... sh scaffold.sh`, or create .env, then rerun this script.",
    );
  }

  await mkdir("data/raw", { recursive: true });
  await mkdir("data/normalized", { recursive: true });
  await mkdir("data/summary", { recursive: true });

  const fetchedAt = new Date().toISOString();
  const composio = new Composio({ apiKey: process.env.COMPOSIO_API_KEY });
  const allRaw: RawComposioTool[] = [];
  const allNormalized: NormalizedTool[] = [];

  for (const toolkit of TOOLKITS) {
    console.log(`Fetching ${toolkit} tools...`);
    const raw = await fetchToolkitTools(composio, toolkit);
    const normalized = raw.map((tool) => normalizeTool(tool, toolkit));

    allRaw.push(...raw);
    allNormalized.push(...normalized);

    await writeJson(`data/raw/${toolkit}_tools.json`, raw);
    await writeJson(`data/normalized/${toolkit}_tools.json`, normalized);

    console.log(`Fetched ${toolkit}: ${raw.length} tools`);
  }

  await writeJson("data/raw/all_tools.json", allRaw);
  await writeJson("data/normalized/all_tools.json", allNormalized);
  await writeFile("data/summary/tool_inventory.md", markdownSummary(allNormalized, fetchedAt), "utf8");

  console.log(`Wrote inventory for ${allNormalized.length} tools.`);
  console.log("Raw: data/raw/*.json");
  console.log("Normalized: data/normalized/*.json");
  console.log("Summary: data/summary/tool_inventory.md");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
