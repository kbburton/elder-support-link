import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Filter, Plus, Search } from 'lucide-react';
import SEO from "@/components/layout/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DocumentUpload } from "@/components/documents/DocumentUpload";
import { DocumentList } from "@/components/documents/DocumentList";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

const DOCUMENT_CATEGORIES = ['All', 'Medical', 'Legal', 'Financial', 'Personal', 'Other'];

const DocumentsPage = () => {
  const { groupId } = useParams();
  const { toast } = useToast();
  const [showUpload, setShowUpload] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Fetch documents
  const { data: documents = [], refetch: refetchDocuments, isLoading } = useQuery({
    queryKey: ['documents', groupId],
    queryFn: async () => {
      if (!groupId) return [];
      
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('group_id', groupId)
        .order('upload_date', { ascending: false });

      if (error) {
        toast({
          title: 'Failed to load documents',
          description: error.message,
          variant: 'destructive'
        });
        return [];
      }

      return data;
    },
    enabled: !!groupId,
  });

  // Fetch user profiles for display - simplified approach
  const { data: userProfiles = [] } = useQuery({
    queryKey: ['user-emails', groupId],
    queryFn: async () => {
      if (!groupId) return [];
      
      // Get all documents for this group to find unique user IDs
      const { data: docs } = await supabase
        .from('documents')
        .select('uploaded_by_user_id')
        .eq('group_id', groupId);

      if (!docs) return [];

      // Get unique user IDs
      const userIds = [...new Set(docs.map(d => d.uploaded_by_user_id).filter(Boolean))];
      if (userIds.length === 0) return [];

      // Get profiles for those users
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, email')
        .in('user_id', userIds);

      return profiles?.map(profile => ({
        id: profile.user_id,
        email: profile.email || 'Unknown'
      })) || [];
    },
    enabled: !!groupId,
  });

  // Filter documents based on search term and category
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = !searchTerm || 
      doc.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.summary?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.full_text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.notes?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === 'All' || doc.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const handleUploadComplete = () => {
    refetchDocuments();
    setShowUpload(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SEO title="Documents — DaveAssist" description="Securely store and search care documents." />
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Document centre</h2>
        </div>
        <div className="text-center py-12">
          <p>Loading documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SEO title="Documents — DaveAssist" description="Securely store and search care documents." />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">Document centre</h2>
        <Button onClick={() => setShowUpload(true)} className="flex items-center space-x-2">
          <Plus className="h-4 w-4" />
          <span>Upload Document</span>
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search documents by title, content, or notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOCUMENT_CATEGORIES.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results count */}
      {searchTerm || selectedCategory !== 'All' ? (
        <div className="text-sm text-muted-foreground">
          {filteredDocuments.length} document{filteredDocuments.length !== 1 ? 's' : ''} found
          {searchTerm && ` for "${searchTerm}"`}
          {selectedCategory !== 'All' && ` in ${selectedCategory}`}
        </div>
      ) : null}

      {/* Document List */}
      <DocumentList
        documents={filteredDocuments}
        onRefresh={refetchDocuments}
        userProfiles={userProfiles}
      />

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DocumentUpload
            onUploadComplete={handleUploadComplete}
            onClose={() => setShowUpload(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DocumentsPage;
