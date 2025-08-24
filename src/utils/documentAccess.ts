import { supabase } from "@/integrations/supabase/client";

/**
 * Generate a signed URL for secure document access
 * @param filePath - The file path in storage
 * @param expiresIn - Expiration time in seconds (default: 600 = 10 minutes)
 * @returns Promise with signed URL or null if failed
 */
export async function getDocumentSignedUrl(filePath: string, expiresIn: number = 600): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(filePath, expiresIn);
    
    if (error) {
      console.error('Failed to create signed URL:', error);
      return null;
    }
    
    return data.signedUrl;
  } catch (error) {
    console.error('Error generating signed URL:', error);
    return null;
  }
}

/**
 * Download a document using blob download
 * @param filePath - The file path in storage  
 * @param filename - Optional filename for download
 */
export async function downloadDocument(filePath: string, filename?: string): Promise<void> {
  try {
    // Get the file data directly as a blob
    const { data, error } = await supabase.storage
      .from('documents')
      .download(filePath);
    
    if (error) {
      throw new Error(`Failed to download file: ${error.message}`);
    }

    // Create blob URL and trigger download
    const blob = new Blob([data]);
    const url = URL.createObjectURL(blob);
    
    // Create a temporary link to trigger download
    const link = document.createElement('a');
    link.href = url;
    if (filename) {
      link.download = filename;
    }
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the blob URL
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading document:', error);
    throw error;
  }
}