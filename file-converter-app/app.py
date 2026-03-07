#!/usr/bin/env python3
"""
File Format Converter Web Application
A lightweight web app for converting between various file formats.
"""

from flask import Flask, render_template, request, send_file, jsonify
import os
import uuid
from werkzeug.utils import secure_filename
from converter import convert_document, convert_image, convert_audio_video, convert_spreadsheet

# Initialize Flask app
app = Flask(__name__)

# Configuration
UPLOAD_FOLDER = 'uploads'
OUTPUT_FOLDER = 'outputs'
# Expanded allowed extensions
ALLOWED_EXTENSIONS = {
    # Documents
    'txt', 'pdf', 'docx', 'doc', 'html', 'htm', 'rtf', 'odt',
    # Images  
    'jpg', 'jpeg', 'png', 'webp', 'svg', 'gif', 'bmp', 'tiff', 'ico',
    # Audio/Video
    'mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'mp3', 'wav', 'ogg', 'flac', 'aac',
    # Spreadsheets
    'xlsx', 'xls', 'csv', 'json', 'xml', 'ods'
}

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['OUTPUT_FOLDER'] = OUTPUT_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max file size

# Ensure directories exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

def allowed_file(filename):
    """Check if file extension is allowed."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_file_category(file_ext):
    """Determine the category of file based on extension."""
    document_exts = {'txt', 'pdf', 'docx', 'doc', 'html', 'htm', 'rtf', 'odt'}
    image_exts = {'jpg', 'jpeg', 'png', 'webp', 'svg', 'gif', 'bmp', 'tiff', 'ico'}
    audio_video_exts = {'mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'mp3', 'wav', 'ogg', 'flac', 'aac'}
    spreadsheet_exts = {'xlsx', 'xls', 'csv', 'json', 'xml', 'ods'}
    
    if file_ext in document_exts:
        return 'document'
    elif file_ext in image_exts:
        return 'image'
    elif file_ext in audio_video_exts:
        return 'audio_video'
    elif file_ext in spreadsheet_exts:
        return 'spreadsheet'
    else:
        return None

def get_valid_target_formats(category):
    """Get valid target formats for a given category."""
    formats = {
        'document': ['pdf', 'docx', 'txt', 'html'],
        'image': ['jpg', 'png', 'webp', 'svg', 'gif'],
        'audio_video': ['mp4', 'avi', 'mov', 'mp3', 'wav'],
        'spreadsheet': ['xlsx', 'csv', 'json']
    }
    return formats.get(category, [])

@app.route('/')
def index():
    """Main page."""
    return render_template('index.html')

@app.route('/api/get-valid-formats', methods=['POST'])
def get_valid_formats():
    """Get valid target formats based on uploaded file."""
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    filename = secure_filename(file.filename)
    if '.' not in filename:
        return jsonify({'error': 'Invalid filename'}), 400
        
    file_ext = filename.rsplit('.', 1)[1].lower()
    category = get_file_category(file_ext)
    
    if not category:
        return jsonify({'error': 'Unsupported file type'}), 400
    
    valid_formats = get_valid_target_formats(category)
    return jsonify({
        'success': True,
        'category': category,
        'valid_formats': valid_formats
    })

@app.route('/convert', methods=['POST'])
def convert_file():
    """Handle file conversion requests."""
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    
    file = request.files['file']
    target_format = request.form.get('target_format')
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': 'File type not supported'}), 400
    
    if not target_format:
        return jsonify({'error': 'Target format not specified'}), 400
    
    # Save uploaded file
    filename = secure_filename(file.filename)
    file_ext = filename.rsplit('.', 1)[1].lower()
    unique_id = str(uuid.uuid4())
    upload_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{unique_id}.{file_ext}")
    file.save(upload_path)
    
    # Determine file category and validate target format
    category = get_file_category(file_ext)
    if not category:
        return jsonify({'error': 'Unsupported file type'}), 400
    
    valid_formats = get_valid_target_formats(category)
    if target_format not in valid_formats:
        return jsonify({'error': f'Cannot convert {file_ext} to {target_format}'}), 400
    
    try:
        if category == 'document':
            output_path = convert_document(upload_path, target_format)
        elif category == 'image':
            output_path = convert_image(upload_path, target_format)
        elif category == 'audio_video':
            output_path = convert_audio_video(upload_path, target_format)
        elif category == 'spreadsheet':
            output_path = convert_spreadsheet(upload_path, target_format)
        else:
            return jsonify({'error': 'Unknown file category'}), 400
        
        # Move output to outputs folder with proper name
        output_filename = f"{unique_id}.{target_format}"
        final_output_path = os.path.join(app.config['OUTPUT_FOLDER'], output_filename)
        
        # Handle case where converter returns the same path (for some conversions)
        if output_path != final_output_path:
            if os.path.exists(final_output_path):
                os.remove(final_output_path)
            os.rename(output_path, final_output_path)
        
        return jsonify({
            'success': True,
            'download_url': f'/download/{output_filename}',
            'message': f'File successfully converted to {target_format}'
        })
        
    except Exception as e:
        return jsonify({'error': f'Conversion failed: {str(e)}'}), 500

@app.route('/download/<filename>')
def download_file(filename):
    """Serve converted files for download."""
    safe_filename = secure_filename(filename)
    output_path = os.path.join(app.config['OUTPUT_FOLDER'], safe_filename)
    
    if os.path.exists(output_path):
        return send_file(output_path, as_attachment=True)
    else:
        return jsonify({'error': 'File not found'}), 404

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)