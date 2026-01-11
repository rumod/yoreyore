import { GoogleGenAI } from "@google/genai";

export const getCleaningTips = async (history: {role: string, text: string}[]): Promise<string> => {
  try {
    // 가이드라인: process.env.API_KEY를 사용하여 직접 초기화
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // 단순 텍스트 질의에는 gemini-3-flash-preview가 가장 효율적입니다.
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: history.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      })),
      config: {
        systemInstruction: "당신은 청소 전문가 '요래됐슴당' 가이드입니다. 사용자에게 친절하고 유익한 청소 팁을 제공하세요. 한국어로 답변하세요.",
      }
    });

    return response.text || "죄송합니다. 답변을 생성하지 못했습니다.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "현재 가이드 기능을 사용할 수 없습니다. 나중에 다시 시도해주세요.";
  }
};