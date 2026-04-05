"use client";

import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

/* ─────────────────────────────────────────────
   GLOBAL STYLES
───────────────────────────────────────────── */
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important;
    -webkit-font-smoothing: antialiased;
    overflow-x: hidden;
  }

  /* Dark tokens - Cursor style */
  [data-theme="dark"] {
    --bg:      #0d0d0d;
    --bg2:     #141414;
    --bg3:     #1a1a1a;
    --bg4:     #262626;
    --border:  rgba(255,255,255,0.08);
    --border2: rgba(255,255,255,0.12);
    --text:    #ffffff;
    --text2:   rgba(255,255,255,0.55);
    --text3:   rgba(255,255,255,0.35);
    --accent:  #3b82f6;
    --accent-hover: #2563eb;
    --google:  #ea4335;
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

export default function Auth() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if already signed in
  useEffect(() => {
    if (user && !authLoading) {
      navigate("/dashboard");
    }
  }, [user, authLoading, navigate]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Signed in successfully");
        navigate("/dashboard");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: `${firstName} ${lastName}`.trim(),
            },
            emailRedirectTo: `${window.location.origin}/auth`,
          },
        });
        if (error) throw error;
        toast.success("Account created! Check your email to confirm.");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
      toast.error(err.message || "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { lovable } = await import("@/integrations/lovable");
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
        extraParams: { prompt: "select_account" },
      });

      if (result.error) throw result.error;
      if (result.redirected) return;

      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Google sign-in failed");
      toast.error(err.message || "Google sign-in failed");
      setIsLoading(false);
    }
  };

  if (authLoading || (user && !isLoading)) {
    return (
      <div
        data-theme="dark"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg)",
        }}
      >
        <GlobalStyle />
        <Loader2
          style={{
            width: "32px",
            height: "32px",
            animation: "spin 1s linear infinite",
            color: "var(--text2)",
          }}
        />
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div
      data-theme="dark"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        padding: "24px",
      }}
    >
      <GlobalStyle />

      {/* Logo */}
      <div style={{ marginBottom: "40px", textAlign: "center" }}>
        <Link
          to="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "12px",
            textDecoration: "none",
          }}
        >
          <img
            src="/image.png"
            alt="Pipeline Labs"
            style={{ height: 36, objectFit: "contain" }}
          />
        </Link>
      </div>

      {/* Main Card */}
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h1
            style={{
              fontSize: "24px",
              fontWeight: 600,
              color: "var(--text)",
              marginBottom: "8px",
              letterSpacing: "-0.02em",
            }}
          >
            {isLogin ? "Welcome back" : "Create your account"}
          </h1>
          <p
            style={{
              fontSize: "14px",
              color: "var(--text2)",
              lineHeight: "1.5",
            }}
          >
            {isLogin
              ? "Sign in to continue to Pipeline Labs"
              : "Start building with Pipeline Labs"}
          </p>
        </div>

        {/* Google OAuth */}
        <button
          onClick={handleGoogleAuth}
          disabled={isLoading}
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
            cursor: isLoading ? "not-allowed" : "pointer",
            opacity: isLoading ? 0.6 : 1,
            transition: "all 0.15s ease",
            marginBottom: "12px",
          }}
          onMouseEnter={(e) => {
            if (!isLoading) {
              e.currentTarget.style.background = "var(--bg3)";
              e.currentTarget.style.borderColor = "var(--border2)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.borderColor = "var(--border2)";
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            margin: "24px 0",
          }}
        >
          <div
            style={{ flex: 1, height: "1px", background: "var(--border)" }}
          />
          <span
            style={{
              fontSize: "12px",
              color: "var(--text3)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            or
          </span>
          <div
            style={{ flex: 1, height: "1px", background: "var(--border)" }}
          />
        </div>

        {/* Email Form */}
        <form
          onSubmit={handleEmailAuth}
          style={{ display: "flex", flexDirection: "column", gap: "16px" }}
        >
          {/* First/Last Name for signup */}
          {!isLogin && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 500,
                    color: "var(--text2)",
                    marginBottom: "6px",
                  }}
                >
                  First name
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                  required={!isLogin}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    background: "var(--bg2)",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    color: "var(--text)",
                    fontSize: "14px",
                    outline: "none",
                    transition: "border-color 0.15s",
                  }}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor = "var(--accent)")
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor = "var(--border)")
                  }
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 500,
                    color: "var(--text2)",
                    marginBottom: "6px",
                  }}
                >
                  Last name
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  required={!isLogin}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    background: "var(--bg2)",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    color: "var(--text)",
                    fontSize: "14px",
                    outline: "none",
                    transition: "border-color 0.15s",
                  }}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor = "var(--accent)")
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor = "var(--border)")
                  }
                />
              </div>
            </div>
          )}

          <div>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 500,
                color: "var(--text2)",
                marginBottom: "6px",
              }}
            >
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
                padding: "10px 12px",
                background: "var(--bg2)",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                color: "var(--text)",
                fontSize: "14px",
                outline: "none",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) =>
                (e.currentTarget.style.borderColor = "var(--accent)")
              }
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = "var(--border)")
              }
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 500,
                color: "var(--text2)",
                marginBottom: "6px",
              }}
            >
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
                padding: "10px 12px",
                background: "var(--bg2)",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                color: "var(--text)",
                fontSize: "14px",
                outline: "none",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) =>
                (e.currentTarget.style.borderColor = "var(--accent)")
              }
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = "var(--border)")
              }
            />
          </div>

          {error && (
            <div
              style={{
                padding: "12px 16px",
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                borderRadius: "6px",
                color: "#ef4444",
                fontSize: "13px",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: "100%",
              padding: "12px 16px",
              background: "var(--text)",
              color: "var(--bg)",
              border: "none",
              borderRadius: "6px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.7 : 1,
              transition: "opacity 0.15s",
              marginTop: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            {isLoading ? (
              <>
                <Loader2
                  style={{
                    width: "16px",
                    height: "16px",
                    animation: "spin 1s linear infinite",
                  }}
                />
                {isLogin ? "Signing in..." : "Creating account..."}
              </>
            ) : isLogin ? (
              "Continue"
            ) : (
              "Create account"
            )}
          </button>
        </form>

        {/* Toggle */}
        <p
          style={{
            textAlign: "center",
            marginTop: "24px",
            fontSize: "13px",
            color: "var(--text2)",
          }}
        >
          {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
            }}
            style={{
              background: "none",
              border: "none",
              color: "var(--text)",
              fontWeight: 500,
              cursor: "pointer",
              fontSize: "13px",
              textDecoration: "none",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.textDecoration = "underline")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.textDecoration = "none")
            }
          >
            {isLogin ? "Sign up" : "Sign in"}
          </button>
        </p>

        {/* Back to home */}
        <p
          style={{
            textAlign: "center",
            marginTop: "20px",
            fontSize: "13px",
          }}
        >
          <Link
            to="/"
            style={{
              color: "var(--text3)",
              textDecoration: "none",
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--text2)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--text3)")
            }
          >
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
