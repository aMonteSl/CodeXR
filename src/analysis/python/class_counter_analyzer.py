#!/usr/bin/env python3
"""
Class Counter Analyzer

This script analyzes a file and counts the number of class declarations.
It supports multiple programming languages with comprehensive pattern matching.

Usage: python class_counter_analyzer.py <file_path>
"""

import sys
import json
import os
import re


def analyze_classes(file_path):
    """Analyze a file to count class declarations."""
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            content = file.read()
    except Exception as e:
        return {"error": f"Error reading file: {str(e)}"}

    _, ext = os.path.splitext(file_path.lower())
    class_count = 0
    class_details = []

    if ext == '.py':
        # Python classes (handle dataclasses separately to avoid double counting)
        
        # First, find all dataclass decorators and the class names they apply to
        dataclass_classes = set()
        dataclass_patterns = [
            r'^\s*@dataclass\s*\n\s*class\s+(\w+)',
            r'^\s*@dataclasses\.dataclass\s*\n\s*class\s+(\w+)'
        ]
        
        for pattern in dataclass_patterns:
            matches = re.finditer(pattern, content, re.MULTILINE)
            for match in matches:
                class_name = match.group(1) if match.groups() else 'Unknown'
                dataclass_classes.add(class_name)
                class_details.append({
                    'name': class_name,
                    'type': 'dataclass',
                    'line': content[:match.start()].count('\n') + 1
                })
        
        # Then find regular classes, but exclude dataclasses
        regular_class_pattern = r'^\s*class\s+(\w+)'
        matches = re.finditer(regular_class_pattern, content, re.MULTILINE)
        for match in matches:
            class_name = match.group(1) if match.groups() else 'Unknown'
            if class_name not in dataclass_classes:  # Don't double-count dataclasses
                class_details.append({
                    'name': class_name,
                    'type': 'class',
                    'line': content[:match.start()].count('\n') + 1
                })
        
        class_count = len(class_details)
    
    elif ext in ['.js', '.ts', '.jsx', '.tsx']:
        # JavaScript/TypeScript classes, interfaces, types
        patterns = [
            (r'^\s*class\s+(\w+)', 'class'),
            (r'^\s*export\s+class\s+(\w+)', 'exported_class'),
            (r'^\s*export\s+default\s+class\s+(\w+)', 'default_class'),
            (r'^\s*abstract\s+class\s+(\w+)', 'abstract_class'),
            (r'^\s*interface\s+(\w+)', 'interface'),
            (r'^\s*export\s+interface\s+(\w+)', 'exported_interface'),
            (r'^\s*type\s+(\w+)\s*=', 'type_alias'),
            (r'^\s*export\s+type\s+(\w+)\s*=', 'exported_type'),
            (r'^\s*enum\s+(\w+)', 'enum'),
            (r'^\s*export\s+enum\s+(\w+)', 'exported_enum'),
            (r'^\s*const\s+enum\s+(\w+)', 'const_enum'),
            (r'^\s*declare\s+class\s+(\w+)', 'declare_class'),
            (r'^\s*declare\s+interface\s+(\w+)', 'declare_interface')
        ]
        for pattern, class_type in patterns:
            matches = re.finditer(pattern, content, re.MULTILINE)
            for match in matches:
                class_name = match.group(1) if match.groups() else 'Unknown'
                class_details.append({
                    'name': class_name,
                    'type': class_type,
                    'line': content[:match.start()].count('\n') + 1
                })
        class_count = len(class_details)
    
    elif ext in ['.java']:
        # Java classes, interfaces, enums, annotations, records
        patterns = [
            (r'^\s*public\s+class\s+(\w+)', 'public_class'),
            (r'^\s*private\s+class\s+(\w+)', 'private_class'),
            (r'^\s*protected\s+class\s+(\w+)', 'protected_class'),
            (r'^\s*package\s+class\s+(\w+)', 'package_class'),
            (r'^\s*class\s+(\w+)', 'class'),
            (r'^\s*public\s+interface\s+(\w+)', 'public_interface'),
            (r'^\s*private\s+interface\s+(\w+)', 'private_interface'),
            (r'^\s*protected\s+interface\s+(\w+)', 'protected_interface'),
            (r'^\s*interface\s+(\w+)', 'interface'),
            (r'^\s*public\s+enum\s+(\w+)', 'public_enum'),
            (r'^\s*private\s+enum\s+(\w+)', 'private_enum'),
            (r'^\s*protected\s+enum\s+(\w+)', 'protected_enum'),
            (r'^\s*enum\s+(\w+)', 'enum'),
            (r'^\s*@interface\s+(\w+)', 'annotation'),
            (r'^\s*public\s+@interface\s+(\w+)', 'public_annotation'),
            (r'^\s*abstract\s+class\s+(\w+)', 'abstract_class'),
            (r'^\s*public\s+abstract\s+class\s+(\w+)', 'public_abstract_class'),
            (r'^\s*final\s+class\s+(\w+)', 'final_class'),
            (r'^\s*public\s+final\s+class\s+(\w+)', 'public_final_class'),
            (r'^\s*public\s+record\s+(\w+)', 'public_record'),
            (r'^\s*record\s+(\w+)', 'record')
        ]
        for pattern, class_type in patterns:
            matches = re.finditer(pattern, content, re.MULTILINE)
            for match in matches:
                class_name = match.group(1) if match.groups() else 'Unknown'
                class_details.append({
                    'name': class_name,
                    'type': class_type,
                    'line': content[:match.start()].count('\n') + 1
                })
        class_count = len(class_details)
    
    elif ext in ['.scala', '.sc']:
        # Scala classes, objects, traits, case classes
        patterns = [
            (r'^\s*class\s+(\w+)', 'class'),
            (r'^\s*abstract\s+class\s+(\w+)', 'abstract_class'),
            (r'^\s*case\s+class\s+(\w+)', 'case_class'),
            (r'^\s*sealed\s+class\s+(\w+)', 'sealed_class'),
            (r'^\s*final\s+class\s+(\w+)', 'final_class'),
            (r'^\s*object\s+(\w+)', 'object'),
            (r'^\s*case\s+object\s+(\w+)', 'case_object'),
            (r'^\s*trait\s+(\w+)', 'trait'),
            (r'^\s*sealed\s+trait\s+(\w+)', 'sealed_trait'),
            (r'^\s*type\s+(\w+)\s*=', 'type_alias'),
            (r'^\s*implicit\s+class\s+(\w+)', 'implicit_class'),
            (r'^\s*implicit\s+object\s+(\w+)', 'implicit_object')
        ]
        for pattern, class_type in patterns:
            matches = re.finditer(pattern, content, re.MULTILINE)
            for match in matches:
                class_name = match.group(1) if match.groups() else 'Unknown'
                class_details.append({
                    'name': class_name,
                    'type': class_type,
                    'line': content[:match.start()].count('\n') + 1
                })
        class_count = len(class_details)
    
    elif ext in ['.cpp', '.cc', '.cxx', '.h', '.hpp']:
        # C++ classes, structs, unions, templates
        patterns = [
            (r'^\s*class\s+(\w+)', 'class'),
            (r'^\s*struct\s+(\w+)', 'struct'),
            (r'^\s*union\s+(\w+)', 'union'),
            (r'^\s*template\s*<.*>\s*class\s+(\w+)', 'template_class'),
            (r'^\s*template\s*<.*>\s*struct\s+(\w+)', 'template_struct'),
            (r'^\s*namespace\s+(\w+)', 'namespace'),
            (r'^\s*enum\s+class\s+(\w+)', 'enum_class'),
            (r'^\s*enum\s+struct\s+(\w+)', 'enum_struct'),
            (r'^\s*enum\s+(\w+)', 'enum'),
            (r'^\s*typedef\s+(?:class|struct)\s+(\w+)', 'typedef_class')
        ]
        for pattern, class_type in patterns:
            matches = re.finditer(pattern, content, re.MULTILINE)
            for match in matches:
                class_name = match.group(1) if match.groups() else 'Unknown'
                class_details.append({
                    'name': class_name,
                    'type': class_type,
                    'line': content[:match.start()].count('\n') + 1
                })
        class_count = len(class_details)
    
    elif ext == '.cs':
        # C# classes, interfaces, structs, enums, delegates, records
        patterns = [
            (r'^\s*public\s+class\s+(\w+)', 'public_class'),
            (r'^\s*private\s+class\s+(\w+)', 'private_class'),
            (r'^\s*protected\s+class\s+(\w+)', 'protected_class'),
            (r'^\s*internal\s+class\s+(\w+)', 'internal_class'),
            (r'^\s*class\s+(\w+)', 'class'),
            (r'^\s*public\s+interface\s+(\w+)', 'public_interface'),
            (r'^\s*private\s+interface\s+(\w+)', 'private_interface'),
            (r'^\s*protected\s+interface\s+(\w+)', 'protected_interface'),
            (r'^\s*internal\s+interface\s+(\w+)', 'internal_interface'),
            (r'^\s*interface\s+(\w+)', 'interface'),
            (r'^\s*public\s+struct\s+(\w+)', 'public_struct'),
            (r'^\s*private\s+struct\s+(\w+)', 'private_struct'),
            (r'^\s*protected\s+struct\s+(\w+)', 'protected_struct'),
            (r'^\s*internal\s+struct\s+(\w+)', 'internal_struct'),
            (r'^\s*struct\s+(\w+)', 'struct'),
            (r'^\s*public\s+enum\s+(\w+)', 'public_enum'),
            (r'^\s*private\s+enum\s+(\w+)', 'private_enum'),
            (r'^\s*protected\s+enum\s+(\w+)', 'protected_enum'),
            (r'^\s*internal\s+enum\s+(\w+)', 'internal_enum'),
            (r'^\s*enum\s+(\w+)', 'enum'),
            (r'^\s*public\s+delegate\s+\w+\s+(\w+)', 'public_delegate'),
            (r'^\s*delegate\s+\w+\s+(\w+)', 'delegate'),
            (r'^\s*public\s+record\s+(\w+)', 'public_record'),
            (r'^\s*record\s+(\w+)', 'record'),
            (r'^\s*abstract\s+class\s+(\w+)', 'abstract_class'),
            (r'^\s*sealed\s+class\s+(\w+)', 'sealed_class'),
            (r'^\s*static\s+class\s+(\w+)', 'static_class')
        ]
        for pattern, class_type in patterns:
            matches = re.finditer(pattern, content, re.MULTILINE)
            for match in matches:
                class_name = match.group(1) if match.groups() else 'Unknown'
                class_details.append({
                    'name': class_name,
                    'type': class_type,
                    'line': content[:match.start()].count('\n') + 1
                })
        class_count = len(class_details)
        
    elif ext in ['.rb']:
        # Ruby classes, modules
        patterns = [
            (r'^\s*class\s+(\w+)', 'class'),
            (r'^\s*module\s+(\w+)', 'module'),
            (r'^\s*class\s+<<\s*(\w+)', 'singleton_class')
        ]
        for pattern, class_type in patterns:
            matches = re.finditer(pattern, content, re.MULTILINE)
            for match in matches:
                class_name = match.group(1) if match.groups() else 'Unknown'
                class_details.append({
                    'name': class_name,
                    'type': class_type,
                    'line': content[:match.start()].count('\n') + 1
                })
        class_count = len(class_details)
        
    elif ext in ['.php', '.phtml', '.php3', '.php4', '.php5', '.phps']:
        # PHP classes, interfaces, traits
        patterns = [
            (r'^\s*class\s+(\w+)', 'class'),
            (r'^\s*abstract\s+class\s+(\w+)', 'abstract_class'),
            (r'^\s*final\s+class\s+(\w+)', 'final_class'),
            (r'^\s*interface\s+(\w+)', 'interface'),
            (r'^\s*trait\s+(\w+)', 'trait'),
            (r'^\s*enum\s+(\w+)', 'enum')
        ]
        for pattern, class_type in patterns:
            matches = re.finditer(pattern, content, re.MULTILINE)
            for match in matches:
                class_name = match.group(1) if match.groups() else 'Unknown'
                class_details.append({
                    'name': class_name,
                    'type': class_type,
                    'line': content[:match.start()].count('\n') + 1
                })
        class_count = len(class_details)
        
    elif ext in ['.swift']:
        # Swift classes, structs, protocols, enums
        patterns = [
            (r'^\s*class\s+(\w+)', 'class'),
            (r'^\s*struct\s+(\w+)', 'struct'),
            (r'^\s*protocol\s+(\w+)', 'protocol'),
            (r'^\s*enum\s+(\w+)', 'enum'),
            (r'^\s*actor\s+(\w+)', 'actor'),
            (r'^\s*extension\s+(\w+)', 'extension'),
            (r'^\s*public\s+class\s+(\w+)', 'public_class'),
            (r'^\s*private\s+class\s+(\w+)', 'private_class'),
            (r'^\s*internal\s+class\s+(\w+)', 'internal_class'),
            (r'^\s*open\s+class\s+(\w+)', 'open_class'),
            (r'^\s*final\s+class\s+(\w+)', 'final_class')
        ]
        for pattern, class_type in patterns:
            matches = re.finditer(pattern, content, re.MULTILINE)
            for match in matches:
                class_name = match.group(1) if match.groups() else 'Unknown'
                class_details.append({
                    'name': class_name,
                    'type': class_type,
                    'line': content[:match.start()].count('\n') + 1
                })
        class_count = len(class_details)
        
    elif ext in ['.go']:
        # Go structs, interfaces, types
        patterns = [
            (r'^\s*type\s+(\w+)\s+struct', 'struct'),
            (r'^\s*type\s+(\w+)\s+interface', 'interface'),
            (r'^\s*type\s+(\w+)\s+\w+', 'type_alias')
        ]
        for pattern, class_type in patterns:
            matches = re.finditer(pattern, content, re.MULTILINE)
            for match in matches:
                class_name = match.group(1) if match.groups() else 'Unknown'
                class_details.append({
                    'name': class_name,
                    'type': class_type,
                    'line': content[:match.start()].count('\n') + 1
                })
        class_count = len(class_details)
        
    elif ext in ['.rs']:
        # Rust structs, enums, traits, impl blocks
        patterns = [
            (r'^\s*struct\s+(\w+)', 'struct'),
            (r'^\s*enum\s+(\w+)', 'enum'),
            (r'^\s*trait\s+(\w+)', 'trait'),
            (r'^\s*impl\s+(\w+)', 'impl'),
            (r'^\s*impl\s+\w+\s+for\s+(\w+)', 'impl_for'),
            (r'^\s*type\s+(\w+)\s*=', 'type_alias'),
            (r'^\s*union\s+(\w+)', 'union'),
            (r'^\s*pub\s+struct\s+(\w+)', 'pub_struct'),
            (r'^\s*pub\s+enum\s+(\w+)', 'pub_enum'),
            (r'^\s*pub\s+trait\s+(\w+)', 'pub_trait')
        ]
        for pattern, class_type in patterns:
            matches = re.finditer(pattern, content, re.MULTILINE)
            for match in matches:
                class_name = match.group(1) if match.groups() else 'Unknown'
                class_details.append({
                    'name': class_name,
                    'type': class_type,
                    'line': content[:match.start()].count('\n') + 1
                })
        class_count = len(class_details)
        
    elif ext in ['.kt', '.kts']:
        # Kotlin classes, interfaces, objects, data classes
        patterns = [
            (r'^\s*class\s+(\w+)', 'class'),
            (r'^\s*data\s+class\s+(\w+)', 'data_class'),
            (r'^\s*sealed\s+class\s+(\w+)', 'sealed_class'),
            (r'^\s*abstract\s+class\s+(\w+)', 'abstract_class'),
            (r'^\s*open\s+class\s+(\w+)', 'open_class'),
            (r'^\s*final\s+class\s+(\w+)', 'final_class'),
            (r'^\s*interface\s+(\w+)', 'interface'),
            (r'^\s*object\s+(\w+)', 'object'),
            (r'^\s*enum\s+class\s+(\w+)', 'enum_class'),
            (r'^\s*annotation\s+class\s+(\w+)', 'annotation_class'),
            (r'^\s*inline\s+class\s+(\w+)', 'inline_class'),
            (r'^\s*value\s+class\s+(\w+)', 'value_class')
        ]
        for pattern, class_type in patterns:
            matches = re.finditer(pattern, content, re.MULTILINE)
            for match in matches:
                class_name = match.group(1) if match.groups() else 'Unknown'
                class_details.append({
                    'name': class_name,
                    'type': class_type,
                    'line': content[:match.start()].count('\n') + 1
                })
        class_count = len(class_details)
        
    elif ext in ['.m', '.mm']:
        # Objective-C classes, protocols, categories
        patterns = [
            (r'^\s*@interface\s+(\w+)', 'interface'),
            (r'^\s*@implementation\s+(\w+)', 'implementation'),
            (r'^\s*@protocol\s+(\w+)', 'protocol'),
            (r'^\s*@interface\s+(\w+)\s*\((\w+)\)', 'category')
        ]
        for pattern, class_type in patterns:
            matches = re.finditer(pattern, content, re.MULTILINE)
            for match in matches:
                class_name = match.group(1) if match.groups() else 'Unknown'
                class_details.append({
                    'name': class_name,
                    'type': class_type,
                    'line': content[:match.start()].count('\n') + 1
                })
        class_count = len(class_details)
        
    elif ext in ['.lua']:
        # Lua "classes" (tables with metatables, modules)
        patterns = [
            (r'^\s*local\s+(\w+)\s*=\s*\{\}', 'table_class'),
            (r'^\s*(\w+)\s*=\s*\{\}', 'global_table'),
            (r'^\s*function\s+(\w+):new', 'class_constructor'),
            (r'^\s*local\s+(\w+)\s*=\s*class\(', 'class_declaration')
        ]
        for pattern, class_type in patterns:
            matches = re.finditer(pattern, content, re.MULTILINE)
            for match in matches:
                class_name = match.group(1) if match.groups() else 'Unknown'
                class_details.append({
                    'name': class_name,
                    'type': class_type,
                    'line': content[:match.start()].count('\n') + 1
                })
        class_count = len(class_details)
        
    elif ext in ['.erl', '.hrl']:
        # Erlang modules, records
        patterns = [
            (r'^\s*-module\s*\(\s*(\w+)', 'module'),
            (r'^\s*-record\s*\(\s*(\w+)', 'record'),
            (r'^\s*-behaviour\s*\(\s*(\w+)', 'behaviour'),
            (r'^\s*-behavior\s*\(\s*(\w+)', 'behavior')
        ]
        for pattern, class_type in patterns:
            matches = re.finditer(pattern, content, re.MULTILINE)
            for match in matches:
                class_name = match.group(1) if match.groups() else 'Unknown'
                class_details.append({
                    'name': class_name,
                    'type': class_type,
                    'line': content[:match.start()].count('\n') + 1
                })
        class_count = len(class_details)
        
    elif ext in ['.pl', '.pm', '.pod', '.t']:
        # Perl packages, modules
        patterns = [
            (r'^\s*package\s+(\w+(?:::\w+)*)', 'package'),
            (r'^\s*use\s+Moose;.*?package\s+(\w+)', 'moose_class'),
            (r'^\s*use\s+Mouse;.*?package\s+(\w+)', 'mouse_class')
        ]
        for pattern, class_type in patterns:
            matches = re.finditer(pattern, content, re.MULTILINE | re.DOTALL)
            for match in matches:
                class_name = match.group(1) if match.groups() else 'Unknown'
                class_details.append({
                    'name': class_name,
                    'type': class_type,
                    'line': content[:match.start()].count('\n') + 1
                })
        class_count = len(class_details)
        
    else:
        # Unsupported file type
        return {
            "file": file_path,
            "classCount": 0,
            "classes": [],
            "warning": f"Unsupported file extension: {ext}"
        }

    return {
        "file": file_path,
        "classCount": class_count,
        "classes": class_details
    }


def main():
    """Main entry point"""
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}))
        sys.exit(1)
    
    file_path = sys.argv[1]
    result = analyze_classes(file_path)
    
    # Output as JSON
    print(json.dumps(result))


if __name__ == "__main__":
    main()