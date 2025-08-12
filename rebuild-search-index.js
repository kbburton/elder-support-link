// Quick script to rebuild search index
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://yfwgegapmggwywrnzqvg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlmd2dlZ2FwbWdnd3l3cm56cXZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4OTAwMjUsImV4cCI6MjA3MDQ2NjAyNX0.YZWYq0S020M_ZPKQoarcz9LczAI_nEk4b3BbCLnSaWs";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function rebuildIndex() {
  console.log('Rebuilding search index...');
  
  try {
    const { data, error } = await supabase.functions.invoke('admin-rebuild-search');
    
    if (error) {
      console.error('Error:', error);
      return;
    }
    
    console.log('Success:', data);
    console.log(`Search index rebuilt with ${data.total_entries} entries`);
  } catch (err) {
    console.error('Failed to rebuild index:', err);
  }
}

rebuildIndex();