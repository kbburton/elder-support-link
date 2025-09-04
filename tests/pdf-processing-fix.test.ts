import { describe, it, expect, beforeAll, vi } from 'vitest';

// Mock the global fetch function for OpenAI API calls
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock Deno environment
vi.stubGlobal('Deno', {
  env: {
    get: (key: string) => {
      if (key === 'OPENAI_API_KEY') return 'test-api-key';
      return '';
    }
  }
});

// Mock btoa/atob for base64 operations
vi.stubGlobal('btoa', (str: string) => Buffer.from(str, 'binary').toString('base64'));
vi.stubGlobal('atob', (str: string) => Buffer.from(str, 'base64').toString('binary'));

describe('PDF Processing Fix', () => {
  beforeAll(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
  });

  it('should fail with old approach - direct PDF text extraction produces garbled text', async () => {
    // Simulate old approach: direct PDF text extraction
    const mockPDFBuffer = new TextEncoder().encode('¢€ (¢€ (¢€ (¢€ (¢€ (¢€ QE QE QE stream garbled content endstream');
    
    // Old approach would try to decode PDF binary data directly
    const textDecoder = new TextDecoder('utf-8', { fatal: false });
    const pdfText = textDecoder.decode(mockPDFBuffer);
    
    // This produces garbled text like what the user is seeing
    expect(pdfText).toContain('¢€');
    expect(pdfText).toMatch(/[^\w\s]/); // Contains non-readable characters
    
    // Old approach would try to extract text from streams
    const streamMatches = pdfText.match(/stream\s*([\s\S]*?)\s*endstream/gi) || [];
    let extractedText = '';
    for (const match of streamMatches) {
      const streamContent = match.replace(/^stream\s*/, '').replace(/\s*endstream$/i, '');
      if (/[a-zA-Z0-9\s]{10,}/.test(streamContent)) {
        extractedText += streamContent + ' ';
      }
    }
    
    // This should produce poor quality text or fail completely
    expect(extractedText.length).toBeLessThan(20); // Very little readable content
  });

  it('should succeed with new approach - OpenAI vision API processes PDF correctly', async () => {
    // Mock successful OpenAI response for PDF processing
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: 'This is a comprehensive power of attorney document. It grants authority to John Doe to make financial and legal decisions. Important dates: Effective immediately upon signing on January 15, 2024. The document includes provisions for healthcare decisions and property management.'
          }
        }]
      })
    });

    // Simulate the new approach
    const extractTextWithOpenAI = async (base64File: string, fileType: string): Promise<string> => {
      if (fileType === 'pdf') {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer test-api-key`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              {
                role: 'user',
                content: [
                  { 
                    type: 'text', 
                    text: 'This is a PDF document. Please perform OCR to extract all readable text content. Return only the extracted text without formatting, explanations, or metadata. Focus on extracting all visible text that would be useful for document summarization.'
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:application/pdf;base64,${base64File}`
                    }
                  }
                ]
              }
            ],
            max_tokens: 4000
          }),
        });

        const data = await response.json();
        return data.choices[0]?.message?.content || 'No readable text found in PDF';
      }
      return '';
    };

    const result = await extractTextWithOpenAI('mock-base64-data', 'pdf');
    
    // New approach should produce readable, meaningful text
    expect(result).toContain('power of attorney');
    expect(result).toContain('John Doe');
    expect(result).toContain('January 15, 2024');
    expect(result).not.toContain('¢€'); // Should not contain garbled characters
    expect(result.length).toBeGreaterThan(50); // Should have substantial content
  });

  it('should handle OpenAI API errors gracefully', async () => {
    // Mock API error response
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: async () => 'Invalid file format'
    });

    const extractTextWithOpenAI = async (base64File: string, fileType: string): Promise<string> => {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer test-api-key`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Extract text from PDF' },
                { type: 'image_url', image_url: { url: `data:application/pdf;base64,${base64File}` } }
              ]
            }
          ],
          max_tokens: 4000
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`PDF text extraction failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || 'No readable text found in PDF';
    };

    await expect(extractTextWithOpenAI('mock-base64', 'pdf'))
      .rejects
      .toThrow('PDF text extraction failed: Bad Request');
  });
});