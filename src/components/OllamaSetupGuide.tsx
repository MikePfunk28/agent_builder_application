import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Download,
  Terminal,
  CheckCircle,
  ExternalLink,
  Copy,
  Play,
  AlertCircle,
  Monitor,
  Cpu,
  HardDrive
} from "lucide-react";
import { toast } from "sonner";

interface OllamaSetupGuideProps {
  isOpen: boolean;
  onClose: () => void;
  modelId: string;
}

export function OllamaSetupGuide({ isOpen, onClose, modelId }: OllamaSetupGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const markStepComplete = (stepIndex: number) => {
    if (!completedSteps.includes(stepIndex)) {
      setCompletedSteps([...completedSteps, stepIndex]);
    }
  };

  const steps = [
    {
      title: "Install Ollama",
      description: "Download and install Ollama on your system",
      content: (
        <div className="space-y-4">
          <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Download className="w-5 h-5 text-blue-400 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-400 mb-2">Download Ollama</h4>
                <p className="text-blue-300/70 text-sm mb-3">
                  Visit the official Ollama website to download the installer for your operating system.
                </p>
                <a
                  href="https://ollama.ai/download"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Download Ollama
                </a>
              </div>
            </div>
          </div>

          <div className="bg-gray-900/50 border border-green-900/30 rounded-lg p-4">
            <h4 className="font-medium text-green-400 mb-2">System Requirements</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4 text-green-400" />
                <span className="text-green-300">macOS 11+, Windows 10+, Linux</span>
              </div>
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-green-400" />
                <span className="text-green-300">8GB+ RAM recommended</span>
              </div>
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-green-400" />
                <span className="text-green-300">4GB+ free disk space</span>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Start Ollama Service",
      description: "Ensure Ollama is running on your system",
      content: (
        <div className="space-y-4">
          <div className="bg-gray-900/50 border border-green-900/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Terminal className="w-5 h-5 text-green-400" />
              <h4 className="font-medium text-green-400">Start Ollama Service</h4>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm text-green-600 mb-2">On macOS/Linux:</p>
                <div className="bg-black border border-green-900/30 rounded p-3 font-mono text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-green-400">ollama serve</span>
                    <button
                      onClick={() => copyToClipboard("ollama serve")}
                      className="p-1 text-green-600 hover:text-green-400 transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm text-green-600 mb-2">On Windows:</p>
                <div className="bg-black border border-green-900/30 rounded p-3 font-mono text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-green-400">ollama.exe serve</span>
                    <button
                      onClick={() => copyToClipboard("ollama.exe serve")}
                      className="p-1 text-green-600 hover:text-green-400 transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-600/30 rounded">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5" />
                <div className="text-sm">
                  <p className="text-yellow-400 font-medium">Note:</p>
                  <p className="text-yellow-300/70">
                    Ollama will run on port 11434 by default. Make sure this port is not blocked by your firewall.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Download Model",
      description: `Pull the ${modelId} model to your local system`,
      content: (
        <div className="space-y-4">
          <div className="bg-gray-900/50 border border-green-900/30 rounded-lg p-4">
            <h4 className="font-medium text-green-400 mb-3">Pull Model: {modelId}</h4>

            <div className="bg-black border border-green-900/30 rounded p-3 font-mono text-sm mb-3">
              <div className="flex items-center justify-between">
                <span className="text-green-400">ollama pull {modelId}</span>
                <button
                  onClick={() => copyToClipboard(`ollama pull ${modelId}`)}
                  className="p-1 text-green-600 hover:text-green-400 transition-colors"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="text-sm text-green-600 space-y-2">
              <p>This will download the model to your local system. Depending on the model size, this may take several minutes.</p>
              <p>Model sizes typically range from 2GB to 70GB+.</p>
            </div>
          </div>

          <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-4">
            <h4 className="font-medium text-blue-400 mb-2">Alternative Models</h4>
            <p className="text-blue-300/70 text-sm mb-3">
              If {modelId} is too large for your system, try these smaller alternatives:
            </p>
            <div className="space-y-2 text-sm">
              {[
                { model: "qwen3:4b", size: "~2.3GB", desc: "Fast, lightweight" },
                { model: "llama3.2:3b", size: "~2GB", desc: "Very fast" },
                { model: "phi4:14b", size: "~8GB", desc: "Good reasoning" }
              ].map((alt) => (
                <div key={alt.model} className="flex items-center justify-between p-2 bg-black/30 rounded">
                  <div>
                    <span className="text-blue-400 font-mono">{alt.model}</span>
                    <span className="text-blue-300/70 ml-2">({alt.size}) - {alt.desc}</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(`ollama pull ${alt.model}`)}
                    className="p-1 text-blue-600 hover:text-blue-400 transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Test Connection",
      description: "Verify Ollama is working correctly",
      content: (
        <div className="space-y-4">
          <div className="bg-gray-900/50 border border-green-900/30 rounded-lg p-4">
            <h4 className="font-medium text-green-400 mb-3">Test Ollama Connection</h4>

            <div className="space-y-3">
              <div>
                <p className="text-sm text-green-600 mb-2">1. Check if Ollama is running:</p>
                <div className="bg-black border border-green-900/30 rounded p-3 font-mono text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-green-400">curl http://localhost:11434</span>
                    <button
                      onClick={() => copyToClipboard("curl http://localhost:11434")}
                      className="p-1 text-green-600 hover:text-green-400 transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-green-600 mt-1">Should return: "Ollama is running"</p>
              </div>

              <div>
                <p className="text-sm text-green-600 mb-2">2. Test the model:</p>
                <div className="bg-black border border-green-900/30 rounded p-3 font-mono text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-green-400">ollama run {modelId} "Hello, how are you?"</span>
                    <button
                      onClick={() => copyToClipboard(`ollama run ${modelId} "Hello, how are you?"`)}
                      className="p-1 text-green-600 hover:text-green-400 transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-green-600 mt-1">Should return a response from the model</p>
              </div>
            </div>
          </div>

          <div className="bg-green-900/20 border border-green-600/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
              <div>
                <h4 className="font-medium text-green-400 mb-2">Ready to Test!</h4>
                <p className="text-green-300/70 text-sm">
                  Once Ollama is running and the model is downloaded, you can test your agent in a real Docker environment with a live Ollama connection.
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    }
  ];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-gray-900 border border-green-900/30 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-green-900/30">
            <div>
              <h2 className="text-xl font-semibold text-green-400">Ollama Setup Guide</h2>
              <p className="text-green-600 text-sm">Set up Ollama for local AI model testing</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-green-600 hover:text-green-400 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress */}
          <div className="px-6 py-4 border-b border-green-900/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-green-600">Step {currentStep + 1} of {steps.length}</span>
              <span className="text-sm text-green-600">
                {completedSteps.length}/{steps.length} completed
              </span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div
                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[60vh]">
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${completedSteps.includes(currentStep)
                    ? "bg-green-600 text-white"
                    : "bg-gray-800 text-green-400"
                  }`}>
                  {completedSteps.includes(currentStep) ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <span className="text-sm font-medium">{currentStep + 1}</span>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-medium text-green-400">{steps[currentStep].title}</h3>
                  <p className="text-green-600 text-sm">{steps[currentStep].description}</p>
                </div>
              </div>

              {steps[currentStep].content}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-green-900/30">
            <button
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
              className="px-4 py-2 text-green-600 hover:text-green-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>

            <div className="flex gap-3">
              <button
                onClick={() => markStepComplete(currentStep)}
                disabled={completedSteps.includes(currentStep)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                Mark Complete
              </button>

              {currentStep < steps.length - 1 ? (
                <button
                  onClick={() => setCurrentStep(currentStep + 1)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Next Step
                </button>
              ) : (
                <button
                  onClick={onClose}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Start Testing
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}