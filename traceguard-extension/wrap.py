import re
import os

with open("unwrapped.txt") as f:
    lines = f.readlines()

file_strings = {}
current_file = None

for line in lines:
    if line.startswith("File: "):
        current_file = line.split("File: ")[1].strip()
        if current_file not in file_strings:
            file_strings[current_file] = set()
    elif line.startswith("  - "):
        text = line[4:].strip()
        if text:
            file_strings[current_file].add(text)

import_stmt = 'import { useTranslation } from "react-i18next";\n'

for file_path, strings in file_strings.items():
    if not os.path.exists(file_path):
        continue
        
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
        
    original_content = content
    
    # 1. Add import if not present
    if "useTranslation" not in content and "react-i18next" not in content:
        # Find last import
        import_match = list(re.finditer(r'^import .*?;?\n', content, re.MULTILINE))
        if import_match:
            last_import = import_match[-1]
            content = content[:last_import.end()] + import_stmt + content[last_import.end():]
        else:
            content = import_stmt + content
            
    # 2. Add hook `const { t } = useTranslation();`
    # We'll try to find component declarations.
    # Look for `export function Component` or `const Component =` or `function Component`
    # This is tricky because there might be multiple components.
    
    # Actually, if we just do string replacement:
    for s in sorted(strings, key=len, reverse=True):
        # We need to replace >s< or > s < or >s\n< etc.
        # Use regex to find the string between > and <
        escaped_s = re.escape(s)
        # Handle possible whitespaces around it
        # pattern: >\s*text\s*< -> >{t("text")}<
        
        # It's better to match the exact string with whitespaces inside JSX
        # We can look for >\s*escaped_s\s*<
        
        def repl(match):
            prefix = match.group(1)
            suffix = match.group(2)
            # escape double quotes inside s
            safe_s = s.replace('"', '\\"')
            return f"{prefix}{{t(\"{safe_s}\")}}{suffix}"
            
        content = re.sub(r'(>[\s\n]*)(' + escaped_s + r')([\s\n]*<)', repl, content)

    if content != original_content:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Updated {file_path}")

print("Done wrapping strings.")
