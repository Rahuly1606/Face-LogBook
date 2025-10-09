"""
Quick installation script for FAISS optimization
Run this after activating your virtual environment
"""

import subprocess
import sys

def install_faiss():
    """Install FAISS and verify installation"""
    print("=" * 60)
    print("FAISS Installation for Face-LogBook")
    print("=" * 60)
    
    print("\n📦 Installing FAISS...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "faiss-cpu>=1.8.0"])
        print("✓ FAISS installed successfully")
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install FAISS: {e}")
        return False
    
    print("\n🔍 Verifying installation...")
    try:
        import faiss
        print(f"✓ FAISS version: {faiss.__version__}")
    except ImportError as e:
        print(f"❌ FAISS import failed: {e}")
        return False
    
    print("\n✅ FAISS is ready to use!")
    print("\nNext steps:")
    print("1. Run: python verify_optimizations.py")
    print("2. Start backend: python run.py")
    print("3. Check logs for: 'Rebuilt FAISS index'")
    
    return True

if __name__ == "__main__":
    success = install_faiss()
    sys.exit(0 if success else 1)
