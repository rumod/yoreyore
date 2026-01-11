
import React, { useRef, useEffect, useState } from 'react';
import { fileToBase64 } from '../utils/imageUtils';

interface CameraViewProps {
  mode: 'before' | 'after';
  onCapture: (image: string) => void;
  onBack: () => void;
  beforeThumbnail?: string | null;
  onBeforeImageChange?: (image: string) => void;
}

const MINT_COLOR = '#76D7C4';

const CameraView: React.FC<CameraViewProps> = ({ mode, onCapture, onBack, beforeThumbnail, onBeforeImageChange }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGhostActive, setIsGhostActive] = useState(true);

  useEffect(() => {
    const startCamera = async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false
        });
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      } catch (err) {
        console.error("Camera access error:", err);
        setError("카메라를 사용할 수 없습니다. 권한 설정을 확인해주세요.");
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const capture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        onCapture(dataUrl);
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const base64 = await fileToBase64(file);
      onBeforeImageChange?.(base64);
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col select-none overflow-hidden">
      {/* Top Controls */}
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-40 safe-top">
        <button onClick={onBack} className="text-white p-3 bg-black/50 rounded-full backdrop-blur-md border border-white/30 shadow-lg">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <span className="text-white text-sm font-black tracking-tight bg-black/50 px-6 py-2 rounded-full backdrop-blur-md border border-white/30 shadow-lg">
          {mode === 'before' ? '청소 전 촬영' : '청소 후 촬영'}
        </span>
        <div className="w-12"></div>
      </div>

      {/* Main Viewport */}
      <div className="flex-1 relative overflow-hidden bg-black flex items-center justify-center">
        {error ? (
          <div className="text-white/80 text-base font-black px-12 text-center leading-relaxed bg-black/40 p-10 rounded-3xl">{error}</div>
        ) : (
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="w-full h-full object-cover"
          />
        )}
        
        {/* Ghost Layer (Overlay) */}
        {mode === 'after' && beforeThumbnail && isGhostActive && (
          <div className="absolute inset-0 pointer-events-none transition-opacity duration-300">
            <img 
              src={beforeThumbnail} 
              alt="Ghost Reference" 
              className="w-full h-full object-cover opacity-50 mix-blend-screen" 
            />
          </div>
        )}
      </div>

      {/* Camera Actions Footer */}
      <div className="h-44 flex justify-between items-center px-8 bg-black safe-bottom relative z-30 border-t border-white/10">
        {/* Toggle Ghost Button */}
        {mode === 'after' ? (
          <button 
            onClick={() => setIsGhostActive(!isGhostActive)}
            className={`w-16 h-16 flex flex-col items-center justify-center rounded-2xl transition-all border-2 ${isGhostActive ? 'text-white bg-white/20 border-white/50 shadow-xl' : 'text-white/40 bg-white/5 border-white/10'}`}
          >
             <span className="text-[11px] font-black tracking-tight">{isGhostActive ? '가이드 켬' : '가이드 끔'}</span>
             <span className="text-[9px] opacity-80 mt-1 uppercase font-black tracking-widest">GHOST</span>
          </button>
        ) : <div className="w-16" />}

        {/* Shutter Button */}
        <button 
          onClick={capture}
          className="w-24 h-24 border-4 border-white/30 rounded-full flex items-center justify-center active:scale-90 transition-transform shadow-2xl"
        >
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-xl">
             <div className="w-16 h-16 border-2 border-black/10 rounded-full"></div>
          </div>
        </button>

        {/* Change Image Button */}
        {mode === 'after' ? (
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="w-16 h-16 flex flex-col items-center justify-center rounded-2xl text-white bg-white/20 border-2 border-white/50 shadow-xl"
          >
             <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
             </svg>
             <span className="text-[10px] font-black mt-1 tracking-tighter">사진 교체</span>
             <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
          </button>
        ) : <div className="w-16" />}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default CameraView;
