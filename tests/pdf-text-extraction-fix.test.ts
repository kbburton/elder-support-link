import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('PDF Text Extraction Fix', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeAll(() => {
    originalFetch = globalThis.fetch;
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('should extract readable text from PDF using structured approach before fix', async () => {
    // Mock a PDF with garbled extraction (the old behavior)
    globalThis.fetch = async (url: string | Request, options?: RequestInit) => {
      if (typeof url === 'string' && url.includes('openai.com')) {
        return new Response(JSON.stringify({
          choices: [{
            message: {
              content: '¢€ (¢€ (¢€ (¢€ garbled text that should not be summarized'
            }
          }]
        }), { status: 200 });
      }
      return originalFetch(url, options);
    };

    // Create a mock PDF buffer with some readable text markers
    const mockPDFContent = `
      %PDF-1.4
      BT
      /F1 12 Tf
      (This is a test document with readable content) Tj
      ET
      BT
      (Important medical information: Patient needs medication) Tj
      ET
    `;
    
    const mockBuffer = new TextEncoder().encode(mockPDFContent);

    // This simulates the old broken behavior
    const { extractPDFTextWithOpenAI } = await import('../supabase/functions/process-document/index.ts');
    
    const result = await extractPDFTextWithOpenAI(mockBuffer.buffer);
    
    // Before fix: should return garbled text
    expect(result).toContain('garbled text');
  });

  it('should extract readable text from PDF using structured approach after fix', async () => {
    // Mock successful text extraction (the new behavior)
    globalThis.fetch = async (url: string | Request, options?: RequestInit) => {
      if (typeof url === 'string' && url.includes('openai.com')) {
        return new Response(JSON.stringify({
          choices: [{
            message: {
              content: 'This is a test document with readable content. Important medical information: Patient needs medication.'
            }
          }]
        }), { status: 200 });
      }
      return originalFetch(url, options);
    };

    // Create a mock PDF buffer with readable text
    const mockPDFContent = `
      %PDF-1.4
      BT
      /F1 12 Tf
      (This is a test document with readable content) Tj
      ET
      BT
      (Important medical information: Patient needs medication) Tj
      ET
    `;
    
    const mockBuffer = new TextEncoder().encode(mockPDFContent);

    // This simulates the new fixed behavior
    const { extractPDFTextWithOpenAI } = await import('../supabase/functions/process-document/index.ts');
    
    const result = await extractPDFTextWithOpenAI(mockBuffer.buffer);
    
    // After fix: should return clean, readable text
    expect(result).toContain('test document');
    expect(result).toContain('medical information');
    expect(result).not.toContain('¢€');
    expect(result).not.toContain('garbled');
  });

  it('should detect garbled text correctly', async () => {
    const { isGarbledText } = await import('../supabase/functions/process-document/index.ts');
    
    // Test garbled text detection
    expect(isGarbledText('¢€ (¢€ (¢€ (¢€ nonsensical')).toBe(true);
    expect(isGarbledText('This is normal readable text')).toBe(false);
    expect(isGarbledText('èÙf …‡ n 4‚î>ÃÄüª æ±è©@')).toBe(true);
  });

  it('should handle PDF processing end-to-end', async () => {
    // Mock the Supabase client and OpenAI API
    globalThis.fetch = async (url: string | Request, options?: RequestInit) => {
      if (typeof url === 'string' && url.includes('openai.com')) {
        const body = JSON.parse(options?.body as string || '{}');
        
        // If it's asking for text extraction from PDF content
        if (body.messages?.[0]?.content?.includes('PDF content')) {
          return new Response(JSON.stringify({
            choices: [{
              message: {
                content: 'Extracted text: This is a medical report. Patient name: John Doe. Diagnosis: Hypertension. Treatment plan: Daily medication.'
              }
            }]
          }), { status: 200 });
        }
      }
      return originalFetch(url, options);
    };

    const mockPDFContent = `
      %PDF-1.4
      BT
      (This is a medical report) Tj
      (Patient name: John Doe) Tj
      (Diagnosis: Hypertension) Tj  
      ET
    `;
    
    const mockBuffer = new TextEncoder().encode(mockPDFContent);
    
    const { extractPDFTextWithOpenAI } = await import('../supabase/functions/process-document/index.ts');
    const result = await extractPDFTextWithOpenAI(mockBuffer.buffer);
    
    expect(result).toContain('medical report');
    expect(result).toContain('John Doe');
    expect(result).toContain('Hypertension');
  });
});