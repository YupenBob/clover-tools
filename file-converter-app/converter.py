#!/usr/bin/env python3
"""
File conversion utilities for the File Format Converter web app.
"""

import os
import subprocess
from pathlib import Path

def convert_document(input_path, output_format):
    """
    Convert document files between formats.
    Supports: PDF, DOCX, TXT, HTML, RTF, ODT
    """
    input_path = Path(input_path)
    output_path = input_path.with_suffix(f'.{output_format}')
    
    # TODO: Implement actual document conversion logic
    # This will use libraries like python-docx, PyPDF2, etc.
    # For now, just create a placeholder file
    with open(output_path, 'w') as f:
        f.write(f"Converted document from {input_path.name} to {output_format}")
    return str(output_path)

def convert_image(input_path, output_format):
    """
    Convert image files between formats.
    Supports: JPG, PNG, WebP, SVG, GIF, BMP, TIFF
    """
    from PIL import Image
    
    input_path = Path(input_path)
    output_path = input_path.with_suffix(f'.{output_format}')
    
    try:
        with Image.open(input_path) as img:
            # Handle different output formats
            if output_format.lower() in ['jpg', 'jpeg']:
                img = img.convert('RGB')  # Ensure RGB mode for JPEG
                img.save(output_path, 'JPEG', quality=95)
            elif output_format.lower() == 'png':
                img.save(output_path, 'PNG')
            elif output_format.lower() == 'webp':
                img.save(output_path, 'WEBP', quality=95)
            elif output_format.lower() == 'gif':
                img.save(output_path, 'GIF')
            elif output_format.lower() == 'bmp':
                img.save(output_path, 'BMP')
            elif output_format.lower() == 'tiff':
                img.save(output_path, 'TIFF')
            else:
                img.save(output_path, output_format.upper())
        return str(output_path)
    except Exception as e:
        raise Exception(f"Image conversion failed: {str(e)}")

def convert_audio_video(input_path, output_format):
    """
    Convert audio/video files using ffmpeg.
    Supports: MP4, AVI, MOV, MKV, FLV, MP3, WAV, AAC, FLAC, OGG
    """
    input_path = Path(input_path)
    output_path = input_path.with_suffix(f'.{output_format}')
    
    try:
        # Use ffmpeg for conversion
        cmd = ['ffmpeg', '-i', str(input_path), '-y', str(output_path)]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        
        if result.returncode != 0:
            raise Exception(f"FFmpeg conversion failed: {result.stderr}")
            
        return str(output_path)
    except subprocess.TimeoutExpired:
        raise Exception("Conversion timed out")
    except Exception as e:
        raise Exception(f"Audio/Video conversion failed: {str(e)}")

def convert_spreadsheet(input_path, output_format):
    """
    Convert spreadsheet files between formats.
    Supports: Excel (XLSX, XLS), CSV, JSON, TSV
    """
    import pandas as pd
    
    input_path = Path(input_path)
    output_path = input_path.with_suffix(f'.{output_format}')
    
    try:
        # Read input file
        if input_path.suffix.lower() in ['.xlsx', '.xls']:
            df = pd.read_excel(input_path)
        elif input_path.suffix.lower() == '.csv':
            df = pd.read_csv(input_path)
        elif input_path.suffix.lower() == '.json':
            df = pd.read_json(input_path)
        elif input_path.suffix.lower() == '.tsv':
            df = pd.read_csv(input_path, sep='\t')
        else:
            raise Exception(f"Unsupported input format: {input_path.suffix}")
        
        # Write output file
        if output_format.lower() in ['xlsx', 'xls']:
            df.to_excel(output_path, index=False)
        elif output_format.lower() == 'csv':
            df.to_csv(output_path, index=False)
        elif output_format.lower() == 'json':
            df.to_json(output_path, orient='records', indent=2)
        elif output_format.lower() == 'tsv':
            df.to_csv(output_path, sep='\t', index=False)
        else:
            raise Exception(f"Unsupported output format: {output_format}")
            
        return str(output_path)
    except Exception as e:
        raise Exception(f"Spreadsheet conversion failed: {str(e)}")

def get_supported_formats():
    """Return supported formats by category."""
    return {
        'document': ['pdf', 'docx', 'txt', 'html', 'rtf', 'odt'],
        'image': ['jpg', 'jpeg', 'png', 'webp', 'svg', 'gif', 'bmp', 'tiff'],
        'audio_video': ['mp4', 'avi', 'mov', 'mkv', 'flv', 'mp3', 'wav', 'aac', 'flac', 'ogg'],
        'spreadsheet': ['xlsx', 'xls', 'csv', 'json', 'tsv']
    }

def validate_conversion(source_ext, target_format):
    """Validate if conversion from source to target is allowed."""
    source_ext = source_ext.lower()
    target_format = target_format.lower()
    
    # Get category of source file
    categories = get_supported_formats()
    source_category = None
    
    for category, formats in categories.items():
        if source_ext in formats:
            source_category = category
            break
    
    if not source_category:
        return False, "Unsupported source file type"
    
    # Check if target format is in the same category
    if target_format not in categories[source_category]:
        return False, f"Cannot convert {source_ext} to {target_format} - different categories"
    
    return True, "Valid conversion"