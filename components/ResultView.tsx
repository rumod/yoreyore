import React, { useState, useEffect } from 'react';

const MINT_COLOR = '#76D7C4';

interface ResultViewProps {
  mergedImage: string | null;
  beforeImage: string | null;
  afterImage: string | null;
  duration: number;
  onReset: () => void;
}

const ResultView: React.FC<ResultViewProps> = ({ mergedImage, onReset }) => {
  const [currentImage, setCurrentImage] = useState<string | null>(mergedImage);

  useEffect(() => {
    setCurrentImage(mergedImage);
  }, [mergedImage]);

  const handleShare = async () => {
    if (!currentImage) return;
    try {
      const response = await fetch(currentImage);
      const blob = await response.blob();
      const file = new File([blob], 'yorae_result.jpg', { type: 'image/jpeg' });
      
      if (navigator.share) {
        await navigator.share({
          files: [file],
          title: '요래됐슴당',
          text: '제 청소 결과예요. 이랬는데 요래됐슴당!'
        });
      } else {
        alert("이미지를 길게 눌러 저장하세요.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white overflow-y-auto">
      <div className="p-8">
        <div className="text-center mb-10 mt-4">
          <h2 className="text-base font-black text-gray-800 tracking-tight leading-none mb-2">
            이랬는데...
          </h2>
          <h1 className="text-4xl font-black tracking-tighter" style={{ color: MINT_COLOR }}>
            요래됐슴당!
          </h1>
        </div>
        
        {currentImage ? (
          <div className="bg-white rounded-[2rem] overflow-hidden shadow-2xl border-2 border-gray-100 mb-12 relative group active:scale-[0.99] transition-transform">
            <img 
              src={currentImage} 
              alt="Comparison Result" 
              className="w-full h-auto block"
            />
          </div>
        ) : (
          <div className="h-80 flex flex-col items-center justify-center text-gray-800 font-black bg-gray-50 rounded-[2rem] border-2 border-gray-100 shadow-inner mb-12">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-200 border-t-mint-500 mb-6" style={{ borderTopColor: MINT_COLOR }}></div>
            결과를 생성하고 있습니다...
          </div>
        )}

        <div className="space-y-4 pb-16 safe-bottom">
          <button 
            onClick={handleShare}
            style={{ backgroundColor: MINT_COLOR }}
            className="w-full text-white py-5 rounded-2xl text-xl font-black shadow-xl shadow-teal-100 active:scale-[0.98] transition-all"
          >
            이미지 저장 및 공유
          </button>
          <button 
            onClick={() => onReset()}
            className="w-full text-gray-900 text-base font-black tracking-tight py-5 border-2 border-gray-200 rounded-2xl bg-white shadow-sm active:bg-gray-50 transition-all"
          >
            처음으로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResultView;