#!/usr/bin/env python3
"""
HTML DOM Parser

This script parses HTML files and extracts DOM structure information.
It's designed to be called from the TypeScript code in the CodeXR extension.

Usage: python html_dom_parser.py <file_path>
"""

import sys
import json
import os
from html.parser import HTMLParser
from typing import Dict, List, Any, Optional


class DOMElement:
    """Represents a DOM element with its properties"""
    
    def __init__(self, tag_name: str, attributes: Dict[str, str], depth: int = 0):
        self.tag_name = tag_name.lower()
        self.attributes = attributes
        self.children: List['DOMElement'] = []
        self.text_content: str = ""
        self.depth = depth
        self.id = attributes.get('id')
        self.classes = attributes.get('class', '').split() if attributes.get('class') else []
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'tagName': self.tag_name,
            'attributes': self.attributes,
            'children': [child.to_dict() for child in self.children],
            'textContent': self.text_content,
            'depth': self.depth,
            'id': self.id,
            'classes': self.classes
        }


class HTMLDOMParser(HTMLParser):
    """Custom HTML parser for extracting DOM structure"""
    
    def __init__(self):
        super().__init__()
        self.root: Optional[DOMElement] = None
        self.element_stack: List[DOMElement] = []
        self.current_depth = 0
        self.element_counts: Dict[str, int] = {}
        self.total_elements = 0
        self.max_depth = 0
        self.current_text = ""
    
    def handle_starttag(self, tag: str, attrs: List[tuple]):
        """Handle opening tags"""
        # Convert attributes to dictionary
        attributes = dict(attrs)
        
        # Create new element
        element = DOMElement(tag, attributes, self.current_depth)
        
        # Update statistics
        self.total_elements += 1
        self.max_depth = max(self.max_depth, self.current_depth)
        self.element_counts[tag.lower()] = self.element_counts.get(tag.lower(), 0) + 1
        
        # Add to parent or set as root
        if self.element_stack:
            self.element_stack[-1].children.append(element)
        else:
            self.root = element
        
        # Push to stack and increase depth
        self.element_stack.append(element)
        self.current_depth += 1
        
        # Clear any accumulated text
        self.current_text = ""
    
    def handle_endtag(self, tag: str):
        """Handle closing tags"""
        if self.element_stack and self.element_stack[-1].tag_name == tag.lower():
            # Add accumulated text content
            if self.current_text.strip():
                self.element_stack[-1].text_content = self.current_text.strip()
            
            # Pop from stack and decrease depth
            self.element_stack.pop()
            self.current_depth -= 1
            self.current_text = ""
    
    def handle_data(self, data: str):
        """Handle text content"""
        self.current_text += data
    
    def get_analysis_result(self, file_path: str) -> Dict[str, Any]:
        """Get the complete analysis result"""
        return {
            'fileName': os.path.basename(file_path),
            'filePath': file_path,
            'totalElements': self.total_elements,
            'maxDepth': self.max_depth,
            'domTree': self.root.to_dict() if self.root else None,
            'elementCounts': self.element_counts,
            'timestamp': '',  # Will be set by TypeScript
        }


def analyze_html_file(file_path: str) -> Dict[str, Any]:
    """Analyze an HTML file and return DOM structure"""
    try:
        # Check if file exists
        if not os.path.exists(file_path):
            return {"error": f"File not found: {file_path}"}
        
        # Read the HTML file
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as file:
            html_content = file.read()
        
        # Parse the HTML
        parser = HTMLDOMParser()
        parser.feed(html_content)
        
        # Get analysis result
        result = parser.get_analysis_result(file_path)
        result['htmlContent'] = html_content
        
        return result
        
    except Exception as e:
        return {"error": f"Error parsing HTML file: {str(e)}"}


def prepare_html_for_template(html_content: str, file_name: str) -> str:
    """Prepare HTML content for babia-html template injection"""
    try:
        # Extract body content
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
        
        # Clean up the HTML content
        import re
        
        # Remove comments, scripts, and styles
        html_content = re.sub(r'<!--[\s\S]*?-->', '', html_content)
        html_content = re.sub(r'<script[\s\S]*?</script>', '', html_content, flags=re.IGNORECASE)
        html_content = re.sub(r'<style[\s\S]*?</style>', '', html_content, flags=re.IGNORECASE)
        
        # Normalize whitespace
        html_content = re.sub(r'\r\n|\n|\r|\t', ' ', html_content)
        html_content = re.sub(r'\s+', ' ', html_content)
        html_content = html_content.strip()
        
        # Truncate if too long
        if len(html_content) > 3000:
            # Try to find a good cutting point
            cut_point = html_content.rfind('>', 0, 3000)
            if cut_point > 2500:
                html_content = html_content[:cut_point + 1]
            else:
                html_content = html_content[:3000]
        
        # Ensure we have some content
        if not html_content or len(html_content) < 10:
            html_content = f'<div><h1>Sample Content</h1><p>HTML content extracted from {file_name}</p></div>'
        
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
    
    # Check if this is a template preparation request
    if len(sys.argv) > 2 and sys.argv[2] == '--prepare-template':
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as file:
                html_content = file.read()
            
            prepared_html = prepare_html_for_template(html_content, os.path.basename(file_path))
            result = {"preparedHTML": prepared_html}
            print(json.dumps(result))
        except Exception as e:
            error_msg = {"error": f"Failed to prepare HTML template: {str(e)}"}
            print(json.dumps(error_msg))
        return
    
    # Regular DOM analysis
    result = analyze_html_file(file_path)
    
    # Output as JSON
    print(json.dumps(result))


if __name__ == "__main__":
    main()
