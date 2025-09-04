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

describe('Document Processing Fix', () => {
  it('should fail DOCX processing with Responses API before fix', async () => {
    // Mock the file upload success
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'file-test-123' })
      })
      // Mock Responses API failure for DOCX (the bug)
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

    const { processOfficeFileWithResponses } = await import('../supabase/functions/process-document/index.ts');
    
    const testBuffer = new ArrayBuffer(100);
    
    await expect(
      processOfficeFileWithResponses(testBuffer, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'test-key')
    ).rejects.toThrow('Office file processing failed');
  });

  it('should successfully process DOCX with Chat API after fix', async () => {
    // Mock file upload success
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'file-test-123' })
      })
      // Mock Chat API success (the fix)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: {
              content: 'This is the extracted text from the DOCX document.'
            }
          }]
        })
      });

    const { processOfficeFileWithResponses } = await import('../supabase/functions/process-document/index.ts');
    
    const testBuffer = new ArrayBuffer(100);
    
    const result = await processOfficeFileWithResponses(
      testBuffer, 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
      'test-key'
    );

    expect(result.text).toBe('This is the extracted text from the DOCX document.');
  });

  it('should handle PDF processing with fallback', async () => {
    // Mock file upload success
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'file-test-pdf' })
      })
      // Mock Responses API returning empty text
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ output_text: '' })
      })
      // Mock file upload for fallback
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'file-test-pdf-fallback' })
      })
      // Mock Chat API fallback success
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: {
              content: 'This is the extracted PDF text using Chat API fallback.'
            }
          }]
        })
      });

    const { processPDFWithResponses } = await import('../supabase/functions/process-document/index.ts');
    
    const testBuffer = new ArrayBuffer(100);
    
    const result = await processPDFWithResponses(testBuffer, 'test-key');

    expect(result.text).toBe('This is the extracted PDF text using Chat API fallback.');
  });

  it('should process PDF successfully with Responses API when it works', async () => {
    // Mock file upload success
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'file-test-pdf' })
      })
      // Mock Responses API success
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ output_text: 'Successfully extracted PDF text.' })
      });

    const { processPDFWithResponses } = await import('../supabase/functions/process-document/index.ts');
    
    const testBuffer = new ArrayBuffer(100);
    
    const result = await processPDFWithResponses(testBuffer, 'test-key');

    expect(result.text).toBe('Successfully extracted PDF text.');
  });
});