export type ToolkitSlug = "github" | "googlesuper";

export type JsonSchemaObject = {
  type?: string;
  description?: string;
  title?: string;
  properties?: Record<string, JsonSchemaObject>;
  items?: JsonSchemaObject | JsonSchemaObject[];
  required?: string[];
  enum?: unknown[];
  anyOf?: JsonSchemaObject[];
  oneOf?: JsonSchemaObject[];
  allOf?: JsonSchemaObject[];
  nullable?: boolean;
  default?: unknown;
  additionalProperties?: boolean | JsonSchemaObject;
  [key: string]: unknown;
};

export type RawComposioTool = {
  slug: string;
  name: string;
  description?: string;
  inputParameters?: JsonSchemaObject;
  outputParameters?: JsonSchemaObject;
  tags?: string[];
  toolkit?: {
    slug: string;
    name: string;
    logo?: string;
  };
  version?: string;
  isDeprecated?: boolean;
  scopes?: string[];
  isNoAuth?: boolean;
  [key: string]: unknown;
};

export type NormalizedParam = {
  name: string;
  path: string;
  type: string;
  required: boolean;
  description?: string;
  enum?: unknown[];
};

export type NormalizedTool = {
  slug: string;
  name: string;
  toolkit: string;
  description: string;
  tags: string[];
  version?: string;
  isDeprecated: boolean;
  scopes: string[];
  inputs: NormalizedParam[];
  requiredInputs: NormalizedParam[];
  optionalInputs: NormalizedParam[];
  outputs: NormalizedParam[];
};

export type ToolkitInventory = {
  toolkit: ToolkitSlug;
  fetchedAt: string;
  rawCount: number;
  normalizedCount: number;
  tools: NormalizedTool[];
};

export type CandidateTool = {
  slug: string;
  name: string;
  toolkit: string;
  description: string;
  requiredInputs: string[];
  score: number;
  reasons: string[];
};

export type TargetCandidates = {
  target: {
    slug: string;
    name: string;
    toolkit: string;
    description: string;
    requiredInputs: string[];
    matchableInputs: string[];
  };
  candidates: CandidateTool[];
};

export type DependencyEdge = {
  from: string;
  to: string;
  satisfies: string[];
  resource?: string;
  confidence: number;
  reason: string;
  source: "llm" | "rules" | "verified";
};

export type DependencyGraph = {
  generatedAt: string;
  model?: string;
  nodes: NormalizedTool[];
  edges: DependencyEdge[];
};
