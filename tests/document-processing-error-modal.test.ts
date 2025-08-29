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
vi.mock('@/components/ui/use-toast', () => ({
  toast: vi.fn()
}));

describe('DocumentUpload Error Modal Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fail when error modal closes automatically (before fix)', async () => {
    // Simulate processing error
    mockSupabase.functions.invoke.mockRejectedValueOnce(new Error('DOCX processing failed'));
    
    const onClose = vi.fn();
    const onUploadComplete = vi.fn();
    
    render(<DocumentUpload onClose={onClose} onUploadComplete={onUploadComplete} />);
    
    // Simulate file upload
    const fileInput = screen.getByRole('button', { name: /click to select files/i });
    const file = new File(['test'], 'test.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    
    fireEvent.change(fileInput, { target: { files: [file] } });
    
    const uploadButton = screen.getByRole('button', { name: /upload/i });
    fireEvent.click(uploadButton);
    
    // Wait for processing to start and fail
    await waitFor(() => {
      expect(mockSupabase.functions.invoke).toHaveBeenCalled();
    });
    
    // Check if error modal appears
    const errorModal = await screen.findByText('Processing Error');
    expect(errorModal).toBeInTheDocument();
    
    // Before fix: Modal should close automatically within 4 seconds
    await waitFor(() => {
      expect(screen.queryByText('Processing Error')).not.toBeInTheDocument();
    }, { timeout: 4000 });
    
    // This test should pass after the fix (modal stays open)
  });

  it('should pass when error modal stays open (after fix)', async () => {
    // Simulate processing error
    mockSupabase.functions.invoke.mockRejectedValueOnce(new Error('DOCX processing failed'));
    
    const onClose = vi.fn();
    const onUploadComplete = vi.fn();
    
    render(<DocumentUpload onClose={onClose} onUploadComplete={onUploadComplete} />);
    
    // Simulate file upload
    const fileInput = screen.getByRole('button', { name: /click to select files/i });
    const file = new File(['test'], 'test.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    
    fireEvent.change(fileInput, { target: { files: [file] } });
    
    const uploadButton = screen.getByRole('button', { name: /upload/i });
    fireEvent.click(uploadButton);
    
    // Wait for processing to start and fail
    await waitFor(() => {
      expect(mockSupabase.functions.invoke).toHaveBeenCalled();
    });
    
    // Check if error modal appears and stays open
    const errorModal = await screen.findByText('Processing Error');
    expect(errorModal).toBeInTheDocument();
    
    // After fix: Modal should remain open after 4 seconds
    await new Promise(resolve => setTimeout(resolve, 4000));
    expect(screen.getByText('Processing Error')).toBeInTheDocument();
    
    // User can manually close by clicking "Save Without Summary"
    const continueButton = screen.getByRole('button', { name: /save without summary/i });
    fireEvent.click(continueButton);
    
    await waitFor(() => {
      expect(screen.queryByText('Processing Error')).not.toBeInTheDocument();
    });
  });

  it('should update document status when user chooses to save without summary', async () => {
    // Simulate processing error
    mockSupabase.functions.invoke.mockRejectedValueOnce(new Error('DOCX processing failed'));
    
    const updateMock = vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ error: null }))
    }));
    mockSupabase.from.mockReturnValue({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ 
            data: { id: 'test-doc-id' }, 
            error: null 
          }))
        }))
      })),
      update: updateMock
    });
    
    const onClose = vi.fn();
    const onUploadComplete = vi.fn();
    
    render(<DocumentUpload onClose={onClose} onUploadComplete={onUploadComplete} />);
    
    // Simulate file upload and error
    const fileInput = screen.getByRole('button', { name: /click to select files/i });
    const file = new File(['test'], 'test.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    
    fireEvent.change(fileInput, { target: { files: [file] } });
    
    const uploadButton = screen.getByRole('button', { name: /upload/i });
    fireEvent.click(uploadButton);
    
    // Wait for error modal
    await waitFor(() => {
      expect(screen.getByText('Processing Error')).toBeInTheDocument();
    });
    
    // Click "Save Without Summary"
    const continueButton = screen.getByRole('button', { name: /save without summary/i });
    fireEvent.click(continueButton);
    
    // Verify document status is updated to completed
    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith({ processing_status: 'completed' });
    });
  });
});