import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/sheet";
import { useApp } from "../../context/AppContext";
import { AI_INSIGHTS } from "../../data/mockData";
import { Sparkles, Send, ArrowRight } from "lucide-react";

const toneStyles = {
  danger: "bg-red-50 border-red-100 text-red-700",
  warning: "bg-amber-50 border-amber-100 text-amber-700",
  success: "bg-emerald-50 border-emerald-100 text-emerald-700",
  info: "bg-blue-50 border-blue-100 text-blue-700",
};

const SUGGESTIONS = [
  "Explain Vesper Docker overrun",
  "Which projects will exceed budget this month?",
  "Recommend cheaper model for Crowley Generation",
  "Forecast Q3 total spend",
];

const MOCK_ANSWERS = {
  default:
    "Based on the current portfolio, 3 of 8 projects are flagged. The biggest driver is Vesper Docker — actual $10.6k vs approved $13k, forecast $15.9k final. Moving heavy eval workloads from Opus 4.8 to Gemini 2.5 Pro could save an estimated 34% ($1.8k on remaining sprint). Would you like me to draft a top-up proposal?",
  vesper:
    "Vesper Docker is running 22% over. Root cause: Phase 2 Opus 4.8 inference volume 3.1× planned. Recommended action: (1) request $5k top-up now; (2) switch retry pipeline to Gemini 2.5 Pro; (3) cap max output tokens to 4k. Expected savings: $1.8k / sprint.",
  forecast:
    "Q3 portfolio forecast: $610k actual against $685k approved. Health score projected to rise from 58 → 71 if Vesper and Crowley Sourcing top-ups are approved in the next 5 days.",
};

const AiPanel = () => {
  const { aiOpen, setAiOpen } = useApp();
  const [messages, setMessages] = useState([
    { from: "ai", text: "Hi Vikram — I've reviewed today's portfolio. Ask me about any project, forecast, or expense." },
  ]);
  const [input, setInput] = useState("");

  const send = (q) => {
    const query = (q ?? input).trim();
    if (!query) return;
    const lower = query.toLowerCase();
    const answer =
      lower.includes("vesper") || lower.includes("overrun")
        ? MOCK_ANSWERS.vesper
        : lower.includes("forecast") || lower.includes("q3")
        ? MOCK_ANSWERS.forecast
        : MOCK_ANSWERS.default;
    setMessages((m) => [...m, { from: "user", text: query }, { from: "ai", text: answer }]);
    setInput("");
  };

  return (
    <Sheet open={aiOpen} onOpenChange={setAiOpen}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col" data-testid="ai-panel">
        <SheetHeader className="px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <SheetTitle className="font-display text-lg">AI Financial Assistant</SheetTitle>
              <p className="text-xs text-slate-500">Portfolio insights · powered by mock LLM</p>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Insights list */}
          <div className="space-y-2">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
              Today's insights
            </div>
            {AI_INSIGHTS.map((i) => (
              <div
                key={i.id}
                data-testid={`insight-${i.id}`}
                className={`p-4 rounded-xl border ${toneStyles[i.tone]} bg-white`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="font-semibold text-sm text-slate-900">{i.title}</div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${toneStyles[i.tone]} border`}>
                    {i.tag}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{i.body}</p>
              </div>
            ))}
          </div>

          {/* Chat */}
          <div className="space-y-3">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
              Conversation
            </div>
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    m.from === "user"
                      ? "bg-violet-600 text-white rounded-br-md"
                      : "bg-slate-100 text-slate-800 rounded-bl-md"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Input + suggestions */}
        <div className="border-t border-slate-100 p-4 bg-slate-50/60">
          <div className="flex flex-wrap gap-1.5 mb-3">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                data-testid={`ai-suggestion-${s.slice(0, 8).replace(/\s+/g, "-").toLowerCase()}`}
                onClick={() => send(s)}
                className="text-[11px] px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-600 hover:border-violet-300 hover:text-violet-700 transition-colors flex items-center gap-1"
              >
                {s}
                <ArrowRight className="w-3 h-3" />
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
            <input
              data-testid="ai-chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Ask about any project, expense, or forecast…"
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-slate-400"
            />
            <button
              data-testid="ai-chat-send"
              onClick={() => send()}
              className="w-8 h-8 rounded-lg bg-violet-600 hover:bg-violet-700 text-white flex items-center justify-center"
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
