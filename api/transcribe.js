export const config = {
  runtime: 'edge',
};

// Known Whisper silence/outro hallucination patterns
const HALLUCINATION_PATTERNS = [
  /^terima kasih[\s\.\!\?]*$/i,
  /^terimakasih[\s\.\!\?]*$/i,
  /^terima kasih banyak[\s\.\!\?]*$/i,
  /^terima kasih telah menonton[\s\.\!\?]*$/i,
  /^terima kasih sudah menonton.*$/i,
  /^thank you[\s\.\!\?]*$/i,
  /^thank you very much[\s\.\!\?]*$/i,
  /^thanks for watching.*$/i,
  /^subtitles by.*$/i,
  /^\.+$/
];

export default async function handler(request) {
  // Only allow POST
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      return new Response(
        JSON.stringify({
          error: 'GROQ_API_KEY environment variable is not set on Vercel. Please add it in your Vercel Project Settings > Environment Variables.',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') || formData.get('audio');
    const language = formData.get('language') || 'id';

    if (!file) {
      return new Response(JSON.stringify({ error: 'No audio file provided.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Forward to Groq's Whisper API using your private server-side key
    const groqFormData = new FormData();
    groqFormData.append('file', file);
    groqFormData.append('model', 'whisper-large-v3');
    groqFormData.append('language', language);
    groqFormData.append('temperature', '0.0');

    // Prompt priming: Guides Whisper away from YouTube outro hallucinations ("Terima kasih", "Thank you for watching")
    const promptText = language === 'id'
      ? 'Transkripsi percakapan sehari-hari bahasa Indonesia. Jangan menambahkan teks penutup atau terima kasih jika tidak diucapkan.'
      : 'Direct speech dictation transcript. Do not hallucinate outro text or thank you.';
    groqFormData.append('prompt', promptText);

    const groqResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
      },
      body: groqFormData,
    });

    const result = await groqResponse.json();

    if (!groqResponse.ok) {
      return new Response(
        JSON.stringify({ error: result.error?.message || 'Groq transcription error' }),
        {
          status: groqResponse.status,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    let cleanText = (result.text || '').trim();

    // Filter out known silence/hallucination artifacts
    const isHallucination = HALLUCINATION_PATTERNS.some((pattern) => pattern.test(cleanText));
    if (isHallucination) {
      cleanText = '';
    }

    return new Response(JSON.stringify({ text: cleanText }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error while transcribing' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
