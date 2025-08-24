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
 * Download a document using signed URL
 * @param filePath - The file path in storage  
 * @param filename - Optional filename for download
 */
export async function downloadDocument(filePath: string, filename?: string): Promise<void> {
  const signedUrl = await getDocumentSignedUrl(filePath);
  
  if (!signedUrl) {
    throw new Error('Failed to generate download link');
  }
  
  // Create a temporary link to trigger download (no new tab)
  const link = document.createElement('a');
  link.href = signedUrl;
  if (filename) {
    link.download = filename;
  }
  // Don't set target="_blank" to avoid opening new tabs
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}