/**
 * Unified Agent Execution
 *
 * Single execution engine for ALL modalities:
 * - Text → Bedrock Claude
 * - Image → Bedrock Nova Canvas / Titan / SDXL
 * - Video → Bedrock Nova Reel
 * - Speech → Amazon Polly
 *
 * Automatically switches models based on complexity.
 */

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  decideUnifiedModelSwitch,
  getModelExecutionConfig,
  type Modality,
  type UnifiedModelDecision,
} from "./lib/unifiedModalitySwitching";

type AgentDoc = Doc<"agents">;

type ConversationMessage = {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp: number;
  reasoning?: string;
  toolCalls?: unknown;
  mediaUrls?: string[]; // For images, videos, audio
};

interface UnifiedExecutionResult {
  success: boolean;
  modality: Modality;
  content?: string;
  mediaUrls?: string[]; // S3 URLs for generated media
  error?: string;
  reasoning?: string;
  metadata?: {
    model: string;
    modelProvider: string;
    executionMethod: string;
    modalityDecision?: UnifiedModelDecision;
    originalModel?: string;
  };
}

/**
 * Unified agent execution with automatic modality and model switching
 */
export const executeUnifiedAgent = action({
  args: {
    agentId: v.id("agents"),
    conversationId: v.optional(v.id("interleavedConversations")),
    message: v.string(),
    enableDynamicSwitching: v.optional(v.boolean()),
    forceModality: v.optional(
      v.union(
        v.literal("text"),
        v.literal("image"),
        v.literal("video"),
        v.literal("speech"),
        v.literal("multimodal")
      )
    ),
  },
  handler: async (ctx, args): Promise<UnifiedExecutionResult> => {
    try {
      // Get agent
      const agent = (await ctx.runQuery(api.agents.get, {
        id: args.agentId,
      })) as AgentDoc | null;

      if (!agent) {
        throw new Error("Agent not found");
      }

      // Get conversation history
      const history: ConversationMessage[] = args.conversationId
        ? ((await ctx.runQuery(internal.interleavedReasoning.getConversationHistory, {
            conversationId: args.conversationId,
            windowSize: 10,
          })) as ConversationMessage[])
        : [];

      // Get user tier
      const user = await ctx.runQuery(internal.users.getInternal, {
        id: agent.createdBy,
      });
      const userTier = (user?.tier as "freemium" | "personal" | "enterprise") || "freemium";

      // Make modality and model switching decision
      const decision = decideUnifiedModelSwitch(
        args.message,
        history.map((m) => ({ role: m.role, content: m.content })),
        agent,
        {
          userTier,
          preferQuality: agent.modelSwitchingConfig?.preferCapability,
          preferCost: agent.modelSwitchingConfig?.preferCost,
          preferSpeed: agent.modelSwitchingConfig?.preferSpeed,
          explicitModality: args.forceModality as Modality,
        }
      );

      console.log(`[UnifiedExecution] ${decision.reasoning}`);
      console.log(`[UnifiedExecution] Selected: ${decision.selectedModel.name}`);
      console.log(`[UnifiedExecution] Estimated cost: $${decision.estimatedCost.toFixed(4)}`);

      // Execute based on modality
      let result: UnifiedExecutionResult;

      switch (decision.modality) {
        case "text":
          result = await executeText(ctx, agent, args.message, history, decision);
          break;

        case "image":
          result = await executeImage(ctx, agent, args.message, decision);
          break;

        case "video":
          result = await executeVideo(ctx, agent, args.message, decision);
          break;

        case "speech":
          result = await executeSpeech(ctx, agent, args.message, decision);
          break;

        case "multimodal":
          result = await executeMultimodal(ctx, agent, args.message, history, decision);
          break;

        default:
          throw new Error(`Unknown modality: ${decision.modality}`);
      }

      // Add decision metadata
      if (result.metadata) {
        result.metadata.modalityDecision = decision;
        result.metadata.originalModel = agent.model;
      }

      return result;
    } catch (error: unknown) {
      console.error("Unified execution error:", error);
      const message = error instanceof Error ? error.message : "Execution failed";
      return {
        success: false,
        modality: "text",
        error: message,
      };
    }
  },
});

/**
 * Execute TEXT modality
 */
async function executeText(
  ctx: ActionCtx,
  agent: AgentDoc,
  message: string,
  history: ConversationMessage[],
  decision: UnifiedModelDecision
): Promise<UnifiedExecutionResult> {
  const { BedrockRuntimeClient, InvokeModelCommand } = await import(
    "@aws-sdk/client-bedrock-runtime"
  );

  const client = new BedrockRuntimeClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  const messages = [
    ...history.map((m) => ({
      role: m.role,
      content: [{ text: m.content }],
    })),
    {
      role: "user",
      content: [{ text: message }],
    },
  ];

  const config = getModelExecutionConfig(decision);

  const payload = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: config.maxTokens,
    system: agent.systemPrompt,
    messages,
    temperature: config.temperature,
    thinking: config.thinking,
  };

  const command = new InvokeModelCommand({
    modelId: config.modelId,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(payload),
  });

  const response = await client.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));

  let content = "";
  let reasoning = "";

  for (const block of responseBody.content || []) {
    if (block.type === "text") {
      content += block.text;
    } else if (block.type === "thinking") {
      reasoning += block.thinking;
    }
  }

  return {
    success: true,
    modality: "text",
    content: content.trim(),
    reasoning: reasoning.trim() || undefined,
    metadata: {
      model: config.modelId,
      modelProvider: "bedrock",
      executionMethod: "direct-bedrock-api",
    },
  };
}

/**
 * Execute IMAGE modality
 */
async function executeImage(
  ctx: ActionCtx,
  agent: AgentDoc,
  message: string,
  decision: UnifiedModelDecision
): Promise<UnifiedExecutionResult> {
  const { BedrockRuntimeClient, InvokeModelCommand } = await import(
    "@aws-sdk/client-bedrock-runtime"
  );

  const client = new BedrockRuntimeClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  const config = getModelExecutionConfig(decision);

  const payload = {
    taskType: config.taskType,
    textToImageParams: {
      text: message,
    },
    imageGenerationConfig: config.imageGenerationConfig,
  };

  const command = new InvokeModelCommand({
    modelId: config.modelId,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(payload),
  });

  const response = await client.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));

  // Images come back as base64
  const images: string[] = responseBody.images || [];

  // Upload to S3
  const s3Keys = await uploadImagesToS3(ctx, images, agent._id);
  const imageUrls = await Promise.all(
    s3Keys.map((key) => getSignedS3Url(ctx, key))
  );

  return {
    success: true,
    modality: "image",
    content: `Generated ${images.length} image(s) using ${decision.selectedModel.name}`,
    mediaUrls: imageUrls,
    metadata: {
      model: config.modelId,
      modelProvider: "bedrock",
      executionMethod: "image-generation",
    },
  };
}

/**
 * Execute VIDEO modality
 */
async function executeVideo(
  ctx: ActionCtx,
  agent: AgentDoc,
  message: string,
  decision: UnifiedModelDecision
): Promise<UnifiedExecutionResult> {
  const { BedrockRuntimeClient, InvokeModelCommand } = await import(
    "@aws-sdk/client-bedrock-runtime"
  );

  const client = new BedrockRuntimeClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  const config = getModelExecutionConfig(decision);

  const payload = {
    taskType: config.taskType,
    textToVideoParams: {
      text: message,
    },
    videoGenerationConfig: config.videoGenerationConfig,
  };

  const command = new InvokeModelCommand({
    modelId: config.modelId,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(payload),
  });

  const response = await client.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));

  // Video comes back as base64
  const videoBase64 = responseBody.video;

  // Upload to S3
  const s3Key = await uploadVideoToS3(ctx, videoBase64, agent._id);
  const videoUrl = await getSignedS3Url(ctx, s3Key);

  return {
    success: true,
    modality: "video",
    content: `Generated video using ${decision.selectedModel.name} (${config.videoGenerationConfig.durationSeconds}s)`,
    mediaUrls: [videoUrl],
    metadata: {
      model: config.modelId,
      modelProvider: "bedrock",
      executionMethod: "video-generation",
    },
  };
}

/**
 * Execute SPEECH modality
 */
async function executeSpeech(
  ctx: ActionCtx,
  agent: AgentDoc,
  message: string,
  decision: UnifiedModelDecision
): Promise<UnifiedExecutionResult> {
  const { PollyClient, SynthesizeSpeechCommand } = await import(
    "@aws-sdk/client-polly"
  );

  const client = new PollyClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  const config = getModelExecutionConfig(decision);

  const command = new SynthesizeSpeechCommand({
    Engine: config.engine,
    VoiceId: config.voiceId,
    LanguageCode: config.languageCode,
    Text: message,
    OutputFormat: "mp3",
  });

  const response = await client.send(command);

  // Upload to S3
  const audioStream = response.AudioStream;
  if (!audioStream) {
    throw new Error("No audio stream returned");
  }

  const audioBuffer = await streamToBuffer(audioStream);
  const s3Key = await uploadAudioToS3(ctx, audioBuffer, agent._id);
  const audioUrl = await getSignedS3Url(ctx, s3Key);

  return {
    success: true,
    modality: "speech",
    content: `Generated speech using Amazon Polly (${config.engine})`,
    mediaUrls: [audioUrl],
    metadata: {
      model: `polly-${config.engine}`,
      modelProvider: "aws-polly",
      executionMethod: "speech-synthesis",
    },
  };
}

/**
 * Execute MULTIMODAL (combination)
 */
async function executeMultimodal(
  ctx: ActionCtx,
  agent: AgentDoc,
  message: string,
  history: ConversationMessage[],
  decision: UnifiedModelDecision
): Promise<UnifiedExecutionResult> {
  // Use Claude to plan the multimodal response
  const textDecision = { ...decision, modality: "text" as Modality };
  const planningResult = await executeText(ctx, agent, message, history, textDecision);

  // Extract media generation requests from Claude's response
  // (This would be enhanced with tool calling in production)
  const mediaUrls: string[] = [];

  // For now, return the text response
  return {
    success: true,
    modality: "multimodal",
    content: planningResult.content,
    mediaUrls,
    reasoning: planningResult.reasoning,
    metadata: planningResult.metadata,
  };
}

/**
 * Helper: Upload images to S3
 */
async function uploadImagesToS3(
  _ctx: ActionCtx,
  imagesBase64: string[],
  agentId: Id<"agents">
): Promise<string[]> {
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");

  const client = new S3Client({
    region: process.env.AWS_REGION || "us-east-1",
  });

  const bucket = process.env.AWS_S3_BUCKET!;
  const keys: string[] = [];

  for (let i = 0; i < imagesBase64.length; i++) {
    const buffer = Buffer.from(imagesBase64[i], "base64");
    const key = `agents/${agentId}/images/${Date.now()}_${i}.png`;

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: "image/png",
      })
    );

    keys.push(key);
  }

  return keys;
}

/**
 * Helper: Upload video to S3
 */
async function uploadVideoToS3(
  _ctx: ActionCtx,
  videoBase64: string,
  agentId: Id<"agents">
): Promise<string> {
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");

  const client = new S3Client({
    region: process.env.AWS_REGION || "us-east-1",
  });

  const bucket = process.env.AWS_S3_BUCKET!;
  const buffer = Buffer.from(videoBase64, "base64");
  const key = `agents/${agentId}/videos/${Date.now()}.mp4`;

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: "video/mp4",
    })
  );

  return key;
}

/**
 * Helper: Upload audio to S3
 */
async function uploadAudioToS3(
  _ctx: ActionCtx,
  audioBuffer: Buffer,
  agentId: Id<"agents">
): Promise<string> {
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");

  const client = new S3Client({
    region: process.env.AWS_REGION || "us-east-1",
  });

  const bucket = process.env.AWS_S3_BUCKET!;
  const key = `agents/${agentId}/audio/${Date.now()}.mp3`;

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: audioBuffer,
      ContentType: "audio/mpeg",
    })
  );

  return key;
}

/**
 * Helper: Get signed S3 URL
 */
async function getSignedS3Url(_ctx: ActionCtx, key: string): Promise<string> {
  const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

  const client = new S3Client({
    region: process.env.AWS_REGION || "us-east-1",
  });

  const bucket = process.env.AWS_S3_BUCKET!;

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  // URL expires in 1 hour
  return await getSignedUrl(client, command, { expiresIn: 3600 });
}

/**
 * Helper: Stream to buffer
 */
async function streamToBuffer(stream: any): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
