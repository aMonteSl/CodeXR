#!/usr/bin/env python3
"""
Shared XR field schema and derived metric helpers.
"""

from typing import Any, Dict, Iterable, List

XR_SCHEMA_VERSION = 1


def _text_field(field_id: str, label: str, description: str) -> Dict[str, str]:
    return {
        "id": field_id,
        "label": label,
        "description": description,
        "valueType": "text",
    }


def _numeric_field(field_id: str, label: str, description: str) -> Dict[str, str]:
    return {
        "id": field_id,
        "label": label,
        "description": description,
        "valueType": "numeric",
    }


XR_FILE_FIELDS: List[Dict[str, str]] = [
    _text_field("functionName", "Function Name", "Display name of the function or method."),
    _numeric_field("lineStart", "Line Start", "First line of the function span."),
    _numeric_field("lineEnd", "Line End", "Last line of the function span."),
    _numeric_field("lineCount", "Line Count", "Number of lines reported for the function."),
    _numeric_field("spanLines", "Span Lines", "Physical line span from start to end."),
    _numeric_field("complexity", "Complexity", "Cyclomatic complexity of the function."),
    _text_field("complexityBand", "Complexity Band", "Complexity severity bucket."),
    _numeric_field("parameters", "Parameters", "Number of parameters in the function signature."),
    _numeric_field("maxNestingDepth", "Max Nesting Depth", "Maximum nesting depth detected in the function."),
    _numeric_field("cyclomaticDensity", "Cyclomatic Density", "Complexity divided by function line count."),
    _text_field("filePath", "File Path", "Normalized file path for the analyzed file."),
    _text_field("fileName", "File Name", "Analyzed file name."),
    _text_field("treePath", "Tree Path", "Synthetic hierarchy used by BabiaXR boats."),
]


XR_DIRECTORY_FIELDS: List[Dict[str, str]] = [
    _text_field("fileName", "File Name", "Name of the analyzed file."),
    _text_field("filePath", "File Path", "Normalized full path to the analyzed file."),
    _text_field("relativePath", "Relative Path", "Normalized path relative to the analysis root."),
    _text_field("language", "Language", "Detected programming language."),
    _numeric_field("totalLines", "Total Lines", "Total number of lines in the file."),
    _numeric_field("codeLines", "Code Lines", "Number of lines considered code."),
    _numeric_field("commentLines", "Comment Lines", "Number of comment lines."),
    _numeric_field("blankLines", "Blank Lines", "Number of blank lines."),
    _numeric_field("commentRatio", "Comment Ratio", "Comment lines divided by total lines."),
    _numeric_field("codeRatio", "Code Ratio", "Code lines divided by total lines."),
    _numeric_field("blankRatio", "Blank Ratio", "Blank lines divided by total lines."),
    _numeric_field("classCount", "Class Count", "Number of classes or equivalent structures."),
    _numeric_field("functionCount", "Function Count", "Number of functions detected in the file."),
    _numeric_field("maxComplexity", "Max Complexity", "Maximum cyclomatic complexity found in the file."),
    _numeric_field("cyclomaticComplexityNumber", "Mean Complexity", "Average cyclomatic complexity for the file."),
    _numeric_field("cyclomaticComplexityDensity", "Complexity Density", "Mean complexity divided by code lines."),
    _numeric_field("highComplexityFunctions", "High Complexity Functions", "Functions with complexity greater than 10."),
    _numeric_field("criticalComplexityFunctions", "Critical Complexity Functions", "Functions with complexity greater than 25."),
    _numeric_field("averageFunctionParameters", "Average Function Parameters", "Average parameter count across functions."),
    _numeric_field("maxFunctionParameters", "Max Function Parameters", "Maximum parameter count in any function."),
    _numeric_field("averageFunctionLines", "Average Function Lines", "Average line count across functions."),
    _numeric_field("maxFunctionLines", "Max Function Lines", "Maximum line count across functions."),
    _numeric_field("averageFunctionNestingDepth", "Average Function Nesting Depth", "Average nesting depth across functions."),
    _numeric_field("maxFunctionNestingDepth", "Max Function Nesting Depth", "Maximum nesting depth across functions."),
    _numeric_field("fileSizeBytes", "File Size (Bytes)", "File size in bytes."),
]


XR_FIELDS_BY_TARGET = {
    "file": XR_FILE_FIELDS,
    "directory": XR_DIRECTORY_FIELDS,
}


def get_xr_schema(target_type: str) -> Dict[str, Any]:
    if target_type not in XR_FIELDS_BY_TARGET:
        raise ValueError(f"Unsupported XR schema target: {target_type}")

    return {
        "schemaVersion": XR_SCHEMA_VERSION,
        "analysisMode": "xr",
        "targetType": target_type,
        "fields": [field.copy() for field in XR_FIELDS_BY_TARGET[target_type]],
    }


def get_xr_field_types(target_type: str) -> Dict[str, str]:
    return {
        field["id"]: field["valueType"]
        for field in XR_FIELDS_BY_TARGET[target_type]
    }


def build_complexity_band(complexity: Any) -> str:
    try:
        numeric_complexity = float(complexity)
    except (TypeError, ValueError):
        numeric_complexity = 0.0

    if numeric_complexity > 25:
        return "critical"
    if numeric_complexity > 10:
        return "high"
    return "normal"


def safe_ratio(part: Any, total: Any, digits: int = 3) -> float:
    try:
        numerator = float(part)
        denominator = float(total)
    except (TypeError, ValueError):
        return 0.0

    if denominator <= 0:
        return 0.0

    return round(numerator / denominator, digits)


def summarize_function_metrics(functions: Iterable[Dict[str, Any]]) -> Dict[str, float]:
    function_list = list(functions or [])
    if not function_list:
        return {
            "averageFunctionLines": 0.0,
            "maxFunctionLines": 0,
            "averageFunctionNestingDepth": 0.0,
            "maxFunctionNestingDepth": 0,
            "highComplexityFunctions": 0,
            "criticalComplexityFunctions": 0,
        }

    line_counts = [int(func.get("lineCount", 0) or 0) for func in function_list]
    nesting_depths = [int(func.get("maxNestingDepth", 0) or 0) for func in function_list]
    complexities = [float(func.get("complexity", 0) or 0) for func in function_list]

    return {
        "averageFunctionLines": round(sum(line_counts) / len(line_counts), 2),
        "maxFunctionLines": max(line_counts) if line_counts else 0,
        "averageFunctionNestingDepth": round(sum(nesting_depths) / len(nesting_depths), 2),
        "maxFunctionNestingDepth": max(nesting_depths) if nesting_depths else 0,
        "highComplexityFunctions": sum(1 for complexity in complexities if complexity > 10),
        "criticalComplexityFunctions": sum(1 for complexity in complexities if complexity > 25),
    }
