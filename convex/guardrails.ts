/**
 * Guardrails for Interleaved Reasoning
 * Ensures safe and controlled AI interactions while preserving reasoning freedom
 */

import { v } from "convex/values";

export interface GuardrailConfig {
  maxTokensPerMessage: number;
  maxMessagesPerHour: number;
  maxReasoningTokens: number;
  allowedDomains: string[];
  blockedKeywords: string[];
  requireApprovalFor: string[];
  costLimits: {
    maxCostPerMessage: number;
    maxCostPerHour: number;
    maxCostPerDay: number;
  };
  contentFilters: {
    enableProfanityFilter: boolean;
    enablePIIDetection: boolean;
    enableCodeInjectionPrevention: boolean;
  };
}

export const DEFAULT_GUARDRAILS: GuardrailConfig = {
  maxTokensPerMessage: 8000, // Increased for agent building
  maxMessagesPerHour: 100,
  maxReasoningTokens: 5000, // Increased for complex reasoning
  allowedDomains: [
    // Allow broad access for agent building research
    "wikipedia.org",
    "github.com",
    "stackoverflow.com",
    "docs.aws.amazon.com",
    "anthropic.com",
    "openai.com",
    "python.org",
    "pypi.org",
    "npmjs.com",
    "docker.com",
    "kubernetes.io",
    "medium.com",
    "dev.to",
    "arxiv.org",
  ],
  blockedKeywords: [
    // Only block actual secrets, not references to them
    // Agent building needs to discuss these concepts
  ],
  requireApprovalFor: [
    // Don't require approval for agent building activities
    // These are necessary for creating agents
  ],
  costLimits: {
    maxCostPerMessage: 0.25, // $0.25 per message (workflow mode)
    maxCostPerHour: 10.00,   // $10.00 per hour
    maxCostPerDay: 50.00,    // $50.00 per day
  },
  contentFilters: {
    enableProfanityFilter: false, // Don't filter technical content
    enablePIIDetection: true,     // Still detect PII
    enableCodeInjectionPrevention: false, // Allow code generation
  },
};

/**
 * Validate message against guardrails
 */
export function validateMessage(
  message: string,
  config: GuardrailConfig = DEFAULT_GUARDRAILS
): { allowed: boolean; reason?: string; warnings: string[] } {
  const warnings: string[] = [];

  // Check message length
  if (message.length > config.maxTokensPerMessage * 4) { // Rough token estimation
    return {
      allowed: false,
      reason: `Message too long. Maximum ${config.maxTokensPerMessage} tokens allowed.`,
      warnings,
    };
  }

  // Check for blocked keywords
  const lowerMessage = message.toLowerCase();
  for (const keyword of config.blockedKeywords) {
    if (lowerMessage.includes(keyword.toLowerCase())) {
      warnings.push(`Potentially sensitive keyword detected: ${keyword}`);
    }
  }

  // Check for PII patterns
  if (config.contentFilters.enablePIIDetection) {
    const piiPatterns = [
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /\b\d{16}\b/, // Credit card
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
    ];

    for (const pattern of piiPatterns) {
      if (pattern.test(message)) {
        warnings.push("Potential PII detected in message");
        break;
      }
    }
  }

  // Check for code injection attempts
  if (config.contentFilters.enableCodeInjectionPrevention) {
    const dangerousPatterns = [
      /eval\s*\(/,
      /exec\s*\(/,
      /system\s*\(/,
      /subprocess\./,
      /os\./,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(message)) {
        return {
          allowed: false,
          reason: "Potential code injection detected",
          warnings,
        };
      }
    }
  }

  return { allowed: true, warnings };
}

/**
 * Check rate limits for user
 */
export function checkRateLimits(
  userId: string,
  messageCount: number,
  timeWindow: number,
  config: GuardrailConfig = DEFAULT_GUARDRAILS
): { allowed: boolean; reason?: string; resetTime?: number } {
  const messagesPerHour = messageCount;
  const hoursElapsed = timeWindow / (1000 * 60 * 60);

  if (messagesPerHour > config.maxMessagesPerHour) {
    const resetTime = Date.now() + (60 * 60 * 1000); // 1 hour from now
    return {
      allowed: false,
      reason: `Rate limit exceeded. Maximum ${config.maxMessagesPerHour} messages per hour.`,
      resetTime,
    };
  }

  return { allowed: true };
}

/**
 * Calculate estimated cost for message
 */
export function calculateMessageCost(
  inputTokens: number,
  outputTokens: number,
  reasoningTokens: number = 0,
  modelId: string = "us.anthropic.claude-haiku-4-5-20250514-v1:0"
): number {
  // Claude Haiku 4.5 pricing (as of 2024)
  const inputCostPer1K = 0.00025;  // $0.00025 per 1K input tokens
  const outputCostPer1K = 0.00125; // $0.00125 per 1K output tokens
  const reasoningCostPer1K = 0.00025; // Same as input for reasoning

  const inputCost = (inputTokens / 1000) * inputCostPer1K;
  const outputCost = (outputTokens / 1000) * outputCostPer1K;
  const reasoningCost = (reasoningTokens / 1000) * reasoningCostPer1K;

  return inputCost + outputCost + reasoningCost;
}

/**
 * Check cost limits
 */
export function checkCostLimits(
  estimatedCost: number,
  userCostToday: number,
  userCostThisHour: number,
  config: GuardrailConfig = DEFAULT_GUARDRAILS
): { allowed: boolean; reason?: string } {
  if (estimatedCost > config.costLimits.maxCostPerMessage) {
    return {
      allowed: false,
      reason: `Message cost ($${estimatedCost.toFixed(4)}) exceeds limit ($${config.costLimits.maxCostPerMessage})`,
    };
  }

  if (userCostThisHour + estimatedCost > config.costLimits.maxCostPerHour) {
    return {
      allowed: false,
      reason: `Hourly cost limit ($${config.costLimits.maxCostPerHour}) would be exceeded`,
    };
  }

  if (userCostToday + estimatedCost > config.costLimits.maxCostPerDay) {
    return {
      allowed: false,
      reason: `Daily cost limit ($${config.costLimits.maxCostPerDay}) would be exceeded`,
    };
  }

  return { allowed: true };
}

/**
 * Sanitize system prompt to prevent prompt injection
 */
export function sanitizeSystemPrompt(prompt: string): string {
  // Remove potential prompt injection patterns
  const dangerousPatterns = [
    /ignore\s+previous\s+instructions/gi,
    /forget\s+everything/gi,
    /you\s+are\s+now/gi,
    /new\s+instructions/gi,
    /system\s*:/gi,
    /human\s*:/gi,
    /assistant\s*:/gi,
  ];

  let sanitized = prompt;
  for (const pattern of dangerousPatterns) {
    sanitized = sanitized.replace(pattern, "[FILTERED]");
  }

  return sanitized;
}

/**
 * Validate tool usage request
 */
export function validateToolUsage(
  toolName: string,
  parameters: any,
  config: GuardrailConfig = DEFAULT_GUARDRAILS
): { allowed: boolean; reason?: string; requiresApproval: boolean } {
  // Check if tool requires approval
  const requiresApproval = config.requireApprovalFor.some(category => 
    toolName.toLowerCase().includes(category.toLowerCase())
  );

  // Check for dangerous tool parameters
  if (toolName === "web_search" || toolName === "http_request") {
    const url = parameters.url || parameters.query;
    if (url) {
      const domain = extractDomain(url);
      if (domain && !config.allowedDomains.some(allowed => 
        domain.includes(allowed) || allowed.includes(domain)
      )) {
        return {
          allowed: false,
          reason: `Domain ${domain} not in allowed list`,
          requiresApproval: true,
        };
      }
    }
  }

  // Check for file system access
  if (toolName.includes("file") || toolName.includes("write") || toolName.includes("delete")) {
    return {
      allowed: false,
      reason: "File system access not permitted",
      requiresApproval: true,
    };
  }

  return { allowed: true, requiresApproval };
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return null;
  }
}

/**
 * Generate guardrail report
 */
export function generateGuardrailReport(
  messageValidation: ReturnType<typeof validateMessage>,
  rateLimitCheck: ReturnType<typeof checkRateLimits>,
  costCheck: ReturnType<typeof checkCostLimits>,
  toolValidations: ReturnType<typeof validateToolUsage>[]
): {
  allowed: boolean;
  warnings: string[];
  errors: string[];
  requiresApproval: boolean;
} {
  const warnings: string[] = [];
  const errors: string[] = [];
  let requiresApproval = false;

  // Collect message warnings
  warnings.push(...messageValidation.warnings);
  if (!messageValidation.allowed) {
    errors.push(messageValidation.reason!);
  }

  // Check rate limits
  if (!rateLimitCheck.allowed) {
    errors.push(rateLimitCheck.reason!);
  }

  // Check cost limits
  if (!costCheck.allowed) {
    errors.push(costCheck.reason!);
  }

  // Check tool validations
  for (const toolValidation of toolValidations) {
    if (!toolValidation.allowed) {
      errors.push(toolValidation.reason!);
    }
    if (toolValidation.requiresApproval) {
      requiresApproval = true;
    }
  }

  return {
    allowed: errors.length === 0,
    warnings,
    errors,
    requiresApproval,
  };
}