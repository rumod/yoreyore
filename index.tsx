import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";

// --- Constants & Types ---
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

// --- Utilities ---
const resizeImage = (base64Str: string, maxWidth: number = 1280): Promise<string> => {
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
      } else {
        resolve(base64Str);
      }
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

const mergeImages = async (before: string, after: string, durationMinutes: number): Promise<string> => {
  try {
    const [imgBefore, imgAfter] = await Promise.all([loadImage(before), loadImage(after)]);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const isBeforeLandscape = imgBefore.width > imgBefore.height;
    const isAfterLandscape = imgAfter.width > imgAfter.height;

    if (isBeforeLandscape && isAfterLandscape) {
      const targetWidth = Math.max(imgBefore.width, imgAfter.width);
      const sbH = imgBefore.height * (targetWidth / imgBefore.width);
      const saH = imgAfter.height * (targetWidth / imgAfter.width);
      canvas.width = targetWidth;
      canvas.height = sbH + saH;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(imgBefore, 0, 0, targetWidth, sbH);
      ctx.drawImage(imgAfter, 0, sbH, targetWidth, saH);
    } else if (!isBeforeLandscape && !isAfterLandscape) {
      const targetHeight = Math.max(imgBefore.height, imgAfter.height);
      const sbW = imgBefore.width * (targetHeight / imgBefore.height);
      const saW = imgAfter.width * (targetHeight / imgAfter.height);
      canvas.width = sbW + saW;
      canvas.height = targetHeight;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(imgBefore, 0, 0, sbW, targetHeight);
      ctx.drawImage(imgAfter, sbW, 0, saW, targetHeight);
    } else {
      const squareSize = 1080;
      canvas.width = squareSize * 2;
      canvas.height = squareSize;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const drawSquare = (img: HTMLImageElement, dx: number) => {
        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        ctx.drawImage(img, sx, sy, size, size, dx, 0, squareSize, squareSize);
      };
      drawSquare(imgBefore, 0);
      drawSquare(imgAfter, squareSize);
    }

    const fontSize = Math.round(canvas.height * 0.04);
    const now = new Date();
    const dateStr = now.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\./g, '/').replace(/ /g, '');
    const timeStr = now.toLocaleTimeString('ko-KR', { hour12: false, hour: '2-digit', minute: '2-digit' });
    const footerText = `${dateStr} ${timeStr} | ${durationMinutes}분 소요 | 요래됐슴당 ✨`;

    ctx.font = `bold ${fontSize}px sans-serif`;
    const textWidth = ctx.measureText(footerText).width;
    const paddingH = fontSize * 1.5;
    const paddingV = fontSize * 0.8;
    const boxWidth = textWidth + paddingH * 2;
    const boxHeight = fontSize + paddingV * 2;
    const boxX = (canvas.width - boxWidth) / 2;
    const boxY = canvas.height - boxHeight - fontSize;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxWidth, boxHeight, boxHeight / 2);
      ctx.fill();
    } else {
      ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
    }
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(footerText, boxX + boxWidth / 2, boxY + boxHeight / 2 + 2);

    return canvas.toDataURL('image/jpeg', 0.9);
  } catch (e) { return ''; }
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = e => reject(e);
  });
};

// --- Service ---
const getCleaningTips = async (history: ChatMessage[]): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: (window as any).process.env?.API_KEY || '' });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: history.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
      config: { systemInstruction: "당신은 청소 전문가 '요래됐슴당' 가이드입니다. 한국어로 답변하세요." }
    });
    return response.text || "답변을 생성할 수 없습니다.";
  } catch (e) { return "오류가 발생했습니다."; }
};

// --- Internal Components ---
const CameraView: React.FC<{
  mode: 'before' | 'after', 
  onCapture: (img: string) => void, 
  onBack: () => void, 
  beforeThumbnail?: string | null,
  onBeforeImageChange?: (img: string) => void
}> = ({ mode, onCapture, onBack, beforeThumbnail, onBeforeImageChange }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGhost, setIsGhost] = useState(true);

  useEffect(() => {
    let currentStream: MediaStream | null = null;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then(s => {
        currentStream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() => setError("카메라 권한이 필요합니다."));
    return () => currentStream?.getTracks().forEach(t => t.stop());
  }, []);

  const capture = () => {
    if (videoRef.current && canvasRef.current) {
      const v = videoRef.current;
      const c = canvasRef.current;
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      c.getContext('2d')?.drawImage(v, 0, 0);
      onCapture(c.toDataURL('image/jpeg', 0.9));
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-40 safe-top">
        <button onClick={onBack} className="text-white p-3 bg-black/50 rounded-full border border-white/20">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <span className="text-white font-black bg-black/50 px-6 py-2 rounded-full border border-white/20 text-sm">
          {mode === 'before' ? '청소 전 촬영' : '청소 후 촬영'}
        </span>
        <div className="w-12"></div>
      </div>
      <div className="flex-1 relative flex items-center justify-center">
        {error ? <div className="text-white text-center font-bold">{error}</div> : <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />}
        {mode === 'after' && beforeThumbnail && isGhost && <img src={beforeThumbnail} className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-screen pointer-events-none" />}
      </div>
      <div className="h-44 flex justify-between items-center px-10 bg-black safe-bottom border-t border-white/10">
        {mode === 'after' ? (
          <button onClick={() => setIsGhost(!isGhost)} className={`w-16 h-16 rounded-2xl border-2 flex flex-col items-center justify-center ${isGhost ? 'bg-white/20 border-white/50 text-white' : 'text-white/40 border-white/10'}`}>
            <span className="text-[10px] font-black uppercase">GHOST</span>
            <span className="text-[8px]">{isGhost ? 'ON' : 'OFF'}</span>
          </button>
        ) : <div className="w-16" />}
        <button onClick={capture} className="w-24 h-24 border-4 border-white/30 rounded-full flex items-center justify-center active:scale-90 transition-transform">
          <div className="w-20 h-20 bg-white rounded-full shadow-lg"></div>
        </button>
        <button onClick={() => fileInputRef.current?.click()} className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex flex-col items-center justify-center text-white active:bg-white/20">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
          <span className="text-[10px] mt-1 font-bold">파일</span>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) onBeforeImageChange?.(await fileToBase64(f));
          }} />
        </button>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

const ResultView: React.FC<{ mergedImage: string | null, onReset: () => void }> = ({ mergedImage, onReset }) => {
  const handleShare = async () => {
    if (!mergedImage) return;
    try {
      const res = await fetch(mergedImage);
      const b = await res.blob();
      const f = new File([b], 'yorae.jpg', { type: 'image/jpeg' });
      if (navigator.share) await navigator.share({ files: [f], title: '요래됐슴당', text: '이랬는데 요래됐슴당!' });
      else alert("이미지를 길게 눌러 저장하세요.");
    } catch (e) { alert("공유를 지원하지 않는 환경입니다."); }
  };
  return (
    <div className="flex-1 flex flex-col p-8 bg-white overflow-y-auto">
      <div className="text-center my-10">
        <p className="text-gray-600 font-black mb-1 text-lg">이랬는데...</p>
        <h1 className="text-4xl font-black" style={{ color: MINT_COLOR }}>요래됐슴당!</h1>
      </div>
      <div className="rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-gray-50 mb-12">
        <img src={mergedImage || ''} className="w-full" alt="Result" />
      </div>
      <div className="space-y-4 pb-12">
        <button onClick={handleShare} style={{ backgroundColor: MINT_COLOR }} className="w-full py-5 rounded-2xl text-white text-xl font-black shadow-lg active:scale-95 transition-all">저장 및 공유하기</button>
        <button onClick={onReset} className="w-full py-5 rounded-2xl border-2 border-gray-200 font-black text-gray-500 active:bg-gray-50 transition-all">새로 시작하기</button>
      </div>
    </div>
  );
};

const ChatBot: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'model', text: '무엇을 도와드릴까요? 청소 전문가가 답변해 드립니다!' }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg: ChatMessage = { role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    const tip = await getCleaningTips([...messages, userMsg]);
    setMessages(prev => [...prev, { role: 'model', text: tip }]);
    setLoading(false);
  };

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      <div className="p-4 border-b flex items-center gap-4 bg-white sticky top-0 safe-top z-10">
        <button onClick={onBack} className="p-2 text-gray-400"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg></button>
        <h2 className="font-black text-lg text-gray-900">청소 가이드</h2>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm font-medium shadow-sm ${m.role === 'user' ? 'bg-[#76D7C4] text-white rounded-tr-none' : 'bg-gray-100 text-gray-900 rounded-tl-none'}`}>{m.text}</div>
          </div>
        ))}
        {loading && <div className="text-xs text-gray-400 animate-pulse font-bold">답변을 생각 중입니다...</div>}
      </div>
      <div className="p-4 border-t bg-white safe-bottom">
        <div className="flex gap-2">
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="질문을 입력하세요..." className="flex-1 border-2 border-gray-100 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-[#76D7C4] transition-colors" />
          <button onClick={send} style={{ backgroundColor: MINT_COLOR }} className="p-3 text-white rounded-xl shadow-md active:scale-95 transition-all"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg></button>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---
const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>(AppStep.HOME);
  const [session, setSession] = useState<SessionData>({ beforeImage: null, afterImage: null, startTime: null, endTime: null, mergedImage: null });
  const [dots, setDots] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('yorae_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSession(parsed);
        if (parsed.mergedImage) setStep(AppStep.RESULT);
        else if (parsed.beforeImage) setStep(AppStep.CLEANING);
      } catch (e) { localStorage.removeItem('yorae_session'); }
    }
  }, []);

  useEffect(() => {
    if (session.beforeImage) localStorage.setItem('yorae_session', JSON.stringify(session));
  }, [session]);

  useEffect(() => {
    if (step === AppStep.CLEANING) {
      const i = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 500);
      return () => clearInterval(i);
    }
  }, [step]);

  const handleBefore = async (img: string) => {
    const r = await resizeImage(img);
    setSession({ ...session, beforeImage: r, startTime: Date.now() });
    setStep(AppStep.CLEANING);
  };

  const handleAfter = async (img: string) => {
    const r = await resizeImage(img);
    const duration = Math.round((Date.now() - (session.startTime || Date.now())) / 60000);
    const merged = await mergeImages(session.beforeImage!, r, duration);
    setSession({ ...session, afterImage: r, endTime: Date.now(), mergedImage: merged });
    setStep(AppStep.RESULT);
  };

  const reset = () => {
    if (confirm("기록을 중단하고 처음으로 돌아갈까요?")) {
      localStorage.removeItem('yorae_session');
      setSession({ beforeImage: null, afterImage: null, startTime: null, endTime: null, mergedImage: null });
      setStep(AppStep.HOME);
    }
  };

  const hardReset = () => {
    localStorage.removeItem('yorae_session');
    setSession({ beforeImage: null, afterImage: null, startTime: null, endTime: null, mergedImage: null });
    setStep(AppStep.HOME);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white max-w-md mx-auto shadow-xl relative overflow-hidden">
      {step === AppStep.HOME && (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-[#FAFAFA]">
          <span className="text-7xl mb-8">✨</span>
          <h1 className="text-3xl font-black mb-4 text-gray-900">요래됐슴당</h1>
          <p className="text-gray-600 text-sm mb-16 leading-relaxed font-bold">청소 전과 후를 완벽하게 비교하세요.<br/>어떻게 변했는지 기록해볼까요?</p>
          <div className="w-full space-y-4">
            <button onClick={() => setStep(AppStep.BEFORE_CAPTURE)} style={{ backgroundColor: MINT_COLOR }} className="w-full py-5 rounded-2xl text-white text-xl font-black shadow-xl active:scale-95 transition-all">청소 시작하기</button>
            <button onClick={() => setStep(AppStep.CHAT)} className="w-full py-4 rounded-2xl border-2 border-gray-200 text-gray-700 font-black active:bg-gray-50 transition-all">청소 꿀팁 물어보기</button>
          </div>
        </div>
      )}

      {(step === AppStep.BEFORE_CAPTURE || step === AppStep.AFTER_CAPTURE) && (
        <CameraView 
          mode={step === AppStep.BEFORE_CAPTURE ? 'before' : 'after'}
          onCapture={step === AppStep.BEFORE_CAPTURE ? handleBefore : handleAfter}
          onBack={() => setStep(step === AppStep.BEFORE_CAPTURE ? AppStep.HOME : AppStep.CLEANING)}
          beforeThumbnail={session.beforeImage}
          onBeforeImageChange={(img) => setSession({...session, beforeImage: img})}
        />
      )}

      {step === AppStep.CLEANING && (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-white">
          <div className="relative mb-12">
            <div className="w-64 h-64 rounded-[3rem] overflow-hidden shadow-2xl border-4 border-gray-100">
              <img src={session.beforeImage || ''} className="w-full h-full object-cover grayscale-[0.3]" alt="Before" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-white font-black text-2xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">이랬는데{dots}</p>
            </div>
          </div>
          <h2 className="text-2xl font-black mb-10 text-gray-900">청소 중입니다...</h2>
          <button onClick={() => setStep(AppStep.AFTER_CAPTURE)} style={{ backgroundColor: MINT_COLOR }} className="w-full py-5 rounded-2xl text-white text-xl font-black shadow-xl active:scale-95 transition-all">다 했어요! 사진 찍기</button>
          <button onClick={reset} className="mt-8 text-gray-400 text-sm font-bold border-b border-gray-200">기록 중단하기</button>
        </div>
      )}

      {step === AppStep.RESULT && <ResultView mergedImage={session.mergedImage} onReset={hardReset} />}
      {step === AppStep.CHAT && <ChatBot onBack={() => setStep(AppStep.HOME)} />}
    </div>
  );
};

// --- Entry Point ---
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
