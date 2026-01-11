
import React, { useState, useRef, useEffect } from 'react';
import { getCleaningTips } from '../services/geminiService';
import { ChatMessage } from '../types';

const MINT_COLOR = '#76D7C4';

interface ChatBotProps {
  onBack: () => void;
}

const ChatBot: React.FC<ChatBotProps> = ({ onBack }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: '안녕하세요! 청소 요정 요래입니다. 어떤 곳을 깨끗하게 만들고 싶으신가요? 청소 팁이 필요하면 무엇이든 물어보세요! ✨' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 새로운 메시지가 추가되거나 로딩 상태가 변할 때 하단으로 자동 스크롤합니다.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const responseText = await getCleaningTips(input);
      if (responseText) {
        setMessages(prev => [...prev, { role: 'model', text: responseText }]);
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { role: 'model', text: '죄송해요, 잠시 통신이 원활하지 않네요! 다시 한 번 말씀해 주시겠어요?' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-white z-[60] flex flex-col max-w-md mx-auto animate-in slide-in-from-bottom duration-300">
      {/* 상단 헤더 */}
      <div className="px-6 py-5 border-b flex items-center bg-white sticky top-0 z-10 safe-top">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors mr-2">
          <svg className="w-6 h-6 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-xl font-black text-gray-900 tracking-tight">청소 전문가 요래</h2>
      </div>

      {/* 메시지 목록 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#FAFAFA]">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div 
              className={`max-w-[85%] p-4 rounded-3xl shadow-sm text-sm font-bold leading-relaxed ${
                msg.role === 'user' 
                  ? 'bg-gray-900 text-white rounded-tr-none' 
                  : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white p-4 rounded-3xl rounded-tl-none border border-gray-100 shadow-sm">
              <div className="flex space-x-1.5 items-center h-4">
                <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce [animation-delay:0.4s]"></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 입력창 */}
      <div className="p-4 border-t bg-white safe-bottom mb-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="청소 팁을 물어보세요..."
            className="flex-1 p-4 bg-gray-100 rounded-2xl text-sm font-black focus:outline-none focus:ring-2 focus:ring-teal-100 transition-all placeholder:text-gray-400"
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            style={{ backgroundColor: MINT_COLOR }}
            className="w-12 h-12 flex items-center justify-center rounded-2xl text-white shadow-lg active:scale-90 disabled:opacity-40 transition-all"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatBot;
