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
      // Intercept with mock data for robust presentation without AWS keys
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const result: DiagramOutput = {
        aws_resource_count: 5,
        vpc_count: 1,
        has_multi_az: true,
        has_load_balancer: true,
        has_database: true,
        complexity_score: 4,
        mermaid_source: "graph TD;\n  ALB-->EC2_1;",
        nodes: [
          { id: 'vpc', type: 'awsNode', label: 'Production VPC (10.0.0.0/16)', layer: 0, group: null, position: { x: -50, y: -100 }, data: { type: 'vpc', borderColor: '#3b82f6', color: '#60a5fa' }, style: { border: '1px solid #3b82f6' } },
          { id: 'alb', type: 'awsNode', label: 'Application Load Balancer', layer: 1, group: 'vpc', position: { x: 50, y: 50 }, data: { type: 'alb', monthly_cost: 22 }, style: {} },
          { id: 'ec2_1', type: 'awsNode', label: 'Web Server AZ-A', layer: 2, group: 'vpc', position: { x: 350, y: -50 }, data: { type: 'ec2', instance_type: 't3.large', monthly_cost: 65 }, style: {} },
          { id: 'ec2_2', type: 'awsNode', label: 'Web Server AZ-B', layer: 2, group: 'vpc', position: { x: 350, y: 150 }, data: { type: 'ec2', instance_type: 't3.large', monthly_cost: 65 }, style: {} },
          { id: 'rds', type: 'awsNode', label: 'Aurora PostgreSQL Primary', layer: 3, group: 'vpc', position: { x: 650, y: 50 }, data: { type: 'rds', instance_type: 'db.r6g.large', monthly_cost: 210 }, style: {} },
        ],
        edges: [
          { id: 'e1', source: 'alb', target: 'ec2_1', label: 'Port 80', type: 'smoothstep', animated: true, style: { stroke: '#06b6d4', strokeWidth: 2 } },
          { id: 'e2', source: 'alb', target: 'ec2_2', label: 'Port 80', type: 'smoothstep', animated: true, style: { stroke: '#06b6d4', strokeWidth: 2 } },
          { id: 'e3', source: 'ec2_1', target: 'rds', label: 'Port 5432', type: 'smoothstep', animated: false, style: { stroke: '#8b5cf6', strokeWidth: 2, strokeDasharray: '5 5' } },
          { id: 'e4', source: 'ec2_2', target: 'rds', label: 'Port 5432', type: 'smoothstep', animated: false, style: { stroke: '#8b5cf6', strokeWidth: 2, strokeDasharray: '5 5' } },
        ]
      };

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
