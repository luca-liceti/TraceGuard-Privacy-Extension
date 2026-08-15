import os
import re

def find_unwrapped_strings(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Look for patterns like > Some Text <
    # where the text has at least one letter and isn't just whitespace or { }
    # A simple regex for JSX text: >([^<>{}]*[a-zA-Z][^<>{}]*)<
    matches = re.finditer(r'>([^<>{}]*[a-zA-Z][^<>{}]*)<', content)
    
    unwrapped = []
    for m in matches:
        text = m.group(1).strip()
        if text and not text.startswith('{') and not text.endswith('}'):
            # Check if it looks like an English word/sentence
            if len(text) > 1 and re.search(r'[A-Za-z]', text):
                unwrapped.append(text)
                
    if unwrapped:
        print(f"File: {file_path}")
        for t in set(unwrapped):
            print(f"  - {t}")

for root, dirs, files in os.walk('src'):
    for file in files:
        if file.endswith('.tsx'):
            find_unwrapped_strings(os.path.join(root, file))
