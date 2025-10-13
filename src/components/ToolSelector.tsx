import { useState } from "react";
import { 
  Plus, Search, Code, Database, Globe, FileText, BarChart3, Cpu,
  Brain, MessageSquare, Image, Video, Mic, Network, GitBranch,
  FileEdit, Terminal, Clock, Wifi, AlertTriangle
} from "lucide-react";

interface Tool {
  name: string;
  type: string;
  config?: any;
  requiresPip?: boolean;
  pipPackages?: string[];
  extrasPip?: string;
  notSupportedOn?: string[];
}

interface ToolSelectorProps {
  onAddTool: (tool: Tool) => void;
}

const availableTools = [
  // RAG & Memory
  {
    id: "retrieve",
    name: "Retrieve",
    description: "Semantically retrieve data from Amazon Bedrock Knowledge Bases",
    icon: Database,
    category: "RAG & Memory",
    requiresPip: true,
    pipPackages: [],
  },
  {
    id: "memory",
    name: "Memory",
    description: "Agent memory persistence in Amazon Bedrock Knowledge Bases",
    icon: Brain,
    category: "RAG & Memory",
    requiresPip: true,
    pipPackages: [],
  },
  {
    id: "agent_core_memory",
    name: "Agent Core Memory",
    description: "Integration with Amazon Bedrock Agent Core Memory",
    icon: Brain,
    category: "RAG & Memory",
    requiresPip: true,
    pipPackages: [],
    extrasPip: "agent_core_memory",
  },
  {
    id: "mem0_memory",
    name: "Mem0 Memory",
    description: "Agent memory and personalization built on Mem0",
    icon: Brain,
    category: "RAG & Memory",
    requiresPip: true,
    pipPackages: [],
    extrasPip: "mem0_memory",
  },

  // File Operations
  {
    id: "editor",
    name: "Editor",
    description: "File editing operations like line edits, search, and undo",
    icon: FileEdit,
    category: "File Operations",
    requiresPip: true,
    pipPackages: [],
  },
  {
    id: "file_read",
    name: "File Read",
    description: "Read and parse files",
    icon: FileText,
    category: "File Operations",
    requiresPip: true,
    pipPackages: [],
  },
  {
    id: "file_write",
    name: "File Write",
    description: "Create and modify files",
    icon: FileText,
    category: "File Operations",
    requiresPip: true,
    pipPackages: [],
  },

  // Shell & System
  {
    id: "environment",
    name: "Environment",
    description: "Manage environment variables",
    icon: Terminal,
    category: "Shell & System",
    requiresPip: true,
    pipPackages: [],
  },
  {
    id: "shell",
    name: "Shell",
    description: "Execute shell commands",
    icon: Terminal,
    category: "Shell & System",
    requiresPip: true,
    pipPackages: [],
    notSupportedOn: ["windows"],
  },
  {
    id: "cron",
    name: "Cron",
    description: "Task scheduling with cron jobs",
    icon: Clock,
    category: "Shell & System",
    requiresPip: true,
    pipPackages: [],
  },
  {
    id: "use_computer",
    name: "Use Computer",
    description: "Automate desktop actions and GUI interactions",
    icon: Cpu,
    category: "Shell & System",
    requiresPip: true,
    pipPackages: [],
    extrasPip: "use_computer",
  },

  // Code Interpretation
  {
    id: "python_repl",
    name: "Python REPL",
    description: "Run Python code",
    icon: Code,
    category: "Code Interpretation",
    requiresPip: true,
    pipPackages: [],
    notSupportedOn: ["windows"],
  },
  {
    id: "code_interpreter",
    name: "Code Interpreter",
    description: "Execute code in isolated sandboxes",
    icon: Cpu,
    category: "Code Interpretation",
    requiresPip: true,
    pipPackages: [],
  },

  // Web & Network
  {
    id: "http_request",
    name: "HTTP Request",
    description: "Make API calls, fetch web data, and call local HTTP servers",
    icon: Wifi,
    category: "Web & Network",
    requiresPip: true,
    pipPackages: [],
  },
  {
    id: "slack",
    name: "Slack",
    description: "Slack integration with real-time events and messaging",
    icon: MessageSquare,
    category: "Web & Network",
    requiresPip: true,
    pipPackages: [],
  },
  {
    id: "browser",
    name: "Browser",
    description: "Automate web browser interactions",
    icon: Globe,
    category: "Web & Network",
    requiresPip: true,
    pipPackages: [],
    extrasPip: "local_chromium_browser",
  },
  {
    id: "agent_core_browser",
    name: "Agent Core Browser",
    description: "Browser automation via Agent Core",
    icon: Globe,
    category: "Web & Network",
    requiresPip: true,
    pipPackages: [],
    extrasPip: "agent_core_browser",
  },
  {
    id: "rss",
    name: "RSS",
    description: "Manage and process RSS feeds",
    icon: Wifi,
    category: "Web & Network",
    requiresPip: true,
    pipPackages: [],
    extrasPip: "rss",
  },

  // Multi-modal
  {
    id: "generate_image_stability",
    name: "Generate Image (Stability)",
    description: "Create images with Stability AI",
    icon: Image,
    category: "Multi-modal",
    requiresPip: true,
    pipPackages: [],
  },
  {
    id: "image_reader",
    name: "Image Reader",
    description: "Process and analyze images",
    icon: Image,
    category: "Multi-modal",
    requiresPip: true,
    pipPackages: [],
  },
  {
    id: "generate_image",
    name: "Generate Image",
    description: "Create AI generated images with Amazon Bedrock",
    icon: Image,
    category: "Multi-modal",
    requiresPip: true,
    pipPackages: [],
  },
  {
    id: "nova_reels",
    name: "Nova Reels",
    description: "Create AI generated videos with Nova Reels on Amazon Bedrock",
    icon: Video,
    category: "Multi-modal",
    requiresPip: true,
    pipPackages: [],
  },
  {
    id: "speak",
    name: "Speak",
    description: "Generate speech from text using macOS say or Amazon Polly",
    icon: Mic,
    category: "Multi-modal",
    requiresPip: true,
    pipPackages: [],
  },
  {
    id: "diagram",
    name: "Diagram",
    description: "Create cloud architecture and UML diagrams",
    icon: GitBranch,
    category: "Multi-modal",
    requiresPip: true,
    pipPackages: [],
    extrasPip: "diagram",
  },

  // AWS Services
  {
    id: "use_aws",
    name: "Use AWS",
    description: "Interact with AWS services",
    icon: Database,
    category: "AWS Services",
    requiresPip: true,
    pipPackages: [],
  },

  // Utilities
  {
    id: "calculator",
    name: "Calculator",
    description: "Perform mathematical operations",
    icon: BarChart3,
    category: "Utilities",
    requiresPip: true,
    pipPackages: [],
  },
  {
    id: "current_time",
    name: "Current Time",
    description: "Get the current date and time",
    icon: Clock,
    category: "Utilities",
    requiresPip: true,
    pipPackages: [],
  },
  {
    id: "load_tool",
    name: "Load Tool",
    description: "Dynamically load more tools at runtime",
    icon: Code,
    category: "Utilities",
    requiresPip: true,
    pipPackages: [],
  },
  {
    id: "sleep",
    name: "Sleep",
    description: "Pause execution with interrupt support",
    icon: Clock,
    category: "Utilities",
    requiresPip: true,
    pipPackages: [],
  },

  // Agents & Workflows
  {
    id: "graph",
    name: "Graph",
    description: "Create and manage multi-agent systems using Strands SDK Graph",
    icon: Network,
    category: "Agents & Workflows",
    requiresPip: true,
    pipPackages: [],
  },
  {
    id: "agent_graph",
    name: "Agent Graph",
    description: "Create and manage graphs of agents",
    icon: Network,
    category: "Agents & Workflows",
    requiresPip: true,
    pipPackages: [],
  },
  {
    id: "journal",
    name: "Journal",
    description: "Create structured tasks and logs for agents",
    icon: FileText,
    category: "Agents & Workflows",
    requiresPip: true,
    pipPackages: [],
  },
  {
    id: "swarm",
    name: "Swarm",
    description: "Coordinate multiple AI agents in a swarm",
    icon: Network,
    category: "Agents & Workflows",
    requiresPip: true,
    pipPackages: [],
  },
  {
    id: "stop",
    name: "Stop",
    description: "Force stop the agent event loop",
    icon: AlertTriangle,
    category: "Agents & Workflows",
    requiresPip: true,
    pipPackages: [],
  },
  {
    id: "handoff_to_user",
    name: "Handoff to User",
    description: "Enable human-in-the-loop workflows",
    icon: MessageSquare,
    category: "Agents & Workflows",
    requiresPip: true,
    pipPackages: [],
  },
  {
    id: "use_agent",
    name: "Use Agent",
    description: "Run a new AI event loop with custom prompts",
    icon: Brain,
    category: "Agents & Workflows",
    requiresPip: true,
    pipPackages: [],
  },
  {
    id: "think",
    name: "Think",
    description: "Perform deep thinking with parallel reasoning branches",
    icon: Brain,
    category: "Agents & Workflows",
    requiresPip: true,
    pipPackages: [],
  },
  {
    id: "use_llm",
    name: "Use LLM",
    description: "Run a new AI event loop with custom prompts",
    icon: Brain,
    category: "Agents & Workflows",
    requiresPip: true,
    pipPackages: [],
  },
  {
    id: "workflow",
    name: "Workflow",
    description: "Orchestrate sequenced workflows",
    icon: GitBranch,
    category: "Agents & Workflows",
    requiresPip: true,
    pipPackages: [],
  },
  {
    id: "batch",
    name: "Batch",
    description: "Call multiple tools from a single model request",
    icon: Code,
    category: "Agents & Workflows",
    requiresPip: true,
    pipPackages: [],
  },
  {
    id: "a2a_client",
    name: "A2A Client",
    description: "Enable agent-to-agent communication",
    icon: Network,
    category: "Agents & Workflows",
    requiresPip: true,
    pipPackages: [],
    extrasPip: "a2a_client",
  },
];

const categories = [
  "All",
  "RAG & Memory",
  "File Operations",
  "Shell & System",
  "Code Interpretation",
  "Web & Network",
  "Multi-modal",
  "AWS Services",
  "Utilities",
  "Agents & Workflows",
];

export function ToolSelector({ onAddTool }: ToolSelectorProps) {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");

  const filteredTools = availableTools.filter((tool) => {
    const matchesCategory = selectedCategory === "All" || tool.category === selectedCategory;
    const matchesSearch = tool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         tool.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleAddTool = (toolDef: any) => {
    const tool: Tool = {
      name: toolDef.name,
      type: toolDef.id,
      requiresPip: toolDef.requiresPip,
      pipPackages: toolDef.pipPackages,
      extrasPip: toolDef.extrasPip,
      notSupportedOn: toolDef.notSupportedOn,
    };
    onAddTool(tool);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-green-600" />
            <input
              type="text"
              placeholder="Search tools..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-black border border-green-900/30 rounded-lg text-green-400 placeholder-green-600 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition-colors"
            />
          </div>
        </div>
        
        <div className="flex gap-2 overflow-x-auto">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === category
                  ? "bg-green-600 text-white"
                  : "bg-gray-800 text-green-400 hover:bg-gray-700"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTools.map((tool) => {
          const Icon = tool.icon;
          return (
            <div
              key={tool.id}
              className="p-4 bg-black border border-green-900/30 rounded-lg hover:border-green-700/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    tool.isCore ? "bg-green-600/20" : "bg-gray-800"
                  }`}>
                    <Icon className={`w-4 h-4 ${tool.isCore ? "text-green-400" : "text-green-600"}`} />
                  </div>
                  <div>
                    <h3 className="font-medium text-green-400">{tool.name}</h3>
                    <p className="text-xs text-green-600">{tool.category}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleAddTool(tool)}
                  className="p-1 text-green-600 hover:text-green-400 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              
              <p className="text-sm text-green-600 mb-3">{tool.description}</p>
              
              {tool.extrasPip && (
                <div className="text-xs text-yellow-400 mb-2">
                  Requires: strands-agents-tools[{tool.extrasPip}]
                </div>
              )}
              
              {tool.requiresPip && tool.pipPackages.length > 0 && (
                <div className="text-xs text-yellow-400 mb-2">
                  Requires: {tool.pipPackages.join(", ")}
                </div>
              )}
              
              {tool.notSupportedOn && tool.notSupportedOn.includes("windows") && (
                <div className="flex items-center gap-1 text-xs text-red-400 font-medium">
                  <AlertTriangle className="w-3 h-3" />
                  Not supported on Windows
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredTools.length === 0 && (
        <div className="text-center py-8 text-green-600">
          No tools found matching your criteria.
        </div>
      )}
    </div>
  );
}
