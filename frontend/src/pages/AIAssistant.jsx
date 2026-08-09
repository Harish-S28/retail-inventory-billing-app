import { useState, useRef, useEffect } from 'react';
import client from '../api/client';
import Layout from '../components/Layout';

const SUGGESTIONS = [
  "What were today's sales?",
  'Which product sold the most this month?',
  "What's my profit this month?",
  "What's running low on stock?",
  "What's nearing expiry?",
];

export default function AIAssistant() {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: "Hi, I'm your shop assistant. Ask me about today's sales, top products, low stock, or profit — I'll answer from your own data." },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function send(question) {
    if (!question.trim()) return;
    setMessages((prev) => [...prev, { role: 'user', text: question }]);
    setInput('');
    setLoading(true);
    try {
      const { data } = await client.post('/ai/ask', { question });
      setMessages((prev) => [...prev, { role: 'assistant', text: data.answer, source: data.source }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', text: 'Sorry, something went wrong answering that.' }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <h1 className="font-[var(--font-display)] text-2xl font-semibold mb-1">AI Assistant</h1>
      <p className="text-sm text-[var(--color-text-muted)] mb-6">Ask business questions in plain language — grounded in your shop's real data.</p>

      <div className="ledger-card rounded-b-md flex flex-col h-[60vh] max-w-2xl">
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] text-sm px-4 py-2.5 rounded-lg ${m.role === 'user' ? 'text-white' : ''}`}
                style={m.role === 'user' ? { background: 'var(--color-ink)' } : { background: 'var(--color-paper)', border: '1px solid var(--color-rule)' }}
              >
                {m.text}
                {m.role === 'assistant' && m.source && (
                  <div className="text-[10px] mt-1 opacity-50">{m.source === 'grok' ? 'via Grok' : 'built-in answer'}</div>
                )}
              </div>
            </div>
          ))}
          {loading && <div className="text-xs text-[var(--color-text-muted)]">Thinking…</div>}
          <div ref={endRef} />
        </div>

        <div className="border-t border-[var(--color-rule)] p-3">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)} className="text-xs px-2.5 py-1 rounded-full border border-[var(--color-rule)] text-[var(--color-text-muted)] hover:bg-[var(--color-paper)]">
                {s}
              </button>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2">
            <input
              value={input} onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about sales, profit, stock…"
              className="flex-1 border border-[var(--color-rule)] rounded px-3 py-2 text-sm"
            />
            <button type="submit" disabled={loading} className="text-white text-sm font-medium px-4 py-2 rounded disabled:opacity-50" style={{ background: 'var(--color-ink)' }}>
              Ask
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
