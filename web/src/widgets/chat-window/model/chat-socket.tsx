"use client";

import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { chatKeys, type ChatEvent, type MessagePage } from "@/entities/conversation";

const CLOSE_UNAUTHORIZED = 4401;
const CLOSE_FORBIDDEN_ORIGIN = 4403;
const PING_MS = 25_000;
const TYPING_SHOWN_MS = 4_000;

type ChatSocket = {
  /** Есть живое соединение; без него окна чата опрашивают REST */
  connected: boolean;
  sendTyping: (conversationId: string) => void;
  isTyping: (conversationId: string) => boolean;
};

const ChatSocketContext = createContext<ChatSocket>({
  connected: false,
  sendTyping: () => {},
  isTyping: () => false,
});

export const useChatSocket = () => useContext(ChatSocketContext);

function socketUrl() {
  // В проде /api/v1/ws на домене сайта проксирует веб-сервер; в разработке —
  // прямо на FastAPI (NEXT_PUBLIC_WS_URL), rewrites Next WebSocket не проксируют
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  const scheme = window.location.protocol === "https:" ? "wss" : "ws";
  return `${scheme}://${window.location.host}/api/v1/ws`;
}

/**
 * Одно соединение на страницу чата. Сокет только сообщает о событиях —
 * данные кладём в кэш TanStack Query или перезапрашиваем по REST.
 */
export function ChatSocketProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const socket = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [typing, setTyping] = useState<Record<string, number>>({});

  useEffect(() => {
    let closedByUs = false;
    let retry = 0;
    let reconnect: ReturnType<typeof setTimeout> | undefined;
    let ping: ReturnType<typeof setInterval> | undefined;

    const onEvent = (event: ChatEvent) => {
      if (event.type === "message.new") {
        const { message } = event;
        queryClient.setQueryData<InfiniteData<MessagePage>>(
          chatKeys.messages(message.conversation_id),
          (data) => {
            if (!data || data.pages.some((p) => p.items.some((m) => m.id === message.id)))
              return data;
            const [first, ...rest] = data.pages;
            // Страницы — от новых к старым: новое сообщение в начало первой
            return { ...data, pages: [{ ...first, items: [message, ...first.items] }, ...rest] };
          },
        );
        setTyping((t) => ({ ...t, [message.conversation_id]: 0 }));
        queryClient.invalidateQueries({ queryKey: chatKeys.conversations, exact: true });
      } else if (event.type === "message.read") {
        queryClient.invalidateQueries({ queryKey: chatKeys.conversations, exact: true });
      } else if (event.type === "typing") {
        setTyping((t) => ({ ...t, [event.conversation_id]: Date.now() }));
      }
    };

    const connect = () => {
      const ws = new WebSocket(socketUrl());
      socket.current = ws;
      ws.onopen = () => {
        retry = 0;
        setConnected(true);
        // После обрыва догружаем пропущенное по REST
        queryClient.invalidateQueries({ queryKey: chatKeys.conversations });
        ping = setInterval(() => ws.send(JSON.stringify({ type: "ping" })), PING_MS);
      };
      ws.onmessage = (message) => {
        try {
          onEvent(JSON.parse(message.data) as ChatEvent);
        } catch {
          // битое событие — пропускаем, данные всё равно придут по REST
        }
      };
      ws.onclose = (close) => {
        setConnected(false);
        clearInterval(ping);
        if (closedByUs) return;
        // Сессии нет или Origin не из списка — переподключение не поможет, работаем на опросе
        if (close.code === CLOSE_UNAUTHORIZED || close.code === CLOSE_FORBIDDEN_ORIGIN) return;
        retry += 1;
        reconnect = setTimeout(connect, Math.min(1000 * 2 ** retry, 30_000));
      };
    };

    connect();
    return () => {
      closedByUs = true;
      clearTimeout(reconnect);
      clearInterval(ping);
      socket.current?.close();
    };
  }, [queryClient]);

  const sendTyping = useCallback((conversationId: string) => {
    if (socket.current?.readyState === WebSocket.OPEN) {
      socket.current.send(JSON.stringify({ type: "typing", conversation_id: conversationId }));
    }
  }, []);

  const isTyping = useCallback(
    (conversationId: string) => Date.now() - (typing[conversationId] ?? 0) < TYPING_SHOWN_MS,
    [typing],
  );

  return (
    <ChatSocketContext value={{ connected, sendTyping, isTyping }}>{children}</ChatSocketContext>
  );
}
