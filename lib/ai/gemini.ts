import { GoogleGenerativeAI } from '@google/generative-ai';

interface ReceiptItem {
    name: string;
    price: number;
}

interface ReceiptData {
    items: ReceiptItem[];
    total: number;
    date?: string;
    merchant?: string;
}

export async function scanReceipt(imageBase64: string): Promise<ReceiptData> {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
        throw new Error('GOOGLE_AI_API_KEY is not defined');
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // Use the cost-effective and fast 'gemini-2.5-flash' model
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
    Analyze this receipt image and extract the following information in strict JSON format:
    - items: array of { name: string, price: number } - Include ALL line items from the receipt
    - total: number (the final total amount)
    - date: string (YYYY-MM-DD format if available)
    - merchant: string (name of the store/restaurant)

    IMPORTANT: The items array MUST include:
    - All food/product items
    - Tax (as a separate item with name "Tax")
    - Tip/Gratuity (as a separate item with name "Tip" if present)
    - Service charges or fees (if present)
    - Subtotals should NOT be included as items

    Do not include markdown formatting like \`\`\`json. Just return the raw JSON object.
  `;

    // Prepare the image part
    const imagePart = {
        inlineData: {
            data: imageBase64,
            mimeType: 'image/jpeg', // Assuming JPEG for now, can be dynamic
        },
    };

    try {
        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        const text = response.text();

        // Clean up any potential markdown code blocks
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();

        return JSON.parse(cleanText) as ReceiptData;
    } catch (error) {
        console.error('Gemini Scan Error:', error);
        throw new Error('Failed to process receipt image');
    }
}
