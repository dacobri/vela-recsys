import { useEffect, useRef, useState } from "react";
import { LuMessagesSquare, LuSend, LuSparkles } from "react-icons/lu";

import {
  PageHeader,
  UserPicker,
  MoviePosterCard,
} from "@/components/vela";
import {
  chat,
  ChatMessage,
  VelaMovie,
} from "@/services/velaApi";
import { accentButton, inputBase, pageWrapper } from "@/styles";
import { cn } from "@/utils/helper";

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
  movies?: VelaMovie[];
}

const SUGGESTIONS = [
  "Something cosy for a rainy Sunday",
  "Mind-bending sci-fi I haven't seen",
  "A feel-good film under two hours",
  "Surprise me with a hidden gem",
];

const Chat = () => {
  const [userId, setUserId] = useState<number | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [turns, sending]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || sending || userId == null) return;

    const history: ChatMessage[] = turns.map((t) => ({
      role: t.role,
      content: t.content,
    }));

    setTurns((prev) => [...prev, { role: "user", content: message }]);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const res = await chat(userId, message, history);
      setTurns((prev) => [
        ...prev,
        { role: "assistant", content: res.reply, movies: res.movies },
      ]);
    } catch (err: any) {
      setError(
        err?.message ??
          "Could not reach the Vela backend. Is the chat endpoint running?"
      );
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  const disabled = userId == null;

  return (
    <div className={`${pageWrapper} flex flex-col`}>
      <PageHeader
        icon={LuMessagesSquare}
        title="Chat"
        subtitle="Tell Vela what you're in the mood for. It blends your taste with the catalog and explains its picks — conversationally."
      >
        <div className="flex flex-col gap-1">
          <span className="text-[12.5px] font-medium uppercase tracking-wide text-muted">
            Chatting as
          </span>
          <UserPicker value={userId} onChange={setUserId} />
        </div>
      </PageHeader>

      <div className="surface-panel flex min-h-[520px] flex-1 flex-col overflow-hidden p-0">
        {/* message list */}
        <div
          ref={scrollRef}
          className="scrollbar-thin flex-1 overflow-y-auto p-5 sm:p-6"
        >
          {turns.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-5 py-10 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-surface-2 text-[24px] text-accent">
                <LuSparkles />
              </span>
              <div>
                <h3 className="text-[17px] font-semibold text-primary">
                  What are you in the mood for?
                </h3>
                <p className="mx-auto mt-1 max-w-[420px] text-[14px] text-muted">
                  {disabled
                    ? "Pick a user above to start the conversation."
                    : "Ask in plain language — try one of these to begin."}
                </p>
              </div>
              {!disabled && (
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void send(s)}
                      className="vela-chip rounded-full px-4 py-2 text-[13px] text-muted"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {turns.map((turn, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex",
                    turn.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] sm:max-w-[78%]",
                      turn.role === "user" ? "items-end" : "items-start"
                    )}
                  >
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-3 text-[14.5px] leading-relaxed",
                        turn.role === "user"
                          ? "rounded-br-md bg-accent text-accent-text"
                          : "rounded-bl-md border border-border bg-surface-2 text-primary"
                      )}
                    >
                      {turn.content}
                    </div>

                    {turn.movies && turn.movies.length > 0 && (
                      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                        {turn.movies.map((movie) => (
                          <MoviePosterCard key={movie.id} movie={movie} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {sending && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-border bg-surface-2 px-4 py-3">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-accent [animation-delay:-0.3s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-accent [animation-delay:-0.15s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-accent" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <p className="border-t border-border bg-surface px-5 py-2 text-[13px] text-danger">
            {error}
          </p>
        )}

        {/* composer */}
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-3 border-t border-border bg-surface p-4"
        >
          <input
            type="text"
            value={input}
            disabled={disabled || sending}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              disabled ? "Select a user to start chatting…" : "Message Vela…"
            }
            className={cn(inputBase, "flex-1 disabled:opacity-60")}
          />
          <button
            type="submit"
            disabled={disabled || sending || !input.trim()}
            aria-label="Send message"
            className={cn(accentButton, "px-4")}
          >
            <LuSend />
          </button>
        </form>
      </div>
    </div>
  );
};

export default Chat;
