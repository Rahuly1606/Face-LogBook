"""
Patch file to fix NumPy lstsq warning in insightface library
"""
import numpy as np
from functools import wraps

# Get the original lstsq function
original_lstsq = np.linalg.lstsq

# Create a patched version that always passes rcond=-1
@wraps(original_lstsq)
def patched_lstsq(a, b, rcond=None):
    return original_lstsq(a, b, rcond=-1)

# Replace the original function with our patched version
np.linalg.lstsq = patched_lstsq

print("NumPy lstsq patched to always use rcond=-1 to silence FutureWarnings")