"use node";

/**
 * AgentCore Test Execution - Cost Optimized
 *
 * Executes agent tests using the cheapest possible method:
 * 1. Direct Bedrock API (cheapest)
 * 2. Lambda with @app.entrypoint (backup)
 * 3. No MCP server complexity
 */

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * Execute agent test with cost-optimized approach
 * Primary: Direct Bedrock API (cheapest)
 * Backup: Lambda with @app.entrypoint (reliable)
 * No MCP server complexity
 */
export const executeAgentCoreTest = internalAction( {
  args: {
    testId: v.id( "testExecutions" ),
    agentId: v.id( "agents" ),
    input: v.string(),
    conversationHistory: v.optional( v.array( v.any() ) ),
  },
  handler: async ( ctx, args ) => {
    const startTime = Date.now();

    try {
      // Resolve test + agent first so all limits and usage tracking are keyed to the test submitter.
      const [testDetails, agent] = await Promise.all( [
        ctx.runQuery( internal.testExecution.getTestByIdInternal, { testId: args.testId } ),
        ctx.runQuery( internal.agents.getInternal, { id: args.agentId } ),
      ] );

      if ( !testDetails ) {
        return { success: false, error: "Test not found" };
      }

      // Update status to running
      await ctx.runMutation( internal.testExecution.updateStatus, {
        testId: args.testId,
        status: "RUNNING",
      } );

      // CHECK LIMITS: keyed to test owner, not agent creator.
      if ( !agent ) {
        await ctx.runMutation( internal.testExecution.updateStatus, {
          testId: args.testId,
          status: "FAILED",
          success: false,
          error: "Agent not found",
        } );
        return { success: false, error: "Agent not found" };
      }

      const executionUserId = testDetails.userId;
      const user = await ctx.runQuery( internal.users.getInternal, { id: executionUserId } );
      const tier = user?.tier || "freemium";

      const { getTierConfig, isProviderAllowedForTier } = await import( "./lib/tierConfig" );
      const tierCfg = getTierConfig( tier );

      // Burst rate limit: enforce tier-aware per-minute ceiling
      const { checkRateLimit, buildTierRateLimitConfig } = await import( "./rateLimiter" );
      const rlCfg = buildTierRateLimitConfig( tierCfg.maxConcurrentTests, "agentTesting" );
      const rlResult = await checkRateLimit( ctx, String( executionUserId ), "agentTesting", rlCfg );
      if ( !rlResult.allowed ) {
        await ctx.runMutation( internal.testExecution.updateStatus, {
          testId: args.testId,
          status: "FAILED",
          success: false,
          error: rlResult.reason || "Rate limit exceeded. Please wait before submitting more tests.",
        } );
        return { success: false, error: "Burst rate limit exceeded" };
      }

      // Use test-level model override if set (allows designing with one model, testing with another).
      // submitTest stores the user's testModelId in modelConfig.modelId.
      const effectiveModel = testDetails.modelConfig?.modelId || agent.model;
      const effectiveProvider = testDetails.modelProvider || agent.modelProvider;

      // PROVIDER TIER GATE: Enforce per-tier allowed provider rules
      // (mirrors strandsAgentExecution.ts, strandsAgentExecutionDynamic.ts,
      // and testExecution.ts logic).
      const isOllama = effectiveProvider === "ollama";
      if ( !isOllama && !isProviderAllowedForTier( tier, "bedrock" ) ) {
        await ctx.runMutation( internal.testExecution.updateStatus, {
          testId: args.testId,
          status: "FAILED",
          success: false,
          error: `${tierCfg.displayName} tier does not allow Bedrock models. ` +
            `Allowed providers: ${tierCfg.allowedProviders.join( ", " )}. ` +
            `Use Ollama models for free, or upgrade your subscription.`,
        } );
        return { success: false, error: "Provider not allowed for tier" };
      }

      // Route based on model provider
      let result;
      let executionMethod = "bedrock";

      // Check if test uses Ollama (via override or agent config)
      if ( isOllama ) {
        result = await executeViaOllama( {
          input: args.input,
          modelId: effectiveModel,
          systemPrompt: agent.systemPrompt,
          ollamaEndpoint: agent.ollamaEndpoint || testDetails.modelConfig?.baseUrl || "http://localhost:11434",
          conversationHistory: args.conversationHistory,
        } );
        executionMethod = "ollama";
      } else {
        // PRIMARY: Direct Bedrock API (cheapest)
        result = await executeViaDirectBedrock( {
          input: args.input,
          modelId: effectiveModel,
          systemPrompt: agent.systemPrompt,
          conversationHistory: args.conversationHistory,
        } );

        // BACKUP: Lambda with @app.entrypoint if Bedrock fails or SDK misbehaves
        if ( !result.success ) {
          if ( shouldFallbackToLambda( result.error ) ) {
            console.warn(
              `Bedrock SDK failure detected (${result.error}). Falling back to Lambda for test ${args.testId}`
            );
          } else {
            console.log( `Bedrock failed, trying Lambda backup for test ${args.testId}` );
          }

          result = await executeViaLambda( {
            agentCode: agent.generatedCode,
            input: args.input,
            modelId: agent.model,
            tools: agent.tools || [],
          } );

          executionMethod = result.success ? "lambda" : "failed";
        }
      }

      const executionTime = Date.now() - startTime;

      // TRACK USAGE: Bill for Bedrock usage regardless of success/failure —
      // tokens are consumed even if the response was unusable.
      // Ollama is free so skip billing. submitTest pre-bills flat; this tracks
      // actual token usage for reconciliation.
      if ( !isOllama && result.result?.usage ) {
        try {
          await ctx.runMutation( internal.testExecution.incrementUserUsage, {
            userId: executionUserId,
            testId: args.testId,
            usage: result.result.usage,
            executionTime,
            executionMethod,
            modelId: effectiveModel,
          } );
        } catch ( billingErr ) {
          console.error( "agentcoreTestExecution: usage tracking failed (non-fatal)", {
            testId: args.testId,
            error: billingErr instanceof Error ? billingErr.message : billingErr,
          } );
        }
      }

      if ( result.success ) {
        // Update test with success
        await ctx.runMutation( internal.testExecution.updateStatus, {
          testId: args.testId,
          status: "COMPLETED",
          success: true,
          response: result.result?.response,
        } );

        return {
          success: true,
          response: result.result?.response,
          executionTime,
          executionMethod,
        };
      } else {
        // Update test with failure
        await ctx.runMutation( internal.testExecution.updateStatus, {
          testId: args.testId,
          status: "FAILED",
          success: false,
          error: result.error,
        } );

        return {
          success: false,
          error: result.error,
          executionTime,
        };
      }
    } catch ( error: any ) {
      const executionTime = Date.now() - startTime;

      console.error( "executeAgentCoreTest failed:", error );
      await ctx.runMutation( internal.testExecution.updateStatus, {
        testId: args.testId,
        status: "FAILED",
        success: false,
        error: error.message,
      } );

      return {
        success: false,
        error: error.message,
        executionTime,
      };
    }
  },
} );

/**
 * Execute via direct Bedrock API (cheapest option)
 * SUPPORTS ALL BEDROCK MODELS: Claude, Nova, Titan, Llama, Mistral, etc.
 */
async function executeViaDirectBedrock( params: {
  input: string;
  modelId: string;
  systemPrompt: string;
  conversationHistory?: any[];
} ): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    const { BedrockRuntimeClient, ConverseCommand } = await import( "@aws-sdk/client-bedrock-runtime" );

    const client = new BedrockRuntimeClient( {
      region: process.env.AWS_REGION || "us-east-1",
      ...( process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && {
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      } ),
    } );

    // Resolve model ID using authoritative shared registry
    const { resolveBedrockModelId } = await import( "./modelRegistry.js" );
    const modelId = resolveBedrockModelId( params.modelId );

    // Build conversation using Converse API (works with ALL Bedrock models)
    const messages: any[] = [];

    // Add conversation history if provided (last 5 messages for context)
    if ( params.conversationHistory ) {
      for ( const msg of params.conversationHistory.slice( -5 ) ) {
        if ( msg.role === "user" || msg.role === "assistant" ) {
          messages.push( {
            role: msg.role,
            content: [{ text: msg.content }],
          } );
        }
      }
    }

    // Add current input
    messages.push( {
      role: "user",
      content: [{ text: params.input }],
    } );

    // Use Converse API - works with ALL Bedrock models
    const command = new ConverseCommand( {
      modelId: modelId,
      messages: messages,
      system: [{ text: params.systemPrompt }],
      inferenceConfig: {
        maxTokens: 4096,
        temperature: 0.7,
      },
    } );

    // Execute with timeout
    const response = await Promise.race( [
      client.send( command ),
      new Promise<never>( ( _, reject ) =>
        setTimeout( () => reject( new Error( "Bedrock timeout" ) ), 60000 )
      ),
    ] );

    // Extract response (Converse API format)
    const responseText = response.output?.message?.content?.[0]?.text || JSON.stringify( response.output );

    return {
      success: true,
      result: {
        response: responseText,
        usage: response.usage || {},
        modelId: modelId,
      },
    };
  } catch ( error: any ) {
    console.error( "Bedrock direct invoke failed:", error );
    const message = error instanceof Error ? error.message : String( error );
    return {
      success: false,
      error: `Bedrock API failed: ${message}`,
    };
  }
}

function shouldFallbackToLambda( errorMessage?: string ) {
  if ( !errorMessage ) {
    return false;
  }
  return /is not a constructor/i.test( errorMessage ) || /bedrock runtime failed/i.test( errorMessage );
}

/**
 * Execute via Ollama (local model)
 * Uses OpenAI-compatible API
 */
async function executeViaOllama( params: {
  input: string;
  modelId: string;
  systemPrompt: string;
  ollamaEndpoint: string;
  conversationHistory?: any[];
} ): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    // Build messages array
    const messages: any[] = [];

    // Add conversation history if provided (last 5 messages for context)
    if ( params.conversationHistory ) {
      const validRoles = new Set( ["user", "assistant", "system", "tool"] );
      for ( const msg of params.conversationHistory.slice( -5 ) ) {
        if ( validRoles.has( msg.role ) ) {
          messages.push( {
            role: msg.role,
            content: msg.content,
          } );
        }
      }
    }

    // Add system message and current input
    messages.unshift( {
      role: "system",
      content: params.systemPrompt,
    } );

    messages.push( {
      role: "user",
      content: params.input,
    } );

    // Validate Ollama endpoint to prevent SSRF
    const allowedHosts = ["localhost", "127.0.0.1", "::1"];
    try {
      const endpointUrl = new URL( params.ollamaEndpoint );
      if ( !allowedHosts.includes( endpointUrl.hostname ) ) {
        throw new Error( `Ollama endpoint host '${endpointUrl.hostname}' is not allowed. Only localhost connections are permitted.` );
      }
    } catch ( e: any ) {
      if ( e.message.includes( "not allowed" ) ) throw e;
      throw new Error( `Invalid Ollama endpoint URL: ${params.ollamaEndpoint}` );
    }

    // Call Ollama's OpenAI-compatible endpoint with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout( () => controller.abort(), 30000 );
    let response: Response;
    try {
      response = await fetch( `${params.ollamaEndpoint}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify( {
          model: params.modelId,
          messages: messages,
          temperature: 0.7,
          max_tokens: 4096,
        } ),
        signal: controller.signal,
      } );
    } finally {
      clearTimeout( timeoutId );
    }

    if ( !response.ok ) {
      const errorText = await response.text();
      throw new Error( `Ollama API failed: ${response.status} ${errorText}` );
    }

    const data = await response.json();

    const responseText = data.choices?.[0]?.message?.content || "";

    return {
      success: true,
      result: {
        response: responseText,
        usage: data.usage || {},
        modelId: params.modelId,
      },
    };
  } catch ( error: any ) {
    return {
      success: false,
      error: `Ollama execution failed: ${error.message}`,
    };
  }
}

/**
 * Execute via Lambda with @app.entrypoint (backup option)
 */
async function executeViaLambda( params: {
  agentCode: string;
  input: string;
  modelId: string;
  tools: any[];
} ): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    const { LambdaClient, InvokeCommand } = await import( "@aws-sdk/client-lambda" );

    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    if ( !accessKeyId || !secretAccessKey ) {
      return { success: false, error: "AWS credentials not configured for Lambda fallback" };
    }

    const client = new LambdaClient( {
      region: process.env.AWS_REGION || "us-east-1",
      credentials: { accessKeyId, secretAccessKey },
    } );

    const command = new InvokeCommand( {
      FunctionName: process.env.AGENT_TEST_LAMBDA_FUNCTION || "agent-builder-test-runner",
      InvocationType: "RequestResponse",
      Payload: JSON.stringify( {
        agentCode: params.agentCode, // Contains @app.entrypoint
        input: params.input,
        modelId: params.modelId,
        tools: params.tools,
      } ),
    } );

    // Execute with timeout
    const response = await Promise.race( [
      client.send( command ),
      new Promise<never>( ( _, reject ) =>
        setTimeout( () => reject( new Error( "Lambda timeout" ) ), 30000 )
      )
    ] );

    if ( response.FunctionError ) {
      const rawPayload = response.Payload ? new TextDecoder().decode( response.Payload ) : "{}";
      const errorPayload = JSON.parse( rawPayload ); return {
        success: false,
        error: `Agent execution failed: ${errorPayload.errorMessage || "unknown error"}`,
      };
    }

    const result = JSON.parse( new TextDecoder().decode( response.Payload ) );
    return {
      success: true,
      result: { response: result.response || result.body },
    };
  } catch ( error: any ) {
    return {
      success: false,
      error: error.message,
    };
  }
}
