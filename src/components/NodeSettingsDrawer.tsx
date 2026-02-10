import React, { useEffect, useMemo, useState } from "react";
import { Save, X } from "lucide-react";
import type {
  WorkflowNode,
  WorkflowNodeData,
  ToolConfig,
  ToolSetConfig,
  ModelConfig,
  ModelSetConfig,
  PromptTextConfig,
  PromptConfig,
  EntrypointConfig,
  MemoryConfig,
  RouterConfig,
  AgentConfig,
  AgentExecutionMode,
  SubAgentConfig,
} from "../types/workflowNodes";
import { listModelsByProvider, getModelMetadata, getModelFromCatalogOrDetected, mergeLocalModels, LOCAL_MODEL_ENDPOINTS } from "../data/modelCatalog";
import { useLocalModels, detectedToMetadata } from "../hooks/useLocalModels";

interface NodeSettingsDrawerProps {
  node: WorkflowNode | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (nodeId: string, data: WorkflowNodeData) => void;
}

type DraftState = WorkflowNodeData | null;

type PromptTextPreset = {
  id: string;
  label: string;
  description: string;
  role: PromptTextConfig["role"];
  template: string;
  inputs?: Record<string, string>;
};

const PROMPT_TEXT_PRESETS: PromptTextPreset[] = [
  {
    id: "research_system",
    label: "Research Lead (system)",
    description: "Sets up a structured research process with evidence checkpoints.",
    role: "system",
    template:
      "You are the research lead. Break the problem into subtopics, gather evidence with citations, and only conclude when every key question is verified.",
    inputs: {},
  },
  {
    id: "writer_system",
    label: "Senior Writer (system)",
    description: "Guides drafting → critique → revision for polished writing.",
    role: "system",
    template:
      "Draft, critique, and refine. Maintain the brand voice described in {{voice}}. Ensure every claim is sourced or marked TODO.",
    inputs: { voice: "empathetic strategic advisor" },
  },
  {
    id: "task_user",
    label: "User Task (user)",
    description: "User instructions with task, constraints, and success metric.",
    role: "user",
    template:
      "Task: {{task}}\nConstraints: {{constraints}}\nSuccess Criteria: {{success}}",
    inputs: {
      task: "Analyze the provided documents",
      constraints: "Use only the supplied sources",
      success: "Deliver a concise executive brief",
    },
  },
  {
    id: "assistant_reflection",
    label: "Assistant Reflection (assistant)",
    description: "Assistant self-reflection template for use in reasoning nodes.",
    role: "assistant",
    template:
      "Thought: I considered {{optionA}} and {{optionB}}.\nReflection: {{reflection}}\nNext Step: {{nextStep}}",
    inputs: {
      optionA: "summarizing each document",
      optionB: "mapping arguments first",
      reflection: "Mapping arguments first preserves nuance.",
      nextStep: "Create an argument map of key sources.",
    },
  },
];

export function NodeSettingsDrawer({
  node,
  isOpen,
  onClose,
  onSave,
}: NodeSettingsDrawerProps) {
  const [draft, setDraft] = useState<DraftState>(null);

  useEffect(() => {
    if (node) {
      setDraft(node.data);
    } else {
      setDraft(null);
    }
  }, [node]);

  const handleSave = () => {
    if (!node || !draft) return;
    // For Model nodes, update the label to reflect the selected model name
    if (draft.type === "Model") {
      const cfg = draft.config as ModelConfig;
      const modelId = cfg.provider === "bedrock" ? cfg.modelId : cfg.model;
      const metadata = modelId ? getModelMetadata(modelId) : undefined;
      (draft as any).label = metadata?.label ?? "Model";
    }
    onSave(node.id, draft);
    onClose();
  };

  const updateDraft = (update: Partial<WorkflowNodeData>) => {
    setDraft((current) => {
      if (!current) return current;
      return { ...current, ...update } as WorkflowNodeData;
    });
  };

  const updateConfig = <T,>(mutator: (config: T) => T) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const nextConfig = mutator(prev.config as T);
      return { ...prev, config: nextConfig } as WorkflowNodeData;
    });
  };

  if (!isOpen || !node || !draft) {
    return null;
  }

  return (
    <div className="fixed inset-y-0 right-0 w-[380px] bg-white shadow-xl border-l border-gray-200 z-50 flex flex-col">
      <header className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">
            {draft.type}
          </p>
          <h2 className="text-lg font-semibold text-gray-900">
            {draft.label || "Untitled Node"}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded hover:bg-gray-100 text-gray-600"
        >
          <X className="w-4 h-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        <section className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            Label
          </label>
          <input
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            value={draft.label ?? ""}
            onChange={(event) => updateDraft({ label: event.target.value })}
            placeholder="Readable label shown on the canvas"
          />
          <label className="block text-sm font-medium text-gray-700">
            Notes
          </label>
          <textarea
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            rows={2}
            value={draft.notes ?? ""}
            onChange={(event) => updateDraft({ notes: event.target.value })}
            placeholder="Optional notes (not used at runtime)"
          />
        </section>

        <section className="space-y-4">
          {renderConfigEditor(draft, updateConfig)}
        </section>
      </div>

      <footer className="px-4 py-3 border-t border-gray-200 flex items-center justify-end gap-2">
        <button
          onClick={onClose}
          className="px-3 py-2 text-sm rounded border border-gray-300 text-gray-600 hover:bg-gray-100"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-3 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          Save
        </button>
      </footer>
    </div>
  );
}

type ConfigUpdater<T> = (mutator: (config: T) => T) => void;

function renderConfigEditor(
  draft: WorkflowNodeData,
  updateConfig: ConfigUpdater<any>
) {
  switch (draft.type) {
    case "Background":
    case "Context":
    case "OutputIndicator":
      return (
        <SimpleTextEditor
          value={draft.config.text}
          onChange={(text) => updateConfig((config) => ({ ...config, text }))}
          label="Text"
          placeholder="Write the content for this prompt section"
        />
      );

    case "PromptText":
      // Legacy migration: treat old PromptText nodes as Prompt nodes
      return (
        <PromptEditor
          config={draft.config as PromptConfig}
          updateConfig={updateConfig}
        />
      );

    case "Prompt":
      return (
        <PromptEditor
          config={draft.config as PromptConfig}
          updateConfig={updateConfig}
        />
      );

    case "Model":
      return (
        <ModelEditor
          config={draft.config as ModelConfig}
          updateConfig={updateConfig}
        />
      );

    case "ModelSet":
      return (
        <ModelSetEditor
          config={draft.config as ModelSetConfig}
          updateConfig={updateConfig}
        />
      );

    case "Tool":
      return (
        <ToolEditor
          config={draft.config as ToolConfig}
          updateConfig={updateConfig}
        />
      );

    case "ToolSet":
      return (
        <ToolSetEditor
          config={draft.config as ToolSetConfig}
          updateConfig={updateConfig}
        />
      );

    case "Entrypoint":
      return (
        <EntrypointEditor
          config={draft.config as EntrypointConfig}
          updateConfig={updateConfig}
        />
      );

    case "Memory":
      return (
        <MemoryEditor
          config={draft.config as MemoryConfig}
          updateConfig={updateConfig}
        />
      );

    case "Router":
      return (
        <RouterEditor
          config={draft.config as RouterConfig}
          updateConfig={updateConfig}
        />
      );

    case "Agent":
      return (
        <AgentEditor
          config={draft.config as AgentConfig}
          updateConfig={updateConfig}
        />
      );

    case "SubAgent":
      return (
        <SubAgentEditor
          config={draft.config as SubAgentConfig}
          updateConfig={updateConfig}
        />
      );

    default:
      return (
        <p className="text-sm text-gray-500">
          No configuration editor available for this node type.
        </p>
      );
  }
}

function SimpleTextEditor({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
}) {
  return (
    <>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <textarea
        rows={6}
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </>
  );
}

/**
 * Merged PromptEditor — combines the old PromptTextEditor (role, template,
 * presets, inputs) with the old PromptValidatorEditor (output validation).
 */
function PromptEditor({
  config,
  updateConfig,
}: {
  config: PromptConfig;
  updateConfig: ConfigUpdater<PromptConfig>;
}) {
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [showValidator, setShowValidator] = useState<boolean>(!!config.validator);
  const entries = useMemo(() => Object.entries(config.inputs ?? {}), [config]);

  const setEntry = (key: string, value: string) => {
    updateConfig((cfg) => ({
      ...cfg,
      inputs: { ...(cfg.inputs ?? {}), [key]: value },
    }));
  };

  const removeEntry = (key: string) => {
    updateConfig((cfg) => {
      if (!cfg.inputs) return cfg;
      const next = { ...cfg.inputs };
      delete next[key];
      return { ...cfg, inputs: next };
    });
  };

  const addEntry = () => {
    const base = "variable";
    let index = 1;
    const inputs = config.inputs ?? {};
    while (inputs[`${base}${index}`]) {
      index += 1;
    }
    setEntry(`${base}${index}`, "");
  };

  const handlePresetChange = (presetId: string) => {
    setSelectedPreset(presetId);
    if (!presetId) return;
    const preset = PROMPT_TEXT_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    updateConfig((cfg) => ({
      ...cfg,
      role: preset.role,
      template: preset.template,
      inputs: { ...(preset.inputs ?? {}) },
    }));
  };

  const activePreset = PROMPT_TEXT_PRESETS.find(
    (item) => item.id === selectedPreset
  );

  const validator = config.validator;
  const validatorType = validator?.type ?? "regex";
  const validatorSpec = validator?.spec ?? "";

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Presets
        </label>
        <select
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          value={selectedPreset}
          onChange={(event) => handlePresetChange(event.target.value)}
        >
          <option value="">Select a preset…</option>
          {PROMPT_TEXT_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
        </select>
        {activePreset ? (
          <p className="text-xs text-gray-500">
            {activePreset.description}
          </p>
        ) : (
          <p className="text-xs text-gray-400">
            Choose a preset to auto-fill role, template, and suggested inputs.
          </p>
        )}
      </div>

      <label className="block text-sm font-medium text-gray-700">Role</label>
      <select
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        value={config.role ?? "system"}
        onChange={(event) =>
          updateConfig((cfg) => ({ ...cfg, role: event.target.value as any }))
        }
      >
        <option value="system">system</option>
        <option value="user">user</option>
        <option value="assistant">assistant</option>
      </select>

      <SimpleTextEditor
        value={config.template ?? ""}
        onChange={(template) => updateConfig((cfg) => ({ ...cfg, template }))}
        label="Template"
        placeholder="You are a helpful assistant. Goal: {{goal}}"
      />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            Template Inputs
          </span>
          <button
            onClick={addEntry}
            type="button"
            className="text-xs text-blue-600 hover:underline"
          >
            + Add
          </button>
        </div>
        {entries.length === 0 && (
          <p className="text-xs text-gray-500">No inputs defined.</p>
        )}
        {entries.map(([key, value]) => (
          <div key={key} className="flex gap-2">
            <input
              className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
              value={key}
              onChange={(event) => {
                const nextKey = event.target.value;
                removeEntry(key);
                setEntry(nextKey, value);
              }}
            />
            <input
              className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
              value={value}
              onChange={(event) => setEntry(key, event.target.value)}
            />
            <button
              type="button"
              onClick={() => removeEntry(key)}
              className="px-2 text-sm text-red-500 hover:underline"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      {/* Output Validator (collapsible) */}
      <div className="border-t border-gray-200 pt-3 space-y-3">
        <button
          type="button"
          onClick={() => {
            setShowValidator(!showValidator);
            if (showValidator) {
              updateConfig((cfg) => ({ ...cfg, validator: undefined }));
            }
          }}
          className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          {showValidator ? "▾" : "▸"} Output Validator
        </button>
        {showValidator && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Validator Type
            </label>
            <select
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              title="Validator type"
              value={validator ? validator.type : ""}
              onChange={(event) => {
                const value = event.target.value;
                if (!value) {
                  updateConfig((cfg) => ({ ...cfg, validator: undefined }));
                } else {
                  updateConfig((cfg) => ({
                    ...cfg,
                    validator: { type: value as "regex" | "json-schema", spec: validatorSpec },
                  }));
                }
              }}
            >
              <option value="">None</option>
              <option value="regex">Regex</option>
              <option value="json-schema">JSON Schema</option>
            </select>

            {validator && (
              <SimpleTextEditor
                value={validatorSpec}
                onChange={(specValue) =>
                  updateConfig((cfg) => ({
                    ...cfg,
                    validator: { type: validatorType, spec: specValue },
                  }))
                }
                label="Validator Spec"
                placeholder={
                  validatorType === "regex"
                    ? "^Success:.*$"
                    : '{ "type": "object", "properties": { ... } }'
                }
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ModelEditor({
  config,
  updateConfig,
}: {
  config: ModelConfig;
  updateConfig: ConfigUpdater<ModelConfig>;
}) {
  const provider = config.provider;

  // Detect locally-running models from the browser
  const { ollamaModels, lmstudioModels } = useLocalModels();

  const providerModels = useMemo(() => {
    if (provider === "ollama") {
      const detected = detectedToMetadata(ollamaModels);
      return mergeLocalModels("ollama", detected);
    }
    if (provider === "lmstudio") {
      const detected = detectedToMetadata(lmstudioModels);
      return mergeLocalModels("lmstudio", detected);
    }
    return listModelsByProvider(provider);
  }, [provider, ollamaModels, lmstudioModels]);

  const selectedModelId =
    provider === "bedrock" ? config.modelId ?? "" : config.model ?? "";

  const selectedMetadata = useMemo(() => {
    if (!selectedModelId) return undefined;
    return getModelFromCatalogOrDetected(selectedModelId, providerModels);
  }, [selectedModelId, providerModels]);

  const defaultTemperature =
    selectedMetadata?.defaultConfig.temperature ??
    (provider === "bedrock" ? 0.2 : 0.4);
  const defaultTopP =
    selectedMetadata?.defaultConfig.topP ?? (provider === "bedrock" ? 0.9 : 0.9);

  const errorMessages = useMemo(() => {
    const errors: string[] = [];
    if (provider === "bedrock") {
      if (!config.modelId) {
        errors.push("Select a Bedrock model ID.");
      }
    } else if (provider === "ollama") {
      if (!config.model) {
        errors.push("Select or enter an Ollama model name.");
      }
      if (!config.endpoint) {
        errors.push("Provide the Ollama endpoint (e.g., http://localhost:11434).");
      }
    }
    return errors;
  }, [provider, config]);

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-700">
        Provider
      </label>
      <select
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        value={provider}
        onChange={(event) => {
          const nextProvider = event.target.value as ModelConfig["provider"];
          if (nextProvider === "bedrock") {
            const [first] = listModelsByProvider("bedrock");
            updateConfig(() => ({
              provider: "bedrock",
              modelId: first?.id ?? "anthropic.claude-3-5-sonnet-20241022",
              temperature: first?.defaultConfig.temperature ?? 0.2,
              topP: first?.defaultConfig.topP ?? 0.9,
              maxTokens: first?.defaultConfig.maxTokens ?? 4096,
            }));
          } else if (nextProvider === "ollama") {
            const [first] = listModelsByProvider("ollama");
            updateConfig(() => ({
              provider: "ollama",
              model: first?.id ?? "llama3.1",
              endpoint: first?.defaultConfig.endpoint ?? LOCAL_MODEL_ENDPOINTS.ollama,
              temperature: first?.defaultConfig.temperature ?? 0.4,
              topP: first?.defaultConfig.topP ?? 0.9,
              numCtx: first?.defaultConfig.numCtx ?? 8192,
            }));
          } else {
            const [first] = listModelsByProvider("lmstudio");
            updateConfig(() => ({
              provider: "lmstudio",
              model: first?.id ?? "lmstudio-default",
              endpoint: first?.defaultConfig.endpoint ?? LOCAL_MODEL_ENDPOINTS.lmstudio,
              temperature: first?.defaultConfig.temperature ?? 0.4,
              topP: first?.defaultConfig.topP ?? 0.9,
              maxTokens: first?.defaultConfig.maxTokens ?? 4096,
            }));
          }
        }}
      >
        <option value="bedrock">AWS Bedrock</option>
        <option value="ollama">Ollama (Local)</option>
        <option value="lmstudio">LMStudio (Local)</option>
      </select>

      {provider === "bedrock" && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            Bedrock Model
          </label>
          <select
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            value={selectedModelId}
            onChange={(event) => {
              const nextId = event.target.value;
              const metadata = getModelMetadata(nextId);
              updateConfig((cfg: any) => ({
                ...cfg,
                modelId: nextId,
                temperature: metadata?.defaultConfig.temperature ?? cfg.temperature ?? 0.2,
                topP: metadata?.defaultConfig.topP ?? cfg.topP ?? 0.9,
                maxTokens: metadata?.defaultConfig.maxTokens ?? cfg.maxTokens ?? 4096,
              }));
            }}
          >
            <option value="">Select a model...</option>
            {providerModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
                {model.recommended ? " (recommended)" : ""}
              </option>
            ))}
          </select>

          <label className="block text-sm font-medium text-gray-700">
            Model ID
          </label>
          <input
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            value={config.modelId ?? ""}
            onChange={(event) =>
              updateConfig((cfg: any) => ({ ...cfg, modelId: event.target.value }))
            }
            placeholder="anthropic.claude-3-5-sonnet-20241022"
          />

          <ParameterSlider
            label="Temperature"
            value={config.temperature ?? defaultTemperature}
            onChange={(value) =>
              updateConfig((cfg: any) => ({ ...cfg, temperature: value }))
            }
          />
          <ParameterSlider
            label="topP"
            value={config.topP ?? defaultTopP}
            onChange={(value) =>
              updateConfig((cfg: any) => ({ ...cfg, topP: value }))
            }
          />
          <ParameterInput
            label="Max Tokens"
            value={config.maxTokens ?? 0}
            onChange={(value) =>
              updateConfig((cfg: any) => ({ ...cfg, maxTokens: value }))
            }
          />
        </div>
      )}

      {provider === "ollama" && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            Ollama Model
          </label>
          <select
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            value={selectedModelId}
            onChange={(event) => {
              const nextId = event.target.value;
              const metadata = getModelMetadata(nextId);
              updateConfig((cfg: any) => ({
                ...cfg,
                model: nextId,
                temperature:
                  metadata?.defaultConfig.temperature ?? cfg.temperature ?? 0.4,
                topP: metadata?.defaultConfig.topP ?? cfg.topP ?? 0.9,
                numCtx: metadata?.defaultConfig.numCtx ?? cfg.numCtx ?? 8192,
                endpoint:
                  metadata?.defaultConfig.endpoint ?? cfg.endpoint ?? LOCAL_MODEL_ENDPOINTS.ollama,
              }));
            }}
          >
            <option value="">Select a model...</option>
            {providerModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
                {model.recommended ? " (recommended)" : ""}
              </option>
            ))}
          </select>

          <label className="block text-sm font-medium text-gray-700">
            Model
          </label>
          <input
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            value={(config as any).model ?? ""}
            onChange={(event) =>
              updateConfig((cfg: any) => ({ ...cfg, model: event.target.value }))
            }
          />
          <label className="block text-sm font-medium text-gray-700">
            Endpoint
          </label>
          <input
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            value={(config as any).endpoint ?? ""}
            onChange={(event) =>
              updateConfig((cfg: any) => ({ ...cfg, endpoint: event.target.value }))
            }
          />
          <ParameterSlider
            label="Temperature"
            value={config.temperature ?? defaultTemperature}
            onChange={(value) =>
              updateConfig((cfg: any) => ({ ...cfg, temperature: value }))
            }
          />
          <ParameterSlider
            label="topP"
            value={config.topP ?? defaultTopP}
            onChange={(value) =>
              updateConfig((cfg: any) => ({ ...cfg, topP: value }))
            }
          />
          <ParameterInput
            label="Context Window (numCtx)"
            value={(config as any).numCtx ?? selectedMetadata?.defaultConfig.numCtx ?? 8192}
            onChange={(value) =>
              updateConfig((cfg: any) => ({ ...cfg, numCtx: value }))
            }
          />
        </div>
      )}

      {provider === "lmstudio" && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            LMStudio Model
          </label>
          <select
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            value={selectedModelId}
            onChange={(event) => {
              const nextId = event.target.value;
              const metadata = getModelMetadata(nextId);
              updateConfig((cfg: any) => ({
                ...cfg,
                model: nextId,
                temperature:
                  metadata?.defaultConfig.temperature ?? cfg.temperature ?? 0.4,
                topP: metadata?.defaultConfig.topP ?? cfg.topP ?? 0.9,
                maxTokens: metadata?.defaultConfig.maxTokens ?? cfg.maxTokens ?? 4096,
                endpoint:
                  metadata?.defaultConfig.endpoint ?? cfg.endpoint ?? LOCAL_MODEL_ENDPOINTS.lmstudio,
              }));
            }}
          >
            <option value="">Select a model...</option>
            {providerModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
                {model.recommended ? " (recommended)" : ""}
              </option>
            ))}
          </select>

          <label className="block text-sm font-medium text-gray-700">
            Endpoint
          </label>
          <input
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            value={(config as any).endpoint ?? LOCAL_MODEL_ENDPOINTS.lmstudio}
            onChange={(event) =>
              updateConfig((cfg: any) => ({ ...cfg, endpoint: event.target.value }))
            }
          />
          <ParameterSlider
            label="Temperature"
            value={config.temperature ?? defaultTemperature}
            onChange={(value) =>
              updateConfig((cfg: any) => ({ ...cfg, temperature: value }))
            }
          />
          <ParameterSlider
            label="topP"
            value={config.topP ?? defaultTopP}
            onChange={(value) =>
              updateConfig((cfg: any) => ({ ...cfg, topP: value }))
            }
          />
          <ParameterInput
            label="Max Tokens"
            value={(config as any).maxTokens ?? 4096}
            onChange={(value) =>
              updateConfig((cfg: any) => ({ ...cfg, maxTokens: value }))
            }
          />
        </div>
      )}

      {selectedMetadata && (
        <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 space-y-1">
          <p className="font-semibold text-gray-700">{selectedMetadata.label}</p>
          <p>{selectedMetadata.description}</p>
          {selectedMetadata.tags && (
            <p className="text-gray-500">
              Tags: {selectedMetadata.tags.join(", ")}
            </p>
          )}
          {selectedMetadata.contextLength && (
            <p className="text-gray-500">
              Context: {selectedMetadata.contextLength.toLocaleString()} tokens
            </p>
          )}
        </div>
      )}

      {errorMessages.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 space-y-1">
          {errorMessages.map((message, index) => (
            <p key={index}>{message}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function ParameterSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">
        {label}: <span className="text-gray-500">{value}</span>
      </label>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full"
      />
    </div>
  );
}

function ParameterInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <input
        type="number"
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

function ModelSetEditor({
  config,
  updateConfig,
}: {
  config: ModelSetConfig;
  updateConfig: ConfigUpdater<ModelSetConfig>;
}) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Strategy
      </label>
      <select
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        value={config.strategy}
        onChange={(event) =>
          updateConfig((cfg) => ({
            ...cfg,
            strategy: event.target.value as ModelSetConfig["strategy"],
          }))
        }
      >
        <option value="single">Single</option>
        <option value="router">Router (coming soon)</option>
        <option value="ensemble-self-consistency">
          Ensemble Self-Consistency (coming soon)
        </option>
        <option value="ensemble-map-reduce">
          Ensemble Map-Reduce (coming soon)
        </option>
      </select>

      <label className="block text-sm font-medium text-gray-700">
        Primary Model Node ID
      </label>
      <input
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        value={config.primary ?? ""}
        onChange={(event) =>
          updateConfig((cfg) => ({ ...cfg, primary: event.target.value }))
        }
        placeholder="model-node-id"
      />

      <label className="block text-sm font-medium text-gray-700">
        Router Prompt Node ID
      </label>
      <input
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        value={config.routerPromptId ?? ""}
        onChange={(event) =>
          updateConfig((cfg) => ({ ...cfg, routerPromptId: event.target.value }))
        }
        placeholder="prompt-text-node-id"
      />

      <ParameterInput
        label="k (samples / votes)"
        value={config.k ?? 0}
        onChange={(value) => updateConfig((cfg) => ({ ...cfg, k: value }))}
      />
    </div>
  );
}

function ToolEditor({
  config,
  updateConfig,
}: {
  config: ToolConfig;
  updateConfig: ConfigUpdater<ToolConfig>;
}) {
  const kind = config.kind;

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-700">Kind</label>
      <select
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        value={kind}
        onChange={(event) => {
          const nextKind = event.target.value as ToolConfig["kind"];
          if (nextKind === "mcp") {
            updateConfig(() => ({
              kind: "mcp",
              server: "",
              tool: "",
              params: {},
            }));
          } else if (nextKind === "openapi") {
            updateConfig(() => ({
              kind: "openapi",
              specUri: "",
              opId: "",
            }));
          } else {
            updateConfig(() => ({
              kind: "internal",
              name: "",
              args: {},
            }));
          }
        }}
      >
        <option value="mcp">MCP Tool</option>
        <option value="openapi">OpenAPI (AgentCore Action)</option>
        <option value="internal">Internal (@tool)</option>
      </select>

      {kind === "mcp" && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            MCP Server
          </label>
          <input
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            value={config.server}
            onChange={(event) =>
              updateConfig((cfg: any) => ({ ...cfg, server: event.target.value }))
            }
          />
          <label className="block text-sm font-medium text-gray-700">Tool</label>
          <input
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            value={config.tool}
            onChange={(event) =>
              updateConfig((cfg: any) => ({ ...cfg, tool: event.target.value }))
            }
          />
        </div>
      )}

      {kind === "openapi" && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            OpenAPI Spec URI
          </label>
          <input
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            value={config.specUri}
            onChange={(event) =>
              updateConfig((cfg: any) => ({ ...cfg, specUri: event.target.value }))
            }
          />
          <label className="block text-sm font-medium text-gray-700">
            Operation ID
          </label>
          <input
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            value={config.opId}
            onChange={(event) =>
              updateConfig((cfg: any) => ({ ...cfg, opId: event.target.value }))
            }
          />
        </div>
      )}

      {kind === "internal" && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            Tool Name
          </label>
          <input
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            value={config.name}
            onChange={(event) =>
              updateConfig((cfg: any) => ({ ...cfg, name: event.target.value }))
            }
          />
        </div>
      )}
    </div>
  );
}

function ToolSetEditor({
  config,
  updateConfig,
}: {
  config: ToolSetConfig;
  updateConfig: ConfigUpdater<ToolSetConfig>;
}) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Allowed Tool IDs (comma separated)
      </label>
      <input
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        value={(config.allowList ?? []).join(", ")}
        onChange={(event) =>
          updateConfig((cfg) => ({
            ...cfg,
            allowList: event.target.value
              .split(",")
              .map((token) => token.trim())
              .filter(Boolean),
          }))
        }
        placeholder="tool-node-id-1, tool-node-id-2"
      />

      <ParameterInput
        label="Max Parallel Calls"
        value={config.maxParallel ?? 1}
        onChange={(value) => updateConfig((cfg) => ({ ...cfg, maxParallel: value }))}
      />

      <label className="block text-sm font-medium text-gray-700">
        Call Policy
      </label>
      <select
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        value={config.callPolicy ?? "model-first"}
        onChange={(event) =>
          updateConfig((cfg) => ({
            ...cfg,
            callPolicy: event.target.value as ToolSetConfig["callPolicy"],
          }))
        }
      >
        <option value="model-first">Model First</option>
        <option value="tool-first">Tool First</option>
        <option value="interleave">Interleave</option>
      </select>
    </div>
  );
}

function EntrypointEditor({
  config,
  updateConfig,
}: {
  config: EntrypointConfig;
  updateConfig: ConfigUpdater<EntrypointConfig>;
}) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">Runtime</label>
      <select
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        value={config.runtime}
        onChange={(event) =>
          updateConfig((cfg) => ({
            ...cfg,
            runtime: event.target.value as EntrypointConfig["runtime"],
          }))
        }
      >
        <option value="http">HTTP</option>
        <option value="cli">CLI</option>
        <option value="lambda">Lambda</option>
      </select>

      <label className="block text-sm font-medium text-gray-700">Path</label>
      <input
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        value={config.path ?? ""}
        onChange={(event) =>
          updateConfig((cfg) => ({ ...cfg, path: event.target.value }))
        }
      />

      <label className="block text-sm font-medium text-gray-700">
        Input Schema File
      </label>
      <input
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        value={config.inputSchema ?? ""}
        onChange={(event) =>
          updateConfig((cfg) => ({ ...cfg, inputSchema: event.target.value }))
        }
        placeholder="./schemas/input.json"
      />

      <label className="block text-sm font-medium text-gray-700">
        Output Schema File
      </label>
      <input
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        value={config.outputSchema ?? ""}
        onChange={(event) =>
          updateConfig((cfg) => ({ ...cfg, outputSchema: event.target.value }))
        }
        placeholder="./schemas/output.json"
      />

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={config.streaming ?? false}
          onChange={(event) =>
            updateConfig((cfg) => ({ ...cfg, streaming: event.target.checked }))
          }
        />
        Stream responses
      </label>
    </div>
  );
}

function MemoryEditor({
  config,
  updateConfig,
}: {
  config: MemoryConfig;
  updateConfig: ConfigUpdater<MemoryConfig>;
}) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Memory Source
      </label>
      <select
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        value={config.source}
        onChange={(event) =>
          updateConfig((cfg) => ({
            ...cfg,
            source: event.target.value as MemoryConfig["source"],
          }))
        }
      >
        <option value="convex">Convex</option>
        <option value="s3">AWS S3</option>
        <option value="vector_db">Vector DB</option>
      </select>

      <label className="block text-sm font-medium text-gray-700">Index</label>
      <input
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        value={config.index ?? ""}
        onChange={(event) =>
          updateConfig((cfg) => ({ ...cfg, index: event.target.value }))
        }
      />

      <ParameterInput
        label="topK"
        value={config.topK ?? 5}
        onChange={(value) => updateConfig((cfg) => ({ ...cfg, topK: value }))}
      />
    </div>
  );
}

function RouterEditor({
  config,
  updateConfig,
}: {
  config: RouterConfig;
  updateConfig: ConfigUpdater<RouterConfig>;
}) {
  const addCondition = () => {
    updateConfig((cfg) => ({
      ...cfg,
      conditions: [
        ...(cfg.conditions || []),
        { type: "if", expression: "", thenNode: "" },
      ],
    }));
  };

  const updateCondition = (index: number, updates: Partial<RouterConfig["conditions"][number]>) => {
    updateConfig((cfg) => {
      const next = [...(cfg.conditions || [])];
      next[index] = { ...next[index], ...updates };
      return { ...cfg, conditions: next };
    });
  };

  const removeCondition = (index: number) => {
    updateConfig((cfg) => {
      const next = [...(cfg.conditions || [])];
      next.splice(index, 1);
      return { ...cfg, conditions: next };
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Conditions
        </label>
        <button
          type="button"
          onClick={addCondition}
          className="text-xs text-blue-600 hover:underline"
        >
          + Add
        </button>
      </div>
      {(config.conditions || []).length === 0 && (
        <p className="text-xs text-gray-500">No conditions defined.</p>
      )}
      {(config.conditions || []).map((condition, index) => (
        <div
          key={index}
          className="border border-gray-200 rounded p-3 space-y-2 text-sm"
        >
          <select
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            value={condition.type}
            onChange={(event) =>
              updateCondition(index, {
                type: event.target.value as RouterConfig["conditions"][number]["type"],
              })
            }
          >
            <option value="if">If / Else</option>
            <option value="retry">Retry</option>
            <option value="fallback">Fallback</option>
          </select>

          <input
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            value={condition.expression}
            onChange={(event) =>
              updateCondition(index, { expression: event.target.value })
            }
            placeholder="context.toolResult == null"
          />

          <input
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            value={condition.thenNode}
            onChange={(event) =>
              updateCondition(index, { thenNode: event.target.value })
            }
            placeholder="node-id-if-true"
          />

          {condition.type === "if" && (
            <input
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              value={condition.elseNode ?? ""}
              onChange={(event) =>
                updateCondition(index, { elseNode: event.target.value })
              }
              placeholder="node-id-if-false"
            />
          )}

          <button
            type="button"
            onClick={() => removeCondition(index)}
            className="text-xs text-red-500 hover:underline"
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}

const AGENT_EXECUTION_MODES: { value: AgentExecutionMode; label: string; description: string }[] = [
  { value: "direct", label: "Direct", description: "Execute a single agent directly." },
  { value: "swarm", label: "Swarm", description: "Parallel multi-agent execution. Connect SubAgent nodes." },
  { value: "graph", label: "Graph", description: "Dependency-based execution graph. Connect SubAgent nodes." },
  { value: "workflow", label: "Workflow", description: "Sequential pipeline. Connect SubAgent nodes." },
];

function AgentEditor({
  config,
  updateConfig,
}: {
  config: AgentConfig;
  updateConfig: ConfigUpdater<AgentConfig>;
}) {
  const mode = config.executionMode ?? "direct";
  const activeMode = AGENT_EXECUTION_MODES.find((m) => m.value === mode);

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-700">
        Agent ID
      </label>
      <input
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        value={config.agentId ?? ""}
        onChange={(event) =>
          updateConfig((cfg) => ({ ...cfg, agentId: event.target.value }))
        }
        placeholder="Select an agent from your library (paste agent ID)"
      />
      <p className="text-xs text-gray-400">
        Paste the ID of an agent created in the Agent Builder.
      </p>

      <label className="block text-sm font-medium text-gray-700">
        Execution Mode
      </label>
      <select
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        title="Agent execution mode"
        value={mode}
        onChange={(event) =>
          updateConfig((cfg) => ({
            ...cfg,
            executionMode: event.target.value as AgentExecutionMode,
          }))
        }
      >
        {AGENT_EXECUTION_MODES.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
      {activeMode && (
        <p className="text-xs text-gray-500">{activeMode.description}</p>
      )}

      {!config.agentId && (
        <div className="border-t border-gray-200 pt-3 space-y-3">
          <p className="text-xs font-medium text-gray-600">
            Inline Config (used when no Agent ID is set)
          </p>

          <label className="block text-sm font-medium text-gray-700">
            Name
          </label>
          <input
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            value={config.name ?? ""}
            onChange={(event) =>
              updateConfig((cfg) => ({ ...cfg, name: event.target.value }))
            }
            placeholder="Agent name"
          />

          <label className="block text-sm font-medium text-gray-700">
            System Prompt
          </label>
          <textarea
            rows={4}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            value={config.systemPrompt ?? ""}
            onChange={(event) =>
              updateConfig((cfg) => ({ ...cfg, systemPrompt: event.target.value }))
            }
            placeholder="You are a helpful assistant..."
          />

          <label className="block text-sm font-medium text-gray-700">
            Model
          </label>
          <input
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            value={config.model ?? ""}
            onChange={(event) =>
              updateConfig((cfg) => ({ ...cfg, model: event.target.value }))
            }
            placeholder="Model ID (e.g. from agent library)"
          />

          <label className="block text-sm font-medium text-gray-700">
            Model Provider
          </label>
          <select
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            title="Model provider"
            value={config.modelProvider ?? "bedrock"}
            onChange={(event) =>
              updateConfig((cfg) => ({ ...cfg, modelProvider: event.target.value }))
            }
          >
            <option value="bedrock">AWS Bedrock</option>
            <option value="ollama">Ollama</option>
            <option value="lmstudio">LMStudio</option>
          </select>
        </div>
      )}
    </div>
  );
}

function SubAgentEditor({
  config,
  updateConfig,
}: {
  config: SubAgentConfig;
  updateConfig: ConfigUpdater<SubAgentConfig>;
}) {
  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-700">
        Agent ID
      </label>
      <input
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        value={config.agentId ?? ""}
        onChange={(event) =>
          updateConfig((cfg) => ({ ...cfg, agentId: event.target.value }))
        }
        placeholder="Paste the ID of a child agent"
      />
      <p className="text-xs text-gray-400">
        This sub-agent will be coordinated by the parent Agent node.
      </p>

      <label className="block text-sm font-medium text-gray-700">
        Role
      </label>
      <input
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        value={config.role ?? ""}
        onChange={(event) =>
          updateConfig((cfg) => ({ ...cfg, role: event.target.value }))
        }
        placeholder="e.g. researcher, writer, reviewer"
      />

      <label className="block text-sm font-medium text-gray-700">
        Communication Protocol
      </label>
      <select
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        title="Communication protocol"
        value={config.communicationProtocol ?? "hierarchical"}
        onChange={(event) =>
          updateConfig((cfg) => ({
            ...cfg,
            communicationProtocol: event.target.value as SubAgentConfig["communicationProtocol"],
          }))
        }
      >
        <option value="hierarchical">Hierarchical</option>
        <option value="broadcast">Broadcast</option>
        <option value="a2a">Agent-to-Agent (A2A)</option>
      </select>
    </div>
  );
}
