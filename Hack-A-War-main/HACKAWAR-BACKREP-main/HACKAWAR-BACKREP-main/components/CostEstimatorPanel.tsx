'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useCostEstimate, CostEstimateOutput, ResourceCost } from '@/hooks/useCostEstimate';
import {
  Upload, DollarSign, TrendingDown, Zap, Download, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle2, Loader, BarChart3, ArrowRight,
} from 'lucide-react';

type PricingView = 'on_demand' | 'spot' | 'reserved_1yr' | 'reserved_3yr';

export default function CostEstimatorPanel({ embeddedHcl }: { embeddedHcl?: string }) {
  const { data, loading, error, estimateFromHCL, estimateFromFile } = useCostEstimate();
  const [hclInput, setHclInput] = useState('');
  const [pricingView, setPricingView] = useState<PricingView>('on_demand');
  const [expandedResources, setExpandedResources] = useState<Set<string>>(new Set());
  const [animatedTotal, setAnimatedTotal] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasInitialized = useRef(false);

  // Animated counter effect
  useEffect(() => {
    if (!data) { setAnimatedTotal(0); return; }
    const target = getDisplayTotal(data, pricingView);
    const duration = 1200;
    const startTime = Date.now();
    const startVal = animatedTotal;
    const diff = target - startVal;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedTotal(startVal + diff * eased);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [data, pricingView]);

  // Handle auto-generation if embedded
  useEffect(() => {
    if (embeddedHcl && !hasInitialized.current) {
      hasInitialized.current = true;
      estimateFromHCL(embeddedHcl);
    }
  }, [embeddedHcl, estimateFromHCL]);

  function getDisplayTotal(d: CostEstimateOutput, view: PricingView): number {
    if (view === 'on_demand') return d.total_monthly_usd;
    let total = 0;
    for (const r of d.resources) {
      if (view === 'spot' && r.spot_monthly != null) total += r.spot_monthly;
      else if (view === 'reserved_1yr' && r.reserved_1yr != null) total += r.reserved_1yr;
      else if (view === 'reserved_3yr' && r.reserved_3yr != null) total += r.reserved_3yr;
      else total += r.monthly_usd;
    }
    return total;
  }

  function getResourceCost(r: ResourceCost, view: PricingView): number {
    if (view === 'spot' && r.spot_monthly != null) return r.spot_monthly;
    if (view === 'reserved_1yr' && r.reserved_1yr != null) return r.reserved_1yr;
    if (view === 'reserved_3yr' && r.reserved_3yr != null) return r.reserved_3yr;
    return r.monthly_usd;
  }

  const toggleResource = (name: string) => {
    setExpandedResources(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const exportCSV = () => {
    if (!data) return;
    const header = 'Resource,Type,Instance,Monthly USD,Annual USD,Category,Source,Confidence,Tip\n';
    const rows = data.resources.map(r =>
      `"${r.resource_name}","${r.resource_type}","${r.instance_type || ''}",${r.monthly_usd},${r.annual_usd},"${r.category}","${r.pricing_source}","${r.confidence}","${r.optimization_tip || ''}"`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `aegis-cost-estimate-${data.job_id.slice(0, 8)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const categoryColors: Record<string, string> = {
    Compute: '#22d3ee', Database: '#818cf8', Storage: '#34d399', Networking: '#a78bfa',
    Serverless: '#fbbf24', Security: '#f87171', Containers: '#fb923c', Monitoring: '#f472b6',
    Compliance: '#e879f9', Messaging: '#38bdf8', Cache: '#2dd4bf', DNS: '#67e8f9',
    Search: '#c084fc', Streaming: '#fca5a1', Other: '#94a3b8',
  };

  // ───────────── RENDER ─────────────

  return (
    <div className={embeddedHcl ? "w-full" : "min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 text-white"}>
      {/* Header - Only if not embedded */}
      {!embeddedHcl && (
        <div className="border-b border-gray-800 bg-black/60 backdrop-blur-md px-8 py-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
              <DollarSign className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                AWS Cost Estimator
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">Real-time infrastructure cost analysis powered by Aegis</p>
            </div>
          </div>
        </div>
      )}

      <div className={embeddedHcl ? "w-full py-4 space-y-8" : "max-w-7xl mx-auto px-8 py-8 space-y-8"}>
        {/* Input Section - Only if not embedded */}
        {!embeddedHcl && (
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Paste Terraform HCL</label>
              <textarea
                value={hclInput}
                onChange={(e) => setHclInput(e.target.value)}
                placeholder={'resource "aws_instance" "web" {\n  ami           = "ami-0c55b159cbfafe1f0"\n  instance_type = "t3.large"\n}'}
                className="w-full h-40 bg-gray-900/80 border border-gray-700 rounded-lg px-4 py-3 text-sm font-mono text-gray-300 placeholder-gray-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 focus:outline-none resize-none"
              />
              <button
                onClick={() => estimateFromHCL(hclInput)}
                disabled={loading || !hclInput.trim()}
                className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-40 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-900/30"
              >
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {loading ? 'Estimating...' : 'Estimate Cost'}
              </button>
            </div>
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-700 rounded-lg hover:border-cyan-500/50 transition cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add('border-cyan-500', 'bg-cyan-500/5');
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove('border-cyan-500', 'bg-cyan-500/5');
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('border-cyan-500', 'bg-cyan-500/5');
                const f = e.dataTransfer.files?.[0];
                if (f) estimateFromFile(f);
              }}
            >
              <Upload className="w-8 h-8 text-gray-500 mb-3" />
              <p className="text-sm text-gray-400">Upload .tf or .zip file</p>
              <p className="text-xs text-gray-600 mt-1">Drag & drop or click to browse</p>
              <input ref={fileInputRef} type="file" accept=".tf,.zip" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) estimateFromFile(f); }} />
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/40 rounded-lg p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span className="text-sm text-red-300">{error}</span>
          </div>
        )}

        {/* Results */}
        {data && (
          <>
            {/* Total Cost Hero */}
            <div className="relative overflow-hidden rounded-2xl border border-gray-800 bg-gradient-to-br from-gray-900 via-gray-900 to-cyan-950/20 p-8">
              <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
              <div className="relative z-10 flex items-end justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Estimated Monthly Cost</p>
                  <div className="text-5xl font-bold text-white" style={{ textShadow: '0 0 40px rgba(34,211,238,0.3)' }}>
                    ${animatedTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    <span className="text-lg text-gray-400 font-normal">/mo</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    ${data.total_annual_usd.toLocaleString('en-US', { maximumFractionDigits: 0 })}/year · {data.resources.length} resources
                  </p>
                </div>
                {data.savings_pct > 5 && (
                  <div className="px-4 py-2 rounded-full bg-green-500/15 border border-green-500/40 flex items-center gap-2"
                    style={{ boxShadow: '0 0 20px rgba(34,197,94,0.15)' }}>
                    <TrendingDown className="w-4 h-4 text-green-400" />
                    <span className="text-sm font-bold text-green-400">{data.savings_pct.toFixed(0)}% CHEAPER</span>
                  </div>
                )}
              </div>
            </div>

            {/* GCP vs AWS Comparison */}
            <div className="grid grid-cols-2 gap-6">
              <div className="rounded-xl border border-red-500/20 bg-gradient-to-br from-gray-900 to-red-950/10 p-6">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">GCP Estimated Cost</p>
                <p className="text-3xl font-bold text-red-400">${data.gcp_monthly_usd.toLocaleString('en-US', { maximumFractionDigits: 0 })}<span className="text-base text-gray-500 font-normal">/mo</span></p>
              </div>
              <div className="rounded-xl border border-green-500/20 bg-gradient-to-br from-gray-900 to-green-950/10 p-6">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">AWS Estimated Cost</p>
                <p className="text-3xl font-bold text-green-400">${data.total_monthly_usd.toLocaleString('en-US', { maximumFractionDigits: 0 })}<span className="text-base text-gray-500 font-normal">/mo</span></p>
                <p className="text-xs text-green-400/70 mt-1">Save ${data.savings_monthly_usd.toLocaleString('en-US', { maximumFractionDigits: 0 })}/mo</p>
              </div>
            </div>

            {/* Pricing View Tabs */}
            <div className="flex gap-2">
              {(['on_demand', 'spot', 'reserved_1yr', 'reserved_3yr'] as PricingView[]).map((view) => (
                <button key={view} onClick={() => setPricingView(view)}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${pricingView === view
                    ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 shadow-lg shadow-cyan-900/20'
                    : 'bg-gray-900 border border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                  {view === 'on_demand' ? 'On-Demand' : view === 'spot' ? '⚡ Spot' : view === 'reserved_1yr' ? '📅 1yr Reserved' : '📅 3yr Reserved'}
                </button>
              ))}
            </div>

            {/* Category Bar Chart */}
            <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-6">
              <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" /> Cost by Category
              </h3>
              <div className="space-y-3">
                {Object.entries(data.by_category)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cat, cost]) => {
                    const maxCost = Math.max(...Object.values(data.by_category));
                    const pct = maxCost > 0 ? (cost / maxCost) * 100 : 0;
                    const color = categoryColors[cat] || '#94a3b8';
                    return (
                      <div key={cat} className="group">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-400">{cat}</span>
                          <span className="text-xs font-mono text-gray-300">${cost.toFixed(2)}/mo</span>
                        </div>
                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${pct}%`, backgroundColor: color, boxShadow: `0 0 8px ${color}60` }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Resource Table */}
            <div className="rounded-xl border border-gray-800 bg-gray-900/60 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-300">Resource Breakdown</h3>
                <button onClick={exportCSV}
                  className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-400 hover:text-white hover:border-cyan-500/50 transition flex items-center gap-1.5">
                  <Download className="w-3 h-3" /> Export CSV
                </button>
              </div>
              <div className="divide-y divide-gray-800/60">
                {data.resources.map((r) => (
                  <div key={r.resource_name} className="group">
                    <div className="px-6 py-3 flex items-center gap-4 hover:bg-gray-800/30 cursor-pointer transition"
                      onClick={() => toggleResource(r.resource_name)}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-200 font-mono truncate">{r.resource_name}</p>
                        <p className="text-xs text-gray-500">{r.category} · {r.instance_type || r.resource_type}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-white">${getResourceCost(r, pricingView).toFixed(2)}<span className="text-xs text-gray-500">/mo</span></p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${r.confidence === 'HIGH' ? 'bg-green-500/15 text-green-400' : r.confidence === 'MEDIUM' ? 'bg-yellow-500/15 text-yellow-400' : 'bg-red-500/15 text-red-400'}`}>
                          {r.confidence} · {r.pricing_source.replace('_', ' ')}
                        </span>
                      </div>
                      {expandedResources.has(r.resource_name) ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                    </div>
                    {expandedResources.has(r.resource_name) && (
                      <div className="px-6 pb-4 bg-gray-800/20 space-y-2">
                        <div className="grid grid-cols-4 gap-3 text-xs">
                          <div><span className="text-gray-500">On-Demand</span><br /><span className="text-gray-300">${r.monthly_usd.toFixed(2)}/mo</span></div>
                          <div><span className="text-gray-500">Spot</span><br /><span className="text-cyan-400">{r.spot_monthly != null ? `$${r.spot_monthly.toFixed(2)}/mo` : 'N/A'}</span></div>
                          <div><span className="text-gray-500">1yr Reserved</span><br /><span className="text-blue-400">{r.reserved_1yr != null ? `$${r.reserved_1yr.toFixed(2)}/mo` : 'N/A'}</span></div>
                          <div><span className="text-gray-500">3yr Reserved</span><br /><span className="text-purple-400">{r.reserved_3yr != null ? `$${r.reserved_3yr.toFixed(2)}/mo` : 'N/A'}</span></div>
                        </div>
                        {r.optimization_tip && (
                          <div className="flex items-start gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                            <span className="text-xs text-amber-300">{r.optimization_tip}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Rightsizing Suggestions */}
            {data.rightsizing_suggestions.length > 0 && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6 space-y-3">
                <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Rightsizing Suggestions
                </h3>
                {data.rightsizing_suggestions.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-gray-900/60 rounded-lg border border-gray-800">
                    <ArrowRight className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-300">{s.suggestion}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{s.resource} · Save ~${s.potential_savings_monthly.toFixed(0)}/mo</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Optimization Summary */}
            <div className="rounded-xl border border-gray-800 bg-gradient-to-r from-gray-900 to-cyan-950/10 p-6">
              <h3 className="text-sm font-semibold text-cyan-400 flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-4 h-4" /> Optimization Summary
              </h3>
              <p className="text-sm text-gray-300 leading-relaxed">{data.optimization_summary}</p>
              <div className="flex gap-3 mt-4">
                <span className="text-xs px-2 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded text-cyan-400">
                  Recommended: {data.reserved_recommendation.replace(/_/g, ' ')}
                </span>
                <span className="text-xs px-2 py-1 bg-green-500/10 border border-green-500/30 rounded text-green-400">
                  {data.spot_eligible.length} Spot-eligible resources
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
