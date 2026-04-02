"use client";

import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

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
  const { user } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Check for auth callback (OAuth)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes("access_token")) {
      handleAuthCallback();
    }
  }, []);

  const handleAuthCallback = async () => {
    setLoading(true);
    const { error } = await supabase.auth.exchangeCodeForSession(window.location.hash);
    if (error) {
      setError("Authentication failed. Please try again.");
    } else {
      navigate("/dashboard");
    }
    setLoading(false);
  };

  // Redirect if already signed in
  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/dashboard");
      } else {
        const { error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`
          }
        });
        if (error) throw error;
        setMessage("Check your email for the confirmation link.");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth`,
      },
    });
    if (error) setError(error.message);
  };

  if (loading && !email && !password) {
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
            Completing sign in...
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
            {isLogin ? "Welcome back" : "Create account"}
          </h1>
          <p style={{
            fontSize: "14px",
            color: "var(--text2)",
            marginBottom: "24px",
            fontFamily: T.font,
            textAlign: "center",
          }}>
            {isLogin ? "Sign in to continue to Pipeline Labs" : "Get started with your free account"}
          </p>

          {/* Google OAuth */}
          <button
            onClick={handleGoogleAuth}
            disabled={loading}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              padding: "12px 16px",
              background: "transparent",
              border: "1px solid var(--border2)",
              borderRadius: "8px",
              color: "var(--text)",
              fontSize: "14px",
              fontWeight: 500,
              fontFamily: T.font,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              transition: "all 0.15s",
              marginBottom: "24px",
            }}
            onMouseEnter={(e) => {
              if (!loading) e.currentTarget.style.background = "var(--bg3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "24px",
          }}>
            <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
            <span style={{ fontSize: "12px", color: "var(--text3)", fontFamily: T.font }}>or</span>
            <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
          </div>

          {/* Email Form */}
          <form onSubmit={handleEmailAuth} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 500,
                color: "var(--text2)",
                marginBottom: "6px",
                fontFamily: T.font,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  background: "var(--bg2)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  color: "var(--text)",
                  fontSize: "14px",
                  fontFamily: T.font,
                  outline: "none",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = "var(--border2)"}
                onBlur={(e) => e.currentTarget.style.borderColor = "var(--border)"}
              />
            </div>

            <div>
              <label style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 500,
                color: "var(--text2)",
                marginBottom: "6px",
                fontFamily: T.font,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  background: "var(--bg2)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  color: "var(--text)",
                  fontSize: "14px",
                  fontFamily: T.font,
                  outline: "none",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = "var(--border2)"}
                onBlur={(e) => e.currentTarget.style.borderColor = "var(--border)"}
              />
            </div>

            {error && (
              <div style={{
                padding: "12px 16px",
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                borderRadius: "8px",
                color: "#ef4444",
                fontSize: "13px",
                fontFamily: T.font,
              }}>
                {error}
              </div>
            )}

            {message && (
              <div style={{
                padding: "12px 16px",
                background: "rgba(34, 197, 94, 0.1)",
                border: "1px solid rgba(34, 197, 94, 0.2)",
                borderRadius: "8px",
                color: "#22c55e",
                fontSize: "13px",
                fontFamily: T.font,
              }}>
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
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
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
                transition: "opacity 0.15s",
                marginTop: "8px",
              }}
            >
              {loading ? (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                  <Loader2 style={{ width: "16px", height: "16px", animation: "spin 1s linear infinite" }} />
                  {isLogin ? "Signing in..." : "Creating account..."}
                </span>
              ) : (
                isLogin ? "Sign in" : "Create account"
              )}
            </button>
          </form>

          {/* Toggle */}
          <p style={{
            textAlign: "center",
            marginTop: "24px",
            fontSize: "14px",
            color: "var(--text2)",
            fontFamily: T.font,
          }}>
            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              onClick={() => setIsLogin(!isLogin)}
              style={{
                background: "none",
                border: "none",
                color: "var(--text)",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: "14px",
                fontFamily: T.font,
                textDecoration: "underline",
              }}
            >
              {isLogin ? "Sign up" : "Sign in"}
            </button>
          </p>

          {/* Back to home */}
          <p style={{
            textAlign: "center",
            marginTop: "16px",
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

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
