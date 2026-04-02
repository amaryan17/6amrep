'use client';

import { useState, useCallback, useRef } from 'react';

export interface RunnerAction {
  type: string;
  tool?: string;
  input?: Record<string, any>;
  result?: string;
  content?: string;
  iteration?: number;
  session_id?: string;
  duration_ms?: number;
  message?: string;
}

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
}

export interface ToolCallRecord {
  iteration: number;
  tool_name: string;
  tool_input: Record<string, any>;
  tool_result: string;
  duration_ms: number;
  status: string;
  timestamp: string;
}

export interface RunnerOutput {
  session_id: string;
  status: string;
  final_response: string;
  tool_calls: ToolCallRecord[];
  artifacts_generated: string[];
  token_usage: TokenUsage;
  total_iterations: number;
}

const API_BASE = 'http://localhost:8000';

export function useAgentRunner() {
  const [actions, setActions] = useState<RunnerAction[]>([]);
  const [result, setResult] = useState<RunnerOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const processSSEStream = useCallback(async (response: Response) => {
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
            const data = JSON.parse(line.slice(6));
            if (data.type === 'result') {
              setResult(data.result);
              if (data.session_id) setSessionId(data.session_id);
            } else if (data.type === 'error') {
              setError(data.message || 'Runner error');
            } else {
              setActions(prev => [...prev, data]);
            }
            if (data.session_id) setSessionId(data.session_id);
          } catch {
            // skip malformed
          }
        }
      }
    }
  }, []);

  const startSession = useCallback(async (task: string, fileContext?: string) => {
    setLoading(true);
    setError(null);
    setActions([]);
    setResult(null);

    abortRef.current = new AbortController();

    try {
      const response = await fetch(`${API_BASE}/api/v1/runner/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, file_context: fileContext }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) throw new Error(`Runner failed: ${response.statusText}`);

      const sid = response.headers.get('X-Session-Id');
      if (sid) setSessionId(sid);

      await processSSEStream(response);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    } finally {
      setLoading(false);
    }
  }, [processSSEStream]);

  const continueSession = useCallback(async (message: string) => {
    if (!sessionId) {
      setError('No active session');
      return;
    }

    setLoading(true);
    setError(null);

    abortRef.current = new AbortController();

    try {
      const response = await fetch(`${API_BASE}/api/v1/runner/${sessionId}/continue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) throw new Error(`Continue failed: ${response.statusText}`);
      await processSSEStream(response);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId, processSSEStream]);

  const clearSession = useCallback(async () => {
    if (sessionId) {
      try {
        await fetch(`${API_BASE}/api/v1/runner/${sessionId}`, { method: 'DELETE' });
      } catch {
        // ignore cleanup failures
      }
    }
    setSessionId(null);
    setActions([]);
    setResult(null);
    setError(null);
  }, [sessionId]);

  const newSession = useCallback(() => {
    setSessionId(null);
    setActions([]);
    setResult(null);
    setError(null);
  }, []);

  return {
    actions, result, loading, error, sessionId,
    startSession, continueSession, clearSession, newSession,
  };
}
