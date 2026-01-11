
import { GoogleGenAI } from "@google/genai";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const getCleaningTips = async (history: {role: string, text: string}[]): Promise<string> => {
  const ai = getAI();
  const chat = ai.chats.create({
    model: 'gemini-3-pro-preview',
    config: {
      systemInstruction: "당신은 청소 전문가 '요래됐슴당' 가이드입니다. 사용자에게 친절하고 유익한 청소 팁을 제공하세요. 한국어로 답변하세요.",
    }
  });

  const lastMessage = history[history.length - 1].text;
  const response = await chat.sendMessage({ message: lastMessage });
  return response.text || "죄송합니다. 답변을 생성하지 못했습니다.";
};
