
import React, { useState, useEffect } from 'react';
import { AppStep, SessionData } from './types';
import CameraView from './components/CameraView';
import ResultView from './components/ResultView';
import ChatBot from './components/ChatBot';
import { resizeImage, mergeImages } from './utils/imageUtils';

const MINT_COLOR = '#76D7C4';

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>(AppStep.HOME);
  const [dots, setDots] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [session, setSession] = useState<SessionData>({
    beforeImage: null,
    afterImage: null,
    startTime: null,
    endTime: null,
    mergedImage: null,
  });

  useEffect(() => {
    if (step === AppStep.CLEANING) {
      const interval = setInterval(() => {
        setDots(d => (d.length >= 3 ? '' : d + '.'));
      }, 500);
      return () => clearInterval(interval);
    } else {
      setDots('');
    }
  }, [step]);

  useEffect(() => {
    const saved = localStorage.getItem('yorae_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSession(parsed);
        if (parsed.mergedImage) {
          setStep(AppStep.RESULT);
        } else if (parsed.beforeImage && !parsed.afterImage) {
          setStep(AppStep.CLEANING);
        }
      } catch (e) {
        console.error("Failed to load session", e);
      }
    }
  }, []);

  useEffect(() => {
    if (session.beforeImage || session.mergedImage) {
      localStorage.setItem('yorae_session', JSON.stringify(session));
    } else {
      localStorage.removeItem('yorae_session');
    }
  }, [session]);

  const handleBeforeCapture = async (image: string) => {
    const resized = await resizeImage(image);
    const newSession = {
      beforeImage: resized,
      startTime: Date.now(),
      afterImage: null,
      endTime: null,
      mergedImage: null
    };
    setSession(newSession);
    setStep(AppStep.CLEANING);
  };

  const handleAfterCapture = async (image: string) => {
    if (!session.beforeImage) {
      setStep(AppStep.HOME);
      return;
    }
    
    try {
      const resized = await resizeImage(image);
      const endTime = Date.now();
      const duration = Math.round((endTime - (session.startTime || endTime)) / 60000);
      
      const merged = await mergeImages(session.beforeImage, resized, duration);
      
      if (!merged) {
        alert("이미지 합성에 실패했습니다. 다시 촬영해주세요.");
        return;
      }

      const updatedSession = {
        ...session,
        afterImage: resized,
        endTime,
        mergedImage: merged
      };
      
      setSession(updatedSession);
      setStep(AppStep.RESULT);
    } catch (err) {
      console.error("Error during merge:", err);
      alert("오류가 발생했습니다. 다시 촬영해주세요.");
    }
  };

  const performFullReset = () => {
    localStorage.removeItem('yorae_session');
    setSession({
      beforeImage: null,
      afterImage: null,
      startTime: null,
      endTime: null,
      mergedImage: null,
    });
    setDots('');
    setShowCancelModal(false);
    setStep(AppStep.HOME);
  };

  const updateBeforeImage = async (newImage: string) => {
    const resized = await resizeImage(newImage);
    setSession(prev => ({ ...prev, beforeImage: resized }));
  };

  const currentDuration = session.endTime && session.startTime 
    ? Math.round((session.endTime - session.startTime) / 60000) 
    : 0;

  return (
    <div className="min-h-screen flex flex-col bg-white max-w-md mx-auto relative overflow-hidden shadow-sm">
      {step === AppStep.HOME && (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-[#FAFAFA]">
          <div className="w-24 h-24 flex items-center justify-center mb-10 relative">
             <span className="text-6xl relative z-10">✨</span>
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-gray-900 mb-4">요래됐슴당</h1>
          <p className="text-gray-700 text-sm mb-16 leading-relaxed font-bold px-4">
            청소 전과 후를 완벽하게 비교하고 기록하세요.<br/>
            어떻게 변했는지 지금 바로 시작해볼까요?
          </p>
          <div className="w-full space-y-3">
            <button 
              onClick={() => setStep(AppStep.BEFORE_CAPTURE)}
              style={{ backgroundColor: MINT_COLOR }}
              className="w-full text-white py-5 rounded-2xl text-xl font-black shadow-xl shadow-teal-100 active:scale-[0.98] transition-all"
            >
              새 청소 시작하기
            </button>
            <button 
              onClick={() => setStep(AppStep.CHAT)}
              className="w-full py-4 text-gray-400 text-sm font-black border-2 border-gray-100 rounded-2xl hover:bg-gray-50 active:scale-[0.98] transition-all"
            >
              ✨ 청소 요정 요래에게 물어보기
            </button>
          </div>
        </div>
      )}

      {(step === AppStep.BEFORE_CAPTURE || step === AppStep.AFTER_CAPTURE) && (
        <CameraView 
          mode={step === AppStep.BEFORE_CAPTURE ? 'before' : 'after'}
          onCapture={step === AppStep.BEFORE_CAPTURE ? handleBeforeCapture : handleAfterCapture}
          onBack={() => setStep(step === AppStep.BEFORE_CAPTURE ? AppStep.HOME : AppStep.CLEANING)}
          beforeThumbnail={session.beforeImage}
          onBeforeImageChange={updateBeforeImage}
        />
      )}

      {step === AppStep.CLEANING && (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-white">
          <div className="relative mb-12">
            <div className="w-64 h-64 overflow-hidden rounded-[3rem] shadow-2xl border-4 border-gray-200">
              <img 
                src={session.beforeImage || ''} 
                alt="Before" 
                className="w-full h-full object-cover grayscale-[0.3] opacity-80" 
              />
            </div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-white font-black text-lg tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                이랬는데{dots}
              </p>
            </div>
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-4 tracking-tight">청소 진행 중입니다</h2>
          <p className="text-gray-700 text-base mb-16 font-bold leading-tight px-6">공간이 깨끗해졌다면<br/>완료 촬영 버튼을 눌러주세요!</p>
          
          <div className="w-full space-y-4 relative z-50">
            <button 
              onClick={() => setStep(AppStep.AFTER_CAPTURE)}
              style={{ backgroundColor: MINT_COLOR }}
              className="w-full text-white py-5 rounded-2xl text-xl font-black shadow-xl shadow-teal-100 active:scale-[0.98] transition-all"
            >
              청소 완료! 사진 찍기
            </button>
            
            <button 
              onClick={() => setShowCancelModal(true)}
              type="button"
              className="w-full py-4 text-gray-400 text-sm font-bold border border-gray-200 rounded-2xl hover:bg-gray-50 active:scale-[0.98] transition-all"
            >
              기록 취소하기
            </button>
          </div>
        </div>
      )}

      {step === AppStep.RESULT && (
        <ResultView 
          mergedImage={session.mergedImage} 
          beforeImage={session.beforeImage}
          afterImage={session.afterImage}
          duration={currentDuration}
          onReset={performFullReset}
        />
      )}

      {step === AppStep.CHAT && (
        <ChatBot onBack={() => setStep(AppStep.HOME)} />
      )}

      {showCancelModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-[2px]">
          <div className="bg-white w-full max-w-xs rounded-[2.5rem] overflow-hidden shadow-2xl">
            <div className="p-10 text-center">
              <div className="w-16 h-16 bg-red-50 text-red-400 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-3 tracking-tighter">기록을 중단할까요?</h3>
              <p className="text-gray-500 text-sm font-bold leading-relaxed mb-8">
                지금까지의 촬영 데이터와<br/>청소 시간이 모두 사라집니다.
              </p>
              
              <div className="space-y-3">
                <button 
                  onClick={() => setShowCancelModal(false)}
                  style={{ backgroundColor: MINT_COLOR }}
                  className="w-full py-4 text-white rounded-2xl font-black shadow-lg shadow-teal-100 active:scale-95 transition-all"
                >
                  계속 청소하기
                </button>
                <button 
                  onClick={performFullReset}
                  className="w-full py-3 text-gray-400 text-xs font-black hover:text-gray-600 active:scale-95 transition-all"
                >
                  네, 정말 취소할게요
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
