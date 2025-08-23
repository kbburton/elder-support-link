import { useRef, useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface ProfileImageCropProps {
  imageFile: File | null;
  isOpen: boolean;
  onClose: () => void;
  onCropComplete: (croppedFile: File) => void;
}

export const ProfileImageCrop = ({ imageFile, isOpen, onClose, onCropComplete }: ProfileImageCropProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, size: 200 });
  const [imageLoaded, setImageLoaded] = useState(false);

  console.log('ProfileImageCrop: Component render', { 
    hasImageFile: !!imageFile, 
    fileName: imageFile?.name,
    isOpen,
    imageLoaded,
    cropArea
  });

  const loadImage = useCallback(() => {
    if (!imageFile || !imageRef.current) {
      console.log('ProfileImageCrop: Missing imageFile or imageRef', { 
        hasImageFile: !!imageFile, 
        hasImageRef: !!imageRef.current,
        fileName: imageFile?.name 
      });
      return;
    }

    console.log('ProfileImageCrop: Loading image', { 
      fileName: imageFile.name, 
      fileSize: imageFile.size, 
      fileType: imageFile.type 
    });

    const img = imageRef.current;
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const result = e.target?.result;
      console.log('ProfileImageCrop: FileReader loaded', { hasResult: !!result });
      
      if (!result) {
        console.error('ProfileImageCrop: FileReader returned no result');
        return;
      }
      
      img.onload = () => {
        console.log('ProfileImageCrop: Image loaded successfully', { 
          width: img.naturalWidth, 
          height: img.naturalHeight 
        });
        
        setImageLoaded(true);
        
        // Center the crop area
        const canvas = canvasRef.current;
        if (canvas) {
          const containerWidth = 400;
          const containerHeight = 300;
          const imgAspect = img.naturalWidth / img.naturalHeight;
          
          let displayWidth, displayHeight;
          if (imgAspect > containerWidth / containerHeight) {
            displayWidth = containerWidth;
            displayHeight = containerWidth / imgAspect;
          } else {
            displayHeight = containerHeight;
            displayWidth = containerHeight * imgAspect;
          }
          
          const cropSize = Math.min(displayWidth, displayHeight) * 0.6;
          setCropArea({
            x: (displayWidth - cropSize) / 2,
            y: (displayHeight - cropSize) / 2,
            size: cropSize
          });
        }
      };
      
      img.onerror = (error) => {
        console.error('ProfileImageCrop: Image failed to load', error);
        setImageLoaded(false);
      };
      
      img.src = result as string;
    };
    
    reader.onerror = (error) => {
      console.error('ProfileImageCrop: FileReader error', error);
      setImageLoaded(false);
    };
    
    console.log('ProfileImageCrop: Starting to read file');
    reader.readAsDataURL(imageFile);
  }, [imageFile]);

  useEffect(() => {
    if (isOpen && imageFile) {
      setImageLoaded(false); // Reset the state
      loadImage();
    }
  }, [isOpen, imageFile, loadImage]);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img || !imageLoaded) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Calculate display size
    const containerWidth = 400;
    const containerHeight = 300;
    const imgAspect = img.naturalWidth / img.naturalHeight;
    
    let displayWidth, displayHeight;
    if (imgAspect > containerWidth / containerHeight) {
      displayWidth = containerWidth;
      displayHeight = containerWidth / imgAspect;
    } else {
      displayHeight = containerHeight;
      displayWidth = containerHeight * imgAspect;
    }

    // Draw image
    ctx.drawImage(img, 0, 0, displayWidth, displayHeight);
    
    // Draw overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Clear crop area
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(cropArea.x, cropArea.y, cropArea.size, cropArea.size);
    
    // Draw crop border
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(cropArea.x, cropArea.y, cropArea.size, cropArea.size);
  }, [cropArea, imageLoaded]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Check if click is inside crop area
    if (
      x >= cropArea.x && 
      x <= cropArea.x + cropArea.size && 
      y >= cropArea.y && 
      y <= cropArea.y + cropArea.size
    ) {
      setIsDragging(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setCropArea(prev => ({
      ...prev,
      x: Math.max(0, Math.min(canvas.width - prev.size, x - prev.size / 2)),
      y: Math.max(0, Math.min(canvas.height - prev.size, y - prev.size / 2))
    }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleCrop = () => {
    console.log('ProfileImageCrop: handleCrop called', { 
      hasImageFile: !!imageFile,
      imageLoaded,
      hasCanvas: !!canvasRef.current,
      hasImageRef: !!imageRef.current,
      cropArea 
    });
    
    const canvas = canvasRef.current;
    const img = imageRef.current;
    
    if (!canvas || !img || !imageFile || !imageLoaded) {
      console.error('ProfileImageCrop: Missing required elements for crop', {
        hasCanvas: !!canvas,
        hasImageRef: !!img, 
        hasImageFile: !!imageFile,
        imageLoaded
      });
      return;
    }

    // Create a new canvas for the cropped image
    const cropCanvas = document.createElement('canvas');
    const cropCtx = cropCanvas.getContext('2d');
    if (!cropCtx) return;

    cropCanvas.width = 300;
    cropCanvas.height = 300;

    // Calculate the source coordinates on the original image
    const containerWidth = 400;
    const containerHeight = 300;
    const imgAspect = img.naturalWidth / img.naturalHeight;
    
    let displayWidth, displayHeight;
    if (imgAspect > containerWidth / containerHeight) {
      displayWidth = containerWidth;
      displayHeight = containerWidth / imgAspect;
    } else {
      displayHeight = containerHeight;
      displayWidth = containerHeight * imgAspect;
    }

    const scaleX = img.naturalWidth / displayWidth;
    const scaleY = img.naturalHeight / displayHeight;
    
    const sourceX = cropArea.x * scaleX;
    const sourceY = cropArea.y * scaleY;
    const sourceSize = cropArea.size * scaleX;

    // Draw the cropped area
    cropCtx.drawImage(
      img,
      sourceX, sourceY, sourceSize, sourceSize,
      0, 0, 300, 300
    );

    // Convert to blob and create file
    cropCanvas.toBlob((blob) => {
      if (blob) {
        console.log('ProfileImageCrop: Blob created successfully', { size: blob.size });
        const croppedFile = new File([blob], 'profile-picture.jpg', { 
          type: 'image/jpeg',
          lastModified: Date.now()
        });
        console.log('ProfileImageCrop: Calling onCropComplete with file:', croppedFile.name);
        onCropComplete(croppedFile);
      } else {
        console.error('ProfileImageCrop: Failed to create blob from canvas');
      }
    }, 'image/jpeg', 0.9);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Crop Profile Picture</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={400}
              height={300}
              className="border border-border rounded-lg cursor-move"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
            <img
              ref={imageRef}
              className="hidden"
              alt="Original"
            />
          </div>
          
          <div className="text-sm text-muted-foreground text-center">
            Drag the square to position your photo
          </div>
          
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium">Preview:</div>
            <div className="w-12 h-12 border-2 border-border rounded-full overflow-hidden bg-muted">
              {imageLoaded && (
                <canvas
                  width={48}
                  height={48}
                  ref={(previewCanvas) => {
                    if (previewCanvas && imageRef.current && imageLoaded) {
                      const ctx = previewCanvas.getContext('2d');
                      const img = imageRef.current;
                      if (ctx) {
                        const containerWidth = 400;
                        const containerHeight = 300;
                        const imgAspect = img.naturalWidth / img.naturalHeight;
                        
                        let displayWidth, displayHeight;
                        if (imgAspect > containerWidth / containerHeight) {
                          displayWidth = containerWidth;
                          displayHeight = containerWidth / imgAspect;
                        } else {
                          displayHeight = containerHeight;
                          displayWidth = containerHeight * imgAspect;
                        }

                        const scaleX = img.naturalWidth / displayWidth;
                        const scaleY = img.naturalHeight / displayHeight;
                        
                        const sourceX = cropArea.x * scaleX;
                        const sourceY = cropArea.y * scaleY;
                        const sourceSize = cropArea.size * scaleX;

                        ctx.drawImage(
                          img,
                          sourceX, sourceY, sourceSize, sourceSize,
                          0, 0, 48, 48
                        );
                      }
                    }
                  }}
                />
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button 
            onClick={handleCrop} 
            disabled={!imageLoaded}
            type="button"
          >
            Crop & Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};