'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAgentRunner, RunnerAction, RunnerOutput, ToolCallRecord } from '@/hooks/useAgentRunner';
import {
  Send, Plus, Trash2, Loader, CheckCircle2, XCircle, Clock, Wrench,
  Terminal, Cpu, DollarSign, ChevronDown, ChevronRight,
} from 'lucide-react';

const toolIconMap: Record<string, string> = {
  read_file: '📖', write_file: '✏️', search_files: '🔎', fetch_aws_docs: '📚',
  validate_terraform: '✅', estimate_cost: '💰', lookup_gcp_aws_mapping: '🗺️',
  generate_iam_policy: '🛡️', check_compliance: '📋', web_search: '🌐',
};

export default function AgentRunnerPanel({ embeddedContext }: { embeddedContext?: string }) {
  const {
    actions, result, loading, error, sessionId,
    startSession, continueSession, clearSession, newSession,
  } = useAgentRunner();

  const [input, setInput] = useState('');
  const [expandedTools, setExpandedTools] = useState<Set<number>>(new Set());
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasInitialized = useRef(false);

  // Collect messages for chat view
  const chatMessages = React.useMemo(() => {
    const msgs: Array<{ role: 'user' | 'assistant' | 'tool'; content: string; toolCalls?: RunnerAction[]; timestamp?: string }> = [];

    // Group actions into messages
    let currentAssistantText = '';
    let currentToolCalls: RunnerAction[] = [];

    for (const action of actions) {
      if (action.type === 'text' && action.content) {
        currentAssistantText += action.content;
      } else if (action.type === 'tool_call' || action.type === 'tool_result') {
        currentToolCalls.push(action);
      }
    }

    if (currentAssistantText || currentToolCalls.length > 0) {
      msgs.push({
        role: 'assistant',
        content: currentAssistantText,
        toolCalls: currentToolCalls,
      });
    }

    return msgs;
  }, [actions]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [chatMessages, actions]);

  const handleSubmit = () => {
    if (!input.trim() || loading) return;
    const task = input.trim();
    setInput('');
    if (sessionId) {
      continueSession(task);
    } else {
      startSession(embeddedContext ? `${task}\n\nContext:\n${embeddedContext}` : task);
    }
  };

  // Auto-start session if embeddedContext is provided
  useEffect(() => {
    if (embeddedContext && !hasInitialized.current) {
      hasInitialized.current = true;
      startSession(`I have just generated the following AWS Terraform config. Please analyze it for security and compliance best practices, and suggest any improvements.\n\n${embeddedContext}`);
    }
  }, [embeddedContext, startSession]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const toggleTool = (idx: number) => {
    setExpandedTools(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  // Collect all tool calls for the right panel
  const allToolCalls = React.useMemo(() => {
    return actions.filter(a => a.type === 'tool_call').map((a, i) => ({
      index: i,
      tool: a.tool || 'unknown',
      input: a.input || {},
      iteration: a.iteration || 0,
      result: actions.find(r => r.type === 'tool_result' && r.tool === a.tool && r.iteration === a.iteration),
    }));
  }, [actions]);

  return (
    <div className={embeddedContext ? "w-full" : "min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 text-white"}>
      {/* Header - Only if not embedded */}
      {!embeddedContext && (
        <div className="border-b border-gray-800 bg-black/60 backdrop-blur-md px-8 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                <Terminal className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                  Agent Runner
                </h1>
                <p className="text-xs text-gray-500 mt-0.5">Multi-turn conversation with tool-augmented AI agent</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {sessionId && (
                <span className="text-xs px-2 py-1 bg-gray-800 border border-gray-700 rounded text-gray-400 font-mono">
                  {sessionId.slice(0, 8)}...
                </span>
              )}
              <span className="text-xs px-2 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded text-cyan-400">
                Claude 3.5 Sonnet
              </span>
              <button onClick={newSession}
                className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-400 hover:text-white hover:border-cyan-500/50 transition flex items-center gap-1.5">
                <Plus className="w-3 h-3" /> New Session
              </button>
              <button onClick={clearSession}
                className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-400 hover:text-red-400 hover:border-red-500/50 transition flex items-center gap-1.5">
                <Trash2 className="w-3 h-3" /> Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mx-8 mt-4 bg-red-500/10 border border-red-500/40 rounded-lg p-4 flex items-center gap-3">
          <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <span className="text-sm text-red-300">{error}</span>
        </div>
      )}

      {/* Main Split */}
      <div className={embeddedContext ? "flex h-[600px] border border-gray-800 rounded-xl overflow-hidden mt-6" : "flex h-[calc(100vh-100px)]"}>

        {/* Left: Chat Terminal (60%) */}
        <div className="w-3/5 border-r border-gray-800 flex flex-col">
          {/* Chat Messages */}
          <div ref={chatRef} className="flex-1 overflow-y-auto p-6 space-y-4">
            {actions.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center h-full text-gray-600 space-y-3">
                <Terminal className="w-10 h-10" />
                <p className="text-sm">Ask the agent to analyze, validate, or generate infrastructure</p>
                <div className="flex flex-wrap gap-2 justify-center mt-4">
                  {[
                    'Estimate cost for 3 EC2 instances + RDS',
                    'Generate SOC2 compliant IAM policy for S3',
                    'Map GCP Cloud SQL to AWS equivalent',
                    'Validate this Terraform config',
                  ].map((suggestion, i) => (
                    <button key={i} onClick={() => setInput(suggestion)}
                      className="px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-xs text-gray-400 hover:text-white hover:border-cyan-500/50 transition">
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Render streamed text */}
            {actions.filter(a => a.type === 'text').map((action, idx) => (
              <div key={`text-${idx}`} className="flex gap-3">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                  <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="bg-gray-900/80 border border-gray-800 rounded-lg rounded-tl-none p-4">
                    <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{action.content}</p>
                  </div>
                </div>
              </div>
            ))}

            {/* Tool calls as pills */}
            {allToolCalls.length > 0 && (
              <div className="space-y-2">
                {allToolCalls.map((tc, idx) => (
                  <div key={`tool-${idx}`} className="ml-10">
                    <div
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-800/60 border border-gray-700 rounded-full cursor-pointer hover:border-cyan-500/40 transition text-xs"
                      onClick={() => toggleTool(idx)}
                    >
                      <span>{toolIconMap[tc.tool] || '🔧'}</span>
                      <span className="text-gray-300 font-medium">{tc.tool.replace(/_/g, ' ')}</span>
                      {tc.result?.result?.startsWith('ERROR') ? (
                        <XCircle className="w-3 h-3 text-red-400" />
                      ) : tc.result ? (
                        <CheckCircle2 className="w-3 h-3 text-green-400" />
                      ) : (
                        <Loader className="w-3 h-3 text-cyan-400 animate-spin" />
                      )}
                      {expandedTools.has(idx) ? <ChevronDown className="w-3 h-3 text-gray-500" /> : <ChevronRight className="w-3 h-3 text-gray-500" />}
                    </div>
                    {expandedTools.has(idx) && (
                      <div className="mt-2 bg-gray-900/80 border border-gray-800 rounded-lg p-3 space-y-2">
                        <div>
                          <p className="text-[10px] text-gray-500 uppercase mb-1">Input</p>
                          <pre className="text-xs text-gray-400 font-mono bg-black/40 rounded p-2 max-h-20 overflow-auto whitespace-pre-wrap">
                            {JSON.stringify(tc.input, null, 2)}
                          </pre>
                        </div>
                        {tc.result?.result && (
                          <div>
                            <p className="text-[10px] text-gray-500 uppercase mb-1">Result</p>
                            <pre className="text-xs text-gray-400 font-mono bg-black/40 rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap">
                              {tc.result.result.slice(0, 500)}{tc.result.result.length > 500 ? '...' : ''}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {loading && (
              <div className="flex items-center gap-2 ml-10 text-sm text-cyan-400">
                <Loader className="w-4 h-4 animate-spin" />
                <span className="animate-pulse">Agent is thinking...</span>
              </div>
            )}
          </div>

          {/* Input Box */}
          <div className="border-t border-gray-800 p-4 bg-gray-900/30">
            <div className="flex gap-3">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={sessionId ? 'Continue the conversation... (Shift+Enter for newline)' : 'Describe your task... (Shift+Enter for newline)'}
                className="flex-1 bg-gray-900/80 border border-gray-700 rounded-lg px-4 py-3 text-sm text-gray-300 placeholder-gray-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 focus:outline-none resize-none"
                rows={2}
              />
              <button onClick={handleSubmit} disabled={!input.trim() || loading}
                className="px-5 bg-gradient-to-br from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 disabled:opacity-40 rounded-lg transition flex items-center justify-center shadow-lg shadow-emerald-900/20">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Right: Action Feed (40%) */}
        <div className="w-2/5 flex flex-col">
          <div className="px-6 py-3 border-b border-gray-800 bg-gray-900/30 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Live Action Feed</span>
            <span className="text-xs text-gray-500">{allToolCalls.length} tool calls</span>
          </div>

          {/* Timeline */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {allToolCalls.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-600 text-sm">
                Tool calls will appear here
              </div>
            ) : allToolCalls.map((tc, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 bg-gray-900/40 border border-gray-800/60 rounded-lg">
                <span className="text-base flex-shrink-0">{toolIconMap[tc.tool] || '🔧'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-300">{tc.tool.replace(/_/g, ' ')}</span>
                    <div className="flex items-center gap-2">
                      {tc.result?.duration_ms != null && (
                        <span className="text-[10px] text-gray-500 font-mono">{tc.result.duration_ms}ms</span>
                      )}
                      {tc.result?.result?.startsWith('ERROR') ? (
                        <span className="text-[10px] px-1.5 py-0.5 bg-red-500/15 text-red-400 rounded">ERROR</span>
                      ) : tc.result ? (
                        <span className="text-[10px] px-1.5 py-0.5 bg-green-500/15 text-green-400 rounded">OK</span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 bg-cyan-500/15 text-cyan-400 rounded animate-pulse">RUNNING</span>
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-500 font-mono mt-1 truncate">
                    Iteration {tc.iteration}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Artifacts */}
          {result && result.artifacts_generated.length > 0 && (
            <div className="border-t border-gray-800 px-6 py-3 bg-gray-900/30">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">Artifacts Generated</span>
              {result.artifacts_generated.map((a, i) => (
                <div key={i} className="text-xs text-emerald-400 font-mono flex items-center gap-1.5 py-0.5">
                  <CheckCircle2 className="w-3 h-3" /> {a}
                </div>
              ))}
            </div>
          )}

          {/* Token Usage */}
          {result && (
            <div className="border-t border-gray-800 px-6 py-3 bg-gradient-to-r from-gray-900 to-emerald-950/10">
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <p className="text-xs font-bold text-cyan-400">{result.token_usage.input_tokens.toLocaleString()}</p>
                  <p className="text-[10px] text-gray-500">Input</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-green-400">{result.token_usage.output_tokens.toLocaleString()}</p>
                  <p className="text-[10px] text-gray-500">Output</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-300">{result.token_usage.total_tokens.toLocaleString()}</p>
                  <p className="text-[10px] text-gray-500">Total</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-amber-400">${result.token_usage.estimated_cost_usd.toFixed(4)}</p>
                  <p className="text-[10px] text-gray-500">Cost</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
