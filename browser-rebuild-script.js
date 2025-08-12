// Run this in browser console to rebuild search index
import { supabase } from '/src/integrations/supabase/client.js';

const { data, error } = await supabase.functions.invoke('admin-rebuild-search');

if (error) {
  console.error('Error:', error);
} else {
  console.log('Success:', data);
  console.log(`Search index rebuilt with ${data.total_entries} entries`);
}