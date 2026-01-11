
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import { getCleaningTips } from '../services/geminiService';

const MINT_COLOR = '#76D7C4';

interface ChatBotProps {
  onBack: () => void;
}

const ChatBot: React.FC<ChatBotProps> = ({ onBack }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: '무엇을 도와드릴까요?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await getCleaningTips([...messages, userMsg]);
      setMessages(prev => [...prev, { role: 'model', text: response }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'model', text: '죄송합니다. 오류가 발생했습니다.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      <div className="p-4 border-b border-gray-50 flex items-center gap-4 bg-white sticky top-0 z-10 safe-top">
        <button onClick={onBack} className="p-2 text-gray-400">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h2 className="font-light text-md tracking-tight">청소 가이드</h2>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-4 py-2 text-sm leading-relaxed ${
              msg.role === 'user' 
                ? 'text-gray-800 font-light border-b border-gray-200' 
                : 'text-gray-500 font-light bg-gray-50 rounded-xl rounded-tl-none'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
             <div className="w-8 h-4 bg-gray-50 animate-pulse rounded"></div>
          </div>
        )}
      </div>

      <div className="p-6 bg-white safe-bottom">
        <div className="flex gap-2 border-t border-gray-50 pt-4">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="궁금한 것을 물어보세요"
            className="flex-1 border-none focus:ring-0 text-sm font-light"
          />
          <button 
            onClick={handleSend}
            disabled={isLoading}
            style={{ color: MINT_COLOR }}
            className="p-2 disabled:opacity-20"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatBot;
