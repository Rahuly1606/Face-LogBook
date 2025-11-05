#!/usr/bin/env python3
"""
Download InsightFace models for face recognition.
This script should be run during Render build phase.
"""
import os
import sys

def download_models():
    """Download InsightFace models"""
    try:
        from insightface.app import FaceAnalysis
        
        model_path = os.getenv('FACE_MODEL_PATH', 'models')
        detector_backend = os.getenv('FACE_DETECTOR_BACKEND', 'retinaface')
        
        print(f"📦 Downloading InsightFace models...")
        print(f"   Model path: {model_path}")
        print(f"   Backend: {detector_backend}")
        
        # Create model directory
        os.makedirs(model_path, exist_ok=True)
        
        # Initialize model - this will download if not present
        print("   Initializing model (this may take a few minutes)...")
        model = FaceAnalysis(name=detector_backend, root=model_path, providers=['CPUExecutionProvider'])
        model.prepare(ctx_id=0, det_size=(320, 320))
        
        print("✅ Models downloaded and verified successfully")
        return True
        
    except ImportError as e:
        print(f"❌ Failed to import insightface: {str(e)}")
        print("   Make sure insightface is installed: pip install insightface")
        return False
    except Exception as e:
        print(f"❌ Failed to download models: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("InsightFace Model Downloader")
    print("=" * 60)
    
    success = download_models()
    
    print("=" * 60)
    if success:
        print("✅ Setup complete!")
    else:
        print("❌ Setup failed - face recognition may not work")
    print("=" * 60)
    
    # Don't exit with error code - let the build continue even if models fail
    # Face recognition will just be disabled
    sys.exit(0)
