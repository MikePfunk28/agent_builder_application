import { useState, useEffect, useCallback, useRef, type ChangeEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import {
  Bot,
  Settings,
  Code,
  Rocket,
  ChevronRight,
  ChevronLeft,
  Trash2,
  Copy,
  Download,
  Upload,
  TestTube,
  Network,
  Shield,
  AlertCircle,
  CheckCircle,
  Sparkles
} from "lucide-react";
import { ModelSelector } from "./ModelSelector";
import { listModelsByProvider } from "../data/modelCatalog";
import { ToolSelector } from "./ToolSelector";
import { CodePreview } from "./CodePreview";
import { AgentTester } from "./AgentTester";
import { AgentMCPConfig } from "./AgentMCPConfig";
import { AgentMCPTester } from "./AgentMCPTester";
import { ArchitecturePreview } from "./ArchitecturePreview";
import { AWSAuthModal } from "./AWSAuthModal";
import { useBuilderAutomation, WorkflowResult } from "../context/BuilderAutomationContext";

interface Tool {
  name: string;
  type: string;
  config?: any;
  requiresPip?: boolean;
  pipPackages?: string[];
}

interface AgentConfig {
  name: string;
  description: string;
  model: string;
  systemPrompt: string;
  tools: Tool[];
  deploymentType: string;
  exposableAsMCPTool?: boolean;
  mcpToolName?: string;
  mcpInputSchema?: any;
  mcpConfig?: { servers: Array<{ name: string; url: string }> };
}

const steps = [
  { id: "basic", title: "Basic Info", icon: Bot },
  { id: "model", title: "Model & Prompt", icon: Settings },
  { id: "tools", title: "Tools", icon: Code },
  { id: "architecture", title: "Architecture", icon: Network },
  { id: "test", title: "Test", icon: TestTube },
  { id: "deploy", title: "Deploy", icon: Rocket },
];

export function AgentBuilder() {
  const [currentStep, setCurrentStep] = useState( 0 );
  const [config, setConfig] = useState<AgentConfig>( {
    name: "",
    description: "",
    model: ( () => { const [m] = listModelsByProvider( "bedrock" ); return m?.id ?? "anthropic.claude-haiku-4-5-20251001-v1:0"; } )(),
    systemPrompt: "",
    tools: [],
    deploymentType: "aws",
    exposableAsMCPTool: false,
    mcpToolName: "",
    mcpInputSchema: undefined,
  } );
  const [generatedCode, setGeneratedCode] = useState<string>( "" );
  const [dockerConfig, setDockerConfig] = useState<string>( "" );
  const [requirementsTxt, setRequirementsTxt] = useState<string>( "" );
  const [isGenerating, setIsGenerating] = useState( false );
  const [savedAgentId, setSavedAgentId] = useState<Id<"agents"> | null>( null );
  const fileInputRef = useRef<HTMLInputElement | null>( null );

  const { automationData, workflowResult, setWorkflowResult, clearAutomation } = useBuilderAutomation();
  const [automationStatus, setAutomationStatus] = useState<"idle" | "running" | "complete" | "error">( "idle" );
  const [automationError, setAutomationError] = useState<string | null>( null );
  const [automationSummary, setAutomationSummary] = useState<WorkflowResult | null>( workflowResult );
  const [lastAutomationStamp, setLastAutomationStamp] = useState<number | null>( null );
  const [isAutoGenerating, setIsAutoGenerating] = useState( false );

  const generateAgent = useAction( api.codeGenerator.generateAgent );
  const createAgent = useMutation( api.agents.create );
  const executeWorkflow = useAction( api.agentBuilderWorkflow.executeCompleteWorkflow );

  const handleNext = () => {
    if ( currentStep < steps.length - 1 ) {
      setCurrentStep( currentStep + 1 );
    }
  };

  const handlePrevious = () => {
    if ( currentStep > 0 ) {
      setCurrentStep( currentStep - 1 );
    }
  };

  const handleGenerate = () => {
    if ( !config.name || !config.systemPrompt ) {
      toast.error( "Please fill in all required fields" );
      return;
    }

    setIsGenerating( true );
    void ( async () => {
      try {
        const result = await generateAgent( {
          name: config.name,
          model: config.model,
          systemPrompt: config.systemPrompt,
          tools: config.tools,
          deploymentType: config.deploymentType,
        } );

        setGeneratedCode( result.generatedCode );
        setDockerConfig( "" ); // Docker config not returned by generator
        setRequirementsTxt( result.requirementsTxt || "" );
        toast.success( "Agent generated successfully!" );
      } catch ( error ) {
        toast.error( "Failed to generate agent" );
        console.error( error );
      } finally {
        setIsGenerating( false );
      }
    } )();
  };

  const handleSave = () => {
    if ( !generatedCode ) {
      toast.error( "Please generate the agent first" );
      return;
    }

    void ( async () => {
      try {
        const agentId = await createAgent( {
          name: config.name,
          description: config.description,
          model: config.model,
          systemPrompt: config.systemPrompt,
          tools: config.tools,
          generatedCode,
          dockerConfig,
          deploymentType: config.deploymentType,
          isPublic: false,
          exposableAsMCPTool: config.exposableAsMCPTool,
          mcpToolName: config.mcpToolName,
          mcpInputSchema: config.mcpInputSchema,
        } );

        setSavedAgentId( agentId );
        toast.success( "Agent saved successfully!" );
      } catch ( error ) {
        toast.error( "Failed to save agent" );
        console.error( error );
      }
    } )();
  };

  const generateDeploymentPackage = useAction( api.deploymentPackageGenerator.generateDeploymentPackage );
  const generateDeploymentPackageWithoutSaving = useAction( api.deploymentPackageGenerator.generateDeploymentPackageWithoutSaving );

  useEffect( () => {
    if ( !automationData ) {
      setLastAutomationStamp( null );
      if ( !workflowResult ) {
        setAutomationSummary( null );
        setAutomationStatus( "idle" );
        setAutomationError( null );
      }
      return;
    }

    if ( lastAutomationStamp === automationData.createdAt ) {
      return;
    }

    setLastAutomationStamp( automationData.createdAt );
    setAutomationStatus( "running" );
    setAutomationError( null );
    setAutomationSummary( null );
    setCurrentStep( 0 );
    setGeneratedCode( "" );
    setDockerConfig( "" );
    setRequirementsTxt( "" );
    setSavedAgentId( null );

    let cancelled = false;

    void ( async () => {
      try {
        const result = await executeWorkflow( {
          userRequest: automationData.prompt,
          conversationId: automationData.conversationId,
        } );

        if ( cancelled ) return;

        setAutomationSummary( result as WorkflowResult );
        setWorkflowResult( result as WorkflowResult );
        setAutomationStatus( "complete" );
        toast.success( "Builder automation completed. Review the plan below." );
      } catch ( error: any ) {
        const message = error?.message || "Automation workflow failed";
        if ( cancelled ) return;
        setAutomationStatus( "error" );
        setAutomationError( message );
        toast.error( "Automation workflow failed", { description: message } );
      }
    } )();

    return () => {
      cancelled = true;
    };
  }, [automationData, executeWorkflow, lastAutomationStamp, setWorkflowResult] );

  useEffect( () => {
    if ( workflowResult ) {
      setAutomationSummary( workflowResult );
      if ( automationStatus === "running" ) {
        setAutomationStatus( "complete" );
      }
    }
  }, [workflowResult, automationStatus] );

  const handleAutoGenerateFromPlan = useCallback( async () => {
    if ( !automationSummary ) {
      toast.error( "No automation plan available yet" );
      return;
    }

    const requirementsOutput = automationSummary.workflow.find( ( stage ) =>
      stage.stage.includes( "requirements" )
    )?.output || automationData?.prompt || "";

    const architectureOutput = automationSummary.workflow.find( ( stage ) =>
      stage.stage.includes( "architecture" )
    )?.output || "";

    const implementationOutput = automationSummary.workflow.find( ( stage ) =>
      stage.stage.includes( "implementation" )
    )?.output || "";

    const finalOutput = automationSummary.finalOutput || "";

    const nameMatch = requirementsOutput.match( /Agent Name[:\-]\s*(.+)/i );
    let derivedName = nameMatch ? nameMatch[1].trim() : "";
    if ( !derivedName ) {
      derivedName = `Automated Agent ${new Date().toLocaleTimeString()}`;
    }
    derivedName = derivedName.replace( /["'`]/g, "" ).slice( 0, 80 ) || "Automated Agent";

    const derivedDescription = requirementsOutput.trim().slice( 0, 400 ) || "Automatically generated agent description.";

    const derivedSystemPrompt = [finalOutput, implementationOutput, architectureOutput]
      .filter( Boolean )
      .join( "\n\n" )
      .trim() || requirementsOutput.trim();

    const autoConfig: AgentConfig = {
      name: derivedName,
      description: derivedDescription,
      model: config.model,
      systemPrompt: derivedSystemPrompt,
      tools: config.tools,
      deploymentType: "aws",
      exposableAsMCPTool: false,
      mcpToolName: "",
      mcpInputSchema: undefined,
    };

    setConfig( autoConfig );
    setIsGenerating( true );
    setIsAutoGenerating( true );
    setSavedAgentId( null );

    try {
      const response = await generateAgent( {
        name: autoConfig.name,
        model: autoConfig.model,
        systemPrompt: autoConfig.systemPrompt,
        tools: autoConfig.tools,
        deploymentType: autoConfig.deploymentType,
      } );

      setGeneratedCode( response.generatedCode );
      setDockerConfig( "" );
      setRequirementsTxt( response.requirementsTxt || "" );
      toast.success( "Agent generated from automation plan" );
      setCurrentStep( 4 );
    } catch ( error ) {
      console.error( error );
      toast.error( "Automatic generation failed", {
        description: error instanceof Error ? error.message : undefined,
      } );
    } finally {
      setIsGenerating( false );
      setIsAutoGenerating( false );
    }
  }, [automationSummary, automationData, config.tools, generateAgent] );

  const handleExportConfig = useCallback( () => {
    const payload = {
      config,
      generatedCode,
      requirementsTxt,
      automationSummary,
      timestamp: Date.now(),
    };

    const blob = new Blob( [JSON.stringify( payload, null, 2 )], { type: "application/json" } );
    const url = URL.createObjectURL( blob );
    const link = document.createElement( "a" );
    link.href = url;
    const safeName = ( config.name || "agent" ).toLowerCase().replace( /[^a-z0-9]+/g, "_" );
    link.download = `${safeName || "agent"}_builder_state.json`;
    link.click();
    URL.revokeObjectURL( url );
    toast.success( "Builder state exported" );
  }, [config, generatedCode, requirementsTxt, automationSummary] );

  const handleImportConfig = useCallback( () => {
    fileInputRef.current?.click();
  }, [] );

  const handleImportFileSelected = useCallback( async ( event: ChangeEvent<HTMLInputElement> ) => {
    const file = event.target.files?.[0];
    if ( !file ) return;

    try {
      const text = await file.text();
      const data = JSON.parse( text );

      if ( data.config ) {
        setConfig( ( prev ) => ( {
          ...prev,
          ...data.config,
        } ) );
      }

      if ( typeof data.generatedCode === "string" ) {
        setGeneratedCode( data.generatedCode );
      }
      if ( typeof data.requirementsTxt === "string" ) {
        setRequirementsTxt( data.requirementsTxt );
      }
      if ( data.automationSummary ) {
        setAutomationSummary( data.automationSummary as WorkflowResult );
        setWorkflowResult( data.automationSummary as WorkflowResult );
        setAutomationStatus( "complete" );
        setAutomationError( null );
      }

      setSavedAgentId( null );
      toast.success( "Builder state imported" );
    } catch ( error: any ) {
      toast.error( "Failed to import configuration", {
        description: error?.message,
      } );
    } finally {
      event.target.value = "";
    }
  }, [setConfig, setWorkflowResult] );

  const handleDownload = async () => {
    // Allow download even without saving - generate package on the fly
    const agentToDownload = savedAgentId || {
      name: config.name,
      description: config.description,
      model: config.model,
      systemPrompt: config.systemPrompt,
      tools: config.tools,
      generatedCode: generatedCode,
      deploymentType: config.deploymentType,
      mcpServers: config.mcpConfig?.servers || [],
    };

    if ( !generatedCode ) {
      toast.error( "Please generate the agent code first" );
      return;
    }

    try {
      toast.info( "Generating deployment package..." );

      const deploymentTarget = config.deploymentType;
      const includeCLIScript = ["docker", "ollama", "aws"].includes( deploymentTarget );

      let packageData;

      if ( savedAgentId ) {
        // Use saved agent
        packageData = await generateDeploymentPackage( {
          agentId: savedAgentId,
          options: {
            includeCloudFormation: deploymentTarget === 'aws',
            includeCLIScript,
            includeLambdaConfig: deploymentTarget === 'lambda',
            deploymentTarget,
          },
        } );
      } else {
        // Generate package without saving
        packageData = await generateDeploymentPackageWithoutSaving( {
          agent: agentToDownload as any,
          options: {
            includeCloudFormation: deploymentTarget === 'aws',
            includeCLIScript,
            includeLambdaConfig: deploymentTarget === 'lambda',
            deploymentTarget,
          },
        } );
      }

      // Create ZIP file with JSZip
      const JSZip = ( await import( 'jszip' ) ).default;
      const zip = new JSZip();

      // Add all files to ZIP
      Object.entries( packageData.files ).forEach( ( [filename, content] ) => {
        // Handle binary files (PNG, images) - they're base64 encoded
        if ( filename.endsWith( '.png' ) || filename.endsWith( '.jpg' ) || filename.endsWith( '.jpeg' ) || filename.endsWith( '.svg' ) ) {
          zip.file( filename, content, { base64: true } );
        } else {
          zip.file( filename, content );
        }
      } );

      // Generate ZIP blob
      const zipBlob = await zip.generateAsync( { type: 'blob' } );

      // Download ZIP
      const url = URL.createObjectURL( zipBlob );
      const a = document.createElement( "a" );
      a.href = url;
      a.download = `${config.name.toLowerCase().replace( /\s+/g, "_" )}_deployment_package.zip`;
      document.body.appendChild( a );
      a.click();
      document.body.removeChild( a );
      URL.revokeObjectURL( url );

      toast.success( "Deployment package downloaded successfully!" );
    } catch ( error: any ) {
      console.error( "Download failed:", error );
      toast.error( error.message || "Failed to download deployment package" );
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={handleImportFileSelected}
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-green-400">Agent Builder</h1>
          <p className="text-sm text-green-600">Design, generate, and deploy Bedrock agents with strandsagents tooling.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleImportConfig}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-green-900/40 bg-black/40 hover:border-green-400 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import JSON
          </button>
          <button
            onClick={handleExportConfig}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-green-900/40 bg-black/40 hover:border-green-400 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export JSON
          </button>
        </div>
      </div>

      {( automationData || automationSummary ) && (
        <AutomationSummaryPanel
          status={automationStatus}
          promptPreview={automationData?.prompt || automationSummary?.workflow?.[0]?.output || ""}
          summary={automationSummary}
          error={automationError}
          onClear={clearAutomation}
          onGenerate={automationSummary ? handleAutoGenerateFromPlan : undefined}
          isGenerating={isGenerating || isAutoGenerating}
        />
      )}

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map( ( step, index ) => {
            const Icon = step.icon;
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;

            return (
              <div key={step.id} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all ${isActive
                    ? "border-green-400 bg-green-400/10 text-green-400"
                    : isCompleted
                      ? "border-green-600 bg-green-600/10 text-green-600"
                      : "border-gray-600 text-gray-600"
                    }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="ml-3">
                  <div className={`text-sm font-medium ${isActive ? "text-green-400" : "text-gray-400"}`}>
                    {step.title}
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <ChevronRight className="w-5 h-5 text-gray-600 mx-4" />
                )}
              </div>
            );
          } )}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-gray-900/50 rounded-xl border border-green-900/30 p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {currentStep === 0 && <BasicInfoStep config={config} setConfig={setConfig} />}
            {currentStep === 1 && <ModelPromptStep config={config} setConfig={setConfig} />}
            {currentStep === 2 && <ToolsStep config={config} setConfig={setConfig} />}
            {currentStep === 3 && <ArchitectureStep config={config} />}
            {currentStep === 4 && (
              <TestStep
                agentId={savedAgentId}
                agentCode={generatedCode}
                requirements={requirementsTxt}
                dockerfile={dockerConfig}
                agentName={config.name}
                modelId={config.model}
                onGenerate={handleGenerate}
                onSave={handleSave}
                isGenerating={isGenerating}
              />
            )}
            {currentStep === 5 && (
              <DeployStep
                config={config}
                setConfig={setConfig}
                generatedCode={generatedCode}
                dockerConfig={dockerConfig}
                requirementsTxt={requirementsTxt}
                isGenerating={isGenerating}
                savedAgentId={savedAgentId}
                onGenerate={handleGenerate}
                onSave={handleSave}
                onDownload={() => void handleDownload()}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <button
          onClick={handlePrevious}
          disabled={currentStep === 0}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>

        <button
          onClick={handleNext}
          disabled={currentStep === steps.length - 1}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

interface AutomationSummaryPanelProps {
  status: "idle" | "running" | "complete" | "error";
  promptPreview: string;
  summary: WorkflowResult | null;
  error?: string | null;
  onClear: () => void;
  onGenerate?: () => void;
  isGenerating?: boolean;
}

function AutomationSummaryPanel( {
  status,
  promptPreview,
  summary,
  error,
  onClear,
  onGenerate,
  isGenerating,
}: Readonly<AutomationSummaryPanelProps> ) {
  const statusLabel = () => {
    switch ( status ) {
      case "running":
        return "Running automation workflow...";
      case "complete":
        return "Automation plan ready";
      case "error":
        return "Automation failed";
      default:
        return "Automation status";
    }
  };

  const statusColor =
    status === "complete"
      ? "text-emerald-400"
      : status === "error"
        ? "text-red-400"
        : status === "running"
          ? "text-blue-400"
          : "text-green-600";

  return (
    <div className="mb-8 bg-gray-900/50 border border-green-900/30 rounded-xl p-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-green-400 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Interleaved Workflow Automation
          </h2>
          <p className={`text-sm mt-1 ${statusColor}`}>{statusLabel()}</p>
          {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
        </div>
        <div className="flex items-center gap-2">
          {status === "complete" && onGenerate && (
            <button
              onClick={onGenerate}
              disabled={isGenerating}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
            >
              {isGenerating ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Generate Agent from Plan
            </button>
          )}
          <button
            onClick={onClear}
            className="px-3 py-2 text-sm rounded-lg border border-green-900/40 text-green-500 hover:border-green-400 transition-colors"
          >
            Clear Automation
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="bg-black/40 border border-green-900/30 rounded-lg p-4">
          <h3 className="text-sm font-medium text-green-300 mb-2">Conversation Summary</h3>
          <p className="text-xs text-green-500 whitespace-pre-wrap max-h-40 overflow-y-auto">
            {promptPreview ? promptPreview.slice( 0, 1600 ) : "Awaiting conversation details..."}
            {promptPreview.length > 1600 && "..."}
          </p>
        </div>
        <div className="bg-black/40 border border-green-900/30 rounded-lg p-4">
          <h3 className="text-sm font-medium text-green-300 mb-2">Token Usage</h3>
          {summary ? (
            <div className="text-xs text-green-500 space-y-2">
              <div className="flex justify-between">
                <span>Input tokens</span>
                <span>{summary.totalUsage.inputTokens}</span>
              </div>
              <div className="flex justify-between">
                <span>Output tokens</span>
                <span>{summary.totalUsage.outputTokens}</span>
              </div>
              <div className="pt-2 border-t border-green-900/40">
                <span className="text-green-400">Stages completed:</span>
                <span className="ml-2 text-green-500">{summary.workflow.length}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-green-600">Token usage will appear once the workflow finishes.</p>
          )}
        </div>
      </div>

      {summary && (
        <div className="mt-6 space-y-3">
          {summary.workflow.map( ( stage ) => (
            <details key={stage.stage} className="bg-black/40 border border-green-900/30 rounded-lg">
              <summary className="cursor-pointer text-sm font-medium text-green-300 px-4 py-3">
                {stage.stage.replace( /_/g, " " )}
              </summary>
              <div className="px-4 pb-4 text-xs text-green-500 whitespace-pre-wrap">
                {stage.output}
              </div>
            </details>
          ) )}
        </div>
      )}
    </div>
  );
}

function BasicInfoStep( { config, setConfig }: { config: AgentConfig; setConfig: ( config: AgentConfig ) => void } ) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-green-400 mb-6">Basic Information</h2>

      <div>
        <label className="block text-sm font-medium text-green-400 mb-2">
          Agent Name *
        </label>
        <input
          type="text"
          value={config.name}
          onChange={( e ) => setConfig( { ...config, name: e.target.value } )}
          placeholder="My Awesome Agent"
          className="w-full px-4 py-3 bg-black border border-green-900/30 rounded-lg text-green-400 placeholder-green-600 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition-colors"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-green-400 mb-2">
          Description
        </label>
        <textarea
          value={config.description}
          onChange={( e ) => setConfig( { ...config, description: e.target.value } )}
          placeholder="Describe what your agent does..."
          rows={4}
          className="w-full px-4 py-3 bg-black border border-green-900/30 rounded-lg text-green-400 placeholder-green-600 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition-colors resize-none"
        />
      </div>
    </div>
  );
}

function ModelPromptStep( { config, setConfig }: { config: AgentConfig; setConfig: ( config: AgentConfig ) => void } ) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-green-400 mb-6">Model & System Prompt</h2>

      <ModelSelector
        value={config.model}
        onChange={( model ) => setConfig( { ...config, model } )}
      />

      <div>
        <label className="block text-sm font-medium text-green-400 mb-2">
          System Prompt *
        </label>
        <textarea
          value={config.systemPrompt}
          onChange={( e ) => setConfig( { ...config, systemPrompt: e.target.value } )}
          placeholder="You are a helpful AI agent that..."
          rows={8}
          className="w-full px-4 py-3 bg-black border border-green-900/30 rounded-lg text-green-400 placeholder-green-600 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition-colors resize-none font-mono text-sm"
        />
        <p className="text-xs text-green-600 mt-2">
          Define your agent's personality, capabilities, and behavior guidelines.
        </p>
      </div>
    </div>
  );
}

function ToolsStep( { config, setConfig }: { config: AgentConfig; setConfig: ( config: AgentConfig ) => void } ) {
  const addTool = ( tool: Tool ) => {
    setConfig( {
      ...config,
      tools: [...config.tools, tool],
    } );
  };

  const removeTool = ( index: number ) => {
    setConfig( {
      ...config,
      tools: config.tools.filter( ( _, i ) => i !== index ),
    } );
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-green-400 mb-6">Tools & Capabilities</h2>

      <ToolSelector onAddTool={addTool} />

      {config.tools.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-medium text-green-400">Selected Tools</h3>
          {config.tools.map( ( tool, index ) => (
            <div
              key={index}
              className="flex items-center justify-between p-4 bg-black border border-green-900/30 rounded-lg"
            >
              <div>
                <div className="font-medium text-green-400">{tool.name}</div>
                <div className="text-sm text-green-600">{tool.type}</div>
                {tool.requiresPip && (
                  <div className="text-xs text-yellow-400 mt-1">
                    Requires: {tool.pipPackages?.join( ", " )}
                  </div>
                )}
              </div>
              <button
                onClick={() => removeTool( index )}
                className="p-2 text-red-400 hover:text-red-300 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ) )}
        </div>
      )}
    </div>
  );
}

function DeployStep( {
  config,
  setConfig,
  generatedCode,
  dockerConfig,
  requirementsTxt,
  isGenerating,
  savedAgentId,
  onGenerate,
  onSave,
  onDownload,
}: {
  config: AgentConfig;
  setConfig: ( config: AgentConfig ) => void;
  generatedCode: string;
  dockerConfig: string;
  requirementsTxt: string;
  isGenerating: boolean;
  savedAgentId: Id<"agents"> | null;
  onGenerate: () => void;
  onSave: () => void;
  onDownload: () => void;
} ) {
  const [showAWSDeployment, setShowAWSDeployment] = useState( false );
  const [showAWSAuthModal, setShowAWSAuthModal] = useState( false );
  const [deploymentConfig, setDeploymentConfig] = useState( {
    region: 'us-east-1',
    agentName: config.name.replace( /[^a-zA-Z0-9-]/g, '-' ).toLowerCase() || 'my-agent',
    description: config.description || '',
    enableMonitoring: true,
    enableAutoScaling: true,
  } );
  const [isDeploying, setIsDeploying] = useState( false );
  const hasAWSCredentials = useQuery( api.awsAuth.hasValidAWSCredentials );

  const deployToAWS = useMutation( api.awsDeployment.deployToAWS as any );

  const handleMCPConfigChange = ( mcpConfig: {
    exposableAsMCPTool: boolean;
    mcpToolName?: string;
    mcpInputSchema?: any;
  } ) => {
    setConfig( {
      ...config,
      exposableAsMCPTool: mcpConfig.exposableAsMCPTool,
      mcpToolName: mcpConfig.mcpToolName,
      mcpInputSchema: mcpConfig.mcpInputSchema,
    } );
  };

  const handleDeployToAWS = () => {
    if ( !savedAgentId ) {
      toast.error( "Please save the agent first" );
      return;
    }

    if ( hasAWSCredentials === false ) {
      toast.info( "Connect your AWS account before deploying." );
      setShowAWSAuthModal( true );
      return;
    }

    if ( hasAWSCredentials === undefined ) {
      toast.info( "Checking AWS credentials..." );
      return;
    }

    setIsDeploying( true );
    void ( async () => {
      try {
        await deployToAWS( {
          agentId: savedAgentId,
          deploymentConfig,
        } );
        toast.success( "Deployment started successfully!" );
      } catch ( error: any ) {
        console.error( "Deployment failed:", error );
        toast.error( error.message || "Deployment failed" );
      } finally {
        setIsDeploying( false );
      }
    } )();
  };

  const regions = [
    { value: 'us-east-1', label: 'US East (N. Virginia)' },
    { value: 'us-west-2', label: 'US West (Oregon)' },
    { value: 'eu-central-1', label: 'Europe (Frankfurt)' },
    { value: 'ap-southeast-2', label: 'Asia Pacific (Sydney)' },
  ];

  // Calculate estimated cost based on deployment type and tools
  const calculateEstimatedCost = () => {
    const baseCost = config.deploymentType === 'aws' ? 0.10 : 0.05;
    const toolCost = config.tools.length * 0.02;
    return ( baseCost + toolCost ).toFixed( 2 );
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-green-400 mb-6">Deployment Configuration</h2>

      <div>
        <label className="block text-sm font-medium text-green-400 mb-2">
          Deployment Type
        </label>
        <select
          value={config.deploymentType}
          onChange={( e ) => setConfig( { ...config, deploymentType: e.target.value } )}
          className="w-full px-4 py-3 bg-black border border-green-900/30 rounded-lg text-green-400 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition-colors"
        >
          <option value="docker">Docker Container</option>
          <option value="aws">AWS (Bedrock)</option>
          <option value="ollama">Ollama</option>
          <option value="local">Local Development</option>
        </select>
      </div>

      {/* Architecture Preview */}
      {generatedCode && (
        <div className="bg-gray-900/30 border border-green-900/30 rounded-lg p-4">
          <h3 className="text-lg font-medium text-green-400 mb-3 flex items-center gap-2">
            <Network className="w-5 h-5" />
            Architecture Overview
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-green-300">Model:</span>
              <span className="text-green-400 font-mono">{config.model}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-green-300">Tools:</span>
              <span className="text-green-400">{config.tools.length} configured</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-green-300">Deployment:</span>
              <span className="text-green-400 capitalize">{config.deploymentType}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-green-300">Estimated Cost:</span>
              <span className="text-yellow-400 font-medium">${calculateEstimatedCost()}/hour</span>
            </div>
          </div>

          {/* Tool Dependencies */}
          {config.tools.length > 0 && (
            <div className="mt-4 pt-4 border-t border-green-900/30">
              <h4 className="text-sm font-medium text-green-400 mb-2">Tool Dependencies</h4>
              <div className="space-y-2">
                {config.tools.map( ( tool, idx ) => (
                  <div key={idx} className="flex items-start gap-2 text-xs">
                    <div className="w-2 h-2 rounded-full bg-green-500 mt-1" />
                    <div>
                      <div className="text-green-300 font-medium">{tool.name}</div>
                      {tool.pipPackages && tool.pipPackages.length > 0 && (
                        <div className="text-green-600">
                          Requires: {tool.pipPackages.join( ", " )}
                        </div>
                      )}
                    </div>
                  </div>
                ) )}
              </div>
            </div>
          )}

          {/* AWS Resources */}
          {config.deploymentType === 'aws' && (
            <div className="mt-4 pt-4 border-t border-green-900/30">
              <h4 className="text-sm font-medium text-green-400 mb-2">AWS Resources Required</h4>
              <div className="space-y-1 text-xs text-green-300">
                <div>• AWS Bedrock AgentCore Sandbox</div>
                <div>• CloudWatch Logs</div>
                <div>• IAM Role for execution</div>
                {config.tools.length > 0 && <div>• Lambda functions for tools</div>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MCP Tool Configuration */}
      <AgentMCPConfig
        exposableAsMCPTool={config.exposableAsMCPTool}
        mcpToolName={config.mcpToolName}
        mcpInputSchema={config.mcpInputSchema}
        agentName={config.name}
        onConfigChange={handleMCPConfigChange}
      />

      {/* MCP Testing - Show if agent is exposable and saved */}
      {config.exposableAsMCPTool && config.mcpToolName && generatedCode && (
        <AgentMCPTester
          mcpToolName={config.mcpToolName}
          mcpInputSchema={config.mcpInputSchema}
        />
      )}

      <div className="flex gap-4">
        <button
          onClick={onGenerate}
          disabled={isGenerating}
          className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isGenerating ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
          ) : (
            <Code className="w-4 h-4" />
          )}
          Generate Agent
        </button>

        {generatedCode && (
          <>
            <button
              onClick={onSave}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Copy className="w-4 h-4" />
              Save Agent
            </button>

            <button
              onClick={onDownload}
              className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download
            </button>

            {config.deploymentType === 'aws' && (
              <button
                onClick={() => setShowAWSDeployment( !showAWSDeployment )}
                className="flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                <Rocket className="w-4 h-4" />
                {showAWSDeployment ? 'Hide' : 'Deploy to AWS'}
              </button>
            )}
          </>
        )}
      </div>

      {/* AWS Deployment Panel */}
      {showAWSDeployment && generatedCode && config.deploymentType === 'aws' && (
        <div className="bg-gray-900/30 border border-orange-900/30 rounded-lg p-6">
          <h3 className="text-xl font-bold text-orange-400 mb-4">Deploy to AWS AgentCore</h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 p-3 bg-black/40 border border-green-900/30 rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                {hasAWSCredentials ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span className="text-green-300">AWS access configured</span>
                  </>
                ) : hasAWSCredentials === undefined ? (
                  <>
                    <AlertCircle className="w-4 h-4 text-yellow-400 animate-pulse" />
                    <span className="text-yellow-300">Checking AWS access...</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-red-400" />
                    <span className="text-red-300">AWS access not configured</span>
                  </>
                )}
              </div>
              <button
                onClick={() => setShowAWSAuthModal( true )}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors"
              >
                <Shield className="w-4 h-4" />
                {hasAWSCredentials ? "Update AWS Access" : "Configure AWS Access"}
              </button>
            </div>

            {/* Agent Name */}
            <div>
              <label className="block text-sm font-medium text-green-400 mb-2">
                Agent Name
              </label>
              <input
                type="text"
                value={deploymentConfig.agentName}
                onChange={( e ) => setDeploymentConfig( prev => ( { ...prev, agentName: e.target.value } ) )}
                className="w-full px-4 py-3 bg-black border border-green-900/30 rounded-lg text-green-400 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition-colors"
                placeholder="my-agent"
              />
              <p className="text-xs text-green-600 mt-1">
                Must be lowercase, alphanumeric with hyphens only
              </p>
            </div>

            {/* Region */}
            <div>
              <label className="block text-sm font-medium text-green-400 mb-2">
                AWS Region
              </label>
              <select
                value={deploymentConfig.region}
                onChange={( e ) => setDeploymentConfig( prev => ( { ...prev, region: e.target.value } ) )}
                className="w-full px-4 py-3 bg-black border border-green-900/30 rounded-lg text-green-400 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition-colors"
              >
                {regions.map( region => (
                  <option key={region.value} value={region.value}>
                    {region.label}
                  </option>
                ) )}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-green-400 mb-2">
                Description (Optional)
              </label>
              <textarea
                value={deploymentConfig.description}
                onChange={( e ) => setDeploymentConfig( prev => ( { ...prev, description: e.target.value } ) )}
                rows={2}
                className="w-full px-4 py-3 bg-black border border-green-900/30 rounded-lg text-green-400 placeholder-green-600 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition-colors resize-none"
                placeholder="Describe what this agent does..."
              />
            </div>

            {/* Options */}
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={deploymentConfig.enableMonitoring}
                  onChange={( e ) => setDeploymentConfig( prev => ( { ...prev, enableMonitoring: e.target.checked } ) )}
                  className="rounded border-green-900/30 text-green-600 focus:ring-green-400 bg-black"
                />
                <span className="ml-2 text-sm text-green-300">Enable monitoring and logging</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={deploymentConfig.enableAutoScaling}
                  onChange={( e ) => setDeploymentConfig( prev => ( { ...prev, enableAutoScaling: e.target.checked } ) )}
                  className="rounded border-green-900/30 text-green-600 focus:ring-green-400 bg-black"
                />
                <span className="ml-2 text-sm text-green-300">Enable auto-scaling</span>
              </label>
            </div>

            {/* Deploy Button */}
            <button
              onClick={handleDeployToAWS}
              disabled={isDeploying || !deploymentConfig.agentName}
              className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center"
            >
              {isDeploying ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Deploying to AWS...
                </>
              ) : (
                <>
                  <Rocket className="w-4 h-4 mr-2" />
                  Deploy to AWS AgentCore
                </>
              )}
            </button>

            {/* Cost Estimate */}
            <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 text-blue-400 mt-0.5">💰</div>
                <div>
                  <h4 className="text-sm font-medium text-blue-400">Estimated Cost</h4>
                  <p className="text-sm text-blue-300 mt-1">
                    ~${calculateEstimatedCost()}/hour when active + model usage costs
                  </p>
                  <p className="text-xs text-blue-400 mt-1">
                    You only pay when your agent is processing requests
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {generatedCode && (
        <CodePreview
          code={generatedCode}
          dockerConfig={dockerConfig}
          requirementsTxt={requirementsTxt}
          deploymentType={config.deploymentType}
        />
      )}

      <AWSAuthModal
        isOpen={showAWSAuthModal}
        onClose={() => setShowAWSAuthModal( false )}
        onSuccess={() => {
          toast.success( "AWS access configured successfully" );
        }}
      />
    </div>
  );
}

function ArchitectureStep( { config }: { config: AgentConfig } ) {
  const [showDiagramCode, setShowDiagramCode] = useState( false );
  const generateDiagram = useAction( api.diagramGenerator.generateArchitectureDiagram );
  const [diagramCode, setDiagramCode] = useState<string>( "" );
  const [isGenerating, setIsGenerating] = useState( false );

  const handleGenerateDiagram = () => {
    if ( !config.name ) return;

    setIsGenerating( true );
    void generateDiagram( {
      agentName: config.name,
      deploymentType: config.deploymentType,
      model: config.model,
      tools: config.tools,
    } ).then( ( result ) => {
      if ( result.success && result.diagramCode ) {
        setDiagramCode( result.diagramCode );
        setShowDiagramCode( true );
        toast.success( "Diagram code generated! (MCP integration coming soon)" );
      }
    } ).catch( ( error ) => {
      toast.error( "Failed to generate diagram" );
      console.error( error );
    } ).finally( () => {
      setIsGenerating( false );
    } );
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-green-400 mb-6">Architecture Preview</h2>

      <ArchitecturePreview
        agentName={config.name}
        model={config.model}
        tools={config.tools}
        deploymentType={config.deploymentType}
      />

      {/* Architecture Diagram Section */}
      <div className="bg-gray-900/50 border border-green-900/30 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-green-400 flex items-center gap-2">
            <Network className="w-5 h-5" />
            Architecture Diagram
          </h3>
          <button
            onClick={handleGenerateDiagram}
            disabled={isGenerating || !config.name}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            {isGenerating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Generating...
              </>
            ) : (
              <>
                <Network className="w-4 h-4" />
                Generate Diagram Code
              </>
            )}
          </button>
        </div>

        {showDiagramCode && diagramCode ? (
          <div className="space-y-3">
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Python Diagrams Code</span>
                <button
                  onClick={() => {
                    void navigator.clipboard.writeText( diagramCode );
                    toast.success( "Copied to clipboard!" );
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Copy
                </button>
              </div>
              <pre className="text-xs text-green-400 overflow-x-auto">
                <code>{diagramCode}</code>
              </pre>
            </div>
            <p className="text-xs text-gray-500">
              💡 Tip: Run this code with the <code className="text-green-400">diagrams</code> package to generate a visual diagram.
              MCP integration for automatic diagram generation coming soon!
            </p>
          </div>
        ) : (
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-8 text-center">
            <Network className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm mb-2">
              No diagram generated yet
            </p>
            <p className="text-gray-500 text-xs">
              Click "Generate Diagram Code" to create Python code for visualizing your architecture
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function TestStep( {
  agentId,
  agentCode,
  requirements,
  dockerfile,
  agentName,
  modelId,
  onGenerate,
  onSave,
  isGenerating
}: {
  agentId: Id<"agents"> | null;
  agentCode: string;
  requirements: string;
  dockerfile: string;
  agentName: string;
  modelId: string;
  onGenerate: () => void;
  onSave: () => void;
  isGenerating: boolean;
} ) {
  if ( !agentCode ) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-green-400 mb-6">Test Your Agent</h2>
        <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <TestTube className="w-5 h-5 text-yellow-400 mt-0.5" />
            <div>
              <h3 className="font-medium text-yellow-400 mb-2">Generate Agent First</h3>
              <p className="text-yellow-300/70 text-sm mb-4">
                You need to generate your agent code before you can test it.
              </p>
              <button
                onClick={onGenerate}
                disabled={isGenerating}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isGenerating ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  <Code className="w-4 h-4" />
                )}
                Generate Agent
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if ( !agentId ) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-green-400 mb-6">Test Your Agent</h2>
        <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <TestTube className="w-5 h-5 text-blue-400 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-400 mb-2">Save Agent First</h3>
              <p className="text-blue-300/70 text-sm mb-4">
                You need to save your agent before you can test it. This allows the testing system to track your agent's tests and results.
              </p>
              <button
                onClick={onSave}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Copy className="w-4 h-4" />
                Save Agent
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-green-400 mb-6">Test Your Agent</h2>
      <div className="bg-green-900/10 border border-green-600/30 rounded-lg p-4 mb-4">
        <p className="text-green-300 text-sm">
          Test your agent in a containerized environment to see how it behaves with actual models and tools.
          This helps you catch issues before deployment!
        </p>
      </div>
      <AgentTester
        agentId={agentId}
        agentCode={agentCode}
        requirements={requirements}
        dockerfile={dockerfile}
        agentName={agentName}
        modelId={modelId}
      />
    </div>
  );
}
