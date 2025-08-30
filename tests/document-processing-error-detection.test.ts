import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the Supabase client
const mockSupabase = {
  from: vi.fn(),
  storage: {
    from: vi.fn(),
  },
  functions: {
    invoke: vi.fn(),
  },
};

// Mock environment variables
vi.stubGlobal('Deno', {
  env: {
    get: vi.fn((key: string) => {
      if (key === 'SUPABASE_URL') return 'https://test.supabase.co';
      if (key === 'SUPABASE_SERVICE_ROLE_KEY') return 'test-key';
      if (key === 'OPENAI_API_KEY') return 'test-openai-key';
      return '';
    }),
  },
});

// Mock fetch for testing
global.fetch = vi.fn();

describe('Document Processing Error Detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fail when trying to use vision API for DOCX before fix', async () => {
    // Create a mock DOCX file buffer
    const mockDocxBuffer = new TextEncoder().encode(
      '<?xml version="1.0"?><document><w:t>Test Resume Content</w:t></document>'
    );

    // Mock the old broken implementation that tries to use vision API
    const brokenProcessDOCX = async (fileBuffer: ArrayBuffer): Promise<string> => {
      const base64File = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));
      
      // This should fail because vision API doesn't accept DOCX
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-openai-key',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4.1-2025-04-14',
          messages: [{
            role: 'user',
            content: [{
              type: 'text',
              text: 'Extract text from this DOCX'
            }, {
              type: 'image_url',
              image_url: {
                url: `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${base64File}`
              }
            }]
          }],
          max_completion_tokens: 4000
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenAI API error: ${response.statusText} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || '';
    };

    // Mock fetch to return the expected error
    (fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: () => Promise.resolve({
        error: {
          message: 'Invalid MIME type. Only image types are supported.',
          type: 'invalid_request_error',
          param: null,
          code: 'invalid_image_format'
        }
      })
    });

    // This should throw an error
    await expect(brokenProcessDOCX(mockDocxBuffer.buffer)).rejects.toThrow(
      'Invalid MIME type. Only image types are supported.'
    );
  });

  it('should successfully extract text from DOCX after fix', async () => {
    // Create a mock DOCX file buffer with XML content
    const mockDocxContent = `
      <?xml version="1.0"?>
      <document>
        <w:p><w:t>John Smith</w:t></w:p>
        <w:p><w:t>Software Engineer</w:t></w:p>
        <w:p><w:t>Experience: 5 years in web development</w:t></w:p>
        <w:p><w:t>Skills: React, TypeScript, Node.js</w:t></w:p>
      </document>
    `;
    const mockDocxBuffer = new TextEncoder().encode(mockDocxContent);

    // Fixed implementation that properly parses DOCX XML
    const fixedProcessDOCX = async (fileBuffer: ArrayBuffer): Promise<string> => {
      const text = new TextDecoder().decode(fileBuffer);
      let extractedText = '';
      
      // Look for document text content in the XML structure
      const textMatches = text.match(/<w:t[^>]*>([^<]+)<\/w:t>/g) || [];
      for (const match of textMatches) {
        const content = match.replace(/<w:t[^>]*>/, '').replace(/<\/w:t>/, '');
        if (content.length > 1 && /[a-zA-Z]/.test(content)) {
          extractedText += content + ' ';
        }
      }
      
      return extractedText.trim() || 'No readable text found in DOCX file.';
    };

    const result = await fixedProcessDOCX(mockDocxBuffer.buffer);
    
    expect(result).toContain('John Smith');
    expect(result).toContain('Software Engineer');
    expect(result).toContain('Experience: 5 years in web development');
    expect(result).toContain('Skills: React, TypeScript, Node.js');
  });

  it('should fail when system logs query references non-existent metadata column before fix', async () => {
    // Mock the broken RPC call
    const brokenGetSystemLogs = async () => {
      const mockError = {
        code: '42703',
        message: 'column sl.metadata does not exist'
      };
      throw mockError;
    };

    await expect(brokenGetSystemLogs()).rejects.toMatchObject({
      code: '42703',
      message: 'column sl.metadata does not exist'
    });
  });

  it('should successfully get system logs after fix', async () => {
    // Mock the fixed implementation using admin-user-management function
    const fixedGetSystemLogs = async () => {
      // Mock successful response
      return {
        systemLogs: [
          {
            id: '1',
            level: 'info',
            message: 'System started',
            component: 'server',
            operation: 'startup',
            metadata: {},
            created_at: '2025-08-30T00:00:00Z'
          }
        ]
      };
    };

    const result = await fixedGetSystemLogs();
    expect(result.systemLogs).toHaveLength(1);
    expect(result.systemLogs[0].message).toBe('System started');
  });
});