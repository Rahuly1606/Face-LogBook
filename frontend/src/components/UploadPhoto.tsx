import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, X, Image as ImageIcon, CheckCircle } from 'lucide-react';
import { validateImageFile, resizeImage } from '@/utils/imageHelpers';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface UploadPhotoProps {
  onImageSelect: (file: File | null) => void;
  currentImage?: string | null;
  label?: string;
}

const UploadPhoto: React.FC<UploadPhotoProps> = ({ 
  onImageSelect, 
  currentImage, 
  label = "Upload Photo" 
}) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setPreview(currentImage || null);
    if (currentImage) setFileName("Current image");
  }, [currentImage]);

  const handleFileSelect = useCallback(async (file: File) => {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      toast({ title: "Invalid File", description: validation.error, variant: "destructive" });
      return;
    }
    try {
      const resizedBlob = await resizeImage(file, 1024);
      const resizedFile = new File([resizedBlob], file.name, { type: 'image/jpeg' });
      
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(resizedFile);
      
      setFileName(resizedFile.name);
      onImageSelect(resizedFile);
    } catch (error) {
      toast({ title: "Error Processing Image", description: "Failed to process the image.", variant: "destructive" });
    }
  }, [onImageSelect, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0]);
  }, [handleFileSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
  }, [handleFileSelect]);

  const clearImage = useCallback(() => {
    setPreview(null);
    setFileName(null);
    onImageSelect(null);
  }, [onImageSelect]);

  const triggerFileInput = () => document.getElementById('photo-upload')?.click();

  return (
    <div>
      <label className="block text-sm font-medium mb-2">{label}</label>
      <div
        className={cn(
          "relative border-2 border-dashed rounded-xl p-4 transition-all duration-300 ease-in-out text-center cursor-pointer group",
          isDragging ? 'border-primary bg-primary/10 scale-105' : 'border-border hover:border-primary/50',
          preview ? 'border-solid border-green-500 bg-green-500/5' : ''
        )}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => setIsDragging(false)}
        onClick={!preview ? triggerFileInput : undefined}
      >
        <input type="file" accept="image/jpeg, image/png, image/webp" onChange={handleFileInput} className="hidden" id="photo-upload" />
        
        {preview ? (
          <div className="relative aspect-video w-full">
            <img src={preview} alt="Preview" className="w-full h-full object-contain rounded-md" />
            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-md">
                <Button variant="destructive" size="sm" onClick={clearImage} className="gap-2">
                    <X className="h-4 w-4" /> Change Image
                </Button>
            </div>
            <div className="absolute bottom-2 left-2 right-2 bg-background/80 backdrop-blur-sm text-xs p-2 rounded-md flex items-center gap-2 text-green-700 font-semibold">
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                <span className="truncate" title={fileName || ""}>{fileName}</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6">
            <div className="mb-4 rounded-full bg-secondary p-4">
                <ImageIcon className="h-10 w-10 text-muted-foreground" />
            </div>
            <p className="font-semibold text-foreground">Drag & drop or click to upload</p>
            <p className="text-sm text-muted-foreground mt-1">PNG, JPG, or WEBP (max 5MB)</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadPhoto;