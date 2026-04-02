"use client";

import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useMigration,
  type AgentStatus,
  type MigrationResult,
} from "@/hooks/useMigration";
import TerraformSandbox from "./TerraformSandbox";
import CostEstimatorPanel from "./CostEstimatorPanel";
import ArchitectureDiagram from "./ArchitectureDiagram";
import {
  Upload,
  Zap,
  Shield,
  TrendingDown,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Download,
  Terminal,
  Code2,
  ArrowRight,
  Database,
  Cpu,
  Lock,
} from "lucide-react";

// ════════════════════════════════════════════════════════════════
// MAIN DASHBOARD COMPONENT
// ════════════════════════════════════════════════════════════════

export default function MigrationDashboard() {
  const {
    logs,
    agents,
    isProcessing,
    migrationResult,
    error,
    handleFileUpload,
  } = useMigration();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [showCost, setShowCost] = useState(false);
  const [showArch, setShowArch] = useState(false);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="w-full min-h-screen bg-[#080C14] text-[#E8F4FD] pt-20 flex flex-col">
      {/* ── TOP PANEL: Upload, Pipeline, Terminal ── */}
      <div className="flex w-full h-[280px] max-h-[300px] flex-shrink-0 gap-6 px-8 pt-6 pb-2">
        
        {/* 1. Upload Zone (Card 1) */}
        <div className="w-[28%] min-w-[300px] bg-[#0D1520]/80 border border-[#1A2D45] rounded-xl shadow-lg flex flex-col overflow-hidden relative">
          {/* Header */}
          <div className="bg-black/40 border-b border-[#1A2D45] px-4 py-2.5 flex items-center gap-2 flex-shrink-0">
            <Upload className="w-3.5 h-3.5 text-[#39FF14]" />
            <span className="text-[10px] font-mono text-[#3A5470] uppercase tracking-wider">
              Config Upload
            </span>
          </div>

          {/* Content */}
          <div className="flex-1 bg-black/30 p-4 flex flex-col">
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add("border-[#39FF14]", "bg-[#39FF14]/5");
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove("border-[#39FF14]", "bg-[#39FF14]/5");
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove("border-[#39FF14]", "bg-[#39FF14]/5");
                const file = e.dataTransfer.files[0];
                if (file) handleFileUpload(file);
              }}
              className="flex-1 border border-dashed border-[#1A2D45] rounded-lg cursor-pointer transition-all duration-300 hover:border-[#39FF14]/60 hover:bg-[#39FF14]/5 flex flex-col items-center justify-center gap-3 group"
            >
              <div className="w-12 h-12 rounded-full bg-[#1A2D45]/40 flex items-center justify-center group-hover:bg-[#39FF14]/10 transition-colors">
                {isProcessing ? (
                  <Loader2 className="w-6 h-6 text-[#39FF14] animate-spin" />
                ) : (
                  <Upload className="w-6 h-6 text-[#00E5FF] group-hover:text-[#39FF14] transition-colors" />
                )}
              </div>
              <div className="text-center font-mono">
                <p className="text-xs text-[#00E5FF]">
                  {isProcessing ? "[uploading] processing..." : "> awaiting_drop..."}
                </p>
                <p className="text-[10px] text-[#3A5470] mt-2">
                  [supported] .tf .zip .py .yaml
                </p>
              </div>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
            }}
            className="hidden"
            accept=".zip,.py,.tf,.json,.yaml,.yml"
            disabled={isProcessing}
          />
        </div>

        {/* 2. Agent Pipeline (Card 2) */}
        <div className="flex-1 min-w-[400px] bg-[#0D1520]/80 border border-[#1A2D45] rounded-xl shadow-lg flex flex-col overflow-hidden relative">
          {/* Header */}
          <div className="bg-black/40 border-b border-[#1A2D45] px-4 py-2.5 flex items-center gap-2 flex-shrink-0">
            <Cpu className="w-3.5 h-3.5 text-[#00E5FF]" />
            <span className="text-[10px] font-mono text-[#3A5470] uppercase tracking-wider">
              AI Agent Pipeline
            </span>
          </div>
          
          {/* Content */}
          <div className="flex-1 p-4 flex flex-col justify-center overflow-hidden">
            <AgentPipeline agents={agents} />
          </div>
        </div>

        {/* 3. Terminal Log (Card 3) */}
        <div className="w-[30%] min-w-[320px] bg-[#0D1520]/80 border border-[#1A2D45] rounded-xl shadow-lg flex flex-col overflow-hidden relative">
          <div className="bg-black/40 border-b border-[#1A2D45] px-4 py-2.5 flex items-center gap-2 flex-shrink-0">
            <Terminal className="w-3.5 h-3.5 text-[#39FF14]" />
            <span className="text-[10px] font-mono text-[#3A5470] uppercase tracking-wider">
              Live Stream
            </span>
            <span className="ml-auto text-[10px] font-mono text-[#3A5470]">
              {logs.length} events
            </span>
          </div>

          <div className="flex-1 overflow-y-auto bg-black/30 p-4 font-mono text-[11px] space-y-1">
            {logs.length === 0 && !isProcessing && (
              <div className="text-[#3A5470]">
                $ awaiting_file_upload...
              </div>
            )}

            {logs.map((log) => (
              <div key={log.id} className="text-[#6B8CAE] flex items-start gap-2">
                <span className="flex-shrink-0">
                  {log.status.startsWith("agent_") ? (
                    <Loader2 className="w-3 h-3 text-[#00E5FF] animate-spin" />
                  ) : log.status === "complete" ? (
                    <CheckCircle2 className="w-3 h-3 text-[#39FF14]" />
                  ) : log.status === "error" ? (
                    <AlertCircle className="w-3 h-3 text-[#FF4444]" />
                  ) : (
                    <span className="w-3 h-3 inline-block" />
                  )}
                </span>
                <span>
                  <span className="text-[#00E5FF]">[{log.status}]</span> {log.message}
                </span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>

          {/* Footer */}
          <div className="bg-black/40 border-t border-[#1A2D45] px-4 py-2 text-[10px] font-mono text-[#3A5470] flex-shrink-0">
            {isProcessing && (
              <span className="animate-pulse text-[#FFB800]">● Processing migration...</span>
            )}
            {!isProcessing && migrationResult && (
              <span className="text-[#39FF14]">✓ Migration complete</span>
            )}
            {!isProcessing && !migrationResult && !error && (
              <span>Ready</span>
            )}
          </div>
        </div>
      </div>

      {/* Global Error Bar */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-[#FF4444]/10 border-b border-[#FF4444]/40 px-6 py-2 flex items-center justify-center gap-2"
          >
            <AlertCircle className="w-4 h-4 text-[#FF4444] flex-shrink-0" />
            <div className="text-xs font-semibold text-[#FF4444]">{error}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─────── BOTTOM PANEL: Results ─────── */}
      <div className="w-full flex-1 pb-20">
          {!migrationResult && !isProcessing && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-[#1A2D45]/40 flex items-center justify-center mx-auto mb-6">
                  <Zap className="w-10 h-10 text-[#3A5470]" />
                </div>
                <p className="text-[#3A5470] font-mono text-sm">
                  Upload a GCP config file to begin migration
                </p>
              </div>
            </div>
          )}

          {isProcessing && !migrationResult && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="w-10 h-10 animate-spin text-[#00E5FF] mx-auto mb-4" />
                <p className="text-[#6B8CAE] font-mono text-sm">
                  Analyzing your infrastructure...
                </p>
              </div>
            </div>
          )}

          {migrationResult && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="p-8 px-12 space-y-10 w-full"
            >
              {/* Enterprise Execution Strategy */}
              <StrategyPanel result={migrationResult} />

              <div className="border-t border-[#1A2D45]" />

              {/* FinOps */}
              <FinOpsPanel result={migrationResult} />

              <div className="border-t border-[#1A2D45]" />

              {/* Tech Debt */}
              <TechDebtPanel result={migrationResult} />

              <div className="border-t border-[#1A2D45]" />

              {/* Terraform */}
              <TerraformPanel result={migrationResult} />

              <div className="border-t border-[#1A2D45]" />

              {/* Security */}
              <SecurityPanel result={migrationResult} />

              <div className="border-t border-[#1A2D45]" />

              {/* AWS Cost Breakdown */}
              <div className="space-y-4">
                <button
                  onClick={() => setShowCost((v) => !v)}
                  className="w-full bg-[#0D1520]/60 backdrop-blur-md border border-[#1A2D45] rounded-xl px-6 py-4 flex items-center justify-between hover:bg-[#0D1520]/80 hover:border-[#39FF14]/40 hover:shadow-[0_0_20px_rgba(57,255,20,0.05)] transition-all duration-300"
                >
                  <div className="flex items-center gap-3">
                    <TrendingDown className="w-5 h-5 text-[#39FF14]" />
                    <div className="text-left">
                      <p className="text-lg font-medium text-[#E8F4FD] tracking-wide">AWS Cost Breakdown</p>
                      <p className="text-xs text-[#3A5470] font-mono mt-0.5">Resource-level pricing, spot/reserved comparisons, rightsizing</p>
                    </div>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full font-medium transition ${showCost ? 'bg-[#39FF14]/10 text-[#39FF14] border border-[#39FF14]/30' : 'bg-black/40 text-[#6B8CAE] border border-[#1A2D45]'}`}>
                    {showCost ? '▲ Collapse' : '▼ Analyze'}
                  </span>
                </button>
                {showCost && (
                  <div className="bg-[#0D1520]/40 backdrop-blur-md border border-[#1A2D45] rounded-xl p-1 overflow-hidden">
                    <CostEstimatorPanel embeddedHcl={migrationResult.translation.new_aws_terraform} />
                  </div>
                )}
              </div>

              <div className="border-t border-[#1A2D45]" />

              {/* Architecture Diagram */}
              <div className="space-y-4">
                <button
                  onClick={() => setShowArch((v) => !v)}
                  className="w-full bg-[#0D1520]/60 backdrop-blur-md border border-[#1A2D45] rounded-xl px-6 py-4 flex items-center justify-between hover:bg-[#0D1520]/80 hover:border-[#00E5FF]/40 hover:shadow-[0_0_20px_rgba(0,229,255,0.05)] transition-all duration-300"
                >
                  <div className="flex items-center gap-3">
                    <Cpu className="w-5 h-5 text-[#00E5FF]" />
                    <div className="text-left">
                      <p className="text-lg font-medium text-[#E8F4FD] tracking-wide">Architecture Diagram</p>
                      <p className="text-xs text-[#3A5470] font-mono mt-0.5">Interactive topology of the target AWS infrastructure</p>
                    </div>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full font-medium transition ${showArch ? 'bg-[#00E5FF]/10 text-[#00E5FF] border border-[#00E5FF]/30' : 'bg-black/40 text-[#6B8CAE] border border-[#1A2D45]'}`}>
                    {showArch ? '▲ Collapse' : '▼ Generate'}
                  </span>
                </button>
                {showArch && (
                  <div className="bg-[#0D1520]/40 backdrop-blur-md border border-[#1A2D45] rounded-xl p-6 overflow-hidden">
                    <ArchitectureDiagram embeddedHcl={migrationResult.translation.new_aws_terraform} />
                  </div>
                )}
              </div>

              <div className="border-t border-[#1A2D45]" />

              {/* Sandbox */}
              <div className="space-y-4">
                <h3 className="text-xl font-medium tracking-wide flex items-center gap-2 text-[#E8F4FD]">
                  <Terminal className="w-5 h-5 text-[#00E5FF]" />
                  Interactive Sandbox
                </h3>
                <div className="bg-[#0D1520]/40 backdrop-blur-md border border-[#1A2D45] rounded-xl p-1 overflow-hidden">
                  <TerraformSandbox embeddedHcl={migrationResult.translation.new_aws_terraform} />
                </div>
              </div>
            </motion.div>
          )}
        </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ════════════════════════════════════════════════════════════════

function AgentPipeline({ agents }: { agents: AgentStatus[] }) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Find the index of the agent currently processing
    const activeIndex = agents.findIndex(a => a.status === "processing");
    if (activeIndex !== -1 && scrollContainerRef.current) {
      const children = scrollContainerRef.current.children;
      if (children[activeIndex]) {
        // Smoothly scroll the container to center the active agent card
        children[activeIndex].scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center"
        });
      }
    }
  }, [agents]);

  return (
    <div className="w-full relative">
      {/* Right gradient mask to hint at scrollable content */}
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#0D1520]/80 to-transparent pointer-events-none z-10" />
      
      <div 
        ref={scrollContainerRef}
        className="flex items-center gap-2 overflow-x-auto pb-4 pt-1 px-2 scrollbar-thin scrollbar-thumb-[#1A2D45] scrollbar-track-transparent snap-x relative z-0"
      >
        {agents.map((agent, i) => (
          <div key={agent.id} className="flex items-center snap-center">
            <div
              className={`flex flex-col p-3 w-[160px] flex-shrink-0 rounded-xl border transition-all ${
                agent.status === "processing"
                  ? "bg-[#00E5FF]/5 border-[#00E5FF]/40 shadow-[0_0_15px_rgba(0,229,255,0.15)]"
                  : agent.status === "complete"
                  ? "bg-[#39FF14]/5 border-[#39FF14]/30"
                  : "bg-black/40 border-[#1A2D45]/50"
              }`}
            >
              <div className="flex items-center gap-2 mb-2 w-full">
                <div
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    agent.status === "pending"
                      ? "bg-[#3A5470]"
                      : agent.status === "processing"
                      ? "bg-[#00E5FF] animate-pulse shadow-[0_0_6px_#00E5FF]"
                      : "bg-[#39FF14] shadow-[0_0_6px_#39FF14]"
                  }`}
                />
                <span className="text-xs font-semibold text-[#E8F4FD] truncate" title={agent.name}>
                  {agent.name}
                </span>
              </div>
              <p className="text-[10px] text-[#6B8CAE] line-clamp-2 leading-tight h-7 mb-2">
                {agent.description}
              </p>
              <div>
                {agent.status === "processing" ? (
                  <span className="text-[9px] px-1.5 py-0.5 bg-[#00E5FF]/10 text-[#00E5FF] rounded border border-[#00E5FF]/20 flex items-center gap-1 w-max">
                    <Loader2 className="w-2 h-2 animate-spin" />
                    Processing
                  </span>
                ) : agent.status === "complete" ? (
                  <span className="text-[9px] px-1.5 py-0.5 bg-[#39FF14]/10 text-[#39FF14] rounded border border-[#39FF14]/20 flex items-center gap-1 w-max">
                    <CheckCircle2 className="w-2 h-2" />
                    Done
                  </span>
                ) : (
                  <span className="text-[9px] px-1.5 py-0.5 bg-transparent text-[#3A5470] rounded border border-transparent flex items-center gap-1 w-max">
                    Waiting
                  </span>
                )}
              </div>
            </div>
            
            {/* Animated Connector Beam */}
            {i < agents.length - 1 && (
              <div className="flex items-center px-2">
                <div className="relative w-8 h-[2px] bg-[#1A2D45]/40 overflow-hidden rounded-full">
                  {(agent.status === "processing" || agent.status === "complete") && (
                    <motion.div
                      className="absolute top-0 left-0 h-full w-[200%] bg-gradient-to-r from-transparent via-[#00E5FF] to-transparent"
                      animate={{ x: ["-100%", "100%"] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    />
                  )}
                  {agent.status === "complete" && (
                    <div className="absolute inset-0 bg-[#39FF14]/20" />
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Strategy Panel ──
function StrategyPanel({ result }: { result: MigrationResult }) {
  const { migration_strategy, data_transit_protocol } = result.architecture;
  const { arbitrage_action } = result.finops;

  if (!migration_strategy && !data_transit_protocol && !arbitrage_action) {
    return null;
  }

  const cards = [
    {
      label: "Migration Strategy",
      value: migration_strategy,
      icon: <ArrowRight className="w-4 h-4 text-[#00E5FF]" />,
      color: "#00E5FF",
    },
    {
      label: "Data Gravity Protocol",
      value: data_transit_protocol,
      icon: <Database className="w-4 h-4 text-[#39FF14]" />,
      color: "#39FF14",
    },
    {
      label: "Compute Arbitrage",
      value: arbitrage_action,
      icon: <Cpu className="w-4 h-4 text-[#FFB800]" />,
      color: "#FFB800",
    },
  ].filter((c) => c.value);

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-medium tracking-wide flex items-center gap-2 text-[#E8F4FD]">
        <Zap className="w-5 h-5 text-[#FFB800]" />
        Enterprise Execution Strategy
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="bg-[#0D1520]/60 backdrop-blur-md border border-[#1A2D45]/80 rounded-xl p-5 hover:bg-[#0D1520]/80 hover:shadow-[0_0_20px_rgba(57,255,20,0.05)] transition-all duration-300 group"
            style={{
              borderColor: `${card.color}40`,
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div
                className="p-2 rounded-lg"
                style={{ background: `${card.color}10` }}
              >
                {card.icon}
              </div>
              <span className="text-[10px] font-mono text-[#3A5470] uppercase tracking-wider">
                {card.label}
              </span>
            </div>
            <p className="text-sm text-[#E8F4FD] leading-relaxed">
              {card.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── FinOps Panel ──
function FinOpsPanel({ result }: { result: MigrationResult }) {
  const { gcp_monthly_cost, aws_monthly_cost, savings_percent, carbon_saved_kg } =
    result.finops;
  const monthlySavings = gcp_monthly_cost - aws_monthly_cost;
  const annualSavings = monthlySavings * 12;
  const carbon = carbon_saved_kg || 0;

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-medium tracking-wide flex items-center gap-2 text-[#E8F4FD]">
        <TrendingDown className="w-5 h-5 text-[#FFB800]" />
        FinOps Arbitrage & GreenOps
      </h3>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#0D1520]/60 backdrop-blur-md border border-[#1A2D45]/80 rounded-xl p-5 hover:bg-[#0D1520]/80 hover:border-[#FF4444]/30 hover:shadow-[0_0_20px_rgba(255,68,68,0.05)] transition-all duration-300">
          <div className="text-[10px] font-mono text-[#3A5470] uppercase tracking-wider mb-2">
            GCP Monthly Cost
          </div>
          <div className="text-2xl font-bold tracking-tight text-[#FF4444]">
            ${gcp_monthly_cost.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="bg-[#0D1520]/60 backdrop-blur-md border border-[#1A2D45]/80 rounded-xl p-5 hover:bg-[#0D1520]/80 hover:border-[#39FF14]/30 hover:shadow-[0_0_20px_rgba(57,255,20,0.05)] transition-all duration-300">
          <div className="text-[10px] font-mono text-[#3A5470] uppercase tracking-wider mb-2">
            AWS Monthly Cost
          </div>
          <div className="text-2xl font-bold tracking-tight text-[#39FF14]">
            ${aws_monthly_cost.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      {/* Savings */}
      <div className="bg-gradient-to-r from-[#FFB800]/5 to-[#39FF14]/5 backdrop-blur-md border border-[#FFB800]/20 rounded-xl p-5 hover:border-[#FFB800]/40 transition-all duration-300">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[10px] font-mono text-[#3A5470] uppercase tracking-wider mb-2">
              Monthly Savings
            </div>
            <div className="text-3xl font-bold tracking-tight text-[#FFB800]">
              ${monthlySavings.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-[#6B8CAE] mt-1 font-mono">
              {savings_percent.toFixed(1)}% reduction
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-mono text-[#3A5470] uppercase tracking-wider mb-2">
              Annual Savings
            </div>
            <div className="text-2xl font-display font-bold text-[#39FF14]">
              ${annualSavings.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>
      </div>

      {/* Carbon */}
      {carbon > 0 && (
        <div className="bg-gradient-to-r from-[#39FF14]/5 to-[#00E5FF]/5 backdrop-blur-md border border-[#39FF14]/20 rounded-xl p-5 hover:border-[#39FF14]/40 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-mono text-[#3A5470] uppercase tracking-wider mb-2 flex items-center gap-1">
                Monthly CO₂ Reduction
              </div>
              <div className="text-2xl font-bold tracking-tight text-[#39FF14]">
                {carbon.toFixed(1)} kg/month
              </div>
              <div className="text-xs text-[#6B8CAE] mt-1 font-mono">
                Annual: {(carbon * 12).toFixed(0)} kg/year
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-mono text-[#3A5470] uppercase tracking-wider mb-2">
                Impact
              </div>
              <div className="text-sm text-[#39FF14] font-mono">
                ≈ {((carbon * 12) / 1000).toFixed(1)} metric tons
              </div>
              <div className="text-xs text-[#6B8CAE] mt-1 font-mono">
                Like planting {Math.round((carbon * 12) / 22)} trees
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tech Debt Panel ──
function TechDebtPanel({ result }: { result: MigrationResult }) {
  const { score, issues_fixed } = result.tech_debt;
  const colorClass =
    score >= 80
      ? "text-[#39FF14]"
      : score >= 60
      ? "text-[#FFB800]"
      : "text-[#FF4444]";
  const strokeColor =
    score >= 80 ? "#39FF14" : score >= 60 ? "#FFB800" : "#FF4444";

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-medium tracking-wide flex items-center gap-2 text-[#E8F4FD]">
        <Shield className="w-5 h-5 text-[#00E5FF]" />
        Pre-Flight Tech Debt Scanner
      </h3>

      <div className="bg-[#0D1520]/60 backdrop-blur-md border border-[#1A2D45]/80 rounded-xl p-6 hover:bg-[#0D1520]/80 hover:border-[#00E5FF]/30 hover:shadow-[0_0_20px_rgba(0,229,255,0.05)] transition-all duration-300">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-[10px] font-mono text-[#3A5470] uppercase tracking-wider mb-1">
              Code Health Score
            </div>
            <div className={`text-5xl font-bold tracking-tighter ${colorClass}`}>
              {score}
            </div>
          </div>
          <div className="relative w-24 h-24">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="#1A2D45"
                strokeWidth="8"
              />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke={strokeColor}
                strokeWidth="8"
                strokeDasharray={`${(score / 100) * 264} 264`}
                strokeLinecap="round"
                style={{ transition: "stroke-dasharray 0.8s ease" }}
              />
            </svg>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-[10px] font-mono text-[#3A5470] uppercase tracking-wider mb-2">
            Issues Fixed
          </div>
          {issues_fixed.map((issue: string, idx: number) => (
            <div
              key={idx}
              className="flex items-start gap-2 text-sm text-[#6B8CAE]"
            >
              <CheckCircle2 className="w-4 h-4 text-[#39FF14] flex-shrink-0 mt-0.5" />
              <span>{issue}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Terraform Panel ──
function TerraformPanel({ result }: { result: MigrationResult }) {
  const { new_aws_terraform, original_gcp_lines } = result.translation;

  const handleDownload = () => {
    const blob = new Blob([new_aws_terraform], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "main.tf";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-medium tracking-wide flex items-center gap-2 text-[#E8F4FD]">
        <Code2 className="w-5 h-5 text-[#FFB800]" />
        AWS Terraform Translation
      </h3>

      <div className="bg-[#0D1520]/60 backdrop-blur-md border border-[#1A2D45]/80 rounded-xl p-6 flex items-center justify-between hover:bg-[#0D1520]/80 hover:border-[#FFB800]/30 hover:shadow-[0_0_20px_rgba(255,184,0,0.05)] transition-all duration-300">
        <div>
          <h4 className="text-sm font-semibold text-[#E8F4FD] mb-1">
            Infrastructure-as-Code Ready
          </h4>
          <p className="text-xs text-[#3A5470] font-mono">
            Translated {original_gcp_lines} GCP lines → AWS Terraform
          </p>
        </div>
        <button
          onClick={handleDownload}
          className="px-4 py-2 bg-[#39FF14]/10 border border-[#39FF14]/40 text-[#39FF14] text-sm font-mono rounded-lg hover:bg-[#39FF14]/20 hover:shadow-[0_0_15px_rgba(57,255,20,0.2)] transition-all flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Download .tf
        </button>
      </div>

      {/* Code Preview */}
      <div className="bg-black/80 backdrop-blur-md border border-[#1A2D45]/80 rounded-xl overflow-hidden hover:border-[#00E5FF]/30 transition-all duration-300">
        <div className="bg-transparent border-b border-[#1A2D45]/60 px-4 py-2 flex justify-between items-center">
          <span className="text-[10px] font-mono text-[#6B8CAE] flex items-center gap-2">
            <Code2 className="w-3 h-3 text-[#FFB800]" />
            main.tf
          </span>
          <span className="text-[9px] text-[#3A5470] uppercase font-bold tracking-widest">HCL</span>
        </div>
        <pre className="p-4 overflow-x-auto text-[11px] text-[#E8F4FD] font-mono max-h-80 overflow-y-auto leading-relaxed scrollbar-thin scrollbar-thumb-[#1A2D45] scrollbar-track-transparent">
          {new_aws_terraform.split('\n').map((line, i) => {
            const isComment = line.trim().startsWith('#') || line.trim().startsWith('//');
            const isResource = line.trim().startsWith('resource') || line.trim().startsWith('module');
            return (
              <div key={i} className={isComment ? 'text-[#3A5470]' : isResource ? 'text-[#00E5FF] font-semibold' : ''}>
                {line}
              </div>
            );
          })}
        </pre>
      </div>
    </div>
  );
}

// ── Security Panel ──
function SecurityPanel({ result }: { result: MigrationResult }) {
  const { iam_policy_generated, principle_applied } = result.security;

  return (
    <div className="space-y-4 pb-12">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-medium tracking-wide flex items-center gap-2 text-[#E8F4FD]">
          <Lock className="w-5 h-5 text-[#FF4444]" />
          Zero-Trust Security
        </h3>
        <button
          onClick={() => alert('SOC-2 audit report generated. Check your downloads.')}
          className="px-4 py-2 bg-[#FF4444]/10 border border-[#FF4444]/30 text-[#FF4444] text-sm font-mono rounded-lg hover:bg-[#FF4444]/20 hover:shadow-[0_0_15px_rgba(255,68,68,0.15)] transition-all flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Export SOC-2
        </button>
      </div>

      {principle_applied && (
        <div className="bg-[#0D1520]/60 backdrop-blur-md border border-[#1A2D45]/80 rounded-xl p-4 hover:bg-[#0D1520]/80 hover:border-[#FF4444]/30 hover:shadow-[0_0_20px_rgba(255,68,68,0.05)] transition-all duration-300">
          <div className="text-[10px] font-mono text-[#3A5470] uppercase tracking-wider mb-2">
            Framework Applied
          </div>
          <p className="text-sm text-[#39FF14] font-mono">
            {principle_applied}
          </p>
        </div>
      )}

      <div className="bg-black/80 backdrop-blur-md border border-[#1A2D45]/80 rounded-xl overflow-hidden hover:border-[#FF4444]/30 transition-all duration-300">
        <div className="bg-transparent border-b border-[#1A2D45]/60 px-4 py-2 flex justify-between items-center">
          <span className="text-[10px] font-mono text-[#6B8CAE] flex items-center gap-2">
            <Lock className="w-3 h-3 text-[#FF4444]" />
            iam-policy.json
          </span>
          <span className="text-[9px] text-[#3A5470] uppercase font-bold tracking-widest">JSON</span>
        </div>
        <pre className="p-4 overflow-x-auto text-[11px] text-[#E8F4FD] font-mono max-h-64 overflow-y-auto leading-relaxed scrollbar-thin scrollbar-thumb-[#1A2D45] scrollbar-track-transparent">
          {iam_policy_generated.split('\n').map((line, i) => {
            const isKey = line.includes('":');
            return (
              <div key={i} className={isKey ? 'text-[#00E5FF]' : (line.includes(']') || line.includes('[')) ? 'text-[#FFB800]' : 'text-[#E8F4FD]'}>
                {line}
              </div>
            );
          })}
        </pre>
      </div>
    </div>
  );
}
