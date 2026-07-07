import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { USERS } from "../data/mockData";
import { Button } from "../components/ui/button";
import { Sparkles, ArrowRight, Lock, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const roleAccent = {
  CTO: { bg: "from-fuchsia-500/20 to-pink-500/10", border: "border-fuchsia-500/30", text: "text-fuchsia-300", dot: "bg-fuchsia-400" },
  CFO: { bg: "from-emerald-500/20 to-teal-500/10", border: "border-emerald-500/30", text: "text-emerald-300", dot: "bg-emerald-400" },
  TPM: { bg: "from-sky-500/20 to-blue-500/10", border: "border-sky-500/30", text: "text-sky-300", dot: "bg-sky-400" },
  PL: { bg: "from-amber-500/20 to-orange-500/10", border: "border-amber-500/30", text: "text-amber-300", dot: "bg-amber-400" },
};

const roleLabel = {
  CTO: "Chief Technology Officer",
  CFO: "Chief Financial Officer",
  TPM: "Technical Program Manager",
  PL: "Project Lead",
};

const Login = () => {
  const { isAuth, login } = useApp();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (isAuth) return <Navigate to="/" replace />;

  const doLogin = (opts) => {
    setBusy(true);
    const r = login(opts);
    setBusy(false);
    if (r.ok) {
      toast.success(`Welcome back, ${r.user.name}`, { description: `Signed in as ${r.user.role}` });
      nav("/", { replace: true });
    } else {
      toast.error(r.message || "Login failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#08080C] mesh-dots p-6" data-testid="page-login">
      {/* Glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-fuchsia-500/10 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-pink-500/10 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left · brand narrative */}
        <div className="hidden lg:flex flex-col justify-between p-8 rounded-2xl border border-white/5 bg-gradient-to-br from-[#12121A] to-[#0B0B12]">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-fuchsia-500 to-pink-600 flex items-center justify-center shadow-[0_0_24px_rgba(232,25,184,0.4)]">
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 3 v18 M3 12 h18" opacity="0.5" />
              </svg>
            </div>
            <span className="font-display font-semibold text-lg text-white">
              Ethara<span className="text-fuchsia-400">.AI</span>
            </span>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-fuchsia-400 font-semibold flex items-center gap-2">
              <span className="w-6 h-px bg-fuchsia-400" />
              Financial Command Center
            </div>
            <h1 className="mt-3 font-display font-semibold text-4xl tracking-tight text-white leading-tight">
              AGI is not born.<br />
              <span className="text-zinc-500">Budgets are earned.</span>
            </h1>
            <p className="mt-4 text-sm text-zinc-400 leading-relaxed max-w-md">
              Sign in to view the portfolio you're responsible for. Every action — request, approval, key rotation —
              is date-stamped and traceable.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { l: "Projects", v: "8" },
              { l: "Approved", v: "$197k" },
              { l: "At risk", v: "$41.8k" },
            ].map((m) => (
              <div key={m.l} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{m.l}</div>
                <div className="mt-1 font-display font-semibold text-lg tabular text-white">{m.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right · form */}
        <div className="rounded-2xl border border-white/5 bg-[#12121A] p-7">
          <div className="lg:hidden mb-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-fuchsia-500 to-pink-600" />
            <span className="font-display font-semibold text-white">
              Ethara<span className="text-fuchsia-400">.AI</span>
            </span>
          </div>

          <div className="text-[10px] uppercase tracking-[0.18em] text-fuchsia-400 font-semibold flex items-center gap-2">
            <ShieldCheck className="w-3 h-3" />
            Secure sign-in
          </div>
          <h2 className="mt-2 font-display font-semibold text-2xl text-white">Welcome back</h2>
          <p className="text-sm text-zinc-500 mt-1">Sign in with your Ethara.AI credentials.</p>

          {/* Email / password */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              doLogin({ email, password });
            }}
            className="mt-5 space-y-3"
          >
            <div>
              <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">Email</div>
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
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">Password</div>
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

          {/* Divider */}
          <div className="mt-6 mb-4 flex items-center gap-3">
            <div className="flex-1 h-px bg-white/5" />
            <span className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">Quick login (demo)</span>
            <div className="flex-1 h-px bg-white/5" />
          </div>

          {/* Quick login */}
          <div className="grid grid-cols-2 gap-2.5">
            {USERS.map((u) => {
              const a = roleAccent[u.role];
              return (
                <button
                  key={u.id}
                  data-testid={`quick-login-${u.role.toLowerCase()}`}
                  onClick={() => doLogin({ role: u.role })}
                  className={`text-left p-3 rounded-xl border ${a.border} bg-gradient-to-br ${a.bg} hover:brightness-125 transition-all group`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${a.dot}`} />
                    <span className={`text-[10px] font-semibold uppercase tracking-widest ${a.text}`}>{u.role}</span>
                    <ArrowRight className="w-3 h-3 text-zinc-500 ml-auto group-hover:text-white transition-colors" />
                  </div>
                  <div className="mt-2 text-sm font-semibold text-white truncate">{u.name}</div>
                  <div className="text-[11px] text-zinc-500 truncate">{roleLabel[u.role]}</div>
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex items-start gap-2 text-[11px] text-zinc-500 border-t border-white/5 pt-4">
            <Sparkles className="w-3 h-3 text-fuchsia-400 mt-0.5 flex-shrink-0" />
            <span>Demo mode · quick-login bypasses passwords. In production, hook this up to Emergent Google Auth or JWT.</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
