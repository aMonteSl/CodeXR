#!/usr/bin/env python3
"""
Test path normalization for Windows compatibility in BabiaXR integration
Tests the normalize_path_for_babia function to ensure cross-platform path handling
"""

import sys
import os
from pathlib import Path

# Add the xr_directory_analysis_coordinator module to the path
sys.path.insert(0, str(Path(__file__).parent / "src" / "new_code_analysis" / "new_python" / "XR"))

# Import the normalize_path_for_babia function
from xr_directory_analysis_coordinator import normalize_path_for_babia

def run_tests():
    """Run path normalization tests"""
    tests_passed = 0
    tests_total = 0
    
    test_cases = [
        # (input, expected_output, description)
        ("C:\\Users\\admin\\project\\file.py", "/Users/admin/project/file.py", "Windows absolute path with C: drive"),
        ("D:\\data\\folder\\file.txt", "/data/folder/file.txt", "Windows absolute path with D: drive"),
        ("src\\module\\utils.ts", "src/module/utils.ts", "Windows relative path"),
        (".\\src\\components\\button.tsx", "./src/components/button.tsx", "Windows relative path with dot"),
        ("src/module/utils.ts", "src/module/utils.ts", "Unix path (no change needed)"),
        ("/home/user/project/file.py", "/home/user/project/file.py", "Unix absolute path (no change needed)"),
        ("src\\\\module\\\\utils.ts", "src/module/utils.ts", "Windows path with double backslashes"),
        ("src//module//utils.ts", "src/module/utils.ts", "Path with double forward slashes"),
        ("", "", "Empty path"),
        (None, None, "None input"),
        ("src\\\\\\nested\\\\folder\\file.ts", "src/nested/folder/file.ts", "Multiple consecutive backslashes"),
        ("E:\\project\\src\\main.py", "/project/src/main.py", "Windows path with E: drive"),
    ]
    
    print("=" * 80)
    print("PATH NORMALIZATION TEST SUITE")
    print("=" * 80)
    
    for input_path, expected, description in test_cases:
        tests_total += 1
        try:
            result = normalize_path_for_babia(input_path)
            
            if result == expected:
                tests_passed += 1
                status = "✓ PASS"
            else:
                status = f"✗ FAIL - Expected: '{expected}', Got: '{result}'"
            
            print(f"\n{status}")
            print(f"  Description: {description}")
            print(f"  Input:       {repr(input_path)}")
            print(f"  Expected:    {repr(expected)}")
            print(f"  Result:      {repr(result)}")
            
        except Exception as e:
            tests_total += 1
            print(f"\n✗ ERROR")
            print(f"  Description: {description}")
            print(f"  Input:       {repr(input_path)}")
            print(f"  Exception:   {str(e)}")
    
    print("\n" + "=" * 80)
    print(f"RESULTS: {tests_passed}/{tests_total} tests passed")
    print("=" * 80)
    
    return tests_passed == tests_total

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
