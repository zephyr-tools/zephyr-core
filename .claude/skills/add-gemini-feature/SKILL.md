---
name: add-gemini-feature
description: Scaffold a new Gemini AI-powered feature with grounded web search, structured JSON output, caching, and fallback. Use when adding AI-powered lookups or analysis.
allowed-tools: Read, Write, Edit, Grep, Glob, Bash
---

# Add Gemini Feature: $ARGUMENTS

Create a new Gemini-powered feature called `$ARGUMENTS` with grounded search and structured output.

## Steps — implement in order:

### 1. Define the response schema and type

In `src/shared/types.ts`, add the return interface:
```ts
export interface MyFeatureResult {
  // ... fields
  origin: 'gemini' | 'none';
}
```

### 2. Implement the Gemini call

In the appropriate service file (usually `src/main/details.ts` or a new service), add:

```ts
import { GoogleGenAI, Type } from '@google/genai';

const GEMINI_MODEL = 'gemini-3.1-flash-lite-preview';

const MY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    field1: { type: Type.STRING, description: 'Clear description for the model' },
    field2: { type: Type.ARRAY, items: { type: Type.STRING }, description: '...' },
  },
  required: ['field1'],
} as const;

async function fetchMyFeature(input: string, apiKey: string): Promise<MyFeatureResult> {
  const ai = new GoogleGenAI({ apiKey });
  const res = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{
      role: 'user',
      parts: [{
        text: `Your prompt about "${input}". Search the web for current information.`,
      }],
    }],
    config: {
      temperature: 0.2,              // low for factual queries
      tools: [{ googleSearch: {} }],  // grounded web search
      responseMimeType: 'application/json',
      responseSchema: MY_SCHEMA,
    },
  });

  const text = res.text?.trim();
  if (!text) return { origin: 'none' };
  const parsed = JSON.parse(text) as { field1?: string; field2?: string[] };
  return { field1: parsed.field1 ?? '', field2: parsed.field2 ?? [], origin: 'gemini' };
}
```

### 3. Add caching + inflight dedup in the service class

```ts
private myCache = new Map<string, MyFeatureResult>();
private myInflight = new Map<string, Promise<MyFeatureResult>>();

getMyFeature(input: string): Promise<MyFeatureResult> {
  const key = input.toLowerCase().trim();
  if (this.myCache.has(key)) return Promise.resolve(this.myCache.get(key)!);

  const existing = this.myInflight.get(key);
  if (existing) return existing;

  const apiKey = this.getApiKey();
  if (!apiKey) return Promise.resolve({ origin: 'none' });

  const none: MyFeatureResult = { origin: 'none' };
  const promise = fetchMyFeature(input, apiKey)
    .then((r) => { this.myCache.set(key, r); return r; })
    .catch((err) => {
      console.warn(`[myFeature] failed: ${(err as Error).message}`);
      this.myCache.set(key, none);
      return none;
    })
    .finally(() => this.myInflight.delete(key));

  this.myInflight.set(key, promise);
  return promise;
}
```

### 4. Wire up IPC + bridge
Use `/add-ipc-channel` to expose the feature to the renderer.

### 5. Add UI
Use `useQuery` in the renderer with `enabled: !!dependency` to auto-fire when ready:
```tsx
const result = useQuery({
  queryKey: ['my-feature', input],
  queryFn: () => window.api.getMyFeature(input),
  enabled: !!input,
  staleTime: 24 * 60 * 60_000,
  retry: 0,
});
```

### 6. Verify
Run `npm run typecheck && npm run lint`.

## Conventions
- Model: `gemini-3.1-flash-lite-preview` (fast, cheap, good structured output)
- Always use `responseMimeType: 'application/json'` + `responseSchema`
- Always enable `googleSearch` tool for factual queries
- Temperature 0.1–0.3 for factual, 0.5–0.8 for creative
- API key via `this.getApiKey()` getter — never stored directly
- Graceful fallback: return `{ origin: 'none' }` when unavailable
