"use node";

/**
 * Local Model Detection and Management System
 *
 * Detects and manages local AI models:
 * - Ollama (primary)
 * - LlamaCpp
 * - LMStudio
 * - GGUF models
 * - Custom implementations
 */

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { execSync, spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

interface LocalModelInfo {
  provider: 'ollama' | 'llamacpp' | 'lmstudio' | 'gguf' | 'custom';
  name: string;
  version: string;
  status: 'running' | 'stopped' | 'not_found';
  endpoint?: string;
  models?: string[];
  capabilities?: string[];
}

interface ModelDetectionResult {
  detected: LocalModelInfo[];
  recommendations: string[];
  setupRequired: boolean;
}

/**
 * Detect all available local AI model providers
 */
export const detectLocalModels = internalAction({
  args: {},
  handler: async (ctx): Promise<ModelDetectionResult> => {
    const detected: LocalModelInfo[] = [];
    const recommendations: string[] = [];

    // 1. Check Ollama
    const ollamaResult = await detectOllama();
    if (ollamaResult.status !== 'not_found') {
      detected.push(ollamaResult);
    } else {
      recommendations.push("Ollama not detected. Install Ollama for local model support.");
    }

    // 2. Check LlamaCpp
    const llamaCppResult = await detectLlamaCpp();
    if (llamaCppResult.status !== 'not_found') {
      detected.push(llamaCppResult);
    }

    // 3. Check LMStudio
    const lmStudioResult = await detectLMStudio();
    if (lmStudioResult.status !== 'not_found') {
      detected.push(lmStudioResult);
    }

    // 4. Check for GGUF models
    const ggufResult = await detectGGUF();
    if (ggufResult.status !== 'not_found') {
      detected.push(ggufResult);
    }

    return {
      detected,
      recommendations,
      setupRequired: detected.length === 0
    };
  },
});

/**
 * Detect Ollama installation and running models
 */
async function detectOllama(): Promise<LocalModelInfo> {
  try {
    // Check if Ollama is running
    const response = await fetch('http://localhost:11434/api/tags', {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });

    if (response.ok) {
      const data = await response.json();
      const models = data.models?.map((m: any) => m.name) || [];

      return {
        provider: 'ollama',
        name: 'Ollama',
        version: 'detected',
        status: 'running',
        endpoint: 'http://localhost:11434',
        models,
        capabilities: ['text-generation', 'embeddings', 'vision']
      };
    }
  } catch (error) {
    // Try to check if Ollama binary exists
    try {
      execSync('ollama --version', { timeout: 5000 });
      return {
        provider: 'ollama',
        name: 'Ollama',
        version: 'installed',
        status: 'stopped',
        capabilities: ['text-generation', 'embeddings', 'vision']
      };
    } catch {
      // Ollama not found
    }
  }

  return {
    provider: 'ollama',
    name: 'Ollama',
    version: 'not_found',
    status: 'not_found'
  };
}

/**
 * Detect LlamaCpp installation
 */
async function detectLlamaCpp(): Promise<LocalModelInfo> {
  try {
    const { execSync } = require('child_process');

    // Check for llama.cpp binary
    const output = execSync('llama-cli --version 2>/dev/null || llama.cpp --version 2>/dev/null || echo "not_found"', {
      encoding: 'utf8',
      timeout: 5000
    });

    if (!output.includes('not_found')) {
      return {
        provider: 'llamacpp',
        name: 'LlamaCpp',
        version: output.trim(),
        status: 'stopped',
        capabilities: ['text-generation', 'chat']
      };
    }
  } catch (error) {
    // LlamaCpp not found
  }

  return {
    provider: 'llamacpp',
    name: 'LlamaCpp',
    version: 'not_found',
    status: 'not_found'
  };
}

/**
 * Detect LMStudio installation
 */
async function detectLMStudio(): Promise<LocalModelInfo> {
  try {
    const { execSync } = require('child_process');

    // Check for LMStudio
    const output = execSync('lmstudio --version 2>/dev/null || echo "not_found"', {
      encoding: 'utf8',
      timeout: 5000
    });

    if (!output.includes('not_found')) {
      return {
        provider: 'lmstudio',
        name: 'LMStudio',
        version: output.trim(),
        status: 'stopped',
        capabilities: ['text-generation', 'chat', 'embeddings']
      };
    }
  } catch (error) {
    // LMStudio not found
  }

  return {
    provider: 'lmstudio',
    name: 'LMStudio',
    version: 'not_found',
    status: 'not_found'
  };
}

/**
 * Detect GGUF model files
 */
async function detectGGUF(): Promise<LocalModelInfo> {
  try {
    const fs = require('fs');
    const path = require('path');

    // Common directories to check for GGUF files
    const searchDirs = [
      process.env.HOME || process.env.USERPROFILE,
      '/opt/models',
      '/usr/local/models',
      './models'
    ];

    const foundModels: string[] = [];

    for (const dir of searchDirs) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir, { recursive: true });
        const ggufFiles = files.filter((file: string) =>
          typeof file === 'string' && file.toLowerCase().endsWith('.gguf')
        );
        foundModels.push(...ggufFiles.map((file: string) => path.basename(file)));
      }
    }

    if (foundModels.length > 0) {
      return {
        provider: 'gguf',
        name: 'GGUF Models',
        version: 'detected',
        status: 'stopped',
        models: foundModels,
        capabilities: ['text-generation', 'chat']
      };
    }
  } catch (error) {
    // GGUF detection failed
  }

  return {
    provider: 'gguf',
    name: 'GGUF Models',
    version: 'not_found',
    status: 'not_found'
  };
}

/**
 * Install and setup Ollama automatically
 */
export const setupOllama = internalAction({
  args: {
    platform: v.string(), // 'windows', 'macos', 'linux'
    installModels: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args): Promise<{ success: boolean; message: string; endpoint?: string }> => {
    try {
      const { execSync } = require('child_process');
      const os = require('os');
      const platform = args.platform || os.platform();

      let installCommand = '';

      switch (platform) {
        case 'win32':
          // Windows installation
          installCommand = `
            curl -fsSL https://ollama.ai/install.sh | sh
            ollama serve &
          `;
          break;

        case 'darwin':
          // macOS installation
          installCommand = `
            brew install ollama
            brew services start ollama
          `;
          break;

        case 'linux':
          // Linux installation
          installCommand = `
            curl -fsSL https://ollama.ai/install.sh | sh
            systemctl enable ollama
            systemctl start ollama
          `;
          break;

        default:
          return {
            success: false,
            message: `Unsupported platform: ${platform}`
          };
      }

      // Execute installation
      execSync(installCommand, {
        stdio: 'inherit',
        timeout: 300000 // 5 minutes timeout
      });

      // Wait for Ollama to start
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Install requested models
      if (args.installModels && args.installModels.length > 0) {
        for (const model of args.installModels) {
          try {
            execSync(`ollama pull ${model}`, {
              stdio: 'inherit',
              timeout: 600000 // 10 minutes per model
            });
          } catch (error) {
            console.warn(`Failed to install model ${model}:`, error);
          }
        }
      }

      return {
        success: true,
        message: 'Ollama installed and configured successfully',
        endpoint: 'http://localhost:11434'
      };

    } catch (error: any) {
      return {
        success: false,
        message: `Ollama setup failed: ${error.message}`
      };
    }
  },
});

/**
 * Start local model provider
 */
export const startLocalModel = internalAction({
  args: {
    provider: v.union(v.literal('ollama'), v.literal('llamacpp'), v.literal('lmstudio')),
    modelName: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; message: string; endpoint?: string }> => {
    try {
      const { execSync, spawn } = require('child_process');

      switch (args.provider) {
        case 'ollama':
          // Start Ollama server
          const ollamaProcess = spawn('ollama', ['serve'], {
            detached: true,
            stdio: 'ignore'
          });
          ollamaProcess.unref();

          // Wait for server to start
          await new Promise(resolve => setTimeout(resolve, 3000));

          return {
            success: true,
            message: 'Ollama server started',
            endpoint: 'http://localhost:11434'
          };

        case 'llamacpp':
          if (!args.modelName) {
            return {
              success: false,
              message: 'Model name required for LlamaCpp'
            };
          }

          // Start LlamaCpp server
          const llamaProcess = spawn('llama-server', ['-m', args.modelName, '--host', '127.0.0.1', '--port', '8080'], {
            detached: true,
            stdio: 'ignore'
          });
          llamaProcess.unref();

          return {
            success: true,
            message: 'LlamaCpp server started',
            endpoint: 'http://localhost:8080'
          };

        case 'lmstudio':
          // Start LMStudio local server
          const lmProcess = spawn('lmstudio', ['--local-server'], {
            detached: true,
            stdio: 'ignore'
          });
          lmProcess.unref();

          return {
            success: true,
            message: 'LMStudio local server started',
            endpoint: 'http://localhost:1234'
          };

        default:
          return {
            success: false,
            message: `Unsupported provider: ${args.provider}`
          };
      }

    } catch (error: any) {
      return {
        success: false,
        message: `Failed to start ${args.provider}: ${error.message}`
      };
    }
  },
});

/**
 * Get recommended models for different use cases
 */
export const getRecommendedModels = internalAction({
  args: {
    useCase: v.union(
      v.literal('chat'),
      v.literal('coding'),
      v.literal('analysis'),
      v.literal('creative'),
      v.literal('research')
    ),
    performance: v.optional(v.union(v.literal('fast'), v.literal('balanced'), v.literal('quality'))),
  },
  handler: async (ctx, args): Promise<{ ollama: string[]; llamacpp: string[]; lmstudio: string[] }> => {
    const recommendations = {
      chat: {
        ollama: ['llama3.2:3b', 'mistral:7b', 'phi3:3.8b'],
        llamacpp: ['llama-2-7b-chat.Q4_K_M.gguf', 'mistral-7b-instruct-v0.2.Q4_K_M.gguf'],
        lmstudio: ['microsoft/DialoGPT-medium', 'microsoft/DialoGPT-large']
      },
      coding: {
        ollama: ['codellama:7b', 'deepseek-coder:6.7b', 'starcoder2:3b'],
        llamacpp: ['codellama-7b.Q4_K_M.gguf', 'deepseek-coder-6.7b.Q4_K_M.gguf'],
        lmstudio: ['bigcode/starcoder', 'WizardLM/WizardCoder-15B-V1.0']
      },
      analysis: {
        ollama: ['llama3.1:8b', 'mixtral:8x7b', 'qwen2.5:7b'],
        llamacpp: ['llama-3.1-8b-instruct.Q4_K_M.gguf', 'qwen2.5-7b-instruct.Q4_K_M.gguf'],
        lmstudio: ['microsoft/wizardlm-2-8x22b', '01-ai/Yi-34B-Chat']
      },
      creative: {
        ollama: ['llama3.1:8b', 'mistral:7b', 'zephyr:7b'],
        llamacpp: ['llama-3.1-8b-instruct.Q4_K_M.gguf', 'zephyr-7b-beta.Q4_K_M.gguf'],
        lmstudio: ['mosaicml/mpt-7b-chat', 'lmsysorg/bakllava-1']
      },
      research: {
        ollama: ['llama3.1:70b', 'mixtral:8x7b', 'qwen2.5:72b'],
        llamacpp: ['llama-3.1-70b-instruct.Q4_K_M.gguf', 'qwen2.5-72b-instruct.Q4_K_M.gguf'],
        lmstudio: ['microsoft/wizardlm-2-8x22b', 'upstage/SOLAR-10.7B-Instruct-v1.0']
      }
    };

    const useCaseRecs = recommendations[args.useCase];

    // Adjust based on performance preference
    if (args.performance) {
      switch (args.performance) {
        case 'fast':
          // Return smaller/faster models
          return {
            ollama: useCaseRecs.ollama.filter(m => m.includes('3b') || m.includes('7b')),
            llamacpp: useCaseRecs.llamacpp.filter(m => m.includes('3b') || m.includes('7b')),
            lmstudio: useCaseRecs.lmstudio.slice(0, 2)
          };
        case 'quality':
          // Return larger/better models
          return {
            ollama: useCaseRecs.ollama.filter(m => m.includes('70b') || m.includes('72b') || m.includes('8x7b')),
            llamacpp: useCaseRecs.llamacpp.filter(m => m.includes('70b') || m.includes('72b')),
            lmstudio: useCaseRecs.lmstudio
          };
        default: // balanced
          return useCaseRecs;
      }
    }

    return useCaseRecs;
  },
});

/**
 * Test local model connectivity
 */
export const testLocalModel = internalAction({
  args: {
    provider: v.union(v.literal('ollama'), v.literal('llamacpp'), v.literal('lmstudio')),
    endpoint: v.string(),
    modelName: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; message: string; latency?: number }> => {
    const startTime = Date.now();

    try {
      switch (args.provider) {
        case 'ollama':
          const ollamaResponse = await fetch(`${args.endpoint}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: args.modelName || 'llama3.2:3b',
              prompt: 'Hello',
              stream: false
            }),
            signal: AbortSignal.timeout(10000)
          });

          if (ollamaResponse.ok) {
            return {
              success: true,
              message: 'Ollama connection successful',
              latency: Date.now() - startTime
            };
          }
          break;

        case 'llamacpp':
          const llamaResponse = await fetch(`${args.endpoint}/health`, {
            signal: AbortSignal.timeout(5000)
          });

          if (llamaResponse.ok) {
            return {
              success: true,
              message: 'LlamaCpp connection successful',
              latency: Date.now() - startTime
            };
          }
          break;

        case 'lmstudio':
          const lmResponse = await fetch(`${args.endpoint}/v1/models`, {
            signal: AbortSignal.timeout(5000)
          });

          if (lmResponse.ok) {
            return {
              success: true,
              message: 'LMStudio connection successful',
              latency: Date.now() - startTime
            };
          }
          break;
      }

      return {
        success: false,
        message: `${args.provider} connection failed`,
        latency: Date.now() - startTime
      };

    } catch (error: any) {
      return {
        success: false,
        message: `${args.provider} test failed: ${error.message}`,
        latency: Date.now() - startTime
      };
    }
  },
});