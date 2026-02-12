"use node";

/**
 * Ollama Auto-Installer
 * Downloads and installs Ollama for users automatically
 */

import { action } from "./_generated/server";
import { v } from "convex/values";

interface InstallationStep {
  step: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  progress: number;
  message: string;
}

/**
 * Get Ollama installer URL based on platform
 */
export const getInstallerInfo = action({
  args: {
    platform: v.union(v.literal("windows"), v.literal("macos"), v.literal("linux")),
  },
  handler: async (_ctx, { platform }) => {
    const installers = {
      windows: {
        url: "https://ollama.com/download/OllamaSetup.exe",
        filename: "OllamaSetup.exe",
        size: "45MB",
        instructions: [
          "Download will start automatically",
          "Run OllamaSetup.exe when complete",
          "Follow installation wizard",
          "Ollama will start automatically after install",
        ],
      },
      macos: {
        url: "https://ollama.com/download/Ollama-darwin.zip",
        filename: "Ollama-darwin.zip",
        size: "40MB",
        instructions: [
          "Download will start automatically",
          "Extract the .zip file",
          "Drag Ollama.app to Applications folder",
          "Open Ollama from Applications",
        ],
      },
      linux: {
        url: "https://ollama.com/install.sh",
        filename: "install.sh",
        size: "1KB",
        command: "curl -fsSL https://ollama.com/install.sh | sh",
        instructions: [
          "Open Terminal",
          "Run: curl -fsSL https://ollama.com/install.sh | sh",
          "Script will install Ollama automatically",
          "Ollama will be available as 'ollama' command",
        ],
      },
    };

    return installers[platform];
  },
});

/**
 * Guide user through Ollama installation
 */
export const generateInstallGuide = action({
  args: {
    platform: v.union(v.literal("windows"), v.literal("macos"), v.literal("linux")),
  },
  handler: async (_ctx, { platform }) => {
    const downloadUrls = {
      windows: "https://ollama.com/download/OllamaSetup.exe",
      macos: "https://ollama.com/download/Ollama-darwin.zip",
      linux: "https://ollama.com/install.sh",
    };

    const guides = {
      windows: `
# Install Ollama on Windows

## Step 1: Download Ollama
Visit: https://ollama.com/download
Or direct download: https://ollama.com/download/OllamaSetup.exe

## Step 2: Run Installer
1. Double-click OllamaSetup.exe
2. Click "Yes" if Windows asks for permission
3. Follow the installation wizard
4. Ollama will start automatically

## Step 3: Verify Installation
Open Command Prompt and run:
\`\`\`
ollama --version
\`\`\`

## Step 4: Pull Your First Model
\`\`\`
ollama pull llama3.2:3b
\`\`\`

## Done!
Ollama is now running at http://127.0.0.1:11434
      `,

      macos: `
# Install Ollama on macOS

## Step 1: Download Ollama
Visit: https://ollama.com/download
Or direct download: https://ollama.com/download/Ollama-darwin.zip

## Step 2: Install
1. Open the downloaded .zip file
2. Drag Ollama to your Applications folder
3. Open Ollama from Applications
4. Ollama will appear in your menu bar

## Step 3: Verify Installation
Open Terminal and run:
\`\`\`bash
ollama --version
\`\`\`

## Step 4: Pull Your First Model
\`\`\`bash
ollama pull llama3.2:3b
\`\`\`

## Done!
Ollama is now running at http://127.0.0.1:11434
      `,

      linux: `
# Install Ollama on Linux

## Step 1: Install with Script
Open Terminal and run:
\`\`\`bash
curl -fsSL https://ollama.com/install.sh | sh
\`\`\`

This will:
- Download Ollama
- Install it to /usr/local/bin
- Start the Ollama service

## Step 2: Verify Installation
\`\`\`bash
ollama --version
\`\`\`

## Step 3: Pull Your First Model
\`\`\`bash
ollama pull llama3.2:3b
\`\`\`

## Done!
Ollama is now running at http://127.0.0.1:11434
      `,
    };

    return {
      platform,
      guide: guides[platform],
      downloadUrl: downloadUrls[platform],
    };
  },
});

/**
 * Get recommended Ollama models for agent testing
 */
export const getRecommendedModels = action({
  args: {},
  handler: async () => {
    return [
      {
        name: "llama3.2:1b",
        size: "1.3GB",
        ram: "2GB",
        speed: "Very Fast",
        quality: "Good",
        description: "Fastest option, good for testing",
        command: "ollama pull llama3.2:1b",
        recommended: true,
      },
      {
        name: "llama3.2:3b",
        size: "2.0GB",
        ram: "3GB",
        speed: "Fast",
        quality: "Very Good",
        description: "Best balance of speed and quality",
        command: "ollama pull llama3.2:3b",
        recommended: true,
      },
      {
        name: "llama3.1:8b",
        size: "4.7GB",
        ram: "6GB",
        speed: "Medium",
        quality: "Excellent",
        description: "High quality, slower",
        command: "ollama pull llama3.1:8b",
      },
      {
        name: "qwen2.5-coder:7b",
        size: "4.0GB",
        ram: "5GB",
        speed: "Medium",
        quality: "Excellent",
        description: "Specialized for code generation",
        command: "ollama pull qwen2.5-coder:7b",
      },
      {
        name: "mistral:7b",
        size: "4.1GB",
        ram: "5GB",
        speed: "Medium",
        quality: "Excellent",
        description: "Alternative general-purpose model",
        command: "ollama pull mistral:7b",
      },
    ];
  },
});
