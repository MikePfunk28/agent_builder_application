import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, Download, Eye, Code, Container } from "lucide-react";
import { toast } from "sonner";

interface CodePreviewProps {
  code: string;
  dockerConfig?: string;
  deploymentType: string;
}

export function CodePreview({ code, dockerConfig, deploymentType }: CodePreviewProps) {
  const [activeTab, setActiveTab] = useState<"agent" | "docker" | "requirements">("agent");

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const generateRequirements = () => {
    const baseRequirements = [
      "strandsagents>=1.0.0",
      "agentcore>=1.0.0",
    ];

    if (deploymentType === "aws") {
      baseRequirements.push("boto3", "bedrock-client");
    } else if (deploymentType === "ollama") {
      baseRequirements.push("ollama");
    }

    // Extract pip packages from code
    const pipPackages = code.match(/pip install ([^\n]+)/g)?.map(line => 
      line.replace("pip install ", "").split(" ")
    ).flat() || [];

    return [...baseRequirements, ...pipPackages].join("\n");
  };

  const tabs = [
    { id: "agent", label: "Agent Code", icon: Code },
    ...(dockerConfig ? [{ id: "docker", label: "Dockerfile", icon: Container }] : []),
    { id: "requirements", label: "Requirements", icon: Eye },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-green-400">Generated Code</h3>
        <div className="flex gap-2">
          <button
            onClick={() => copyToClipboard(code)}
            className="flex items-center gap-2 px-3 py-2 bg-gray-800 text-green-400 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Copy className="w-4 h-4" />
            Copy
          </button>
          <button
            onClick={() => {
              const blob = new Blob([code], { type: "text/python" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "agent.py";
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
        </div>
      </div>

      <div className="bg-gray-900 border border-green-900/30 rounded-xl overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-green-900/30">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "bg-green-900/30 text-green-400 border-b-2 border-green-400"
                    : "text-green-600 hover:text-green-400"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="relative">
          {activeTab === "agent" && (
            <SyntaxHighlighter
              language="python"
              style={vscDarkPlus}
              customStyle={{
                margin: 0,
                background: "transparent",
                fontSize: "14px",
              }}
              showLineNumbers
            >
              {code}
            </SyntaxHighlighter>
          )}

          {activeTab === "docker" && dockerConfig && (
            <SyntaxHighlighter
              language="dockerfile"
              style={vscDarkPlus}
              customStyle={{
                margin: 0,
                background: "transparent",
                fontSize: "14px",
              }}
              showLineNumbers
            >
              {dockerConfig}
            </SyntaxHighlighter>
          )}

          {activeTab === "requirements" && (
            <SyntaxHighlighter
              language="text"
              style={vscDarkPlus}
              customStyle={{
                margin: 0,
                background: "transparent",
                fontSize: "14px",
              }}
              showLineNumbers
            >
              {generateRequirements()}
            </SyntaxHighlighter>
          )}

          <button
            onClick={() => {
              const content = activeTab === "agent" ? code : 
                           activeTab === "docker" ? dockerConfig : 
                           generateRequirements();
              copyToClipboard(content || "");
            }}
            className="absolute top-4 right-4 p-2 bg-gray-800/80 text-green-400 rounded-lg hover:bg-gray-700/80 transition-colors"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Deployment Instructions */}
      <div className="bg-green-900/10 border border-green-900/30 rounded-lg p-4">
        <h4 className="font-medium text-green-400 mb-2">Deployment Instructions</h4>
        <div className="text-sm text-green-600 space-y-2">
          {deploymentType === "docker" && (
            <>
              <p>1. Save the agent code as <code className="bg-black px-1 rounded">agent.py</code></p>
              <p>2. Save the Dockerfile as <code className="bg-black px-1 rounded">Dockerfile</code></p>
              <p>3. Save the requirements as <code className="bg-black px-1 rounded">requirements.txt</code></p>
              <p>4. Build: <code className="bg-black px-1 rounded">docker build -t my-agent .</code></p>
              <p>5. Run: <code className="bg-black px-1 rounded">docker run -p 8000:8000 my-agent</code></p>
            </>
          )}
          {deploymentType === "aws" && (
            <>
              <p>1. Configure AWS credentials and Bedrock access</p>
              <p>2. Install dependencies: <code className="bg-black px-1 rounded">pip install -r requirements.txt</code></p>
              <p>3. Deploy to Lambda or ECS using the generated configuration</p>
            </>
          )}
          {deploymentType === "ollama" && (
            <>
              <p>1. Install Ollama: <code className="bg-black px-1 rounded">curl -fsSL https://ollama.ai/install.sh | sh</code></p>
              <p>2. Start Ollama service: <code className="bg-black px-1 rounded">ollama serve</code></p>
              <p>3. Install dependencies and run the agent</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
