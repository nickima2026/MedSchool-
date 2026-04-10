// =============================================================================
// MSIB.io — AI Transcript Summarizer (Medical Learning Focus)
// File: api/summarize.js
//
// Takes a lecture transcript and returns structured key points using Claude:
//   - Key Learning Points
//   - Clinical Pearls
//   - Key Terminology & Definitions
//   - Concise Summary
//   - Potential Exam Questions
//
// Requires ANTHROPIC_API_KEY environment variable set in Vercel.
//
// Usage: POST /api/summarize
// Body:  { "transcript": "...", "title": "optional lecture title" }
// Returns: { ok, analysis: { summary, keyPoints[], clinicalPearls[],
//            terminology[], examQuestions[] } }
// =============================================================================

export const config = { runtime: 'nodejs', maxDuration: 60 };

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'POST only' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      ok: false,
      error: 'AI service not configured. Add ANTHROPIC_API_KEY to Vercel environment variables.',
    });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ ok: false, error: 'Invalid JSON body' });
  }

  const { transcript, title } = body;
  if (!transcript || transcript.length < 50) {
    return res.status(400).json({
      ok: false,
      error: 'Transcript too short. Provide at least 50 characters.',
    });
  }

  // Truncate very long transcripts to stay within token limits
  const maxChars = 80000;
  const truncated = transcript.length > maxChars
    ? transcript.slice(0, maxChars) + '\n\n[Transcript truncated for processing]'
    : transcript;

  const titleContext = title ? `\nLecture title: "${title}"\n` : '';

  const systemPrompt = `You are an expert medical education AI assistant used by medical students studying at top medical schools. Your job is to analyze lecture transcripts and extract structured, high-yield study material.

You must respond with ONLY valid JSON — no markdown, no code fences, no explanation outside the JSON. The JSON must follow this exact schema:

{
  "summary": "A 2-3 paragraph concise summary of the lecture's main content and significance",
  "keyPoints": ["Array of 5-10 key learning objectives or takeaways, each 1-2 sentences"],
  "clinicalPearls": ["Array of 3-7 practical clinical insights, diagnostic tips, or management pearls that would be valuable in clinical practice"],
  "terminology": [{"term": "Medical term", "definition": "Clear, concise definition relevant to this lecture context"}],
  "examQuestions": [{"question": "A USMLE-style question based on lecture content", "answer": "The correct answer with brief explanation"}]
}

Guidelines:
- Focus on HIGH-YIELD material that would appear on USMLE/COMLEX exams
- Clinical pearls should be practical and actionable
- Terminology should include 5-10 key terms with definitions
- Generate 3-5 exam-style questions (mix of basic science and clinical vignette style)
- Use precise medical language appropriate for medical students
- If the content is not medical, adapt the format: use "Key Concepts" instead of "Clinical Pearls" and "Review Questions" instead of exam questions`;

  const userMessage = `Analyze this medical lecture transcript and extract structured study material.${titleContext}

TRANSCRIPT:
${truncated}`;

  try {
    console.log(`[summarize] Processing transcript: ${transcript.length} chars${title ? `, title: "${title}"` : ''}`);

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`[summarize] Anthropic API error: ${response.status}`, errBody);
      return res.status(502).json({
        ok: false,
        error: `AI service error (${response.status}). Please try again.`,
      });
    }

    const result = await response.json();
    const text = result.content?.[0]?.text;

    if (!text) {
      return res.status(502).json({
        ok: false,
        error: 'AI returned empty response. Please try again.',
      });
    }

    // Parse the JSON response from Claude
    let analysis;
    try {
      // Claude might wrap in code fences despite instructions — strip them
      const cleaned = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
      analysis = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('[summarize] Failed to parse Claude response as JSON:', text.slice(0, 500));
      // Return the raw text as a fallback
      return res.status(200).json({
        ok: true,
        format: 'text',
        analysis: { rawText: text },
        inputChars: transcript.length,
        model: result.model,
      });
    }

    console.log(`[summarize] Success: ${analysis.keyPoints?.length || 0} key points, ${analysis.examQuestions?.length || 0} questions`);

    return res.status(200).json({
      ok: true,
      format: 'structured',
      analysis,
      inputChars: transcript.length,
      model: result.model,
      usage: result.usage,
    });

  } catch (err) {
    console.error('[summarize] Unexpected error:', err.message);
    return res.status(500).json({
      ok: false,
      error: `Processing failed: ${err.message}`,
    });
  }
}
