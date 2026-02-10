import { useState, useEffect, useCallback, useRef } from "react";
import { LOCAL_MODEL_ENDPOINTS, type ModelMetadata } from "../data/modelCatalog";

/** Shape returned by Ollama GET /api/tags */
interface OllamaTagsResponse {
  models: Array<{
    name: string;
    size: number;
    modified_at: string;
    details?: { parameter_size?: string; family?: string };
  }>;
}

/** Shape returned by LMStudio GET /v1/models (OpenAI-compatible) */
interface LMStudioModelsResponse {
  data: Array<{
    id: string;
    object: string;
    owned_by?: string;
  }>;
}

export interface DetectedModel {
  id: string;
  label: string;
  provider: "ollama" | "lmstudio";
  size?: number;
  family?: string;
  parameterSize?: string;
}

export interface LocalModelsState {
  ollamaRunning: boolean;
  lmstudioRunning: boolean;
  ollamaModels: DetectedModel[];
  lmstudioModels: DetectedModel[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Browser-side local model detection hook.
 *
 * Polls Ollama (http://localhost:11434/api/tags) and LMStudio
 * (http://localhost:1234/v1/models) directly from the browser.
 * Ollama enables CORS by default; LMStudio does as well.
 */
export function useLocalModels(): LocalModelsState {
  const [ollamaRunning, setOllamaRunning] = useState(false);
  const [lmstudioRunning, setLmstudioRunning] = useState(false);
  const [ollamaModels, setOllamaModels] = useState<DetectedModel[]>([]);
  const [lmstudioModels, setLmstudioModels] = useState<DetectedModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const detect = useCallback(async () => {
    setLoading(true);
    setError(null);

    const results = await Promise.allSettled([
      detectOllama(),
      detectLMStudio(),
    ]);

    if (!mountedRef.current) return;

    // Ollama
    if (results[0].status === "fulfilled" && results[0].value) {
      setOllamaRunning(true);
      setOllamaModels(results[0].value);
    } else {
      setOllamaRunning(false);
      setOllamaModels([]);
    }

    // LMStudio
    if (results[1].status === "fulfilled" && results[1].value) {
      setLmstudioRunning(true);
      setLmstudioModels(results[1].value);
    } else {
      setLmstudioRunning(false);
      setLmstudioModels([]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    detect();
    return () => {
      mountedRef.current = false;
    };
  }, [detect]);

  return {
    ollamaRunning,
    lmstudioRunning,
    ollamaModels,
    lmstudioModels,
    loading,
    error,
    refresh: detect,
  };
}

/** Fetch installed Ollama models via /api/tags */
async function detectOllama(): Promise<DetectedModel[] | null> {
  try {
    const response = await fetch(
      `${LOCAL_MODEL_ENDPOINTS.ollama}/api/tags`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!response.ok) return null;

    const data: OllamaTagsResponse = await response.json();
    return (data.models ?? []).map((m) => ({
      id: m.name,
      label: m.name,
      provider: "ollama" as const,
      size: m.size,
      family: m.details?.family,
      parameterSize: m.details?.parameter_size,
    }));
  } catch {
    return null;
  }
}

/** Fetch loaded LMStudio models via /v1/models (OpenAI-compatible) */
async function detectLMStudio(): Promise<DetectedModel[] | null> {
  try {
    const response = await fetch(
      `${LOCAL_MODEL_ENDPOINTS.lmstudio}/v1/models`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!response.ok) return null;

    const data: LMStudioModelsResponse = await response.json();
    return (data.data ?? []).map((m) => ({
      id: m.id,
      label: m.id,
      provider: "lmstudio" as const,
    }));
  } catch {
    return null;
  }
}

/**
 * Convert detected models into ModelMetadata entries for the catalog.
 * Uses sensible defaults for config; the user can override in the UI.
 */
export function detectedToMetadata(
  detected: DetectedModel[]
): ModelMetadata[] {
  return detected.map((d) => ({
    id: d.id,
    label: d.label,
    description:
      d.provider === "ollama"
        ? `Detected on local Ollama${d.parameterSize ? ` (${d.parameterSize})` : ""}`
        : `Loaded in LMStudio`,
    provider: d.provider,
    family: d.family ?? (d.provider === "ollama" ? "Ollama" : "LMStudio"),
    contextLength: 8000,
    defaultConfig: {
      temperature: 0.4,
      topP: 0.9,
      ...(d.provider === "ollama"
        ? {
            numCtx: 8192,
            endpoint: LOCAL_MODEL_ENDPOINTS.ollama,
          }
        : {
            maxTokens: 4096,
            endpoint: LOCAL_MODEL_ENDPOINTS.lmstudio,
          }),
    },
    tags: ["local", "detected"],
  }));
}
