import { STRANDS_TOOLS_REGISTRY, type StrandsToolMetadata } from "../toolRegistry";

export function normalizeToolName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function findToolMetadata(name: string): StrandsToolMetadata | undefined {
  const normalized = normalizeToolName(name);

  if (STRANDS_TOOLS_REGISTRY[normalized]) {
    return STRANDS_TOOLS_REGISTRY[normalized];
  }

  return Object.values(STRANDS_TOOLS_REGISTRY).find((tool) => {
    return (
      normalizeToolName(tool.name) === normalized ||
      normalizeToolName(tool.displayName) === normalized
    );
  });
}
