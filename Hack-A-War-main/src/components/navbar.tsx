"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";
import { GithubPRButton } from "./github-pr-button";
import TrueFocus from "./ui/TrueFocus";
import Link from "next/link";

const navLinks = [
  { href: "#problem", label: "Problem" },
  { href: "#pipeline", label: "Pipeline" },
  { href: "#demo", label: "Demo" },
  { href: "#tracks", label: "Tracks" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setScrolled(currentScrollY > 20);
      
      if (currentScrollY > lastScrollY.current && currentScrollY > 80) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
      lastScrollY.current = currentScrollY;
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleNavClick = (href: string) => {
    if (pathname === '/') {
      const el = document.querySelector(href);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      router.push(`/${href}`);
    }
  };

  const handleSmoothScroll = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    setMobileOpen(false);
    handleNavClick(href);
  };

  return (
    <>
      <motion.nav
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: isVisible ? 0 : -100, opacity: isVisible ? 1 : 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className={cn(
          "fixed top-0 w-full z-50 transition-all duration-500",
          scrolled
            ? "py-3"
            : "py-5"
        )}
      >
        <div className={cn(
          "max-w-7xl mx-auto px-6 flex items-center justify-between rounded-2xl transition-all duration-500",
          scrolled
            ? "bg-black/40 backdrop-blur-2xl border border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)] mx-6 px-6 py-3"
            : "bg-transparent py-0"
        )}>
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="relative flex items-center justify-center w-16 h-10 group-hover:scale-105 transition-all duration-500 group-hover:brightness-125">
              <svg xmlns="http://www.w3.org/2000/svg" width="72" height="44" viewBox="0 0 70 50" fill="none">
                {/* === LEFT SWOOSH — blue + green interleaved === */}
                <path d="M 2,45 Q -4,18 32,3"      stroke="#0B3D8B" strokeWidth="0.9"  fill="none"/>
                <path d="M 3,45 Q -3,18.5 32,3"    stroke="#00854A" strokeWidth="0.75" fill="none"/>
                <path d="M 4,45 Q -2,19 32,3"      stroke="#0F52B8" strokeWidth="0.85" fill="none"/>
                <path d="M 5.25,45 Q -1,20 32,3"   stroke="#00A85E" strokeWidth="0.75" fill="none"/>
                <path d="M 6.5,45 Q 0,21 32,3"     stroke="#1468D4" strokeWidth="0.85" fill="none"/>
                <path d="M 7.75,45 Q 1.25,22 32,3" stroke="#00C070" strokeWidth="0.75" fill="none"/>
                <path d="M 9,45 Q 2.5,23 32,3"     stroke="#1882E8" strokeWidth="0.80" fill="none"/>
                <path d="M 10.25,45 Q 3.75,24 32,3" stroke="#10D880" strokeWidth="0.75" fill="none"/>
                <path d="M 11.5,45 Q 5,25 32,3"    stroke="#1E9EF5" strokeWidth="0.80" fill="none"/>
                <path d="M 12.75,45 Q 6.5,26 32,3" stroke="#20E890" strokeWidth="0.75" fill="none"/>
                <path d="M 14,45 Q 8,27 32,3"      stroke="#2AB8FF" strokeWidth="0.75" fill="none"/>
                <path d="M 15.25,45 Q 10,28.5 32,3" stroke="#2EF4A0" strokeWidth="0.75" fill="none"/>
                <path d="M 16.5,45 Q 12,30 32,3"   stroke="#42CBFF" strokeWidth="0.75" fill="none"/>
                <path d="M 18,45 Q 14.25,31.5 32,3" stroke="#39FF14" strokeWidth="0.75" fill="none"/>
                <path d="M 19.5,45 Q 16.5,33 32,3"  stroke="#72DFFF" strokeWidth="0.70" fill="none"/>

                {/* === MAIN PEAK — right face — blue + green interleaved === */}
                <line x1="32" y1="3" x2="44"    y2="45" stroke="#0B3D8B" strokeWidth="0.90"/>
                <line x1="32" y1="3" x2="45.25" y2="45" stroke="#00854A" strokeWidth="0.75"/>
                <line x1="32" y1="3" x2="46.5"  y2="45" stroke="#0F52B8" strokeWidth="0.85"/>
                <line x1="32" y1="3" x2="47.75" y2="45" stroke="#00A85E" strokeWidth="0.75"/>
                <line x1="32" y1="3" x2="49"    y2="45" stroke="#1468D4" strokeWidth="0.85"/>
                <line x1="32" y1="3" x2="50"    y2="45" stroke="#00C070" strokeWidth="0.75"/>
                <line x1="32" y1="3" x2="51"    y2="45" stroke="#1882E8" strokeWidth="0.80"/>
                <line x1="32" y1="3" x2="52"    y2="45" stroke="#10D880" strokeWidth="0.75"/>
                <line x1="32" y1="3" x2="53"    y2="45" stroke="#1E9EF5" strokeWidth="0.80"/>
                <line x1="32" y1="3" x2="54"    y2="45" stroke="#20E890" strokeWidth="0.75"/>
                <line x1="32" y1="3" x2="55"    y2="45" stroke="#2AB8FF" strokeWidth="0.75"/>
                <line x1="32" y1="3" x2="56"    y2="45" stroke="#2EF4A0" strokeWidth="0.75"/>
                <line x1="32" y1="3" x2="57"    y2="45" stroke="#42CBFF" strokeWidth="0.75"/>
                <line x1="32" y1="3" x2="58"    y2="45" stroke="#39FF14" strokeWidth="0.75"/>
                <line x1="32" y1="3" x2="59"    y2="45" stroke="#72DFFF" strokeWidth="0.70"/>

                {/* === SECONDARY PEAK — left face — blue + green interleaved === */}
                <line x1="40"    y1="45" x2="52" y2="17" stroke="#0B3D8B" strokeWidth="0.85"/>
                <line x1="41.25" y1="45" x2="52" y2="17" stroke="#00A85E" strokeWidth="0.72"/>
                <line x1="42.5"  y1="45" x2="52" y2="17" stroke="#0F52B8" strokeWidth="0.80"/>
                <line x1="43.75" y1="45" x2="52" y2="17" stroke="#00C070" strokeWidth="0.72"/>
                <line x1="45"    y1="45" x2="52" y2="17" stroke="#1468D4" strokeWidth="0.80"/>
                <line x1="46"    y1="45" x2="52" y2="17" stroke="#10D880" strokeWidth="0.72"/>
                <line x1="47"    y1="45" x2="52" y2="17" stroke="#1882E8" strokeWidth="0.75"/>
                <line x1="48"    y1="45" x2="52" y2="17" stroke="#20E890" strokeWidth="0.72"/>
                <line x1="49"    y1="45" x2="52" y2="17" stroke="#1E9EF5" strokeWidth="0.75"/>
                <line x1="50"    y1="45" x2="52" y2="17" stroke="#39FF14" strokeWidth="0.72"/>
                <line x1="51"    y1="45" x2="52" y2="17" stroke="#2AB8FF" strokeWidth="0.70"/>

                {/* === SECONDARY PEAK — right face — blue + green interleaved === */}
                <line x1="52" y1="17" x2="55"    y2="45" stroke="#0B3D8B" strokeWidth="0.85"/>
                <line x1="52" y1="17" x2="56.25" y2="45" stroke="#00A85E" strokeWidth="0.72"/>
                <line x1="52" y1="17" x2="57.5"  y2="45" stroke="#0F52B8" strokeWidth="0.80"/>
                <line x1="52" y1="17" x2="58.75" y2="45" stroke="#00C070" strokeWidth="0.72"/>
                <line x1="52" y1="17" x2="60"    y2="45" stroke="#1468D4" strokeWidth="0.80"/>
                <line x1="52" y1="17" x2="61"    y2="45" stroke="#10D880" strokeWidth="0.72"/>
                <line x1="52" y1="17" x2="62"    y2="45" stroke="#1882E8" strokeWidth="0.75"/>
                <line x1="52" y1="17" x2="63"    y2="45" stroke="#39FF14" strokeWidth="0.72"/>
                <line x1="52" y1="17" x2="64"    y2="45" stroke="#1E9EF5" strokeWidth="0.75"/>
                <line x1="52" y1="17" x2="65"    y2="45" stroke="#2EF4A0" strokeWidth="0.72"/>
                <line x1="52" y1="17" x2="66"    y2="45" stroke="#2AB8FF" strokeWidth="0.70"/>

                {/* === BASE LINE === */}
                <line x1="2" y1="45" x2="67" y2="45" stroke="#2AB8FF" strokeWidth="0.6" opacity="0.35"/>
              </svg>
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-bold text-xl tracking-[0.25em] text-white" style={{ fontFamily: 'var(--font-display)' }}>
                AEGIS
              </span>
              <span className="text-[9px] tracking-[0.15em] text-[#2AB8FF]/70 font-medium uppercase mt-0.5">
                Migration Factory
              </span>
            </div>
          </Link>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center space-x-4 cursor-pointer">
            <TrueFocus 
              sentence={navLinks.map(l => l.label).join(' ')} 
              manualMode={true} 
              blurAmount={0} 
              borderColor="#39FF14" 
              glowColor="rgba(57, 255, 20, 0.4)" 
              animationDuration={0.3}
              gap="5rem"
              onWordClick={(word: string) => {
                const link = navLinks.find(l => l.label === word.trim());
                if (link) {
                  handleNavClick(link.href);
                }
              }} 
            />
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <GithubPRButton />

            <Link
              href="/dashboard"
              className="relative px-5 py-2 rounded-xl text-sm font-bold text-[#00E5FF] overflow-hidden group transition-all duration-300 border border-[#00E5FF]/30 bg-[#00E5FF]/5 hover:bg-[#00E5FF]/15 hover:border-[#00E5FF]/60 hover:shadow-[0_0_20px_rgba(0,229,255,0.15)] backdrop-blur-sm"
            >
              <span className="relative z-10 flex items-center gap-2">
                Dashboard
                <span className="opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-300">→</span>
              </span>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r from-[#00E5FF]/5 via-[#00E5FF]/10 to-[#00E5FF]/5" />
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden text-white/70 hover:text-white transition-colors p-2"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </motion.nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-40 bg-black/90 backdrop-blur-2xl flex flex-col items-center justify-center gap-6 md:hidden"
          >
            {navLinks.map((link, i) => (
              <motion.a
                key={link.href}
                href={link.href}
                onClick={(e) => handleSmoothScroll(e, link.href)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 + 0.1 }}
                className="text-2xl font-medium text-white/70 hover:text-[#39FF14] transition-colors"
              >
                {link.label}
              </motion.a>
            ))}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: navLinks.length * 0.05 + 0.1 }}
            >
              <Link
                href="/dashboard"
                onClick={() => setMobileOpen(false)}
                className="text-2xl font-bold text-[#00E5FF] hover:text-[#00E5FF]/80 transition-colors"
              >
                Dashboard
              </Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
