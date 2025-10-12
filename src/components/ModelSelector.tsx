interface ModelSelectorProps {
  value: string;
  onChange: (model: string) => void;
}

const models = [
  {
    id: "claude-3-5-sonnet-20241022",
    name: "Claude 3.5 Sonnet",
    description: "Most capable model with interleaved reasoning",
    provider: "Anthropic",
    recommended: true,
  },
  {
    id: "claude-3-haiku-20240307",
    name: "Claude 3 Haiku",
    description: "Fast and efficient for simple tasks",
    provider: "Anthropic",
  },
  {
    id: "gpt-4-turbo",
    name: "GPT-4 Turbo",
    description: "OpenAI's most capable model",
    provider: "OpenAI",
  },
  {
    id: "gpt-3.5-turbo",
    name: "GPT-3.5 Turbo",
    description: "Fast and cost-effective",
    provider: "OpenAI",
  },
  {
    id: "llama-2-70b",
    name: "Llama 2 70B",
    description: "Open source alternative",
    provider: "Meta",
  },
];

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-green-400 mb-3">
        Model Selection
      </label>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {models.map((model) => (
          <div
            key={model.id}
            className={`relative p-4 border rounded-lg cursor-pointer transition-all ${
              value === model.id
                ? "border-green-400 bg-green-900/20"
                : "border-green-900/30 bg-black hover:border-green-700/50"
            }`}
            onClick={() => onChange(model.id)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-green-400">{model.name}</h3>
                  {model.recommended && (
                    <span className="px-2 py-1 text-xs bg-green-600 text-white rounded">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="text-sm text-green-600 mt-1">{model.description}</p>
                <p className="text-xs text-green-700 mt-2">{model.provider}</p>
              </div>
              <div
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
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
      
      {value === "claude-3-5-sonnet-20241022" && (
        <div className="mt-3 p-3 bg-green-900/20 border border-green-700/30 rounded-lg">
          <p className="text-sm text-green-400">
            ✨ This model includes interleaved reasoning implementation for enhanced problem-solving capabilities.
          </p>
        </div>
      )}
    </div>
  );
}
