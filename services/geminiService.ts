
import { GoogleGenAI, Type } from "@google/genai";
import { TourType, TourPlan, Quotation } from "../types";
import { DOMESTIC_SYSTEM_PROMPT, INTERNATIONAL_SYSTEM_PROMPT } from "../constants";

const tourPlanSchema = {
  type: Type.OBJECT,
  properties: {
    mainTitle: { type: Type.STRING },
    marketingSubtitle: { type: Type.STRING },
    departureInfo: { type: Type.STRING },
    highlights: { type: Type.ARRAY, items: { type: Type.STRING } },
    days: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          day: { type: Type.NUMBER },
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          timeline: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                activity: { type: Type.STRING }
              },
              required: ["activity"]
            }
          },
          meals: {
            type: Type.OBJECT,
            properties: {
              breakfast: { type: Type.STRING },
              lunch: { type: Type.STRING },
              dinner: { type: Type.STRING }
            },
            required: ["breakfast", "lunch", "dinner"]
          },
          accommodation: { type: Type.STRING },
          imageUrl: { type: Type.STRING },
          imagePosition: { type: Type.STRING, enum: ["left", "right", "bottom"] },
          imageCount: { type: Type.NUMBER }
        },
        required: ["day", "title", "description", "timeline", "meals", "accommodation", "imageUrl"]
      }
    },
    costIncludes: { type: Type.ARRAY, items: { type: Type.STRING } },
    costExcludes: { type: Type.ARRAY, items: { type: Type.STRING } },
    precautions: { type: Type.ARRAY, items: { type: Type.STRING } },
    suggestedItems: { type: Type.ARRAY, items: { type: Type.STRING } },
    countryCity: { type: Type.STRING },
    flightInfo: {
      type: Type.OBJECT,
      properties: {
        departure: { type: Type.STRING },
        return: { type: Type.STRING }
      }
    }
  },
  required: ["mainTitle", "marketingSubtitle", "departureInfo", "highlights", "days", "costIncludes", "costExcludes", "precautions", "suggestedItems"]
};

const quotationSchema = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING },
          item: { type: Type.STRING },
          unitPrice: { type: Type.NUMBER },
          quantity: { type: Type.NUMBER },
          note: { type: Type.STRING }
        },
        required: ["category", "item", "unitPrice", "quantity", "note"]
      }
    },
    totalCost: { type: Type.NUMBER },
    suggestedSellingPrice: { type: Type.NUMBER },
    profitMargin: { type: Type.NUMBER }
  },
  required: ["items", "totalCost", "suggestedSellingPrice", "profitMargin"]
};

export async function generateTourPlan(
  type: TourType,
  productName: string,
  extraContent?: string
): Promise<TourPlan> {
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({ apiKey: apiKey as string });
  const systemInstruction = type === TourType.DOMESTIC ? DOMESTIC_SYSTEM_PROMPT : INTERNATIONAL_SYSTEM_PROMPT;
  
  const prompt = `
    請根據以下資訊產出行程：
    商品名稱: ${productName}
    類型: ${type === TourType.DOMESTIC ? '國內團體旅遊' : '國外團體旅遊'}
    ${extraContent ? `要求細節: ${extraContent}` : ''}
    
    請確保內容專業且吸引人。在 days 陣列中，請為每個景點預設分配 1 張圖片 (imageCount: 1)，並指定 imagePosition。
    細部行程 (timeline) 請僅包含活動內容 (activity)，不要加入時間資訊 (如 09:00)。
    描述部分 (description) 請寫得具備視覺感，以便後續生成對應景點的圖片。
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: tourPlanSchema,
      },
    });

    const text = response.text;
    if (!text) throw new Error("API 回傳內容為空。");
    
    const result = JSON.parse(text);
    result.days = result.days.map((d: any) => ({
      ...d,
      imagePosition: d.imagePosition || 'right',
      imageCount: d.imageCount ?? 1
    }));
    
    return result as TourPlan;
  } catch (error: any) {
    console.error("Gemini Generation Error:", error);
    throw error;
  }
}

/**
 * 根據當天行程細節生成對應圖片
 * @param context 包含當天標題、描述、以及旅遊類型的組合文字
 */
export async function generateImageForDay(context: string): Promise<string> {
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({ apiKey: apiKey as string });
  
  // 強化提示詞：強調真實景點、建築、飯店與餐點的寫實感
  const refinedPrompt = `A realistic, high-quality travel photograph of: ${context}. 
  Focus on authentic architecture, actual landmarks, realistic hotel interiors, or genuine local cuisine as described. 
  Professional 4k photography, natural lighting, clear details, no people, no text, high aesthetic quality, realistic textures and colors.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: refinedPrompt }]
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9"
        }
      } as any
    });

    if (response.candidates && response.candidates[0] && response.candidates[0].content && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
    throw new Error("No image data in response");
  } catch (error) {
    console.warn("AI Image gen failed, using fallback:", error);
    return `https://picsum.photos/seed/${Math.random()}/1200/675`;
  }
}

export async function generateQuotation(
  plan: TourPlan,
  costReference?: string
): Promise<Quotation> {
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({ apiKey: apiKey as string });
  
  const prompt = `
    請根據以下旅遊行程內容，自動估算各項成本並生成一份詳細的報價單表格。
    
    行程內容：
    標題：${plan.mainTitle}
    天數：${plan.days.length} 天
    行程亮點：${plan.highlights.join(', ')}
    
    ${costReference ? `參考成本資料：\n${costReference}` : '請根據市場行情進行合理估算。'}
    
    請包含以下類別：交通、住宿、餐飲、門票、導遊司機服務費、雜費等。
    請確保計算邏輯正確：totalCost 應為所有 items 的 unitPrice * quantity 之和。
    suggestedSellingPrice 請根據 totalCost 加上合理的利潤（約 10-20%）。
    profitMargin 為 (suggestedSellingPrice - totalCost) / suggestedSellingPrice。
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: quotationSchema,
      },
    });

    const text = response.text;
    if (!text) throw new Error("API 回傳內容為空。");
    
    return JSON.parse(text) as Quotation;
  } catch (error: any) {
    console.error("Gemini Quotation Error:", error);
    throw error;
  }
}
