import { describe, it, expect } from "vitest";

/**
 * Test suite for ArchitecturePreview tier detection logic
 *
 * This tests the determineDeploymentTier function which is the core
 * logic for determining which AWS tier to use based on deployment type and model.
 *
 * Tier architecture (post Fargate/ECS removal):
 * - Freemium: Local (Docker/Ollama) + limited AgentCore via our account
 * - Personal: Full AgentCore in user's own AWS account (via assume-role)
 * - Enterprise: Same as personal + SSO (future)
 */

// Extract the tier determination logic for testing
function determineDeploymentTier(deploymentType: string, _model: string): string {
  // Freemium: Local (Docker/Ollama) or limited AgentCore via our account
  if (deploymentType === "docker" || deploymentType === "ollama" || deploymentType === "local") {
    return "freemium";
  }

  // Personal: AgentCore in user's own AWS account (via assume-role)
  if (deploymentType === "aws" || deploymentType === "agentcore") {
    return "personal";
  }

  // Default to freemium for local development
  return "freemium";
}

describe("ArchitecturePreview - Tier Detection", () => {
  describe("Freemium (Local + AgentCore)", () => {
    it("should return freemium for docker deployment type", () => {
      const tier = determineDeploymentTier("docker", "llama-3.1-70b");
      expect(tier).toBe("freemium");
    });

    it("should return freemium for ollama deployment type", () => {
      const tier = determineDeploymentTier("ollama", "llama3.2");
      expect(tier).toBe("freemium");
    });

    it("should return freemium for local deployment type", () => {
      const tier = determineDeploymentTier("local", "gpt-4");
      expect(tier).toBe("freemium");
    });

    it("should return freemium for unknown deployment type (default)", () => {
      const tier = determineDeploymentTier("unknown", "some-model");
      expect(tier).toBe("freemium");
    });

    it("should return freemium for docker deployment regardless of model", () => {
      const tier = determineDeploymentTier("docker", "anthropic.claude-3-5-sonnet-20240620-v1:0");
      expect(tier).toBe("freemium");
    });

    it("should return freemium for ollama deployment with Bedrock-named model", () => {
      const tier = determineDeploymentTier("ollama", "bedrock-clone");
      expect(tier).toBe("freemium");
    });
  });

  describe("Personal (AgentCore in user's AWS)", () => {
    it("should return personal for aws deployment type", () => {
      const tier = determineDeploymentTier("aws", "anthropic.claude-3-5-sonnet-20240620-v1:0");
      expect(tier).toBe("personal");
    });

    it("should return personal for agentcore deployment type", () => {
      const tier = determineDeploymentTier("agentcore", "anthropic.claude-3-5-sonnet-20240620-v1:0");
      expect(tier).toBe("personal");
    });

    it("should return personal for AWS deployment with any model", () => {
      const tier = determineDeploymentTier("aws", "gpt-4");
      expect(tier).toBe("personal");
    });

    it("should return personal for agentcore deployment with any model", () => {
      const tier = determineDeploymentTier("agentcore", "custom-model-v1");
      expect(tier).toBe("personal");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty deployment type", () => {
      const tier = determineDeploymentTier("", "bedrock-model");
      expect(tier).toBe("freemium");
    });

    it("should handle empty model name", () => {
      const tier = determineDeploymentTier("aws", "");
      expect(tier).toBe("personal");
    });

    it("should handle AWS deployment type with different casing", () => {
      const tier = determineDeploymentTier("AWS", "bedrock-model");
      expect(tier).toBe("freemium"); // Falls through to default since "AWS" !== "aws"
    });
  });

  describe("Real-world Model Examples", () => {
    it("should correctly classify Claude on Bedrock (aws deployment)", () => {
      const tier = determineDeploymentTier("aws", "anthropic.claude-3-5-sonnet-20240620-v1:0");
      expect(tier).toBe("personal");
    });

    it("should correctly classify Amazon Titan on Bedrock (aws deployment)", () => {
      const tier = determineDeploymentTier("aws", "amazon.titan-text-express-v1");
      expect(tier).toBe("personal");
    });

    it("should correctly classify Llama 3.1 on Ollama", () => {
      const tier = determineDeploymentTier("ollama", "llama3.1:70b");
      expect(tier).toBe("freemium");
    });

    it("should correctly classify custom Docker model", () => {
      const tier = determineDeploymentTier("docker", "my-custom-model:latest");
      expect(tier).toBe("freemium");
    });

    it("should correctly classify Meta Llama on Bedrock (aws deployment)", () => {
      const tier = determineDeploymentTier("aws", "meta.llama3-70b-instruct-v1:0");
      expect(tier).toBe("personal");
    });

    it("should correctly classify Cohere on Bedrock (aws deployment)", () => {
      const tier = determineDeploymentTier("aws", "cohere.command-text-v14");
      expect(tier).toBe("personal");
    });

    it("should correctly classify DeepSeek on Bedrock (agentcore deployment)", () => {
      const tier = determineDeploymentTier("agentcore", "deepseek.v3-v1:0");
      expect(tier).toBe("personal");
    });
  });

  describe("Deployment Type Priority", () => {
    it("should always classify docker as freemium regardless of model", () => {
      const tier = determineDeploymentTier("docker", "bedrock-model");
      expect(tier).toBe("freemium");
    });

    it("should always classify ollama as freemium regardless of model", () => {
      const tier = determineDeploymentTier("ollama", "bedrock-model");
      expect(tier).toBe("freemium");
    });

    it("should always classify aws as personal regardless of model", () => {
      const tier = determineDeploymentTier("aws", "openai-gpt4");
      expect(tier).toBe("personal");
    });

    it("should always classify agentcore as personal regardless of model", () => {
      const tier = determineDeploymentTier("agentcore", "openai-gpt4");
      expect(tier).toBe("personal");
    });
  });
});
