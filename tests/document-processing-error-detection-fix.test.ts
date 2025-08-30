import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DocumentUpload } from '../src/components/documents/DocumentUpload';

// Mock Supabase
const mockSupabase = {
  auth: {
    getUser: vi.fn(() => Promise.resolve({ 
      data: { user: { id: 'test-user', email: 'test@example.com' } },
      error: null 
    }))
  },
  storage: {
    from: vi.fn(() => ({
      upload: vi.fn(() => Promise.resolve({ data: { path: 'test-path' }, error: null })),
      list: vi.fn(() => Promise.resolve({ data: [], error: null }))
    }))
  },
  from: vi.fn(() => ({
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ 
          data: { id: 'test-doc-id' }, 
          error: null 
        }))
      }))
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ error: null }))
    }))
  })),
  functions: {
    invoke: vi.fn()
  }
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase
}));

// Mock toast
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast
  })
}));

// Mock router
vi.mock('react-router-dom', () => ({
  useParams: () => ({ groupId: 'test-group-id' })
}));

describe('Document Processing Error Detection Fix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should detect error messages in summary and show error modal (before fix would fail)', async () => {
    // Simulate successful response but with error message in summary
    mockSupabase.functions.invoke.mockResolvedValueOnce({
      data: {
        success: true,
        summary: 'No text content could be extracted from the document for summarization',
        textLength: 0
      },
      error: null
    });
    
    const onClose = vi.fn();
    const onUploadComplete = vi.fn();
    
    render(<DocumentUpload onClose={onClose} onUploadComplete={onUploadComplete} />);
    
    // Create a test file
    const file = new File(['test content'], 'test.docx', { 
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
    });
    
    // Find and interact with the file input properly
    const dropZone = screen.getByText(/click or drag files to upload/i).closest('[role="button"]');
    const fileInput = dropZone?.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();
    
    // Simulate file selection
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    });
    fireEvent.change(fileInput);
    
    // Select category
    const categorySelect = screen.getByRole('combobox');
    fireEvent.click(categorySelect);
    const medicalOption = screen.getByText('Medical');
    fireEvent.click(medicalOption);
    
    // Click upload
    const uploadButton = screen.getByRole('button', { name: /upload/i });
    fireEvent.click(uploadButton);
    
    // Wait for error modal to appear - this should now work with the fix
    await waitFor(() => {
      expect(screen.getByText('Processing Error')).toBeInTheDocument();
    }, { timeout: 5000 });
    
    expect(screen.getByText(/there was an error processing/i)).toBeInTheDocument();
  });

  it('should not show error modal for valid summaries (after fix)', async () => {
    // Simulate successful response with valid summary
    mockSupabase.functions.invoke.mockResolvedValueOnce({
      data: {
        success: true,
        summary: 'This document contains a resume with work experience and education details.',
        textLength: 150
      },
      error: null
    });
    
    const onClose = vi.fn();
    const onUploadComplete = vi.fn();
    
    render(<DocumentUpload onClose={onClose} onUploadComplete={onUploadComplete} />);
    
    // Create a test file
    const file = new File(['test content'], 'resume.docx', { 
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
    });
    
    // Find and interact with the file input properly
    const dropZone = screen.getByText(/click or drag files to upload/i).closest('[role="button"]');
    const fileInput = dropZone?.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();
    
    // Simulate file selection
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    });
    fireEvent.change(fileInput);
    
    // Select category
    const categorySelect = screen.getByRole('combobox');
    fireEvent.click(categorySelect);
    const medicalOption = screen.getByText('Medical');
    fireEvent.click(medicalOption);
    
    // Click upload
    const uploadButton = screen.getByRole('button', { name: /upload/i });
    fireEvent.click(uploadButton);
    
    // Wait for processing to complete and verify no error modal appears
    await waitFor(() => {
      expect(mockSupabase.functions.invoke).toHaveBeenCalled();
    });
    
    // Give it time to potentially show error modal
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Error modal should NOT appear
    expect(screen.queryByText('Processing Error')).not.toBeInTheDocument();
  });

  it('should detect "No readable text found" errors specifically', async () => {
    // Simulate the specific error message the user reported
    mockSupabase.functions.invoke.mockResolvedValueOnce({
      data: {
        success: true,
        summary: 'No readable text found in DOCX file.',
        textLength: 36
      },
      error: null
    });
    
    const onClose = vi.fn();
    const onUploadComplete = vi.fn();
    
    render(<DocumentUpload onClose={onClose} onUploadComplete={onUploadComplete} />);
    
    // Create a test file
    const file = new File(['test content'], 'document.docx', { 
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
    });
    
    // Find and interact with the file input properly
    const dropZone = screen.getByText(/click or drag files to upload/i).closest('[role="button"]');
    const fileInput = dropZone?.querySelector('input[type="file"]') as HTMLInputElement;
    
    // Simulate file selection
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    });
    fireEvent.change(fileInput);
    
    // Select category
    const categorySelect = screen.getByRole('combobox');
    fireEvent.click(categorySelect);
    const medicalOption = screen.getByText('Medical');
    fireEvent.click(medicalOption);
    
    // Click upload
    const uploadButton = screen.getByRole('button', { name: /upload/i });
    fireEvent.click(uploadButton);
    
    // Error modal should appear
    await waitFor(() => {
      expect(screen.getByText('Processing Error')).toBeInTheDocument();
    }, { timeout: 5000 });
    
    // Should contain the error message
    expect(screen.getByText(/No readable text found in DOCX file/)).toBeInTheDocument();
  });
});