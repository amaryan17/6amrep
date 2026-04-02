import type { Metadata } from 'next';
import AgentRunnerPanel from '@/components/AgentRunnerPanel';

export const metadata: Metadata = {
  title: 'Agent Runner | Aegis Migration Factory',
  description: 'Multi-turn AI agent with cloud migration tools — cost estimation, compliance checking, IAM generation, and Terraform validation.',
};

export default function AgentRunnerPage() {
  return <AgentRunnerPanel />;
}
