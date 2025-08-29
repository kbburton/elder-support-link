import { useState, useRef } from "react";
import { Upload, Camera, User, Users, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ProfileImageCrop } from "./ProfileImageCrop";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface ProfileImageUploadProps {
  currentImageUrl?: string | null;
  gender?: string | null;
  recipientName?: string;
  groupId: string;
  onImageChange: (imageUrl: string | null) => void;
  size?: "sm" | "md" | "lg";
}

export const ProfileImageUpload = ({ 
  currentImageUrl, 
  gender, 
  recipientName,
  groupId,
  onImageChange,
  size = "lg" 
}: ProfileImageUploadProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  console.log('ProfileImageUpload: Component render', { 
    hasSelectedFile: !!selectedFile, 
    fileName: selectedFile?.name,
    isCropOpen,
    uploading 
  });

  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-16 h-16", 
    lg: "w-24 h-24"
  };

  const iconSizes = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12"
  };

  const getGenderIcon = () => {
    switch (gender) {
      case 'female':
        return <Users className={`${iconSizes[size]} text-muted-foreground`} />;
      case 'other':
        return <UserCircle className={`${iconSizes[size]} text-muted-foreground`} />;
      default:
        return <User className={`${iconSizes[size]} text-muted-foreground`} />;
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('ProfileImageUpload: handleFileSelect triggered');
    const file = event.target.files?.[0];
    
    if (!file) {
      console.log('ProfileImageUpload: No file selected');
      return;
    }

    console.log('ProfileImageUpload: File selected', {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    });

    // Validate file type
    if (!file.type.startsWith('image/')) {
      console.log('ProfileImageUpload: Invalid file type:', file.type);
      toast({
        title: "Invalid file type",
        description: "Please select an image file",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      console.log('ProfileImageUpload: File too large:', file.size);
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB",
        variant: "destructive"
      });
      return;
    }

    console.log('ProfileImageUpload: About to set selectedFile and open crop modal');
    
    // Use functional update to ensure we get the latest state
    setSelectedFile((prev) => {
      console.log('ProfileImageUpload: setSelectedFile callback, prev:', prev?.name);
      console.log('ProfileImageUpload: setSelectedFile callback, new file:', file.name);
      return file;
    });
    
    setIsCropOpen((prev) => {
      console.log('ProfileImageUpload: setIsCropOpen callback, prev:', prev);
      return true;
    });
    
    // Log to verify the file is still there after state update
    setTimeout(() => {
      console.log('ProfileImageUpload: State check after 100ms - selectedFile should be set');
    }, 100);
  };

  const handleCropComplete = async (croppedFile: File) => {
    console.log('ProfileImageUpload: handleCropComplete called', { 
      fileName: croppedFile.name,
      hasSelectedFile: !!selectedFile,
      isCropOpen 
    });
    
    if (!croppedFile || croppedFile.size === 0) {
      console.error('ProfileImageUpload: Invalid cropped file received');
      return;
    }
    
    setIsCropOpen(false);
    setUploading(true);

    try {
      console.log('ProfileImageUpload: Starting upload process...');
      
      // Delete existing image if any
      if (currentImageUrl) {
        console.log('ProfileImageUpload: Deleting existing image');
        const path = currentImageUrl.split('/').pop();
        if (path) {
          await supabase.storage
            .from('profile-pictures')
            .remove([`${groupId}/${path}`]);
        }
      }

      // Upload new image
      const fileName = `profile-picture-${Date.now()}.jpg`;
      console.log('ProfileImageUpload: Uploading new image as:', fileName);
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(`${groupId}/${fileName}`, croppedFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(uploadData.path);

      console.log('ProfileImageUpload: Upload successful, updating database with URL:', publicUrl);

      // Save directly to database
      const { error: updateError } = await supabase
        .from('care_groups')
        .update({ profile_picture_url: publicUrl })
        .eq('id', groupId);

      if (updateError) throw updateError;

      console.log('ProfileImageUpload: Database updated successfully');
      onImageChange(publicUrl);
      
      // Refresh all related queries to update UI
      queryClient.invalidateQueries({ queryKey: ["care_group", groupId] });
      queryClient.invalidateQueries({ queryKey: ["care_group_header", groupId] });
      queryClient.invalidateQueries({ queryKey: ["care_group_name", groupId] });
      
      console.log('ProfileImageUpload: Showing success toast');
      toast({
        title: "Success",
        description: "Profile picture updated successfully"
      });

    } catch (error) {
      console.error('ProfileImageUpload: Error uploading image:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload profile picture. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      console.log('ProfileImageUpload: Upload process completed');
    }
  };

  const handleRemoveImage = async () => {
    if (!currentImageUrl) return;

    setUploading(true);
    try {
      const path = currentImageUrl.split('/').pop();
      if (path) {
        await supabase.storage
          .from('profile-pictures')
          .remove([`${groupId}/${path}`]);
      }

      // Remove from database
      const { error: updateError } = await supabase
        .from('care_groups')
        .update({ profile_picture_url: null })
        .eq('id', groupId);

      if (updateError) throw updateError;

      onImageChange(null);
      
      // Refresh all related queries to update UI
      queryClient.invalidateQueries({ queryKey: ["care_group", groupId] });
      queryClient.invalidateQueries({ queryKey: ["care_group_header", groupId] });
      queryClient.invalidateQueries({ queryKey: ["care_group_name", groupId] });
      
      toast({
        title: "Success",
        description: "Profile picture removed"
      });

    } catch (error) {
      console.error('Error removing image:', error);
      toast({
        title: "Remove failed",
        description: "Failed to remove profile picture. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className="flex flex-col items-center gap-3">
        <Avatar className={sizeClasses[size]}>
          {currentImageUrl && currentImageUrl.trim() ? (
            <AvatarImage src={currentImageUrl} alt={recipientName || "Profile"} />
          ) : null}
          <AvatarFallback>
            {getGenderIcon()}
          </AvatarFallback>
        </Avatar>

        {size === "lg" && (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                console.log('ProfileImageUpload: Upload button clicked');
                fileInputRef.current?.click();
              }}
              disabled={uploading}
            >
              <Camera className="h-4 w-4 mr-2" />
              {currentImageUrl ? "Change" : "Upload"}
            </Button>
            
            {currentImageUrl && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  console.log('ProfileImageUpload: Remove button clicked');
                  handleRemoveImage();
                }}
                disabled={uploading}
              >
                Remove
              </Button>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      <ProfileImageCrop
        imageFile={selectedFile}
        isOpen={isCropOpen}
        onClose={() => {
          console.log('ProfileImageUpload: Crop modal closing');
          setIsCropOpen(false);
          setSelectedFile(null);
        }}
        onCropComplete={handleCropComplete}
      />
    </>
  );
};