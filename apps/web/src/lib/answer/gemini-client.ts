type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

const REQUEST_TIMEOUT_MS = 45_000;
const MAX_RETRIES = 1;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractJsonText(response: GeminiGenerateResponse) {
  const text = response.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  return text;
}

export async function generateGeminiJson(input: {
  apiKey: string;
  model: string;
  prompt: string;
  terminologyGrounding?: boolean;
}) {
  const modelPath = input.model.startsWith("models/")
    ? input.model
    : `models/${input.model}`;
  const url = new URL(
    `https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent`,
  );
  url.searchParams.set("key", input.apiKey);

  const groundingModes = input.terminologyGrounding ? [true, false] : [false];

  for (const useGrounding of groundingModes) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const body: Record<string, unknown> = {
      contents: [
        {
          role: "user",
          parts: [{ text: input.prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    };

    if (useGrounding) {
      body.tools = [{ google_search: {} }];
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;

        if (useGrounding && response.status === 400) {
          break;
        }

        if (retryable && attempt < MAX_RETRIES) {
          await wait(600 * 2 ** attempt);
          continue;
        }

        throw new Error(`Gemini answer generation failed with status ${response.status}.`);
      }

      return extractJsonText((await response.json()) as GeminiGenerateResponse);
    } catch (error) {
      const retryable =
        error instanceof DOMException && error.name === "AbortError";

      if (retryable && attempt < MAX_RETRIES) {
        await wait(600 * 2 ** attempt);
        continue;
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  }

  throw new Error("Gemini answer generation failed.");
}
