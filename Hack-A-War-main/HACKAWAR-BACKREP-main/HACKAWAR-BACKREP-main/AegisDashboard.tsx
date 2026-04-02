'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Zap,
  Shield,
  TrendingDown,
  CheckCircle2,
  AlertCircle,
  Loader,
  Copy,
  Download,
  Terminal as TerminalIcon,
  Code2,
  GitPullRequest,
} from 'lucide-react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface LogEntry {
  id: string;
  status: string;
  message: string;
  timestamp: Date;
}

interface MigrationResult {
  tech_debt: {
    score: number;
    issues_fixed: string[];
  };
  translation: {
    original_gcp_lines: number;
    new_aws_terraform: string;
  };
  architecture: {
    mermaid_syntax: string;
  };
  finops: {
    gcp_monthly_cost: number;
    aws_monthly_cost: number;
    savings_percent: number;
    carbon_saved_kg: number;
  };
  security: {
    iam_policy_generated: string;
    principle_applied: string;
  };
}

interface AgentStatus {
  id: 'agent_1' | 'agent_2' | 'agent_3' | 'agent_4' | 'agent_5';
  name: string;
  description: string;
  status: 'pending' | 'processing' | 'complete' | 'error';
  message: string;
}

type PRState = 'idle' | 'packaging' | 'authenticating' | 'creating_branch' | 'success';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AegisDashboard() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prState, setPRState] = useState<PRState>('idle');
  const [prText, setPRText] = useState('Create Pull Request');
  const [agents, setAgents] = useState<AgentStatus[]>([
    {
      id: 'agent_1',
      name: '🔍 Pre-Flight Scanner',
      description: 'Tech Debt & Deprecated Libraries',
      status: 'pending',
      message: 'Awaiting analysis',
    },
    {
      id: 'agent_2',
      name: '🔄 GCP-to-AWS Translator',
      description: 'Terraform Generation',
      status: 'pending',
      message: 'Ready',
    },
    {
      id: 'agent_3',
      name: '🏗️ Architecture Strategist',
      description: 'Infrastructure Design',
      status: 'pending',
      message: 'Ready',
    },
    {
      id: 'agent_4',
      name: '💰 FinOps Optimizer',
      description: 'Cost & GreenOps Analysis',
      status: 'pending',
      message: 'Ready',
    },
    {
      id: 'agent_5',
      name: '🔐 Zero-Trust Security',
      description: 'IAM Policy Generation',
      status: 'pending',
      message: 'Ready',
    },
  ]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Update agent status based on log entry
  const updateAgentStatus = (status: string, message: string) => {
    setAgents((prev) =>
      prev.map((agent) => {
        if (agent.id === status) {
          return {
            ...agent,
            status: 'processing',
            message: message,
          };
        }
        return agent;
      })
    );
  };

  // Mark agent as complete
  const completeAgent = (agentId: string) => {
    setAgents((prev) =>
      prev.map((agent) => {
        if (agent.id === agentId) {
          return {
            ...agent,
            status: 'complete',
            message: '✓ Complete',
          };
        }
        return agent;
      })
    );
  };

  // ========================================================================
  // HANDLE FILE UPLOAD & SSE STREAMING
  // ========================================================================

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setLogs([]);
    setMigrationResult(null);
    
    // Reset all agents to pending
    setAgents((prev) =>
      prev.map((agent) => ({
        ...agent,
        status: 'pending',
        message: 'Awaiting processing...',
      }))
    );

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('http://localhost:8000/api/v1/migrate', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      // Read Server-Sent Events stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Response body is not readable');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          setIsProcessing(false);
          break;
        }

        // Decode the chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages
        const lines = buffer.split('\n\n');

        // Keep the last incomplete message in the buffer
        buffer = lines[lines.length - 1];

        // Process all complete messages
        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i];

          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6); // Remove 'data: ' prefix
              const data = JSON.parse(jsonStr);

              // Update agent status if this is an agent message
              if (
                data.status === 'agent_1' ||
                data.status === 'agent_2' ||
                data.status === 'agent_3' ||
                data.status === 'agent_4' ||
                data.status === 'agent_5'
              ) {
                updateAgentStatus(data.status, data.message || '');
              }

              // Add log entry
              const logEntry: LogEntry = {
                id: `${Date.now()}-${Math.random()}`,
                status: data.status,
                message: data.message || '',
                timestamp: new Date(),
              };

              setLogs((prev) => [...prev, logEntry]);

              // If complete, extract the result and mark all agents complete
              if (data.status === 'complete' && data.result) {
                setMigrationResult(data.result);
                setAgents((prev) =>
                  prev.map((agent) => ({
                    ...agent,
                    status: 'complete',
                    message: '✓ Complete',
                  }))
                );
              }

              // If error, set error message
              if (data.status === 'error') {
                setError(data.message);
              }
            } catch (e) {
              console.error('Failed to parse SSE message:', e);
            }
          }
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      setIsProcessing(false);
    }
  };

  // ========================================================================
  // GITHUB PR CREATION SIMULATION
  // ========================================================================

  const handleCreatePR = async () => {
    setPRState('packaging');
    setPRText('Packaging Terraform...');

    // State 1: Packaging
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // State 2: Authenticating
    setPRState('authenticating');
    setPRText('Authenticating via GitHub App...');
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // State 3: Creating branch
    setPRState('creating_branch');
    setPRText('Creating branch: aegis/auto-migrate-14b...');
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // State 4: Success
    setPRState('success');
    setPRText('PR #402 Opened');

    // Reset after 3 seconds
    await new Promise((resolve) => setTimeout(resolve, 3000));
    setPRState('idle');
    setPRText('Create Pull Request');
  };

  // ========================================================================
  // RENDER HELPER FUNCTIONS
  // ========================================================================

  const renderAgentStatus = () => {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
          🤖 AI Agent Pipeline
        </div>
        
        {agents.map((agent) => (
          <div key={agent.id} className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-white">{agent.name}</span>
                {agent.status === 'pending' && (
                  <span className="text-xs px-2 py-0.5 bg-gray-800 text-gray-400 rounded">
                    Waiting
                  </span>
                )}
                {agent.status === 'processing' && (
                  <span className="text-xs px-2 py-0.5 bg-cyan-500/20 text-cyan-400 rounded flex items-center gap-1">
                    <Loader className="w-2 h-2 animate-spin" />
                    Processing
                  </span>
                )}
                {agent.status === 'complete' && (
                  <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded flex items-center gap-1">
                    <CheckCircle2 className="w-2 h-2" />
                    Complete
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">{agent.description}</p>
              <p className="text-xs text-gray-600 mt-1">{agent.message}</p>
            </div>
            
            {/* Status indicator */}
            <div className="flex-shrink-0">
              <div
                className={`w-2 h-2 rounded-full ${
                  agent.status === 'pending'
                    ? 'bg-gray-600'
                    : agent.status === 'processing'
                    ? 'bg-cyan-400 animate-pulse'
                    : 'bg-green-400'
                }`}
              />
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ...existing code...
    return (
      <div className="bg-black border border-gray-800 rounded-lg overflow-hidden flex flex-col h-full">
        {/* Header */}
        <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-mono text-gray-400">
            aegis_factory ~ factory/migration
          </span>
        </div>

        {/* Logs */}
        <div className="flex-1 overflow-y-auto bg-black p-4 font-mono text-xs space-y-1">
          {logs.length === 0 && !isProcessing && (
            <div className="text-gray-600">
              $ awaiting_file_upload...
            </div>
          )}

          {logs.map((log) => (
            <div key={log.id} className="text-gray-300 flex items-start gap-2">
              <span className="text-cyan-400 flex-shrink-0">
                {log.status === 'agent_1' || log.status === 'agent_2' || log.status === 'agent_3' ? (
                  <Loader className="w-3 h-3 animate-spin" />
                ) : log.status === 'complete' ? (
                  <CheckCircle2 className="w-3 h-3 text-green-400" />
                ) : log.status === 'error' ? (
                  <AlertCircle className="w-3 h-3 text-red-400" />
                ) : null}
              </span>
              <span>
                <span className="text-cyan-400">[{log.status}]</span> {log.message}
              </span>
            </div>
          ))}

          <div ref={logsEndRef} />
        </div>

        {/* Footer */}
        <div className="bg-gray-900 border-t border-gray-800 px-4 py-2 text-xs text-gray-500">
          {isProcessing && (
            <span className="animate-pulse">Processing migration...</span>
          )}
          {!isProcessing && migrationResult && (
            <span className="text-green-400">✓ Migration complete</span>
          )}
        </div>
      </div>
    );
  };

  const renderFinopsMetrics = () => {
    if (!migrationResult) return null;

    const { gcp_monthly_cost, aws_monthly_cost, savings_percent } = migrationResult.finops;
    const monthlySavings = gcp_monthly_cost - aws_monthly_cost;
    const annualSavings = monthlySavings * 12;

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-orange-400" />
          FinOps Arbitrage
        </h3>

        <div className="grid grid-cols-2 gap-4">
          {/* GCP Cost */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
              GCP Monthly Cost
            </div>
            <div className="text-2xl font-bold text-white">
              ${gcp_monthly_cost.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </div>
          </div>

          {/* AWS Cost */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
              AWS Monthly Cost
            </div>
            <div className="text-2xl font-bold text-green-400">
              ${aws_monthly_cost.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>

        {/* Savings Visualization */}
        <div className="bg-gradient-to-r from-orange-500/10 to-cyan-500/10 border border-orange-500/30 rounded-lg p-4">
          <div className="flex items-end gap-4">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                Monthly Savings
              </div>
              <div className="text-3xl font-bold text-orange-400">
                ${monthlySavings.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {savings_percent.toFixed(1)}% reduction
              </div>
            </div>
            <div className="flex-1">
              <div className="text-right">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                  Annual Savings
                </div>
                <div className="text-2xl font-bold text-green-400">
                  ${annualSavings.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTechDebt = () => {
    if (!migrationResult) return null;

    const { score, issues_fixed } = migrationResult.tech_debt;
    const healthColor = score >= 80 ? 'text-green-400' : score >= 60 ? 'text-yellow-400' : 'text-red-400';

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Shield className="w-5 h-5 text-cyan-400" />
          Pre-Flight Tech Debt Scanner
        </h3>

        {/* Health Score */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                Code Health Score
              </div>
              <div className={`text-3xl font-bold ${healthColor}`}>
                {score}
              </div>
            </div>
            <div className="relative w-24 h-24">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="#374151"
                  strokeWidth="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeDasharray={`${(score / 100) * 282.7} 282.7`}
                  className={healthColor}
                  style={{ transition: 'stroke-dasharray 0.5s' }}
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Fixed Issues */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">
            Issues Fixed
          </div>
          <div className="space-y-2">
            {issues_fixed.map((issue, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <span>{issue}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderTerraformCode = () => {
    if (!migrationResult) return null;

    const { new_aws_terraform, original_gcp_lines } = migrationResult.translation;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Code2 className="w-5 h-5 text-orange-400" />
            AWS Terraform Translation
          </h3>
          <button
            onClick={() => {
              navigator.clipboard.writeText(new_aws_terraform);
            }}
            className="p-2 hover:bg-gray-800 rounded transition text-gray-400 hover:text-cyan-400"
            title="Copy to clipboard"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <div className="bg-black border-b border-gray-800 px-4 py-2 text-xs text-gray-500 font-mono">
            main.tf ({original_gcp_lines} GCP lines → AWS)
          </div>
          <pre className="p-4 overflow-x-auto text-xs text-gray-300 font-mono max-h-96">
            {new_aws_terraform}
          </pre>
        </div>
      </div>
    );
  };

  const renderRightPanel = () => {
    if (!migrationResult && !isProcessing) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <Zap className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500">Upload a file to begin migration</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        {/* Header with PR Button */}
        {migrationResult && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                // Export SOC-2 logic could go here
                alert('SOC-2 audit report generated');
              }}
              className="px-4 py-2 bg-gray-900 border border-gray-800 text-white text-sm rounded hover:border-gray-700 transition flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export SOC-2
            </button>

            <button
              onClick={handleCreatePR}
              disabled={prState !== 'idle'}
              className={`px-4 py-2 text-sm rounded transition flex items-center gap-2 font-medium ${
                prState === 'success'
                  ? 'bg-green-500/20 border border-green-500 text-green-400 cursor-default'
                  : prState === 'idle'
                  ? 'bg-orange-500 hover:bg-orange-600 border border-orange-600 text-white'
                  : 'bg-orange-500/50 border border-orange-600 text-orange-200 cursor-not-allowed'
              }`}
            >
              {prState !== 'idle' && prState !== 'success' ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : prState === 'success' ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <GitPullRequest className="w-4 h-4" />
              )}
              {prText}
            </button>
          </div>
        )}

        {/* Main Content */}
        {migrationResult && (
          <>
            {renderFinopsMetrics()}
            <div className="border-t border-gray-800" />
            {renderTechDebt()}
            <div className="border-t border-gray-800" />
            {renderTerraformCode()}
          </>
        )}

        {isProcessing && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader className="w-8 h-8 animate-spin text-cyan-400 mx-auto mb-4" />
              <p className="text-gray-400">Analyzing your infrastructure...</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ========================================================================
  // MAIN RENDER
  // ========================================================================

  return (
    <div className="w-full h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 text-white overflow-hidden">
      {/* Header */}
      <div className="h-16 border-b border-gray-800 bg-black/50 backdrop-blur-sm flex items-center px-8 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Zap className="w-6 h-6 text-orange-400" />
          <h1 className="text-xl font-bold">Aegis Migration Factory</h1>
        </div>
        <div className="ml-auto text-xs text-gray-500">
          Built for HACK'A'WAR 2026 • Powered by AWS Bedrock
        </div>
      </div>

      {/* Main Content */}
      <div className="h-[calc(100vh-4rem)] flex overflow-hidden">
        {/* Left Panel: Upload & Terminal */}
        <div className="w-1/3 border-r border-gray-800 bg-black/20 flex flex-col overflow-hidden">
          {/* Upload Zone */}
          <div className="flex-shrink-0 p-6 border-b border-gray-800">
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add('border-cyan-500', 'bg-cyan-500/5');
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove('border-cyan-500', 'bg-cyan-500/5');
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('border-cyan-500', 'bg-cyan-500/5');
                const file = e.dataTransfer.files[0];
                if (file) handleFileUpload(file);
              }}
              className="border-2 border-dashed border-gray-700 rounded-lg p-6 cursor-pointer transition hover:border-cyan-500 hover:bg-cyan-500/5 flex flex-col items-center justify-center gap-3"
            >
              <Upload className="w-6 h-6 text-gray-500" />
              <div className="text-center">
                <p className="text-sm font-medium text-white">
                  {isProcessing ? 'Processing...' : 'Drag & drop your file'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  or click to select
                </p>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
              className="hidden"
              accept=".zip,.py,.tf,.json,.yaml,.yml"
              disabled={isProcessing}
            />
          </div>

          {/* Error Display */}
          {error && (
            <div className="flex-shrink-0 mx-6 mt-4 bg-red-500/10 border border-red-500/50 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-red-300">{error}</div>
            </div>
          )}

          {/* Terminal Log */}
          <div className="flex-1 overflow-hidden p-6">{renderTerminalLog()}</div>
        </div>

        {/* Right Panel: Results */}
        <div className="flex-1 overflow-y-auto p-8">
          {renderRightPanel()}
        </div>
      </div>
    </div>
  );
}
