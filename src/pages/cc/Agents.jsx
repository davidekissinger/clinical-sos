import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Bot, Send, ArrowLeft, Loader2, ShieldCheck, Search, Users, Target } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

const AGENTS = [
  {
    name: "regulatory_intelligence",
    label: "Regulatory Intelligence",
    description: "Discovers current, verifiable public regulatory signals for skilled nursing facilities.",
    icon: Search,
    color: "text-blue-600 bg-blue-50",
  },
  {
    name: "verification",
    label: "Verification",
    description: "Cross-checks regulatory claims against sources, assigns confidence, flags stale data.",
    icon: ShieldCheck,
    color: "text-emerald-600 bg-emerald-50",
  },
  {
    name: "contact_intelligence",
    label: "Contact Intelligence",
    description: "Identifies public business decision-makers with cited sources and confidence scores.",
    icon: Users,
    color: "text-purple-600 bg-purple-50",
  },
  {
    name: "opportunity",
    label: "Opportunity",
    description: "Combines intelligence to calculate explainable lead scores and recommend outreach.",
    icon: Target,
    color: "text-amber-600 bg-amber-50",
  },
];

function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[80%] rounded-2xl px-4 py-2.5", isUser ? "bg-primary text-primary-foreground" : "bg-white border border-border")}>
        {message.content && (
          isUser
            ? <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            : <div className="text-sm prose prose-sm max-w-none"><ReactMarkdown>{message.content}</ReactMarkdown></div>
        )}
        {message.tool_calls?.map((tc, i) => (
          <div key={i} className="mt-2 text-xs flex items-center gap-1.5 opacity-70">
            {tc.status === "running" || tc.status === "pending" || tc.status === "in_progress"
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : tc.status === "success" || tc.status === "completed"
                ? <ShieldCheck className="h-3 w-3 text-emerald-500" />
                : <span className="text-red-500">⚠</span>}
            <span>{tc.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Agents() {
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState([]);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (selectedAgent) {
      base44.agents.listConversations({ agent_name: selectedAgent }).then(setConversations).catch(() => {});
    }
  }, [selectedAgent]);

  useEffect(() => {
    if (conversation) {
      const unsub = base44.agents.subscribeToConversation(conversation.id, (data) => {
        setMessages(data.messages || []);
        setLoading(false);
      });
      return unsub;
    }
  }, [conversation]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const startConversation = () => {
    if (!selectedAgent) return;
    const conv = base44.agents.createConversation({
      agent_name: selectedAgent,
      metadata: { name: `Chat — ${new Date().toLocaleString()}` },
    });
    setConversation(conv);
    setMessages(conv.messages || []);
  };

  const openConversation = (conv) => {
    setConversation(conv);
    setMessages(conv.messages || []);
  };

  const sendMessage = async () => {
    if (!input.trim() || !conversation) return;
    const text = input.trim();
    setInput("");
    setLoading(true);
    await base44.agents.addMessage(conversation, { role: "user", content: text });
  };

  if (!selectedAgent) {
    return (
      <div>
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground">AI Agents</h2>
          <p className="text-sm text-muted-foreground mt-1">Specialized intelligence agents for regulatory discovery, verification, contact research, and opportunity scoring.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {AGENTS.map((a) => (
            <button
              key={a.name}
              onClick={() => { setSelectedAgent(a.name); startConversation(); }}
              className="text-left p-5 rounded-xl border border-border bg-white hover:border-primary hover:shadow-md transition group"
            >
              <div className={cn("inline-flex p-2.5 rounded-lg mb-3", a.color)}>
                <a.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-foreground group-hover:text-primary transition">{a.label}</h3>
              <p className="text-sm text-muted-foreground mt-1">{a.description}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const agent = AGENTS.find((a) => a.name === selectedAgent);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => { setSelectedAgent(null); setConversation(null); setMessages([]); }} className="btn-ghost">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className={cn("inline-flex p-2 rounded-lg", agent.color)}>
          <agent.icon className="h-4 w-4" />
        </div>
        <div>
          <h2 className="font-semibold text-foreground">{agent.label}</h2>
          <p className="text-xs text-muted-foreground">{agent.description}</p>
        </div>
      </div>

      {conversations.length > 1 && (
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
          {conversations.slice(0, 8).map((c) => (
            <button
              key={c.id}
              onClick={() => openConversation(c)}
              className={cn("text-xs px-3 py-1.5 rounded-full border whitespace-nowrap", conversation?.id === c.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}
            >
              {c.metadata?.name || "Conversation"}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-3 p-4 bg-secondary/30 rounded-xl border border-border">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-8">
            <Bot className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Start a conversation with the {agent.label} agent.
          </div>
        )}
        {messages.map((m, i) => <MessageBubble key={i} message={m} />)}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-border rounded-2xl px-4 py-2.5">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      <div className="mt-3 flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder={`Message the ${agent.label} agent…`}
          rows={1}
          className="flex-1 resize-none rounded-xl border border-border bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button onClick={sendMessage} disabled={!input.trim() || loading} className="btn-primary !rounded-xl px-4">
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}