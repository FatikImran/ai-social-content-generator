// api/generate.js
export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { topic, platform, tone, additional } = req.body;

    // Validation
    if (!topic || !platform || !tone) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get HuggingFace token from environment variable
    const HF_TOKEN = process.env.HUGGINGFACE_API_TOKEN;

    if (!HF_TOKEN) {
        return res.status(500).json({ error: 'Server configuration error' });
    }

    // Build the prompt
    const systemPrompt = `You are a creative social media content generator. Generate exactly 5 unique, engaging captions for ${platform} posts.`;

    const userPrompt = `Generate 5 unique and engaging ${platform} captions about "${topic}" in a ${tone} tone.

${additional ? `Additional context: ${additional}` : ''}

Requirements:
- Each caption should be creative and different
- Include relevant hashtags where appropriate
- Keep appropriate length for ${platform}
- Match the ${tone} tone consistently
- Number each caption (1-5)

Format each caption clearly with numbers 1-5.`;

    try {
        // Call NEW HuggingFace Router API (OpenAI-compatible)
        const response = await fetch(
            'https://router.huggingface.co/v1/chat/completions',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${HF_TOKEN}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'meta-llama/Llama-3.2-3B-Instruct',
                    messages: [
                        {
                            role: 'system',
                            content: systemPrompt
                        },
                        {
                            role: 'user',
                            content: userPrompt
                        }
                    ],
                    max_tokens: 800,
                    temperature: 0.8,
                    top_p: 0.9
                })
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || errorData.error || 'HuggingFace API error');
        }

        const data = await response.json();

        // Extract generated text from OpenAI-compatible response
        let generatedText = '';
        if (data.choices && data.choices[0]?.message?.content) {
            generatedText = data.choices[0].message.content;
        } else {
            throw new Error('Unexpected API response format');
        }

        // Parse captions
        const captions = parseCaptions(generatedText);

        if (captions.length === 0) {
            throw new Error('Failed to parse captions from AI response');
        }

        // Return captions
        return res.status(200).json({
            captions: captions.slice(0, 5),
            success: true
        });

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({
            error: error.message || 'Failed to generate content',
            success: false
        });
    }
}

function parseCaptions(text) {
    const captions = [];

    // Method 1: Split by numbered lines (1., 2., 3., etc.)
    const numberedSplit = text.split(/\n\s*\d+\.\s+/);
    if (numberedSplit.length > 1) {
        numberedSplit.slice(1).forEach(caption => {
            const cleaned = caption.split(/\n\n+/)[0].trim();
            if (cleaned && cleaned.length > 10) {
                captions.push(cleaned);
            }
        });
    }

    // Method 2: Try splitting by double newlines
    if (captions.length === 0) {
        const paragraphs = text.split(/\n\n+/);
        paragraphs.forEach(para => {
            const cleaned = para.replace(/^\d+\.\s*/, '').trim();
            if (cleaned && cleaned.length > 20) {
                captions.push(cleaned);
            }
        });
    }

    // Method 3: Try splitting by single newlines if we still have nothing
    if (captions.length === 0) {
        const lines = text.split(/\n/);
        lines.forEach(line => {
            const cleaned = line.replace(/^\d+[\.\)]\s*/, '').trim();
            if (cleaned && cleaned.length > 20) {
                captions.push(cleaned);
            }
        });
    }

    return captions;
}