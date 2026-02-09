/**
 * Server-side message executor - handles actual API calls to Bedrock and Ollama.
 *
 * This module MUST live under convex/ because it imports the AWS SDK and
 * accesses environment variables that are only available in the Node.js runtime.
 *
 * The pure composition logic (composeWorkflow) stays in src/engine/messageComposer.ts
 * so the frontend can use it for previews without pulling in AWS dependencies.
 */

import type { ComposedMessages } from "../../src/engine/messageComposer";

export async function executeComposedMessages(
  composed: ComposedMessages
): Promise<{ text: string; raw: any }> {
  if (composed.kind === "tool-only") {
    return {
      text: "",
      raw: { kind: "tool-only" },
    };
  }

  if (composed.kind === "bedrock" && composed.bedrock) {
    const { BedrockRuntimeClient, ConverseCommand } = await import(
      "@aws-sdk/client-bedrock-runtime"
    );
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    if (accessKeyId && !secretAccessKey) {
      throw new Error("AWS_SECRET_ACCESS_KEY is required when AWS_ACCESS_KEY_ID is set");
    }
    const client = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || process.env.BEDROCK_REGION || "us-east-1",
      credentials: accessKeyId && secretAccessKey
        ? { accessKeyId, secretAccessKey }
        : undefined,
    });

    const response = await client.send(
      new ConverseCommand({
        modelId: composed.bedrock.modelId,
        messages: composed.bedrock.messages as any,
        inferenceConfig: composed.bedrock.inferenceConfig,
      })
    );

    const text =
      response.output?.message?.content
        ?.map((content: any) => ("text" in content ? content.text : ""))
        .join("") ?? "";

    return { text, raw: response };
  }

  if (composed.kind === "ollama" && composed.ollama) {
    const response = await fetch(`${composed.ollama.endpoint}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: composed.ollama.model,
        messages: composed.ollama.messages,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status}`);
    }

    const json = await response.json();
    const text = json.message?.content ?? "";

    return { text, raw: json };
  }

  throw new Error(`Unsupported composition kind: ${composed.kind}`);
}
