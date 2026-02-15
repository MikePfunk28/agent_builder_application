import { describe, it, expect } from "vitest";

/**
 * Test suite for ArchitecturePreview tier detection logic
 * 
 * This tests the determineDeploymentTier function which is the core
 * logic for determining which AWS tier to use based on deployment type and model.
 */

// Extract the tier determination logic for testing
function determineDeploymentTier(deploymentType: string, model: string): string {
  // Personal: AWS (Fargate) - Docker, Ollama, or custom models
  // Check these first as they take priority
  if (deploymentType === "docker" || deploymentType === "ollama") {
    return "personal";
  }

  // Freemium: AgentCore - Bedrock models only
  // Bedrock models can be identified by:
  // 1. Containing "bedrock" in the name
  // 2. Using AWS Bedrock provider prefixes (anthropic., amazon., meta., cohere., ai21., mistral.)
  if (deploymentType === "aws") {
    const bedrockProviders = ["anthropic.", "amazon.", "meta.", "cohere.", "ai21.", "mistral."];
    const isBedrockModel = model.includes("bedrock") || 
                          bedrockProviders.some(provider => model.startsWith(provider));
    
    if (isBedrockModel) {
      return "freemium";
    }
    
    // Non-Bedrock AWS deployments use Fargate (personal tier)
    return "personal";
  }

  // Default to freemium for local development
  return "freemium";
}

describe("ArchitecturePreview - Tier Detection", () => {
  describe("Freemium (AgentCore)", () => {
    it("should return tier1 for AWS deployment with Bedrock model", () => {
      const tier = determineDeploymentTier("aws", "bedrock-claude-v3");
      expect(tier).toBe("freemium");
    });

    it("should return tier1 for AWS deployment with anthropic.claude-3-5-sonnet model", () => {
      const tier = determineDeploymentTier("aws", "anthropic.claude-3-5-sonnet-20240620-v1:0");
      expect(tier).toBe("freemium");
    });

    it("should return tier1 for AWS deployment with any bedrock model variant", () => {
      const tier = determineDeploymentTier("aws", "amazon.titan-text-express-v1:bedrock");
      expect(tier).toBe("freemium");
    });

    it("should return tier1 for local deployment type (default)", () => {
      const tier = determineDeploymentTier("local", "gpt-4");
      expect(tier).toBe("freemium");
    });

    it("should return tier1 for unknown deployment type (default)", () => {
      const tier = determineDeploymentTier("unknown", "some-model");
      expect(tier).toBe("freemium");
    });
  });

  describe("Personal (AWS Fargate)", () => {
    it("should return tier2 for docker deployment type", () => {
      const tier = determineDeploymentTier("docker", "llama-3.1-70b");
      expect(tier).toBe("personal");
    });

    it("should return tier2 for ollama deployment type", () => {
      const tier = determineDeploymentTier("ollama", "llama3.2");
      expect(tier).toBe("personal");
    });

    it("should return tier2 for AWS deployment with non-Bedrock model", () => {
      const tier = determineDeploymentTier("aws", "gpt-4");
      expect(tier).toBe("personal");
    });

    it("should return tier2 for AWS deployment with OpenAI model", () => {
      const tier = determineDeploymentTier("aws", "openai/gpt-4-turbo");
      expect(tier).toBe("personal");
    });

    it("should return tier2 for docker deployment with any model", () => {
      const tier = determineDeploymentTier("docker", "custom-model-v1");
      expect(tier).toBe("personal");
    });

    it("should return tier2 for ollama deployment with Bedrock-named model (deployment type takes precedence)", () => {
      const tier = determineDeploymentTier("ollama", "bedrock-clone");
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

    it("should handle case-sensitive bedrock check", () => {
      const tier = determineDeploymentTier("aws", "Bedrock-Model");
      expect(tier).toBe("personal"); // Should not match due to case sensitivity
    });

    it("should handle bedrock substring in model name", () => {
      const tier = determineDeploymentTier("aws", "my-bedrock-custom-model");
      expect(tier).toBe("freemium"); // Should match because it contains "bedrock"
    });

    it("should handle AWS deployment type with different casing", () => {
      const tier = determineDeploymentTier("AWS", "bedrock-model");
      expect(tier).toBe("freemium"); // Falls through to default (freemium) since "AWS" !== "aws"
    });
  });

  describe("Real-world Model Examples", () => {
    it("should correctly classify Claude 3.5 Sonnet on Bedrock", () => {
      const tier = determineDeploymentTier("aws", "anthropic.claude-3-5-sonnet-20240620-v1:0");
      expect(tier).toBe("freemium");
    });

    it("should correctly classify Claude 3 Haiku on Bedrock", () => {
      const tier = determineDeploymentTier("aws", "anthropic.claude-3-haiku-20240307-v1:0");
      expect(tier).toBe("freemium");
    });

    it("should correctly classify Llama 3.1 on Ollama", () => {
      const tier = determineDeploymentTier("ollama", "llama3.1:70b");
      expect(tier).toBe("personal");
    });

    it("should correctly classify custom Docker model", () => {
      const tier = determineDeploymentTier("docker", "my-custom-model:latest");
      expect(tier).toBe("personal");
    });

    it("should correctly classify Amazon Titan on Bedrock", () => {
      const tier = determineDeploymentTier("aws", "amazon.titan-text-express-v1");
      expect(tier).toBe("freemium"); // Starts with "amazon." provider prefix
    });

    it("should correctly classify Bedrock model with prefix", () => {
      const tier = determineDeploymentTier("aws", "bedrock:anthropic.claude-v3");
      expect(tier).toBe("freemium");
    });

    it("should correctly classify Meta Llama on Bedrock", () => {
      const tier = determineDeploymentTier("aws", "meta.llama3-70b-instruct-v1:0");
      expect(tier).toBe("freemium");
    });

    it("should correctly classify Cohere Command on Bedrock", () => {
      const tier = determineDeploymentTier("aws", "cohere.command-text-v14");
      expect(tier).toBe("freemium");
    });

    it("should correctly classify AI21 Jurassic on Bedrock", () => {
      const tier = determineDeploymentTier("aws", "ai21.j2-ultra-v1");
      expect(tier).toBe("freemium");
    });

    it("should correctly classify Mistral on Bedrock", () => {
      const tier = determineDeploymentTier("aws", "mistral.mistral-7b-instruct-v0:2");
      expect(tier).toBe("freemium");
    });
  });

  describe("Deployment Type Priority", () => {
    it("should prioritize docker deployment type over model name", () => {
      const tier = determineDeploymentTier("docker", "bedrock-model");
      expect(tier).toBe("personal");
    });

    it("should prioritize ollama deployment type over model name", () => {
      const tier = determineDeploymentTier("ollama", "bedrock-model");
      expect(tier).toBe("personal");
    });

    it("should check model name only for aws deployment type", () => {
      const tier = determineDeploymentTier("aws", "openai-gpt4");
      expect(tier).toBe("personal"); // Non-Bedrock AWS models use Fargate (personal tier)
    });
  });
});
