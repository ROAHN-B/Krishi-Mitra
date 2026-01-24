import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

if (!process.env.GEMINI_API_KEY_GUIDANCE) {
  throw new Error("GEMINI_API_KEY is not set in environment variables.");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY_GUIDANCE);

export async function POST(req: NextRequest) {
  try {
    // --- MODIFIED --- Read the language from the request body
    const { manualFormData, lang } = await req.json();

    if (!manualFormData) {
      return NextResponse.json({ error: "No soil data provided for analysis." }, { status: 400 });
    }

    // Convert the manual data object to a structured string for the prompt
    const soilDataString = Object.entries(manualFormData)
      .filter(([, value]) => value !== undefined && !isNaN(Number(value)))
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // --- MODIFIED --- Use a dynamic prompt with the language
    const prompt = `
      As an expert agricultural analyst, provide a detailed analysis of the following soil health report. Based on the data, identify any deficiencies or imbalances and give actionable recommendations for a farmer.

      Soil data: ${soilDataString}

      Provide the response as a single, valid JSON object in the following format. All string values within the JSON must be translated into the language with the ISO 639-1 code "${lang}". Do not include any other text, explanations, or markdown formatting outside of the JSON block.

      {
        "general_analysis": "<A concise, general summary of the soil condition>",
        "nutrient_recommendations": [
          {
            "nutrient": "<Name of the nutrient or property>",
            "level": "<e.g., Low, High, Optimal, Acidic, Alkaline>",
            "action": "<A specific action or fertilizer recommendation>"
          }
        ],
        "actionable_steps": [
          "<Step 1>",
          "<Step 2>",
          "<Step 3>"
        ]
      }
    `;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" },
    });

    const responseText = result.response.text();
    // Use a robust method to parse the JSON
    const parsedGuidance = JSON.parse(responseText.replace(/^```json\s*/, '').replace(/```$/, ''));

    return NextResponse.json(parsedGuidance);

  } catch (error: any) {
    console.error("Error generating structured guidance:", error);
    return NextResponse.json(
      { error: "Failed to generate structured guidance from the provided data." },
      { status: 500 }
    );
  }
}