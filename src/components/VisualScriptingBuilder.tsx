import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  ConnectionMode,
  Handle,
  Position,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

// Enhanced Ecosystem Discovery Types
interface EcosystemNode {
  id: string;
  type: 'tool' | 'model' | 'agent' | 'mcp' | 'framework';
  category: string;
  provider: string;
  position: { x: number; y: number };
  metadata: NodeMetadata;
  visualState: VisualState;
  performance: PerformanceMetrics;
  cost: CostMetrics;
}

interface NodeMetadata {
  name: string;
  description: string;
  version: string;
  capabilities: string[];
  dependencies: string[];
  lastUpdated: number;
  usageCount: number;
}

interface VisualState {
  isActive: boolean;
  pulseIntensity: number;
  color: string;
  size: number;
  opacity: number;
}

interface PerformanceMetrics {
  speed: number;
  accuracy: number;
  reliability: number;
  usage: number;
}

interface CostMetrics {
  perRequest: number;
  monthly: number;
  currency: string;
  efficiency: number;
}

interface FrameworkBridge {
  sourceTool: EcosystemNode;
  targetTool: EcosystemNode;
  compatibility: number;
  translation: any;
  performance: number;
}

interface UseCaseCluster {
  name: string;
  nodes: EcosystemNode[];
  position: { x: number; y: number };
  color: string;
  connections: FrameworkBridge[];
}
import {
  Bot,
  Code,
  Server,
  Network,
  Plus,
  Save,
  Play,
  Trash2,
  Brain,
  Zap,
  X,
  Database,
  Globe,
  Cpu,
  Cloud,
  Wrench,
  FileText,
  Terminal,
  Search,
  Image,
  Video,
  Volume2,
  Calendar,
  MessageSquare,
  Layers,
  GitBranch,
  Settings,
  Activity,
  CheckCircle,
  AlertCircle,
  Clock,
  Users,
  Lock,
  Eye,
  Download,
  Upload,
  Edit,
  Copy,
  Scissors,
  RotateCcw,
  Target,
  Filter,
  Shuffle,
  Repeat,
  Timer,
  Bell,
  Mail,
  Phone,
  Camera,
  Mic,
  Headphones,
  Music,
  Film,
  Palette,
  Calculator,
  BarChart3,
  PieChart,
  TrendingUp,
  HardDrive,
  Monitor,
  Smartphone,
  Tablet,
  Watch,
  Printer,
  Speaker,
  Keyboard,
  Mouse,
  Gamepad2,
  Router,
  Wifi,
  Bluetooth,
  Battery,
  Power,
  Lightbulb,
  Thermometer,
  Droplets,
  Wind,
  Sun,
  Moon,
  Star,
  Heart,
  Shield,
  Key,
  Fingerprint,
  EyeOff,
  Home,
  Building,
  Car,
  Plane,
  Train,
  Ship,
  Truck,
  MapPin,
  Navigation,
  Compass,
  Map,
  Mountain,
  Trees,
  Flower,
  Leaf,
  Recycle,
  Trash,
  ShoppingCart,
  CreditCard,
  DollarSign,
  Euro,
  Bitcoin,
  Wallet,
  Receipt,
  Tag,
  Package,
  Gift,
  Award,
  Trophy,
  Medal,
  Crown,
  Gem,
  Diamond,
  Sparkles,
  Flame,
  Snowflake,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Tornado,
  Rainbow,
  Umbrella,
  Glasses,
  Backpack,
  Briefcase,
  Book,
  BookOpen,
  Notebook,
  Pen,
  Pencil,
  Eraser,
  Ruler,
  Microscope,
  Telescope,
  Beaker,
  TestTube,
  Atom,
  Dna,
  Stethoscope,
  Pill,
  Syringe,
  Scale,
  Weight,
  AlarmClock,
  CalendarDays,
  CalendarCheck,
  CalendarX,
  CalendarPlus,
  CalendarMinus,
  CalendarRange,
  CalendarHeart,
  CalendarClock,
  CalendarOff,
  CalendarSearch,


  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ChevronsLeftRight,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  ArrowLeftRight,
  Move,
  MoveHorizontal,
  MoveVertical,
  MoveDiagonal,
  Move3D,
  RotateCw,
  RefreshCw,
  Repeat as RepeatIcon,
  Shuffle as ShuffleIcon,
  SkipBack,
  SkipForward,
  Play as PlayIcon,
  Pause,
  PlayCircle,
  PauseCircle,
  Volume,
  VolumeX,
  Volume1,
  VolumeOff,
  Radio,
  RadioReceiver,
  Tv,
  Tv2,
  Music as MusicIcon,
  Music2,
  Music3,
  Music4,
  Disc,
  Disc2,
  Disc3,
  Album,
  AudioWaveform,
  AudioLines,
  Podcast,
  Waves,
  Laptop,
  Laptop2,
  PcCase,
  Touchpad,
  TouchpadOff,
  Joystick,
  Gamepad,
  Dice1,
  Dice2,
  Dice3,
  Dice4,
  Dice5,
  Dice6,
  Dices
} from 'lucide-react';

interface ToolNodeProps {
  data: { label: string; description: string };
  id: string;
}

function ToolNode( { data, id }: ToolNodeProps ) {
  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-blue-500 text-white relative group">
      <div className="flex items-center gap-2">
        <Code className="w-4 h-4" />
        <div>
          <div className="font-bold">{data.label}</div>
          <div className="text-xs">{data.description}</div>
        </div>
      </div>
      {/* Delete button */}
      <button
        onClick={( e ) => {
          e.stopPropagation();
          // Access delete function from window or context
          if ( ( window as any ).deleteNode ) {
            ( window as any ).deleteNode( id );
          }
        }}
        title="Delete node"
        className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600"
      >
        <X className="w-3 h-3 text-white" />
      </button>

      {/* ReactFlow Handles for proper connections */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#3b82f6', border: '2px solid white' }}
        onConnect={(params) => console.log('handle onConnect', params)}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#3b82f6', border: '2px solid white' }}
      />
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#3b82f6', border: '2px solid white' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#3b82f6', border: '2px solid white' }}
      />
    </div>
  );
}

interface AgentNodeProps {
  data: { label: string; model: string };
  id: string;
}

function AgentNode( { data, id }: AgentNodeProps ) {
  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-red-500 text-white relative group">
      <div className="flex items-center gap-2">
        <Bot className="w-4 h-4" />
        <div>
          <div className="font-bold">{data.label}</div>
          <div className="text-xs">{data.model}</div>
        </div>
      </div>
      {/* Delete button */}
      <button
        onClick={( e ) => {
          e.stopPropagation();
          if ( ( window as any ).deleteNode ) {
            ( window as any ).deleteNode( id );
          }
        }}
        title="Delete node"
        className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600"
      >
        <X className="w-3 h-3 text-white" />
      </button>

      {/* ReactFlow Handles for proper connections */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#ef4444', border: '2px solid white' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#ef4444', border: '2px solid white' }}
      />
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#ef4444', border: '2px solid white' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#ef4444', border: '2px solid white' }}
      />
    </div>
  );
}

interface MCPServerNodeProps {
  data: { label: string; status: string };
  id: string;
}

function MCPServerNode( { data, id }: MCPServerNodeProps ) {
  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-green-500 text-white relative group">
      <div className="flex items-center gap-2">
        <Server className="w-4 h-4" />
        <div>
          <div className="font-bold">{data.label}</div>
          <div className="text-xs">{data.status}</div>
        </div>
      </div>
      {/* Delete button */}
      <button
        onClick={( e ) => {
          e.stopPropagation();
          if ( ( window as any ).deleteNode ) {
            ( window as any ).deleteNode( id );
          }
        }}
        title="Delete node"
        className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600"
      >
        <X className="w-3 h-3 text-white" />
      </button>

      {/* ReactFlow Handles for proper connections */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#22c55e', border: '2px solid white' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#22c55e', border: '2px solid white' }}
      />
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#22c55e', border: '2px solid white' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#22c55e', border: '2px solid white' }}
      />
    </div>
  );
}

interface StrandsAgentNodeProps {
  data: { label: string; type: string };
  id: string;
}

interface LangchainChainNodeProps {
  data: { label: string; chainType: string };
  id: string;
}

function StrandsAgentNode( { data, id }: StrandsAgentNodeProps ) {
  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-orange-500 text-white relative group">
      <div className="flex items-center gap-2">
        <Network className="w-4 h-4" />
        <div>
          <div className="font-bold">{data.label}</div>
          <div className="text-xs">{data.type}</div>
        </div>
      </div>
      {/* Delete button */}
      <button
        onClick={( e ) => {
          e.stopPropagation();
          if ( ( window as any ).deleteNode ) {
            ( window as any ).deleteNode( id );
          }
        }}
        title="Delete node"
        className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600"
      >
        <X className="w-3 h-3 text-white" />
      </button>

      {/* ReactFlow Handles for proper connections */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#f97316', border: '2px solid white' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#f97316', border: '2px solid white' }}
      />
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#f97316', border: '2px solid white' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#f97316', border: '2px solid white' }}
      />
    </div>
  );
}

function LangchainChainNode( { data, id }: LangchainChainNodeProps ) {
  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-red-500 text-white relative group">
      <div className="flex items-center gap-2">
        <Network className="w-4 h-4" />
        <div>
          <div className="font-bold">{data.label}</div>
          <div className="text-xs">{data.chainType}</div>
        </div>
      </div>
      {/* Delete button */}
      <button
        onClick={( e ) => {
          e.stopPropagation();
          if ( ( window as any ).deleteNode ) {
            ( window as any ).deleteNode( id );
          }
        }}
        title="Delete node"
        className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600"
      >
        <X className="w-3 h-3 text-white" />
      </button>

      {/* ReactFlow Handles for proper connections */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#ef4444', border: '2px solid white' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#ef4444', border: '2px solid white' }}
      />
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#ef4444', border: '2px solid white' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#ef4444', border: '2px solid white' }}
      />
    </div>
  );
}

interface AWSServiceNodeProps {
  data: { label: string; description: string };
  id: string;
}

function AWSServiceNode( { data, id }: AWSServiceNodeProps ) {
  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-orange-400 text-white relative group">
      <div className="flex items-center gap-2">
        <Cloud className="w-4 h-4" />
        <div>
          <div className="font-bold">{data.label}</div>
          <div className="text-xs">{data.description}</div>
        </div>
      </div>
      {/* Delete button */}
      <button
        onClick={( e ) => {
          e.stopPropagation();
          if ( ( window as any ).deleteNode ) {
            ( window as any ).deleteNode( id );
          }
        }}
        title="Delete node"
        className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600"
      >
        <X className="w-3 h-3 text-white" />
      </button>

      {/* ReactFlow Handles for proper connections */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#fb923c', border: '2px solid white' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#fb923c', border: '2px solid white' }}
      />
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#fb923c', border: '2px solid white' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#fb923c', border: '2px solid white' }}
      />
    </div>
  );
}

interface ModelNodeProps {
  data: {
    label: string;
    provider: string;
    model: string;
    cost?: {
      input: number;
      output: number;
      efficiency: number;
    };
    performance?: {
      overall: number;
      reasoning: number;
      code: number;
      knowledge: number;
    };
  };
  id: string;
}

function ModelNode( { data, id }: ModelNodeProps ) {
  const costColor = data.cost ?
    (data.cost.efficiency > 50 ? 'text-green-300' :
     data.cost.efficiency > 20 ? 'text-yellow-300' : 'text-red-300') : 'text-gray-400';

  const performanceColor = data.performance ?
    (data.performance.overall > 80 ? 'text-green-300' :
     data.performance.overall > 60 ? 'text-yellow-300' : 'text-red-300') : 'text-gray-400';

  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-purple-600 text-white relative group min-w-[200px]">
      <div className="flex items-center gap-2">
        <Brain className="w-4 h-4" />
        <div className="flex-1">
          <div className="font-bold">{data.label}</div>
          <div className="text-xs text-purple-200">{data.provider}</div>

          {/* Cost Display */}
          {data.cost && (
            <div className="text-xs mt-1">
              <div className="flex justify-between">
                <span className={costColor}>
                  ${data.cost.input.toFixed(2)}/M in
                </span>
                <span className={costColor}>
                  ${data.cost.output.toFixed(2)}/M out
                </span>
              </div>
              <div className="text-center">
                <span className={costColor}>
                  Eff: {data.cost.efficiency.toFixed(0)}
                </span>
              </div>
            </div>
          )}

          {/* Performance Display */}
          {data.performance && (
            <div className="text-xs mt-1">
              <div className="flex justify-between">
                <span className={performanceColor}>
                  Overall: {data.performance.overall.toFixed(0)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className={performanceColor}>
                  R: {data.performance.reasoning.toFixed(0)}
                </span>
                <span className={performanceColor}>
                  C: {data.performance.code.toFixed(0)}
                </span>
                <span className={performanceColor}>
                  K: {data.performance.knowledge.toFixed(0)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete button */}
      <button
        onClick={( e ) => {
          e.stopPropagation();
          if ( ( window as any ).deleteNode ) {
            ( window as any ).deleteNode( id );
          }
        }}
        title="Delete node"
        className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600"
      >
        <X className="w-3 h-3 text-white" />
      </button>

      {/* ReactFlow Handles for proper connections */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#9333ea', border: '2px solid white' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#9333ea', border: '2px solid white' }}
      />
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#9333ea', border: '2px solid white' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#9333ea', border: '2px solid white' }}
      />
    </div>
  );
}

interface MetaToolNodeProps {
  data: { label: string; decorator: string; code: string };
  id: string;
}

function MetaToolNode( { data, id }: MetaToolNodeProps ) {
  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-yellow-500 text-white relative group">
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4" />
        <div>
          <div className="font-bold">{data.label}</div>
          <div className="text-xs">{data.decorator}</div>
        </div>
      </div>
      {/* Delete button */}
      <button
        onClick={( e ) => {
          e.stopPropagation();
          if ( ( window as any ).deleteNode ) {
            ( window as any ).deleteNode( id );
          }
        }}
        title="Delete node"
        className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600"
      >
        <X className="w-3 h-3 text-white" />
      </button>

      {/* ReactFlow Handles for proper connections */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#eab308', border: '2px solid white' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#eab308', border: '2px solid white' }}
      />
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#eab308', border: '2px solid white' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#eab308', border: '2px solid white' }}
      />
    </div>
  );
}

// Define node types AFTER all component functions are defined
const nodeTypes = {
  tool: ToolNode,
  agent: AgentNode,
  mcpServer: MCPServerNode,
  strandsAgent: StrandsAgentNode,
  langchainChain: LangchainChainNode,
  model: ModelNode,
  metaTool: MetaToolNode,
  awsService: AWSServiceNode,
};

export function VisualScriptingBuilder() {
  const [nodes, setNodes, onNodesChange] = useNodesState( [] );
  const [edges, setEdges, onEdgesChange] = useEdgesState( [] );
  const [selectedNodeType, setSelectedNodeType] = useState<string>( 'tool' );

  // Fetch data from Convex
  const agents = useQuery( api.agents.list, {} ) || [];
  const mcpServers = useQuery( api.mcpConfig.listMCPServers, {} ) || [];
  const dynamicTools = useQuery( api.metaTooling.listTools, {} ) || [];

  // Fetch model data from Convex
  const allModels = useQuery(api.modelRegistry.getAllModels) || [];
  const allBenchmarks = useQuery(api.modelBenchmarks.getAllBenchmarks) || [];

  const onConnect = useCallback(
    ( params: Connection ) => setEdges( ( eds ) => addEdge( params, eds ) ),
    [setEdges]
  );

  const addNode = useCallback( ( type: string, data: any ) => {
    const newNode: Node = {
      id: `${type}-${Date.now()}`,
      type,
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data,
    };
    setNodes( ( nds ) => nds.concat( newNode ) );
  }, [setNodes] );

  const deleteNode = useCallback( ( nodeId: string ) => {
    setNodes( ( nds ) => nds.filter( ( node ) => node.id !== nodeId ) );
    setEdges( ( eds ) => eds.filter( ( edge ) => edge.source !== nodeId && edge.target !== nodeId ) );
  }, [setNodes, setEdges] );

  // Make delete function available globally for node components
  useEffect(() => {
    (window as any).deleteNode = deleteNode;
    return () => {
      delete (window as any).deleteNode;
    };
  }, [deleteNode]);

  // Cost and performance tracking
  const [totalCost, setTotalCost] = useState(0);
  const [totalPerformance, setTotalPerformance] = useState(0);
  const [evaluationMode, setEvaluationMode] = useState(false);
  const [evaluationResults, setEvaluationResults] = useState<any[]>([]);

  // Templates for Load Template functionality
  const loadTemplate = (templateName: string) => {
    const templates = {
      'ai-chatbot': [
        {
          id: 'model-claude-3.5',
          type: 'model',
          position: { x: 100, y: 100 },
          data: { label: 'Claude 3.5', provider: 'Anthropic', model: 'claude-3-5-sonnet-20241022', description: 'Conversational AI Model' }
        },
        {
          id: 'tool-slack',
          type: 'tool',
          position: { x: 400, y: 200 },
          data: { label: 'Slack Bot', description: 'Send/receive Slack messages' }
        },
        {
          id: 'agent-chat',
          type: 'agent',
          position: { x: 250, y: 300 },
          data: { label: 'Chat Assistant', model: 'claude-3-5-sonnet-20241022' }
        }
      ],
      'data-processing': [
        {
          id: 's3-storage',
          type: 'awsService',
          position: { x: 100, y: 100 },
          data: { label: 'AWS S3', description: 'Amazon S3 storage operations' }
        },
        {
          id: 'lambda-processor',
          type: 'awsService',
          position: { x: 400, y: 100 },
          data: { label: 'AWS Lambda', description: 'AWS Lambda functions' }
        },
        {
          id: 'agent-data',
          type: 'agent',
          position: { x: 250, y: 250 },
          data: { label: 'Data Processor', model: 'claude-3-5-sonnet-20241022' }
        }
      ],
      'swarm-intelligence': [
        {
          id: 'strands-swarm',
          type: 'strandsAgent',
          position: { x: 200, y: 150 },
          data: { label: 'Strands Swarm', type: 'Swarm' }
        },
        {
          id: 'strands-graph',
          type: 'strandsAgent',
          position: { x: 500, y: 150 },
          data: { label: 'Strands Graph', type: 'Graph' }
        },
        {
          id: 'agent-worker-1',
          type: 'agent',
          position: { x: 100, y: 300 },
          data: { label: 'Worker Agent 1', model: 'claude-3-5-sonnet-20241022' }
        },
        {
          id: 'agent-worker-2',
          type: 'agent',
          position: { x: 400, y: 300 },
          data: { label: 'Worker Agent 2', model: 'claude-3-5-sonnet-20241022' }
        }
      ],
      'ml-pipeline': [
        {
          id: 'sagemaker',
          type: 'awsService',
          position: { x: 100, y: 100 },
          data: { label: 'AWS SageMaker', description: 'Machine learning platform' }
        },
        {
          id: 'rekognition',
          type: 'awsService',
          position: { x: 400, y: 100 },
          data: { label: 'AWS Rekognition', description: 'Image and video analysis' }
        },
        {
          id: 'agent-ml',
          type: 'agent',
          position: { x: 250, y: 250 },
          data: { label: 'ML Coordinator', model: 'claude-3-5-sonnet-20241022' }
        }
      ],
      'chain-of-thought': [
        {
          id: 'reasoning-model',
          type: 'model',
          position: { x: 200, y: 100 },
          data: { label: 'Deep Reasoning Model', provider: 'Anthropic', model: 'claude-3-5-sonnet-20241022' }
        },
        {
          id: 'step1-tool',
          type: 'tool',
          position: { x: 100, y: 200 },
          data: { label: 'Reasoning Step 1', description: 'Break down into smaller problems' }
        },
        {
          id: 'step2-tool',
          type: 'tool',
          position: { x: 400, y: 200 },
          data: { label: 'Reasoning Step 2', description: 'Explore each subproblem' }
        },
        {
          id: 'coordinator',
          type: 'agent',
          position: { x: 200, y: 350 },
          data: { label: 'Chain Coordinator', model: 'claude-3-5-sonnet-20241022' }
        }
      ],
      'reasoning-acting': [
        {
          id: 'reasoning-model',
          type: 'model',
          position: { x: 200, y: 100 },
          data: { label: 'ReAct Model', provider: 'OpenAI', model: 'gpt-4' }
        },
        {
          id: 'reason-tool',
          type: 'tool',
          position: { x: 100, y: 250 },
          data: { label: 'Reason Step', description: 'Analyze and think step-by-step' }
        },
        {
          id: 'act-tool',
          type: 'tool',
          position: { x: 400, y: 250 },
          data: { label: 'Action Step', description: 'Execute action based on reasoning' }
        },
        {
          id: 'react-agent',
          type: 'agent',
          position: { x: 200, y: 400 },
          data: { label: 'ReAct Agent', model: 'gpt-4' }
        }
      ],
      'self-consistency': [
        {
          id: 'consistency-model-1',
          type: 'model',
          position: { x: 100, y: 100 },
          data: { label: 'Model Path A', provider: 'Anthropic', model: 'claude-3-5-sonnet-20241022' }
        },
        {
          id: 'consistency-model-2',
          type: 'model',
          position: { x: 400, y: 100 },
          data: { label: 'Model Path B', provider: 'OpenAI', model: 'gpt-4' }
        },
        {
          id: 'voting-tool',
          type: 'tool',
          position: { x: 250, y: 250 },
          data: { label: 'Consistency Vote', description: 'Compare multiple reasoning paths' }
        },
        {
          id: 'consistency-agent',
          type: 'agent',
          position: { x: 250, y: 400 },
          data: { label: 'Consistency Agent', model: 'claude-3-5-sonnet-20241022' }
        }
      ],
      'reflection': [
        {
          id: 'reflection-model',
          type: 'model',
          position: { x: 200, y: 100 },
          data: { label: 'Self-Reflection Model', provider: 'Anthropic', model: 'claude-3-5-sonnet-20241022' }
        },
        {
          id: 'initial-attempt',
          type: 'tool',
          position: { x: 100, y: 250 },
          data: { label: 'Initial Solution', description: 'Generate initial approach' }
        },
        {
          id: 'self-critique',
          type: 'tool',
          position: { x: 400, y: 250 },
          data: { label: 'Self-Critique', description: 'Analyze strengths and weaknesses' }
        },
        {
          id: 'reflection-agent',
          type: 'agent',
          position: { x: 200, y: 400 },
          data: { label: 'Reflective Agent', model: 'claude-3-5-sonnet-20241022' }
        }
      ],
      'tree-thoughts': [
        {
          id: 'tree-model',
          type: 'model',
          position: { x: 250, y: 50 },
          data: { label: 'Tree Search Model', provider: 'OpenAI', model: 'gpt-4' }
        },
        {
          id: 'branch-1',
          type: 'tool',
          position: { x: 100, y: 200 },
          data: { label: 'Branch 1', description: 'First reasoning path' }
        },
        {
          id: 'branch-2',
          type: 'tool',
          position: { x: 250, y: 200 },
          data: { label: 'Branch 2', description: 'Alternative reasoning path' }
        },
        {
          id: 'branch-3',
          type: 'tool',
          position: { x: 400, y: 200 },
          data: { label: 'Branch 3', description: 'Third exploration path' }
        },
        {
          id: 'tree-agent',
          type: 'agent',
          position: { x: 250, y: 350 },
          data: { label: 'Tree Agent', model: 'gpt-4' }
        }
      ],
      'map-reduce': [
        {
          id: 'map-model',
          type: 'model',
          position: { x: 200, y: 100 },
          data: { label: 'MapReduce Model', provider: 'Anthropic', model: 'claude-3-5-sonnet-20241022' }
        },
        {
          id: 'map-tool-1',
          type: 'tool',
          position: { x: 50, y: 250 },
          data: { label: 'Map Task 1', description: 'Process data chunk 1' }
        },
        {
          id: 'map-tool-2',
          type: 'tool',
          position: { x: 150, y: 250 },
          data: { label: 'Map Task 2', description: 'Process data chunk 2' }
        },
        {
          id: 'map-tool-3',
          type: 'tool',
          position: { x: 250, y: 250 },
          data: { label: 'Map Task 3', description: 'Process data chunk 3' }
        },
        {
          id: 'map-tool-4',
          type: 'tool',
          position: { x: 350, y: 250 },
          data: { label: 'Map Task 4', description: 'Process data chunk 4' }
        },
        {
          id: 'reduce-tool',
          type: 'tool',
          position: { x: 200, y: 400 },
          data: { label: 'Reduce Task', description: 'Combine and summarize results' }
        },
        {
          id: 'mapreduce-agent',
          type: 'agent',
          position: { x: 200, y: 500 },
          data: { label: 'MapReduce Agent', model: 'claude-3-5-sonnet-20241022' }
        }
      ]
    };

    const template = templates[templateName as keyof typeof templates];
    if (template) {
      setNodes(template);
      setEdges([]);
      console.log(`Loaded template: ${templateName}`);
    }
  };

  // Save functionality
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');

  const saveWorkflow = () => {
    const workflowData = {
      nodes,
      edges,
      timestamp: new Date().toISOString(),
      name: saveName || `Workflow ${new Date().toLocaleDateString()}`,
      metadata: {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        totalCost,
        avgPerformance: totalPerformance
      }
    };

    // Save to localStorage as a simple implementation
    const savedWorkflows = JSON.parse(localStorage.getItem('visualScriptingWorkflows') || '[]');
    savedWorkflows.unshift(workflowData); // Add to beginning
    localStorage.setItem('visualScriptingWorkflows', JSON.stringify(savedWorkflows));

    console.log('Workflow saved successfully!');
    alert(`Workflow "${workflowData.name}" saved! (${nodes.length} nodes, ${edges.length} connections)`);
    setShowSaveDialog(false);
    setSaveName('');
  };

  // Calculate totals from selected nodes
  useEffect(() => {
    let cost = 0;
    let performance = 0;
    let modelCount = 0;

    nodes.forEach(node => {
      if (node.type === 'model' && node.data.cost && node.data.performance) {
        cost += (node.data.cost.input + node.data.cost.output) / 2; // Average cost
        performance += node.data.performance.overall;
        modelCount++;
      }
    });

    setTotalCost(cost);
    setTotalPerformance(modelCount > 0 ? performance / modelCount : 0);
  }, [nodes]);

  // Run evaluation when evaluation mode is enabled
  useEffect(() => {
    if (evaluationMode) {
      const modelNodes = nodes.filter(n => n.type === 'model');
      if (modelNodes.length === 0) {
        setEvaluationMode(false);
        return;
      }

      // Simulate evaluation results
      const results = modelNodes.map(node => ({
        modelId: node.data.model,
        modelName: node.data.label,
        cost: node.data.cost,
        performance: node.data.performance,
        evaluation: {
          accuracy: Math.random() * 30 + 70, // 70-100
          speed: Math.random() * 40 + 60,    // 60-100
          costEfficiency: node.data.cost?.efficiency || 0,
          timestamp: new Date().toISOString()
        }
      }));

      setEvaluationResults(results);

      // Auto-stop evaluation after 5 seconds (simulating completion)
      const timeoutId = setTimeout(() => {
        setEvaluationMode(false);
      }, 5000);

      // Cleanup timeout on unmount or mode change
      return () => clearTimeout(timeoutId);
    } else {
      setEvaluationResults([]);
    }
  }, [evaluationMode, nodes]);

  const availableItems = useMemo( () => {
    // Generate models from registry with cost and performance data
    const modelsFromRegistry = allModels
      .filter(model => model.capabilities.includes('text'))
      .map(model => {
        const benchmark = allBenchmarks?.find(b => b.model === model.id);
        return {
          type: 'model' as const,
          data: {
            label: model.name,
            provider: model.providerDisplay,
            model: model.id,
            cost: benchmark ? {
              input: benchmark.costPerMToken,
              output: benchmark.costPerMTokenOutput,
              efficiency: benchmark.efficiencyScore
            } : undefined,
            performance: benchmark ? {
              overall: benchmark.overallAbility,
              reasoning: benchmark.reasoningAbility,
              code: benchmark.codeAbility,
              knowledge: benchmark.knowledgeAbility
            } : undefined
          }
        };
      });

    return [
      // Models from registry with cost and performance data
      ...modelsFromRegistry,

      // Agents from Convex database
      ...agents.map( agent => ( { type: 'agent', data: { label: agent.name, model: agent.model } } ) ),

      // MCP Servers from Convex database
      ...mcpServers.map( server => ( { type: 'mcpServer', data: { label: server.name, status: server.status } } ) ),

      // Strands Agents Tools - All strands agents same orange color
      { type: 'strandsAgent', data: { label: 'Strands Graph', type: 'Graph' } },
      { type: 'strandsAgent', data: { label: 'Strands Swarm', type: 'Swarm' } },
      { type: 'strandsAgent', data: { label: 'Strands Agent Core', type: 'Agent Core' } },
      { type: 'strandsAgent', data: { label: 'Strands A2A Client', type: 'A2A Client' } },
      { type: 'strandsAgent', data: { label: 'Strands Workflow', type: 'Workflow' } },
      { type: 'strandsAgent', data: { label: 'Strands Multi-Agent', type: 'Multi-Agent' } },

      // Langchain Tools - All langchain same red color (same as agents)
      { type: 'langchainChain', data: { label: 'Langchain Sequential', chainType: 'Sequential' } },
      { type: 'langchainChain', data: { label: 'Langchain Router', chainType: 'Router' } },
      { type: 'langchainChain', data: { label: 'Langchain Conversational', chainType: 'Conversational' } },
      { type: 'langchainChain', data: { label: 'Langchain QA', chainType: 'Question Answering' } },
      { type: 'langchainChain', data: { label: 'Langchain Summarize', chainType: 'Summarization' } },

      // PROMPT ENGINEERING TOOLS - NEW
      { type: 'prompt', data: { label: '📝 Manual Prompt', description: 'Write a custom prompt directly', promptType: 'manual' } },
      { type: 'prompt', data: { label: '📝 Prompt Template', description: 'Reusable prompt with variables', promptType: 'template' } },
      { type: 'prompt', data: { label: '⛓️ Prompt Chain', description: 'Sequential prompts', promptType: 'chain' } },
      { type: 'prompt', data: { label: '💭 Think Tool', description: 'Explicit reasoning step', promptType: 'think' } },
      { type: 'prompt', data: { label: '🧠 Chain of Thought', description: 'Step-by-step reasoning', promptType: 'cot' } },
      { type: 'prompt', data: { label: '📚 RAG System', description: 'Knowledge base retrieval', promptType: 'rag' } },
      { type: 'prompt', data: { label: '🔄 ReAct Loop', description: 'Reasoning + Acting', promptType: 'react' } },
      { type: 'prompt', data: { label: '⚡ Parallel Prompts', description: 'Execute multiple prompts at once', promptType: 'parallel' } },
      { type: 'prompt', data: { label: '✅ Self-Consistency', description: 'Multi-path voting mechanism', promptType: 'self_consistency' } },
      { type: 'prompt', data: { label: '🌳 Tree of Thoughts', description: 'Branching exploration', promptType: 'tree_of_thoughts' } },
      { type: 'prompt', data: { label: '🪞 Reflexion', description: 'Self-improvement loop', promptType: 'reflexion' } },
      { type: 'prompt', data: { label: '🗺️ Map-Reduce', description: 'Parallel aggregation', promptType: 'map_reduce' } },

      // CHATBOT COMPONENTS - NEW
      { type: 'chatbot', data: { label: '💬 Conversational Chatbot', description: 'Main chat interface', chatbotType: 'conversational' } },
      { type: 'chatbot', data: { label: '🤖 Chatbot Worker', description: 'Specialized domain agent', chatbotType: 'worker' } },
      { type: 'chatbot', data: { label: '🧠 Chatbot Memory', description: 'Context storage', chatbotType: 'memory' } },

      // HUMAN-IN-THE-LOOP TOOLS - NEW
      { type: 'humanInLoop', data: { label: '👤 Handoff to User', description: 'Request human input or decision', humanType: 'handoff' } },

      // MEMORY TOOLS - NEW
      { type: 'memory', data: { label: '💭 Short-term Memory', description: 'Temporary conversation memory', memoryType: 'short_term' } },
      { type: 'memory', data: { label: '🧠 Long-term Memory', description: 'Persistent storage', memoryType: 'long_term' } },
      { type: 'memory', data: { label: '🔍 Semantic Memory', description: 'Vector search memory', memoryType: 'semantic' } },

      // MODEL CONNECTORS - NEW
      { type: 'connector', data: { label: '🔮 Ollama Connector', description: 'Connect to local Ollama models', connectorType: 'ollama' } },
      { type: 'connector', data: { label: '☁️ Bedrock Connector', description: 'Connect to AWS Bedrock', connectorType: 'bedrock' } },
      { type: 'connector', data: { label: '🌐 OpenAI Connector', description: 'Connect to OpenAI', connectorType: 'openai' } },
      { type: 'connector', data: { label: '🗄️ Data Connector', description: 'Connect to databases/APIs', connectorType: 'data' } },

      // Meta Tools - All meta tools same yellow color
      { type: 'metaTool', data: { label: 'Meta Tool Decorator', decorator: '@tool', code: 'async def my_tool(): pass' } },
      { type: 'metaTool', data: { label: 'Meta Agent Decorator', decorator: '@agent', code: 'async def my_agent(): pass' } },
      { type: 'metaTool', data: { label: 'Meta Chain Decorator', decorator: '@chain', code: 'async def my_chain(): pass' } },

      // File Operations Tools - All tools same blue color
      { type: 'tool', data: { label: 'File Read', description: 'Read files with syntax highlighting' } },
      { type: 'tool', data: { label: 'File Write', description: 'Write content to files' } },
      { type: 'tool', data: { label: 'File Editor', description: 'Advanced file editing with patterns' } },
      { type: 'tool', data: { label: 'File Search', description: 'Search within files' } },
      { type: 'tool', data: { label: 'Directory Tree', description: 'List directory contents' } },

      // Shell & System Tools
      { type: 'tool', data: { label: 'Shell Execute', description: 'Execute shell commands' } },
      { type: 'tool', data: { label: 'Python REPL', description: 'Execute Python code' } },
      { type: 'tool', data: { label: 'Code Interpreter', description: 'Run code in sandbox' } },
      { type: 'tool', data: { label: 'Environment Vars', description: 'Manage environment variables' } },

      // Web & API Tools
      { type: 'tool', data: { label: 'HTTP Request', description: 'Make HTTP API calls' } },
      { type: 'tool', data: { label: 'Web Scraper', description: 'Scrape websites' } },
      { type: 'tool', data: { label: 'Tavily Search', description: 'AI-optimized web search' } },
      { type: 'tool', data: { label: 'Tavily Extract', description: 'Extract content from URLs' } },
      { type: 'tool', data: { label: 'Tavily Crawl', description: 'Crawl websites intelligently' } },
      { type: 'tool', data: { label: 'Exa Search', description: 'Neural web search' } },
      { type: 'tool', data: { label: 'Exa Contents', description: 'Extract full page content' } },

      // AI & ML Tools
      { type: 'tool', data: { label: 'Calculator', description: 'Advanced mathematical calculations' } },
      { type: 'tool', data: { label: 'Image Generator', description: 'Generate AI images' } },
      { type: 'tool', data: { label: 'Image Reader', description: 'Analyze images' } },
      { type: 'tool', data: { label: 'Video Search', description: 'Search videos semantically' } },
      { type: 'tool', data: { label: 'Video Chat', description: 'Chat with video content' } },
      { type: 'tool', data: { label: 'Audio Generator', description: 'Generate audio/speech' } },

      // Memory & Storage Tools
      { type: 'tool', data: { label: 'Memory Store', description: 'Store persistent memories' } },
      { type: 'tool', data: { label: 'Memory Retrieve', description: 'Retrieve stored memories' } },
      { type: 'tool', data: { label: 'Knowledge Base', description: 'Query knowledge bases' } },
      { type: 'tool', data: { label: 'Vector Search', description: 'Semantic vector search' } },

      // Your Production Architecture (Serverless & Cost-Effective)
      { type: 'tool', data: { label: 'Convex Functions', description: 'Serverless functions' } },
      { type: 'tool', data: { label: 'Bedrock Runtime', description: 'Serverless AI inference' } },
      { type: 'tool', data: { label: 'AgentCore Runtime', description: 'Serverless agent execution' } },
      { type: 'tool', data: { label: 'Strands Agents', description: 'Your agent framework' } },
      { type: 'tool', data: { label: 'Convex Database', description: 'Serverless database' } },
      { type: 'tool', data: { label: 'File Storage', description: 'Document storage' } },
      { type: 'tool', data: { label: 'Memory System', description: 'Persistent memory' } },
      { type: 'tool', data: { label: 'Meta Tooling', description: 'Dynamic tool creation' } },
      { type: 'tool', data: { label: 'Workflow Engine', description: 'Workflow orchestration' } },
      { type: 'tool', data: { label: 'Queue Processor', description: 'Async job processing' } },
      { type: 'tool', data: { label: 'Container Orchestrator', description: 'Container management' } },
      { type: 'tool', data: { label: 'Guardrails', description: 'Safety and security' } },
      { type: 'tool', data: { label: 'Audit Logging', description: 'Activity monitoring' } },



      // AWS Services (Available in Visual Tool - User Choice)
      { type: 'awsService', data: { label: 'AWS S3', description: 'Amazon S3 storage operations' } },
      { type: 'awsService', data: { label: 'AWS Lambda', description: 'AWS Lambda functions' } },
      { type: 'awsService', data: { label: 'AWS EC2', description: 'EC2 instance management' } },
      { type: 'awsService', data: { label: 'AWS RDS', description: 'Relational database service' } },
      { type: 'awsService', data: { label: 'AWS DynamoDB', description: 'NoSQL database operations' } },
      { type: 'awsService', data: { label: 'AWS Bedrock', description: 'AI model inference' } },
      { type: 'awsService', data: { label: 'AWS SageMaker', description: 'Machine learning platform' } },
      { type: 'awsService', data: { label: 'AWS Rekognition', description: 'Image and video analysis' } },
      { type: 'awsService', data: { label: 'AWS Textract', description: 'Document text extraction' } },
      { type: 'awsService', data: { label: 'AWS Comprehend', description: 'Natural language processing' } },

      // Communication Tools
      { type: 'tool', data: { label: 'Slack Bot', description: 'Slack workspace integration' } },
      { type: 'tool', data: { label: 'Email Sender', description: 'Send emails programmatically' } },
      { type: 'tool', data: { label: 'SMS Sender', description: 'Send SMS messages' } },
      { type: 'tool', data: { label: 'Voice Call', description: 'Make voice calls' } },

      // Automation Tools
      { type: 'tool', data: { label: 'Task Scheduler', description: 'Schedule recurring tasks' } },
      { type: 'tool', data: { label: 'Workflow Engine', description: 'Execute multi-step workflows' } },
      { type: 'tool', data: { label: 'Batch Processor', description: 'Process multiple tools in parallel' } },
      { type: 'tool', data: { label: 'Swarm Intelligence', description: 'Coordinate multiple AI agents' } },

      // Browser & Desktop Tools
      { type: 'tool', data: { label: 'Browser Automation', description: 'Control web browsers' } },
      { type: 'tool', data: { label: 'Desktop Control', description: 'Control desktop applications' } },
      { type: 'tool', data: { label: 'Screenshot Tool', description: 'Capture screen images' } },
      { type: 'tool', data: { label: 'Keyboard Input', description: 'Simulate keyboard input' } },
      { type: 'tool', data: { label: 'Mouse Control', description: 'Control mouse movements' } },

      // Data Processing Tools
      { type: 'tool', data: { label: 'Data Parser', description: 'Parse various data formats' } },
      { type: 'tool', data: { label: 'JSON Processor', description: 'Process JSON data' } },
      { type: 'tool', data: { label: 'CSV Processor', description: 'Process CSV files' } },
      { type: 'tool', data: { label: 'XML Parser', description: 'Parse XML documents' } },
      { type: 'tool', data: { label: 'Regex Engine', description: 'Regular expression processing' } },

      // Security & Auth Tools
      { type: 'tool', data: { label: 'JWT Handler', description: 'Handle JWT tokens' } },
      { type: 'tool', data: { label: 'Password Hash', description: 'Hash passwords securely' } },
      { type: 'tool', data: { label: 'API Key Manager', description: 'Manage API keys' } },
      { type: 'tool', data: { label: 'OAuth Handler', description: 'Handle OAuth flows' } },

      // Monitoring & Logging Tools
      { type: 'tool', data: { label: 'System Monitor', description: 'Monitor system metrics' } },
      { type: 'tool', data: { label: 'Log Analyzer', description: 'Analyze log files' } },
      { type: 'tool', data: { label: 'Performance Monitor', description: 'Monitor performance metrics' } },
      { type: 'tool', data: { label: 'Error Tracker', description: 'Track and report errors' } },

      // Database Tools
      { type: 'tool', data: { label: 'SQL Query', description: 'Execute SQL queries' } },
      { type: 'tool', data: { label: 'MongoDB', description: 'MongoDB operations' } },
      { type: 'tool', data: { label: 'Redis Cache', description: 'Redis cache operations' } },
      { type: 'tool', data: { label: 'Elasticsearch', description: 'Elasticsearch search' } },

      // Agent Core Tools
      { type: 'tool', data: { label: 'Agent Execute', description: 'Execute Strands agents' } },
      { type: 'tool', data: { label: 'Agent Memory', description: 'Agent memory management' } },
      { type: 'tool', data: { label: 'Agent Context', description: 'Manage agent context' } },
      { type: 'tool', data: { label: 'Agent State', description: 'Agent state management' } },

      // Dynamic tools from database
      ...(dynamicTools || []).map( ( tool: any ) => ( { type: 'tool', data: { label: tool.displayName, description: tool.description } } ) ),
    ];
  }, [agents, mcpServers] );

  return (
    <div className="h-screen flex">
      {/* Sidebar */}
      <div className="w-80 bg-gray-900 border-r border-green-900/30 p-4 overflow-y-auto">
        <h2 className="text-lg font-semibold text-green-400 mb-4">Available Components</h2>

        {/* Categories */}
        {[
          { name: 'Models', items: availableItems.filter( item => item.type === 'model' ) },
          { name: 'Agents', items: availableItems.filter( item => item.type === 'agent' ) },
          { name: 'MCP Servers', items: availableItems.filter( item => item.type === 'mcpServer' ) },
          { name: 'AWS Services', items: availableItems.filter( item => item.type === 'awsService' ) },
          { name: 'Tools', items: availableItems.filter( item => item.type === 'tool' ) },
          { name: 'Strands Agents', items: availableItems.filter( item => item.type === 'strandsAgent' ) },
          { name: 'Langchain', items: availableItems.filter( item => item.type === 'langchainChain' ) },
          { name: 'Meta Tools', items: availableItems.filter( item => item.type === 'metaTool' ) },
        ].map( category => (
          <div key={category.name} className="mb-6">
            <h3 className="text-sm font-medium text-green-300 mb-2">{category.name} ({category.items.length})</h3>
            <div className="space-y-2">
              {category.items.map( ( item, index ) => {
                // Determine background and border colors based on node type
                const getNodeColors = (type: string) => {
                  switch(type) {
                    case 'model': return 'bg-purple-900/20 border-purple-700/30 hover:border-purple-500/50';
                    case 'agent': return 'bg-red-900/20 border-red-700/30 hover:border-red-500/50';
                    case 'langchainChain': return 'bg-red-900/20 border-red-700/30 hover:border-red-500/50';
                    case 'mcpServer': return 'bg-green-900/20 border-green-700/30 hover:border-green-500/50';
                    case 'tool': return 'bg-blue-900/20 border-blue-700/30 hover:border-blue-500/50';
                    case 'strandsAgent': return 'bg-orange-900/20 border-orange-700/30 hover:border-orange-500/50';
                    case 'metaTool': return 'bg-yellow-900/20 border-yellow-700/30 hover:border-yellow-500/50';
                    case 'awsService': return 'bg-orange-900/20 border-orange-600/30 hover:border-orange-500/50';
                    case 'convexService': return 'bg-purple-900/20 border-purple-600/30 hover:border-purple-500/50';
                    case 'prompt': return 'bg-indigo-900/20 border-indigo-700/30 hover:border-indigo-500/50';
                    case 'chatbot': return 'bg-cyan-900/20 border-cyan-700/30 hover:border-cyan-500/50';
                    case 'connector': return 'bg-teal-900/20 border-teal-700/30 hover:border-teal-500/50';
                    case 'humanInLoop': return 'bg-pink-900/20 border-pink-700/30 hover:border-pink-500/50';
                    case 'memory': return 'bg-violet-900/20 border-violet-700/30 hover:border-violet-500/50';
                    default: return 'bg-black border-green-900/30 hover:border-green-700/50';
                  }
                };

                return (
                <div
                  key={index}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${getNodeColors(item.type)}`}
                  onClick={() => addNode( item.type, item.data )}
                >
                  <div className="flex items-center gap-2">
                    {/* Models - All purple */}
                    {item.type === 'model' && <Brain className="w-4 h-4 text-purple-400" />}
                    {/* Agents & Langchain - All red */}
                    {item.type === 'agent' && <Bot className="w-4 h-4 text-red-400" />}
                    {item.type === 'langchainChain' && <Network className="w-4 h-4 text-red-400" />}
                    {/* MCP Servers - All green */}
                    {item.type === 'mcpServer' && <Server className="w-4 h-4 text-green-400" />}
                    {/* Tools - All blue */}
                    {item.type === 'tool' && <Code className="w-4 h-4 text-blue-400" />}
                    {/* Strands Agents - All orange */}
                    {item.type === 'strandsAgent' && <Network className="w-4 h-4 text-orange-400" />}
                    {/* Meta Tools - All yellow */}
                    {item.type === 'metaTool' && <Zap className="w-4 h-4 text-yellow-400" />}
                    {/* AWS Services - Orange */}
                    {item.type === 'awsService' && <Cloud className="w-4 h-4 text-orange-600" />}
                    {/* Convex Services - Purple */}
                    {item.type === 'convexService' && <Database className="w-4 h-4 text-purple-600" />}
                    {/* Prompt Tools - Indigo */}
                    {item.type === 'prompt' && <FileText className="w-4 h-4 text-indigo-400" />}
                    {/* Chatbot Components - Cyan */}
                    {item.type === 'chatbot' && <MessageSquare className="w-4 h-4 text-cyan-400" />}
                    {/* Connectors - Teal */}
                    {item.type === 'connector' && <Globe className="w-4 h-4 text-teal-400" />}
                    {/* Human-in-the-Loop - Pink */}
                    {item.type === 'humanInLoop' && <Users className="w-4 h-4 text-pink-400" />}
                    {/* Memory Tools - Violet */}
                    {item.type === 'memory' && <Database className="w-4 h-4 text-violet-400" />}
                    <div>
                      <div className="font-medium text-white">{item.data.label}</div>
                      <div className="text-xs text-green-600">
                        {( item.data as any ).description || ( item.data as any ).model || ( item.data as any ).status || ( item.data as any ).type || ( item.data as any ).chainType || ( item.data as any ).provider}
                      </div>
                      {/* Cost and Performance Display in Sidebar */}
                      {item.type === 'model' && (item.data as any).cost && (
                        <div className="text-xs mt-1">
                          <div className="flex justify-between">
                            <span className="text-green-300">
                              ${((item.data as any).cost.input || 0).toFixed(2)}/M in
                            </span>
                            <span className="text-green-300">
                              ${((item.data as any).cost.output || 0).toFixed(2)}/M out
                            </span>
                          </div>
                          <div className="text-center">
                            <span className="text-yellow-300">
                              Eff: {((item.data as any).cost.efficiency || 0).toFixed(0)}
                            </span>
                          </div>
                          {(item.data as any).performance && (
                            <div className="text-xs mt-1">
                              <div className="text-center text-purple-300">
                                Overall: {((item.data as any).performance.overall || 0).toFixed(0)}
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-purple-300">
                                  R: {((item.data as any).performance.reasoning || 0).toFixed(0)}
                                </span>
                                <span className="text-purple-300">
                                  C: {((item.data as any).performance.code || 0).toFixed(0)}
                                </span>
                                <span className="text-purple-300">
                                  K: {((item.data as any).performance.knowledge || 0).toFixed(0)}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
              })}
            </div>
          </div>
        ) )}
      </div>

      {/* Main Canvas */}
      <div className="flex-1">
        <div className="h-full relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            connectionLineStyle={{ stroke: '#10b981', strokeWidth: 2 }}
          >
            <Controls />
            <MiniMap />
            <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
          </ReactFlow>

          {/* Toolbar */}
          <div className="absolute top-4 left-4 flex gap-2">
            <button
              onClick={() => setShowSaveDialog(true)}
              className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save Workflow
            </button>

            {/* Template Load Menu */}
            <div className="relative">
              <button
                onClick={() => setShowTemplateMenu(!showTemplateMenu)}
                className="px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2"
              >
                📋 Load Template
                <ChevronDown className="w-4 h-4 ml-1" />
              </button>

              {showTemplateMenu && (
                <div className="absolute top-full mt-1 bg-gray-800 border border-green-900/30 rounded-lg shadow-lg z-50 min-w-[200px]">
                  <div className="p-1">
                    <button
                      onClick={() => {
                        loadTemplate('ai-chatbot');
                        setShowTemplateMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-green-300 hover:bg-green-900/50 rounded flex items-center gap-2"
                    >
                      🤖 AI Chatbot
                      <div className="text-xs text-green-600 ml-auto">Model + Tools</div>
                    </button>
                    <button
                      onClick={() => {
                        loadTemplate('data-processing');
                        setShowTemplateMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-green-300 hover:bg-green-900/50 rounded flex items-center gap-2"
                    >
                      📊 Data Processing
                      <div className="text-xs text-green-600 ml-auto">AWS Services</div>
                    </button>
                    <button
                      onClick={() => {
                        loadTemplate('swarm-intelligence');
                        setShowTemplateMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-green-300 hover:bg-green-900/50 rounded flex items-center gap-2"
                    >
                      🐝 Swarm Intelligence
                      <div className="text-xs text-green-600 ml-auto">Strands Agents</div>
                    </button>
                    <button
                      onClick={() => {
                        loadTemplate('ml-pipeline');
                        setShowTemplateMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-green-300 hover:bg-green-900/50 rounded flex items-center gap-2"
                    >
                      🤖 ML Pipeline
                      <div className="text-xs text-green-600 ml-auto">AI Services</div>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
              <Play className="w-4 h-4" />
              Run
            </button>
            <button
              onClick={() => {
                setNodes( [] );
                setEdges( [] );
              }}
              className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Clear All
            </button>
          </div>

          {/* Cost and Performance Status Panel */}
          <div className="absolute top-4 right-4 bg-gray-800 border border-green-900/30 rounded-lg p-3 min-w-[250px]">
            <h3 className="text-sm font-semibold text-green-400 mb-2">Workflow Analysis</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-green-300">Total Cost:</span>
                <span className={`text-xs font-mono ${totalCost > 10 ? 'text-red-300' : totalCost > 5 ? 'text-yellow-300' : 'text-green-300'}`}>
                  ${totalCost.toFixed(2)}/M tokens
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-green-300">Avg Performance:</span>
                <span className={`text-xs font-mono ${totalPerformance > 80 ? 'text-green-300' : totalPerformance > 60 ? 'text-yellow-300' : 'text-red-300'}`}>
                  {totalPerformance.toFixed(0)}/100
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-green-300">Models:</span>
                <span className="text-xs font-mono text-green-300">
                  {nodes.filter(n => n.type === 'model').length}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-green-300">Tools:</span>
                <span className="text-xs font-mono text-green-300">
                  {nodes.filter(n => n.type === 'tool').length}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-green-300">Connections:</span>
                <span className="text-xs font-mono text-green-300">
                  {edges.length}
                </span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-green-900/30">
              <button
                onClick={() => setEvaluationMode(!evaluationMode)}
                className={`w-full px-2 py-1 text-xs rounded transition-colors ${
                  evaluationMode
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-green-300'
                }`}
              >
                {evaluationMode ? 'Stop Evaluation' : 'Start Evaluation'}
              </button>
            </div>
          </div>

          {/* Save Workflow Dialog */}
          {showSaveDialog && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-gray-800 border border-green-900/30 rounded-lg p-6 min-w-[400px]">
                <h3 className="text-lg font-semibold text-green-400 mb-4">Save Workflow</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-green-300 mb-2">
                      Workflow Name
                    </label>
                    <input
                      type="text"
                      value={saveName}
                      onChange={(e) => setSaveName(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-green-900/30 rounded-lg text-white placeholder-green-600 focus:outline-none focus:border-green-500"
                      placeholder="Enter workflow name..."
                      autoFocus
                    />
                  </div>

                  {/* Workflow Summary */}
                  <div className="bg-gray-900/50 rounded-lg p-3">
                    <h4 className="text-sm font-medium text-green-300 mb-2">Workflow Summary</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-green-400">Nodes:</span>
                        <span className="text-white">{nodes.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-400">Connections:</span>
                        <span className="text-white">{edges.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-400">Models:</span>
                        <span className="text-white">{nodes.filter(n => n.type === 'model').length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-400">Cost:</span>
                        <span className="text-white">${totalCost.toFixed(2)}/M</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={saveWorkflow}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    disabled={!saveName.trim()}
                  >
                    Save Workflow
                  </button>
                  <button
                    onClick={() => {
                      setShowSaveDialog(false);
                      setSaveName('');
                    }}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
