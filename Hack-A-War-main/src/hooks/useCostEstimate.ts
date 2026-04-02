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
      // Intercept with mock data
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const result: CostEstimateOutput = {
        job_id: "mock_job_" + Date.now(),
        total_monthly_usd: 1245.50,
        total_annual_usd: 14946.00,
        gcp_monthly_usd: 2150.00,
        savings_monthly_usd: 904.50,
        savings_pct: 42,
        resources: [
          { resource_name: 'aws_db_instance.primary', resource_type: 'rds', instance_type: 'db.r6g.large', monthly_usd: 480.00, annual_usd: 5760.00, category: 'Database', pricing_source: 'AWS Pricing API', confidence: 'HIGH', spot_monthly: null, reserved_1yr: 320.00, reserved_3yr: 240.00, optimization_tip: 'Switch to Aurora Serverless v2 for variable workloads' },
          { resource_name: 'aws_instance.web_az1', resource_type: 'ec2', instance_type: 't3.large', monthly_usd: 60.80, annual_usd: 729.60, category: 'Compute', pricing_source: 'AWS Pricing API', confidence: 'HIGH', spot_monthly: 18.20, reserved_1yr: 45.00, reserved_3yr: 32.00, optimization_tip: 'Spot instances recommended for stateless web tier' },
          { resource_name: 'aws_instance.web_az2', resource_type: 'ec2', instance_type: 't3.large', monthly_usd: 60.80, annual_usd: 729.60, category: 'Compute', pricing_source: 'AWS Pricing API', confidence: 'HIGH', spot_monthly: 18.20, reserved_1yr: 45.00, reserved_3yr: 32.00, optimization_tip: 'Spot instances recommended for stateless web tier' },
          { resource_name: 'aws_alb.main', resource_type: 'alb', instance_type: null, monthly_usd: 22.50, annual_usd: 270.00, category: 'Networking', pricing_source: 'Estimation heuristic', confidence: 'MEDIUM', spot_monthly: null, reserved_1yr: null, reserved_3yr: null, optimization_tip: null },
        ],
        by_category: { 'Database': 480.00, 'Compute': 121.60, 'Networking': 22.50, 'Storage': 45.00 },
        top_cost_drivers: ['aws_db_instance.primary', 'aws_instance.web_az1'],
        optimization_summary: 'Significant savings found by gravitating compute to ARM-based Graviton2 processors (r6g, t4g) and utilizing spot fleets for the stateless web farm. Further reduction of 30% obtainable via 1-year reserved instances.',
        spot_eligible: ['aws_instance.web_az1', 'aws_instance.web_az2'],
        reserved_recommendation: 'Use 1-Year No Upfront Reserved Instances for databases.',
        rightsizing_suggestions: [
          { resource: 'aws_instance.web_az1', current: 't3.large', suggestion: 't4g.medium', potential_savings_monthly: 15.00 }
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

  const estimateFromFile = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      // Intercept with mock data (reusing same logic)
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const result: CostEstimateOutput = {
        job_id: "mock_job_" + Date.now(),
        total_monthly_usd: 1245.50,
        total_annual_usd: 14946.00,
        gcp_monthly_usd: 2150.00,
        savings_monthly_usd: 904.50,
        savings_pct: 42,
        resources: [
          { resource_name: 'aws_db_instance.primary', resource_type: 'rds', instance_type: 'db.r6g.large', monthly_usd: 480.00, annual_usd: 5760.00, category: 'Database', pricing_source: 'AWS Pricing API', confidence: 'HIGH', spot_monthly: null, reserved_1yr: 320.00, reserved_3yr: 240.00, optimization_tip: 'Switch to Aurora Serverless v2 for variable workloads' },
          { resource_name: 'aws_instance.web_az1', resource_type: 'ec2', instance_type: 't3.large', monthly_usd: 60.80, annual_usd: 729.60, category: 'Compute', pricing_source: 'AWS Pricing API', confidence: 'HIGH', spot_monthly: 18.20, reserved_1yr: 45.00, reserved_3yr: 32.00, optimization_tip: 'Spot instances recommended for stateless web tier' },
        ],
        by_category: { 'Database': 480.00, 'Compute': 121.60, 'Networking': 22.50, 'Storage': 45.00 },
        top_cost_drivers: ['aws_db_instance.primary'],
        optimization_summary: 'Analysis completed successfully. Rightsizing identified.',
        spot_eligible: ['aws_instance.web_az1'],
        reserved_recommendation: 'Use 1-Year No Upfront',
        rightsizing_suggestions: []
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
