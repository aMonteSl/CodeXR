#!/usr/bin/env python3
"""
HTML Content Extractor

This script extracts and prepares HTML content for visualization.
It's designed to be called from the TypeScript code in the CodeXR extension.

Usage: python html_dom_parser.py <file_path>
"""

import sys
import json
import os
import re
from typing import Dict, Any


def extract_html_content(file_path: str) -> Dict[str, Any]:
    """Extract and prepare HTML content for visualization"""
    try:
        # Check if file exists
        if not os.path.exists(file_path):
            return {"error": f"File not found: {file_path}"}
        
        # Read the HTML file
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as file:
            html_content = file.read()
        
        # Prepare the HTML content
        prepared_html = prepare_html_for_visualization(html_content, os.path.basename(file_path))
        
        return {
            "htmlContent": prepared_html,
            "originalFile": file_path,
            "preparedForVisualization": True
        }
        
    except Exception as e:
        return {"error": f"Error processing HTML file: {str(e)}"}


def prepare_html_for_visualization(html_content: str, file_name: str) -> str:
    """Prepare HTML content for babia-html visualization"""
    try:
        original_content = html_content
        extracted_title = ""
        
        # First, try to extract title from head if it exists
        title_start = html_content.lower().find('<title>')
        title_end = html_content.lower().find('</title>')
        if title_start != -1 and title_end != -1:
            title_content = html_content[title_start + 7:title_end].strip()
            if title_content:
                extracted_title = f"<h1>{title_content}</h1>"
        
        # Try to extract body content
        body_start = html_content.lower().find('<body')
        body_end = html_content.lower().find('</body>')
        
        if body_start != -1 and body_end != -1:
            # Find the end of the opening body tag
            body_tag_end = html_content.find('>', body_start)
            if body_tag_end != -1:
                html_content = html_content[body_tag_end + 1:body_end].strip()
        else:
            # Try to extract content between <html> tags and remove head
            html_start = html_content.lower().find('<html')
            html_end = html_content.lower().find('</html>')
            
            if html_start != -1 and html_end != -1:
                html_tag_end = html_content.find('>', html_start)
                if html_tag_end != -1:
                    content = html_content[html_tag_end + 1:html_end]
                    
                    # Remove head section
                    head_start = content.lower().find('<head')
                    head_end = content.lower().find('</head>')
                    
                    if head_start != -1 and head_end != -1:
                        head_end_tag = content.find('>', head_end)
                        if head_end_tag != -1:
                            content = content[:head_start] + content[head_end_tag + 1:]
                    
                    html_content = content.strip()
            else:
                # If no html/body tags, use original content
                html_content = original_content
        
        # Clean up the HTML content but preserve ALL elements and structure
        # Remove comments, scripts, and styles
        html_content = re.sub(r'<!--[\s\S]*?-->', '', html_content)
        html_content = re.sub(r'<script[\s\S]*?</script>', '', html_content, flags=re.IGNORECASE)
        html_content = re.sub(r'<style[\s\S]*?</style>', '', html_content, flags=re.IGNORECASE)
        
        # Clean up excessive whitespace but preserve structure
        html_content = re.sub(r'\r\n|\r', ' ', html_content)  # Convert line endings to spaces
        html_content = re.sub(r'\n', ' ', html_content)       # Convert newlines to spaces
        html_content = re.sub(r'[ \t]+', ' ', html_content)   # Normalize multiple spaces/tabs to single space
        html_content = re.sub(r'>\s+<', '> <', html_content)  # Keep single space between tags
        html_content = html_content.strip()
        
        # Remove doctype declaration if present
        html_content = re.sub(r'<!DOCTYPE[^>]*>', '', html_content, flags=re.IGNORECASE).strip()
        
        # Prepend title if extracted and not already present
        if extracted_title and not html_content.lower().startswith('<h1>'):
            html_content = extracted_title + ' ' + html_content
        
        # Ensure we have some content
        if not html_content or len(html_content) < 10:
            html_content = f'<div><h1>Sample Content</h1><p>HTML content extracted from {file_name}</p></div>'
        
        # If content is still too long, try to truncate at a reasonable point
        if len(html_content) > 5000:
            # Try to find a good cutting point (end of a tag)
            cut_point = html_content.rfind('>', 0, 4500)
            if cut_point > 3000:
                html_content = html_content[:cut_point + 1]
            else:
                html_content = html_content[:4500] + '...'
        
        return html_content
        
    except Exception as e:
        return f'<div><h1>Error</h1><p>Failed to process HTML: {str(e)}</p></div>'


def main():
    """Main entry point"""
    if len(sys.argv) < 2:
        error_msg = {"error": "No file path provided"}
        print(json.dumps(error_msg))
        sys.exit(1)

    file_path = sys.argv[1]
    
    # Extract and prepare HTML content
    result = extract_html_content(file_path)
    
    # Output as JSON
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
