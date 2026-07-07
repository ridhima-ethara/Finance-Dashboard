import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { USERS } from "../data/mockData";
import { Button } from "../components/ui/button";
import { ArrowRight, Lock, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const roleAccent = {
  CTO: { border: "border-fuchsia-500/40", text: "text-fuchsia-300", dot: "bg-fuchsia-400", glow: "hover:shadow-[0_0_24px_rgba(232,25,184,0.35)]" },
  CFO: { border: "border-emerald-500/40", text: "text-emerald-300", dot: "bg-emerald-400", glow: "hover:shadow-[0_0_24px_rgba(16,185,129,0.35)]" },
  TPM: { border: "border-sky-500/40", text: "text-sky-300", dot: "bg-sky-400", glow: "hover:shadow-[0_0_24px_rgba(56,189,248,0.35)]" },
  PL: { border: "border-amber-500/40", text: "text-amber-300", dot: "bg-amber-400", glow: "hover:shadow-[0_0_24px_rgba(245,158,11,0.35)]" },
};

const roleLabel = {
  CTO: "Chief Technology Officer",
  CFO: "Chief Financial Officer",
  TPM: "Technical Program Manager",
  PL: "Project Lead",
};

// Ethara.AI logo — provided by user
const EtharaMask = ({ className = "" }) => (
  <img
    src="https://customer-assets.emergentagent.com/job_35b8a911-7e5b-47f4-877d-0c3c5c9e0d0c/artifacts/scrxjjww_image%20%281%29.png"
    alt="Ethara.AI"
    className={`${className} object-contain drop-shadow-[0_0_30px_rgba(232,25,184,0.35)]`}
  />
);

// Diagonal + grid backdrop
const Backdrop = () => (
  <>
    {/* Grid */}
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage:
          "linear-gradient(to right, rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.035) 1px, transparent 1px)",
        backgroundSize: "56px 56px",
      }}
    />
    {/* Diagonal lines */}
    <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 1200 900">
      <g stroke="rgba(255,255,255,0.045)" strokeWidth="1">
        <line x1="180" y1="0" x2="600" y2="900" />
        <line x1="1020" y1="0" x2="600" y2="900" />
        <line x1="0" y1="200" x2="1200" y2="700" />
      </g>
      <g stroke="rgba(255,255,255,0.03)" strokeWidth="1">
        <line x1="0" y1="0" x2="1200" y2="900" />
        <line x1="1200" y1="0" x2="0" y2="900" />
      </g>
    </svg>
    {/* Glow */}
    <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full bg-fuchsia-500/[0.08] blur-[130px] pointer-events-none" />
  </>
);

const Login = () => {
  const { isAuth, login } = useApp();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showCreds, setShowCreds] = useState(false);
  const [busy, setBusy] = useState(false);

  if (isAuth) return <Navigate to="/" replace />;

  const doLogin = (opts) => {
    setBusy(true);
    const r = login(opts);
    setBusy(false);
    if (r.ok) {
      toast.success(`Welcome, ${r.user.name}`, { description: `Signed in as ${r.user.role}` });
      nav("/", { replace: true });
    } else {
      toast.error(r.message || "Login failed");
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] relative overflow-hidden" data-testid="page-login">
      <Backdrop />

      <div className="relative min-h-screen flex flex-col items-center justify-center px-6 py-10">
        {/* Wordmark banner — mask + Ethara.AI side by side */}
        <div className="flex items-center gap-6 sm:gap-10">
          <EtharaMask className="w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 flex-shrink-0" />
          <div className="flex flex-col leading-none">
            <div className="font-display font-bold tracking-tight text-white text-6xl sm:text-7xl md:text-8xl leading-none">
              Ethara<span className="text-fuchsia-500">.AI</span>
            </div>
            <div className="mt-3 sm:mt-4 flex items-center gap-2">
              <span className="w-8 h-px bg-fuchsia-500" />
              <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.24em] text-fuchsia-400">
                Financial Command Center
              </span>
              <span className="w-8 h-px bg-fuchsia-500" />
            </div>
          </div>
        </div>

        {/* Quick logins */}
        <div className="mt-12 sm:mt-16 w-full max-w-3xl">
          <div className="text-center mb-5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500 flex items-center justify-center gap-2">
              <ShieldCheck className="w-3 h-3" />
              Sign in — choose your role
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {USERS.map((u) => {
              const a = roleAccent[u.role];
              return (
                <button
                  key={u.id}
                  data-testid={`quick-login-${u.role.toLowerCase()}`}
                  onClick={() => doLogin({ role: u.role })}
                  className={`text-left p-4 rounded-2xl border ${a.border} bg-[#12121A]/60 backdrop-blur-sm hover:bg-[#12121A]/90 transition-all group ${a.glow}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${a.dot}`} />
                    <span className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${a.text}`}>{u.role}</span>
                    <ArrowRight className="w-3 h-3 text-zinc-500 ml-auto group-hover:text-white transition-colors" />
                  </div>
                  <div className="mt-3 text-sm font-semibold text-white truncate">{u.name}</div>
                  <div className="text-[11px] text-zinc-500 truncate">{roleLabel[u.role]}</div>
                </button>
              );
            })}
          </div>

          {/* Email/password toggle */}
          <div className="mt-6 flex flex-col items-center gap-3">
            {!showCreds ? (
              <button
                onClick={() => setShowCreds(true)}
                data-testid="toggle-creds"
                className="text-xs text-zinc-500 hover:text-fuchsia-300 transition-colors flex items-center gap-1.5"
              >
                <Lock className="w-3 h-3" />
                Sign in with email &amp; password
              </button>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  doLogin({ email, password });
                }}
                className="w-full max-w-md space-y-3 p-4 rounded-2xl border border-white/10 bg-[#12121A]/60"
              >
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    data-testid="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="cto@ethara.ai"
                    className="w-full h-10 pl-9 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                  />
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    data-testid="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="demo123"
                    className="w-full h-10 pl-9 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={busy}
                  data-testid="login-submit"
                  className="w-full h-10 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white shadow-[0_0_20px_rgba(232,25,184,0.35)] gap-2"
                >
                  Sign in
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </form>
            )}
          </div>

          <p className="mt-6 text-center text-[11px] text-zinc-600">
            Demo mode · quick-login bypasses password. Session stored in your browser.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
