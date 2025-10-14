import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Container, 
  Terminal, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  ExternalLink,
  Copy,
  Play,
  Settings,
  Cloud,
  Home
} from "lucide-react";
import { toast } from "sonner";

interface DockerSetupGuideProps {
  modelId: string;
  onClose: () => void;
}

export function DockerSetupGuide({ modelId, onClose }: DockerSetupGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const isOllama = modelId.includes(':') && !modelId.includes('.');
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const ollamaSteps = [
    {
      title: "Install Docker",
      description: "Docker is required to run agent tests in isolated containers",
      content: (
        <div className="space-y-4">
          <p className="text-green-300">
            Download and install Docker Desktop from the official website:
          </p>
          <div className="bg-black border border-green-900/30 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-green-400 font-mono">https://docker.com/get-started</span>
              <button
                onClick={() => window.open('https://docker.com/get-started', '_blank')}
                className="text-green-600 hover:text-green-400 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          </div>
          <p className="text-green-600 text-sm">
            After installation, make sure Docker Desktop is running before proceeding.
          </p>
        </div>
      )
    },
    {
      title: "Install Ollama",
      description: "Ollama provides local AI model hosting",
      content: (
        <div className="space-y-4">
          <p className="text-green-300">
            Install Ollama on your system:
          </p>
          <div className="bg-black border border-green-900/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-green-600 text-sm">macOS/Linux:</span>
              <button
                onClick={() => copyToClipboard('curl -fsSL https://ollama.ai/install.sh | sh')}
                className="text-green-600 hover:text-green-400 transition-colors"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <code className="text-green-400 font-mono text-sm">
              curl -fsSL https://ollama.ai/install.sh | sh
            </code>
          </div>
          <div className="bg-black border border-green-900/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-green-600 text-sm">Windows:</span>
              <button
                onClick={() => window.open('https://ollama.ai/download/windows', '_blank')}
                className="text-green-600 hover:text-green-400 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
            <span className="text-green-400 text-sm">Download installer from ollama.ai</span>
          </div>
        </div>
      )
    },
    {
      title: "Start Ollama Service",
      description: "Run Ollama server to host models locally",
      content: (
        <div className="space-y-4">
          <p className="text-green-300">
            Start the Ollama service:
          </p>
          <div className="bg-black border border-green-900/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-green-600 text-sm">Start Ollama:</span>
              <button
                onClick={() => copyToClipboard('ollama serve')}
                className="text-green-600 hover:text-green-400 transition-colors"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <code className="text-green-400 font-mono text-sm">
              ollama serve
            </code>
          </div>
          <p className="text-green-600 text-sm">
            Keep this terminal window open. Ollama will run on http://localhost:11434
          </p>
        </div>
      )
    },
    {
      title: "Pull Required Model",
      description: `Download the ${modelId} model for testing`,
      content: (
        <div className="space-y-4">
          <p className="text-green-300">
            Pull the model you want to test:
          </p>
          <div className="bg-black border border-green-900/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-green-600 text-sm">Pull model:</span>
              <button
                onClick={() => copyToClipboard(`ollama pull ${modelId}`)}
                className="text-green-600 hover:text-green-400 transition-colors"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <code className="text-green-400 font-mono text-sm">
              ollama pull {modelId}
            </code>
          </div>
          <p className="text-green-600 text-sm">
            This may take a few minutes depending on the model size.
          </p>
        </div>
      )
    },
    {
      title: "Verify Setup",
      description: "Test that everything is working correctly",
      content: (
        <div className="space-y-4">
          <p className="text-green-300">
            Verify your setup with these commands:
          </p>
          <div className="space-y-3">
            <div className="bg-black border border-green-900/30 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-green-600 text-sm">Check Docker:</span>
                <button
                  onClick={() => copyToClipboard('docker --version')}
                  className="text-green-600 hover:text-green-400 transition-colors"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <code className="text-green-400 font-mono text-sm">
                docker --version
              </code>
            </div>
            <div className="bg-black border border-green-900/30 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-green-600 text-sm">Check Ollama:</span>
                <button
                  onClick={() => copyToClipboard('ollama list')}
                  className="text-green-600 hover:text-green-400 transition-colors"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <code className="text-green-400 font-mono text-sm">
                ollama list
              </code>
            </div>
            <div className="bg-black border border-green-900/30 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-green-600 text-sm">Test model:</span>
                <button
                  onClick={() => copyToClipboard(`ollama run ${modelId} "Hello, world!"`)}
                  className="text-green-600 hover:text-green-400 transition-colors"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <code className="text-green-400 font-mono text-sm">
                ollama run {modelId} "Hello, world!"
              </code>
            </div>
          </div>
        </div>
      )
    }
  ];

  const bedrockSteps = [
    {
      title: "Install Docker",
      description: "Docker is required to run agent tests in isolated containers",
      content: (
        <div className="space-y-4">
          <p className="text-green-300">
            Download and install Docker Desktop from the official website:
          </p>
          <div className="bg-black border border-green-900/30 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-green-400 font-mono">https://docker.com/get-started</span>
              <button
                onClick={() => window.open('https://docker.com/get-started', '_blank')}
                className="text-green-600 hover:text-green-400 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          </div>
          <p className="text-green-600 text-sm">
            After installation, make sure Docker Desktop is running before proceeding.
          </p>
        </div>
      )
    },
    {
      title: "Install AWS CLI",
      description: "AWS CLI is needed to configure credentials for Bedrock access",
      content: (
        <div className="space-y-4">
          <p className="text-green-300">
            Install the AWS CLI:
          </p>
          <div className="bg-black border border-green-900/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-green-600 text-sm">macOS:</span>
              <button
                onClick={() => copyToClipboard('brew install awscli')}
                className="text-green-600 hover:text-green-400 transition-colors"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <code className="text-green-400 font-mono text-sm">
              brew install awscli
            </code>
          </div>
          <div className="bg-black border border-green-900/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-green-600 text-sm">Windows/Linux:</span>
              <button
                onClick={() => window.open('https://aws.amazon.com/cli/', '_blank')}
                className="text-green-600 hover:text-green-400 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
            <span className="text-green-400 text-sm">Download installer from AWS</span>
          </div>
        </div>
      )
    },
    {
      title: "Configure AWS Credentials",
      description: "Set up your AWS credentials for Bedrock access",
      content: (
        <div className="space-y-4">
          <p className="text-green-300">
            Configure your AWS credentials:
          </p>
          <div className="bg-black border border-green-900/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-green-600 text-sm">Configure AWS:</span>
              <button
                onClick={() => copyToClipboard('aws configure')}
                className="text-green-600 hover:text-green-400 transition-colors"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <code className="text-green-400 font-mono text-sm">
              aws configure
            </code>
          </div>
          <div className="bg-orange-900/20 border border-orange-700/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-orange-400" />
              <span className="text-orange-400 font-medium">Required Information:</span>
            </div>
            <ul className="text-orange-300 text-sm space-y-1">
              <li>• AWS Access Key ID</li>
              <li>• AWS Secret Access Key</li>
              <li>• Default region (e.g., us-east-1)</li>
              <li>• Output format (json)</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      title: "Enable Bedrock Model Access",
      description: "Request access to the specific model in AWS Bedrock",
      content: (
        <div className="space-y-4">
          <p className="text-green-300">
            Enable model access in the AWS Bedrock console:
          </p>
          <div className="bg-black border border-green-900/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-green-600 text-sm">Bedrock Console:</span>
              <button
                onClick={() => window.open('https://console.aws.amazon.com/bedrock/home#/modelaccess', '_blank')}
                className="text-green-600 hover:text-green-400 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
            <span className="text-green-400 text-sm">Open Model Access page</span>
          </div>
          <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-blue-400" />
              <span className="text-blue-400 font-medium">Steps:</span>
            </div>
            <ol className="text-blue-300 text-sm space-y-1 list-decimal list-inside">
              <li>Navigate to AWS Bedrock console</li>
              <li>Go to "Model access" in the left sidebar</li>
              <li>Find and enable access for: <code className="bg-black px-1 rounded">{modelId}</code></li>
              <li>Wait for approval (usually instant for most models)</li>
            </ol>
          </div>
        </div>
      )
    },
    {
      title: "Verify Setup",
      description: "Test that everything is working correctly",
      content: (
        <div className="space-y-4">
          <p className="text-green-300">
            Verify your setup with these commands:
          </p>
          <div className="space-y-3">
            <div className="bg-black border border-green-900/30 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-green-600 text-sm">Check Docker:</span>
                <button
                  onClick={() => copyToClipboard('docker --version')}
                  className="text-green-600 hover:text-green-400 transition-colors"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <code className="text-green-400 font-mono text-sm">
                docker --version
              </code>
            </div>
            <div className="bg-black border border-green-900/30 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-green-600 text-sm">Check AWS:</span>
                <button
                  onClick={() => copyToClipboard('aws sts get-caller-identity')}
                  className="text-green-600 hover:text-green-400 transition-colors"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <code className="text-green-400 font-mono text-sm">
                aws sts get-caller-identity
              </code>
            </div>
            <div className="bg-black border border-green-900/30 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-green-600 text-sm">List Bedrock models:</span>
                <button
                  onClick={() => copyToClipboard('aws bedrock list-foundation-models --region us-east-1')}
                  className="text-green-600 hover:text-green-400 transition-colors"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <code className="text-green-400 font-mono text-sm">
                aws bedrock list-foundation-models --region us-east-1
              </code>
            </div>
          </div>
        </div>
      )
    }
  ];

  const steps = isOllama ? ollamaSteps : bedrockSteps;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-gray-900 border border-green-900/30 rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {isOllama ? (
              <Home className="w-6 h-6 text-green-400" />
            ) : (
              <Cloud className="w-6 h-6 text-green-400" />
            )}
            <h3 className="text-xl font-semibold text-green-400">
              {isOllama ? 'Ollama' : 'AWS Bedrock'} Setup Guide
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-green-600 hover:text-green-400 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="mb-6">
          <p className="text-green-600 mb-4">
            Follow these steps to set up real Docker testing with {isOllama ? 'Ollama' : 'AWS Bedrock'} for model: 
            <code className="bg-black px-2 py-1 rounded ml-2 text-green-400">{modelId}</code>
          </p>
          
          {/* Progress indicator */}
          <div className="flex items-center gap-2 mb-4">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  index <= currentStep
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-800 text-green-600'
                }`}
              >
                {index < currentStep ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  index + 1
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Current step content */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-medium">
              {currentStep + 1}
            </div>
            <div>
              <h4 className="text-lg font-medium text-green-400">{steps[currentStep].title}</h4>
              <p className="text-green-600 text-sm">{steps[currentStep].description}</p>
            </div>
          </div>
          
          <div className="bg-black border border-green-900/30 rounded-lg p-6">
            {steps[currentStep].content}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
            className="px-4 py-2 bg-gray-800 text-green-400 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          
          <span className="text-green-600 text-sm">
            Step {currentStep + 1} of {steps.length}
          </span>
          
          {currentStep < steps.length - 1 ? (
            <button
              onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Next
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
      </motion.div>
    </motion.div>
  );
}
