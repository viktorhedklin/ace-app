import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';
import { InvokeChatWithHistory, hasAnyApiKey } from '@/api/claude';
import { cn } from '@/lib/utils';

export default function WorkflowChat({ title = 'Ask ACE', systemContext, suggestions = [], kbDomains, kbTags, kbCaseType }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  if (!hasAnyApiKey()) return null;

  async function send(text) {
    const q = (text || input).trim();
    if (!q || loading) return;
    setInput('');
    const newMsgs = [...msgs, { role: 'user', content: q }];
    setMsgs(newMsgs);
    setLoading(true);
    try {
      const sys = typeof systemContext === 'function' ? systemContext() : systemContext;
      const result = await InvokeChatWithHistory({ messages: newMsgs, system_prompt: sys, kbDomains, kbTags, kbCaseType });
      setMsgs(prev => [...prev, { role: 'assistant', content: result }]);
    } catch (err) {
      setMsgs(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    }
    setLoading(false);
  }

  return (
    <div className="bg-slate-900 border border-yellow-400/20 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-slate-800/50 transition-colors cursor-pointer"
        aria-label={open ? 'Collapse chat' : 'Expand chat'}
      >
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
          <MessageSquare size={13} className="text-yellow-400" />
          <span className="text-xs font-semibold text-yellow-400">{title}</span>
        </div>
        {open ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
      </button>

      {open && (
        <>
          <div className="max-h-64 overflow-y-auto p-3 space-y-2 border-t border-slate-800">
            {msgs.length === 0 && suggestions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-slate-600">Quick actions:</p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map(s => (
                    <button key={s} onClick={() => send(s)} className="text-xs bg-slate-800 border border-slate-700 hover:border-yellow-400/40 text-slate-400 hover:text-yellow-400 px-2.5 py-1 rounded-lg transition-all cursor-pointer">{s}</button>
                  ))}
                </div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={cn('text-xs rounded-lg px-3 py-2 max-w-[85%] whitespace-pre-wrap', m.role === 'user' ? 'bg-yellow-400/10 text-yellow-200 ml-auto' : 'bg-slate-800 text-slate-300')}>
                {m.content}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 size={12} className="animate-spin" /> Thinking...
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="border-t border-slate-800 px-3 py-2 flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Ask ACE anything about this workflow..."
              className="flex-1 bg-slate-800 border border-slate-700 focus:border-yellow-400/50 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-600 outline-none transition-colors"
            />
            <button onClick={() => send()} disabled={loading || !input.trim()} className="bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 text-slate-900 rounded-lg px-3 py-1.5 transition-colors cursor-pointer" aria-label="Send message">
              <Send size={13} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
