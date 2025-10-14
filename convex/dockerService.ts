import { action } from "./_generated/server";
import { v } from "convex/values";

export const testAgentInDocker = action({
  args: {
    agentCode: v.string(),
    requirements: v.string(),
    dockerfile: v.string(),
    testQuery: v.string(),
    timeout: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const timeout = args.timeout || 60000; // 60 seconds default
    
    try {
      // Create a unique container name
      const containerName = `agent-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Create temporary files in memory (simulated)
      const files = {
        'agent.py': args.agentCode,
        'requirements.txt': args.requirements,
        'Dockerfile': args.dockerfile,
        'test_runner.py': generateTestRunner(args.testQuery),
      };

      // Simulate Docker operations (in a real implementation, you'd use Docker API)
      const buildResult = await simulateDockerBuild(containerName, files);
      if (!buildResult.success) {
        return {
          success: false,
          error: buildResult.error,
          logs: buildResult.logs,
          stage: 'build'
        };
      }

      // Run the container
      const runResult = await simulateDockerRun(containerName, timeout);
      
      // Cleanup
      await simulateDockerCleanup(containerName);

      return {
        success: runResult.success,
        output: runResult.output,
        logs: runResult.logs,
        error: runResult.error,
        metrics: {
          executionTime: runResult.executionTime,
          memoryUsed: runResult.memoryUsed,
          buildTime: buildResult.buildTime,
        },
        stage: runResult.success ? 'completed' : 'runtime'
      };

    } catch (error) {
      return {
        success: false,
        error: `Docker service error: ${error}`,
        logs: [],
        stage: 'service'
      };
    }
  },
});

function generateTestRunner(testQuery: string): string {
  return `#!/usr/bin/env python3
"""
Test runner for generated agent
"""
import asyncio
import sys
import json
import time
import traceback
from agent import *

async def run_test():
    start_time = time.time()
    
    try:
        # Initialize the agent
        print("🤖 Initializing agent...")
        agent_class = None
        
        # Find the agent class dynamically
        for name, obj in globals().items():
            if (isinstance(obj, type) and 
                hasattr(obj, '__bases__') and 
                any('Agent' in str(base) for base in obj.__bases__)):
                agent_class = obj
                break
        
        if not agent_class:
            raise Exception("No Agent class found in agent.py")
        
        agent = agent_class()
        print(f"✅ Agent {agent_class.__name__} initialized successfully")
        
        # Process the test query
        print(f"📝 Processing query: {repr("${testQuery}")}")
        
        response = await agent.process_message("${testQuery}")
        
        execution_time = time.time() - start_time
        
        # Output results in JSON format
        result = {
            "success": True,
            "query": "${testQuery}",
            "response": str(response),
            "execution_time": execution_time,
            "agent_class": agent_class.__name__
        }
        
        print("\\n" + "="*50)
        print("🎉 TEST COMPLETED SUCCESSFULLY")
        print("="*50)
        print(f"Query: {result['query']}")
        print(f"Response: {result['response']}")
        print(f"Execution Time: {result['execution_time']:.2f}s")
        print("="*50)
        
        # Write result to file for Docker to read
        with open('/tmp/test_result.json', 'w') as f:
            json.dump(result, f, indent=2)
            
        return result
        
    except Exception as e:
        execution_time = time.time() - start_time
        error_msg = str(e)
        traceback_str = traceback.format_exc()
        
        print("\\n" + "="*50)
        print("❌ TEST FAILED")
        print("="*50)
        print(f"Error: {error_msg}")
        print(f"Traceback:\\n{traceback_str}")
        print(f"Execution Time: {execution_time:.2f}s")
        print("="*50)
        
        result = {
            "success": False,
            "query": "${testQuery}",
            "error": error_msg,
            "traceback": traceback_str,
            "execution_time": execution_time
        }
        
        with open('/tmp/test_result.json', 'w') as f:
            json.dump(result, f, indent=2)
            
        return result

if __name__ == "__main__":
    asyncio.run(run_test())
`;
}

// Simulated Docker operations (replace with real Docker API calls)
async function simulateDockerBuild(containerName: string, files: Record<string, string>) {
  const startTime = Date.now();
  
  // Simulate build process
  const logs = [
    "📦 Creating build context...",
    "🔍 Analyzing Dockerfile...",
    "⬇️  Pulling base image python:3.11-slim...",
    "📋 Installing system dependencies...",
    "🐍 Installing Python packages...",
  ];

  // Check for common issues
  const requirements = files['requirements.txt'];
  if (requirements.includes('strands-agents-tools[use_computer]')) {
    logs.push("⚠️  Warning: use_computer tool requires GUI environment");
  }
  
  if (requirements.includes('python_repl') && process.platform === 'win32') {
    return {
      success: false,
      error: "python_repl tool is not supported on Windows",
      logs,
      buildTime: Date.now() - startTime
    };
  }

  logs.push("✅ Build completed successfully");
  
  return {
    success: true,
    logs,
    buildTime: Date.now() - startTime
  };
}

async function simulateDockerRun(containerName: string, timeout: number) {
  const startTime = Date.now();
  
  // Simulate container execution
  await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate 2s execution
  
  const executionTime = Date.now() - startTime;
  
  // Simulate successful execution
  const mockResponse = "I'm a test agent and I've processed your query successfully. This is a simulated response for demonstration purposes.";
  
  return {
    success: true,
    output: mockResponse,
    error: undefined,
    logs: [
      "🚀 Starting container...",
      "🤖 Initializing agent...",
      "✅ Agent initialized successfully",
      "📝 Processing test query...",
      "🧠 Generating response...",
      "✅ Response generated successfully",
      "🏁 Test completed"
    ],
    executionTime,
    memoryUsed: Math.floor(Math.random() * 200) + 100 // Simulate 100-300MB
  };
}

async function simulateDockerCleanup(containerName: string) {
  // Simulate cleanup
  await new Promise(resolve => setTimeout(resolve, 500));
  return true;
}

export const getTestHistory = action({
  args: {
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    // In a real implementation, fetch from database
    return [
      {
        id: "test-1",
        query: "What is 2 + 2?",
        response: "2 + 2 equals 4.",
        success: true,
        executionTime: 1.2,
        timestamp: Date.now() - 3600000,
      },
      {
        id: "test-2", 
        query: "Write a Python function to calculate fibonacci",
        response: "Here's a Python function to calculate fibonacci numbers...",
        success: true,
        executionTime: 2.8,
        timestamp: Date.now() - 1800000,
      }
    ];
  }
});
