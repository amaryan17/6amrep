import type { Metadata } from 'next';
import CostEstimatorPanel from '@/components/CostEstimatorPanel';

export const metadata: Metadata = {
  title: 'AWS Cost Estimator | Aegis Migration Factory',
  description: 'Real-time AWS infrastructure cost estimation from Terraform HCL with Spot, Reserved, and On-Demand pricing comparison.',
};

export default function CostEstimatorPage() {
  return <CostEstimatorPanel />;
}
