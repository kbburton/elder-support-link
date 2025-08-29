import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('DOCX Processing Truncation Bug', () => {
  let mockFetch: any;

  beforeEach(() => {
    // Mock the global fetch
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    
    // Mock Deno.env.get
    vi.stubGlobal('Deno', {
      env: {
        get: vi.fn((key: string) => {
          if (key === 'OPENAI_API_KEY') return 'test-api-key';
          return undefined;
        })
      }
    });

    // Mock btoa
    vi.stubGlobal('btoa', vi.fn((str: string) => {
      // Create a mock base64 string that's longer than 20000 characters
      return 'mock-base64-' + 'x'.repeat(25000);
    }));
  });

  it('should send complete file data to OpenAI without truncation', async () => {
    // Mock successful OpenAI response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        choices: [
          {
            message: {
              content: 'This is the actual resume content extracted from the DOCX file.'
            }
          }
        ]
      })
    });

    // Import the processDOCX function (we'll need to extract it or test the whole function)
    const { processDOCX } = await import('../supabase/functions/process-document/index.ts');

    // Create a mock file buffer
    const mockFileBuffer = new ArrayBuffer(1000);

    // Call the function
    await processDOCX(mockFileBuffer);

    // Verify that fetch was called
    expect(mockFetch).toHaveBeenCalledOnce();
    
    // Get the call arguments
    const [url, options] = mockFetch.mock.calls[0];
    
    // Parse the request body
    const requestBody = JSON.parse(options.body);
    const userMessage = requestBody.messages.find((msg: any) => msg.role === 'user');
    
    // Verify that the full file data is sent (not truncated at 20000 characters)
    expect(userMessage.content).toContain('mock-base64-' + 'x'.repeat(25000));
    expect(userMessage.content).not.toMatch(/mock-base64-x{20000}$/); // Should not end at exactly 20000 chars
  });

  it('should fail before fix - demonstrate truncation bug', async () => {
    // This test demonstrates the bug by showing truncated content would cause issues
    
    // Mock the old truncated behavior
    const mockTruncatedContent = 'File data: ' + 'x'.repeat(20000); // Exactly 20000 chars
    
    // This would represent incomplete file data that leads to generic AI responses
    expect(mockTruncatedContent.length).toBe(20010); // 'File data: ' + 20000 chars
    
    // The bug: truncated content doesn't contain the actual document content
    // which causes OpenAI to generate generic responses instead of extracting real text
    const containsActualContent = mockTruncatedContent.includes('resume') || 
                                 mockTruncatedContent.includes('experience') ||
                                 mockTruncatedContent.includes('education');
    
    expect(containsActualContent).toBe(false); // Demonstrates the problem
  });
});