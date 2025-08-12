interface Contact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  organization_name: string | null;
  phone_primary: string | null;
  phone_secondary: string | null;
  email_personal: string | null;
  email_work: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  photo_url: string | null;
}

export function generateVCard(contact: Contact): string {
  const lines: string[] = [];
  
  // vCard 4.0 header
  lines.push("BEGIN:VCARD");
  lines.push("VERSION:4.0");
  
  // Name (N) - required field
  // Format: N:Last;First;Middle;Prefix;Suffix
  const lastName = contact.last_name || "";
  const firstName = contact.first_name || "";
  lines.push(`N:${lastName};${firstName};;;`);
  
  // Full name (FN) - required field
  let fullName = "";
  if (contact.organization_name) {
    fullName = contact.organization_name;
  } else {
    fullName = `${firstName} ${lastName}`.trim() || "Unknown Contact";
  }
  lines.push(`FN:${fullName}`);
  
  // Organization (ORG)
  if (contact.organization_name) {
    lines.push(`ORG:${contact.organization_name}`);
  }
  
  // Phone numbers (TEL)
  if (contact.phone_primary) {
    lines.push(`TEL;TYPE=CELL:${contact.phone_primary}`);
  }
  if (contact.phone_secondary) {
    lines.push(`TEL;TYPE=VOICE:${contact.phone_secondary}`);
  }
  
  // Email addresses (EMAIL)
  if (contact.email_personal) {
    lines.push(`EMAIL;TYPE=HOME:${contact.email_personal}`);
  }
  if (contact.email_work) {
    lines.push(`EMAIL;TYPE=WORK:${contact.email_work}`);
  }
  
  // Address (ADR)
  // Format: ADR:POBox;ExtendedAddress;Street;City;State;PostalCode;Country
  const hasAddress = contact.address_line1 || contact.city || contact.state || contact.postal_code;
  if (hasAddress) {
    const addressLine = contact.address_line2 
      ? `${contact.address_line1 || ""} ${contact.address_line2}`
      : (contact.address_line1 || "");
    
    lines.push(`ADR;TYPE=HOME:;;${addressLine};${contact.city || ""};${contact.state || ""};${contact.postal_code || ""};USA`);
  }
  
  // Photo (PHOTO)
  if (contact.photo_url) {
    lines.push(`PHOTO:${contact.photo_url}`);
  }
  
  // Unique identifier
  lines.push(`UID:${contact.id}`);
  
  // Production date
  const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  lines.push(`PRODID:-//DaveAssist//Contact Export//EN`);
  lines.push(`REV:${now}`);
  
  // vCard footer
  lines.push("END:VCARD");
  
  return lines.join("\r\n");
}

export function generateVCardFile(contacts: Contact[], filename?: string): void {
  let vcardContent = "";
  
  contacts.forEach(contact => {
    vcardContent += generateVCard(contact) + "\r\n";
  });
  
  const blob = new Blob([vcardContent], { type: "text/vcard;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.href = url;
  
  if (contacts.length === 1) {
    const contact = contacts[0];
    const name = contact.organization_name || 
                 `${contact.first_name || ""} ${contact.last_name || ""}`.trim() || 
                 "contact";
    link.download = filename || `${name.replace(/[^a-zA-Z0-9]/g, "_")}.vcf`;
  } else {
    link.download = filename || `contacts_${new Date().toISOString().split("T")[0]}.vcf`;
  }
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}