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

const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
};

const mergeImages = async (before: string, after: string, duration: number): Promise<string> => {
  try {
    const [imgB, imgA] = await Promise.all([loadImage(before), loadImage(after)]);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const isBeforeLandscape = imgB.width > imgB.height;
    const targetDim = 1080;

    if (isBeforeLandscape) {
      // 1. 가로형 사진: 상하(Vertical) 배치
      const scaleB = targetDim / imgB.width;
      const scaleA = targetDim / imgA.width;
      const hB = imgB.height * scaleB;
      const hA = imgA.height * scaleA;

      canvas.width = targetDim;
      canvas.height = hB + hA;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(imgB, 0, 0, targetDim, hB);
      ctx.drawImage(imgA, 0, hB, targetDim, hA);
    } else {
      // 2. 세로형 사진: 좌우(Horizontal) 배치
      const scaleB = targetDim / imgB.height;
      const scaleA = targetDim / imgA.height;
      const wB = imgB.width * scaleB;
      const wA = imgA.width * scaleA;

      canvas.width = wB + wA;
      canvas.height = targetDim;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(imgB, 0, 0, wB, targetDim);
      ctx.drawImage(imgA, wB, 0, wA, targetDim);
    }

    // 하단 정보 캡슐
    const fontSize = Math.round(Math.max(canvas.width, canvas.height) * 0.035);
    const now = new Date();
    const dateStr = now.toLocaleDateString('ko-KR').replace(/ /g, '');
    const footerText = `${dateStr} | ${duration}분 소요 | 요래됐슴당 ✨`;
    
    ctx.font = `bold ${fontSize}px sans-serif`;
    const textW = ctx.measureText(footerText).width;
    const pX = fontSize * 1.5, pY = fontSize * 0.8;
    const bW = textW + pX * 2, bH = fontSize + pY * 2;
    const bX = (canvas.width - bW) / 2, bY = canvas.height - bH - fontSize;

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(bX, bY, bW, bH, bH / 2);
    } else {
      ctx.rect(bX, bY, bW, bH);
    }
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
      contents: history.map(m => ({ role: m.role === 'model' ? 'model' : 'user', parts: [{ text: m.text }] })),
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
    navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } 
    }).then(s => { 
      setStream(s); 
      if (videoRef.current) videoRef.current.srcObject = s; 
    }).catch(() => alert("카메라 권한이 필요합니다."));
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
    const saved = localStorage.getItem('yorae_session_v3');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSession(parsed);
        if (parsed.mergedImage) setStep(AppStep.RESULT);
        else if (parsed.beforeImage) setStep(AppStep.CLEANING);
      } catch (e) { console.error(e); }
    }
  }, []);

  useEffect(() => { 
    if (session.beforeImage) localStorage.setItem('yorae_session_v3', JSON.stringify(session)); 
  }, [session]);

  const startCleaning = async (img: string) => {
    const res = await resizeImage(img);
    setSession({ ...session, beforeImage: res, startTime: Date.now(), afterImage: null, mergedImage: null });
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

  const reset = () => { 
    localStorage.removeItem('yorae_session_v3');
    setSession({ beforeImage: null, afterImage: null, startTime: null, endTime: null, mergedImage: null }); 
    setStep(AppStep.HOME); 
  };

  return (
    <div className="max-w-md mx-auto w-full flex-1 flex flex-col bg-white shadow-xl relative overflow-hidden min-h-screen">
      {step === AppStep.HOME && (
        <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
          <div className="text-7xl mb-8 animate-bounce">✨</div>
          <h1 className="text-4xl font-black text-gray-900 mb-2 tracking-tighter">요래됐슴당</h1>
          <p className="text-gray-500 text-sm mb-16 font-medium leading-relaxed px-4">
            청소 전과 후를 완벽하게 비교하세요.<br/>어떻게 변했는지 지금 확인해볼까요?
          </p>
          <button 
            onClick={() => setStep(AppStep.BEFORE_CAPTURE)} 
            style={{ backgroundColor: MINT_COLOR }} 
            className="w-full py-5 rounded-3xl text-xl font-black text-white shadow-xl active:scale-95 transition-all"
          >
            새 청소 시작
          </button>
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
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white">
          <div className="w-full aspect-square rounded-[3rem] overflow-hidden shadow-2xl mb-10 border-4 border-gray-100 relative">
            <img src={session.beforeImage!} className="w-full h-full object-cover grayscale-[0.3] opacity-60" />
            <div className="absolute inset-0 flex items-center justify-center text-white font-black text-2xl drop-shadow-lg">이랬는데...</div>
          </div>
          <h2 className="text-2xl font-black mb-10 text-gray-800">깨끗하게 변신 중!</h2>
          <button 
            onClick={() => setStep(AppStep.AFTER_CAPTURE)} 
            style={{ backgroundColor: MINT_COLOR }} 
            className="w-full py-5 rounded-3xl text-xl font-black text-white shadow-xl active:scale-95 transition-all"
          >
            청소 끝! 요래됐슴당
          </button>
          <button onClick={reset} className="mt-8 text-gray-300 text-xs font-bold">기록 취소</button>
        </div>
      )}

      {step === AppStep.RESULT && (
        <div className="flex-1 flex flex-col p-6 overflow-y-auto">
          <div className="text-center my-8">
            <h3 className="text-gray-400 font-bold mb-1">이랬는데...</h3>
            <h2 className="text-4xl font-black tracking-tighter" style={{ color: MINT_COLOR }}>요래됐슴당!</h2>
          </div>
          <div className="rounded-[2rem] overflow-hidden shadow-2xl border-2 border-gray-50 mb-10">
            <img src={session.mergedImage!} className="w-full h-auto block" />
          </div>
          <div className="space-y-4 pb-12">
            <button 
              onClick={() => {
                const link = document.createElement('a');
                link.href = session.mergedImage!; 
                link.download = `yoreyore_${Date.now()}.jpg`; 
                link.click();
              }} 
              style={{ backgroundColor: MINT_COLOR }} 
              className="w-full py-5 rounded-3xl text-xl font-black text-white shadow-xl"
            >
              이미지 저장하기
            </button>
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