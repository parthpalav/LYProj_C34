import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_MODELS } from './AgentService.js';

// Thrown whenever Gemini cannot give a usable answer (no key, quota, timeout, bad JSON).
// Callers catch it and take their own fallback.
export class GeminiUnavailableError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'GeminiUnavailableError';
    this.status = status;
  }
}

let workingModel = null;

/**
 * Ask Gemini for JSON matching `schema`.
 * @param {object} opts
 * @param {Array<string|object>} opts.parts  Prompt text and/or { inlineData: { data, mimeType } } parts
 * @param {object} opts.schema               Gemini responseSchema (OpenAPI subset)
 * @param {number} [opts.timeoutMs=30000]  Total budget across all models tried
 * @returns {Promise<any>} Parsed JSON
 */
export async function generateJson({ parts, schema, timeoutMs = 30000 }) {
  const deadline = Date.now() + timeoutMs;
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) throw new GeminiUnavailableError('GEMINI_API_KEY is not set');

  const genAI = new GoogleGenerativeAI(apiKey);
  let lastError = null;
  for (const name of [...new Set([workingModel, ...GEMINI_MODELS].filter(Boolean))]) {
    const remaining = deadline - Date.now();
    if (remaining < 2000) break;
    try {
      const model = genAI.getGenerativeModel(
        { model: name, generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0 } },
        { timeout: remaining }
      );
      const result = await model.generateContent(parts);
      const parsed = JSON.parse(result.response.text());
      workingModel = name;
      return parsed;
    } catch (error) {
      lastError = error;
      console.warn(`[gemini-json] ${name} failed:`, error?.message || error);
      // Same rule as AgentService: bad request, auth and quota errors repeat on every model.
      if ([400, 401, 403, 429].includes(error?.status)) break;
    }
  }
  throw new GeminiUnavailableError(lastError?.message || 'No Gemini model answered', lastError?.status);
}
