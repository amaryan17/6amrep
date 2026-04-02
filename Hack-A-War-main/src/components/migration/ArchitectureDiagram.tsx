'use client';

import React, { useState, useRef, useMemo } from 'react';
import ReactFlow, {
  Controls,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  Handle,
  Position,
  NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useDiagram } from '@/hooks/useDiagram';
import {
  Zap, Download, Copy, Maximize2, Loader, AlertTriangle,
} from 'lucide-react';

// ════════════════════════════════════════════════════════════════════════════
// CUSTOM NODE COMPONENT — Renders all AWS service types
// ════════════════════════════════════════════════════════════════════════════

const serviceIcons: Record<string, string> = {
  ec2: '🖥️', lambda: '⚡', s3: '📦', rds: '🗄️', dynamodb: '⚡', vpc: '🔲',
  subnet: '📡', alb: '⚖️', nlb: '⚖️', ecs: '🐳', eks: '☸️', sqs: '📨',
  sns: '📢', cloudwatch: '📊', kms: '🔑', iam: '🛡️', elasticache: '💾',
  route53: '🌐', cloudfront: '🌐', waf: '🔥', nat_gateway: '🔀', default: '☁️',
};

function AWSNode({ data, selected }: NodeProps) {
  const nodeType = data.nodeType || 'default';
  const icon = serviceIcons[nodeType] || serviceIcons.default;
  const monthlyCost = data.monthly_cost;
  const isContainer = nodeType === 'vpc' || nodeType === 'subnet';

  return (
    <div
      className={`group relative transition-all duration-200 ${selected ? 'ring-2 ring-cyan-400' : ''}`}
      style={{
        background: isContainer ? 'rgba(6,182,212,0.04)' : '#0f172a',
        border: `1px solid ${selected ? '#22d3ee' : (data.borderColor || '#334155')}`,
        borderRadius: isContainer ? '12px' : '8px',
        padding: isContainer ? '20px' : '12px 16px',
        minWidth: isContainer ? '200px' : '140px',
        minHeight: isContainer ? '100px' : 'auto',
        boxShadow: selected
          ? `0 0 20px ${data.borderColor || '#22d3ee'}60`
          : `0 0 8px ${data.borderColor || '#334155'}20`,
        borderStyle: isContainer ? 'dashed' : 'solid',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: '#22d3ee', width: 6, height: 6 }} />

      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <div className="min-w-0">
          <p className="text-xs font-semibold truncate" style={{ color: data.labelColor || '#e2e8f0' }}>
            {data.label || 'Resource'}
          </p>
          {data.instance_type && (
            <p className="text-[10px] text-gray-500 font-mono">{data.instance_type}</p>
          )}
        </div>
      </div>

      {monthlyCost != null && monthlyCost > 0 && (
        <p className="text-[10px] text-cyan-400 mt-1 font-mono">${monthlyCost.toFixed(0)}/mo</p>
      )}

      {/* Hover glow */}
      <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        style={{ boxShadow: `0 0 24px ${data.borderColor || '#22d3ee'}30` }} />

      <Handle type="source" position={Position.Right} style={{ background: '#22d3ee', width: 6, height: 6 }} />
    </div>
  );
}

const nodeTypes = { awsNode: AWSNode };

// ════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════════════

export default function ArchitectureDiagram({ embeddedHcl }: { embeddedHcl?: string }) {
  const { data: diagramData, loading, error, generateDiagram } = useDiagram();
  const [hclInput, setHclInput] = useState('');
  const reactFlowRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);

  // Convert API data to React Flow format
  const { rfNodes, rfEdges } = useMemo(() => {
    if (!diagramData) return { rfNodes: [], rfEdges: [] };

    const rfNodes: Node[] = diagramData.nodes.map((n) => ({
      id: n.id,
      type: 'awsNode',
      position: n.position,
      data: {
        label: n.label,
        nodeType: n.type,
        instance_type: n.data?.instance_type,
        monthly_cost: n.data?.monthly_cost,
        borderColor: n.style?.border ? n.style.border.replace('1px solid ', '') : '#334155',
        labelColor: n.style?.color || '#e2e8f0',
        service: n.data?.service,
        resource_name: n.data?.resource_name,
      },
    }));

    const rfEdges: Edge[] = diagramData.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label || undefined,
      animated: e.animated,
      style: {
        stroke: e.style?.stroke || '#22d3ee',
        strokeWidth: e.style?.strokeWidth || 1.5,
        strokeDasharray: e.style?.strokeDasharray,
      },
      labelStyle: { fill: '#94a3b8', fontSize: 10 },
      labelBgStyle: { fill: '#0f172a', fillOpacity: 0.8 },
    }));

    return { rfNodes, rfEdges };
  }, [diagramData]);

  const [nodes, setNodes, onNodesChange] = useNodesState(rfNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(rfEdges);

  // Update when data changes
  React.useEffect(() => {
    setNodes(rfNodes);
    setEdges(rfEdges);
  }, [rfNodes, rfEdges, setNodes, setEdges]);

  // Handle auto-generation if embedded
  React.useEffect(() => {
    if (embeddedHcl && !hasInitialized.current) {
      hasInitialized.current = true;
      generateDiagram(embeddedHcl);
    }
  }, [embeddedHcl, generateDiagram]);

  const handleGenerate = async () => {
    if (hclInput.trim()) {
      await generateDiagram(hclInput);
    }
  };

  const exportPNG = async () => {
    if (!reactFlowRef.current) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(reactFlowRef.current, {
        backgroundColor: '#0a0a0a',
        scale: 2,
      });
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url; a.download = 'aegis-architecture.png'; a.click();
    } catch (err) {
      console.error('PNG export failed:', err);
    }
  };

  const copyMermaid = () => {
    if (diagramData?.mermaid_source) {
      navigator.clipboard.writeText(diagramData.mermaid_source);
    }
  };

  const complexityColor = (score: number) => {
    if (score <= 3) return 'text-green-400 border-green-500/30 bg-green-500/10';
    if (score <= 6) return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
    return 'text-red-400 border-red-500/30 bg-red-500/10';
  };

  return (
    <div className={embeddedHcl ? "w-full" : "min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 text-white"}>
      {/* Header - Only if not embedded */}
      {!embeddedHcl && (
        <div className="border-b border-gray-800 bg-black/60 backdrop-blur-md px-8 py-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/30">
              <Maximize2 className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                Architecture Diagram
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">Auto-generated from Terraform HCL — Interactive React Flow</p>
            </div>
          </div>
        </div>
      )}

      <div className={embeddedHcl ? "w-full py-4 space-y-6" : "max-w-7xl mx-auto px-8 py-6 space-y-6"}>
        {/* Input - Only if not embedded */}
        {!embeddedHcl && (
          <div className="flex gap-4">
            <textarea
              value={hclInput}
              onChange={(e) => setHclInput(e.target.value)}
              placeholder="Paste your Terraform HCL to generate an architecture diagram..."
              className="flex-1 h-24 bg-gray-900/80 border border-gray-700 rounded-lg px-4 py-3 text-sm font-mono text-gray-300 placeholder-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 focus:outline-none resize-none"
            />
            <button onClick={handleGenerate} disabled={loading || !hclInput.trim()}
              className="px-6 bg-gradient-to-br from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 disabled:opacity-40 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 shadow-lg shadow-purple-900/30">
              {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Generate
            </button>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/40 rounded-lg p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <span className="text-sm text-red-300">{error}</span>
          </div>
        )}

        {/* Diagram Canvas */}
        {diagramData && diagramData.nodes.length > 0 ? (
          <>
            {/* Toolbar */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <button onClick={exportPNG}
                  className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-400 hover:text-white hover:border-cyan-500/50 transition flex items-center gap-1.5">
                  <Download className="w-3 h-3" /> Export PNG
                </button>
                <button onClick={copyMermaid}
                  className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-400 hover:text-white hover:border-cyan-500/50 transition flex items-center gap-1.5">
                  <Copy className="w-3 h-3" /> Copy Mermaid
                </button>
              </div>
              <div className="flex gap-2 items-center">
                <span className="text-xs px-2 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded text-cyan-400">
                  {diagramData.aws_resource_count} Resources
                </span>
                {diagramData.vpc_count > 0 && (
                  <span className="text-xs px-2 py-1 bg-purple-500/10 border border-purple-500/30 rounded text-purple-400">
                    {diagramData.vpc_count} VPCs
                  </span>
                )}
                {diagramData.has_multi_az && (
                  <span className="text-xs px-2 py-1 bg-green-500/10 border border-green-500/30 rounded text-green-400">Multi-AZ</span>
                )}
                <span className={`text-xs px-2 py-1 border rounded ${complexityColor(diagramData.complexity_score)}`}>
                  Complexity: {diagramData.complexity_score}/10
                </span>
              </div>
            </div>

            {/* React Flow Canvas */}
            <div ref={reactFlowRef}
              className="rounded-xl border border-gray-800 overflow-hidden"
              style={{ height: '600px', background: '#0a0a0a' }}
            >
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.3 }}
                defaultEdgeOptions={{ type: 'smoothstep' }}
                minZoom={0.2}
                maxZoom={2}
                zoomOnScroll={false}
                preventScrolling={false}
                panOnScroll={false}
              >
                <Background color="#1e293b" gap={20} size={1} />
                <Controls
                  showInteractive={false}
                  style={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                  }}
                />
                <MiniMap
                  nodeColor={() => '#22d3ee'}
                  maskColor="rgba(0,0,0,0.8)"
                  style={{
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                  }}
                />
              </ReactFlow>
            </div>
          </>
        ) : !loading && (
          <div className="rounded-xl border-2 border-dashed border-gray-700 flex flex-col items-center justify-center py-24">
            <div className="text-4xl mb-4">🏗️</div>
            <p className="text-gray-400 text-sm">Paste Terraform HCL above and click Generate</p>
            <p className="text-gray-600 text-xs mt-1">Interactive architecture diagram will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
}
