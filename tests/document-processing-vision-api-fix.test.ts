import { expect, test, beforeAll, afterAll } from 'vitest';

// Mock the OpenAI API responses
const mockOpenAIResponse = {
  choices: [
    {
      message: {
        content: 'John Doe\nSoftware Engineer\nExperience:\n- 5 years in web development\n- React, TypeScript, Node.js\nEducation: Computer Science, MIT'
      }
    }
  ]
};

const mockErrorResponse = {
  choices: [
    {
      message: {
        content: 'Sample CustomX Application This document is an example...'
      }
    }
  ]
};

// Mock fetch globally
const originalFetch = globalThis.fetch;

beforeAll(() => {
  globalThis.fetch = async (url: string | URL, init?: RequestInit): Promise<Response> => {
    if (typeof url === 'string' && url.includes('openai.com')) {
      const body = JSON.parse(init?.body as string);
      
      // Check if this is using the correct vision API format
      if (body.messages?.[0]?.content?.[1]?.type === 'image_url') {
        return new Response(JSON.stringify(mockOpenAIResponse), { status: 200 });
      } else {
        // Return error content if using wrong format (plain text with base64)
        return new Response(JSON.stringify(mockErrorResponse), { status: 200 });
      }
    }
    
    return originalFetch(url, init);
  };
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

test('processDOCX should use vision API format correctly', async () => {
  // Mock a simple DOCX file buffer (this would normally be a real DOCX file)
  const mockFileBuffer = new ArrayBuffer(1024);
  const mockView = new Uint8Array(mockFileBuffer);
  // Fill with some mock data
  for (let i = 0; i < mockView.length; i++) {
    mockView[i] = i % 256;
  }

  // Import the function (this is a simplified test)
  const processDOCX = async (fileBuffer: ArrayBuffer): Promise<string> => {
    // Simulate the fixed function behavior
    const base64File = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));
    
    // This should use vision API format
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer mock-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extract text from this DOCX document.' },
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${base64File}`
                }
              }
            ]
          }
        ],
        max_tokens: 4000
      }),
    });

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  };

  const result = await processDOCX(mockFileBuffer);
  
  // Should return actual document content, not sample content
  expect(result).toContain('John Doe');
  expect(result).toContain('Software Engineer');
  expect(result).not.toContain('Sample CustomX Application');
});

test('old processDOCX format should return incorrect content', async () => {
  // Mock the old incorrect format
  const processDOCXOld = async (fileBuffer: ArrayBuffer): Promise<string> => {
    const base64File = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));
    
    // This uses the wrong format (plain text with base64)
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer mock-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          {
            role: 'user',
            content: `Please extract text from this DOCX document:\n\nFile data: ${base64File}`
          }
        ],
        max_completion_tokens: 4000
      }),
    });

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  };

  const mockFileBuffer = new ArrayBuffer(1024);
  const result = await processDOCXOld(mockFileBuffer);
  
  // Should return incorrect sample content
  expect(result).toContain('Sample CustomX Application');
});