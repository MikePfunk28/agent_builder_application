import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "sonner";
import { AgentBuilder } from "./components/AgentBuilder";
import { AgentDashboard } from "./components/AgentDashboard";
import { MCPManagementPanel } from "./components/MCPManagementPanel";
import { useState } from "react";
import { Bot, Home, Server } from "lucide-react";

export default function App() {
  const [currentView, setCurrentView] = useState<"dashboard" | "builder" | "mcp" | "settings">("dashboard");

  return (
    <div className="min-h-screen bg-black text-green-400">
      <header className="sticky top-0 z-50 bg-black/90 backdrop-blur-sm border-b border-green-900/30">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bot className="w-8 h-8 text-green-400" />
            <h1 className="text-xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
              Agent Builder
            </h1>
          </div>
          
          <Authenticated>
            <nav className="flex items-center gap-6">
              <button
                onClick={() => setCurrentView("dashboard")}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  currentView === "dashboard" 
                    ? "bg-green-900/30 text-green-400" 
                    : "text-green-600 hover:text-green-400"
                }`}
              >
                <Home className="w-4 h-4" />
                Dashboard
              </button>
              <button
                onClick={() => setCurrentView("builder")}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  currentView === "builder" 
                    ? "bg-green-900/30 text-green-400" 
                    : "text-green-600 hover:text-green-400"
                }`}
              >
                <Bot className="w-4 h-4" />
                Builder
              </button>
              <button
                onClick={() => setCurrentView("mcp")}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  currentView === "mcp" 
                    ? "bg-green-900/30 text-green-400" 
                    : "text-green-600 hover:text-green-400"
                }`}
              >
                <Server className="w-4 h-4" />
                MCP Servers
              </button>
              <SignOutButton />
            </nav>
          </Authenticated>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Unauthenticated>
          <div className="max-w-md mx-auto">
            <div className="text-center mb-8">
              <Bot className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <h2 className="text-3xl font-bold mb-2">Welcome to Agent Builder</h2>
              <p className="text-green-600">
                Create powerful AI agents with strandsagents SDK
              </p>
            </div>
            <SignInForm />
          </div>
        </Unauthenticated>

        <Authenticated>
          <Content currentView={currentView} />
        </Authenticated>
      </main>
      
      <Toaster theme="dark" />
    </div>
  );
}

function Content({ currentView }: { currentView: string }) {
  const loggedInUser = useQuery(api.auth.loggedInUser);

  if (loggedInUser === undefined) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400"></div>
      </div>
    );
  }

  switch (currentView) {
    case "builder":
      return <AgentBuilder />;
    case "mcp":
      return <MCPManagementPanel />;
    case "dashboard":
    default:
      return <AgentDashboard />;
  }
}
