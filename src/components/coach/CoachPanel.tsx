import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import { Send, Square, Swords, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Encounter } from "@/data/encounters";

const QUICK = (e: Encounter) => [
  `Why would my team wipe here? Give the top 3 causes and fixes.`,
  `Give me exact Auto AI presets for a team on ${e.name}.`,
  `Which champion should I gear 1st, 2nd, 3rd for this stage, and what stats?`,
  `I'm missing a key champion — suggest substitutes from my roster notes.`,
];

function storageKey(id: string) {
  return `rsl-coach:${id}`;
}

export function CoachPanel({ encounter, roster }: { encounter: Encounter; roster: string }) {
  const [initial, setInitial] = useState<UIMessage[] | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(encounter.id));
      setInitial(raw ? (JSON.parse(raw) as UIMessage[]) : []);
    } catch {
      setInitial([]);
    }
  }, [encounter.id]);

  if (!initial) return <div className="p-6 text-sm text-muted-foreground">Loading coach…</div>;
  return <CoachChat key={encounter.id} encounter={encounter} roster={roster} initial={initial} />;
}

function CoachChat({ encounter, roster, initial }: { encounter: Encounter; roster: string; initial: UIMessage[] }) {
  const [input, setInput] = useState("");
  const rosterRef = useRef(roster);
  rosterRef.current = roster;
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, stop, error, setMessages } = useChat({
    id: encounter.id,
    messages: initial,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages }) => ({
        body: { messages, stageId: encounter.id, roster: rosterRef.current },
      }),
    }),
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (status === "ready") localStorage.setItem(storageKey(encounter.id), JSON.stringify(messages));
    endRef.current?.scrollIntoView({ block: "end" });
    if (status === "ready") inputRef.current?.focus();
  }, [messages, status, encounter.id]);

  const send = (text: string) => {
    if (!text.trim() || busy) return;
    sendMessage({ text });
    setInput("");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Swords className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-sm tracking-wide text-primary">Tactical Coach</div>
          <div className="truncate text-xs text-muted-foreground">Synced to {encounter.name}</div>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Clear conversation"
            onClick={() => {
              setMessages([]);
              localStorage.removeItem(storageKey(encounter.id));
            }}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Ask anything about this stage, or start with:</p>
            {QUICK(encounter).map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className="block w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-left text-sm hover:border-primary"
              >
                {q}
              </button>
            ))}
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
            {m.role === "user" ? (
              <div className="max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
                {m.parts.map((p, i) => (p.type === "text" ? <span key={i}>{p.text}</span> : null))}
              </div>
            ) : (
              <div className="space-y-2">
                {m.parts.map((p, i) =>
                  p.type === "reasoning" && p.text ? (
                    <details key={i} className="text-xs text-muted-foreground">
                      <summary className="cursor-pointer">Coach's reasoning</summary>
                      <div className="mt-1 whitespace-pre-wrap">{p.text}</div>
                    </details>
                  ) : p.type === "text" ? (
                    <div key={i} className="coach-md text-sm leading-relaxed">
                      <ReactMarkdown>{p.text}</ReactMarkdown>
                    </div>
                  ) : null,
                )}
              </div>
            )}
          </div>
        ))}
        {status === "submitted" && <div className="animate-pulse text-sm text-muted-foreground">Coach is analyzing the stage…</div>}
        {error && <div className="rounded-md border border-destructive/50 p-3 text-sm text-destructive">{error.message}</div>}
        <div ref={endRef} />
      </div>

      <form
        className="border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <div className="flex items-end gap-2 rounded-lg border border-input bg-secondary/40 p-2 focus-within:border-primary">
          <textarea
            ref={inputRef}
            autoFocus
            value={input}
            rows={2}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder='e.g. "My team wiped on wave 2 — what happened?"'
            className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {busy ? (
            <Button type="button" size="icon" variant="secondary" onClick={() => stop()} aria-label="Stop">
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="submit" size="icon" aria-label="Send" disabled={!input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
