import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const key = process.env.GEMINI_API_KEY_GEMINI_ROUTE;
if (!key) throw new Error("GEMINI_API_KEY is missing in .env.local");

const genAI = new GoogleGenerativeAI(key);

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();
    if (!prompt) return NextResponse.json("Prompt is required", { status: 400 });

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const text = await result.response.text();

    return NextResponse.json(text, { status: 200 });
  } catch (err: any) {
    console.error("Gemini error:", err);
    return NextResponse.json("Sorry, I could not process that.", { status: 500 });
  }
}