"use client";
import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { SlidingLogoMarquee, type SlidingLogoMarqueeItem } from "@/components/SlidingLogoMarquee";
import { ShaderGradientCanvas, ShaderGradient } from "@shadergradient/react";

/* ─────────────────────────────────────────────
   TYPES
───────────────────────────────────────────── */
type Theme = "dark" | "light";

/* ─────────────────────────────────────────────
   GLOBAL STYLES (injected once)
───────────────────────────────────────────── */
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Source+Code+Pro:wght@400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }

  body {
    font-family: 'Helvetica Neue', 'HelveticaNeue', Helvetica, Arial, sans-serif !important;
    -webkit-font-smoothing: antialiased;
    overflow-x: hidden;
  }

  /* Dark tokens */
  [data-theme="dark"] {
    --bg:      #0a0a0a;
    --bg2:     #111111;
    --bg3:     #1a1a1a;
    --bg4:     #222222;
    --border:  rgba(255,255,255,0.07);
    --border2: rgba(255,255,255,0.14);
    --text:    #f5f5f5;
    --text2:   rgba(245,245,245,0.52);
    --text3:   rgba(245,245,245,0.28);
    --card:    #111111;
    --nav-bg:  rgba(10,10,10,0.82);
    --shadow:  0 32px 80px rgba(0,0,0,0.7);
  }

  /* Light tokens */
  [data-theme="light"] {
    --bg:      #ffffff;
    --bg2:     #f8f8f8;
    --bg3:     #f0f0f0;
    --bg4:     #e5e5e5;
    --border:  rgba(0,0,0,0.07);
    --border2: rgba(0,0,0,0.14);
    --text:    #0a0a0a;
    --text2:   rgba(10,10,10,0.52);
    --text3:   rgba(10,10,10,0.32);
    --card:    #ffffff;
    --nav-bg:  rgba(255,255,255,0.88);
    --shadow:  0 32px 80px rgba(0,0,0,0.08);
  }

  /* Marquee keyframes */
  @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
  @keyframes blink   { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
  @keyframes spin    { to { transform: rotate(360deg); } }
  @keyframes fadeUp  {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes cursor-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

  .marquee-track { animation: marquee 32s linear infinite; }
  .marquee-section:hover .marquee-track { animation-play-state: paused; }
  .blink-cur { animation: blink 1s step-end infinite; }
  .spin { animation: spin 0.8s linear infinite; }
  .fade-up { animation: fadeUp 0.7s ease both; }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 3px; }

  /* FAQ transition */
  .faq-answer {
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.32s ease, padding 0.32s ease;
  }
  .faq-answer.open {
    max-height: 300px;
  }

  /* Code editor styles */
  .code-editor-textarea {
    caret-color: #fff;
    resize: none;
    outline: none;
    border: none;
    background: transparent;
    color: transparent;
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    width: 100%;
    height: 100%;
    padding: 20px 24px;
    font-family: 'Source Code Pro', 'Fira Code', 'Consolas', monospace;
    font-size: 13px;
    line-height: 1.75;
    letter-spacing: 0.01em;
    z-index: 2;
    white-space: pre;
    overflow: auto;
  }
  .code-highlight {
    position: absolute;
    top: 0; left: 0;
    width: 100%;
    padding: 20px 24px;
    font-family: 'Source Code Pro', 'Fira Code', 'Consolas', monospace;
    font-size: 13px;
    line-height: 1.75;
    letter-spacing: 0.01em;
    pointer-events: none;
    white-space: pre;
    z-index: 1;
  }
`;

function GlobalStyle() {
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = GLOBAL_CSS;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);
  return null;
}

/* ─────────────────────────────────────────────
   DESIGN TOKENS
───────────────────────────────────────────── */
const T = {
  font: "'Helvetica Neue', 'HelveticaNeue', Helvetica, Arial, sans-serif",
  mono: "'Source Code Pro', 'Fira Code', 'Consolas', monospace",
  pill: "9999px",
};

/* ─────────────────────────────────────────────
   SMALL REUSABLE COMPONENTS
───────────────────────────────────────────── */
function Divider({ style }: { style?: React.CSSProperties }) {
  return (
    <div style={{
      height: 1,
      background: "linear-gradient(to right, transparent, var(--border2), transparent)",
      opacity: 0.6,
      maxWidth: 560,
      margin: "0 auto",
      ...style,
    }} />
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      fontSize: 11, fontWeight: 600, letterSpacing: "0.1em",
      textTransform: "uppercase", color: "var(--text3)",
      marginBottom: 14, fontFamily: T.font,
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <h2 style={{
      fontSize: "clamp(28px, 3.6vw, 44px)",
      fontWeight: 300,
      letterSpacing: "-0.04em",
      lineHeight: 1.1,
      color: "var(--text)",
      marginBottom: 14,
      fontFamily: T.font,
      ...style,
    }}>
      {children}
    </h2>
  );
}

function SubText({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p style={{
      fontSize: 15.5, color: "var(--text2)", lineHeight: 1.68,
      maxWidth: 520, fontFamily: T.font, fontWeight: 400, ...style,
    }}>
      {children}
    </p>
  );
}

function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <li style={{
      display: "flex", alignItems: "flex-start", gap: 10,
      fontSize: 13, color: "var(--text2)", lineHeight: 1.45,
      fontFamily: T.font,
    }}>
      <span style={{
        width: 17, height: 17, borderRadius: "50%",
        border: "1px solid var(--border2)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, marginTop: 1,
      }}>
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="3">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
      {children}
    </li>
  );
}

/* ─────────────────────────────────────────────
   LOGO COMPONENT
───────────────────────────────────────────── */
function Logo({ theme, height = 28, fallbackId = "nav-logo-fb" }: { theme: Theme; height?: number; fallbackId?: string }) {
  // Use logo-light.png for light theme, image.png for dark theme
  const src = theme === "light" ? "/logo-light.png" : "/image.png";
  return (
    <img
      src={src}
      alt="Pipeline Labs"
      style={{ height, objectFit: "contain", display: "block" }}
      onError={(e) => {
        console.error("Logo failed to load:", src, e);
        (e.target as HTMLImageElement).style.display = "none";
        const fb = document.getElementById(fallbackId);
        if (fb) fb.style.display = "flex";
      }}
    />
  );
}

/* ─────────────────────────────────────────────
   SLEEK NAVBAR (matches image design)
───────────────────────────────────────────── */
function Nav({ theme, toggleTheme }: { theme: Theme; toggleTheme: () => void }) {
  const { user } = useAuth();
  const isSignedIn = !!user;
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Hero section is roughly 600px, navbar is 64px
      // Switch to solid bg when scrolled past hero
      setScrolled(window.scrollY > 500);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Check initial position
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navItems = [
    { label: "Product", href: "#product" },
    { label: "How it works", href: "#how-it-works" },
    { label: "Blog", href: "#blog" },
    { label: "Pricing", href: "#pricing" },
    { label: "Documentation", href: "https://pipeline.stldocs.app", external: true },
  ];

  return (
    <nav style={{
      position: "fixed",
      top: 0, left: 0, right: 0,
      height: 64,
      background: scrolled ? "var(--nav-bg, rgba(10,10,10,0.95))" : "transparent",
      backdropFilter: scrolled ? "blur(12px)" : "none",
      WebkitBackdropFilter: scrolled ? "blur(12px)" : "none",
      borderBottom: scrolled ? "1px solid var(--border)" : "1px solid transparent",
      zIndex: 100,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 24px",
      transition: "background 0.3s ease, backdrop-filter 0.3s ease, border-bottom 0.3s ease",
    }}>
      {/* Logo */}
      <Link to="/" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
        <Logo theme={theme} height={28} />
      </Link>

      {/* Center Nav Items */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 32,
        position: "absolute",
        left: "50%",
        transform: "translateX(-50%)",
      }}>
        {navItems.map((item) => (
          <a
            key={item.label}
            href={item.href}
            target={item.external ? "_blank" : undefined}
            rel={item.external ? "noopener noreferrer" : undefined}
            style={{
              fontSize: 14,
              fontWeight: 300,
              color: "var(--text2)",
              textDecoration: "none",
              transition: "color 0.15s",
              fontFamily: T.font,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text2)")}
          >
            {item.label}
          </a>
        ))}
      </div>

      {/* Right Side Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "1px solid var(--border2)",
            background: "transparent",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text2)",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--border2)";
            e.currentTarget.style.color = "var(--text)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.color = "var(--text2)";
          }}
        >
          {theme === "dark" ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          )}
        </button>

        {/* Contact Sales Button */}
        <a
          href="mailto:sales@pipelinelabs.ai"
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: "var(--text)",
            textDecoration: "none",
            padding: "11px 24px",
            borderRadius: T.pill,
            border: "1px solid var(--border2)",
            fontFamily: T.font,
            transition: "all 0.15s",
            background: "transparent",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--bg3)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          Contact sales
        </a>

        {/* Dashboard Button */}
        <Link
          to={isSignedIn ? "/dashboard" : "/auth"}
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: "var(--bg)",
            background: "var(--text)",
            textDecoration: "none",
            padding: "11px 24px",
            borderRadius: T.pill,
            fontFamily: T.font,
            transition: "opacity 0.15s",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            letterSpacing: "-0.01em",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = "0.9";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "1";
          }}
        >
          Dashboard
        </Link>
      </div>
    </nav>
  );
}

/* ─────────────────────────────────────────────
   HERO
───────────────────────────────────────────── */
function Hero() {
  const { user } = useAuth();
  const isSignedIn = !!user;
  return (
    <div style={{ paddingTop: 64, position: "relative" }}>
      {/* ShaderGradient Background - only in hero area */}
      <div style={{ 
        position: "absolute", 
        top: 0, 
        left: 0, 
        right: 0, 
        height: "600px", 
        zIndex: 0,
        overflow: "hidden"
      }}>
        <ShaderGradientCanvas
          style={{ position: "absolute", inset: 0 }}
          pixelDensity={0.7}
          fov={40}
        >
          <ShaderGradient
            animate="on"
            axesHelper="off"
            brightness={1.2}
            cAzimuthAngle={180}
            cDistance={3.39}
            cPolarAngle={90}
            cameraZoom={1}
            color1="#000000"
            color2="#343237"
            color3="#000000"
            destination="onCanvas"
            embedMode="off"
            envPreset="city"
            format="gif"
            frameRate={10}
            gizmoHelper="hide"
            grain="off"
            lightType="3d"
            positionX={-1.4}
            positionY={0}
            positionZ={0}
            range="enabled"
            rangeEnd={40}
            rangeStart={0}
            reflection={0.1}
            rotationX={0}
            rotationY={10}
            rotationZ={50}
            shader="defaults"
            type="plane"
            uAmplitude={1}
            uDensity={1.3}
            uFrequency={5.5}
            uSpeed={0.2}
            uStrength={1.8}
            uTime={0}
            wireframe={false}
          />
        </ShaderGradientCanvas>
        {/* Gradient overlay for smooth transition */}
        <div style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "200px",
          background: "linear-gradient(to bottom, transparent, var(--bg, #0a0a0a))",
          pointerEvents: "none"
        }} />
      </div>

      {/* Content - above shader */}
      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Text */}
        <div style={{ padding: "108px 44px 0", maxWidth: 1400 }}>
          <div style={{ marginBottom: 16 }}>
            <span style={{
              fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase",
              color: "var(--text3)", fontFamily: T.font,
            }}>
              Built for teams turning raw data into model-ready infrastructure.
            </span>
          </div>
          <h1 style={{
            fontSize: "clamp(36px, 4vw, 52px)",
            fontWeight: 300,
            letterSpacing: "-0.045em",
            lineHeight: 1.15,
            color: "var(--text)",
            maxWidth: 680,
            marginBottom: 18,
            fontFamily: T.font,
          }}>
            Redefine how machine learning teams<br />build with data.
          </h1>
          <p style={{
            fontSize: 16, color: "var(--text2)", lineHeight: 1.65,
            maxWidth: 520, fontFamily: T.font, fontWeight: 400, marginBottom: 32,
          }}>
            Transform raw operational data into validated, training-ready datasets with prompt-driven cleaning, schema-aware chunking, and reproducible ML workflows.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 60 }}>
            {isSignedIn ? (
              <Link to="/dashboard" style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "var(--text)", color: "var(--bg)",
                fontSize: 14, fontWeight: 500, letterSpacing: "-0.01em",
                borderRadius: T.pill, padding: "11px 24px",
                border: "none", cursor: "pointer", textDecoration: "none",
                fontFamily: T.font, transition: "opacity 0.15s",
              }}>Start building ↓</Link>
            ) : (
              <Link to="/auth" style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "var(--text)", color: "var(--bg)",
                fontSize: 14, fontWeight: 500, letterSpacing: "-0.01em",
                borderRadius: T.pill, padding: "11px 24px",
                border: "none", cursor: "pointer", textDecoration: "none",
                fontFamily: T.font, transition: "opacity 0.15s",
              }}>Start building ↓</Link>
            )}
            <a href="#how-it-works" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "transparent", color: "var(--text)",
              fontSize: 14, fontWeight: 500,
              borderRadius: T.pill, padding: "11px 24px",
              border: "1px solid var(--border2)", cursor: "pointer", textDecoration: "none",
              fontFamily: T.font, transition: "background 0.15s",
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              See platform flow
            </a>
          </div>
        </div>

        {/* App shell */}
        <div style={{ padding: "0 20px", borderRadius: "14px 14px 0 0", overflow: "hidden" }}>
          <div style={{
            background: "#1a1a1a", borderRadius: "10px 10px 0 0",
            overflow: "hidden", minHeight: 260,
            boxShadow: "0 24px 60px rgba(0,0,0,.7),0 0 0 1px rgba(255,255,255,.05)",
          }}>
            {/* Titlebar */}
            <div style={{
              background: "#252525", height: 36,
              display: "flex", alignItems: "center", padding: "0 14px",
              borderBottom: "1px solid rgba(255,255,255,.06)", position: "relative",
            }}>
              <div style={{ display: "flex", gap: 6 }}>
                {["#ff5f57","#febc2e","#28c840"].map((c,i) => (
                  <div key={i} style={{ width: 11, height: 11, borderRadius: "50%", background: c }} />
                ))}
              </div>
              <span style={{
                position: "absolute", left: "50%", transform: "translateX(-50%)",
                fontSize: 12, color: "rgba(255,255,255,.4)", fontFamily: T.font,
              }}>Pipeline Labs</span>
            </div>

            {/* 3 columns */}
            <div style={{ display: "grid", gridTemplateColumns: "260px 1fr 1fr" }}>
              {/* Left */}
              <div style={{ background: "#202020", borderRight: "1px solid rgba(255,255,255,.06)", padding: "12px 0" }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "rgba(255,255,255,.3)", padding: "0 13px 7px", fontFamily: T.font }}>Active datasets 2</div>
                <div style={{ padding: "7px 13px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "rgba(255,255,255,.8)", marginBottom: 2, fontFamily: T.font }}>
                    <div className="spin" style={{ width: 10, height: 10, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,.2)", borderTopColor: "#fff", flexShrink: 0 }} />
                    customer-events.csv
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,.3)", paddingLeft: 16, fontFamily: T.font }}>Chunk plan running...</div>
                </div>
                <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "rgba(255,255,255,.3)", padding: "10px 13px 7px", fontFamily: T.font }}>Validated outputs 4</div>
                <div style={{ padding: "7px 13px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "rgba(255,255,255,.8)", marginBottom: 2, fontFamily: T.font }}>
                    <div style={{ width: 12, height: 12, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,.28)", flexShrink: 0, position: "relative" }}>
                      <div style={{ position: "absolute", top: 1.5, left: 2.5, width: 5, height: 3, borderLeft: "1.5px solid rgba(255,255,255,.5)", borderBottom: "1.5px solid rgba(255,255,255,.5)", transform: "rotate(-45deg)" }} />
                    </div>
                    churn_training_set_v3
                    <span style={{ fontSize: 10.5, color: "rgba(255,255,255,.25)", marginLeft: "auto", fontFamily: T.font }}>now</span>
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,.3)", paddingLeft: 16, fontFamily: T.font }}>Validation passed. Export ready.</div>
                </div>
              </div>

              {/* Mid */}
              <div style={{ background: "#1a1a1a", borderRight: "1px solid rgba(255,255,255,.06)", display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "12px 15px 10px", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,.82)", borderBottom: "1px solid rgba(255,255,255,.06)", fontFamily: T.font }}>Define dataset objective</div>
                <div style={{ margin: "12px 14px", background: "#2a2a2a", borderRadius: 7, padding: "11px 13px", fontSize: 12.5, color: "rgba(255,255,255,.72)", lineHeight: 1.5, border: "1px solid rgba(255,255,255,.06)", fontFamily: T.font }}>
                  clean this customer events dataset, standardize acquisition channels, repair missing values, and prepare a feature table for churn prediction
                </div>
                <div style={{ padding: "2px 14px", display: "flex", flexDirection: "column", gap: 5 }}>
                  {[["Plan","6s",""],["Read","dataset.cleaning.yaml","#7cb8f0"],["Checked","null and drift summary",""]].map(([k,v,c],i) => (
                    <div key={i} style={{ fontSize: 11.5, color: "rgba(255,255,255,.35)", display: "flex", gap: 8, fontFamily: T.font }}>
                      <span style={{ color: "rgba(255,255,255,.22)" }}>{k}</span>
                      <span style={{ color: c || "inherit" }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right */}
              <div style={{ background: "#1a1a1a", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", height: 36, padding: "0 4px", gap: 2, borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                  {[["dataset.cleaning.yaml", true],["preview_stats.py", false]].map(([label,active],i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 5, fontSize: 12, color: active ? "rgba(255,255,255,.82)" : "rgba(255,255,255,.38)", background: active ? "rgba(255,255,255,.07)" : "transparent", fontFamily: T.font }}>
                      {label as string}
                      {active && <span style={{ fontSize: 9, color: "rgba(255,255,255,.22)" }}>✕</span>}
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 13px", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                  <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.35)", display: "flex", gap: 4, fontFamily: T.font }}>
                    <span>Workflows</span><span style={{ color: "rgba(255,255,255,.18)" }}>›</span><span style={{ color: "rgba(255,255,255,.62)" }}>dataset.cleaning.yaml</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "rgba(255,255,255,.38)", fontFamily: T.font }}>
                    Agent 1 ∨
                    <button style={{ background: "#e0e0e0", color: "#0a0a0a", border: "none", borderRadius: 4, padding: "3px 11px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: T.font }}>Run</button>
                  </div>
                </div>
                <div style={{ padding: "16px 18px" }}>
                  <div style={{ fontSize: 19, fontWeight: 700, color: "#fff", marginBottom: 8, letterSpacing: "-0.3px", fontFamily: T.font }}>Training Dataset Pipeline</div>
                  <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.48)", lineHeight: 1.6, maxWidth: 400, fontFamily: T.font }}>Schema-aware chunking, canonical value mapping, and deterministic validation before export to training and evaluation workflows.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MARQUEE
───────────────────────────────────────────── */
const MARQUEE_ITEMS: SlidingLogoMarqueeItem[] = [
  { id: "pandas", content: <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text2)", fontFamily: T.font }}>Pandas</span> },
  { id: "numpy", content: <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text2)", fontFamily: T.font }}>NumPy</span> },
  { id: "sklearn", content: <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text2)", fontFamily: T.font }}>Scikit-learn</span> },
  { id: "tensorflow", content: <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text2)", fontFamily: T.font }}>TensorFlow</span> },
  { id: "pytorch", content: <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text2)", fontFamily: T.font }}>PyTorch</span> },
  { id: "xgboost", content: <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text2)", fontFamily: T.font }}>XGBoost</span> },
  { id: "lightgbm", content: <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text2)", fontFamily: T.font }}>LightGBM</span> },
  { id: "sql", content: <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text2)", fontFamily: T.font }}>SQL</span> },
  { id: "spark", content: <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text2)", fontFamily: T.font }}>Spark</span> },
  { id: "polars", content: <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text2)", fontFamily: T.font }}>Polars</span> },
  { id: "dask", content: <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text2)", fontFamily: T.font }}>Dask</span> },
  { id: "mlflow", content: <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text2)", fontFamily: T.font }}>MLflow</span> },
];

function Marquee() {
  return (
    <div style={{
      overflow: "hidden",
      borderTop: "1px solid var(--border)",
      borderBottom: "1px solid var(--border)",
      background: "var(--bg2)",
      padding: "18px 0",
      position: "relative",
    }}>
      <SlidingLogoMarquee
        items={MARQUEE_ITEMS}
        speed={0.8}
        pauseOnHover={true}
        enableBlur={false}
        height="60px"
        gap="3rem"
        autoPlay={true}
        showControls={false}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────
   INTERACTIVE DASHBOARD SIMULATION / CTA
───────────────────────────────────────────── */
function DashboardSimulation({ theme }: { theme: Theme }) {
  const [step, setStep] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [aiResponse, setAiResponse] = useState("");
  const fullResponse = "I'll clean this customer events dataset, standardize acquisition channels, repair missing values, and prepare a feature table for churn prediction. Starting now...";

  // Theme-based logo for the simulation sidebar
  const logoSrc = theme === "light" ? "/logo-light.png" : "/image.png";

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsTyping(true);
      let i = 0;
      const interval = setInterval(() => {
        if (i <= fullResponse.length) {
          setAiResponse(fullResponse.slice(0, i));
          i++;
        } else {
          clearInterval(interval);
          setIsTyping(false);
          // Progress through steps
          const stepInterval = setInterval(() => {
            setStep(s => {
              if (s >= 4) {
                clearInterval(stepInterval);
                return 4;
              }
              return s + 1;
            });
          }, 1500);
        }
      }, 30);
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  const steps = [
    { icon: "", label: "Upload", desc: "customer_events.csv" },
    { icon: "", label: "Analyze", desc: "Schema detected" },
    { icon: "", label: "AI Clean", desc: "Processing..." },
    { icon: "", label: "Validate", desc: "Ready for export" },
  ];

  return (
    <section id="how-it-works" style={{
      padding: "96px 44px",
      background: "var(--bg)",
      borderBottom: "1px solid var(--border)",
    }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <Eyebrow>How Pipeline Labs works</Eyebrow>
          <SectionTitle>See the AI take over your pipeline</SectionTitle>
          <SubText style={{ margin: "0 auto" }}>
            From raw data to production-ready datasets — watch every step happen automatically, in real time.
          </SubText>
        </div>

        {/* Interactive Dashboard UI */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "240px 1fr",
          borderRadius: 16,
          overflow: "hidden",
          border: "1px solid var(--border2)",
          boxShadow: "var(--shadow)",
          background: "var(--card)",
          minHeight: 480,
        }}>
          {/* Sidebar */}
          <div style={{
            background: "var(--bg2)",
            borderRight: "1px solid var(--border)",
            padding: "20px 16px",
            display: "flex",
            flexDirection: "column",
          }}>
            {/* Logo - Theme aware */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
              <img src={logoSrc} alt="" style={{ height: 24, width: 24, objectFit: "contain" }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", fontFamily: T.font }}>Pipeline Labs</span>
            </div>

            {/* Nav Items */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {["Overview", "Datasets", "Pipelines", "Analytics"].map((item, i) => (
                <div key={item} style={{
                  padding: "8px 12px",
                  borderRadius: 6,
                  fontSize: 13,
                  color: i === 2 ? "var(--text)" : "var(--text2)",
                  background: i === 2 ? "var(--bg3)" : "transparent",
                  fontFamily: T.font,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}>
                  <span style={{ opacity: 0.6 }}>{["◆", "◈", "◇", "○"][i]}</span>
                  {item}
                </div>
              ))}
            </div>

            {/* Dataset List */}
            <div style={{ marginTop: "auto" }}>
              <div style={{
                fontSize: 10,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--text3)",
                marginBottom: 12,
                fontFamily: T.font,
              }}>
                Active Datasets
              </div>
              <div style={{
                padding: "10px 12px",
                background: "var(--bg3)",
                borderRadius: 8,
                border: "1px solid var(--border)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div className="spin" style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    border: "1.5px solid var(--border2)",
                    borderTopColor: "var(--text)",
                  }} />
                  <span style={{ fontSize: 12, color: "var(--text)", fontFamily: T.font }}>customer_events.csv</span>
                </div>
                <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 4, marginLeft: 20, fontFamily: T.font }}>
                  Processing...
                </div>
              </div>
            </div>
          </div>

          {/* Main Chat Area */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            background: "var(--card)",
          }}>
            {/* Header */}
            <div style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", fontFamily: T.font }}>
                  AI Data Assistant
                </span>
                <span style={{
                  fontSize: 11,
                  padding: "2px 8px",
                  background: "var(--bg2)",
                  borderRadius: 4,
                  color: "var(--text2)",
                  fontFamily: T.font,
                }}>
                  GPT-4o
                </span>
              </div>
              <div style={{
                fontSize: 11,
                color: "var(--text3)",
                fontFamily: T.font,
              }}>
                3 steps remaining
              </div>
            </div>

            {/* Chat Messages */}
            <div style={{
              flex: 1,
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
              overflow: "hidden",
            }}>
              {/* User Message */}
              <div style={{ alignSelf: "flex-end", maxWidth: "80%" }}>
                <div style={{
                  padding: "12px 16px",
                  background: "var(--text)",
                  color: "var(--bg)",
                  borderRadius: "12px 12px 4px 12px",
                  fontSize: 13,
                  fontFamily: T.font,
                  lineHeight: 1.5,
                }}>
                  Clean this customer events dataset and prepare it for churn prediction
                </div>
              </div>

              {/* AI Response */}
              <div style={{ alignSelf: "flex-start", maxWidth: "85%" }}>
                <div style={{
                  padding: "14px 18px",
                  background: "var(--bg2)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px 12px 12px 4px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: "var(--text)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--bg)">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                      </svg>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text)", fontFamily: T.font }}>
                      Pipeline AI
                    </span>
                  </div>
                  <p style={{
                    fontSize: 13,
                    color: "var(--text2)",
                    fontFamily: T.font,
                    lineHeight: 1.6,
                    margin: 0,
                  }}>
                    {aiResponse}
                    {isTyping && <span className="blink-cur">|</span>}
                  </p>
                </div>
              </div>

              {/* Processing Steps */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 12,
                marginTop: 8,
              }}>
                {steps.map((s, i) => (
                  <div key={s.label} style={{
                    padding: "14px",
                    background: i <= step ? "var(--bg3)" : "var(--bg2)",
                    border: `1px solid ${i <= step ? "var(--border2)" : "var(--border)"}`,
                    borderRadius: 10,
                    opacity: i <= step ? 1 : 0.5,
                    transition: "all 0.3s ease",
                  }}>
                    <div style={{
                      fontSize: 18,
                      marginBottom: 6,
                      opacity: i <= step ? 1 : 0.4,
                    }}>{s.icon}</div>
                    <div style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--text)",
                      fontFamily: T.font,
                      textTransform: "uppercase",
                      letterSpacing: "0.03em",
                      marginBottom: 2,
                    }}>
                      {s.label}
                    </div>
                    <div style={{
                      fontSize: 10,
                      color: i <= step ? "var(--text2)" : "var(--text3)",
                      fontFamily: T.font,
                    }}>
                      {i < step ? "" : i === step ? "" : s.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Input Area with CTA */}
            <div style={{
              padding: "16px 20px",
              borderTop: "1px solid var(--border)",
              background: "var(--bg2)",
            }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                background: "var(--card)",
                border: "1px solid var(--border2)",
                borderRadius: 10,
              }}>
                <input
                  type="text"
                  placeholder="Try it yourself — describe your dataset goal..."
                  readOnly
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: "var(--text3)",
                    fontSize: 14,
                    fontFamily: T.font,
                    cursor: "default",
                  }}
                />
                <Link to="/auth" style={{
                  padding: "8px 16px",
                  background: "var(--text)",
                  color: "var(--bg)",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: T.font,
                  textDecoration: "none",
                  transition: "opacity 0.15s",
                  whiteSpace: "nowrap",
                }}>
                  Start building →
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Pills */}
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 12,
          marginTop: 32,
        }}>
          {[
            "Natural language processing",
            "Schema-aware cleaning",
            "Automated validation",
            "Export to any format",
          ].map((feature) => (
            <div key={feature} style={{
              padding: "8px 16px",
              background: "var(--bg2)",
              border: "1px solid var(--border)",
              borderRadius: 999,
              fontSize: 12,
              color: "var(--text2)",
              fontFamily: T.font,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}>
              <span style={{ color: "var(--text)" }}>✓</span>
              {feature}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   HOW IT WORKS — 3 steps
───────────────────────────────────────────── */
/* ... */
const STEPS = [
  {
    n: "01", title: "Ingest raw data from anywhere",
    body: "Upload source datasets and Pipeline Labs profiles schema, types, drift, null patterns, and failure points before the first transformation runs.",
  },
  {
    n: "02", title: "Define the target dataset in plain English",
    body: "Type natural language instructions like \"Normalize features and encode categories\" — our AI understands your intent.",
  },
  {
    n: "03", title: "Ship validated training assets",
    body: "Run chunk-aware AI cleaning, preserve row integrity, and export datasets that are ready for training, evaluation, and reproducible ML workflows.",
  },
];

function HowItWorks() {
  return (
    <section style={{ padding: "96px 44px", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 52 }}>
        <Eyebrow>Process</Eyebrow>
        <SectionTitle style={{ margin: "0 auto 12px" }}>From raw sources to production-grade ML datasets</SectionTitle>
      </div>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
        gap: 1, background: "var(--border)", borderRadius: 14, overflow: "hidden",
      }}>
        {STEPS.map((s) => (
          <div key={s.n} style={{ background: "var(--card)", padding: "36px 32px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text3)", marginBottom: 18, fontFamily: T.font }}>Step {s.n}</div>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              border: "1px solid var(--border2)",
              display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18,
            }}>
              <span style={{ fontSize: 16, color: "var(--text2)", fontFamily: T.font }}>{s.n}</span>
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 500, letterSpacing: "-0.3px", color: "var(--text)", marginBottom: 9, fontFamily: T.font }}>{s.title}</h3>
            <p style={{ fontSize: 13.5, color: "var(--text2)", lineHeight: 1.6, fontFamily: T.font }}>{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   SDK CODE EDITOR SECTION
───────────────────────────────────────────── */

const DEFAULT_CODE = `from pipeline_labs import DataProcessor

# Initialize with your API key
client = DataProcessor(PIPELINE_API_KEY="your_api_key")

# Upload a dataset
dataset = client.datasets.upload("customer_data.csv")

# Process with natural language
processed = client.process(
    dataset_id=dataset.id,
    instructions="""Normalize numeric features, 
        encode categorical variables,
        remove outliers using z-score"""
)

# Download the clean dataset
client.datasets.download(
    processed.id, 
    format="csv",
    output_path="clean_data.csv"
)

# Or get a preview of the results
preview = client.datasets.preview(processed.id, rows=10)
print(f"Processed {preview.row_count} rows, {preview.column_count} columns")
`;

type Token = { type: string; value: string };

function tokenize(code: string): Token[] {
  const tokens: Token[] = [];
  const lines = code.split("\n");
  const keywords = ["from","import","for","in","print","if","else","return","def","class","True","False","None","with","as","try","except","finally","raise","and","or","not","is","lambda","yield","global","nonlocal","del","pass","break","continue","while","assert"];
  const builtins = ["Pipeline","list","create","health","str","int","float","bool","len","range","type","dict","set","tuple"];

  for (let li = 0; li < lines.length; li++) {
    if (li > 0) tokens.push({ type: "newline", value: "\n" });
    const line = lines[li];
    let i = 0;

    while (i < line.length) {
      // Comment
      if (line[i] === "#") {
        tokens.push({ type: "comment", value: line.slice(i) });
        i = line.length;
        continue;
      }
      // String
      if (line[i] === '"' || line[i] === "'") {
        const q = line[i];
        let j = i + 1;
        while (j < line.length && line[j] !== q) j++;
        tokens.push({ type: "string", value: line.slice(i, j + 1) });
        i = j + 1;
        continue;
      }
      // f-string
      if (line[i] === "f" && (line[i+1] === '"' || line[i+1] === "'")) {
        const q = line[i+1];
        let j = i + 2;
        while (j < line.length && line[j] !== q) j++;
        tokens.push({ type: "string", value: line.slice(i, j + 1) });
        i = j + 1;
        continue;
      }
      // Number
      if (/[0-9]/.test(line[i])) {
        let j = i;
        while (j < line.length && /[0-9.]/.test(line[j])) j++;
        tokens.push({ type: "number", value: line.slice(i, j) });
        i = j;
        continue;
      }
      // Identifier/keyword
      if (/[a-zA-Z_]/.test(line[i])) {
        let j = i;
        while (j < line.length && /[a-zA-Z0-9_]/.test(line[j])) j++;
        const word = line.slice(i, j);
        if (keywords.includes(word)) tokens.push({ type: "keyword", value: word });
        else if (builtins.includes(word)) tokens.push({ type: "builtin", value: word });
        else tokens.push({ type: "ident", value: word });
        i = j;
        continue;
      }
      // Operator
      if (/[=<>!+\-*\/|&^%~@]/.test(line[i])) {
        tokens.push({ type: "operator", value: line[i] });
        i++;
        continue;
      }
      // Punctuation
      if (/[()[\]{},.:;]/.test(line[i])) {
        tokens.push({ type: "punct", value: line[i] });
        i++;
        continue;
      }
      // Space
      if (line[i] === " ") {
        let j = i;
        while (j < line.length && line[j] === " ") j++;
        tokens.push({ type: "space", value: line.slice(i, j) });
        i = j;
        continue;
      }
      tokens.push({ type: "other", value: line[i] });
      i++;
    }
  }
  return tokens;
}

const TOKEN_COLORS: Record<string, string> = {
  keyword:  "#c792ea",
  builtin:  "#82aaff",
  string:   "#c3e88d",
  comment:  "#546e7a",
  number:   "#f78c6c",
  operator: "#89ddff",
  punct:    "#89ddff",
  ident:    "#eeffff",
  space:    "inherit",
  newline:  "inherit",
  other:    "#eeffff",
};

function CodeHighlight({ code }: { code: string }) {
  const tokens = tokenize(code);
  return (
    <span className="code-highlight" style={{ color: "#eeffff" }}>
      {tokens.map((tok, i) => {
        if (tok.type === "newline") return "\n";
        if (tok.type === "space") return tok.value;
        return (
          <span key={i} style={{ color: TOKEN_COLORS[tok.type] || "#eeffff" }}>
            {tok.value}
          </span>
        );
      })}
    </span>
  );
}

function SDKSection() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  const syncScroll = () => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  const lineCount = code.split("\n").length;

  return (
    <section style={{
      padding: "96px 0",
      borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)",
      background: "var(--bg2)",
    }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 44px" }}>
        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "flex-start", marginBottom: 44 }}>
          <div>
            <Eyebrow>SDK</Eyebrow>
            <SectionTitle>Integrate in minutes,<br />operationalize data workflows</SectionTitle>
            <SubText style={{ marginBottom: 28 }}>
              Pipeline Labs ships a first-class Python SDK. Authenticate once, then orchestrate dataset ingestion, processing jobs, previews, downloads, and validation directly from your notebooks, apps, or CI pipelines.
            </SubText>
            <div style={{ display: "flex", gap: 10 }}>
              <a
                href="https://pipeline.stldocs.app"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  background: "var(--text)", color: "var(--bg)",
                  fontSize: 13.5, fontWeight: 500, borderRadius: T.pill, padding: "10px 22px",
                  textDecoration: "none", fontFamily: T.font,
                }}
              >View SDK docs →</a>
              <Link to="/dashboard" style={{
                display: "inline-flex", alignItems: "center",
                background: "transparent", color: "var(--text)",
                fontSize: 13.5, fontWeight: 500, borderRadius: T.pill, padding: "10px 22px",
                border: "1px solid var(--border2)", textDecoration: "none", fontFamily: T.font,
              }}>Get API key</Link>
            </div>
          </div>

          {/* Install pill */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{
              background: "#0c0c0c", borderRadius: 10,
              border: "1px solid rgba(255,255,255,.09)",
              padding: "12px 18px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <span style={{ fontFamily: T.mono, fontSize: 13, color: "#c3e88d" }}>pip install pipeline_labs</span>
              <button
                onClick={() => navigator.clipboard?.writeText("pip install pipeline_labs")}
                style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,.3)", padding: 4 }}
                title="Copy"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
            </div>
            <div style={{ fontSize: 12, color: "var(--text3)", fontFamily: T.font, paddingLeft: 4 }}>
              Requires Python 3.9+ · MIT License · 2.1k stars on GitHub
            </div>
          </div>
        </div>

        {/* Editor — full width, single pane */}
        <div style={{
          borderRadius: 14, overflow: "hidden",
          border: "1px solid rgba(255,255,255,.08)",
          boxShadow: "0 40px 80px rgba(0,0,0,.55)",
        }}>
          {/* Titlebar */}
          <div style={{
            background: "#181825", display: "flex", alignItems: "center",
            padding: "0 14px", height: 38,
            borderBottom: "1px solid rgba(255,255,255,.06)",
            gap: 8,
          }}>
            <div style={{ display: "flex", gap: 6 }}>
              {["#ff5f57","#febc2e","#28c840"].map((c,i) => (
                <div key={i} style={{ width: 10.5, height: 10.5, borderRadius: "50%", background: c }} />
              ))}
            </div>
            <div style={{ display: "flex", gap: 2, marginLeft: 8 }}>
              <div style={{
                padding: "4px 12px", borderRadius: "6px 6px 0 0",
                background: "#1e1e2e",
                fontSize: 12, color: "rgba(255,255,255,.82)",
                fontFamily: T.mono,
              }}>
                pipeline_dataset.py
              </div>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "rgba(255,255,255,.38)", fontFamily: T.font }}>
              Agent 1 ∨
              <button style={{ background: "#e0e0e0", color: "#0a0a0a", border: "none", borderRadius: 4, padding: "3px 11px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: T.font }}>Run</button>
            </div>
          </div>

          {/* Code area */}
          <div style={{ background: "#1e1e2e", display: "flex" }}>
            {/* Line numbers */}
            <div style={{
              width: 52, flexShrink: 0,
              background: "#1e1e2e",
              borderRight: "1px solid rgba(255,255,255,.04)",
              padding: "20px 0",
              userSelect: "none",
            }}>
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i} style={{
                  height: "1.75em", lineHeight: "1.75",
                  fontSize: 13, color: "rgba(255,255,255,.2)",
                  paddingRight: 12, fontFamily: T.mono,
                  textAlign: "right",
                }}>
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Editor */}
            <div style={{ position: "relative", flex: 1, minHeight: 420 }}>
              <div
                ref={highlightRef as any}
                style={{
                  position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
                  overflow: "auto", padding: "20px 24px",
                  fontFamily: T.mono, fontSize: 13, lineHeight: 1.75,
                  pointerEvents: "none", zIndex: 1,
                  color: "#eeffff",
                }}
              >
                <CodeHighlight code={code} />
              </div>
              <textarea
                ref={textareaRef}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onScroll={syncScroll}
                spellCheck={false}
                style={{
                  position: "absolute", top: 0, left: 0,
                  width: "100%", height: "100%",
                  background: "transparent",
                  color: "transparent",
                  caretColor: "#fff",
                  border: "none", outline: "none",
                  resize: "none",
                  padding: "20px 24px",
                  fontFamily: T.mono, fontSize: 13, lineHeight: 1.75,
                  zIndex: 2,
                  overflow: "auto",
                  whiteSpace: "pre",
                  minHeight: 420,
                }}
              />
            </div>
          </div>

          {/* Bottom status bar */}
          <div style={{
            background: "#181825", borderTop: "1px solid rgba(255,255,255,.06)",
            padding: "7px 14px", display: "flex", alignItems: "center", gap: 16,
            fontSize: 11, color: "rgba(255,255,255,.25)", fontFamily: T.font,
          }}>
            <span>Ln {lineCount}</span>
            <span>UTF-8</span>
            <span style={{ marginLeft: "auto" }}>pipeline_labs v1.4.0</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   PAIN SECTION
───────────────────────────────────────────── */
function PainSection() {
  const pains = [
    "Raw tables arrive with drift, nulls, and category inconsistencies",
    "Feature preparation logic lives in notebooks no one can reliably reuse",
    "Data quality checks happen late, after models have already been trained",
    "Every new dataset turns into another one-off cleanup project",
  ];
  return (
    <section style={{
      padding: "80px 44px",
      borderTop: "1px solid var(--border)",
      background: "var(--bg)",
    }}>
      <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "center" }}>
        <div>
          <Eyebrow>Sound familiar?</Eyebrow>
          <SectionTitle>Most ML teams still rebuild data preparation from scratch</SectionTitle>
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 14, marginTop: 24 }}>
            {pains.map((p) => (
              <li key={p} style={{ display: "flex", alignItems: "flex-start", gap: 12, fontSize: 14, color: "var(--text2)", fontFamily: T.font, lineHeight: 1.5 }}>
                <span style={{ color: "var(--text3)", fontSize: 16, flexShrink: 0, marginTop: 1 }}>✕</span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <div style={{
          background: "var(--bg2)", border: "1px solid var(--border2)",
          borderRadius: 16, padding: "36px 32px",
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text3)", marginBottom: 18, fontFamily: T.font }}>Pipeline Labs fixes all of this</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              "Ingest structured data and profile it before transformation",
              "Generate schema-aware cleaning plans from a prompt",
              "Run chunked processing with validation and deterministic fallbacks",
              "Export reproducible datasets and code-backed workflows",
            ].map((item) => (
              <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13.5, color: "var(--text2)", fontFamily: T.font, lineHeight: 1.5 }}>
                <span style={{ color: "var(--text2)", flexShrink: 0, marginTop: 1 }}>✓</span>
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   FEATURES
───────────────────────────────────────────── */
const FEATURES = [
  { title: "AI-Native Data Transformation", body: "Describe the target dataset in plain English. Pipeline Labs turns that intent into structured transformations, dataset rules, and execution steps." },
  { title: "Schema-Aware Cleaning Engine",  body: "Chunked processing preserves row integrity across large datasets while standardizing categories, repairing missing values, and enforcing consistent transformations." },
  { title: "Dataset Reliability Checks",  body: "Detect type drift, invalid values, null clusters, and hidden inconsistencies before they leak into training, evaluation, or production scoring." },
  { title: "Reusable ML Data Workflows",   body: "Package ingestion, transformation, and export into repeatable workflows that your team can reuse across experiments and production pipelines." },
  { title: "Structured Ingestion and Export",   body: "Bring in warehouse extracts and structured files, then export validated dataset artifacts that plug directly into analytics, feature stores, and training systems." },
  { title: "Human-in-the-Loop Automation", body: "Give analysts and ML engineers the same system: prompt-driven automation when it is fast, programmable control when it matters, and auditability throughout." },
];

function Features() {
  return (
    <section id="product" style={{ padding: "96px 44px", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 48, gap: 32, flexWrap: "wrap" }}>
        <div><Eyebrow>Features</Eyebrow><SectionTitle>AI data infrastructure,<br />built for machine learning</SectionTitle></div>
        <SubText>From ingestion to validated export, Pipeline Labs gives ML teams a repeatable system for turning messy data into production-ready training assets.</SubText>
      </div>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(2, 1fr)",
        gap: 1, background: "var(--border)", borderRadius: 14, overflow: "hidden",
      }}>
        {FEATURES.map((f) => (
          <div key={f.title} style={{
            background: "var(--card)", padding: "36px",
            transition: "background 0.2s",
          }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = "var(--bg3)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "var(--card)")}
          >
            <div style={{
              width: 38, height: 38, borderRadius: 9, border: "1px solid var(--border2)",
              display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18,
            }}>
              <div style={{ width: 14, height: 14, border: "1.5px solid var(--text3)", borderRadius: 3 }} />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 500, letterSpacing: "-0.3px", marginBottom: 8, color: "var(--text)", fontFamily: T.font }}>{f.title}</h3>
            <p style={{ fontSize: 13.5, color: "var(--text2)", lineHeight: 1.65, fontFamily: T.font }}>{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   STATS
───────────────────────────────────────────── */
const STATS = [
  { n: "95", s: "%", label: "Fewer bad rows in training" },
  { n: "10", s: "×", label: "Faster dataset iteration" },
  { n: "50", s: "K+", label: "Workflow runs orchestrated" },
  { n: "<5", s: "min", label: "Time to clean preview" },
];

function Stats() {
  return (
    <section style={{
      padding: "96px 0",
      borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)",
      background: "var(--bg2)",
    }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 44px" }}>
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          <Eyebrow>By the numbers</Eyebrow>
          <SectionTitle style={{ margin: "0 auto" }}>Designed for teams building serious ML systems</SectionTitle>
        </div>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
          gap: 1, background: "var(--border)", borderRadius: 14, overflow: "hidden",
        }}>
          {STATS.map((s) => (
            <div key={s.label} style={{ background: "var(--card)", padding: "44px 36px", textAlign: "center" }}>
              <div style={{ fontSize: 48, fontWeight: 300, letterSpacing: "-2px", lineHeight: 1, color: "var(--text)", marginBottom: 7, fontFamily: T.font }}>
                {s.n}<span style={{ color: "var(--text2)" }}>{s.s}</span>
              </div>
              <div style={{ fontSize: 13.5, color: "var(--text2)", fontFamily: T.font }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   TESTIMONIALS
───────────────────────────────────────────── */
const TESTIMONIALS = [
  { stars: 5, text: "\"Pipeline Labs gave us a reliable path from raw warehouse extracts to model-ready datasets without bespoke cleanup scripts in every repo.\"", photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=Aryan&backgroundColor=b6e3f4", name: "Aryan Shah", role: "Data Scientist · Nexus Finance" },
  { stars: 5, text: "\"We stopped treating preprocessing as throwaway work. Now dataset logic is explicit, reusable, and fast enough to keep up with product experimentation.\"", photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=Laura&backgroundColor=c0aede", name: "Laura Kim", role: "ML Engineer · Orbit AI" },
  { stars: 5, text: "\"The biggest win is consistency. Feature naming, missing value handling, and category normalization stay aligned across teams and across time.\"", photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=Marcus&backgroundColor=ffd5dc", name: "Marcus Reid", role: "Head of Analytics · Stackway" },
];

function Testimonials() {
  return (
    <section style={{ padding: "96px 44px", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 52 }}>
        <Eyebrow>Testimonials</Eyebrow>
        <SectionTitle style={{ margin: "0 auto" }}>Used by teams modernizing ML operations</SectionTitle>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {TESTIMONIALS.map((t) => (
          <div key={t.name} style={{
            background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: 14, padding: 28,
            transition: "border-color 0.2s, transform 0.2s",
          }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border2)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLDivElement).style.transform = "none"; }}
          >
            <div style={{ color: "var(--text2)", fontSize: 13, letterSpacing: 2, marginBottom: 14, fontFamily: T.font }}>{"★".repeat(t.stars)}</div>
            <p style={{ fontSize: 13.5, color: "var(--text2)", lineHeight: 1.7, marginBottom: 22, fontStyle: "italic", fontFamily: T.font }}>{t.text}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img
                src={t.photo}
                alt={t.name}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  objectFit: "cover",
                  flexShrink: 0,
                }}
              />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)", fontFamily: T.font }}>{t.name}</div>
                <div style={{ fontSize: 11.5, color: "var(--text3)", fontFamily: T.font }}>{t.role}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   PRICING
───────────────────────────────────────────── */
const PLANS = [
  {
    name: "Free", monthly: 0, annual: 0, desc: "For early-stage teams proving out AI-native dataset cleaning and prompt-driven transformations.",
    features: ["Up to 5 datasets","1,000 rows per dataset","50 processing jobs/month","Basic transformations (normalize, encode)","Structured file uploads","Email support"],
    cta: "Get started free", featured: false,
  },
  {
    name: "Pro", monthly: 29, annual: 22, desc: "For production practitioners managing larger datasets, faster iteration, and richer workflow control.",
    features: ["Unlimited datasets","50,000 rows per dataset","Unlimited processing","Advanced AI transformations","Structured files + dataset exports","Train/test splitting","Export Python code","Priority email support"],
    cta: "Start 14-day free trial", featured: true,
  },
  {
    name: "Team", monthly: 109, annual: 82, desc: "For organizations standardizing how datasets are cleaned, validated, and handed off to training pipelines.",
    features: ["Everything in Pro","Up to 20 team members","250,000 rows per dataset","Custom preprocessing templates","SSO / SAML","Audit logs & data lineage","Dedicated Slack support","Private deployment option"],
    cta: "Start 14-day free trial", featured: false,
  },
];

function Pricing() {
  const [annual, setAnnual] = useState(false);

  return (
    <section id="pricing" style={{
      background: "var(--bg2)",
      borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)",
    }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "96px 44px", textAlign: "center" }}>
        <Eyebrow>Pricing</Eyebrow>
        <SectionTitle style={{ margin: "0 auto 12px" }}>Pricing for teams building data leverage</SectionTitle>
        <SubText style={{ margin: "0 auto 32px" }}>Start with a single workflow. Scale into shared infrastructure as your dataset volume and model complexity grow.</SubText>

        <div style={{
          display: "inline-flex", alignItems: "center",
          background: "var(--bg3)", border: "1px solid var(--border)",
          borderRadius: T.pill, padding: 3, marginBottom: 52, gap: 3,
        }}>
          {["Monthly","Annually"].map((label) => {
            const isActive = label === "Monthly" ? !annual : annual;
            return (
              <button key={label} onClick={() => setAnnual(label === "Annually")} style={{
                fontSize: 12.5, fontWeight: 500, padding: "7px 18px",
                borderRadius: T.pill, border: "none", cursor: "pointer",
                background: isActive ? "var(--card)" : "transparent",
                color: isActive ? "var(--text)" : "var(--text2)",
                boxShadow: isActive ? "0 1px 5px rgba(0,0,0,.2)" : "none",
                transition: "background 0.2s, color 0.2s", fontFamily: T.font,
              }}>
                {label}
                {label === "Annually" && (
                  <span style={{
                    fontSize: 10, background: "var(--border2)", color: "var(--text2)",
                    borderRadius: T.pill, padding: "2px 7px", fontWeight: 600, marginLeft: 4,
                    fontFamily: T.font,
                  }}>Save 25%</span>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, textAlign: "left" }}>
          {PLANS.map((plan) => (
            <div key={plan.name} style={{
              background: "var(--card)",
              border: `1px solid ${plan.featured ? "var(--text3)" : "var(--border)"}`,
              borderRadius: 16, padding: 32, position: "relative", overflow: "hidden",
              transition: "transform 0.2s",
              boxShadow: plan.featured ? "inset 0 0 0 1px var(--border2)" : "none",
            }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.transform = "none")}
            >
              {plan.featured && (
                <span style={{
                  position: "absolute", top: 18, right: 18,
                  background: "var(--text)", color: "var(--bg)",
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase",
                  padding: "3px 9px", borderRadius: T.pill, fontFamily: T.font,
                }}>Most popular</span>
              )}
              <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text2)", marginBottom: 18, fontFamily: T.font }}>{plan.name}</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 3, marginBottom: 6 }}>
                <span style={{ fontSize: 19, fontWeight: 400, color: "var(--text2)", paddingBottom: 7, fontFamily: T.font }}>$</span>
                <span style={{ fontSize: 50, fontWeight: 300, letterSpacing: "-2.5px", lineHeight: 1, color: "var(--text)", fontFamily: T.font }}>{annual ? plan.annual : plan.monthly}</span>
                <span style={{ fontSize: 12.5, color: "var(--text3)", paddingBottom: 9, fontFamily: T.font }}>/ mo</span>
              </div>
              <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.6, marginBottom: 24, minHeight: 44, fontFamily: T.font }}>{plan.desc}</p>
              <div style={{ height: 1, background: "var(--border)", marginBottom: 22 }} />
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
                {plan.features.map((f) => <CheckItem key={f}>{f}</CheckItem>)}
              </ul>
              <Link to="/dashboard/billing" style={{
                width: "100%", padding: 12, borderRadius: T.pill,
                fontSize: 13.5, fontWeight: 500, cursor: "pointer", fontFamily: T.font,
                background: plan.featured ? "var(--text)" : "transparent",
                color: plan.featured ? "var(--bg)" : "var(--text)",
                border: plan.featured ? "none" : "1px solid var(--border2)",
                transition: "opacity 0.15s", textDecoration: "none", display: "inline-block", textAlign: "center",
              }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.opacity = "0.75")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.opacity = "1")}
              >{plan.cta}</Link>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 28, fontSize: 12.5, color: "var(--text3)", fontFamily: T.font }}>
          All plans include a 14-day free trial. No credit card required. Cancel anytime.
        </p>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   FAQ
───────────────────────────────────────────── */
const FAQS = [
  { q: "Does Pipeline Labs have access to my data?", a: "Your data is processed securely and never used to train our models. All processing happens in isolated environments, and your data is encrypted in transit and at rest. You can request complete deletion at any time." },
  { q: "What file formats are supported?", a: "Pipeline Labs supports CSV, Excel (XLSX/XLS), JSON, and Parquet inputs today, with exports available in the same structured formats for downstream training and analytics workflows." },
  { q: "How does Pipeline Labs stay consistent across large datasets?", a: "Our AI has been trained on thousands of data science workflows. Simply describe what you need in plain English (e.g., \"normalize numeric features, encode categories, remove outliers\") and the AI translates this into optimized data transformations." },
  { q: "Can I see the code generated by the AI?", a: "Yes. Pro and Team plans include code export so your team can inspect generated Python workflows, audit transformations, and move validated logic into existing ML pipelines when needed." },
  { q: "How does billing work for the Team plan?", a: "The Team plan is $109/month (or $82/month billed annually) for up to 20 team members. You're only charged after your free trial ends. Additional seats beyond 20 can be added for $5/user/month." },
];

function FAQ() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section id="resources" style={{ padding: "96px 44px", maxWidth: 760, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <Eyebrow>FAQ</Eyebrow>
        <SectionTitle style={{ margin: "0 auto" }}>Common questions</SectionTitle>
      </div>
      <div style={{
        display: "flex", flexDirection: "column", gap: 1,
        background: "var(--border)", borderRadius: 14, overflow: "hidden",
      }}>
        {FAQS.map((f, i) => (
          <div key={i} style={{ background: "var(--card)" }}>
            <button onClick={() => setOpen(open === i ? null : i)} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              width: "100%", padding: "20px 26px",
              fontSize: 14.5, fontWeight: 500, letterSpacing: "-0.2px",
              color: "var(--text)", background: "none", border: "none",
              cursor: "pointer", gap: 14, textAlign: "left", fontFamily: T.font,
            }}>
              {f.q}
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2"
                style={{ flexShrink: 0, transform: open === i ? "rotate(45deg)" : "none", transition: "transform 0.22s" }}>
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
            <div className={`faq-answer${open === i ? " open" : ""}`} style={{ padding: open === i ? "0 26px 20px" : "0 26px" }}>
              <p style={{ fontSize: 13.5, color: "var(--text2)", lineHeight: 1.7, fontFamily: T.font }}>{f.a}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   BLOG CAROUSEL
───────────────────────────────────────────── */
const BLOG_POSTS = [
  {
    slug: "ai-powered-data-preprocessing",
    title: "How AI Data Infrastructure Changes ML Velocity",
    excerpt: "Manual data cleaning is the biggest time sink in ML workflows. Here's how AI is finally fixing that.",
    tag: "AI & ML",
    readTime: "5 min read",
    date: "2026-03-20",
    author: "Ahmad Jamil",
  },
  {
    slug: "from-csv-to-ml-ready",
    title: "From Raw Data to Production-Ready Training Set",
    excerpt: "A step-by-step walkthrough of uploading a messy real-world dataset and getting it production-ready.",
    tag: "Tutorial",
    readTime: "7 min read",
    date: "2026-03-10",
    author: "Ahmad Jamil",
  },
  {
    slug: "feature-engineering-guide",
    title: "Operationalizing Feature Engineering with AI Workflows",
    excerpt: "Feature engineering is the difference between a mediocre model and a great one. Here's how to do it faster.",
    tag: "Feature Engineering",
    readTime: "6 min read",
    date: "2026-02-28",
    author: "Ahmad Jamil",
  },
];

function BlogCarousel() {
  const [idx, setIdx] = useState(0);
  const visible = 3;
  const total = BLOG_POSTS.length;
  const canPrev = idx > 0;
  const canNext = idx + visible < total;

  return (
    <section style={{
      padding: "96px 44px",
      borderTop: "1px solid var(--border)",
      background: "var(--bg)",
    }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 48, gap: 20, flexWrap: "wrap" }}>
          <div>
            <Eyebrow>From the blog</Eyebrow>
            <SectionTitle>Latest insights</SectionTitle>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", gap: 8 }}>
              {[canPrev, canNext].map((enabled, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i === 0 ? idx - 1 : idx + 1)}
                  disabled={!enabled}
                  style={{
                    width: 36, height: 36, borderRadius: "50%",
                    border: "1px solid var(--border2)",
                    background: "transparent",
                    color: enabled ? "var(--text)" : "var(--text3)",
                    cursor: enabled ? "pointer" : "default",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={e => { if (enabled) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg3)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {i === 0
                      ? <polyline points="15 18 9 12 15 6" />
                      : <polyline points="9 18 15 12 9 6" />}
                  </svg>
                </button>
              ))}
            </div>
            <Link to="/blog" style={{
              fontSize: 13, fontWeight: 500, color: "var(--text2)",
              textDecoration: "none", fontFamily: T.font,
              transition: "color 0.15s",
            }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--text2)")}
            >View all →</Link>
          </div>
        </div>

        <div style={{ overflow: "hidden" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(${total}, 1fr)`,
            gap: 16,
            transform: `translateX(calc(-${idx} * (100% / ${total}) - ${idx} * 16px / ${total}))`,
            transition: "transform 0.4s cubic-bezier(0.4,0,0.2,1)",
          }}>
            {BLOG_POSTS.map((post) => (
              <Link to={`/blog/${post.slug}`}
                style={{
                  display: "block", textDecoration: "none",
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 14, padding: 28,
                  transition: "border-color 0.2s, transform 0.2s",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border2)";
                  (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-3px)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border)";
                  (e.currentTarget as HTMLAnchorElement).style.transform = "none";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600, letterSpacing: "0.07em",
                    textTransform: "uppercase" as const,
                    color: "var(--text3)", background: "var(--bg3)",
                    border: "1px solid var(--border)",
                    borderRadius: T.pill, padding: "3px 10px", fontFamily: T.font,
                  }}>{post.tag}</span>
                  <span style={{ fontSize: 12, color: "var(--text3)", fontFamily: T.font }}>{post.readTime}</span>
                </div>
                <h3 style={{
                  fontSize: 17, fontWeight: 500, letterSpacing: "-0.3px",
                  color: "var(--text)", marginBottom: 10, lineHeight: 1.35, fontFamily: T.font,
                }}>{post.title}</h3>
                <p style={{
                  fontSize: 13.5, color: "var(--text2)", lineHeight: 1.65,
                  marginBottom: 20, fontFamily: T.font,
                }}>{post.excerpt}</p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12.5, color: "var(--text2)", fontFamily: T.font }}>{post.author}</span>
                  <span style={{ fontSize: 12, color: "var(--text3)", fontFamily: T.font }}>
                    {new Date(post.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   CTA BANNER
───────────────────────────────────────────── */
function CTABanner() {
  return (
    <section style={{
      padding: "80px 44px", textAlign: "center",
      borderTop: "1px solid var(--border)", background: "var(--bg2)",
    }}>
      <Divider style={{ marginBottom: 52 }} />
      <h2 style={{ fontSize: "clamp(28px, 3.8vw, 44px)", fontWeight: 300, letterSpacing: "-0.04em", color: "var(--text)", marginBottom: 14, fontFamily: T.font }}>
        Build the data layer your models deserve.
      </h2>
      <p style={{ fontSize: 16, color: "var(--text2)", marginBottom: 36, maxWidth: 480, margin: "0 auto 36px", fontFamily: T.font }}>
        Join thousands of data scientists who've automated their preprocessing — and spend more time on what actually matters.
      </p>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
        <Link to="/dashboard" style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "var(--text)", color: "var(--bg)",
          fontSize: 14, fontWeight: 500, borderRadius: T.pill, padding: "11px 24px",
          textDecoration: "none", fontFamily: T.font,
        }}>Start building</Link>
        <Link to="/contact" style={{
          display: "inline-flex", alignItems: "center",
          background: "transparent", color: "var(--text)",
          fontSize: 14, fontWeight: 500, borderRadius: T.pill, padding: "11px 24px",
          border: "1px solid var(--border2)", textDecoration: "none", fontFamily: T.font,
        }}>Talk to sales</Link>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   FOOTER
───────────────────────────────────────────── */
const FOOTER_LINKS: Record<string, { label: string; href: string }[]> = {
  Product:    [
    { label: "Features", href: "#product" },
    { label: "Pricing", href: "#pricing" },
    { label: "Blog", href: "/blog" },
    { label: "Changelog", href: "#" },
    { label: "Roadmap", href: "#" },
    { label: "Status", href: "#" },
  ],
  Developers: [
    { label: "Documentation", href: "#" },
    { label: "API Reference", href: "#" },
    { label: "SDK", href: "#" },
    { label: "Examples", href: "#" },
    { label: "Open source", href: "#" },
  ],
  Company:    [
    { label: "About", href: "#" },
    { label: "Blog", href: "#" },
    { label: "Careers", href: "#" },
    { label: "Press", href: "#" },
    { label: "Contact", href: "/contact" },
  ],
  Legal:      [
    { label: "Privacy", href: "#" },
    { label: "Terms", href: "#" },
    { label: "Security", href: "#" },
    { label: "Cookies", href: "#" },
  ],
};

function Footer({ theme }: { theme: Theme }) {
  const logoSrc = theme === "light" ? "/logo-light.png" : "/image.png";
  return (
    <footer style={{ background: "var(--bg)", borderTop: "1px solid var(--border)", padding: "56px 44px 32px", fontFamily: T.font }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 44, paddingBottom: 48, borderBottom: "1px solid var(--border)" }}>
          {/* Brand */}
          <div>
            <img src={logoSrc} alt="Pipeline Labs" style={{ height: 26, objectFit: "contain" }} />
            <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.65, maxWidth: 240, marginBottom: 22, marginTop: 14 }}>
              AI data infrastructure for transforming raw datasets into validated, training-ready assets and repeatable ML workflows.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              {[
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />,
                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />,
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />,
              ].map((path, i) => (
                <a key={i} href="#" style={{
                  width: 32, height: 32, borderRadius: 7,
                  background: "var(--bg3)", border: "1px solid var(--border)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--text2)", textDecoration: "none",
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">{path}</svg>
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([heading, links]) => (
            <div key={heading}>
              <h4 style={{ fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.09em", color: "var(--text3)", marginBottom: 14 }}>{heading}</h4>
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                {links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      target={l.href.startsWith("http") ? "_blank" : undefined}
                      rel={l.href.startsWith("http") ? "noopener noreferrer" : undefined}
                      style={{ fontSize: 13, color: "var(--text2)", textDecoration: "none", transition: "color 0.15s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text2)")}
                    >{l.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div style={{ paddingTop: 26, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
          <span style={{ fontSize: 12.5, color: "var(--text3)" }}>© 2026 Pipeline Labs, Inc. All rights reserved.</span>
          <div style={{ display: "flex", gap: 22 }}>
            {["Privacy","Terms","Security","Cookies"].map((l) => (
              <a key={l} href="#" style={{ fontSize: 12.5, color: "var(--text3)", textDecoration: "none" }}>{l}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ─────────────────────────────────────────────
   ROOT
───────────────────────────────────────────── */
export default function PipelineLabs() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const saved = localStorage.getItem("pl-theme") as Theme | null;
    if (saved) { setTheme(saved); return; }
    const preferLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    setTheme(preferLight ? "light" : "dark");
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("pl-theme", theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <>
      <GlobalStyle />
      <div style={{ background: "var(--bg)", minHeight: "100vh", fontFamily: T.font }}>
        <Nav theme={theme} toggleTheme={toggle} />
        <main style={{ paddingTop: 64 }}>
          <Hero />
          <Marquee />
          <PainSection />
          <DashboardSimulation />
          <HowItWorks />
          <SDKSection />
          <Features />
          <Stats />
          <Testimonials />
          <BlogCarousel />
          <Pricing />
          <FAQ />
          <CTABanner />
        </main>
        <Footer theme={theme} />
      </div>
    </>
  );
}