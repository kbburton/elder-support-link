import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Mock the global fetch and Deno environment
let originalFetch: typeof globalThis.fetch;
let originalDeno: any;

beforeAll(() => {
  originalFetch = globalThis.fetch;
  originalDeno = (globalThis as any).Deno;
  
  // Mock Deno environment
  (globalThis as any).Deno = {
    env: {
      get: (key: string) => {
        if (key === 'OPENAI_API_KEY') return 'test-api-key';
        if (key === 'SUPABASE_URL') return 'https://test.supabase.co';
        if (key === 'SUPABASE_SERVICE_ROLE_KEY') return 'test-service-key';
        return undefined;
      }
    }
  };
});

afterAll(() => {
  globalThis.fetch = originalFetch;
  (globalThis as any).Deno = originalDeno;
});

describe('OpenAI Responses API Integration', () => {
  it('should process PDFs using input_file with Responses API', async () => {
    // Mock successful file upload and Responses API calls
    globalThis.fetch = async (url: string | URL, options?: RequestInit) => {
      const urlString = url.toString();
      
      if (urlString.includes('/files')) {
        // Mock file upload response
        return new Response(JSON.stringify({
          id: 'file-test123',
          object: 'file',
          purpose: 'user_data'
        }), { status: 200 });
      }
      
      if (urlString.includes('/responses')) {
        // Mock Responses API response for PDF processing
        return new Response(JSON.stringify({
          id: 'resp_test123',
          object: 'response',
          output_text: 'This is the extracted text from the PDF document. It contains important information about healthcare protocols and patient care guidelines.',
          model: 'gpt-4o'
        }), { status: 200 });
      }
      
      return new Response('Not Found', { status: 404 });
    };

    // Import the processing function
    const { routeAndProcess } = await import('../supabase/functions/process-document/index.ts');
    
    // Create a mock PDF buffer
    const mockPdfBuffer = new ArrayBuffer(1024);
    
    // Test PDF processing
    const result = await routeAndProcess(mockPdfBuffer, 'application/pdf', 'application/pdf', 'test-api-key');
    
    expect(result.text).toContain('extracted text from the PDF');
    expect(result.text).toContain('healthcare protocols');
  });

  it('should process images using input_image with Responses API', async () => {
    // Mock Responses API for image processing
    globalThis.fetch = async (url: string | URL, options?: RequestInit) => {
      const urlString = url.toString();
      
      if (urlString.includes('/responses')) {
        // Mock Responses API response for image OCR
        return new Response(JSON.stringify({
          id: 'resp_test456',
          object: 'response', 
          output_text: 'Medical Report\nPatient: John Doe\nDate: 2024-01-15\nDiagnosis: Hypertension\nTreatment: Monitor blood pressure daily',
          model: 'gpt-4o'
        }), { status: 200 });
      }
      
      return new Response('Not Found', { status: 404 });
    };

    // Import the processing function
    const { routeAndProcess } = await import('../supabase/functions/process-document/index.ts');
    
    // Create a mock image buffer
    const mockImageBuffer = new ArrayBuffer(2048);
    
    // Test image processing
    const result = await routeAndProcess(mockImageBuffer, 'image/jpeg', 'image/jpeg', 'test-api-key');
    
    expect(result.text).toContain('Medical Report');
    expect(result.text).toContain('Patient: John Doe');
    expect(result.text).toContain('Hypertension');
  });

  it('should handle API errors gracefully', async () => {
    // Mock API error response
    globalThis.fetch = async (url: string | URL, options?: RequestInit) => {
      return new Response(JSON.stringify({
        error: {
          message: 'File format not supported',
          type: 'invalid_request_error'
        }
      }), { status: 400 });
    };

    // Import the processing function
    const { routeAndProcess } = await import('../supabase/functions/process-document/index.ts');
    
    // Create a mock buffer
    const mockBuffer = new ArrayBuffer(1024);
    
    // Test error handling
    await expect(routeAndProcess(mockBuffer, 'application/pdf', 'application/pdf', 'test-api-key'))
      .rejects.toThrow('PDF processing failed');
  });

  it('should use Responses API for summary generation', async () => {
    // Mock Responses API for summary generation
    globalThis.fetch = async (url: string | URL, options?: RequestInit) => {
      const urlString = url.toString();
      
      if (urlString.includes('/responses')) {
        return new Response(JSON.stringify({
          id: 'resp_summary123',
          object: 'response',
          output_text: 'Summary: This document discusses patient care protocols including daily monitoring requirements, medication schedules, and emergency procedures. Key dates include January 15th for initial consultation and February 1st for follow-up.',
          model: 'gpt-4o-mini'
        }), { status: 200 });
      }
      
      return new Response('Not Found', { status: 404 });
    };

    // Import the summary function
    const { generateSummaryWithResponses } = await import('../supabase/functions/process-document/index.ts');
    
    const testText = 'This is a long document about patient care protocols...';
    
    // Test summary generation
    const summary = await generateSummaryWithResponses(testText, 'test-api-key');
    
    expect(summary).toContain('Summary: This document discusses');
    expect(summary).toContain('patient care protocols');
    expect(summary).toContain('January 15th');
  });
});