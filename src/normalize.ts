import type {
  JsonSchemaObject,
  NormalizedParam,
  NormalizedTool,
  RawComposioTool,
} from "./types.ts";

const GENERIC_OUTPUT_NAMES = new Set(["data", "error", "successful"]);

function uniqueByPath(params: NormalizedParam[]): NormalizedParam[] {
  const seen = new Set<string>();
  return params.filter((param) => {
    const key = `${param.path}:${param.required}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function schemaType(schema: JsonSchemaObject | undefined): string {
  if (!schema) return "unknown";
  if (typeof schema.type === "string") return schema.type;
  if (Array.isArray(schema.enum)) return "enum";
  if (schema.anyOf?.length) return schema.anyOf.map(schemaType).join(" | ");
  if (schema.oneOf?.length) return schema.oneOf.map(schemaType).join(" | ");
  if (schema.allOf?.length) return schema.allOf.map(schemaType).join(" & ");
  if (schema.properties) return "object";
  if (schema.items) return "array";
  return "unknown";
}

function leafName(path: string): string {
  return path.split(".").at(-1)?.replace(/\[\]$/, "") ?? path;
}

function flattenSchema(
  schema: JsonSchemaObject | undefined,
  parentPath = "",
  parentRequired = true,
): NormalizedParam[] {
  if (!schema) return [];

  const params: NormalizedParam[] = [];
  const required = new Set(schema.required ?? []);

  if (schema.properties) {
    for (const [name, childSchema] of Object.entries(schema.properties)) {
      const path = parentPath ? `${parentPath}.${name}` : name;
      const isRequired = parentRequired && required.has(name);
      const type = schemaType(childSchema);

      params.push({
        name,
        path,
        type,
        required: isRequired,
        description: childSchema.description,
        enum: childSchema.enum,
      });

      params.push(...flattenSchema(childSchema, path, isRequired));
    }
  }

  const arrayItems = Array.isArray(schema.items) ? schema.items : schema.items ? [schema.items] : [];
  for (const itemSchema of arrayItems) {
    params.push(...flattenSchema(itemSchema, `${parentPath}[]`, parentRequired));
  }

  for (const composite of [...(schema.anyOf ?? []), ...(schema.oneOf ?? []), ...(schema.allOf ?? [])]) {
    params.push(...flattenSchema(composite, parentPath, parentRequired));
  }

  return uniqueByPath(params);
}

function topLevelParams(schema: JsonSchemaObject | undefined): NormalizedParam[] {
  if (!schema?.properties) return [];

  const required = new Set(schema.required ?? []);
  return Object.entries(schema.properties).map(([name, paramSchema]) => ({
    name,
    path: name,
    type: schemaType(paramSchema),
    required: required.has(name),
    description: paramSchema.description,
    enum: paramSchema.enum,
  }));
}

export function normalizeTool(tool: RawComposioTool, fallbackToolkit?: string): NormalizedTool {
  const inputParams = flattenSchema(tool.inputParameters);
  const outputParams = flattenSchema(tool.outputParameters).filter((param) => {
    // Keep generic output fields if they are all the schema gives us, but avoid
    // letting them dominate later matching when richer nested outputs exist.
    return !GENERIC_OUTPUT_NAMES.has(param.path) || !tool.outputParameters?.properties;
  });

  const outputs = outputParams.length > 0 ? outputParams : topLevelParams(tool.outputParameters);
  const requiredInputs = inputParams.filter((param) => param.required);

  return {
    slug: tool.slug,
    name: tool.name,
    toolkit: tool.toolkit?.slug ?? fallbackToolkit ?? "unknown",
    description: tool.description ?? "",
    tags: tool.tags ?? [],
    version: tool.version,
    isDeprecated: tool.isDeprecated ?? false,
    scopes: tool.scopes ?? [],
    inputs: inputParams,
    requiredInputs,
    optionalInputs: inputParams.filter((param) => !param.required),
    outputs,
  };
}

export function summarizeTool(tool: NormalizedTool): string {
  const required = tool.requiredInputs.map((param) => param.path).join(", ") || "none";
  const outputs = tool.outputs
    .map((param) => param.path)
    .filter((path) => !GENERIC_OUTPUT_NAMES.has(leafName(path)))
    .slice(0, 8)
    .join(", ");

  return `- ${tool.slug} | ${tool.name} | required: ${required} | outputs: ${outputs || "generic/unknown"}`;
}
