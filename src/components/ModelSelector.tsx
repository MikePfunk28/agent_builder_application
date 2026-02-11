import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ChevronDown, Info, Lock, RefreshCw, Wifi, WifiOff } from "lucide-react";
import {
  MODEL_CATALOG,
  ModelMetadata,
  ModelProvider,
  mergeLocalModels,
} from "../data/modelCatalog";
import { useLocalModels, detectedToMetadata } from "../hooks/useLocalModels";

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
  { id: "lmstudio", label: "LMStudio (Local)" },
];

/** Check if the user's tier grants access to a model's requiredTier */
function isTierSufficient(
  userTier: string,
  requiredTier: ModelMetadata["requiredTier"]
): boolean {
  if (!requiredTier) return true; // no restriction
  const hierarchy: Record<string, number> = {
    freemium: 0,
    personal: 1,
    enterprise: 2,
  };
  return (hierarchy[userTier] ?? 0) >= (hierarchy[requiredTier] ?? 0);
}

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [provider, setProvider] = useState<ProviderOption["id"]>("all");
  const [customModelId, setCustomModelId] = useState("");

  // Fetch the user's current subscription tier
  const subscription = useQuery(api.stripeMutations.getSubscriptionStatus);
  const userTier = subscription?.tier ?? "freemium";

  // Detect locally-running models (Ollama + LMStudio) from the browser
  const {
    ollamaRunning,
    lmstudioRunning,
    ollamaModels,
    lmstudioModels,
    loading: detectingLocal,
    refresh: refreshLocal,
  } = useLocalModels();

  // Merge detected local models with static catalog defaults
  const allModels = useMemo(() => {
    const ollamaDetected = detectedToMetadata(ollamaModels);
    const lmstudioDetected = detectedToMetadata(lmstudioModels);
    const mergedOllama = mergeLocalModels("ollama", ollamaDetected);
    const mergedLmstudio = mergeLocalModels("lmstudio", lmstudioDetected);
    const bedrock = MODEL_CATALOG.filter((m) => m.provider === "bedrock");
    return [...bedrock, ...mergedOllama, ...mergedLmstudio];
  }, [ollamaModels, lmstudioModels]);

  const filteredModels = useMemo(() => {
    const lowerSearch = searchTerm.trim().toLowerCase();
    return allModels.filter((model) => {
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
  }, [searchTerm, provider, allModels]);

  const groupedByProvider = useMemo(() => {
    return filteredModels.reduce<Record<ModelProvider, ModelMetadata[]>>(
      (acc, model) => {
        acc[model.provider] = acc[model.provider] ?? [];
        acc[model.provider].push(model);
        return acc;
      },
      { bedrock: [], ollama: [], lmstudio: [] }
    );
  }, [filteredModels]);

  const currentModel = allModels.find((model) => model.id === value);

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

      {/* Local provider status bar */}
      {(provider === "all" || provider === "ollama" || provider === "lmstudio") && (
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            {ollamaRunning ? <Wifi className="w-3 h-3 text-green-400" /> : <WifiOff className="w-3 h-3 text-gray-600" />}
            Ollama {ollamaRunning ? `(${ollamaModels.length} detected)` : "(not running)"}
          </span>
          <span className="flex items-center gap-1">
            {lmstudioRunning ? <Wifi className="w-3 h-3 text-green-400" /> : <WifiOff className="w-3 h-3 text-gray-600" />}
            LMStudio {lmstudioRunning ? `(${lmstudioModels.length} loaded)` : "(not running)"}
          </span>
          <button
            type="button"
            onClick={refreshLocal}
            disabled={detectingLocal}
            className="ml-auto flex items-center gap-1 text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${detectingLocal ? "animate-spin" : ""}`} />
            {detectingLocal ? "Detecting..." : "Refresh"}
          </button>
        </div>
      )}

      <div className="space-y-5">
        {(["bedrock", "ollama", "lmstudio"] as ModelProvider[])
          .filter((providerKey) =>
            provider === "all" ? true : providerKey === provider
          )
          .map((providerKey) => {
            const models = groupedByProvider[providerKey];
            if (!models || models.length === 0) {
              return null;
            }

            const isLocal = providerKey === "ollama" || providerKey === "lmstudio";
            const isRunning = providerKey === "ollama" ? ollamaRunning : providerKey === "lmstudio" ? lmstudioRunning : false;

            return (
              <div
                key={providerKey}
                className="border border-emerald-500/20 rounded-lg bg-slate-950/80"
              >
                <div className="px-4 py-3 border-b border-emerald-500/10 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-emerald-200 flex items-center gap-2">
                    {providerKey === "bedrock" ? "AWS Bedrock" : providerKey === "ollama" ? "Ollama (Local)" : "LMStudio (Local)"}
                    {isLocal && (
                      <span className={`inline-block w-2 h-2 rounded-full ${isRunning ? "bg-green-400" : "bg-gray-600"}`} />
                    )}
                  </h3>
                  <span className="text-[11px] uppercase tracking-wide text-emerald-400">
                    {models.length} models
                  </span>
                </div>
                <div className="divide-y divide-emerald-500/10">
                  {models.map((model) => {
                    const isActive = value === model.id;
                    const locked = !isTierSufficient(userTier, model.requiredTier);
                    const tierLabel = model.requiredTier === "enterprise" ? "Enterprise" : "Personal";
                    return (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => {
                          if (locked) return; // gated – no selection
                          onChange(model.id);
                        }}
                        disabled={locked}
                        className={`w-full text-left px-4 py-3 flex flex-col gap-2 transition-colors ${
                          locked
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-emerald-500/10"
                        } ${isActive ? "bg-emerald-500/15 border-l-2 border-emerald-400" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-gray-100 flex items-center gap-2">
                              {model.label}
                              {locked && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">
                                  <Lock className="w-3 h-3" />
                                  Upgrade to {tierLabel}
                                </span>
                              )}
                              {model.recommended && !locked && (
                                <span className="inline-flex items-center px-2 py-0.5 text-[11px] rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                                  Recommended
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-gray-400">{model.description}</p>
                          </div>
                          {locked ? (
                            <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                          ) : (
                            <Info className="w-4 h-4 text-emerald-300 shrink-0" />
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 text-[11px] text-emerald-300">
                          <span className="px-2 py-0.5 bg-emerald-500/10 rounded border border-emerald-500/20">
                            {model.family ?? (model.provider === "bedrock" ? "Bedrock" : model.provider === "ollama" ? "Ollama" : "LMStudio")}
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

      {/* Manual model entry for custom model IDs */}
      <div className="border border-emerald-500/20 rounded-lg bg-slate-950/80 px-4 py-3">
        <label className="block text-xs font-medium text-emerald-200 mb-2">
          Custom Model ID
        </label>
        <p className="text-[11px] text-gray-500 mb-2">
          Enter any Ollama or LMStudio model ID not listed above.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. mistral:7b or my-custom-model"
            value={customModelId}
            onChange={(e) => setCustomModelId(e.target.value)}
            className="flex-1 px-3 py-2 bg-black border border-emerald-500/20 rounded-lg text-emerald-100 placeholder-emerald-700 text-sm focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none transition-colors"
          />
          <button
            type="button"
            disabled={!customModelId.trim()}
            onClick={() => {
              const trimmed = customModelId.trim();
              if (trimmed) {
                onChange(trimmed);
                setCustomModelId("");
              }
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm rounded-lg transition-colors"
          >
            Use
          </button>
        </div>
      </div>

      {currentModel ? (
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
      ) : value ? (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-100 space-y-1">
          <p className="font-semibold text-emerald-200">
            Selected: Custom model
          </p>
          <p>Model ID: {value}</p>
        </div>
      ) : null}
    </div>
  );
}
