// File: app/api/analyze-soil-card/route.ts

import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

if (!process.env.GEMINI_API_KEY_SOIL_CARD) {
  throw new Error("GEMINI_API_KEY is not set in environment variables.");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY_SOIL_CARD);

function fileToGenerativePart(buffer: Buffer, mimeType: string) {
  return { inlineData: { data: buffer.toString("base64"), mimeType } };
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.formData();
    const fileValue = data.get("file");
    const userId = data.get("userId") as string;

    if (!fileValue || !(fileValue instanceof File)) {
      return NextResponse.json({ error: "No file uploaded or invalid file type." }, { status: 400 });
    }
    if (!userId) {
      return NextResponse.json({ error: "User ID is required to save results." }, { status: 400 });
    }

    const file: File = fileValue;
    const buffer = Buffer.from(await file.arrayBuffer());

    // --- NEW: UPLOAD FILE TO SUPABASE STORAGE ---
    const filePath = `soil-cards/${userId}/${Date.now()}_${file.name}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('soil_health_cards') // Assumes a bucket named 'soil_health_cards'
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Supabase storage upload error:", uploadError);
      throw new Error("Failed to upload soil health card.");
    }

    // --- NEW: GET PUBLIC URL OF THE UPLOADED FILE ---
    const { data: urlData } = supabase.storage
      .from('soil_health_cards')
      .getPublicUrl(filePath);

    const fileUrl = urlData.publicUrl;


    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
      As an expert agricultural analyst, examine this image of a Soil Health Card.
      Extract all available values precisely: pH, EC, Organic Carbon (OC), Nitrogen (N), Phosphorus (P), Potassium (K), Sulphur (S), Calcium (Ca), Magnesium (Mg), Zinc (Zn), Boron (B), Iron (Fe), Manganese (Mn), and Copper (Cu).
      The units for N, P, K are typically kg/ha. The units for S, Zn, B, Fe, Mn, Cu are typically ppm or mg/kg. OC, Ca, Mg are typically in percent (%). EC is in dS/m or mS/cm.
      If a value is not present, set it to 0.
      Respond ONLY with a valid JSON object in the following format. Do not include any other text, explanations, or markdown formatting.
      
      {
        "ph": <number>, "ec": <number>, "oc": <number>, "n": <number>, "p": <number>, "k": <number>,
        "s": <number>, "ca": <number>, "mg": <number>, "zn": <number>, "b": <number>, "fe": <number>,
        "mn": <number>, "cu": <number>
      }
    `;

    const imagePart = fileToGenerativePart(buffer, file.type);
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [imagePart, { text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" },
    });

    let responseText = result.response.text();
    const cleanedJsonString = responseText.replace(/^```json\s*/, '').replace(/```$/, '');
    const parsedJson = JSON.parse(cleanedJsonString);

    // --- MODIFIED: DATABASE INSERTION LOGIC ---
    const { error: insertError } = await supabase.from('soil_reports').insert({
      user_id: userId,
      report_type: 'card_upload',
      card_image_url: fileUrl, // NEW: Save the file URL
      ...parsedJson
    });


    if (insertError) {
      console.error("Supabase insert error (soil_reports):", insertError);
      // Continue even if DB insert fails to not block the user
    }

    return NextResponse.json(parsedJson);

  } catch (error: any) {
    console.error("Error in soil card analysis route:", error);
    return NextResponse.json(
      { error: "Failed to analyze soil card image on the server." },
      { status: 500 }
    );
  }
}