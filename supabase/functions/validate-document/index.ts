import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// File validation configuration
const FILE_LIMITS = {
  MAX_FILE_SIZE: 25 * 1024 * 1024, // 25MB
  MAX_BATCH_SIZE: 100 * 1024 * 1024, // 100MB
  
  ALLOWED_TYPES: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/webp'
  ],
  
  BLOCKED_TYPES: [
    'application/x-executable',
    'application/x-msdownload',
    'application/x-sh',
    'application/x-bat',
    'application/javascript',
    'text/html',
    'image/svg+xml',
    'application/zip',
    'application/x-gzip',
    'application/x-rar-compressed',
    'application/octet-stream'
  ],
  
  BLOCKED_EXTENSIONS: [
    '.exe', '.dll', '.sh', '.bat', '.js', '.html', '.svg', '.zip', '.gz', '.rar', '.bin', '.com', '.scr', '.cmd', '.msi'
  ],
  
  ALLOWED_EXTENSIONS: [
    '.pdf', '.docx', '.xlsx', '.pptx', '.txt', '.jpg', '.jpeg', '.png', '.webp'
  ]
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { documentId } = await req.json();
    
    if (!documentId) {
      return new Response(
        JSON.stringify({ error: 'Document ID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('Validating document:', documentId);

    // Get document from database
    const { data: document, error: docError } = await supabaseClient
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      console.error('Document not found:', docError);
      return new Response(
        JSON.stringify({ error: 'Document not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Download file for content-type sniffing
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('documents')
      .download(document.file_url.split('/').pop() || '');

    if (downloadError) {
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }

    const fileBuffer = await fileData.arrayBuffer();
    
    // Perform server-side validation
    const validation = await validateFile(fileBuffer, document.file_type, document.original_filename, document.file_size);
    
    if (!validation.isValid) {
      // Mark document as failed and delete file
      await supabaseClient
        .from('documents')
        .update({ 
          processing_status: 'failed',
          summary: `Validation failed: ${validation.message}`
        })
        .eq('id', documentId);

      // Delete the file from storage
      await supabaseClient.storage
        .from('documents')
        .remove([document.file_url.split('/').pop() || '']);

      return new Response(
        JSON.stringify({ error: validation.message, blocked: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Optional: Basic virus scanning using file signatures
    const virusScanResult = await basicVirusScan(fileBuffer);
    if (!virusScanResult.safe) {
      // Mark document as failed and delete file
      await supabaseClient
        .from('documents')
        .update({ 
          processing_status: 'failed',
          summary: `Security scan failed: ${virusScanResult.message}`
        })
        .eq('id', documentId);

      await supabaseClient.storage
        .from('documents')
        .remove([document.file_url.split('/').pop() || '']);

      return new Response(
        JSON.stringify({ error: virusScanResult.message, blocked: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('Document validation passed');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Document validation passed',
        actualType: validation.detectedType
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in validate-document function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

async function validateFile(
  fileBuffer: ArrayBuffer, 
  declaredType: string, 
  filename: string, 
  fileSize: number
): Promise<{ isValid: boolean; message?: string; detectedType?: string }> {
  
  // Check file size
  if (fileSize > FILE_LIMITS.MAX_FILE_SIZE) {
    return {
      isValid: false,
      message: `File size ${Math.round(fileSize / (1024 * 1024))}MB exceeds limit of 25MB`
    };
  }

  // Check extension
  const extension = '.' + filename.split('.').pop()?.toLowerCase();
  if (FILE_LIMITS.BLOCKED_EXTENSIONS.includes(extension)) {
    return {
      isValid: false,
      message: `File extension ${extension} is blocked for security reasons`
    };
  }

  // Content-type sniffing via magic numbers
  const uint8Array = new Uint8Array(fileBuffer.slice(0, 512)); // First 512 bytes
  const detectedType = detectFileType(uint8Array);
  
  // Check if detected type matches declared type category
  if (detectedType && !isTypeCompatible(detectedType, declaredType)) {
    return {
      isValid: false,
      message: `File content type mismatch. Declared: ${declaredType}, Detected: ${detectedType}`
    };
  }

  // Check if detected type is allowed
  if (detectedType && !FILE_LIMITS.ALLOWED_TYPES.includes(detectedType)) {
    return {
      isValid: false,
      message: `Detected file type ${detectedType} is not allowed`
    };
  }

  // Check for blocked types
  if (FILE_LIMITS.BLOCKED_TYPES.includes(declaredType)) {
    return {
      isValid: false,
      message: `File type ${declaredType} is blocked for security reasons`
    };
  }

  return { isValid: true, detectedType };
}

function detectFileType(bytes: Uint8Array): string | null {
  // PDF
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return 'application/pdf';
  }
  
  // PNG
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return 'image/png';
  }
  
  // JPEG
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return 'image/jpeg';
  }
  
  // WebP
  if (bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return 'image/webp';
  }
  
  // ZIP-based formats (DOCX, XLSX, PPTX)
  if (bytes[0] === 0x50 && bytes[1] === 0x4B) {
    // Look for specific Office markers
    const text = new TextDecoder().decode(bytes);
    if (text.includes('word/')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (text.includes('xl/')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (text.includes('ppt/')) return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  }
  
  // Plain text (check for printable ASCII)
  let textLike = true;
  for (let i = 0; i < Math.min(256, bytes.length); i++) {
    const byte = bytes[i];
    if (byte !== 0x09 && byte !== 0x0A && byte !== 0x0D && (byte < 0x20 || byte > 0x7E)) {
      textLike = false;
      break;
    }
  }
  if (textLike) return 'text/plain';
  
  // Executable detection
  if (bytes[0] === 0x4D && bytes[1] === 0x5A) { // MZ header
    return 'application/x-msdownload';
  }
  
  if (bytes[0] === 0x7F && bytes[1] === 0x45 && bytes[2] === 0x4C && bytes[3] === 0x46) { // ELF
    return 'application/x-executable';
  }
  
  return null;
}

function isTypeCompatible(detected: string, declared: string): boolean {
  // Exact match
  if (detected === declared) return true;
  
  // Category matching
  const detectedCategory = detected.split('/')[0];
  const declaredCategory = declared.split('/')[0];
  
  if (detectedCategory === declaredCategory) return true;
  
  // Special cases for Office formats
  if (detected.includes('openxmlformats') && declared.includes('openxmlformats')) {
    return true;
  }
  
  return false;
}

async function basicVirusScan(fileBuffer: ArrayBuffer): Promise<{ safe: boolean; message?: string }> {
  const bytes = new Uint8Array(fileBuffer);
  
  // Check for common malware signatures (basic heuristics)
  const malwareSignatures = [
    // EICAR test string
    [0x58, 0x35, 0x4F, 0x21, 0x50, 0x25, 0x40, 0x41, 0x50],
    // Common shellcode patterns
    [0x90, 0x90, 0x90, 0x90], // NOP sled
  ];
  
  for (const signature of malwareSignatures) {
    if (containsSequence(bytes, signature)) {
      return {
        safe: false,
        message: 'File contains suspicious patterns'
      };
    }
  }
  
  // Check for embedded executables in documents
  if (containsSequence(bytes, [0x4D, 0x5A])) { // MZ header
    return {
      safe: false,
      message: 'File contains embedded executable content'
    };
  }
  
  return { safe: true };
}

function containsSequence(haystack: Uint8Array, needle: number[]): boolean {
  for (let i = 0; i <= haystack.length - needle.length; i++) {
    let found = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        found = false;
        break;
      }
    }
    if (found) return true;
  }
  return false;
}