"use client";

import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";

/* ─────────────────────────────────────────────
   GLOBAL STYLES
───────────────────────────────────────────── */
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Source+Code+Pro:wght@400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }

  body {
    font-family: 'Helvetica World', 'Helvetica Neue', 'HelveticaNeue', Helvetica, Arial, sans-serif !important;
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
    --accent:  #e0a678;
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
    --accent:  #c8925e;
  }
`;

function GlobalStyle() {
  useEffect(() => {
    const saved = localStorage.getItem("pl-theme") as "dark" | "light" | null;
    const theme = saved || "dark";
    document.documentElement.setAttribute("data-theme", theme);
    
    const style = document.createElement("style");
    style.textContent = GLOBAL_CSS;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);
  return null;
}

const T = {
  font: "'Helvetica World', 'Helvetica Neue', 'HelveticaNeue', Helvetica, Arial, sans-serif",
};

export default function Auth() {
  const navigate = useNavigate();
  const { isAuthenticated, loading, loginWithRedirect } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !loading) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, loading, navigate]);

  const handleLogin = () => {
    loginWithRedirect();
  };

  if (loading) {
    return (
      <div data-theme="dark" style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg, #0a0a0a)",
      }}>
        <GlobalStyle />
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "16px",
        }}>
          <Loader2 style={{ 
            width: "32px", 
            height: "32px", 
            animation: "spin 1s linear infinite",
            color: "var(--text2, rgba(245,245,245,0.52))"
          }} />
          <p style={{
            fontSize: "14px",
            color: "var(--text2, rgba(245,245,245,0.52))",
            fontFamily: T.font,
          }}>
            Loading...
          </p>
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div data-theme="dark" style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bg, #0a0a0a)",
      padding: "24px",
    }}>
      <GlobalStyle />
      
      <div style={{
        width: "100%",
        maxWidth: "400px",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: "12px", textDecoration: "none" }}>
            <img src="/image.png" alt="Pipeline Labs" style={{ height: 32, objectFit: "contain" }} />
            <span style={{ fontSize: "18px", fontWeight: 600, color: "var(--text)", fontFamily: T.font }}>
              Pipeline Labs
            </span>
          </Link>
        </div>

        {/* Auth Card */}
        <div style={{
          background: "var(--card, #111111)",
          border: "1px solid var(--border)",
          borderRadius: "12px",
          padding: "32px",
        }}>
          <h1 style={{
            fontSize: "24px",
            fontWeight: 600,
            color: "var(--text)",
            marginBottom: "8px",
            fontFamily: T.font,
            textAlign: "center",
          }}>
            Welcome back
          </h1>
          <p style={{
            fontSize: "14px",
            color: "var(--text2)",
            marginBottom: "24px",
            fontFamily: T.font,
            textAlign: "center",
          }}>
            Sign in to continue to Pipeline Labs
          </p>

          {/* Auth0 Login Button */}
          <button
            onClick={handleLogin}
            style={{
              width: "100%",
              padding: "12px 16px",
              background: "var(--text)",
              color: "var(--bg)",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 600,
              fontFamily: T.font,
              cursor: "pointer",
              transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "0.9";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "1";
            }}
          >
            Sign in with Auth0
          </button>

          {/* Back to home */}
          <p style={{
            textAlign: "center",
            marginTop: "24px",
            fontSize: "13px",
            color: "var(--text3)",
            fontFamily: T.font,
          }}>
            <Link to="/" style={{ color: "var(--text3)", textDecoration: "none" }}>
              ← Back to home
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
