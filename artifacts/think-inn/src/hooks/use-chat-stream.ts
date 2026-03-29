import { useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  isStreaming?: boolean;
  progressLabel?: string;
  savedItems?: Array<{ type: "research" | "idea"; id: number; title: string }>;
}

export function useChatStream(conversationId: number | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || !conversationId) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content };
    const assistantMsgId = (Date.now() + 1).toString();

    setMessages(prev => [
      ...prev,
      userMsg,
      { id: assistantMsgId, role: "assistant", content: "", isStreaming: true, savedItems: [] },
    ]);

    setIsTyping(true);
    setError(null);

    try {
      const res = await fetch(`/api/gemini/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) throw new Error("Failed to send message");
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullResponse = "";
      const savedItems: ChatMessage["savedItems"] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const dataStr = line.slice(6);
          if (!dataStr.trim()) continue;

          try {
            const data = JSON.parse(dataStr);

            if (data.done) {
              // Stream complete
              setMessages(prev => prev.map(m =>
                m.id === assistantMsgId
                  ? { ...m, isStreaming: false, progressLabel: undefined, savedItems }
                  : m
              ));
            } else if (data.progress) {
              // Tool is running — show progress label in the streaming bubble
              setMessages(prev => prev.map(m =>
                m.id === assistantMsgId ? { ...m, progressLabel: data.progress } : m
              ));
            } else if (data.action === "research_saved") {
              // Research was saved by AI — force immediate refetch
              queryClient.invalidateQueries({ queryKey: ["/api/research"] });
              queryClient.refetchQueries({ queryKey: ["/api/research"] });
              savedItems.push({ type: "research", id: data.data.id, title: data.data.title });
              setMessages(prev => prev.map(m =>
                m.id === assistantMsgId ? { ...m, savedItems: [...(m.savedItems || []), { type: "research" as const, id: data.data.id, title: data.data.title }] } : m
              ));
            } else if (data.action === "idea_saved") {
              // Idea was saved by AI — force immediate refetch
              queryClient.invalidateQueries({ queryKey: ["/api/ideas"] });
              queryClient.refetchQueries({ queryKey: ["/api/ideas"] });
              savedItems.push({ type: "idea", id: data.data.id, title: data.data.title });
              setMessages(prev => prev.map(m =>
                m.id === assistantMsgId ? { ...m, savedItems: [...(m.savedItems || []), { type: "idea" as const, id: data.data.id, title: data.data.title }] } : m
              ));
            } else if (data.content) {
              fullResponse += data.content;
              setMessages(prev => prev.map(m =>
                m.id === assistantMsgId ? { ...m, content: fullResponse } : m
              ));
            } else if (data.error) {
              console.warn("SSE error:", data.error);
            }
          } catch (e) {
            console.warn("Error parsing SSE chunk:", e, dataStr);
          }
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      console.error(err);
      setError("Bağlantı hatası oluştu. Lütfen tekrar deneyin.");
      setMessages(prev => prev.map(m =>
        m.id === assistantMsgId
          ? { ...m, content: "⚠️ İletişim koptu.", isStreaming: false }
          : m
      ));
    } finally {
      setIsTyping(false);
    }
  }, [conversationId, queryClient]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    sendMessage,
    isTyping,
    error,
    clearMessages,
    setMessages,
  };
}
