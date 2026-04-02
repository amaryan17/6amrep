'use client';

import { useState, useCallback, useRef } from 'react';

export interface AgentAction {
  type: string;
  tool?: string;
  input?: Record<string, any>;
  result?: string;
  content?: string;
  summary?: string;
  iteration?: number;
  session_id?: string;
  message?: string;
}

export interface WorkspaceReport {
  session_id: string;
  files_discovered: string[];
  files_processed: number;
  artifacts_saved: string[];
  resource_inventory: Record<string, number>;
  architecture_summary: string;
  inferred_stack: string[];
  output_zip_path: string;
  execution_log: Array<Record<string, any>>;
  total_iterations: number;
  status: string;
}

const API_BASE = 'http://localhost:8000';

export function useAutonomousAgent() {
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [report, setReport] = useState<WorkspaceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const runAgent = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    setActions([]);
    setReport(null);

    abortRef.current = new AbortController();

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE}/api/v1/agent/run`, {
        method: 'POST',
        body: formData,
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`Agent run failed: ${response.statusText}`);
      }

      // Get session ID from header
      const sid = response.headers.get('X-Session-Id');
      if (sid) setSessionId(sid);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('Response body not readable');

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines[lines.length - 1];

        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i];
          if (line.startsWith('data: ')) {
            try {
              const data: AgentAction = JSON.parse(line.slice(6));
              if (data.type === 'report') {
                setReport((data as any).report);
              } else if (data.type === 'error') {
                setError(data.message || 'Agent error');
              } else {
                setActions(prev => [...prev, data]);
              }
              if (data.session_id) setSessionId(data.session_id);
            } catch {
              // skip malformed events
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const stopAgent = useCallback(() => {
    abortRef.current?.abort();
    setLoading(false);
  }, []);

  const downloadOutputs = useCallback(async () => {
    if (!sessionId) return;
    window.open(`${API_BASE}/api/v1/agent/${sessionId}/download`, '_blank');
  }, [sessionId]);

  return { actions, report, loading, error, sessionId, runAgent, stopAgent, downloadOutputs };
}
