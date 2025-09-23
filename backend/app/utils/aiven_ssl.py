"""
Helper module for Aiven MySQL SSL connections

This module provides utility functions to manage SSL connections to Aiven MySQL.
"""

import os
import tempfile
import logging

logger = logging.getLogger(__name__)

def setup_aiven_ssl():
    """
    Set up SSL for Aiven MySQL connection.
    
    If AIVEN_CA_PEM is provided as an environment variable, write it to a temporary
    file and set AIVEN_CA_PATH to the file path.
    
    Returns:
        str: Path to the CA certificate file, or None if not configured.
    """
    # If AIVEN_CA_PEM is provided, write it to a temporary file
    if os.getenv('AIVEN_CA_PEM'):
        logger.info("Using CA certificate from AIVEN_CA_PEM environment variable")
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix='.pem') as ca_file:
                ca_file.write(os.getenv('AIVEN_CA_PEM').encode())
                ca_path = ca_file.name
            
            # Set AIVEN_CA_PATH environment variable for other components to use
            os.environ['AIVEN_CA_PATH'] = ca_path
            logger.info(f"CA certificate written to temporary file: {ca_path}")
            return ca_path
        except Exception as e:
            logger.error(f"Failed to write CA certificate to temporary file: {str(e)}")
    
    # Return existing CA path if provided
    return os.getenv('AIVEN_CA_PATH')