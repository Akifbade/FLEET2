
import { GoogleGenAI } from "@google/genai";
import { Job, ReceiptEntry, Driver } from "../types";

// Initialize the Google GenAI SDK with the provided API key from environment variables
// Use import.meta.env for Vite (browser environment)
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';

// Only initialize if API key is available
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

/**
 * Analyzes fleet data using Gemini AI to provide a professional summary for the fleet manager.
 * @param drivers List of drivers in the fleet
 * @param jobs List of jobs (trips)
 * @param fuelEntries List of receipts/expense entries
 * @returns A string containing the AI-generated performance summary
 */
export const getPerformanceSummary = async (drivers: Driver[], jobs: Job[], fuelEntries: ReceiptEntry[]) => {
  try {
    // Check if AI is initialized
    if (!ai) {
      console.warn('Gemini AI not configured - API key missing');
      return 'AI analysis unavailable. Please configure VITE_GEMINI_API_KEY.';
    }
    
    // Generate analysis using the gemini-3-flash-preview model
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `
        Analyze this fleet data and provide a concise professional summary for the fleet manager.
        Drivers: ${JSON.stringify(drivers)}
        Jobs: ${JSON.stringify(jobs)}
        Fuel Data: ${JSON.stringify(fuelEntries)}
        
        Focus on:
        1. Operational efficiency.
        2. Fuel cost anomalies.
        3. Driver performance highlights.
        4. Recommendations for improvement.
        Keep it professional and action-oriented.
      `,
    });
    // Extract the text content directly from the response object's text property
    return response.text || "No insights could be generated from the current data.";
  } catch (error) {
    console.error("AI Analysis failed:", error);
    return "Unable to generate AI insights at this time.";
  }
};
