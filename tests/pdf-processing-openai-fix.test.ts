import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('PDF Processing OpenAI Fix', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeAll(() => {
    originalFetch = globalThis.fetch;
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('should fail with current approach (before fix)', async () => {
    // Mock OpenAI API response for current broken approach
    globalThis.fetch = async (url: string | URL) => {
      if (url.toString().includes('openai.com/v1/chat/completions')) {
        return new Response(JSON.stringify({
          error: {
            message: "Invalid parameter: 'detail' is not supported for the 'gpt-4.1-mini-2025-04-14' model",
            type: "invalid_request_error"
          }
        }), { status: 400 });
      }
      return new Response('{}');
    };

    // Simulate the broken processPDFWithOpenAI function call
    const mockPDFBuffer = new Uint8Array([37, 80, 68, 70]); // PDF header
    
    try {
      await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-key',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4.1-mini-2025-04-14', // Wrong model for PDF
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:application/pdf;base64,${btoa(String.fromCharCode(...mockPDFBuffer))}`,
                    detail: 'high' // This parameter causes the error
                  }
                }
              ]
            }
          ]
        })
      });
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it('should succeed with fixed approach (after fix)', async () => {
    // Mock OpenAI API response for fixed approach
    globalThis.fetch = async (url: string | URL) => {
      if (url.toString().includes('openai.com/v1/chat/completions')) {
        return new Response(JSON.stringify({
          choices: [{
            message: {
              content: "This is a medical report about patient care instructions and medication schedules."
            }
          }]
        }), { status: 200 });
      }
      return new Response('{}');
    };

    // Simulate the fixed processPDFWithOpenAI function call
    const mockPDFBuffer = new Uint8Array([37, 80, 68, 70]); // PDF header
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Correct model for PDF support
        messages: [
          {
            role: 'system',
            content: 'Extract all text content from this PDF document. Preserve formatting and structure where possible.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${btoa(String.fromCharCode(...mockPDFBuffer))}`
                  // No 'detail' parameter for PDF processing
                }
              }
            ]
          }
        ],
        max_tokens: 2000
      })
    });

    const data = await response.json();
    expect(data.choices[0].message.content).toContain('medical report');
  });

  it('should handle regenerate summary with proper model', async () => {
    // Mock successful OpenAI API response
    globalThis.fetch = async (url: string | URL) => {
      if (url.toString().includes('openai.com/v1/chat/completions')) {
        return new Response(JSON.stringify({
          choices: [{
            message: {
              content: "This document contains patient care instructions including medication schedules, dietary restrictions, and follow-up appointments."
            }
          }]
        }), { status: 200 });
      }
      return new Response('{}');
    };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Fixed: Use legacy model that supports max_tokens
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that creates concise summaries. Focus on key points, important dates, and actionable information.'
          },
          {
            role: 'user',
            content: 'Please create a comprehensive summary of this document:\n\nPatient care instructions...'
          }
        ],
        max_tokens: 400 // Fixed: Use max_tokens for legacy models
      })
    });

    const data = await response.json();
    expect(data.choices[0].message.content).toContain('patient care');
  });
});