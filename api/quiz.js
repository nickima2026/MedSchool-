export const config = { runtime: 'edge' };

export default async function handler(req) {
  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Check for API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ fallback: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { action } = body;

  if (action === 'generate') {
    return handleGenerate(body, apiKey);
  } else if (action === 'evaluate') {
    return handleEvaluate(body, apiKey);
  } else {
    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleGenerate(body, apiKey) {
  const { notesHtml } = body;

  // Strip HTML tags to get plain text
  const plainText = notesHtml
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 6000); // Limit context size

  if (!plainText || plainText.length < 20) {
    return new Response(JSON.stringify({ fallback: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const prompt = `You are a medical education assistant. Based on the following student notes, generate exactly 5 quiz questions to test understanding.

NOTES:
${plainText}

Return ONLY a valid JSON array with exactly 5 objects. Each object must have these fields:
- "question": a clear, specific question about the material
- "answer": the correct answer (concise, 1-3 sentences)
- "explanation": why this answer is correct (1-2 sentences)
- "sourceText": a short quote (under 20 words) from the notes that contains the answer

Example format:
[
  {
    "question": "What is the primary function of X?",
    "answer": "X primarily functions to...",
    "explanation": "This is important because...",
    "sourceText": "exact short quote from notes"
  }
]

Return only the JSON array, no other text.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ fallback: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();
    const text = data.content[0].text.trim();

    // Parse the JSON array from Claude's response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ fallback: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const questions = JSON.parse(jsonMatch[0]);
    return new Response(JSON.stringify({ questions }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ fallback: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleEvaluate(body, apiKey) {
  const { question, correctAnswer, studentAnswer } = body;

  if (!studentAnswer || studentAnswer.trim().length === 0) {
    return new Response(JSON.stringify({
      correct: false,
      score: 0,
      feedback: 'No answer provided.',
      hint: 'Try to answer the question based on your notes.'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const prompt = `You are a medical education evaluator. Assess whether a student's answer is correct.

QUESTION: ${question}
CORRECT ANSWER: ${correctAnswer}
STUDENT ANSWER: ${studentAnswer}

Evaluate the student's answer and return ONLY a valid JSON object with these fields:
- "correct": boolean (true if the student answer captures the key concepts, false otherwise)
- "score": number from 0 to 100 (percentage of correctness)
- "feedback": encouraging feedback string (1-2 sentences explaining what was right or wrong)
- "hint": if incorrect, a helpful hint pointing to where to look in the notes (1 sentence); if correct, empty string

Return only the JSON object, no other text.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      // Fall back to simple keyword matching
      return new Response(JSON.stringify({ fallback: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();
    const text = data.content[0].text.trim();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ fallback: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = JSON.parse(jsonMatch[0]);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ fallback: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
