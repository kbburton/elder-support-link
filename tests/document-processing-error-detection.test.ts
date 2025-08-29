import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Deno environment and fetch
global.Deno = {
  env: {
    get: vi.fn((key) => {
      if (key === 'OPENAI_API_KEY') return 'test-key';
      if (key === 'SUPABASE_URL') return 'http://localhost:54321';
      if (key === 'SUPABASE_SERVICE_ROLE_KEY') return 'test-key';
      return undefined;
    })
  }
} as any;

global.fetch = vi.fn();
global.btoa = vi.fn((str) => Buffer.from(str, 'binary').toString('base64'));

describe('Document Processing Error Detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should detect AI error response about compressed format in DOCX processing', async () => {
    // Mock OpenAI response with error message
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: "Sorry, I can't extract text from this file because the content you provided is in a compressed or encoded format, not the actual .docx file content."
          }
        }]
      })
    });

    // Import the function (this would be the actual function from the edge function)
    const processDOCX = async (fileBuffer: ArrayBuffer): Promise<string> => {
      try {
        const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
        if (!openAIApiKey) {
          throw new Error('OpenAI API key not configured for DOCX processing');
        }

        const base64File = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4.1-2025-04-14',
            messages: [
              {
                role: 'system',
                content: 'You are a document text extraction specialist. Extract all readable text from the document.'
              },
              {
                role: 'user',
                content: `Please extract text from this DOCX document: ${base64File.substring(0, 20000)}`
              }
            ],
            max_completion_tokens: 4000
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to process DOCX document: ${response.statusText}`);
        }

        const data = await response.json();
        const extractedText = data.choices[0]?.message?.content || '';
        
        if (!extractedText || extractedText.trim().length === 0) {
          throw new Error('No readable text could be extracted from the DOCX document');
        }
        
        // Check for common error patterns from the AI
        const errorPatterns = [
          'no visible text',
          'cannot read',
          'unable to extract',
          'appears to be corrupted',
          'binary data',
          'file structure data',
          'encoded XML components',
          'compressed or encoded format',
          'could not be processed',
          'cannot extract text from this file',
          'sorry, i can\'t extract text'
        ];
        
        const lowerText = extractedText.toLowerCase();
        const hasErrorPattern = errorPatterns.some(pattern => lowerText.includes(pattern));
        
        if (hasErrorPattern) {
          throw new Error('DOCX document appears to be corrupted or unreadable');
        }
        
        return extractedText.trim();
      } catch (error) {
        throw new Error(`DOCX processing failed: ${error.message}`);
      }
    };

    const testBuffer = new ArrayBuffer(1000);
    
    // This should throw an error, not return the error message as text
    await expect(processDOCX(testBuffer)).rejects.toThrow('DOCX document appears to be corrupted or unreadable');
  });

  it('should detect AI error response about compressed format in summary generation', async () => {
    // Mock OpenAI response with summary error
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: "The provided content indicates that the document could not be processed because it is in a compressed or encoded format rather than plain text."
          }
        }]
      })
    });

    const generateSummary = async (text: string): Promise<string> => {
      if (!text || text.trim().length === 0) {
        throw new Error('No content available to summarize');
      }
      
      // Check for error messages that shouldn't be summarized
      const errorPatterns = [
        'no visible text',
        'cannot read',
        'unable to extract',
        'processing failed',
        'could not be extracted',
        'compressed or encoded format',
        'could not be processed',
        'cannot extract text from this file',
        'sorry, i can\'t extract text'
      ];
      
      const lowerText = text.toLowerCase();
      const hasErrorPattern = errorPatterns.some(pattern => lowerText.includes(pattern));
      
      if (hasErrorPattern) {
        throw new Error('Document content appears to contain error messages rather than actual document text');
      }

      const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
      if (!openAIApiKey) {
        throw new Error('OpenAI API key not configured');
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4.1-mini-2025-04-14',
          messages: [
            {
              role: 'system',
              content: 'Create concise summaries of documents.'
            },
            {
              role: 'user',
              content: `Please summarize: ${text.substring(0, 10000)}`
            }
          ],
          max_completion_tokens: 500
        }),
      });

      if (!response.ok) {
        throw new Error(`Summary generation failed: ${response.statusText}`);
      }

      const data = await response.json();
      const summary = data.choices[0]?.message?.content || '';
      
      // Double-check the generated summary for error patterns
      const summaryLowerText = summary.toLowerCase();
      const summaryHasErrorPattern = errorPatterns.some(pattern => summaryLowerText.includes(pattern));
      
      if (summaryHasErrorPattern) {
        throw new Error('AI returned error message instead of summary');
      }
      
      return summary.trim();
    };

    const errorText = "Sorry, I can't extract text from this file because the content you provided is in a compressed or encoded format";
    
    // This should throw an error when trying to summarize error text
    await expect(generateSummary(errorText)).rejects.toThrow('Document content appears to contain error messages rather than actual document text');
  });

  it('should process valid text without throwing errors', async () => {
    // Mock successful OpenAI response
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: "This is a valid summary of the document content with important information about the user's medical history."
          }
        }]
      })
    });

    const generateSummary = async (text: string): Promise<string> => {
      if (!text || text.trim().length === 0) {
        throw new Error('No content available to summarize');
      }
      
      // Check for error messages that shouldn't be summarized
      const errorPatterns = [
        'no visible text',
        'cannot read', 
        'unable to extract',
        'processing failed',
        'could not be extracted',
        'compressed or encoded format',
        'could not be processed',
        'cannot extract text from this file',
        'sorry, i can\'t extract text'
      ];
      
      const lowerText = text.toLowerCase();
      const hasErrorPattern = errorPatterns.some(pattern => lowerText.includes(pattern));
      
      if (hasErrorPattern) {
        throw new Error('Document content appears to contain error messages rather than actual document text');
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer test-key`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4.1-mini-2025-04-14',
          messages: [
            {
              role: 'system',
              content: 'Create concise summaries of documents.'
            },
            {
              role: 'user', 
              content: `Please summarize: ${text.substring(0, 10000)}`
            }
          ],
          max_completion_tokens: 500
        }),
      });

      const data = await response.json();
      const summary = data.choices[0]?.message?.content || '';
      
      // Double-check the generated summary for error patterns
      const summaryLowerText = summary.toLowerCase();
      const summaryHasErrorPattern = errorPatterns.some(pattern => summaryLowerText.includes(pattern));
      
      if (summaryHasErrorPattern) {
        throw new Error('AI returned error message instead of summary');
      }
      
      return summary.trim();
    };

    const validText = "This is a medical report about the patient's condition and treatment plan. The patient has been diagnosed with hypertension and requires medication.";
    
    const result = await generateSummary(validText);
    expect(result).toContain("valid summary");
    expect(result).not.toContain("error");
  });
});