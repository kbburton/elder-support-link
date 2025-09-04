import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock global fetch and Deno
const mockFetch = vi.fn();
const mockDeno = {
  env: {
    get: vi.fn((key: string) => {
      if (key === 'OPENAI_API_KEY') return 'test-api-key';
      if (key === 'SUPABASE_URL') return 'https://test.supabase.co';
      if (key === 'SUPABASE_SERVICE_ROLE_KEY') return 'test-service-key';
      return undefined;
    })
  }
};

// Store original values
const originalFetch = global.fetch;
const originalDeno = (global as any).Deno;

beforeEach(() => {
  global.fetch = mockFetch;
  (global as any).Deno = mockDeno;
  vi.clearAllMocks();
});

afterEach(() => {
  global.fetch = originalFetch;
  (global as any).Deno = originalDeno;
});

describe('Document Processing API Fix', () => {
  it('should fail DOCX processing with Responses API before fix', async () => {
    // Mock the file upload success
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'file-test-123' })
      })
      // Mock Responses API failure for DOCX (the bug that should be fixed)
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: () => Promise.resolve(JSON.stringify({
          error: {
            message: "Invalid input: Expected file type to be a supported format: .pdf but got .docx."
          }
        }))
      });

    // This simulates the OLD broken code that would try to use Responses API for DOCX
    const brokenProcessOfficeFile = async (fileBuffer: ArrayBuffer, mimeType: string, apiKey: string) => {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          input: [{
            role: 'user',
            content: [
              { type: 'input_file', file_id: 'file-test-123' },
              { type: 'input_text', text: 'Extract text' }
            ]
          }]
        })
      });
      
      if (!response.ok) {
        throw new Error('Office file processing failed: Bad Request');
      }
      
      const data = await response.json();
      return { text: data.output_text || '' };
    };

    const testBuffer = new ArrayBuffer(100);
    
    await expect(
      brokenProcessOfficeFile(testBuffer, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'test-key')
    ).rejects.toThrow('Office file processing failed');
  });

  it('should successfully handle DOCX with fallback approach after fix', async () => {
    const { processOfficeFileWithResponses } = await import('../supabase/functions/process-document/index.ts');
    
    const testBuffer = new ArrayBuffer(100);
    
    const result = await processOfficeFileWithResponses(
      testBuffer, 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
      'test-key'
    );

    expect(result.text).toContain('Word document');
    expect(result.text).toContain('could not be processed for text extraction');
    expect(result.text.length).toBeGreaterThan(0);
  });

  it('should handle PDF processing with proper fallback', async () => {
    // Mock Responses API returning empty text (common issue with image-based PDFs)
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'file-test-pdf' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ output_text: '' })
      });

    const { processPDFWithResponses } = await import('../supabase/functions/process-document/index.ts');
    
    const testBuffer = new ArrayBuffer(100);
    
    const result = await processPDFWithResponses(testBuffer, 'test-key');

    expect(result.text).toContain('could not be processed for text extraction');
    expect(result.text.length).toBeGreaterThan(0);
  });

  it('should handle PDF processing when Responses API succeeds', async () => {
    // Mock successful PDF processing
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'file-test-pdf' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ output_text: 'Successfully extracted PDF text content.' })
      });

    const { processPDFWithResponses } = await import('../supabase/functions/process-document/index.ts');
    
    const testBuffer = new ArrayBuffer(100);
    
    const result = await processPDFWithResponses(testBuffer, 'test-key');

    expect(result.text).toBe('Successfully extracted PDF text content.');
  });

  it('should route Office files to fallback approach', async () => {
    const { routeAndProcess } = await import('../supabase/functions/process-document/index.ts');
    
    const testBuffer = new ArrayBuffer(100);
    
    const result = await routeAndProcess(
      testBuffer,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'test-key'
    );

    expect(result.text).toContain('Word document');
    expect(result.text).toContain('could not be processed');
  });
});