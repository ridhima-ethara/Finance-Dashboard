import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/sheet";
import { useApp } from "../../context/AppContext";
import { AI_INSIGHTS } from "../../data/mockData";
import { summarizeLoggedProject } from "../../lib/projectMetrics";
import { Sparkles, Send, ArrowRight } from "lucide-react";

const toneStyles = {
  danger: "bg-red-500/10 border-red-500/20 text-red-400",
  warning: "bg-amber-500/10 border-amber-500/20 text-amber-400",
  success: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
  info: "bg-sky-500/10 border-sky-500/20 text-sky-400",
};

const SUGGESTIONS = [
  "Summarize current portfolio risk",
  "Which approvals are still pending?",
  "Show projects trending over budget",
  "Forecast current spend trajectory",
];

const AiPanel = () => {
  const { aiOpen, setAiOpen, projects, budgetReviews, topupRequests, changeRequests, taskLogs, user } = useApp();
  const snapshot = useMemo(() => {
    const usageRows = projects.map((project) => ({
      project,
      usage: summarizeLoggedProject(project, taskLogs),
    }));
    const flaggedProjects = usageRows.filter(({ project, usage }) =>
      Math.max(Number(project.utilization || 0), Number(usage.utilization || 0)) >= 90
    );
    const pendingBudgetReviews = budgetReviews.filter((review) =>
      !["approved", "partial", "rejected", "rejected-by-cto", "returned", "returned-to-tpm"].includes(review.status)
    );
    const pendingTopups = topupRequests.filter((request) =>
      !["approved", "partial", "rejected"].includes(request.status)
    );
    const pendingChanges = changeRequests.filter((request) =>
      !["approved", "partial", "rejected", "returned"].includes(request.status)
    );

    return {
      approvedBudget: usageRows.reduce((sum, { project }) => sum + Number(project.approvedBudget || 0), 0),
      loggedSpend: usageRows.reduce((sum, { usage }) => sum + Number(usage.loggedSpend || 0), 0),
      flaggedProjects,
      pendingApprovals: pendingBudgetReviews.length + pendingTopups.length + pendingChanges.length,
    };
  }, [projects, budgetReviews, topupRequests, changeRequests, taskLogs]);

  const answers = useMemo(() => {
    if (!projects.length) {
      return {
        default:
          "No live projects or approval activity are loaded yet. Create a project or submit a budget to start generating portfolio insights.",
        overrun:
          "No budget overruns are recorded yet. Once budgets and task logs are added, I can surface watch-list projects automatically.",
        forecast:
          "Forecasting will populate after project budgets and task logs are available. Right now the workspace is empty.",
      };
    }

    const flaggedCount = snapshot.flaggedProjects.length;
    const flaggedNames = snapshot.flaggedProjects.slice(0, 3).map(({ project }) => project.name).join(", ");

    return {
      default:
        `There are ${projects.length} active projects, ${flaggedCount} ${flaggedCount === 1 ? "project" : "projects"} on the watch list, and ${snapshot.pendingApprovals} pending approval items. Ask me to break down any project, approval queue, or spend trend.`,
      overrun:
        flaggedCount > 0
          ? `${flaggedCount} ${flaggedCount === 1 ? "project is" : "projects are"} currently trending above plan or into the watch range. Current focus: ${flaggedNames}.`
          : "No projects are currently flagged for overrun. Logged spend remains within the approved budget ranges.",
      forecast:
        `Current approved budget is $${snapshot.approvedBudget.toLocaleString()} with $${snapshot.loggedSpend.toLocaleString()} logged so far. ${snapshot.pendingApprovals} approval items are still in flight and may change the forward forecast.`,
    };
  }, [projects, snapshot]);

  const [messages, setMessages] = useState([
    { from: "ai", text: `Hi ${user?.name?.split(" ")[0] || "there"} — I’ve reviewed the current workspace. Ask me about budgets, approvals, or project spend.` },
  ]);
  const [input, setInput] = useState("");

  const send = (q) => {
    const query = (q ?? input).trim();
    if (!query) return;
    const lower = query.toLowerCase();
    const answer =
      lower.includes("overrun") || lower.includes("risk") || lower.includes("flag")
        ? answers.overrun
        : lower.includes("forecast") || lower.includes("spend") || lower.includes("approval")
        ? answers.forecast
        : answers.default;
    setMessages((m) => [...m, { from: "user", text: query }, { from: "ai", text: answer }]);
    setInput("");
  };

  return (
    <Sheet open={aiOpen} onOpenChange={setAiOpen}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col" data-testid="ai-panel">
        <SheetHeader className="px-6 py-5 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-fuchsia-500 to-pink-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <SheetTitle className="font-display text-lg">AI Financial Assistant</SheetTitle>
              <p className="text-xs text-zinc-500">Workspace insights and approval guidance</p>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="space-y-2">
            <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">
              Today's insights
            </div>
            {AI_INSIGHTS.length ? (
              AI_INSIGHTS.map((i) => (
                <div
                  key={i.id}
                  data-testid={`insight-${i.id}`}
                  className={`p-4 rounded-xl border ${toneStyles[i.tone]} bg-[#12121A]`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="font-semibold text-sm text-white">{i.title}</div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${toneStyles[i.tone]} border`}>
                      {i.tag}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">{i.body}</p>
                </div>
              ))
            ) : (
              <div className="p-4 rounded-xl border border-dashed border-white/10 bg-[#12121A] text-xs text-zinc-500">
                Live AI insights will appear here after budgets, approvals, and task logs are added.
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">
              Conversation
            </div>
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.from === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    message.from === "user"
                      ? "bg-fuchsia-500 text-white rounded-br-md"
                      : "bg-white/10 text-zinc-100 rounded-bl-md"
                  }`}
                >
                  {message.text}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-white/5 p-4 bg-white/5">
          <div className="flex flex-wrap gap-1.5 mb-3">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                data-testid={`ai-suggestion-${suggestion.slice(0, 8).replace(/\s+/g, "-").toLowerCase()}`}
                onClick={() => send(suggestion)}
                className="text-[11px] px-2.5 py-1 rounded-full bg-[#12121A] border border-white/10 text-zinc-400 hover:border-fuchsia-500/40 hover:text-fuchsia-400 transition-colors flex items-center gap-1"
              >
                {suggestion}
                <ArrowRight className="w-3 h-3" />
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 bg-[#12121A] border border-white/10 rounded-xl px-3 py-2">
            <input
              data-testid="ai-chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Ask about any project, expense, or forecast…"
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-zinc-500"
            />
            <button
              data-testid="ai-chat-send"
              onClick={() => send()}
              className="w-8 h-8 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white flex items-center justify-center"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AiPanel;
