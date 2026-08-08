export async function callAI(options: {
  model: string;
  messages: any[];
  response_format?: any;
  max_tokens?: number;
}): Promise<any> {
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  const openAiKey = Deno.env.get("OPENAI_API_KEY");
  
  let endpoint = "https://api.openai.com/v1/chat/completions";
  let key = openAiKey;
  let model = options.model;

  // Prefer Gemini if available and model requested is a Gemini model
  if (geminiKey && model.includes("gemini")) {
    endpoint = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
    key = geminiKey;
    model = model.replace("google/", ""); // Remove OpenRouter prefix if present
  } else if (!openAiKey && geminiKey) {
     // Fallback to gemini if OpenAI is not configured
     endpoint = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
     key = geminiKey;
     model = "gemini-2.5-flash"; // default fallback
  }

  if (!key) throw new Error("No AI API key configured (need GEMINI_API_KEY or OPENAI_API_KEY)");

  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...options,
        model,
      }),
    });

    if (res.status === 429) {
      const errorText = await res.text();
      console.warn(`[AI Retry] Rate limit hit (attempt ${attempt + 1}): ${errorText}`);
      if (attempt === maxRetries - 1) {
         if (model.includes("pro")) {
            console.warn("[AI Fallback] Falling back from pro to flash model");
            model = model.replace("pro", "flash");
            attempt = 0; // Reset attempts for fallback
            continue;
         }
         throw new Error(`Rate limit exceeded: ${errorText}`);
      }
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      continue;
    }

    if (!res.ok) {
       throw new Error(`AI Error ${res.status}: ${await res.text()}`);
    }

    return await res.json();
  }
}
