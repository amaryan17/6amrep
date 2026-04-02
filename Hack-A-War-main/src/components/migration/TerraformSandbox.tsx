'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Play, CheckCircle2, AlertTriangle, Plus, Minus, RefreshCw, Terminal } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface TerraformResource {
  type: string;
  name: string;
  provider: string;
  properties: Record<string, string>;
}

interface PlanResult {
  resources_to_add: TerraformResource[];
  resources_to_change: TerraformResource[];
  resources_to_destroy: TerraformResource[];
  warnings: string[];
  plan_output: string[];
  status: 'success' | 'error';
  estimated_cost_range: string;
}

// ============================================================================
// TERRAFORM HCL PARSER (client-side)
// ============================================================================

function parseTerraformResources(hcl: string): TerraformResource[] {
  const resources: TerraformResource[] = [];
  // Match resource "type" "name" { ... }
  const resourceRegex = /resource\s+"([^"]+)"\s+"([^"]+)"\s*\{/g;
  let match;

  while ((match = resourceRegex.exec(hcl)) !== null) {
    const type = match[1];
    const name = match[2];
    const provider = type.split('_')[0]; // aws, google, azurerm, etc.

    // Extract some properties from the block
    const startIdx = match.index + match[0].length;
    let braceCount = 1;
    let endIdx = startIdx;
    for (let i = startIdx; i < hcl.length && braceCount > 0; i++) {
      if (hcl[i] === '{') braceCount++;
      if (hcl[i] === '}') braceCount--;
      endIdx = i;
    }
    const block = hcl.substring(startIdx, endIdx);

    const properties: Record<string, string> = {};
    const propRegex = /(\w+)\s*=\s*"([^"]*)"$/gm;
    let propMatch;
    while ((propMatch = propRegex.exec(block)) !== null) {
      properties[propMatch[1]] = propMatch[2];
    }

    resources.push({ type, name, provider, properties });
  }

  return resources;
}

function getResourceIcon(type: string): string {
  if (type.includes('instance') || type.includes('ec2')) return '🖥️';
  if (type.includes('vpc') || type.includes('network')) return '🌐';
  if (type.includes('subnet')) return '🔌';
  if (type.includes('security_group') || type.includes('firewall')) return '🛡️';
  if (type.includes('db') || type.includes('rds') || type.includes('sql')) return '🗄️';
  if (type.includes('s3') || type.includes('bucket') || type.includes('storage')) return '📦';
  if (type.includes('lambda') || type.includes('function')) return '⚡';
  if (type.includes('load_balancer') || type.includes('lb') || type.includes('alb')) return '⚖️';
  if (type.includes('iam') || type.includes('role') || type.includes('policy')) return '🔑';
  if (type.includes('route') || type.includes('gateway')) return '🚪';
  if (type.includes('eip') || type.includes('elastic_ip')) return '📍';
  if (type.includes('autoscaling') || type.includes('asg')) return '📈';
  if (type.includes('cloudwatch') || type.includes('log') || type.includes('monitor')) return '📊';
  if (type.includes('sns') || type.includes('sqs') || type.includes('queue')) return '📬';
  if (type.includes('certificate') || type.includes('acm') || type.includes('ssl')) return '🔒';
  if (type.includes('dns') || type.includes('route53') || type.includes('domain')) return '🌍';
  if (type.includes('cloudfront') || type.includes('cdn')) return '🚀';
  if (type.includes('ecs') || type.includes('container') || type.includes('docker')) return '🐳';
  if (type.includes('eks') || type.includes('kubernetes')) return '☸️';
  return '📋';
}

function getResourceCost(type: string): string {
  if (type.includes('instance') || type.includes('ec2')) return '$8.50-$350/mo';
  if (type.includes('vpc') || type.includes('network')) return '$0 (free)';
  if (type.includes('subnet')) return '$0 (free)';
  if (type.includes('security_group') || type.includes('firewall')) return '$0 (free)';
  if (type.includes('db') || type.includes('rds') || type.includes('sql')) return '$15-$800/mo';
  if (type.includes('s3') || type.includes('bucket') || type.includes('storage')) return '$0.02-$5/mo';
  if (type.includes('lambda') || type.includes('function')) return '$0-$10/mo';
  if (type.includes('load_balancer') || type.includes('lb') || type.includes('alb')) return '$16-$50/mo';
  if (type.includes('iam') || type.includes('role') || type.includes('policy')) return '$0 (free)';
  if (type.includes('route') || type.includes('gateway')) return '$0-$35/mo';
  if (type.includes('eip') || type.includes('elastic_ip')) return '$3.60/mo';
  if (type.includes('autoscaling') || type.includes('asg')) return '$0 (free)';
  if (type.includes('cloudwatch') || type.includes('log')) return '$0-$5/mo';
  if (type.includes('nat_gateway')) return '$32-$45/mo';
  if (type.includes('cloudfront') || type.includes('cdn')) return '$0-$50/mo';
  return '$0-$10/mo';
}

function simulateTerraformPlan(hcl: string): PlanResult {
  const resources = parseTerraformResources(hcl);
  const warnings: string[] = [];
  const plan_output: string[] = [];

  // Add terraform init simulation
  plan_output.push('Initializing the backend...');
  plan_output.push('Initializing provider plugins...');
  plan_output.push('- Finding hashicorp/aws versions matching "~> 5.0"...');
  plan_output.push('- Installing hashicorp/aws v5.82.2...');
  plan_output.push('- Installed hashicorp/aws v5.82.2 (signed by HashiCorp)');
  plan_output.push('');
  plan_output.push('Terraform has been successfully initialized!');
  plan_output.push('');
  plan_output.push('─────────────────────────────────────────────────');
  plan_output.push('');
  plan_output.push('Terraform used the selected providers to generate the');
  plan_output.push('following execution plan. Resource actions are indicated');
  plan_output.push('with the following symbols:');
  plan_output.push('  + create');
  plan_output.push('');

  // Generate plan output for each resource
  resources.forEach((r) => {
    plan_output.push(`  # ${r.type}.${r.name} will be created`);
    plan_output.push(`  + resource "${r.type}" "${r.name}" {`);

    // Add common properties
    plan_output.push(`      + id                  = (known after apply)`);
    plan_output.push(`      + arn                 = (known after apply)`);

    Object.entries(r.properties).forEach(([key, value]) => {
      plan_output.push(`      + ${key.padEnd(20)} = "${value}"`);
    });

    plan_output.push(`    }`);
    plan_output.push('');
  });

  // Add warnings
  if (resources.some(r => r.type.includes('security_group'))) {
    const sgResources = resources.filter(r => r.type.includes('security_group'));
    sgResources.forEach(sg => {
      if (sg.properties['ingress'] && sg.properties['ingress'].includes('0.0.0.0/0')) {
        warnings.push(`⚠️ ${sg.type}.${sg.name}: Open ingress (0.0.0.0/0) detected — review security posture`);
      }
    });
  }

  if (!resources.some(r => r.type.includes('cloudwatch') || r.type.includes('log'))) {
    warnings.push('💡 No monitoring resources detected — consider adding CloudWatch alarms');
  }

  if (!resources.some(r => r.type.includes('backup'))) {
    warnings.push('💡 No backup resources detected — consider enabling AWS Backup');
  }

  // Plan summary
  plan_output.push('─────────────────────────────────────────────────');
  plan_output.push('');
  plan_output.push(`Plan: ${resources.length} to add, 0 to change, 0 to destroy.`);

  return {
    resources_to_add: resources,
    resources_to_change: [],
    resources_to_destroy: [],
    warnings,
    plan_output,
    status: resources.length > 0 ? 'success' : 'error',
    estimated_cost_range: resources.length > 0
      ? `$${(resources.length * 5).toFixed(0)} - $${(resources.length * 120).toFixed(0)}/month`
      : '$0/month',
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

interface TerraformSandboxProps {
  embeddedHcl?: string;
}

export default function TerraformSandbox({ embeddedHcl }: TerraformSandboxProps) {
  const [hcl, setHcl] = useState(embeddedHcl || '');
  const [planResult, setPlanResult] = useState<PlanResult | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [planStep, setPlanStep] = useState(0);
  const [showCode, setShowCode] = useState(true);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (embeddedHcl) setHcl(embeddedHcl);
  }, [embeddedHcl]);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [planStep]);

  const runPlan = async () => {
    if (!hcl.trim()) return;
    setIsPlanning(true);
    setPlanResult(null);
    setPlanStep(0);

    const result = simulateTerraformPlan(hcl);

    // Animate the plan output line by line
    for (let i = 0; i < result.plan_output.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 60 + Math.random() * 80));
      setPlanStep(i + 1);
    }

    setPlanResult(result);
    setIsPlanning(false);
  };

  const planOutput = planResult
    ? planResult.plan_output
    : simulateTerraformPlan(hcl).plan_output;

  const visibleLines = planOutput.slice(0, planStep);

  return (
    <div className="pt-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCode(v => !v)}
            className={`text-xs px-3 py-1.5 rounded-md transition font-medium ${
              showCode
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'
            }`}
          >
            📝 Editor
          </button>
          <button
            onClick={runPlan}
            disabled={isPlanning || !hcl.trim()}
            className={`flex items-center gap-2 text-xs px-4 py-1.5 rounded-md font-semibold transition ${
              isPlanning
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 cursor-wait'
                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
            }`}
          >
            {isPlanning ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin" />
                Planning...
              </>
            ) : (
              <>
                <Play className="w-3 h-3" />
                terraform plan
              </>
            )}
          </button>
        </div>
        {planResult && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-emerald-400 flex items-center gap-1">
              <Plus className="w-3 h-3" /> {planResult.resources_to_add.length} to add
            </span>
            <span className="text-yellow-400 flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> {planResult.resources_to_change.length} to change
            </span>
            <span className="text-red-400 flex items-center gap-1">
              <Minus className="w-3 h-3" /> {planResult.resources_to_destroy.length} to destroy
            </span>
          </div>
        )}
      </div>

      {/* Code Editor */}
      {showCode && (
        <div className="mb-4 rounded-lg overflow-hidden border border-gray-800">
          <div className="bg-gray-900/80 px-4 py-2 flex items-center gap-2 border-b border-gray-800">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/70" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
              <div className="w-3 h-3 rounded-full bg-green-500/70" />
            </div>
            <span className="text-xs text-gray-500 ml-2 font-mono">main.tf</span>
            <span className="text-xs text-gray-600 ml-auto">
              {hcl.split('\n').length} lines • HCL
            </span>
          </div>
          <textarea
            value={hcl}
            onChange={e => setHcl(e.target.value)}
            className="w-full bg-[#0d1117] text-green-300 font-mono text-xs p-4 outline-none resize-none"
            style={{
              minHeight: '200px',
              maxHeight: '400px',
              tabSize: 2,
              lineHeight: '1.6',
            }}
            spellCheck={false}
          />
        </div>
      )}

      {/* Terminal Output */}
      {(isPlanning || planResult) && (
        <div className="rounded-lg overflow-hidden border border-gray-800 mb-4">
          <div className="bg-gray-900/80 px-4 py-2 flex items-center gap-2 border-b border-gray-800">
            <Terminal className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs text-gray-400 font-mono">terraform plan</span>
            {isPlanning && (
              <span className="ml-auto text-xs text-yellow-400 animate-pulse">● Running...</span>
            )}
            {planResult && !isPlanning && (
              <span className="ml-auto text-xs text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Complete
              </span>
            )}
          </div>
          <div
            ref={terminalRef}
            className="bg-[#0d1117] p-4 font-mono text-xs overflow-y-auto"
            style={{ maxHeight: '300px', lineHeight: '1.7' }}
          >
            {visibleLines.map((line, i) => (
              <div
                key={i}
                className={`${
                  line.startsWith('  +') ? 'text-emerald-400' :
                  line.startsWith('  -') ? 'text-red-400' :
                  line.startsWith('  ~') ? 'text-yellow-400' :
                  line.startsWith('  #') ? 'text-cyan-400 font-semibold' :
                  line.startsWith('Plan:') ? 'text-white font-bold mt-2' :
                  line.includes('───') ? 'text-gray-600' :
                  line.includes('successfully') ? 'text-emerald-300' :
                  'text-gray-400'
                }`}
              >
                {line || '\u00A0'}
              </div>
            ))}
            {isPlanning && (
              <span className="inline-block w-2 h-4 bg-emerald-400 animate-pulse ml-1" />
            )}
          </div>
        </div>
      )}

      {/* Resource Cards */}
      {planResult && !isPlanning && (
        <>
          {/* Resource Grid */}
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <span className="text-lg">📦</span> Resources to Provision ({planResult.resources_to_add.length})
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {planResult.resources_to_add.map((r, i) => (
                <div
                  key={i}
                  className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-4 py-3 flex items-center gap-3 hover:bg-emerald-500/10 transition"
                >
                  <span className="text-xl">{getResourceIcon(r.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-emerald-300 truncate">{r.type}</p>
                    <p className="text-xs text-gray-500 truncate">{r.name}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-[10px] text-emerald-500 font-mono bg-emerald-500/10 px-2 py-0.5 rounded">+ create</span>
                    <p className="text-[10px] text-gray-500 mt-1">{getResourceCost(r.type)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Warnings */}
          {planResult.warnings.length > 0 && (
            <div className="mb-4 bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-yellow-400 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Recommendations
              </h4>
              {planResult.warnings.map((w, i) => (
                <p key={i} className="text-xs text-yellow-300/70 mb-1">{w}</p>
              ))}
            </div>
          )}

          {/* Summary Bar */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">Estimated Monthly Cost Range</p>
              <p className="text-lg font-bold text-white">{planResult.estimated_cost_range}</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-400">{planResult.resources_to_add.length}</p>
                <p className="text-gray-500">Resources</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-cyan-400">
                  {new Set(planResult.resources_to_add.map(r => r.type.split('_')[0])).size}
                </p>
                <p className="text-gray-500">Providers</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-400">
                  {new Set(planResult.resources_to_add.map(r => r.type)).size}
                </p>
                <p className="text-gray-500">Types</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Empty State */}
      {!planResult && !isPlanning && (
        <div className="text-center py-8">
          <p className="text-gray-500 text-sm">
            Click <strong className="text-emerald-400">terraform plan</strong> to simulate the execution plan
          </p>
        </div>
      )}
    </div>
  );
}
