import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot,
  Send,
  User,
  Anchor,
  Zap,
  TrendingUp,
  Fuel,
  Map,
  FileText,
  ChevronDown,
  AlertTriangle,
  Lightbulb,
  MessageSquare,
  Ship,
  Plus,
  Trash2,
  Clock,
} from 'lucide-react'
import { copilotAPI, vesselsAPI } from '../services/api'
import { ChatMessage, Vessel } from '../types'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ConversationMeta {
  id: string
  title: string
  created_at: string
  message_count: number
}

const SUGGESTED_PROMPTS = [
  { icon: <Fuel className="w-4 h-4" />,       label: 'Why did fuel consumption increase?',      prompt: 'Why did fuel consumption increase on the last voyage?' },
  { icon: <TrendingUp className="w-4 h-4" />,  label: 'How can I save fuel?',                   prompt: 'What are the best strategies to reduce fuel consumption for this vessel?' },
  { icon: <Map className="w-4 h-4" />,         label: 'What route is recommended?',             prompt: 'What is the optimal route recommendation considering current weather conditions?' },
  { icon: <Ship className="w-4 h-4" />,        label: 'Analyze vessel performance',             prompt: 'Provide a comprehensive analysis of the current vessel performance.' },
  { icon: <FileText className="w-4 h-4" />,    label: 'Show open claims summary',               prompt: 'Summarize all open charter party claims and their financial impact.' },
]

// ── Markdown renderer (simple) ────────────────────────────────────────────────

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n')
  return lines.map((line, i) => {
    // Bold **text**
    const bold = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic *text*
    const italic = bold.replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Headings
    if (italic.startsWith('###')) return <h4 key={i} className="text-white font-semibold text-sm mt-2 mb-1" dangerouslySetInnerHTML={{ __html: italic.replace(/^###\s*/, '') }} />
    if (italic.startsWith('##')) return <h3 key={i} className="text-white font-semibold text-sm mt-3 mb-1" dangerouslySetInnerHTML={{ __html: italic.replace(/^##\s*/, '') }} />
    // List items
    if (italic.startsWith('- ') || italic.startsWith('* ')) return <li key={i} className="text-white/80 text-sm ml-3 list-disc" dangerouslySetInnerHTML={{ __html: italic.slice(2) }} />
    // Numbered list
    if (/^\d+\. /.test(italic)) return <li key={i} className="text-white/80 text-sm ml-3 list-decimal" dangerouslySetInnerHTML={{ __html: italic.replace(/^\d+\. /, '') }} />
    // Empty line
    if (italic.trim() === '') return <div key={i} className="h-1" />
    return <p key={i} className="text-white/80 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: italic }} />
  })
}

// ── TypingIndicator ────────────────────────────────────────────────────────────

const TypingIndicator: React.FC = () => (
  <div className="flex items-end gap-3">
    <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center flex-shrink-0">
      <Bot className="w-4 h-4 text-white" />
    </div>
    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl rounded-bl-sm px-4 py-3">
      <div className="flex gap-1.5 items-center h-5">
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-teal-400"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
    </div>
  </div>
)

// ── MessageBubble ─────────────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: ChatMessage
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user'
  const recommendations = (message as unknown as { recommendations?: Array<{ id: string; title: string; description: string; estimated_savings?: number }> }).recommendations
  const warnings = (message as unknown as { warnings?: string[] }).warnings

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-end gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isUser ? 'bg-ocean-500' : 'bg-teal-500'}`}>
        {isUser ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
      </div>

      <div className={`max-w-[75%] space-y-2 ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        {/* Message bubble */}
        <div className={`px-4 py-3 rounded-2xl ${isUser ? 'bg-teal-600/80 border border-teal-500/30 rounded-br-sm' : 'bg-white/5 backdrop-blur-md border border-white/10 rounded-bl-sm'}`}>
          {isUser ? (
            <p className="text-white text-sm leading-relaxed">{message.content}</p>
          ) : (
            <div className="space-y-1">{renderMarkdown(message.content)}</div>
          )}
        </div>

        {/* Timestamp */}
        <p className="text-white/25 text-xs px-1">
          {format(new Date(message.timestamp), 'HH:mm')}
        </p>

        {/* Warnings */}
        {warnings && warnings.length > 0 && (
          <div className="w-full space-y-2">
            {warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 bg-warning-500/10 border border-warning-500/30 rounded-xl px-3 py-2.5">
                <AlertTriangle className="w-4 h-4 text-warning-400 flex-shrink-0 mt-0.5" />
                <p className="text-warning-300 text-xs leading-relaxed">{w}</p>
              </div>
            ))}
          </div>
        )}

        {/* Recommendations */}
        {recommendations && recommendations.length > 0 && (
          <div className="w-full space-y-2">
            {recommendations.map(rec => (
              <div key={rec.id} className="bg-teal-500/5 border border-teal-500/20 rounded-xl p-3">
                <div className="flex items-start gap-2">
                  <Lightbulb className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-teal-300 text-xs font-semibold">{rec.title}</p>
                    <p className="text-white/60 text-xs mt-0.5 leading-relaxed">{rec.description}</p>
                    {rec.estimated_savings && (
                      <p className="text-success-400 text-xs font-medium mt-1">
                        Est. savings: ${rec.estimated_savings.toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AICopilotPage() {
  const [messages, setMessages]               = useState<ChatMessage[]>([])
  const [input, setInput]                     = useState('')
  const [loading, setLoading]                 = useState(false)
  const [vessels, setVessels]                 = useState<Vessel[]>([])
  const [selectedVessel, setSelectedVessel]   = useState<string>('')
  const [conversations, setConversations]     = useState<ConversationMeta[]>([])
  const [conversationId, setConversationId]   = useState<string | undefined>()
  const [showSidebar, setShowSidebar]         = useState(true)
  const messagesEndRef                        = useRef<HTMLDivElement>(null)
  const textareaRef                           = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetchVessels()
    fetchConversations()
    // Initial greeting
    const greeting: ChatMessage = {
      id: 'greeting',
      conversation_id: '',
      role: 'assistant',
      content: `**Welcome to VoyageIQ AI Copilot!**\n\nI'm your AI-powered maritime operations assistant. I can help you with:\n\n- **Performance Analysis** – Speed, fuel, and efficiency insights\n- **Charter Party Claims** – Detection and dispute support\n- **Route Optimization** – Weather-aware routing\n- **Compliance Monitoring** – MARPOL, CII, and reporting\n\nSelect a vessel above to give me context, then ask me anything!`,
      timestamp: new Date().toISOString(),
    }
    setMessages([greeting])
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const fetchVessels = async () => {
    try {
      const res = await vesselsAPI.list()
      setVessels(res.data?.vessels ?? res.data ?? [])
    } catch { /* the vessel picker stays empty; chat still works */ }
  }

  const fetchConversations = async () => {
    try {
      const res = await copilotAPI.getConversations()
      setConversations(res.data?.conversations ?? [])
    } catch { /* history is optional */ }
  }

  const autoResize = () => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'
  }

  const sendMessage = useCallback(async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || loading) return

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      conversation_id: conversationId ?? '',
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setLoading(true)

    try {
      const res = await copilotAPI.chat(content, conversationId, selectedVessel || undefined)
      const data = res.data
      if (data.conversation_id) setConversationId(data.conversation_id)

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        conversation_id: data.conversation_id ?? '',
        role: 'assistant',
        content: data.response ?? data.message ?? 'I processed your request.',
        timestamp: new Date().toISOString(),
        ...(data.recommendations ? { recommendations: data.recommendations } : {}),
        ...(data.warnings ? { warnings: data.warnings } : {}),
      } as ChatMessage
      setMessages(prev => [...prev, aiMsg])
    } catch {
      const failed: ChatMessage = {
        id: (Date.now() + 1).toString(),
        conversation_id: conversationId ?? '',
        role: 'assistant',
        content: 'The assistant could not be reached, so this question was not answered. Try again in a moment.',
        timestamp: new Date().toISOString(),
      } as ChatMessage
      setMessages(prev => [...prev, failed])
    } finally {
      setLoading(false)
    }
  }, [input, loading, conversationId, selectedVessel])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const startNewConversation = () => {
    setConversationId(undefined)
    setMessages([])
    const greeting: ChatMessage = {
      id: 'greeting-' + Date.now(),
      conversation_id: '',
      role: 'assistant',
      content: '**New conversation started.** How can I help you?',
      timestamp: new Date().toISOString(),
    }
    setMessages([greeting])
  }

  const activeVessel = vessels.find(v => v.id === selectedVessel)

  return (
    <div className="h-[calc(100dvh-8.5rem)] lg:h-[calc(100dvh-7rem)] min-h-[28rem] bg-surface-1 border border-line rounded-panel flex overflow-hidden">
      {/* ── Sidebar: Conversations ── */}
      <AnimatePresence>
        {showSidebar && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="flex-shrink-0 border-r border-white/10 bg-navy-900/50 backdrop-blur-md flex flex-col overflow-hidden"
          >
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-white font-semibold text-sm font-display flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-teal-400" /> Conversations
                </h2>
                <button onClick={startNewConversation} className="w-7 h-7 bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/30 text-teal-400 rounded-lg flex items-center justify-center transition-[color,background-color,border-color,opacity,transform]">
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {conversations.length === 0 ? (
                <div className="text-center py-8 text-white/25">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No conversations yet</p>
                </div>
              ) : (
                conversations.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => setConversationId(conv.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl transition-[color,background-color,border-color,opacity,transform] ${conv.id === conversationId ? 'bg-teal-500/20 border border-teal-500/30' : 'hover:bg-white/5 border border-transparent'}`}
                  >
                    <p className={`text-xs font-medium truncate ${conv.id === conversationId ? 'text-teal-300' : 'text-white/70'}`}>{conv.title}</p>
                    <p className="text-white/30 text-xs mt-0.5 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {format(new Date(conv.created_at), 'MMM d, HH:mm')}
                    </p>
                  </button>
                ))
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── Main Chat Area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-white/10 bg-navy-900/30 backdrop-blur-md px-6 py-4">
          <div className="flex items-center gap-4 flex-wrap">
            <button onClick={() => setShowSidebar(s => !s)} className="w-8 h-8 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg flex items-center justify-center text-white/50 transition-[color,background-color,border-color,opacity,transform]">
              <MessageSquare className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-teal-500 flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-white font-bold font-display text-lg">Maritime AI Copilot</h1>
                  <motion.div
                    className="w-2 h-2 rounded-full bg-success-400"
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </div>
                <p className="text-white/40 text-xs">Powered by VoyageIQ Intelligence Engine</p>
              </div>
            </div>

            {/* Vessel selector */}
            <div className="ml-auto flex items-center gap-3">
              <div className="relative">
                <Ship className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                <select
                  value={selectedVessel}
                  onChange={e => setSelectedVessel(e.target.value)}
                  className="bg-white/5 border border-white/10 text-white text-sm pl-8 pr-8 py-2 rounded-xl focus:outline-none focus:border-teal-500/50 appearance-none min-w-48"
                >
                  <option value="">No vessel context</option>
                  {vessels.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Context chips */}
          {activeVessel && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="px-2.5 py-1 bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs rounded-full flex items-center gap-1.5">
                <Anchor className="w-3 h-3" /> {activeVessel.type}
              </span>
              <span className="px-2.5 py-1 bg-ocean-500/10 border border-ocean-500/20 text-ocean-400 text-xs rounded-full">
                IMO {activeVessel.imo}
              </span>
              <span className="px-2.5 py-1 bg-white/5 border border-white/10 text-white/50 text-xs rounded-full">
                Health: {activeVessel.health_score}/100
              </span>
              {activeVessel.active_voyage && (
                <span className="px-2.5 py-1 bg-success-500/10 border border-success-500/20 text-success-400 text-xs rounded-full flex items-center gap-1.5">
                  <Zap className="w-3 h-3" /> {activeVessel.active_voyage}
                </span>
              )}
            </motion.div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {messages.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-8">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-teal-500/20 border border-teal-500/20 flex items-center justify-center mb-4">
                  <Bot className="w-8 h-8 text-teal-400" />
                </div>
                <h2 className="text-white font-bold font-display text-xl mb-2">How can I help?</h2>
                <p className="text-white/40 text-sm">Ask me anything about maritime operations</p>
              </div>

              {/* Suggested prompts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full max-w-2xl">
                {SUGGESTED_PROMPTS.map(p => (
                  <button
                    key={p.prompt}
                    onClick={() => sendMessage(p.prompt)}
                    className="flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-teal-500/30 text-white/70 hover:text-white text-sm px-4 py-3 rounded-xl transition-[color,background-color,border-color,opacity,transform] text-left"
                  >
                    <span className="text-teal-400 flex-shrink-0">{p.icon}</span>
                    <span className="text-xs">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <AnimatePresence initial={false}>
                {messages.map(msg => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
              </AnimatePresence>
              {loading && <TypingIndicator />}
            </>
          )}

          {/* Suggested prompts bar (when there are messages) */}
          {messages.length > 0 && !loading && (
            <div className="flex gap-2 flex-wrap pt-2">
              {SUGGESTED_PROMPTS.slice(0, 3).map(p => (
                <button
                  key={p.prompt}
                  onClick={() => sendMessage(p.prompt)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-teal-500/30 text-white/50 hover:text-teal-400 text-xs rounded-full transition-[color,background-color,border-color,opacity,transform]"
                >
                  <span className="opacity-70">{p.icon}</span>
                  {p.label}
                </button>
              ))}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="flex-shrink-0 border-t border-white/10 bg-navy-900/30 backdrop-blur-md p-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-end gap-3 bg-white/5 border border-white/10 hover:border-teal-500/30 focus-within:border-teal-500/50 rounded-2xl p-3 transition-[color,background-color,border-color,opacity,transform]">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => { setInput(e.target.value); autoResize() }}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about vessel performance, routes, claims…"
                rows={1}
                className="flex-1 bg-transparent text-white text-sm resize-none focus:outline-none placeholder-white/25 leading-relaxed min-h-[24px] max-h-40"
                style={{ height: 'auto' }}
              />
              <div className="flex items-center gap-2 flex-shrink-0">
                {input.trim() && (
                  <button onClick={() => { setInput(''); if (textareaRef.current) textareaRef.current.style.height = 'auto' }} className="w-8 h-8 text-white/30 hover:text-white/60 flex items-center justify-center rounded-lg transition-[color,background-color,border-color,opacity,transform]">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || loading}
                  className="w-9 h-9 bg-teal-500 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl flex items-center justify-center text-white transition-[color,background-color,border-color,opacity,transform]"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
            <p className="text-white/20 text-xs text-center mt-2">
              Press Enter to send · Shift+Enter for new line · AI may make errors – verify critical data
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
