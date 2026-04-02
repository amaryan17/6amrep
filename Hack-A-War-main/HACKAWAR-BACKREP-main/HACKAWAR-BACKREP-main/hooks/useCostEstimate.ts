'use client';

import { useState, useCallback } from 'react';

export interface ResourceCost {
  resource_name: string;
  resource_type: string;
  instance_type: string | null;
  monthly_usd: number;
  annual_usd: number;
  category: string;
  pricing_source: string;
  confidence: string;
  spot_monthly: number | null;
  reserved_1yr: number | null;
  reserved_3yr: number | null;
  optimization_tip: string | null;
}

export interface CostEstimateOutput {
  job_id: string;
  total_monthly_usd: number;
  total_annual_usd: number;
  gcp_monthly_usd: number;
  savings_monthly_usd: number;
  savings_pct: number;
  resources: ResourceCost[];
  by_category: Record<string, number>;
  top_cost_drivers: string[];
  optimization_summary: string;
  spot_eligible: string[];
  reserved_recommendation: string;
  rightsizing_suggestions: Array<{
    resource: string;
    current: string;
    suggestion: string;
    potential_savings_monthly: number;
  }>;
}

const API_BASE = 'http://localhost:8000';

export function useCostEstimate() {
  const [data, setData] = useState<CostEstimateOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const estimateFromHCL = useCallback(async (terraformHcl: string) => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const response = await fetch(`${API_BASE}/api/v1/cost-estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ terraform_hcl: terraformHcl }),
      });

      if (!response.ok) {
        throw new Error(`Cost estimation failed: ${response.statusText}`);
      }

      const result: CostEstimateOutput = await response.json();
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

  const estimateFromFile = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE}/api/v1/cost-estimate/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Cost estimation failed: ${response.statusText}`);
      }

      const result: CostEstimateOutput = await response.json();
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

  const getCachedEstimate = useCallback(async (jobId: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/cost-estimate/${jobId}`);
      if (response.ok) {
        const result: CostEstimateOutput = await response.json();
        setData(result);
        return result;
      }
    } catch {
      // silently fail for cache miss
    }
    return null;
  }, []);

  return { data, loading, error, estimateFromHCL, estimateFromFile, getCachedEstimate };
}
