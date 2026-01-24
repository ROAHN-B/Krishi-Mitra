// File: app/api/analyze-crop-health/route.ts

import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

if (!process.env.GEMINI_API_KEY_CROP_HEALTH) {
  throw new Error("GEMINI_API_KEY is not set in environment variables.");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY_CROP_HEALTH);
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function fileToGenerativePart(buffer: Buffer, mimeType: string) {
  return { inlineData: { data: buffer.toString("base64"), mimeType } };
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.formData();
    const fileValue = data.get("file");
    const lang = data.get("lang") as string || "en";
    const userId = data.get("userId") as string; // Get userId from form data

    if (!fileValue || !(fileValue instanceof File)) {
      return NextResponse.json({ error: "No file uploaded or invalid file type." }, { status: 400 });
    }
    if (!userId) {
      return NextResponse.json({ error: "User ID is required to save results." }, { status: 400 });
    }
    
    const file: File = fileValue;
    const buffer = Buffer.from(await file.arrayBuffer());
    const imagePart = fileToGenerativePart(buffer, file.type);
    
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
      As an expert agricultural analyst, analyze this image of a crop plant.
      Identify the most probable disease or issue, assess its severity on a scale of 'low', 'medium', or 'high', and provide a concise description of the issue.
      Provide actionable treatment and prevention recommendations.
      Estimate a confidence level for the diagnosis as a percentage (e.g., 85).
      Respond ONLY with a valid JSON object in the following format. All string values must be translated into the language with the ISO 639-1 code "${lang}". Do not include any other text, explanations, or markdown formatting.
      
      {
        "disease": "<string>",
        "severity": "<string>",
        "confidence": <number>,
        "description": "<string>",
        "treatment": "<string>",
        "prevention": "<string>"
      }
    `;

    let result;
    const maxRetries = 3;
    let retries = 0;

    while (retries < maxRetries) {
      try {
        result = await model.generateContent({
          contents: [{ role: "user", parts: [imagePart, { text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        });
        break; 
      } catch (error: any) {
        if (error.status === 429) {
          retries++;
          console.warn(`429 Too Many Requests. Retrying attempt ${retries}/${maxRetries}...`);
          const retryInfo = error.errorDetails?.find((d: any) => d['@type'] === 'type.googleapis.com/google.rpc.RetryInfo');
          const retrySeconds = retryInfo?.retryDelay ? parseInt(retryInfo.retryDelay.replace('s', '')) : 60;
          await delay(retrySeconds * 1000);
        } else {
          throw error;
        }
      }
    }

    if (!result) {
      throw new Error("Failed to generate content after multiple retries due to quota limits.");
    }
    
    let responseText = result.response.text();
    const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
    const match = responseText.match(jsonRegex);
    let parsedJson;

    if (match && match[1]) {
      parsedJson = JSON.parse(match[1]);
    } else {
      parsedJson = JSON.parse(responseText);
    }
    
    // --- DATABASE INSERTION LOGIC ---
    const { error: insertError } = await supabase.from('crop_diagnoses').insert({
        user_id: userId,
        disease: parsedJson.disease,
        severity: parsedJson.severity,
        confidence: parsedJson.confidence,
        description: parsedJson.description,
        treatment: parsedJson.treatment,
        prevention: parsedJson.prevention
    });

    if (insertError) {
        console.error("Supabase insert error (crop_diagnoses):", insertError);
        // Still return the analysis to the user even if DB save fails
    }

    return NextResponse.json(parsedJson);

  } catch (error: any) {
    console.error("Error in Gemini API route:", error);
    return NextResponse.json(
      { error: error.message || "Failed to analyze image on the server. Please try again." },
      { status: 500 }
    );
  }
}