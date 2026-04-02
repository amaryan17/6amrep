"use client";

import { useState, useRef, useCallback } from "react";

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

export interface LogEntry {
  id: string;
  status: string;
  message: string;
  timestamp: Date;
}

export interface AgentStatus {
  id: "agent_1" | "agent_2" | "agent_3" | "agent_4" | "agent_5";
  name: string;
  description: string;
  status: "pending" | "processing" | "complete" | "error";
  message: string;
}

export interface MigrationResult {
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
    mermaid_architecture_diagram?: string;
    migration_strategy?: string;
    data_transit_protocol?: string;
  };
  finops: {
    gcp_monthly_cost: number;
    aws_monthly_cost: number;
    savings_percent: number;
    carbon_saved_kg?: number;
    arbitrage_action?: string;
  };
  security: {
    iam_policy_generated: string;
    principle_applied?: string;
  };
}

const INITIAL_AGENTS: AgentStatus[] = [
  {
    id: "agent_1",
    name: "🔍 Pre-Flight Scanner",
    description: "Tech Debt & Deprecated Libraries",
    status: "pending",
    message: "Awaiting analysis",
  },
  {
    id: "agent_2",
    name: "🔄 GCP-to-AWS Translator",
    description: "Terraform Generation",
    status: "pending",
    message: "Ready",
  },
  {
    id: "agent_3",
    name: "🏗️ Architecture Strategist",
    description: "Infrastructure Design",
    status: "pending",
    message: "Ready",
  },
  {
    id: "agent_4",
    name: "💰 FinOps Optimizer",
    description: "Cost & GreenOps Analysis",
    status: "pending",
    message: "Ready",
  },
  {
    id: "agent_5",
    name: "🔐 Zero-Trust Security",
    description: "IAM Policy Generation",
    status: "pending",
    message: "Ready",
  },
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ────────────────────────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────────────────────────

export function useMigration() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [agents, setAgents] = useState<AgentStatus[]>(INITIAL_AGENTS);
  const [isProcessing, setIsProcessing] = useState(false);
  const [migrationResult, setMigrationResult] =
    useState<MigrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setLogs([]);
    setAgents(INITIAL_AGENTS);
    setMigrationResult(null);
    setError(null);
  }, []);

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file) return;

    // Abort any previous request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsProcessing(true);
    setError(null);
    setLogs([]);
    setMigrationResult(null);
    setAgents(
      INITIAL_AGENTS.map((a) => ({
        ...a,
        status: "pending" as const,
        message: "Awaiting processing...",
      }))
    );

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_BASE}/api/v1/migrate`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("Response body is not readable");
      }

      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          setIsProcessing(false);
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks[chunks.length - 1];

        for (let i = 0; i < chunks.length - 1; i++) {
          const chunk = chunks[i];

          if (chunk.startsWith("data: ")) {
            try {
              const jsonStr = chunk.slice(6);
              const data = JSON.parse(jsonStr);

              // Update agent status
              const agentIds = [
                "agent_1",
                "agent_2",
                "agent_3",
                "agent_4",
                "agent_5",
              ];
              if (agentIds.includes(data.status)) {
                setAgents((prev) =>
                  prev.map((agent) =>
                    agent.id === data.status
                      ? {
                          ...agent,
                          status: "processing" as const,
                          message: data.message || "Processing...",
                        }
                      : agent
                  )
                );
              }

              // Add log entry
              setLogs((prev) => [
                ...prev,
                {
                  id: `${Date.now()}-${Math.random()}`,
                  status: data.status,
                  message: data.message || "",
                  timestamp: new Date(),
                },
              ]);

              // Handle completion
              if (data.status === "complete" && data.result) {
                setMigrationResult(data.result);
                setAgents((prev) =>
                  prev.map((agent) => ({
                    ...agent,
                    status: "complete" as const,
                    message: "✓ Complete",
                  }))
                );
              }

              // Handle error
              if (data.status === "error") {
                setError(data.message);
              }
            } catch {
              // skip unparseable SSE frame
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      setIsProcessing(false);
    }
  }, []);

  return {
    logs,
    agents,
    isProcessing,
    migrationResult,
    error,
    handleFileUpload,
    reset,
  };
}
