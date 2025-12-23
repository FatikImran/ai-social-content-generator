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
    const prompt = `Generate 5 unique and engaging ${platform} captions about "${topic}" in a ${tone} tone.

${additional ? `Additional context: ${additional}` : ''}

Requirements:
- Each caption should be creative and different
- Include relevant hashtags where appropriate
- Keep appropriate length for ${platform}
- Match the ${tone} tone consistently
- Number each caption (1-5)

Format:
1. [First caption with hashtags]

2. [Second caption with hashtags]

3. [Third caption with hashtags]

4. [Fourth caption with hashtags]

5. [Fifth caption with hashtags]

Generate the captions now:`;

    try {
        // Call HuggingFace API
        const response = await fetch(
            'https://api-inference.huggingface.co/models/meta-llama/Llama-3.2-3B-Instruct',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${HF_TOKEN}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    inputs: prompt,
                    parameters: {
                        max_new_tokens: 800,
                        temperature: 0.8,
                        top_p: 0.9,
                        return_full_text: false
                    }
                })
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'HuggingFace API error');
        }

        const data = await response.json();
        
        // Extract generated text
        let generatedText = '';
        if (Array.isArray(data) && data[0]?.generated_text) {
            generatedText = data[0].generated_text;
        } else if (data.generated_text) {
            generatedText = data.generated_text;
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
    
    // Method 1: Split by numbered lines
    const numberedSplit = text.split(/\n\d+\.\s+/);
    if (numberedSplit.length > 1) {
        numberedSplit.slice(1).forEach(caption => {
            const cleaned = caption.split(/\n\n+/)[0].trim();
            if (cleaned) captions.push(cleaned);
        });
    }
    
    // Method 2: If method 1 didn't work, try splitting by double newlines
    if (captions.length === 0) {
        const paragraphs = text.split(/\n\n+/);
        paragraphs.forEach(para => {
            const cleaned = para.replace(/^\d+\.\s*/, '').trim();
            if (cleaned && cleaned.length > 20) {
                captions.push(cleaned);
            }
        });
    }

    return captions;
}