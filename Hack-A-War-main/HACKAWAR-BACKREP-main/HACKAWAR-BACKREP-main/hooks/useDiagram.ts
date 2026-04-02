'use client';

import { useState, useCallback } from 'react';

export interface DiagramNode {
  id: string;
  type: string;
  label: string;
  layer: number;
  group: string | null;
  position: { x: number; y: number };
  data: Record<string, any>;
  style: Record<string, any>;
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  label: string | null;
  type: string;
  animated: boolean;
  style: Record<string, any>;
}

export interface DiagramOutput {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  mermaid_source: string;
  aws_resource_count: number;
  vpc_count: number;
  has_multi_az: boolean;
  has_load_balancer: boolean;
  has_database: boolean;
  complexity_score: number;
}

const API_BASE = 'http://localhost:8000';

export function useDiagram() {
  const [data, setData] = useState<DiagramOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateDiagram = useCallback(async (terraformHcl: string) => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const response = await fetch(`${API_BASE}/api/v1/diagram/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ terraform_hcl: terraformHcl }),
      });

      if (!response.ok) {
        throw new Error(`Diagram generation failed: ${response.statusText}`);
      }

      const result: DiagramOutput = await response.json();
      setData(result);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, generateDiagram, setData };
}
