import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Enhanced AgentService — Generative AI Contextual Financial Coaching
 * Uses Google Gemini 1.5 Flash to synthesize FMI, goals, envelopes,
 * and alerts into an empathetic, highly structured financial oracle response.
 */
async function generateResponse(userInput, context = {}) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is missing from environment.");
      return "Hello! I am Finaura, your AI financial twin. It seems my core Generative AI uplink (GEMINI_API_KEY) is currently missing or disconnected. Once it is added to the backend environment, I can provide deeply personalized financial strategies!";
    }

    const { fmi, alerts = [], goals = [], envelope, recentSpending = [] } = context;

    // Construct the persona and data context
    const systemPrompt = `
      You are FINAURA, a highly advanced, empathetic, and proactive financial digital twin designed to guide the user to financial stability and wealth.
      You are NOT a standard AI language model; you act strictly as an elite, personal financial confidant in a chat interface. Keep responses concise (under 3-4 short paragraphs), highly actionable, and formatted elegantly with appropriate emojis. Do not output raw markdown intended for complex web rendering, keep it chat-friendly. Use a firm, encouraging, premium tone.

      === CURRENT USER FINANCIAL STATE ===
      - Financial Mood Index (FMI): ${fmi?.score ?? 'Unknown'}/100 (Below 50 is critical stress, Above 70 is thriving).
      - FMI Deviation Details: ${fmi?.factors?.join(', ') || 'None highlighted'}
      
      - Active Goals: ${goals.length > 0 ? goals.map(g => `"${g.name}" (Target: ₹${g.targetAmount}, Saved: ₹${g.savedAmount})`).join(', ') : 'No goals found.'}
      
      - Active System Alerts: ${alerts.length > 0 ? alerts.map(a => a.message).join(' | ') : 'No critical alerts.'}
      
      - Master Savings Vault: ${envelope ? `₹${envelope.savings} (Target: ₹${envelope.targetSavings})` : 'Not configured.'}
      - Top Envelopes: ${envelope ? `Rent: ₹${envelope.rent}, Food: ₹${envelope.food}` : 'None'}
      
      If the user is overspending, point it out gently. 
      If their FMI is low, prioritize suggesting 'No-Spend Days' or micro-savings roundups.
      If their FMI is high, encourage investing or rewarding themselves modestly.
    `;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: systemPrompt // Use native system instructions for Gemini
    });

    const result = await model.generateContent(userInput || "Give me a quick financial health summary.");
    return result.response.text();
    
  } catch (error) {
    console.error("AgentService Gemini Error:", error);
    return "I am currently syncing with my global intelligence network. Let's focus on maintaining your core metrics today. Try asking me again in a moment.";
  }
}

export { generateResponse };
