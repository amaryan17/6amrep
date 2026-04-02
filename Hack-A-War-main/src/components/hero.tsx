'use client';
import React, { useState, useEffect, useRef, memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { WebGLShader } from './ui/web-gl-shader';
import { LiquidButton } from './ui/liquid-glass-button';
import VariableProximity from './ui/variable-proximity';
import { useRouter } from 'next/navigation';
import { aegisAPI } from '@/lib/api';
import { Loader2 } from 'lucide-react';

const terminalLines = [
  { text: "$ aegis-factory run --source=./gcp-portfolio --target=aws", color: "#39FF14" },
  { text: "[AEGIS] Initializing migration pipeline v2.4.1...", color: "#39FF14" },
  { text: "[AEGIS] Connecting to Amazon Bedrock (Claude 3.5 Sonnet)... ✓", color: "#39FF14" },
  { text: "[TECH-DEBT] Ingesting legacy GCP portfolio...", color: "#FFB800" },
  { text: "[TECH-DEBT] Scanning 847 files across 12 services...", color: "#FFB800" },
  { text: "[TECH-DEBT] Found 23 critical architectural issues", color: "#FFB800" },
  { text: "[TECH-DEBT] Pre-flight health score: 34/100 → auto-cleaning...", color: "#FFB800" },
  { text: "[MIGRATION] google_compute_engine → aws_instance ✓", color: "#39FF14" },
  { text: "[MIGRATION] google_pubsub_topic → aws_sqs_queue ✓", color: "#39FF14" },
  { text: "[MIGRATION] google_spanner → aws_aurora_serverless ✓", color: "#39FF14" },
  { text: "[MIGRATION] google_cloud_run → aws_lambda ✓", color: "#39FF14" },
  { text: "[ARCHITECT] Generating optimized AWS architecture...", color: "#FFB800" },
  { text: "[ARCHITECT] GCP cost: $12,400/mo → AWS: $4,190/mo", color: "#FFB800" },
  { text: "[ARCHITECT] Savings: $8,210/mo (66.2% reduction) ✓", color: "#FFB800" },
  { text: "[SECURITY] Scanning translated IAM policies...", color: "#FF4444" },
  { text: "[SECURITY] CRITICAL: 4x FullAdministratorAccess violations found", color: "#FF4444" },
  { text: "[SECURITY] Generating Zero-Trust least-privilege policies... ✓", color: "#FF4444" },
  { text: "[SECURITY] Attack surface reduction: 98.3% ✓", color: "#FF4444" },
  { text: "[AUDIT] Mapping evidence to SOC-2 framework...", color: "#39FF14" },
  { text: "[AUDIT] CC6.1 Logical Access: PASS ✓", color: "#39FF14" },
  { text: "[AUDIT] CC7.2 Vulnerability Mgmt: PASS ✓", color: "#39FF14" },
  { text: "[AUDIT] CC8.1 Encryption at Rest: PASS ✓", color: "#39FF14" },
  { text: "[AUDIT] Signed compliance PDF generated ✓", color: "#39FF14" },
  { text: "[AEGIS] ─────────────────────────────────", color: "#39FF14" },
  { text: "[AEGIS] Migration complete in 00:00:47", color: "#39FF14" },
  { text: "[AEGIS] Human interventions required: 0", color: "#39FF14" },
  { text: "[AEGIS] ─────────────────────────────────", color: "#39FF14" }
];

// Memoized line to avoid re-parsing on every tick
const FormattedText = memo(function FormattedText({ text, baseColor }: { text: string; baseColor: string }) {
  const parts = text.split(/(✓|CRITICAL|ERROR|violations|\$[\d,]+(?:\/mo)?|\d+(?:\.\d+)?%)/g);
  return (
    <span style={{ color: baseColor }}>
      {parts.map((part, i) => {
        if (!part) return null;
        if (part === '✓') return <span key={i} style={{ color: '#39FF14' }}>{part}</span>;
        if (['CRITICAL', 'ERROR', 'violations'].includes(part)) return <span key={i} style={{ color: '#FF4444' }}>{part}</span>;
        if (part.startsWith('$') || part.endsWith('%')) return <span key={i} style={{ color: '#FFB800' }}>{part}</span>;
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
});

// Completed line — never re-renders once created
const CompletedLine = memo(function CompletedLine({ index, text, color }: { index: number; text: string; color: string }) {
  return (
    <div className="terminal-line">
      <span className="line-number">{index + 1}</span>
      <FormattedText text={text} baseColor={color} />
    </div>
  );
});

// ─── ISOLATED TERMINAL ───
// All typewriter state lives here — parent never re-renders
const TerminalTypewriter = memo(function TerminalTypewriter() {
  const [lineIndex, setLineIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (lineIndex >= terminalLines.length) {
      const t = setTimeout(() => { setLineIndex(0); setCharIndex(0); }, 3000);
      return () => clearTimeout(t);
    }
    const line = terminalLines[lineIndex];
    if (charIndex < line.text.length) {
      const t = setTimeout(() => setCharIndex(c => c + 1), 25);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => { setLineIndex(l => l + 1); setCharIndex(0); }, 280);
      return () => clearTimeout(t);
    }
  }, [lineIndex, charIndex]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [charIndex, lineIndex]);

  return (
    <div className="terminal-wrapper">
      <div className="terminal-chrome">
        <div className="terminal-dots">
          <div className="t-dot red" />
          <div className="t-dot yellow" />
          <div className="t-dot green" />
        </div>
        <div className="terminal-title">aegis-factory — pipeline</div>
        <div className="terminal-tabs">
          <div className="terminal-tab active">output</div>
          <div className="terminal-tab">logs</div>
          <div className="terminal-tab">metrics</div>
        </div>
      </div>

      <div className="terminal-body" ref={bodyRef}>
        {terminalLines.slice(0, lineIndex).map((line, i) => (
          <CompletedLine key={i} index={i} text={line.text} color={line.color} />
        ))}

        {lineIndex < terminalLines.length && (
          <div className="terminal-line">
            <span className="line-number">{lineIndex + 1}</span>
            <FormattedText
              text={terminalLines[lineIndex].text.slice(0, charIndex)}
              baseColor={terminalLines[lineIndex].color}
            />
            <span className="cursor-blink" />
          </div>
        )}
        {lineIndex >= terminalLines.length && (
          <div className="terminal-line">
            <span className="line-number">{terminalLines.length + 1}</span>
            <span className="cursor-blink" />
          </div>
        )}
      </div>

      <div className="terminal-status-bar">
        <div className="status-item">
          <span className="status-dot" />
          CONNECTED
        </div>
        <div className="status-item">zsh</div>
        <div className="status-item" style={{ marginLeft: 'auto' }}>
          {lineIndex < terminalLines.length
            ? `Line ${lineIndex + 1}/${terminalLines.length}`
            : 'Complete'}
        </div>
        <div className="status-item">UTF-8</div>
      </div>
    </div>
  );
});

// removed HeroBackground

// ─── HERO STYLES ───
const heroCSS = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@100..900&family=JetBrains+Mono:wght@400;500&family=Space+Mono:wght@400;700&display=swap');
  .aegis-hero { --bg: transparent; }
  .hero-container {
    position: relative; min-height: 100vh; width: 100%;
    display: flex; align-items: center; padding: 80px;
    background-color: transparent; font-family: var(--font-ibm-plex);
    overflow: hidden; box-sizing: border-box;
  }
  .hero-content-wrapper {
    display: flex; width: 100%; max-width: 1400px;
    margin: 0 auto; gap: 60px; position: relative; z-index: 20;
  }
  .left-col { flex: 0 0 55%; display: flex; flex-direction: column; justify-content: center; }
  .right-col { flex: 1; display: flex; align-items: center; min-width: 400px; }
  .hero-badge {
    display: inline-flex; align-items: center;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
    color: #39FF14; padding: 6px 14px; border-radius: 100px;
    font-family: var(--font-mono); font-size: 12px;
    margin-bottom: 30px; width: fit-content; backdrop-filter: blur(12px);
  }
  .hero-title {
    font-family: var(--font-ibm-plex); font-weight: 700;
    font-size: clamp(40px, 5vw, 64px); line-height: 1.1;
    color: #E8F4FD; margin: 0 0 24px 0; position: relative;
  }
  .hero-title-cyan {
    color: #00E5FF;
    text-shadow: 0 0 40px rgba(0,229,255,0.4), 0 0 80px rgba(0,229,255,0.15);
    display: block; position: relative; width: fit-content;
  }
  .hero-subtitle {
    font-family: var(--font-source-serif); font-size: 15px; line-height: 1.8;
    color: rgba(255,255,255,0.45); max-width: 540px; margin: 0 0 40px 0;
    font-weight: 400; letter-spacing: 0.01em;
  }
  .btn-row { display: flex; gap: 16px; margin-bottom: 32px; }
  .stats-row { display: flex; flex-wrap: wrap; gap: 12px; }
  .stat-chip {
    display: flex; align-items: center; gap: 8px;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 100px; padding: 6px 14px;
    font-family: var(--font-ibm-plex); font-size: 13px;
    color: rgba(255,255,255,0.7); backdrop-filter: blur(12px);
  }
  .glowing-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: #39FF14; box-shadow: 0 0 6px #39FF14;
  }
  .terminal-wrapper {
    width: 100%; border-radius: 12px; display: flex; flex-direction: column;
    background: rgba(0, 0, 0, 0.45); backdrop-filter: blur(24px);
    border: 1px solid rgba(255,255,255,0.08);
    box-shadow: 0 0 0 1px rgba(255,255,255,0.05), 0 0 80px rgba(57,255,20,0.15),
      0 30px 100px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.05);
    overflow: hidden;
    position: relative;
  }
  .terminal-wrapper::before {
    content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%;
    background: radial-gradient(circle, rgba(57,255,20,0.1) 0%, transparent 60%);
    pointer-events: none; z-index: -1;
  }
  .terminal-chrome {
    height: 44px; background: rgba(255,255,255,0.03);
    border-bottom: 1px solid rgba(255,255,255,0.06);
    display: flex; align-items: center; padding: 0 16px; position: relative;
  }
  .terminal-dots { display: flex; gap: 8px; }
  .t-dot { width: 12px; height: 12px; border-radius: 50%; transition: all 0.2s ease; }
  .t-dot:hover { transform: scale(1.2); }
  .t-dot.red { background: #FF5F56; box-shadow: 0 0 6px rgba(255,95,86,0.3); }
  .t-dot.yellow { background: #FFBD2E; box-shadow: 0 0 6px rgba(255,189,46,0.3); }
  .t-dot.green { background: #27C93F; box-shadow: 0 0 6px rgba(39,201,63,0.3); }
  .terminal-title {
    position: absolute; left: 50%; transform: translateX(-50%);
    font-family: var(--font-mono); font-size: 12px;
    color: rgba(255,255,255,0.35); letter-spacing: 0.5px;
  }
  .terminal-tabs { display: flex; margin-left: auto; gap: 0; }
  .terminal-tab {
    padding: 4px 12px; font-family: var(--font-mono); font-size: 11px;
    color: rgba(255,255,255,0.3); border-bottom: 2px solid transparent;
    cursor: pointer; transition: all 0.2s ease;
  }
  .terminal-tab.active { color: #39FF14; border-bottom: 2px solid #39FF14; }
  .terminal-body {
    background: transparent; padding: 20px 24px; height: 440px;
    overflow-y: auto; font-family: 'JetBrains Mono', monospace;
    font-size: 12.5px; line-height: 1.75; color: #E8F4FD; position: relative;
  }
  .terminal-body::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 30px;
    background: linear-gradient(to bottom, rgba(0,0,0,0.4), transparent);
    pointer-events: none; z-index: 1;
  }
  .terminal-body::-webkit-scrollbar { width: 6px; }
  .terminal-body::-webkit-scrollbar-track { background: transparent; }
  .terminal-body::-webkit-scrollbar-thumb { background: rgba(57,255,20,0.2); border-radius: 3px; }
  .terminal-body::-webkit-scrollbar-thumb:hover { background: rgba(57,255,20,0.4); }
  .terminal-line { padding: 1px 0; transition: background 0.15s ease; }
  .terminal-line:hover { background: rgba(255,255,255,0.02); }
  .line-number {
    display: inline-block; width: 30px; text-align: right;
    margin-right: 16px; color: rgba(255,255,255,0.12);
    font-size: 11px; user-select: none;
  }
  .cursor-blink {
    display: inline-block; width: 8px; height: 15px;
    background: #39FF14; vertical-align: middle; margin-left: 2px;
    animation: blink 0.7s infinite steps(2, start);
    box-shadow: 0 0 8px rgba(57,255,20,0.5);
  }
  @keyframes blink { 0%, 100% { opacity: 0; } 50% { opacity: 1; } }
  .terminal-status-bar {
    height: 28px; background: rgba(255,255,255,0.02);
    border-top: 1px solid rgba(255,255,255,0.05);
    display: flex; align-items: center; padding: 0 16px; gap: 16px;
  }
  .status-item {
    font-family: 'JetBrains Mono', monospace; font-size: 10px;
    color: rgba(255,255,255,0.3); display: flex; align-items: center; gap: 4px;
  }
  .status-dot {
    width: 5px; height: 5px; border-radius: 50%;
    background: #27C93F; box-shadow: 0 0 4px rgba(39,201,63,0.5);
  }
  .scroll-indicator {
    position: absolute; bottom: 30px; left: 50%;
    transform: translateX(-50%); color: #39FF14; opacity: 0.5; z-index: 20;
  }
  @media (max-width: 992px) {
    .hero-container { padding: 100px 24px 60px 24px; }
    .hero-content-wrapper { flex-direction: column; gap: 40px; }
    .left-col { flex: 1; }
    .right-col { min-width: 100%; }
    .terminal-body { height: auto; max-height: 360px; }
  }
`;

// ─── MAIN HERO (static after mount — no typewriter state here) ───
export function Hero() {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleStartDemo = async () => {
    try {
      setIsStarting(true);
      const res = await aegisAPI.startDemo();
      router.push(`/pipeline/${res.job_id}`);
    } catch (err) {
      console.error("Failed to start demo:", err);
      setIsStarting(false);
      alert("Failed to connect to backend API. Please make sure port 8000 is open.");
    }
  };

  const containerVariants = useMemo(() => ({
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  }), []);

  const itemVariants = useMemo(() => ({
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } }
  }), []);

  return (
    <div className="aegis-hero hero-container" ref={heroRef}>
      <style dangerouslySetInnerHTML={{ __html: heroCSS }} />

      <motion.div
        className="hero-content-wrapper"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        <div className="left-col">
          <motion.div className="hero-title" variants={itemVariants}>
            <div className="mb-2 h-[1.1em]">
              {mounted ? (
                <VariableProximity
                  label="GCP to AWS."
                  fromFontVariationSettings="'wght' 300"
                  toFontVariationSettings="'wght' 700"
                  containerRef={heroRef}
                  radius={165}
                  falloff="gaussian"
                />
              ) : "GCP to AWS."}
            </div>
            <div className="mb-2 h-[1.1em]">
              {mounted ? (
                <VariableProximity
                  label="One Upload."
                  fromFontVariationSettings="'wght' 300"
                  toFontVariationSettings="'wght' 700"
                  containerRef={heroRef}
                  radius={165}
                  falloff="gaussian"
                />
              ) : "One Upload."}
            </div>
            <div className="hero-title-cyan min-h-[1.1em]">
              {mounted ? (
                <VariableProximity
                  label="Zero Humans."
                  fromFontVariationSettings="'wght' 300"
                  toFontVariationSettings="'wght' 700"
                  containerRef={heroRef}
                  radius={165}
                  falloff="gaussian"
                />
              ) : "Zero Humans."}
              <div
                style={{
                  height: '2px',
                  width: '100%',
                  background: 'linear-gradient(90deg, transparent, #39FF14, #00E5FF, #39FF14, transparent)',
                  backgroundSize: '200% 100%',
                  borderRadius: '2px',
                  marginTop: '6px',
                  animation: 'greenGlowPulse 4s ease-in-out infinite, glowSweep 7s linear infinite',
                  boxShadow: '0 0 6px #39FF14, 0 0 14px rgba(57,255,20,0.3)',
                }}
              />
              <style>{`
                @keyframes greenGlowPulse {
                  0%, 100% { box-shadow: 0 0 4px #39FF14, 0 0 10px rgba(57,255,20,0.2); }
                  50% { box-shadow: 0 0 10px #39FF14, 0 0 28px rgba(57,255,20,0.5), 0 0 48px rgba(57,255,20,0.2); }
                }
                @keyframes glowSweep {
                  0% { background-position: 200% 0; }
                  100% { background-position: -200% 0; }
                }
              `}</style>
            </div>
          </motion.div>

          <motion.p className="hero-subtitle" variants={itemVariants}>
            Aegis is a 5-agent autonomous AI pipeline that ingests your legacy GCP infrastructure, cleans technical debt, translates every service to AWS-native Terraform, enforces Zero-Trust IAM policies derived from your code&apos;s AST, and ships a cryptographically signed SOC-2 audit report — before your first coffee.
          </motion.p>

          <motion.div className="btn-row" variants={itemVariants}>
            <div onClick={handleStartDemo} className="cursor-pointer pointer-events-auto">
              <LiquidButton className="text-white border border-white/10 rounded-full" size={'xl'}>
                {isStarting ? <Loader2 size={18} className="animate-spin mr-2 inline" /> : null}
                {isStarting ? "Initializing..." : "Run Test Pipeline →"}
              </LiquidButton>
            </div>
            <LiquidButton className="text-white/70 border border-white/10 rounded-full" size={'xl'} variant={'outline'}>
              View Architecture
            </LiquidButton>
          </motion.div>
        </div>

        <motion.div
          className="right-col"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.7, ease: "easeOut" }}
        >
          <motion.div
            animate={{ y: [0, -12, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            style={{ width: '100%' }}
          >
            <TerminalTypewriter />
          </motion.div>
        </motion.div>
      </motion.div>

      <motion.div
        className="scroll-indicator"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 1.5, ease: "easeInOut", repeat: Infinity }}
      >
        <ChevronDown size={28} />
      </motion.div>
    </div>
  );
}

export default Hero;
