import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('DOCX Processing Base64 Encoding Bug', () => {
  let mockFetch: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
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
  });

  it('should fail with large files using spread operator approach', () => {
    // Create a large file buffer that would cause stack overflow with spread operator
    const largeFileBuffer = new ArrayBuffer(100000); // 100KB
    const bytes = new Uint8Array(largeFileBuffer);
    
    // Fill with some test data
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = i % 256;
    }
    
    // The old approach that fails for large files
    expect(() => {
      const base64 = btoa(String.fromCharCode(...bytes));
    }).toThrow(); // Should throw due to too many arguments
  });

  it('should handle large files correctly with chunked approach', () => {
    // Create a large file buffer
    const largeFileBuffer = new ArrayBuffer(100000); // 100KB
    const bytes = new Uint8Array(largeFileBuffer);
    
    // Fill with some test data
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = i % 256;
    }
    
    // The new approach that works for large files
    let binaryString = '';
    for (let i = 0; i < bytes.length; i++) {
      binaryString += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binaryString);
    
    expect(base64).toBeDefined();
    expect(base64.length).toBeGreaterThan(0);
    
    // Verify we can decode it back
    const decoded = atob(base64);
    expect(decoded.length).toBe(bytes.length);
  });

  it('should send correct file data to OpenAI without corruption', async () => {
    // Mock successful OpenAI response with actual content
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        choices: [
          {
            message: {
              content: 'John Doe Resume Software Engineer with 5 years experience'
            }
          }
        ]
      })
    });

    // Create a mock DOCX file buffer with known content
    const mockContent = 'PK\x03\x04John Doe Resume Content'; // Simplified DOCX-like structure
    const mockFileBuffer = new ArrayBuffer(mockContent.length);
    const bytes = new Uint8Array(mockFileBuffer);
    for (let i = 0; i < mockContent.length; i++) {
      bytes[i] = mockContent.charCodeAt(i);
    }

    // Import and test the fixed processDOCX function
    const { processDOCX } = await import('../supabase/functions/process-document/index.ts');
    
    const result = await processDOCX(mockFileBuffer);

    // Verify fetch was called
    expect(mockFetch).toHaveBeenCalledOnce();
    
    // Get the call arguments
    const [url, options] = mockFetch.mock.calls[0];
    const requestBody = JSON.parse(options.body);
    const userMessage = requestBody.messages.find((msg: any) => msg.role === 'user');
    
    // Verify the base64 data is properly formed and contains the file data
    expect(userMessage.content).toContain('File data: ');
    const base64Part = userMessage.content.split('File data: ')[1];
    expect(base64Part).toBeDefined();
    
    // The base64 should be valid
    expect(() => atob(base64Part)).not.toThrow();
    
    // Should return actual content, not generic test content
    expect(result).toContain('John Doe');
    expect(result).not.toContain('Sample CustomX Application');
    expect(result).not.toContain('test extraction systems');
  });

  it('should demonstrate the old bug - corrupted base64 leading to wrong content', async () => {
    // This demonstrates what happens when base64 encoding fails/corrupts
    const largeBytes = new Uint8Array(100000);
    
    // This will throw with the old spread operator approach
    let base64Failed = false;
    try {
      btoa(String.fromCharCode(...largeBytes));
    } catch (error) {
      base64Failed = true;
    }
    
    expect(base64Failed).toBe(true); // Demonstrates the encoding failure
    
    // When encoding fails, OpenAI gets invalid data and returns generic content
    const invalidBase64 = 'corrupted-data';
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        choices: [
          {
            message: {
              content: 'Sample CustomX Application This document is an example of a Microsoft Word file extracted for text testing purposes.'
            }
          }
        ]
      })
    });
    
    // This simulates what happens with corrupted base64
    const response = await fetch('test-url', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ role: 'user', content: `File data: ${invalidBase64}` }]
      })
    });
    
    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // This demonstrates the bug - corrupted input leads to generic output
    expect(content).toContain('Sample CustomX Application');
  });
});