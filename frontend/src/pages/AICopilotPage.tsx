import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, SendHorizontal } from 'lucide-react'
import { Badge, Button, PageHeader, Select } from '../components/kit'
import { copilotAPI, vesselsAPI } from '../services/api'
import { useApi } from '../lib/useApi'
import { shortDate } from '../lib/format'

interface Msg {
  id: string
  role: 'user' | 'assistant'
  content: string
  failed?: boolean
  meta?: { ai_used?: boolean; model?: string; recommendations?: unknown[]; warnings?: unknown[] }
}

const SUGGESTIONS = [
  'Why did fuel consumption change on the last voyage?',
  'How is this vessel performing against its warranted figures?',
  'Summarise the open claims and what drives them.',
  'Where am I losing the most fuel to weather?',
]

/** Inline formatting without innerHTML: **bold** and `code` become React elements, everything else stays text. */
function inline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g).filter(Boolean).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="font-semibold text-fg">{part.slice(2, -2)}</strong>
    if (part.length > 2 && part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) return <em key={i}>{part.slice(1, -1)}</em>
    if (part.startsWith('`') && part.endsWith('`')) return <code key={i} className="font-mono text-[12px] bg-fg/10 rounded px-1">{part.slice(1, -1)}</code>
    return <React.Fragment key={i}>{part}</React.Fragment>
  })
}

/** Model output is untrusted text. It is rendered as elements, never as HTML. */
function Markdown({ text }: { text: string }) {
  const out: React.ReactNode[] = []
  let bullets: string[] = []
  const flush = (key: string) => {
    if (bullets.length) { out.push(<ul key={key} className="list-disc pl-5 space-y-1">{bullets.map((b, i) => <li key={i}>{inline(b)}</li>)}</ul>); bullets = [] }
  }
  text.split('\n').forEach((line, i) => {
    const m = line.match(/^\s*[-*•]\s+(.*)$/)
    if (m) { bullets.push(m[1]); return }
    flush(`ul-${i}`)
    if (line.trim()) out.push(<p key={i}>{inline(line)}</p>)
  })
  flush('ul-end')
  return <div className="space-y-2 text-body text-fg-muted [&_strong]:text-fg">{out}</div>
}

const asText = (x: unknown) => (typeof x === 'string' ? x : x && typeof x === 'object' ? [(x as any).title, (x as any).description ?? (x as any).detail].filter(Boolean).join(': ') : '')

function Bubble({ m }: { m: Msg }) {
  if (m.role === 'user') {
    return <div className="flex justify-end"><div className="max-w-[85%] rounded-panel bg-accent/10 border border-accent/25 px-3.5 py-2.5 text-body text-fg whitespace-pre-wrap break-words">{m.content}</div></div>
  }
  const recs = (m.meta?.recommendations ?? []).map(asText).filter(Boolean)
  const warns = (m.meta?.warnings ?? []).map(asText).filter(Boolean)
  return (
    <div className="max-w-[92%] space-y-2.5">
      {m.failed ? <p role="alert" className="text-body text-signal-port">{m.content}</p> : <Markdown text={m.content} />}
      {warns.length > 0 && <ul className="space-y-1">{warns.map((w, i) => <li key={i} className="text-label text-signal-caution border-l-2 border-signal-caution/50 pl-2.5">{w}</li>)}</ul>}
      {recs.length > 0 && <ul className="space-y-1">{recs.map((r, i) => <li key={i} className="text-label text-fg-muted border-l-2 border-line-strong pl-2.5">{r}</li>)}</ul>}
      {m.meta && !m.failed && <p className="text-meta normal-case tracking-normal text-fg-subtle">{m.meta.ai_used ? `Answered by ${m.meta.model}` : 'Answered by the built-in rule engine, not a language model'}</p>}
    </div>
  )
}

export default function AICopilotPage() {
  const vessels = useApi<any[]>(() => vesselsAPI.list().then(r => r.data?.vessels ?? r.data ?? []), [])
  const history = useApi<any[]>(() => copilotAPI.getConversations().then(r => r.data?.conversations ?? []), [])

  const [messages, setMessages] = useState<Msg[]>([])
  const [conversationId, setConversationId] = useState<string | undefined>()
  const [vesselId, setVesselId] = useState('')
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [messages, busy])

  const send = useCallback(async (text: string) => {
    const content = text.trim()
    if (!content || busy) return
    setInput('')
    setMessages(m => [...m, { id: `u${Date.now()}`, role: 'user', content }])
    setBusy(true)
    try {
      const res = await copilotAPI.chat(content, conversationId, vesselId || undefined)
      const d = res.data
      if (d.conversation_id && d.conversation_id !== conversationId) { setConversationId(d.conversation_id); history.reload() }
      setMessages(m => [...m, { id: d.message_id ?? `a${Date.now()}`, role: 'assistant', content: d.response ?? '', meta: d.metadata }])
    } catch (err: any) {
      const limited = err?.response?.status === 429
      setMessages(m => [...m, { id: `e${Date.now()}`, role: 'assistant', failed: true, content: limited ? 'You are sending messages too quickly. Wait a moment and try again.' : 'The assistant could not be reached, so this question was not answered. Try again.' }])
    } finally { setBusy(false) }
  }, [busy, conversationId, vesselId, history])

  const openConversation = async (id: string) => {
    if (!id) { setConversationId(undefined); setMessages([]); return }
    try {
      const res = await copilotAPI.getConversation(id)
      setConversationId(id)
      setVesselId(res.data?.conversation?.vessel_id ?? '')
      setMessages((res.data?.messages ?? []).map((m: any) => ({ id: m.id, role: m.role, content: m.content, meta: m.metadata })))
    } catch { setMessages([{ id: 'x', role: 'assistant', failed: true, content: 'Could not open that conversation.' }]) }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) }
  }

  return (
    <>
      <PageHeader title="AI Copilot" description="Ask about performance, fuel, weather and claims. Answers draw on the vessel and voyage you select." />

      <div className="bg-surface-1 border border-line rounded-panel flex flex-col lg:flex-row h-[calc(100dvh-14rem)] lg:h-[calc(100dvh-12rem)] min-h-[26rem] overflow-hidden">
        {/* Conversations: a sidebar on large screens, a menu above the chat on small ones. */}
        <aside aria-label="Conversation history" className="hidden lg:flex w-64 shrink-0 flex-col border-r border-line">
          <div className="flex items-center justify-between px-3 h-11 border-b border-line">
            <h2 className="text-body font-semibold text-fg">History</h2>
            <Button size="sm" variant="ghost" icon={<Plus size={14} />} onClick={() => openConversation('')}>New</Button>
          </div>
          <ul className="flex-1 overflow-y-auto p-1.5">
            {(history.data ?? []).length === 0 && <li className="px-3 py-4 text-label text-fg-subtle">No saved conversations.</li>}
            {(history.data ?? []).map(c => (
              <li key={c.id}>
                <button onClick={() => openConversation(c.id)} aria-current={c.id === conversationId}
                  className={`w-full text-left rounded-ctl px-3 py-2 transition-colors duration-[120ms] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${c.id === conversationId ? 'bg-accent/10' : '[@media(hover:hover)]:hover:bg-fg/5'}`}>
                  <p className="text-body text-fg truncate">{c.last_message ?? 'Empty conversation'}</p>
                  <p className="text-label text-fg-subtle">{c.vessel_name ?? 'No vessel'} · {shortDate(c.last_message_at ?? c.created_at)}</p>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-line">
            <Select aria-label="Vessel context" value={vesselId} onChange={e => setVesselId(e.target.value)} className="h-8 w-full sm:w-56">
              <option value="">No vessel context</option>
              {(vessels.data ?? []).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </Select>
            <Select aria-label="Conversation" value={conversationId ?? ''} onChange={e => openConversation(e.target.value)} className="h-8 w-full sm:w-56 lg:hidden">
              <option value="">New conversation</option>
              {(history.data ?? []).map(c => <option key={c.id} value={c.id}>{(c.last_message ?? 'Conversation').slice(0, 40)}</option>)}
            </Select>
            <Button size="sm" variant="ghost" className="lg:hidden" onClick={() => openConversation('')}>New</Button>
            {vesselId === '' && <Badge tone="neutral">General answers only</Badge>}
          </div>

          <div role="log" aria-live="polite" aria-label="Conversation" className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
            {messages.length === 0 && (
              <div className="max-w-xl">
                <p className="text-body text-fg">Ask a question about your fleet.</p>
                <p className="text-body text-fg-muted mt-1">Select a vessel above for answers based on its noon reports. Without one, answers are general.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {SUGGESTIONS.map(s => (
                    <button key={s} onClick={() => send(s)} className="text-left text-label text-fg-muted border border-line-strong rounded-ctl px-3 py-2 transition-[border-color,color,transform] duration-[140ms] active:scale-[0.98] [@media(hover:hover)]:hover:border-fg-subtle [@media(hover:hover)]:hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">{s}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map(m => <Bubble key={m.id} m={m} />)}
            {busy && <p className="text-body text-fg-subtle" role="status">Working on it…</p>}
            <div ref={end} />
          </div>

          <form onSubmit={e => { e.preventDefault(); send(input) }} className="border-t border-line p-3 flex items-end gap-2">
            <label htmlFor="copilot-input" className="sr-only">Your question</label>
            <textarea
              id="copilot-input" value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKeyDown} rows={2} maxLength={4000}
              placeholder="Ask about performance, fuel, claims…  (Enter to send, Shift+Enter for a new line)"
              className="flex-1 resize-none rounded-ctl bg-base border border-line-strong px-3 py-2 text-body text-fg placeholder:text-fg-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
            />
            <Button type="submit" variant="primary" disabled={!input.trim() || busy} aria-label="Send" className="h-10 w-10 !px-0"><SendHorizontal size={16} /></Button>
          </form>
        </div>
      </div>
      <p className="mt-3 text-label text-fg-subtle">Answers can be wrong. Check figures that matter against the reports before acting on them.</p>
    </>
  )
}
