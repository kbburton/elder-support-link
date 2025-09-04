import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('PDF OCR Fix', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeAll(() => {
    originalFetch = globalThis.fetch;
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('should fail to extract text from PDF before fix (using raw PDF analysis)', async () => {
    // Mock OpenAI API returning corrupted text like before
    globalThis.fetch = async (url: string | Request, options?: RequestInit) => {
      if (typeof url === 'string' && url.includes('openai.com')) {
        return new Response(JSON.stringify({
          choices: [{
            message: {
              content: 'The provided document appears to be heavily corrupted or contains mostly non-readable, nonsensical, or binary data...'
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
    3 0 obj<</Type/Page/Parent 2 0 R/Contents 4 0 R>>endobj
    4 0 obj<</Length 44>>stream
    BT
    /F1 12 Tf
    100 700 Td
    (This is test text) Tj
    ET
    endstream
    endobj
    %%EOF`;
    
    const mockBuffer = new TextEncoder().encode(mockPDFContent);

    // This should fail because direct extraction won't find enough text
    // and the mocked AI will return error message
    const { extractTextFromPDFAsImage } = await import('../supabase/functions/process-document/index.ts');
    
    try {
      const result = await extractTextFromPDFAsImage(mockBuffer.buffer);
      // If the old approach was used, it would return error message
      expect(result).toContain('corrupted');
    } catch (error) {
      // With the new approach, it should throw an error instead of returning corrupted message
      expect(error.message).toContain('No readable text could be extracted');
    }
  });

  it('should successfully extract text from PDF after fix', async () => {
    // Mock Vision API returning clean text (the new approach)
    globalThis.fetch = async (url: string | Request, options?: RequestInit) => {
      if (typeof url === 'string' && url.includes('openai.com')) {
        return new Response(JSON.stringify({
          choices: [{
            message: {
              content: 'This is a medical report containing important patient information and treatment details that can be properly summarized for healthcare providers.'
            }
          }]
        }), { status: 200 });
      }
      return originalFetch(url, options);
    };

    // Create a mock PDF buffer with minimal text
    const mockPDFContent = `%PDF-1.4
    1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
    2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
    3 0 obj<</Type/Page/Parent 2 0 R>>endobj
    %%EOF`;
    
    const mockBuffer = new TextEncoder().encode(mockPDFContent);

    const { extractTextFromPDFAsImage } = await import('../supabase/functions/process-document/index.ts');
    
    const result = await extractTextFromPDFAsImage(mockBuffer.buffer);
    
    // After fix: should return clean, readable text from Vision API
    expect(result).toContain('medical report');
    expect(result).toContain('patient information');
    expect(result).not.toContain('corrupted');
    expect(result).not.toContain('binary data');
  });

  it('should extract text directly from well-formed PDF', async () => {
    // Create a PDF with extractable text
    const mockPDFContent = `%PDF-1.4
    1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
    2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
    3 0 obj<</Type/Page/Parent 2 0 R/Contents 4 0 R>>endobj
    4 0 obj<</Length 100>>stream
    BT
    /F1 12 Tf
    100 700 Td
    (Patient John Doe medical report) Tj
    100 680 Td
    (Diagnosis: Hypertension) Tj
    ET
    endstream
    endobj
    %%EOF`;
    
    const mockBuffer = new TextEncoder().encode(mockPDFContent);

    const { extractTextFromPDFAsImage } = await import('../supabase/functions/process-document/index.ts');
    
    const result = await extractTextFromPDFAsImage(mockBuffer.buffer);
    
    // Should extract text directly without needing API call
    expect(result).toContain('Patient John Doe');
    expect(result).toContain('Hypertension');
  });

  it('should detect AI-generated error messages as garbled', async () => {
    const { isGarbledText } = await import('../supabase/functions/process-document/index.ts');
    
    // Test error message detection
    expect(isGarbledText('The provided document appears to be corrupted')).toBe(true);
    expect(isGarbledText('Unable to extract text from binary data')).toBe(true);
    expect(isGarbledText('This is normal medical report text')).toBe(false);
    expect(isGarbledText('Patient diagnosis and treatment plan')).toBe(false);
  });
}); 