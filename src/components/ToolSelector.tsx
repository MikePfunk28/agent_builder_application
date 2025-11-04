import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  Search,
  Package,
  Puzzle,
  PlugZap,
  Cpu,
  Loader2,
  SlidersHorizontal,
  Plus,
} from "lucide-react";

interface Tool {
  name: string;
  type: string;
  config?: any;
  requiresPip?: boolean;
  pipPackages?: string[];
  extrasPip?: string;
  notSupportedOn?: string[];
}

interface ToolSelectorProps {
  onAddTool: (tool: Tool) => void;
}

type ToolCategory =
  | "rag_memory"
  | "file_operations"
  | "shell_system"
  | "code_interpretation"
  | "web_network"
  | "multimodal"
  | "aws_services"
  | "utilities"
  | "agents_workflows";

const CATEGORY_LABEL: Record<ToolCategory, string> = {
  rag_memory: "RAG & Memory",
  file_operations: "File Operations",
  shell_system: "Shell & System",
  code_interpretation: "Code Interpretation",
  web_network: "Web & Network",
  multimodal: "Multimodal",
  aws_services: "AWS Services",
  utilities: "Utilities",
  agents_workflows: "Agents & Workflows",
};

const CATEGORY_ICON: Record<ToolCategory, JSX.Element> = {
  rag_memory: <Puzzle className="w-4 h-4" />,
  file_operations: <Package className="w-4 h-4" />,
  shell_system: <Cpu className="w-4 h-4" />,
  code_interpretation: <SlidersHorizontal className="w-4 h-4" />,
  web_network: <PlugZap className="w-4 h-4" />,
  multimodal: <PlugZap className="w-4 h-4" />,
  aws_services: <Package className="w-4 h-4" />,
  utilities: <SlidersHorizontal className="w-4 h-4" />,
  agents_workflows: <Puzzle className="w-4 h-4" />,
};

export function ToolSelector({ onAddTool }: ToolSelectorProps) {
  const toolRegistry = useQuery(api.toolRegistry.getAllTools);
  const [searchTerm, setSearchTerm] = useState("");
  const [category, setCategory] = useState<"All" | ToolCategory>("All");
  const [detailsId, setDetailsId] = useState<string | null>(null);

  const allCategories = useMemo(() => {
    if (!toolRegistry) return [];
    const unique = new Set<ToolCategory>();
    for (const tool of toolRegistry) {
      unique.add(tool.category as ToolCategory);
    }
    return Array.from(unique).sort((a, b) =>
      CATEGORY_LABEL[a].localeCompare(CATEGORY_LABEL[b])
    );
  }, [toolRegistry]);

  const filteredTools = useMemo(() => {
    if (!toolRegistry) return [];
    const lowerSearch = searchTerm.trim().toLowerCase();
    return toolRegistry.filter((tool) => {
      if (category !== "All" && tool.category !== category) {
        return false;
      }
      if (!lowerSearch) return true;
      return (
        tool.displayName.toLowerCase().includes(lowerSearch) ||
        tool.name.toLowerCase().includes(lowerSearch) ||
        tool.description.toLowerCase().includes(lowerSearch) ||
        tool.capabilities.some((cap) =>
          cap.toLowerCase().includes(lowerSearch)
        )
      );
    });
  }, [toolRegistry, category, searchTerm]);

  const handleAddTool = (toolId: string) => {
    if (!toolRegistry) return;
    const metadata = toolRegistry.find((tool) => tool.name === toolId);
    if (!metadata) return;

    const pipPackages = metadata.additionalPipPackages ?? [];
    const hasExtras = Boolean(metadata.extrasPip);

    onAddTool({
      name: metadata.displayName,
      type: metadata.name,
      requiresPip: true,
      pipPackages: pipPackages.length > 0 ? pipPackages : ["strands-agents-tools>=1.0.0"],
      extrasPip: metadata.extrasPip,
      notSupportedOn: metadata.notSupportedOn,
      config: {},
    });
  };

  if (!toolRegistry) {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-200">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading Strands tool catalog…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-emerald-100 mb-1">
          Tool Catalog
        </label>
        <p className="text-xs text-emerald-500">
          Powered by Strands Agents tools. Add tools, MCP bindings, or agent orchestration helpers.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
          <input
            type="text"
            placeholder="Search tools…"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-black border border-emerald-500/20 rounded-lg text-emerald-100 placeholder-emerald-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none transition-colors"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setCategory("All")}
            className={`px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wide transition-colors ${
              category === "All"
                ? "bg-emerald-600 text-white"
                : "bg-slate-900 text-emerald-300 hover:bg-slate-800"
            }`}
          >
            All
          </button>
          {allCategories.map((categoryId) => (
            <button
              key={categoryId}
              onClick={() => setCategory(categoryId)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wide transition-colors inline-flex items-center gap-2 ${
                category === categoryId
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-900 text-emerald-300 hover:bg-slate-800"
              }`}
            >
              {CATEGORY_ICON[categoryId]}
              {CATEGORY_LABEL[categoryId]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredTools.map((tool) => {
          const isExpanded = detailsId === tool.name;
          return (
            <div
              key={tool.name}
              className="border border-emerald-500/20 rounded-lg bg-slate-950/80 px-4 py-3 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-emerald-100">
                    {tool.displayName}
                  </p>
                  <p className="text-xs text-emerald-500">
                    {CATEGORY_LABEL[tool.category as ToolCategory] ?? tool.category}
                  </p>
                </div>
                <button
                  onClick={() => handleAddTool(tool.name)}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-emerald-500/20 text-emerald-200 border border-emerald-400/20 hover:bg-emerald-500/30 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Add
                </button>
              </div>
              <p className="text-xs text-emerald-400">{tool.description}</p>

              <div className="flex flex-wrap gap-2 text-[11px]">
                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-300 rounded border border-emerald-500/20 uppercase tracking-wide">
                  {tool.name}
                </span>
                {tool.capabilities.slice(0, 3).map((capability) => (
                  <span
                    key={capability}
                    className="px-2 py-0.5 bg-emerald-500/10 text-emerald-300 rounded border border-emerald-500/20"
                  >
                    {capability}
                  </span>
                ))}
                {tool.requiresEnvVars && tool.requiresEnvVars.length > 0 && (
                  <span className="px-2 py-0.5 bg-amber-500/10 text-amber-300 rounded border border-amber-500/20">
                    Env Vars
                  </span>
                )}
                {tool.notSupportedOn?.includes("windows") && (
                  <span className="px-2 py-0.5 bg-red-500/10 text-red-300 rounded border border-red-500/20">
                    Not on Windows
                  </span>
                )}
              </div>

              <button
                onClick={() => setDetailsId(isExpanded ? null : tool.name)}
                className="text-xs text-emerald-300 hover:text-emerald-200 transition-colors"
              >
                {isExpanded ? "Hide details" : "View details"}
              </button>

              {isExpanded && (
                <div className="space-y-2 text-xs text-emerald-300 border-t border-emerald-500/10 pt-3">
                  <div>
                    <p className="font-medium text-emerald-200">Import</p>
                    <code className="block mt-1 px-2 py-1 rounded bg-black border border-emerald-500/20 text-emerald-200">
                      {tool.importPath}
                    </code>
                  </div>
                  <div>
                    <p className="font-medium text-emerald-200">Installation</p>
                    <code className="block mt-1 px-2 py-1 rounded bg-black border border-emerald-500/20 text-emerald-200">
                      pip install strands-agents-tools
                      {tool.extrasPip ? `[${tool.extrasPip}]` : ""}
                    </code>
                    {tool.additionalPipPackages?.length ? (
                      <code className="block mt-1 px-2 py-1 rounded bg-black border border-emerald-500/20 text-emerald-200">
                        pip install {tool.additionalPipPackages.join(" ")}
                      </code>
                    ) : null}
                  </div>
                  {tool.requiresEnvVars?.length ? (
                    <div>
                      <p className="font-medium text-emerald-200">
                        Required environment variables
                      </p>
                      <ul className="list-disc list-inside mt-1 space-y-0.5">
                        {tool.requiresEnvVars.map((envVar) => (
                          <li key={envVar}>{envVar}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {tool.docsUrl && (
                    <p>
                      Docs:{" "}
                      <a
                        href={tool.docsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-200 underline"
                      >
                        {tool.docsUrl}
                      </a>
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredTools.length === 0 && (
        <div className="text-sm text-emerald-200 border border-emerald-500/20 rounded-lg px-4 py-6 bg-slate-950/60">
          No tools match your filters. Try another provider or keyword.
        </div>
      )}
    </div>
  );
}
