import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Send } from 'lucide-react';
import { useDmStore } from '@/stores/dm';
import { useBobsStore } from '@/stores/bobs';
import { BobStatusIndicator } from '@/components/bob/BobStatusIndicator';
import { cn } from '@/lib/utils';

const EMPTY_SESSIONS: never[] = [];
const EMPTY_MESSAGES: never[] = [];

export function ChatPanel() {
  const { agentId, sessionId } = useParams<{ agentId: string; sessionId: string }>();
  const navigate = useNavigate();
  const bobs = useBobsStore(s => s.bobs);
  const fetchBobs = useBobsStore(s => s.fetch);
  const sessionsMap = useDmStore(s => s.sessions);
  const messagesMap = useDmStore(s => s.messages);
  const sessions = agentId ? (sessionsMap[agentId] ?? EMPTY_SESSIONS) : EMPTY_SESSIONS;
  const messages = sessionId ? (messagesMap[sessionId] ?? EMPTY_MESSAGES) : EMPTY_MESSAGES;
  const fetchSessions = useDmStore(s => s.fetchSessions);
  const fetchMessages = useDmStore(s => s.fetchMessages);
  const sendMessage = useDmStore(s => s.sendMessage);
  const createSession = useDmStore(s => s.createSession);
  const loadingMessages = useDmStore(s => s.loadingMessages);

  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fetchedRef = useRef<string | null>(null);

  const agent = bobs.find(b => b.id === agentId);
  const session = sessions.find(s => s.id === sessionId);

  useEffect(() => {
    fetchBobs();
  }, [fetchBobs]);

  useEffect(() => {
    if (agentId) fetchSessions(agentId);
  }, [agentId, fetchSessions]);

  useEffect(() => {
    if (sessionId && fetchedRef.current !== sessionId) {
      fetchedRef.current = sessionId;
      fetchMessages(sessionId);
    }
  }, [sessionId, fetchMessages]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const autoGrow = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const lineHeight = parseInt(getComputedStyle(el).lineHeight, 10) || 20;
    const maxHeight = lineHeight * 5 + 16;
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px';
  }, []);

  async function handleSend() {
    if (!sessionId || !content.trim() || sending) return;
    const text = content.trim();
    setContent('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setSending(true);
    try {
      await sendMessage(sessionId, text);
    } finally {
      setSending(false);
    }
  }

  async function handleNewSession() {
    if (!agentId) return;
    const s = await createSession(agentId);
    navigate(`/messages/${agentId}/${s.id}`);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function formatTime(isoDate: string): string {
    return new Date(isoDate).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b bg-background px-6 py-3 flex items-center gap-3">
        {agent && (
          <>
            <BobStatusIndicator status={agent.status} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{agent.name}</p>
              {session && (
                <p className="text-xs text-muted-foreground truncate">{session.title}</p>
              )}
            </div>
          </>
        )}
        <button
          onClick={handleNewSession}
          className="flex items-center gap-1.5 shrink-0 text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
        >
          <Plus className="size-3.5" />
          New Session
        </button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3"
      >
        {loadingMessages && messages.length === 0 && (
          <p className="text-sm text-muted-foreground text-center mt-8">Loading…</p>
        )}
        {!loadingMessages && messages.length === 0 && (
          <p className="text-sm text-muted-foreground text-center mt-8">No messages yet. Say hello!</p>
        )}
        {messages.map(msg => {
          const isHuman = msg.author === 'human';
          const isSystem = msg.author === 'system';
          if (isSystem) {
            return (
              <div key={msg.id} className="flex justify-center">
                <span className="text-xs text-muted-foreground italic">{msg.content}</span>
              </div>
            );
          }
          return (
            <div
              key={msg.id}
              className={cn('flex flex-col gap-0.5', isHuman ? 'items-end' : 'items-start')}
            >
              <div
                className={cn(
                  'px-4 py-2.5 max-w-[75%] text-sm leading-relaxed',
                  isHuman
                    ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-sm'
                    : 'bg-muted rounded-2xl rounded-bl-sm'
                )}
              >
                {msg.content}
              </div>
              <span className="text-xs text-muted-foreground px-1">
                {formatTime(msg.created_at)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t bg-background p-4">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => {
              setContent(e.target.value);
              autoGrow();
            }}
            onInput={autoGrow}
            onKeyDown={handleKeyDown}
            placeholder="Message…"
            rows={1}
            disabled={sending}
            className={cn(
              'flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm',
              'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring',
              'disabled:opacity-50 overflow-hidden leading-relaxed'
            )}
            style={{ minHeight: '38px' }}
          />
          <button
            onClick={handleSend}
            disabled={!content.trim() || sending}
            className={cn(
              'flex items-center justify-center size-9 rounded-xl shrink-0 transition-colors',
              'bg-primary text-primary-foreground hover:bg-primary/90',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            aria-label="Send message"
          >
            <Send className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
