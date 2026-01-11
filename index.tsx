import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";

// --- Types & Constants ---
const MINT_COLOR = '#76D7C4';

enum AppStep {
  HOME = 'HOME',
  BEFORE_CAPTURE = 'BEFORE_CAPTURE',
  CLEANING = 'CLEANING',
  AFTER_CAPTURE = 'AFTER_CAPTURE',
  RESULT = 'RESULT',
  CHAT = 'CHAT'
}

interface SessionData {
  beforeImage: string | null;
  afterImage: string | null;
  startTime: number | null;
  endTime: number | null;
  mergedImage: string | null;
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

// --- Image Utils ---
const resizeImage = (base64Str: string, maxWidth: number = 1080): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      } else resolve(base64Str);
    };
    img.onerror = () => resolve(base64Str);
  });
};

const mergeImages = async (before: string, after: string, duration: number): Promise<string> => {
  const load = (src: string): Promise<HTMLImageElement> => new Promise((res, rej) => {
    const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = rej; i.src = src;
  });

  try {
    const [imgB, imgA] = await Promise.all([load(before), load(after)]);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // 레이아웃: 세로 배치
    const targetW = 1080;
    const scaleB = targetW / imgB.width;
    const scaleA = targetW / imgA.width;
    const hB = imgB.height * scaleB;
    const hA = imgA.height * scaleA;

    canvas.width = targetW;
    canvas.height = hB + hA;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imgB, 0, 0, targetW, hB);
    ctx.drawImage(imgA, 0, hB, targetW, hA);

    // 하단 정보 캡슐
    const fontSize = 42;
    const now = new Date();
    const dateStr = now.toLocaleDateString('ko-KR').replace(/ /g, '');
    const footerText = `${dateStr} | ${duration}분 소요 | 요래됐슴당 ✨`;
    
    ctx.font = `bold ${fontSize}px sans-serif`;
    const textW = ctx.measureText(footerText).width;
    const pX = 60, pY = 30;
    const bW = textW + pX * 2, bH = fontSize + pY * 2;
    const bX = (canvas.width - bW) / 2, bY = canvas.height - bH - 60;

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.beginPath();
    ctx.roundRect?.(bX, bY, bW, bH, bH / 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(footerText, bX + bW / 2, bY + bH / 2 + 2);

    return canvas.toDataURL('image/jpeg', 0.9);
  } catch { return ''; }
};

// --- Gemini Service ---
const askGemini = async (history: ChatMessage[]): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: history.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
      config: { systemInstruction: "당신은 청소 전문가 '요래됐슴당' 가이드입니다. 짧고 명쾌하게 한국어로 조언하세요." }
    });
    return response.text || "답변을 드릴 수 없네요.";
  } catch { return "연결이 원활하지 않습니다."; }
};

// --- Components ---

const CameraView: React.FC<{ 
  mode: 'before' | 'after', 
  onCapture: (img: string) => void, 
  onBack: () => void,
  ghost?: string | null 
}> = ({ mode, onCapture, onBack, ghost }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [ghostActive, setGhostActive] = useState(true);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(s => { setStream(s); if (videoRef.current) videoRef.current.srcObject = s; })
      .catch(() => alert("카메라 권한이 필요합니다."));
    return () => stream?.getTracks().forEach(t => t.stop());
  }, []);

  const handleCapture = () => {
    const v = videoRef.current;
    if (!v) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d')?.drawImage(v, 0, 0);
    onCapture(c.toDataURL('image/jpeg', 0.9));
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-10 safe-top">
        <button onClick={onBack} className="text-white bg-black/40 p-3 rounded-full backdrop-blur-md">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="text-white font-black bg-black/40 px-5 py-2 rounded-full text-xs">{mode === 'before' ? '청소 전' : '청소 후'}</div>
        <div className="w-12"></div>
      </div>
      <div className="flex-1 relative bg-black overflow-hidden flex items-center justify-center">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        {mode === 'after' && ghost && ghostActive && (
          <img src={ghost} className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-screen pointer-events-none" />
        )}
      </div>
      <div className="h-40 flex justify-center items-center bg-black gap-12 safe-bottom">
        {mode === 'after' && (
          <button onClick={() => setGhostActive(!ghostActive)} className={`text-white p-3 rounded-xl border ${ghostActive ? 'bg-white/20 border-white/50' : 'bg-transparent border-white/10 opacity-30'}`}>
            <span className="text-[10px] font-bold">GHOST</span>
          </button>
        )}
        <button onClick={handleCapture} className="w-20 h-20 bg-white rounded-full p-1 shadow-2xl">
          <div className="w-full h-full border-4 border-black/5 rounded-full" />
        </button>
        {mode === 'after' && <div className="w-12" />}
      </div>
    </div>
  );
};

const ChatBot: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [msgs, setMsgs] = useState<ChatMessage[]>([{ role: 'model', text: '무엇이든 물어보세요!' }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [msgs]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const uMsg: ChatMessage = { role: 'user', text: input };
    setMsgs(p => [...p, uMsg]); setInput(''); setLoading(true);
    const res = await askGemini([...msgs, uMsg]);
    setMsgs(p => [...p, { role: 'model', text: res }]); setLoading(false);
  };

  return (
    <div className="flex-1 flex flex-col bg-white">
      <div className="p-4 border-b flex items-center gap-3 safe-top">
        <button onClick={onBack} className="p-1"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth="2" /></svg></button>
        <h2 className="font-bold">요래 가이드</h2>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`px-4 py-2 rounded-2xl text-sm max-w-[80%] ${m.role === 'user' ? 'bg-[#76D7C4] text-white' : 'bg-gray-100 text-gray-700'}`}>{m.text}</div>
          </div>
        ))}
      </div>
      <div className="p-4 border-t flex gap-2 safe-bottom">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && send()} placeholder="청소 팁 질문하기..." className="flex-1 bg-gray-50 border-none rounded-xl px-4 text-sm focus:ring-2 focus:ring-[#76D7C4]" />
        <button onClick={send} style={{ backgroundColor: MINT_COLOR }} className="p-3 text-white rounded-xl shadow-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" strokeWidth="2" /></svg></button>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>(AppStep.HOME);
  const [session, setSession] = useState<SessionData>({ beforeImage: null, afterImage: null, startTime: null, endTime: null, mergedImage: null });

  useEffect(() => {
    const saved = localStorage.getItem('yorae_v2');
    if (saved) setSession(JSON.parse(saved));
  }, []);

  useEffect(() => { localStorage.setItem('yorae_v2', JSON.stringify(session)); }, [session]);

  const startCleaning = async (img: string) => {
    const res = await resizeImage(img);
    setSession({ ...session, beforeImage: res, startTime: Date.now() });
    setStep(AppStep.CLEANING);
  };

  const finishCleaning = async (img: string) => {
    const res = await resizeImage(img);
    const end = Date.now();
    const dur = Math.max(1, Math.round((end - (session.startTime || end)) / 60000));
    const merged = await mergeImages(session.beforeImage!, res, dur);
    setSession({ ...session, afterImage: res, endTime: end, mergedImage: merged });
    setStep(AppStep.RESULT);
  };

  const reset = () => { setSession({ beforeImage: null, afterImage: null, startTime: null, endTime: null, mergedImage: null }); setStep(AppStep.HOME); };

  return (
    <div className="max-w-md mx-auto w-full flex-1 flex flex-col bg-white shadow-xl relative overflow-hidden min-h-screen">
      {step === AppStep.HOME && (
        <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
          <div className="text-7xl mb-8 animate-bounce">✨</div>
          <h1 className="text-4xl font-black text-gray-900 mb-2 tracking-tighter">요래됐슴당</h1>
          <p className="text-gray-500 text-sm mb-16 font-medium">청소 전과 후를 완벽하게 비교하세요.<br/>어떻게 <span className="text-[#76D7C4] font-bold">변했는지</span> 지금 확인해볼까요?</p>
          <button onClick={() => setStep(AppStep.BEFORE_CAPTURE)} style={{ backgroundColor: MINT_COLOR }} className="w-full py-5 rounded-3xl text-xl font-black text-white shadow-xl active:scale-95 transition-all">새 청소 시작</button>
        </div>
      )}

      {(step === AppStep.BEFORE_CAPTURE || step === AppStep.AFTER_CAPTURE) && (
        <CameraView 
          mode={step === AppStep.BEFORE_CAPTURE ? 'before' : 'after'}
          onCapture={step === AppStep.BEFORE_CAPTURE ? startCleaning : finishCleaning}
          onBack={() => setStep(step === AppStep.BEFORE_CAPTURE ? AppStep.HOME : AppStep.CLEANING)}
          ghost={session.beforeImage}
        />
      )}

      {step === AppStep.CLEANING && (
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#F8F9FA]">
          <div className="w-full aspect-square rounded-[3rem] overflow-hidden shadow-2xl mb-10 border-4 border-white relative">
            <img src={session.beforeImage!} className="w-full h-full object-cover grayscale-[0.5] opacity-60" />
            <div className="absolute inset-0 flex items-center justify-center text-white font-black text-2xl drop-shadow-lg">이랬는데...</div>
          </div>
          <h2 className="text-2xl font-black mb-10 text-gray-800">깨끗하게 변신 중!</h2>
          <button onClick={() => setStep(AppStep.AFTER_CAPTURE)} style={{ backgroundColor: MINT_COLOR }} className="w-full py-5 rounded-3xl text-xl font-black text-white shadow-xl active:scale-95 transition-all">청소 끝! 요래됐슴당</button>
          <button onClick={reset} className="mt-8 text-gray-300 text-xs font-bold">기록 취소</button>
        </div>
      )}

      {step === AppStep.RESULT && (
        <div className="flex-1 flex flex-col p-6 overflow-y-auto">
          <div className="text-center my-8">
            <h3 className="text-gray-400 font-bold mb-1">이랬는데...</h3>
            <h2 className="text-4xl font-black tracking-tighter" style={{ color: MINT_COLOR }}>요래됐슴당!</h2>
          </div>
          <div className="rounded-[2.5rem] overflow-hidden shadow-2xl border-2 border-gray-100 mb-10">
            <img src={session.mergedImage!} className="w-full" />
          </div>
          <div className="space-y-4 mb-10">
            <button onClick={() => {
              const link = document.createElement('a');
              link.href = session.mergedImage!; link.download = 'yoreyore_result.jpg'; link.click();
            }} style={{ backgroundColor: MINT_COLOR }} className="w-full py-5 rounded-3xl text-xl font-black text-white shadow-xl">이미지 저장하기</button>
            <button onClick={reset} className="w-full py-5 rounded-3xl font-black text-gray-400 border-2 border-gray-100">처음으로</button>
          </div>
        </div>
      )}

      {step === AppStep.CHAT && <ChatBot onBack={() => setStep(AppStep.HOME)} />}
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);