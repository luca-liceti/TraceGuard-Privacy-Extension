import os
import re

files_to_update = [
    "src/components/traceguard/profile.tsx"
]

color_map = {
    r'text-zinc-[89]00': 'text-foreground',
    r'text-zinc-[1]00': 'text-foreground',
    r'text-zinc-[456]00': 'text-muted-foreground',
    r'bg-zinc-[12]00': 'bg-muted',
    r'bg-zinc-[89]00': 'bg-muted',
    r'bg-zinc-50': 'bg-muted',
    r'border-zinc-[28]00': 'border-border',
}

for file_path in files_to_update:
    if not os.path.exists(file_path):
        print(f"Not found: {file_path}")
        continue
        
    with open(file_path, 'r') as f:
        content = f.read()
        
    original = content
    for pattern, replacement in color_map.items():
        content = re.sub(pattern, replacement, content)
        
    if content != original:
        with open(file_path, 'w') as f:
            f.write(content)
        print(f"Updated: {file_path}")
    else:
        print(f"No changes: {file_path}")
