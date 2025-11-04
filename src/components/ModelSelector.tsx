import { useMemo, useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import {
  MODEL_CATALOG,
  ModelMetadata,
  ModelProvider,
} from "../data/modelCatalog";

interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
}

interface ProviderOption {
  id: "all" | ModelProvider;
  label: string;
}

const PROVIDER_OPTIONS: ProviderOption[] = [
  { id: "all", label: "All Providers" },
  { id: "bedrock", label: "AWS Bedrock" },
  { id: "ollama", label: "Ollama (Local)" },
];

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [provider, setProvider] = useState<ProviderOption["id"]>("all");

  const filteredModels = useMemo(() => {
    const lowerSearch = searchTerm.trim().toLowerCase();
    return MODEL_CATALOG.filter((model) => {
      if (provider !== "all" && model.provider !== provider) {
        return false;
      }
      if (!lowerSearch) return true;
      return (
        model.label.toLowerCase().includes(lowerSearch) ||
        model.id.toLowerCase().includes(lowerSearch) ||
        model.description.toLowerCase().includes(lowerSearch) ||
        model.tags?.some((tag) => tag.toLowerCase().includes(lowerSearch))
      );
    });
  }, [searchTerm, provider]);

  const groupedByProvider = useMemo(() => {
    return filteredModels.reduce<Record<ModelProvider, ModelMetadata[]>>(
      (acc, model) => {
        acc[model.provider] = acc[model.provider] ?? [];
        acc[model.provider].push(model);
        return acc;
      },
      { bedrock: [], ollama: [] }
    );
  }, [filteredModels]);

  const currentModel = MODEL_CATALOG.find((model) => model.id === value);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-200 mb-1">
          Model Selection
        </label>
        <p className="text-xs text-gray-500">
          Choose a model family. All presets include sensible defaults for temperature,
          top-p, and context length.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search models..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="flex-1 px-3 py-2 bg-black border border-emerald-500/20 rounded-lg text-emerald-100 placeholder-emerald-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none transition-colors"
        />
        <div className="relative">
          <select
            value={provider}
            onChange={(event) =>
              setProvider(event.target.value as ProviderOption["id"])
            }
            className="appearance-none pl-3 pr-8 py-2 bg-black border border-emerald-500/20 rounded-lg text-emerald-100 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none transition-colors"
          >
            {PROVIDER_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-emerald-300 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      <div className="space-y-5">
        {(["bedrock", "ollama"] as ModelProvider[])
          .filter((providerKey) =>
            provider === "all" ? true : providerKey === provider
          )
          .map((providerKey) => {
            const models = groupedByProvider[providerKey];
            if (!models || models.length === 0) {
              return null;
            }

            return (
              <div
                key={providerKey}
                className="border border-emerald-500/20 rounded-lg bg-slate-950/80"
              >
                <div className="px-4 py-3 border-b border-emerald-500/10 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-emerald-200">
                    {providerKey === "bedrock" ? "AWS Bedrock" : "Ollama (Local)"}
                  </h3>
                  <span className="text-[11px] uppercase tracking-wide text-emerald-400">
                    {models.length} models
                  </span>
                </div>
                <div className="divide-y divide-emerald-500/10">
                  {models.map((model) => {
                    const isActive = value === model.id;
                    return (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => onChange(model.id)}
                        className={`w-full text-left px-4 py-3 flex flex-col gap-2 hover:bg-emerald-500/10 transition-colors ${
                          isActive ? "bg-emerald-500/15 border-l-2 border-emerald-400" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-gray-100 flex items-center gap-2">
                              {model.label}
                              {model.recommended && (
                                <span className="inline-flex items-center px-2 py-0.5 text-[11px] rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                                  Recommended
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-gray-400">{model.description}</p>
                          </div>
                          <Info className="w-4 h-4 text-emerald-300 shrink-0" />
                        </div>
                        <div className="flex flex-wrap gap-2 text-[11px] text-emerald-300">
                          <span className="px-2 py-0.5 bg-emerald-500/10 rounded border border-emerald-500/20">
                            {model.family ?? (model.provider === "bedrock" ? "Bedrock" : "Ollama")}
                          </span>
                          {model.tags?.map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 bg-emerald-500/10 rounded border border-emerald-500/20 uppercase tracking-wide"
                            >
                              {tag}
                            </span>
                          ))}
                          {model.contextLength && (
                            <span className="px-2 py-0.5 bg-emerald-500/10 rounded border border-emerald-500/20">
                              Context: {model.contextLength.toLocaleString()}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-emerald-400">
                          Model ID: {model.id}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
      </div>

      {currentModel && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-100 space-y-1">
          <p className="font-semibold text-emerald-200">
            Selected: {currentModel.label}
          </p>
          <p>{currentModel.description}</p>
          <p>
            Defaults • Temp {currentModel.defaultConfig.temperature ?? 0.2} • topP{" "}
            {currentModel.defaultConfig.topP ?? 0.9}
          </p>
        </div>
      )}
    </div>
  );
}
