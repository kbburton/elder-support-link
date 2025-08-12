import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SEO from "@/components/layout/SEO";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, FileText, Calendar, CheckSquare, User, Activity } from "lucide-react";
import { debounce } from "@/utils/debounce";
import { useToast } from "@/hooks/use-toast";
import ContactChips from "@/components/contacts/ContactChips";

interface SearchResult {
  entity_type: string;
  entity_id: string;
  title: string;
  snippet_html: string;
  url_path: string;
  rank: number;
}

const entityTypeConfig = {
  contact: { label: "Contacts", icon: User, color: "bg-blue-100 text-blue-800 hover:bg-blue-200" },
  appointment: { label: "Appointments", icon: Calendar, color: "bg-green-100 text-green-800 hover:bg-green-200" },
  task: { label: "Tasks", icon: CheckSquare, color: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200" },
  document: { label: "Documents", icon: FileText, color: "bg-purple-100 text-purple-800 hover:bg-purple-200" },
  activity: { label: "Activities", icon: Activity, color: "bg-red-100 text-red-800 hover:bg-red-200" }
};

const SearchPage = () => {
  const navigate = useNavigate();
  const { groupId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  
  const [searchValue, setSearchValue] = useState(searchParams.get("q") || "");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>(
    searchParams.get("types")?.split(",").filter(Boolean) || []
  );
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Helper to sanitize HTML - only allow <mark> tags
  const sanitizeHTML = (html: string) => {
    return html.replace(/<(?!\/?mark\b)[^>]*>/gi, "");
  };

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (!query.trim() || !groupId) return;
      
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc("search_all", {
          q: query.trim(),
          group_id: groupId,
          lim: 50
        });

        if (error) {
          throw new Error(error.message);
        }

        setResults(data || []);
      } catch (error) {
        console.error("Search error:", error);
        toast({
          title: "Search Error",
          description: "Failed to search. Please try again.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    }, 250),
    [groupId, toast]
  );

  // Update URL when search or filters change
  const updateURL = useCallback((query: string, filters: string[]) => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (filters.length > 0) params.set("types", filters.join(","));
    setSearchParams(params);
  }, [setSearchParams]);

  // Handle search input changes
  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    setFocusedIndex(-1);
    if (value.trim()) {
      debouncedSearch(value);
      updateURL(value, activeFilters);
    } else {
      setResults([]);
      updateURL("", activeFilters);
    }
  };

  // Handle filter toggle
  const toggleFilter = (entityType: string) => {
    const newFilters = activeFilters.includes(entityType)
      ? activeFilters.filter(f => f !== entityType)
      : [...activeFilters, entityType];
    
    setActiveFilters(newFilters);
    updateURL(searchValue, newFilters);
  };

  // Filter results based on active filters
  const filteredResults = activeFilters.length > 0
    ? results.filter(r => activeFilters.includes(r.entity_type))
    : results;

  // Group results by entity type
  const groupedResults = filteredResults.reduce((acc, result) => {
    if (!acc[result.entity_type]) {
      acc[result.entity_type] = [];
    }
    acc[result.entity_type].push(result);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  // Get flattened results for keyboard navigation
  const flatResults = Object.entries(groupedResults).flatMap(([type, results]) => 
    results.map(result => ({ ...result, groupType: type }))
  );

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex(prev => Math.min(prev + 1, flatResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < flatResults.length) {
        navigate(flatResults[focusedIndex].url_path);
      } else if (searchValue.trim()) {
        debouncedSearch(searchValue);
      }
    }
  };

  // Handle result click
  const handleResultClick = (urlPath: string) => {
    navigate(urlPath);
  };

  // Load initial search if query in URL
  useEffect(() => {
    const query = searchParams.get("q");
    if (query && query !== searchValue) {
      setSearchValue(query);
      debouncedSearch(query);
    }
  }, [searchParams, debouncedSearch]);

  return (
    <div className="space-y-6">
      <SEO title="Search — DaveAssist" description="Search across appointments, tasks, documents, contacts, and activities." />
      
      {/* Search Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Search</h2>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search appointments, tasks, documents, contacts, and activities..."
            value={searchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-10 text-lg py-3"
            autoFocus
          />
        </div>

        {/* Filter Chips */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(entityTypeConfig).map(([type, config]) => {
            const isActive = activeFilters.includes(type);
            const count = results.filter(r => r.entity_type === type).length;
            
            return (
              <Button
                key={type}
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => toggleFilter(type)}
                className={isActive ? "" : config.color}
              >
                <config.icon className="h-4 w-4 mr-1" />
                {config.label}
                {count > 0 && <Badge variant="secondary" className="ml-2">{count}</Badge>}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Results */}
      {loading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Searching...</p>
        </div>
      )}

      {!loading && searchValue && filteredResults.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No results found</h3>
            <p className="text-muted-foreground">
              Try different keywords or check your spelling. You can also adjust the filters above.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && !searchValue && (
        <Card>
          <CardContent className="py-8 text-center">
            <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Start searching</h3>
            <p className="text-muted-foreground">
              Enter keywords to search across appointments, tasks, documents, contacts, and activities.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Grouped Results */}
      {!loading && filteredResults.length > 0 && (
        <div className="space-y-6">
          {Object.entries(groupedResults).map(([entityType, results]) => {
            const config = entityTypeConfig[entityType as keyof typeof entityTypeConfig];
            if (!config || results.length === 0) return null;

            return (
              <div key={entityType} className="space-y-3">
                <div className="flex items-center gap-2">
                  <config.icon className="h-5 w-5" />
                  <h3 className="text-lg font-medium">{config.label}</h3>
                  <Badge variant="secondary">{results.length}</Badge>
                </div>
                
                <div className="space-y-2">
                  {results.map((result, index) => {
                    const globalIndex = flatResults.findIndex(r => 
                      r.entity_id === result.entity_id && r.entity_type === result.entity_type
                    );
                    const isFocused = focusedIndex === globalIndex;
                    
                    return (
                      <Card 
                        key={`${result.entity_type}-${result.entity_id}`}
                        className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                          isFocused ? "ring-2 ring-primary bg-muted/50" : ""
                        }`}
                        onClick={() => handleResultClick(result.url_path)}
                      >
                        <CardContent className="py-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium truncate">{result.title}</h4>
                              {result.snippet_html && (
                                <p 
                                  className="text-sm text-muted-foreground mt-1 line-clamp-1"
                                  dangerouslySetInnerHTML={{ 
                                    __html: sanitizeHTML(result.snippet_html) 
                                  }}
                                />
                              )}
                              <ContactChips 
                                entityType={result.entity_type} 
                                entityId={result.entity_id}
                                maxVisible={3}
                              />
                            </div>
                            <Badge variant="outline" className="ml-2 shrink-0">
                              {Math.round(result.rank * 100)}%
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SearchPage;