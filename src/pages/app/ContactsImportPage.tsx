import { useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import Papa from "papaparse";
import { parsePhoneNumber, isValidPhoneNumber } from "libphonenumber-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Upload, Download, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

interface ParsedContact {
  row: number;
  data: Record<string, string>;
  normalized: {
    first_name?: string;
    last_name?: string;
    organization_name?: string;
    contact_type: "medical" | "legal" | "family" | "friend" | "other";
    gender?: "female" | "male" | "x_or_other" | "prefer_not_to_say";
    phone_primary?: string;
    phone_secondary?: string;
    email_personal?: string;
    email_work?: string;
    address_line1?: string;
    address_line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    preferred_contact_method?: string;
    notes?: string;
  };
  errors: string[];
  warnings: string[];
}

interface FieldMapping {
  csvField: string;
  contactField: string;
}

const CONTACT_FIELDS = [
  { value: "first_name", label: "First Name" },
  { value: "last_name", label: "Last Name" },
  { value: "organization_name", label: "Organization Name" },
  { value: "contact_type", label: "Contact Type" },
  { value: "gender", label: "Gender" },
  { value: "phone_primary", label: "Primary Phone" },
  { value: "phone_secondary", label: "Secondary Phone" },
  { value: "email_personal", label: "Personal Email" },
  { value: "email_work", label: "Work Email" },
  { value: "address_line1", label: "Address Line 1" },
  { value: "address_line2", label: "Address Line 2" },
  { value: "city", label: "City" },
  { value: "state", label: "State" },
  { value: "postal_code", label: "ZIP Code" },
  { value: "preferred_contact_method", label: "Preferred Contact Method" },
  { value: "notes", label: "Notes" },
];

export default function ContactsImportPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [parsedContacts, setParsedContacts] = useState<ParsedContact[]>([]);
  const [existingContacts, setExistingContacts] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState<"upload" | "mapping" | "preview" | "importing">("upload");

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      Papa.parse(file, {
        complete: (result) => {
          setCsvData(result.data as string[][]);
          if (result.data.length > 0) {
            // Auto-map common field names
            const headers = result.data[0] as string[];
            const autoMappings = headers.map((header, index) => {
              const normalizedHeader = header.toLowerCase().replace(/[\s_-]/g, "");
              let contactField = "";
              
              // Auto-mapping logic
              if (normalizedHeader.includes("firstname") || normalizedHeader === "first") contactField = "first_name";
              else if (normalizedHeader.includes("lastname") || normalizedHeader === "last") contactField = "last_name";
              else if (normalizedHeader.includes("organization") || normalizedHeader.includes("company")) contactField = "organization_name";
              else if (normalizedHeader.includes("phone") || normalizedHeader.includes("mobile")) contactField = "phone_primary";
              else if (normalizedHeader.includes("email")) contactField = "email_personal";
              else if (normalizedHeader.includes("address") && !normalizedHeader.includes("2")) contactField = "address_line1";
              else if (normalizedHeader.includes("address2")) contactField = "address_line2";
              else if (normalizedHeader.includes("city")) contactField = "city";
              else if (normalizedHeader.includes("state")) contactField = "state";
              else if (normalizedHeader.includes("zip") || normalizedHeader.includes("postal")) contactField = "postal_code";
              else if (normalizedHeader.includes("type")) contactField = "contact_type";
              else if (normalizedHeader.includes("gender")) contactField = "gender";
              else if (normalizedHeader.includes("note")) contactField = "notes";
              
              return { csvField: header, contactField };
            });
            setFieldMappings(autoMappings);
            setCurrentStep("mapping");
          }
        },
        header: false,
        skipEmptyLines: true,
      });
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv']
    },
    maxFiles: 1,
  });

  const normalizePhone = (phone: string): string | null => {
    if (!phone) return null;
    
    try {
      // Remove all non-digit characters
      const digitsOnly = phone.replace(/\D/g, "");
      
      // If 10 digits, assume US number
      if (digitsOnly.length === 10) {
        const parsed = parsePhoneNumber(`+1${digitsOnly}`);
        return parsed.number;
      }
      
      // If 11 digits and starts with 1, assume US number
      if (digitsOnly.length === 11 && digitsOnly.startsWith("1")) {
        const parsed = parsePhoneNumber(`+${digitsOnly}`);
        return parsed.number;
      }
      
      // Try parsing as international
      if (isValidPhoneNumber(phone)) {
        const parsed = parsePhoneNumber(phone);
        return parsed.number;
      }
      
      return null;
    } catch (error) {
      return null;
    }
  };

  const validateZip = (zip: string): boolean => {
    if (!zip) return true; // Optional field
    return /^\d{5}(-\d{4})?$/.test(zip);
  };

  const validateState = (state: string): boolean => {
    if (!state) return true; // Optional field
    return US_STATES.includes(state.toUpperCase());
  };

  const parseContacts = () => {
    if (csvData.length < 2) return;
    
    const headers = csvData[0];
    const dataRows = csvData.slice(1);
    
    const parsed: ParsedContact[] = dataRows.map((row, index) => {
      const data: Record<string, string> = {};
      const normalized: any = { contact_type: "other" as const };
      const errors: string[] = [];
      const warnings: string[] = [];
      
      // Map CSV data to contact fields
      headers.forEach((header, i) => {
        data[header] = row[i] || "";
      });
      
      fieldMappings.forEach(mapping => {
        if (mapping.contactField && data[mapping.csvField]) {
          const value = data[mapping.csvField].trim();
          
          if (mapping.contactField === "phone_primary" || mapping.contactField === "phone_secondary") {
            const normalizedPhone = normalizePhone(value);
            if (value && !normalizedPhone) {
              errors.push(`Invalid phone number: ${value}`);
            } else {
              normalized[mapping.contactField] = normalizedPhone;
            }
          } else if (mapping.contactField === "state") {
            if (value && !validateState(value)) {
              errors.push(`Invalid state: ${value}. Must be 2-letter US state code.`);
            } else {
              normalized[mapping.contactField] = value.toUpperCase();
            }
          } else if (mapping.contactField === "postal_code") {
            if (value && !validateZip(value)) {
              errors.push(`Invalid ZIP code: ${value}. Must be 5 digits or ZIP+4 format.`);
            } else {
              normalized[mapping.contactField] = value;
            }
          } else if (mapping.contactField === "contact_type") {
            const validTypes = ["medical", "legal", "family", "friend", "other"] as const;
            const lowerValue = value.toLowerCase() as typeof validTypes[number];
            if (validTypes.includes(lowerValue)) {
              normalized[mapping.contactField] = lowerValue;
            } else {
              normalized[mapping.contactField] = "other" as const;
              warnings.push(`Unknown contact type "${value}", defaulting to "other"`);
            }
          } else if (mapping.contactField === "gender") {
            const genderMap: Record<string, string> = {
              "f": "female", "female": "female", "woman": "female",
              "m": "male", "male": "male", "man": "male",
              "x": "x_or_other", "other": "x_or_other", "non-binary": "x_or_other",
              "prefer not to say": "prefer_not_to_say", "none": "prefer_not_to_say"
            };
            const mappedGender = genderMap[value.toLowerCase()];
            if (value && !mappedGender) {
              warnings.push(`Unknown gender "${value}", leaving blank`);
            } else {
              normalized[mapping.contactField] = mappedGender;
            }
          } else {
            normalized[mapping.contactField] = value;
          }
        }
      });
      
      // Validation: require at least name or organization
      const hasName = normalized.first_name || normalized.last_name;
      const hasOrg = normalized.organization_name;
      if (!hasName && !hasOrg) {
        errors.push("Must have either name or organization");
      }
      
      // Validation: require at least one contact method
      const hasContact = normalized.phone_primary || normalized.email_personal || normalized.email_work;
      if (!hasContact) {
        errors.push("Must have at least one contact method (phone or email)");
      }
      
      return {
        row: index + 2, // +2 because we skip header and 0-index
        data,
        normalized,
        errors,
        warnings,
      };
    });
    
    setParsedContacts(parsed);
    checkForDuplicates(parsed);
    setCurrentStep("preview");
  };

  const checkForDuplicates = async (contacts: ParsedContact[]) => {
    try {
      const { data: existing } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, organization_name, phone_primary, email_personal, email_work")
        .eq("care_group_id", groupId);
      
      setExistingContacts(existing || []);
      
      // Check for duplicates within import and against existing
      const allEmails = new Set();
      const allPhones = new Set();
      
      // Add existing contact info to sets
      existing?.forEach(contact => {
        if (contact.phone_primary) allPhones.add(contact.phone_primary);
        if (contact.email_personal) allEmails.add(contact.email_personal);
        if (contact.email_work) allEmails.add(contact.email_work);
      });
      
      contacts.forEach(contact => {
        const { normalized } = contact;
        
        // Check phone duplicates
        if (normalized.phone_primary) {
          if (allPhones.has(normalized.phone_primary)) {
            contact.warnings.push("Duplicate phone number detected");
          } else {
            allPhones.add(normalized.phone_primary);
          }
        }
        
        // Check email duplicates
        if (normalized.email_personal) {
          if (allEmails.has(normalized.email_personal)) {
            contact.warnings.push("Duplicate personal email detected");
          } else {
            allEmails.add(normalized.email_personal);
          }
        }
        
        if (normalized.email_work) {
          if (allEmails.has(normalized.email_work)) {
            contact.warnings.push("Duplicate work email detected");
          } else {
            allEmails.add(normalized.email_work);
          }
        }
      });
    } catch (error) {
      console.error("Error checking for duplicates:", error);
    }
  };

  const importContacts = async () => {
    const validContacts = parsedContacts.filter(c => c.errors.length === 0);
    if (validContacts.length === 0) {
      toast({
        title: "No valid contacts",
        description: "Please fix the errors before importing.",
        variant: "destructive",
      });
      return;
    }
    
    setImporting(true);
    setCurrentStep("importing");
    
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error("Not authenticated");
      
      const contactsToInsert = validContacts.map(contact => ({
        ...contact.normalized,
        care_group_id: groupId,
        created_by_user_id: user.data.user.id,
      }));
      
      let imported = 0;
      const batchSize = 10;
      
      for (let i = 0; i < contactsToInsert.length; i += batchSize) {
        const batch = contactsToInsert.slice(i, i + batchSize);
        const { error } = await supabase.from("contacts").insert(batch);
        
        if (error) throw error;
        
        imported += batch.length;
        setImportProgress((imported / contactsToInsert.length) * 100);
      }
      
      toast({
        title: "Import successful",
        description: `Successfully imported ${imported} contacts.`,
      });
      
      navigate(`/app/${groupId}/contacts`);
    } catch (error: any) {
      console.error("Import error:", error);
      toast({
        title: "Import failed",
        description: error.message || "Failed to import contacts.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      ["first_name", "last_name", "organization_name", "contact_type", "phone_primary", "email_personal", "address_line1", "city", "state", "postal_code"],
      ["John", "Doe", "", "family", "(555) 123-4567", "john.doe@example.com", "123 Main St", "Anytown", "CA", "90210"],
      ["", "", "ABC Medical Center", "medical", "+1-555-987-6543", "info@abcmedical.com", "456 Oak Ave", "Springfield", "IL", "62701"]
    ];
    
    const csv = Papa.unparse(template);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contacts_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const validContacts = parsedContacts.filter(c => c.errors.length === 0);
  const contactsWithErrors = parsedContacts.filter(c => c.errors.length > 0);
  const contactsWithWarnings = parsedContacts.filter(c => c.warnings.length > 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to={`/app/${groupId}/contacts`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Contacts
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">Import Contacts</h1>
      </div>

      <Tabs value={currentStep} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="upload" disabled={currentStep !== "upload" && currentStep !== "mapping"}>
            1. Upload CSV
          </TabsTrigger>
          <TabsTrigger value="mapping" disabled={currentStep === "upload"}>
            2. Map Fields
          </TabsTrigger>
          <TabsTrigger value="preview" disabled={currentStep === "upload" || currentStep === "mapping"}>
            3. Preview & Confirm
          </TabsTrigger>
          <TabsTrigger value="importing" disabled={currentStep !== "importing"}>
            4. Import
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload CSV File</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  Upload a CSV file with your contact data. Download the template below for the correct format.
                </p>
                <Button variant="outline" onClick={downloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </div>
              
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25"
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                {isDragActive ? (
                  <p>Drop the CSV file here...</p>
                ) : (
                  <div>
                    <p className="mb-2">Drag & drop a CSV file here, or click to select</p>
                    <p className="text-sm text-muted-foreground">Only .csv files are accepted</p>
                  </div>
                )}
              </div>
              
              {csvData.length > 0 && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Successfully loaded {csvData.length - 1} rows from CSV file.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mapping" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Map CSV Fields</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground mb-4">
                Map your CSV columns to contact fields. Fields have been auto-mapped where possible.
              </p>
              
              <div className="grid gap-4 md:grid-cols-2">
                {fieldMappings.map((mapping, index) => (
                  <div key={index} className="flex items-center space-x-4">
                    <div className="flex-1">
                      <label className="text-sm font-medium">{mapping.csvField}</label>
                    </div>
                    <div className="flex-1">
                      <Select
                        value={mapping.contactField}
                        onValueChange={(value) => {
                          const newMappings = [...fieldMappings];
                          newMappings[index].contactField = value;
                          setFieldMappings(newMappings);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select field..." />
                        </SelectTrigger>
                        <SelectContent className="bg-background border shadow-lg">
                          <SelectItem value="">-- Skip --</SelectItem>
                          {CONTACT_FIELDS.map((field) => (
                            <SelectItem key={field.value} value={field.value}>
                              {field.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex justify-end">
                <Button onClick={parseContacts}>
                  Continue to Preview
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="font-medium">{validContacts.length} Valid</span>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <span className="font-medium">{contactsWithWarnings.length} Warnings</span>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <span className="font-medium">{contactsWithErrors.length} Errors</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {contactsWithErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {contactsWithErrors.length} contact(s) have errors and will not be imported. Please fix the errors in your CSV and re-upload.
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Preview Contacts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>Name/Organization</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedContacts.map((contact) => (
                      <TableRow key={contact.row}>
                        <TableCell>{contact.row}</TableCell>
                        <TableCell>
                          {contact.normalized.organization_name || 
                           `${contact.normalized.first_name || ""} ${contact.normalized.last_name || ""}`.trim() ||
                           "Unnamed"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{contact.normalized.contact_type}</Badge>
                        </TableCell>
                        <TableCell>{contact.normalized.phone_primary || "-"}</TableCell>
                        <TableCell>{contact.normalized.email_personal || contact.normalized.email_work || "-"}</TableCell>
                        <TableCell>
                          <div className="flex flex-col space-y-1">
                            {contact.errors.length > 0 && (
                              <Badge variant="destructive" className="text-xs">
                                {contact.errors.length} error(s)
                              </Badge>
                            )}
                            {contact.warnings.length > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                {contact.warnings.length} warning(s)
                              </Badge>
                            )}
                            {contact.errors.length === 0 && contact.warnings.length === 0 && (
                              <Badge variant="default" className="text-xs">Valid</Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              <div className="flex justify-between items-center mt-4">
                <Button variant="outline" onClick={() => setCurrentStep("mapping")}>
                  Back to Mapping
                </Button>
                <Button 
                  onClick={importContacts}
                  disabled={validContacts.length === 0}
                >
                  Import {validContacts.length} Contact(s)
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="importing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Importing Contacts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={importProgress} className="w-full" />
              <p className="text-center text-muted-foreground">
                {importing ? "Importing contacts..." : "Import complete!"}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}