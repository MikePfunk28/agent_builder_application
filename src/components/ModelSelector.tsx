import { useState } from "react";
import { ChevronDown, Info } from "lucide-react";

interface ModelSelectorProps {
  value: string;
  onChange: (model: string) => void;
}

interface Model {
  id: string;
  name: string;
  description: string;
  provider: string;
  recommended?: boolean;
  capabilities?: string[];
  size?: string;
  performanceScore?: number;
}

const models: Model[] = [
  // AWS Bedrock - Claude Models (Latest First)
  {
    id: "anthropic.claude-sonnet-4-5-20250929-v1:0",
    name: "Claude 4.5 Sonnet",
    description: "Latest and most capable Claude model with advanced reasoning",
    provider: "AWS Bedrock",
    recommended: true,
    capabilities: ["reasoning", "coding", "analysis", "creative"],
    size: "405B",
    performanceScore: 98,
  },
  {
    id: "us.anthropic.claude-haiku-4-5-20250514-v1:0",
    name: "Claude 4.5 Haiku",
    description: "Latest fast Claude model with reasoning - perfect for thinking agents and tool creation",
    provider: "AWS Bedrock",
    recommended: true,
    capabilities: ["reasoning", "coding", "analysis", "fast"],
    size: "70B",
    performanceScore: 92,
  },
  {
    id: "anthropic.claude-opus-4-1-20250805-v1:0",
    name: "Claude 4.1 Opus",
    description: "Maximum performance for complex tasks",
    provider: "AWS Bedrock",
    capabilities: ["reasoning", "coding", "analysis", "creative", "research"],
    size: "200B",
    performanceScore: 99,
  },
  {
    id: "anthropic.claude-opus-4-20250514-v1:0",
    name: "Claude 4.0 Opus",
    description: "Enterprise-grade performance",
    provider: "AWS Bedrock",
    capabilities: ["reasoning", "coding", "creative", "analysis"],
    size: "400B",
    performanceScore: 94,
  },
  {
    id: "anthropic.claude-sonnet-4-20250514-v1:0",
    name: "Claude 4.0 Sonnet",
    description: "Balanced performance and efficiency",
    provider: "AWS Bedrock",
    capabilities: ["reasoning", "coding", "creative", "analysis"],
    size: "400B",
    performanceScore: 94,
  },
  {
    id: "anthropic.claude-3-7-sonnet-20250219-v1:0",
    name: "Claude 3.7 Sonnet",
    description: "Enhanced Claude 3 with improved capabilities",
    provider: "AWS Bedrock",
    capabilities: ["reasoning", "coding", "analysis", "creative"],
    size: "70B",
    performanceScore: 96,
  },
  {
    id: "anthropic.claude-3-5-sonnet-20240620-v1:0",
    name: "Claude 3.5 Sonnet",
    description: "Fast and capable for most tasks",
    provider: "AWS Bedrock",
    capabilities: ["reasoning", "coding", "analysis", "creative"],
    size: "70B",
    performanceScore: 95,
  },
  {
    id: "anthropic.claude-3-5-haiku-20241022-v1:0",
    name: "Claude 3.5 Haiku",
    description: "Fast and efficient for general tasks",
    provider: "AWS Bedrock",
    capabilities: ["reasoning", "coding", "analysis"],
    size: "15B",
    performanceScore: 88,
  },
  {
    id: "anthropic.claude-3-haiku-20240307-v1:0",
    name: "Claude 3 Haiku",
    description: "Quick responses for simple tasks",
    provider: "AWS Bedrock",
    capabilities: ["reasoning", "coding", "analysis"],
    size: "15B",
    performanceScore: 88,
  },
  
  // AWS Bedrock - Nova Models
  {
    id: "amazon.nova-premier-v1:0",
    name: "Amazon Nova Premier",
    description: "Top-tier Amazon model for complex reasoning",
    provider: "AWS Bedrock",
    recommended: true,
    capabilities: ["reasoning", "coding", "analysis"],
    performanceScore: 95,
  },
  {
    id: "amazon.nova-pro-v1:0",
    name: "Amazon Nova Pro",
    description: "Professional-grade model for business use",
    provider: "AWS Bedrock",
    capabilities: ["reasoning", "coding", "analysis"],
    performanceScore: 90,
  },
  {
    id: "amazon.nova-lite-v1:0",
    name: "Amazon Nova Lite",
    description: "Lightweight and cost-effective",
    provider: "AWS Bedrock",
    capabilities: ["reasoning", "basic tasks"],
    performanceScore: 75,
  },
  {
    id: "amazon.nova-micro-v1:0",
    name: "Amazon Nova Micro",
    description: "Ultra-light for simple queries",
    provider: "AWS Bedrock",
    capabilities: ["basic tasks"],
    performanceScore: 60,
  },
  {
    id: "amazon.nova-canvas-v1:0",
    name: "Amazon Nova Canvas",
    description: "Image generation model",
    provider: "AWS Bedrock",
    capabilities: ["image generation"],
    performanceScore: 85,
  },
  {
    id: "amazon.nova-reel-v1:0",
    name: "Amazon Nova Reel",
    description: "Video generation model",
    provider: "AWS Bedrock",
    capabilities: ["video generation"],
    performanceScore: 85,
  },
  {
    id: "amazon.titan-image-generator-v2:0",
    name: "Amazon Titan Image Gen V2",
    description: "Advanced image generation",
    provider: "AWS Bedrock",
    capabilities: ["image generation"],
    performanceScore: 82,
  },

  // Ollama - Qwen Models
  {
    id: "qwen3:8b",
    name: "Qwen3 8B",
    description: "Balanced local model for coding and analysis",
    provider: "Ollama",
    recommended: true,
    capabilities: ["reasoning", "coding", "analysis"],
    size: "8B",
    performanceScore: 75,
  },
  {
    id: "qwen3:4b",
    name: "Qwen3 4B",
    description: "Lightweight local model",
    provider: "Ollama",
    recommended: true,
    capabilities: ["basic reasoning", "simple tasks"],
    size: "4B",
    performanceScore: 60,
  },
  {
    id: "qwen3:14b",
    name: "Qwen3 14B",
    description: "Advanced local model for complex tasks",
    provider: "Ollama",
    capabilities: ["reasoning", "coding", "analysis", "creative"],
    size: "14B",
    performanceScore: 85,
  },
  {
    id: "qwen3:30b",
    name: "Qwen3 30B",
    description: "High-performance local model",
    provider: "Ollama",
    capabilities: ["reasoning", "coding", "analysis", "creative", "research"],
    size: "30B",
    performanceScore: 95,
  },

  // Ollama - Llama Models
  {
    id: "llama3.3",
    name: "Llama 3.3",
    description: "Latest Meta Llama model",
    provider: "Ollama",
    capabilities: ["reasoning", "coding", "analysis"],
    performanceScore: 80,
  },
  {
    id: "llama3.1:8b",
    name: "Llama 3.1 8B",
    description: "Efficient Meta model",
    provider: "Ollama",
    capabilities: ["reasoning", "coding", "analysis"],
    size: "8B",
    performanceScore: 75,
  },
  {
    id: "llama3.2:3b",
    name: "Llama 3.2 3B",
    description: "Compact Meta model",
    provider: "Ollama",
    capabilities: ["basic reasoning", "simple tasks"],
    size: "3B",
    performanceScore: 55,
  },
  {
    id: "llama3.2-vision:11b",
    name: "Llama 3.2 Vision 11B",
    description: "Vision-capable Llama model",
    provider: "Ollama",
    capabilities: ["reasoning", "vision", "analysis"],
    size: "11B",
    performanceScore: 80,
  },

  // Ollama - Other Models
  {
    id: "deepseek-r1:8b",
    name: "DeepSeek R1 8B",
    description: "Reasoning-focused coding model",
    provider: "Ollama",
    capabilities: ["coding", "reasoning", "mathematics"],
    size: "8B",
    performanceScore: 80,
  },
  {
    id: "deepseek-coder:6.7b",
    name: "DeepSeek Coder 6.7B",
    description: "Specialized coding model",
    provider: "Ollama",
    capabilities: ["coding", "mathematics"],
    size: "6.7B",
    performanceScore: 82,
  },
  {
    id: "phi4:14b",
    name: "Phi-4 14B",
    description: "Microsoft's reasoning model",
    provider: "Ollama",
    capabilities: ["reasoning", "coding", "mathematics"],
    size: "14B",
    performanceScore: 88,
  },
  {
    id: "gemma3:12b",
    name: "Gemma3 12B",
    description: "Google's open model",
    provider: "Ollama",
    capabilities: ["reasoning", "coding", "analysis"],
    size: "12B",
    performanceScore: 85,
  },
  {
    id: "mistral-nemo",
    name: "Mistral Nemo",
    description: "Mistral's efficient model",
    provider: "Ollama",
    capabilities: ["reasoning", "coding", "creative"],
    size: "12B",
    performanceScore: 82,
  },

  // OpenAI Models
  {
    id: "gpt-4-turbo",
    name: "GPT-4 Turbo",
    description: "OpenAI's most capable model",
    provider: "OpenAI",
    capabilities: ["reasoning", "coding", "analysis", "creative"],
    performanceScore: 96,
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    description: "Multimodal GPT-4 optimized",
    provider: "OpenAI",
    capabilities: ["reasoning", "coding", "vision", "audio"],
    performanceScore: 94,
  },
  {
    id: "gpt-3.5-turbo",
    name: "GPT-3.5 Turbo",
    description: "Fast and cost-effective",
    provider: "OpenAI",
    capabilities: ["reasoning", "coding"],
    performanceScore: 80,
  },
];

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const [selectedProvider, setSelectedProvider] = useState<string>("All");
  const [searchTerm, setSearchTerm] = useState("");

  // Get unique providers
  const providers = ["All", ...Array.from(new Set(models.map(m => m.provider)))];

  // Filter models
  const filteredModels = models.filter(model => {
    const matchesProvider = selectedProvider === "All" || model.provider === selectedProvider;
    const matchesSearch = searchTerm === "" || 
      model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      model.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesProvider && matchesSearch;
  });

  // Get selected model details
  const selectedModel = models.find(m => m.id === value);

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-green-400">
        Model Selection
      </label>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search models..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-3 py-2 bg-black border border-green-900/30 rounded-lg text-green-400 placeholder-green-600 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition-colors"
        />
      </div>

      {/* Provider Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {providers.map(provider => (
          <button
            key={provider}
            onClick={() => setSelectedProvider(provider)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              selectedProvider === provider
                ? "bg-green-600 text-white"
                : "bg-gray-800 text-green-400 hover:bg-gray-700"
            }`}
          >
            {provider}
          </button>
        ))}
      </div>

      {/* Model Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-2">
        {filteredModels.map((model) => (
          <div
            key={model.id}
            className={`relative p-4 border rounded-lg cursor-pointer transition-all ${
              value === model.id
                ? "border-green-400 bg-green-900/20 shadow-lg shadow-green-900/20"
                : "border-green-900/30 bg-black hover:border-green-700/50"
            }`}
            onClick={() => onChange(model.id)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-medium text-green-400">{model.name}</h3>
                  {model.recommended && (
                    <span className="px-2 py-0.5 text-xs bg-green-600 text-white rounded">
                      Recommended
                    </span>
                  )}
                  {model.size && (
                    <span className="px-2 py-0.5 text-xs bg-gray-700 text-green-400 rounded">
                      {model.size}
                    </span>
                  )}
                </div>
                <p className="text-sm text-green-600 mt-1">{model.description}</p>
                <div className="flex items-center gap-2 mt-2">
                  <p className="text-xs text-green-700">{model.provider}</p>
                  {model.performanceScore && (
                    <span className="text-xs text-green-600">
                      Score: {model.performanceScore}
                    </span>
                  )}
                </div>
                {model.capabilities && model.capabilities.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {model.capabilities.slice(0, 3).map(cap => (
                      <span key={cap} className="px-1.5 py-0.5 text-xs bg-green-900/30 text-green-500 rounded">
                        {cap}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ml-2 ${
                  value === model.id
                    ? "border-green-400 bg-green-400"
                    : "border-green-600"
                }`}
              >
                {value === model.id && (
                  <div className="w-2 h-2 bg-white rounded-full" />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredModels.length === 0 && (
        <div className="text-center py-8 text-green-600">
          No models found matching your criteria.
        </div>
      )}
      
      {/* Model Info */}
      {selectedModel && (
        <div className="p-3 bg-green-900/20 border border-green-700/30 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-green-400 font-medium">
                {selectedModel.name}
              </p>
              <p className="text-xs text-green-600 mt-1">
                {selectedModel.provider === "AWS Bedrock" && 
                  "AWS Bedrock models require AWS credentials and model access enabled."}
                {selectedModel.provider === "Ollama" && 
                  "Ollama models run locally. Ensure Ollama is installed and running at http://localhost:11434"}
                {selectedModel.provider === "OpenAI" && 
                  "OpenAI models require an API key. Set OPENAI_API_KEY environment variable."}
              </p>
              {selectedModel.id.includes("claude-sonnet-4-5") && (
                <p className="text-xs text-green-400 mt-1">
                  ✨ This model includes interleaved reasoning for enhanced problem-solving.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
