import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { 
  Bot, 
  Settings, 
  Code, 
  Rocket, 
  ChevronRight, 
  ChevronLeft,
  Plus,
  Trash2,
  Copy,
  Download
} from "lucide-react";
import { ModelSelector } from "./ModelSelector";
import { ToolSelector } from "./ToolSelector";
import { CodePreview } from "./CodePreview";

interface Tool {
  name: string;
  type: string;
  config?: any;
  requiresPip?: boolean;
  pipPackages?: string[];
}

interface AgentConfig {
  name: string;
  description: string;
  model: string;
  systemPrompt: string;
  tools: Tool[];
  deploymentType: string;
}

const steps = [
  { id: "basic", title: "Basic Info", icon: Bot },
  { id: "model", title: "Model & Prompt", icon: Settings },
  { id: "tools", title: "Tools", icon: Code },
  { id: "deploy", title: "Deploy", icon: Rocket },
];

export function AgentBuilder() {
  const [currentStep, setCurrentStep] = useState(0);
  const [config, setConfig] = useState<AgentConfig>({
    name: "",
    description: "",
    model: "claude-3-5-sonnet-20241022",
    systemPrompt: "",
    tools: [],
    deploymentType: "docker",
  });
  const [generatedCode, setGeneratedCode] = useState<string>("");
  const [dockerConfig, setDockerConfig] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);

  const generateAgent = useAction(api.codeGenerator.generateAgent);
  const createAgent = useMutation(api.agents.create);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleGenerate = async () => {
    if (!config.name || !config.systemPrompt) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generateAgent({
        name: config.name,
        model: config.model,
        systemPrompt: config.systemPrompt,
        tools: config.tools,
        deploymentType: config.deploymentType,
      });

      setGeneratedCode(result.generatedCode);
      setDockerConfig(result.dockerConfig || "");
      toast.success("Agent generated successfully!");
    } catch (error) {
      toast.error("Failed to generate agent");
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!generatedCode) {
      toast.error("Please generate the agent first");
      return;
    }

    try {
      await createAgent({
        name: config.name,
        description: config.description,
        model: config.model,
        systemPrompt: config.systemPrompt,
        tools: config.tools,
        generatedCode,
        dockerConfig,
        deploymentType: config.deploymentType,
        isPublic: false,
      });

      toast.success("Agent saved successfully!");
    } catch (error) {
      toast.error("Failed to save agent");
      console.error(error);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([generatedCode], { type: "text/python" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${config.name.toLowerCase().replace(/\s+/g, "_")}_agent.py`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;
            
            return (
              <div key={step.id} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all ${
                    isActive
                      ? "border-green-400 bg-green-400/10 text-green-400"
                      : isCompleted
                      ? "border-green-600 bg-green-600/10 text-green-600"
                      : "border-gray-600 text-gray-600"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="ml-3">
                  <div className={`text-sm font-medium ${isActive ? "text-green-400" : "text-gray-400"}`}>
                    {step.title}
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <ChevronRight className="w-5 h-5 text-gray-600 mx-4" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-gray-900/50 rounded-xl border border-green-900/30 p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {currentStep === 0 && <BasicInfoStep config={config} setConfig={setConfig} />}
            {currentStep === 1 && <ModelPromptStep config={config} setConfig={setConfig} />}
            {currentStep === 2 && <ToolsStep config={config} setConfig={setConfig} />}
            {currentStep === 3 && (
              <DeployStep 
                config={config} 
                setConfig={setConfig}
                generatedCode={generatedCode}
                dockerConfig={dockerConfig}
                isGenerating={isGenerating}
                onGenerate={handleGenerate}
                onSave={handleSave}
                onDownload={handleDownload}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <button
          onClick={handlePrevious}
          disabled={currentStep === 0}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>
        
        <button
          onClick={handleNext}
          disabled={currentStep === steps.length - 1}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function BasicInfoStep({ config, setConfig }: { config: AgentConfig; setConfig: (config: AgentConfig) => void }) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-green-400 mb-6">Basic Information</h2>
      
      <div>
        <label className="block text-sm font-medium text-green-400 mb-2">
          Agent Name *
        </label>
        <input
          type="text"
          value={config.name}
          onChange={(e) => setConfig({ ...config, name: e.target.value })}
          placeholder="My Awesome Agent"
          className="w-full px-4 py-3 bg-black border border-green-900/30 rounded-lg text-green-400 placeholder-green-600 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition-colors"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-green-400 mb-2">
          Description
        </label>
        <textarea
          value={config.description}
          onChange={(e) => setConfig({ ...config, description: e.target.value })}
          placeholder="Describe what your agent does..."
          rows={4}
          className="w-full px-4 py-3 bg-black border border-green-900/30 rounded-lg text-green-400 placeholder-green-600 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition-colors resize-none"
        />
      </div>
    </div>
  );
}

function ModelPromptStep({ config, setConfig }: { config: AgentConfig; setConfig: (config: AgentConfig) => void }) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-green-400 mb-6">Model & System Prompt</h2>
      
      <ModelSelector
        value={config.model}
        onChange={(model) => setConfig({ ...config, model })}
      />

      <div>
        <label className="block text-sm font-medium text-green-400 mb-2">
          System Prompt *
        </label>
        <textarea
          value={config.systemPrompt}
          onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
          placeholder="You are a helpful AI agent that..."
          rows={8}
          className="w-full px-4 py-3 bg-black border border-green-900/30 rounded-lg text-green-400 placeholder-green-600 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition-colors resize-none font-mono text-sm"
        />
        <p className="text-xs text-green-600 mt-2">
          Define your agent's personality, capabilities, and behavior guidelines.
        </p>
      </div>
    </div>
  );
}

function ToolsStep({ config, setConfig }: { config: AgentConfig; setConfig: (config: AgentConfig) => void }) {
  const addTool = (tool: Tool) => {
    setConfig({
      ...config,
      tools: [...config.tools, tool],
    });
  };

  const removeTool = (index: number) => {
    setConfig({
      ...config,
      tools: config.tools.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-green-400 mb-6">Tools & Capabilities</h2>
      
      <ToolSelector onAddTool={addTool} />

      {config.tools.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-medium text-green-400">Selected Tools</h3>
          {config.tools.map((tool, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-4 bg-black border border-green-900/30 rounded-lg"
            >
              <div>
                <div className="font-medium text-green-400">{tool.name}</div>
                <div className="text-sm text-green-600">{tool.type}</div>
                {tool.requiresPip && (
                  <div className="text-xs text-yellow-400 mt-1">
                    Requires: {tool.pipPackages?.join(", ")}
                  </div>
                )}
              </div>
              <button
                onClick={() => removeTool(index)}
                className="p-2 text-red-400 hover:text-red-300 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DeployStep({ 
  config, 
  setConfig, 
  generatedCode, 
  dockerConfig, 
  isGenerating, 
  onGenerate, 
  onSave, 
  onDownload 
}: { 
  config: AgentConfig; 
  setConfig: (config: AgentConfig) => void;
  generatedCode: string;
  dockerConfig: string;
  isGenerating: boolean;
  onGenerate: () => void;
  onSave: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-green-400 mb-6">Deployment Configuration</h2>
      
      <div>
        <label className="block text-sm font-medium text-green-400 mb-2">
          Deployment Type
        </label>
        <select
          value={config.deploymentType}
          onChange={(e) => setConfig({ ...config, deploymentType: e.target.value })}
          className="w-full px-4 py-3 bg-black border border-green-900/30 rounded-lg text-green-400 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition-colors"
        >
          <option value="docker">Docker Container</option>
          <option value="aws">AWS (Bedrock)</option>
          <option value="ollama">Ollama</option>
          <option value="local">Local Development</option>
        </select>
      </div>

      <div className="flex gap-4">
        <button
          onClick={onGenerate}
          disabled={isGenerating}
          className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isGenerating ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
          ) : (
            <Code className="w-4 h-4" />
          )}
          Generate Agent
        </button>

        {generatedCode && (
          <>
            <button
              onClick={onSave}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Copy className="w-4 h-4" />
              Save Agent
            </button>
            
            <button
              onClick={onDownload}
              className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          </>
        )}
      </div>

      {generatedCode && (
        <CodePreview 
          code={generatedCode} 
          dockerConfig={dockerConfig}
          deploymentType={config.deploymentType}
        />
      )}
    </div>
  );
}
