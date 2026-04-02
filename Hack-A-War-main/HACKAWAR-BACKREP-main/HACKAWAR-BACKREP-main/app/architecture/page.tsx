import type { Metadata } from 'next';
import ArchitectureDiagram from '@/components/ArchitectureDiagram';

export const metadata: Metadata = {
  title: 'Architecture Diagram | Aegis Migration Factory',
  description: 'Auto-generated interactive AWS architecture diagrams from Terraform HCL using React Flow.',
};

export default function ArchitecturePage() {
  return <ArchitectureDiagram />;
}
