
import { GoogleGenAI, Type } from "@google/genai";
import { DesignPlan, ProductData, BrainKnowledge, GeneratedSlice, ChatMessage } from "../types";

const sanitizeCopy = (text: string) => {
  if (!text) return "";
  return text
    .replace(/^(대문구|소설명|문구|카피|Copy|Text|Title|Subtitle|Headline)[:：\s\-]*/gi, '')
    .replace(/^["'「](.*)["'」]$/g, '$1')
    .trim();
};

export const getBrainKnowledge = (): BrainKnowledge => {
  const saved = localStorage.getItem('brain_knowledge');
  if (!saved) return { successfulStrategies: [], failedPoints: [], totalProjects: 0, references: [] };
  try { return JSON.parse(saved); } catch (e) { return { successfulStrategies: [], failedPoints: [], totalProjects: 0, references: [] }; }
};

export const saveBrainKnowledge = (improvement: string, critique: string) => {
  const current = getBrainKnowledge();
  current.successfulStrategies.push(improvement);
  current.failedPoints.push(critique);
  current.totalProjects += 1;
  localStorage.setItem('brain_knowledge', JSON.stringify(current));
};

export const generateDesignPlan = async (product: ProductData): Promise<DesignPlan> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: {
      parts: [{ text: `상품명: ${product.name}, 스펙: ${product.specs}. 
      이 상품을 위한 6단계 상세페이지를 기획하세요.
      1번은 히어로(hero), 2~5번은 특장점(usp), 6번은 반드시 정보고시/스펙(specs)이어야 합니다.
      각 섹션별로 이미지를 생성할 상세 프롬프트만 JSON으로 반환하세요.` }]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          sections: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                prompt: { type: Type.STRING },
                type: { type: Type.STRING, enum: ["hero", "usp", "specs"] }
              }
            }
          }
        }
      }
    }
  });
  return JSON.parse(response.text || '{}') as DesignPlan;
};

export const generateSectionImage = async (prompt: string, referenceImage?: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const parts: any[] = [{ text: `Commercial high-end photography. ${prompt}. High contrast, professional studio lighting. 9:16 aspect. Clean top area for text overlay.` }];
  if (referenceImage) parts.push({ inlineData: { mimeType: "image/jpeg", data: referenceImage.split(',')[1] } });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts },
    config: { imageConfig: { aspectRatio: "9:16" } }
  });

  let base64Data = "";
  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) { base64Data = part.inlineData.data; break; }
    }
  }
  return base64Data ? `data:image/png;base64,${base64Data}` : "";
};

export const finalizeSectionText = async (imageUrl: string, product: ProductData, sectionType: string, sectionTitle: string): Promise<{ copy: string, description: string }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const instruction = sectionType === 'specs' 
    ? `이미지를 보고 제품의 핵심 스펙과 정보고시를 요약하세요. 카피는 'PRODUCT SPECS', 설명은 스펙 나열.` 
    : `이미지의 분위기에 맞춰 10자 이내의 강렬한 카피와 30자 이내의 설명을 작성하세요. 아주 간결해야 합니다.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: {
      parts: [
        { inlineData: { mimeType: "image/jpeg", data: imageUrl.split(',')[1] } },
        { text: `상품: ${product.name}. 주제: ${sectionTitle}. ${instruction}` }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          copy: { type: Type.STRING },
          description: { type: Type.STRING }
        }
      }
    }
  });
  const result = JSON.parse(response.text || '{"copy":"", "description":""}');
  return { copy: sanitizeCopy(result.copy), description: sanitizeCopy(result.description) };
};

export const sendChatMessageToBrain = async (
  message: string, 
  history: ChatMessage[], 
  context: { product: ProductData, currentSlice: GeneratedSlice | null, sliceIndex: number }
): Promise<{ text: string, action?: { copy?: string, description?: string } }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const chat = ai.chats.create({
    model: 'gemini-3-pro-preview',
    config: {
      systemInstruction: `당신은 상세페이지 마스터 에디터입니다. 
      사용자가 특정 페이지의 문구를 수정을 요청하면 [UPDATE_CONTENT: {"copy": "새문구", "description": "새설명"}] 형식으로 답변에 포함시키세요.
      문구는 항상 짧고 강렬해야 합니다.`
    },
    history: history.slice(-5).map(h => ({ role: h.role, parts: [{ text: h.text }] }))
  });

  const response = await chat.sendMessage({
    message: `[현재 ${context.sliceIndex + 1}페이지 문구: ${context.currentSlice?.copy}] ${message}`
  });

  const fullText = response.text || "";
  const actionMatch = fullText.match(/\[UPDATE_CONTENT:\s*({.*?})\]/);
  let action;
  if (actionMatch) {
    try { action = JSON.parse(actionMatch[1]); } catch (e) {}
  }

  return { text: fullText.replace(/\[UPDATE_CONTENT:.*?\]/, "").trim(), action };
};
