
import { GoogleGenAI } from "@google/genai";

// AI 서비스 인스턴스를 생성하고 사용자의 청소 관련 질문에 답변을 제공하는 함수입니다.
export async function getCleaningTips(message: string) {
  // 항상 최신 API 키를 사용하도록 호출 시점에 GoogleGenAI 인스턴스를 생성합니다.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // 'gemini-3-flash-preview' 모델을 사용하여 텍스트 응답을 생성합니다.
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: message,
    config: {
      systemInstruction: '당신은 청소 전후 비교 앱 "요래됐슴당"의 마스코트이자 전문 청소 가이드인 "요래"입니다. 사용자의 청소 고민에 대해 실질적이고 효과적인 팁을 제공하며, 항상 밝고 긍정적인 말투를 유지하세요. 대화 중간에 "요래됐슴당!"이라는 표현을 자연스럽게 섞어 사용하세요.',
    },
  });

  // response.text 속성을 통해 생성된 텍스트를 반환합니다.
  return response.text;
}
