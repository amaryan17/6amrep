'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAutonomousAgent, AgentAction } from '@/hooks/useAutonomousAgent';
import {
  Upload, Play, Square, Download, Loader, CheckCircle2, AlertCircle, XCircle,
  Eye, FileText, Search, Terminal, Wrench, FolderTree, Clock,
} from 'lucide-react';

const toolIcons: Record<string, React.ReactNode> = {
  read_file: <Eye className="w-3.5 h-3.5 text-cyan-400" />,
  list_files: <FolderTree className="w-3.5 h-3.5 text-blue-400" />,
  search_files: <Search className="w-3.5 h-3.5 text-purple-400" />,
  write_file: <FileText className="w-3.5 h-3.5 text-green-400" />,
  run_command: <Terminal className="w-3.5 h-3.5 text-orange-400" />,
  infer_architecture: <Wrench className="w-3.5 h-3.5 text-yellow-400" />,
  save_artifact: <Download className="w-3.5 h-3.5 text-emerald-400" />,
  task_complete: <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />,
};

export default function AutonomousAgentPanel() {
  const { actions, report, loading, error, sessionId, runAgent, stopAgent, downloadOutputs } = useAutonomousAgent();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  // Auto-scroll feed
  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' });
  }, [actions]);

  // Build file tree from actions
  const fileTree = React.useMemo(() => {
    const files: Record<string, 'discovered' | 'read' | 'written'> = {};
    for (const a of actions) {
      if (a.type === 'tool_call') {
        if (a.tool === 'list_files' && a.result) {
          const lines = (a.result || '').split('\n');
          for (const l of lines) {
            const trimmed = l.trim();
            if (trimmed && !trimmed.startsWith('...') && !trimmed.startsWith('No files')) {
              if (!files[trimmed]) files[trimmed] = 'discovered';
            }
          }
        }
        if (a.tool === 'read_file' && a.input?.file_path) {
          files[a.input.file_path] = 'read';
        }
        if ((a.tool === 'write_file' || a.tool === 'save_artifact') && a.input?.file_path) {
          files[`output/${a.input.file_path}`] = 'written';
        }
      }
      if (a.type === 'tool_result' && a.tool === 'list_files') {
        const lines = (a.result || '').split('\n');
        for (const l of lines) {
          const trimmed = l.trim();
          if (trimmed && !trimmed.startsWith('...') && !trimmed.startsWith('No files')) {
            if (!files[trimmed]) files[trimmed] = 'discovered';
          }
        }
      }
    }
    return files;
  }, [actions]);

  const currentIteration = actions.length > 0
    ? Math.max(...actions.filter(a => a.iteration).map(a => a.iteration || 0))
    : 0;

  const statusBadge = loading
    ? { text: 'RUNNING', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40', pulse: true }
    : report?.status === 'COMPLETE'
    ? { text: 'COMPLETE', color: 'bg-green-500/20 text-green-400 border-green-500/40', pulse: false }
    : report?.status === 'FAILED'
    ? { text: 'FAILED', color: 'bg-red-500/20 text-red-400 border-red-500/40', pulse: false }
    : report
    ? { text: report.status, color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40', pulse: false }
    : { text: 'IDLE', color: 'bg-gray-700/40 text-gray-400 border-gray-600', pulse: false };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-black/60 backdrop-blur-md px-8 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/30">
              <Wrench className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-cyan-400 bg-clip-text text-transparent">
                Autonomous Agent
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">AI-powered file analysis with sandboxed tool execution</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs px-3 py-1.5 border rounded-full font-semibold ${statusBadge.color} ${statusBadge.pulse ? 'animate-pulse' : ''}`}>
              {statusBadge.text}
            </span>
            {report && (
              <button onClick={downloadOutputs}
                className="px-3 py-1.5 bg-green-600/20 border border-green-500/40 rounded-lg text-xs text-green-400 hover:bg-green-600/30 transition flex items-center gap-1.5">
                <Download className="w-3 h-3" /> Download Outputs
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Upload Bar */}
      <div className="border-b border-gray-800 bg-gray-900/30 px-8 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="px-5 py-2.5 bg-gradient-to-r from-orange-600 to-cyan-600 hover:from-orange-500 hover:to-cyan-500 disabled:opacity-40 rounded-lg text-sm font-semibold transition flex items-center gap-2 shadow-lg shadow-orange-900/20"
          >
            {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {loading ? 'Agent Running...' : 'Upload & Analyze'}
          </button>
          {loading && (
            <button onClick={stopAgent}
              className="px-4 py-2.5 bg-red-600/20 border border-red-500/40 rounded-lg text-sm text-red-400 hover:bg-red-600/30 transition flex items-center gap-2">
              <Square className="w-4 h-4" /> Stop Agent
            </button>
          )}
          <input ref={fileInputRef} type="file" accept=".zip,.tf,.yaml,.yml,.json,.py,.sh" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) runAgent(f); }} />
          {sessionId && (
            <span className="text-xs text-gray-500 font-mono">Session: {sessionId.slice(0, 12)}...</span>
          )}
        </div>
      </div>

      {error && (
        <div className="mx-8 mt-4 bg-red-500/10 border border-red-500/40 rounded-lg p-4 flex items-center gap-3">
          <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <span className="text-sm text-red-300">{error}</span>
        </div>
      )}

      {/* Main Split */}
      <div className="flex h-[calc(100vh-180px)]">
        {/* Left: Agent Thinking Feed */}
        <div className="w-3/5 border-r border-gray-800 flex flex-col">
          <div className="px-6 py-3 border-b border-gray-800 flex items-center justify-between bg-gray-900/30">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Agent Thinking</span>
            <span className="text-xs text-gray-500">{actions.length} actions</span>
          </div>
          <div ref={feedRef} className="flex-1 overflow-y-auto p-4 space-y-2">
            {actions.length === 0 && !loading && (
              <div className="flex items-center justify-center h-full text-gray-600 text-sm">
                Upload a file to start autonomous analysis
              </div>
            )}
            {actions.map((action, idx) => (
              <div key={idx}
                className="bg-gray-900/60 border border-gray-800 rounded-lg p-3 transition-all"
                style={{ animation: 'slideInLeft 0.3s ease-out' }}
              >
                <div className="flex items-center gap-2 mb-1">
                  {action.type === 'tool_call' && (toolIcons[action.tool || ''] || <Wrench className="w-3.5 h-3.5 text-gray-400" />)}
                  {action.type === 'tool_result' && <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />}
                  {action.type === 'thought' && <Eye className="w-3.5 h-3.5 text-blue-400" />}
                  {action.type === 'complete' && <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />}
                  {action.type === 'iteration_start' && <Clock className="w-3.5 h-3.5 text-gray-500" />}

                  <span className="text-xs font-semibold text-gray-300">
                    {action.type === 'tool_call' ? action.tool?.replace('_', ' ') :
                     action.type === 'tool_result' ? `${action.tool} result` :
                     action.type === 'thought' ? 'Thinking' :
                     action.type === 'complete' ? 'Task Complete' :
                     action.type === 'iteration_start' ? `Iteration ${action.iteration}` :
                     action.type}
                  </span>

                  {action.iteration && (
                    <span className="text-[10px] text-gray-600 font-mono">#{action.iteration}</span>
                  )}
                </div>

                {action.type === 'tool_call' && action.input && (
                  <p className="text-xs text-gray-500 font-mono truncate mt-1">
                    {Object.entries(action.input).map(([k, v]) => `${k}: ${String(v).slice(0, 60)}`).join(', ')}
                  </p>
                )}
                {action.type === 'tool_result' && action.result && (
                  <pre className="text-xs text-gray-400 mt-1 max-h-20 overflow-hidden whitespace-pre-wrap font-mono bg-black/40 rounded p-2">
                    {action.result.slice(0, 300)}{action.result.length > 300 ? '...' : ''}
                  </pre>
                )}
                {action.type === 'thought' && action.content && (
                  <p className="text-xs text-gray-400 mt-1">{action.content.slice(0, 300)}</p>
                )}
                {action.type === 'complete' && action.summary && (
                  <p className="text-xs text-green-400 mt-1">{action.summary}</p>
                )}
              </div>
            ))}
          </div>

          {/* Progress Bar */}
          <div className="border-t border-gray-800 px-6 py-3 bg-gray-900/30">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
              <span>Progress</span>
              <span>{currentIteration} / 25 iterations</span>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-orange-500 to-cyan-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min((currentIteration / 25) * 100, 100)}%` }} />
            </div>
          </div>
        </div>

        {/* Right: Workspace Explorer */}
        <div className="w-2/5 flex flex-col">
          <div className="px-6 py-3 border-b border-gray-800 bg-gray-900/30">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Workspace Explorer</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {Object.keys(fileTree).length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-600 text-sm">
                <FolderTree className="w-5 h-5 mr-2" /> Files will appear as the agent discovers them
              </div>
            ) : (
              <div className="space-y-1">
                {Object.entries(fileTree).sort().map(([path, status]) => (
                  <div key={path}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono transition cursor-pointer hover:bg-gray-800/50 ${
                      status === 'written' ? 'text-green-400' : status === 'read' ? 'text-cyan-400' : 'text-gray-400'
                    }`}
                    onClick={() => setSelectedFile(path)}
                  >
                    <FileText className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{path}</span>
                    {status === 'read' && <span className="text-[10px] px-1 py-0.5 bg-cyan-500/10 border border-cyan-500/30 rounded text-cyan-400">READ</span>}
                    {status === 'written' && <span className="text-[10px] px-1 py-0.5 bg-green-500/10 border border-green-500/30 rounded text-green-400">WRITTEN</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Artifacts */}
          {report && report.artifacts_saved.length > 0 && (
            <div className="border-t border-gray-800 px-6 py-4 bg-gray-900/30">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">Artifacts</span>
              <div className="space-y-1">
                {report.artifacts_saved.map((art, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-emerald-400">
                    <Download className="w-3 h-3" />
                    <span className="font-mono">{art}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Report Summary */}
          {report && (
            <div className="border-t border-gray-800 px-6 py-4 bg-gradient-to-r from-gray-900 to-cyan-950/10">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-lg font-bold text-cyan-400">{report.files_processed}</p>
                  <p className="text-[10px] text-gray-500">Files Read</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-green-400">{report.artifacts_saved.length}</p>
                  <p className="text-[10px] text-gray-500">Artifacts</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-orange-400">{report.total_iterations}</p>
                  <p className="text-[10px] text-gray-500">Iterations</p>
                </div>
              </div>
              {report.inferred_stack.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {report.inferred_stack.map((s, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 bg-gray-800 border border-gray-700 rounded text-gray-400">{s}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
