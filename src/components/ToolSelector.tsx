import { useState } from "react";
import { Plus, Search, Code, Database, Globe, FileText, BarChart3, Cpu } from "lucide-react";

interface Tool {
  name: string;
  type: string;
  config?: any;
  requiresPip?: boolean;
  pipPackages?: string[];
}

interface ToolSelectorProps {
  onAddTool: (tool: Tool) => void;
}

const availableTools = [
  {
    id: "web_search",
    name: "Web Search",
    description: "Search the internet for information",
    icon: Globe,
    category: "Data",
    requiresPip: true,
    pipPackages: ["requests", "beautifulsoup4"],
  },
  {
    id: "file_operations",
    name: "File Operations",
    description: "Read, write, and manage files",
    icon: FileText,
    category: "System",
    requiresPip: false,
    pipPackages: [],
  },
  {
    id: "database",
    name: "Database Access",
    description: "Query and manage databases",
    icon: Database,
    category: "Data",
    requiresPip: true,
    pipPackages: ["sqlite3", "pandas"],
  },
  {
    id: "api_client",
    name: "API Client",
    description: "Make HTTP requests to APIs",
    icon: Code,
    category: "Integration",
    requiresPip: true,
    pipPackages: ["httpx", "requests"],
  },
  {
    id: "data_analysis",
    name: "Data Analysis",
    description: "Analyze and visualize data",
    icon: BarChart3,
    category: "Analytics",
    requiresPip: true,
    pipPackages: ["numpy", "pandas", "matplotlib", "seaborn"],
  },
  {
    id: "code_interpreter",
    name: "Code Interpreter",
    description: "Execute Python code safely",
    icon: Cpu,
    category: "Core",
    requiresPip: false,
    pipPackages: [],
    isCore: true,
  },
  {
    id: "memory_manager",
    name: "Memory Manager",
    description: "Persistent memory and context",
    icon: Database,
    category: "Core",
    requiresPip: false,
    pipPackages: [],
    isCore: true,
  },
];

const categories = ["All", "Core", "Data", "System", "Integration", "Analytics"];

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
              
              {tool.requiresPip && tool.pipPackages.length > 0 && (
                <div className="text-xs text-yellow-400">
                  Requires: {tool.pipPackages.join(", ")}
                </div>
              )}
              
              {tool.isCore && (
                <div className="text-xs text-green-400 font-medium">
                  ✨ Core AgentCore Tool
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
