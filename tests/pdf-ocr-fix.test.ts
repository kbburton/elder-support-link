import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('PDF OCR Fix', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeAll(() => {
    originalFetch = globalThis.fetch;
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('should fail to extract text from PDF before fix', async () => {
    // Mock Vision API returning garbled text (the old behavior)
    globalThis.fetch = async (url: string | Request, options?: RequestInit) => {
      if (typeof url === 'string' && url.includes('openai.com')) {
        return new Response(JSON.stringify({
          choices: [{
            message: {
              content: '¢€ (¢€ (¢€ corrupted nonsensical characters rather than coherent text'
            }
          }]
        }), { status: 200 });
      }
      return originalFetch(url, options);
    };

    // Create a mock PDF buffer
    const mockPDFContent = `%PDF-1.4
    1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
    2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
    3 0 obj<</Type/Page/Parent 2 0 R>>endobj
    %%EOF`;
    
    const mockBuffer = new TextEncoder().encode(mockPDFContent);

    // Import the OLD function that would fail
    const { extractTextFromPDFAsImage } = await import('../supabase/functions/process-document/index.ts');
    
    try {
      await extractTextFromPDFAsImage(mockBuffer.buffer);
      expect.fail('Should have thrown an error for garbled text');
    } catch (error) {
      expect(error.message).toContain('No readable text could be extracted');
    }
  });

  it('should successfully extract text from PDF after fix', async () => {
    // Mock Vision API returning clean text (the new behavior)
    globalThis.fetch = async (url: string | Request, options?: RequestInit) => {
      if (typeof url === 'string' && url.includes('openai.com')) {
        return new Response(JSON.stringify({
          choices: [{
            message: {
              content: 'This is a medical report containing patient information and diagnosis details that can be properly summarized.'
            }
          }]
        }), { status: 200 });
      }
      return originalFetch(url, options);
    };

    // Create a mock PDF buffer
    const mockPDFContent = `%PDF-1.4
    1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
    2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
    3 0 obj<</Type/Page/Parent 2 0 R>>endobj
    %%EOF`;
    
    const mockBuffer = new TextEncoder().encode(mockPDFContent);

    // Import the NEW function that should work
    const { extractTextFromPDFAsImage } = await import('../supabase/functions/process-document/index.ts');
    
    const result = await extractTextFromPDFAsImage(mockBuffer.buffer);
    
    // After fix: should return clean, readable text
    expect(result).toContain('medical report');
    expect(result).toContain('patient information');
    expect(result).not.toContain('¢€');
    expect(result).not.toContain('corrupted');
  });

  it('should detect garbled text correctly', async () => {
    const { isGarbledText } = await import('../supabase/functions/process-document/index.ts');
    
    // Test garbled text detection
    expect(isGarbledText('¢€ (¢€ (¢€ nonsensical')).toBe(true);
    expect(isGarbledText('This is normal readable text')).toBe(false);
    expect(isGarbledText('èÙf …‡ n 4‚î>ÃÄüª æ±è©@')).toBe(true);
    expect(isGarbledText('Medical report: Patient shows improvement')).toBe(false);
  });

  it('should handle Vision API errors gracefully', async () => {
    // Mock Vision API returning error
    globalThis.fetch = async (url: string | Request, options?: RequestInit) => {
      if (typeof url === 'string' && url.includes('openai.com')) {
        return new Response('Bad Request', { status: 400 });
      }
      return originalFetch(url, options);
    };

    const mockPDFContent = `%PDF-1.4
    1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
    %%EOF`;
    
    const mockBuffer = new TextEncoder().encode(mockPDFContent);
    
    const { extractTextFromPDFAsImage } = await import('../supabase/functions/process-document/index.ts');
    
    try {
      await extractTextFromPDFAsImage(mockBuffer.buffer);
      expect.fail('Should have thrown an error for API failure');
    } catch (error) {
      expect(error.message).toContain('PDF text extraction failed');
    }
  });
});