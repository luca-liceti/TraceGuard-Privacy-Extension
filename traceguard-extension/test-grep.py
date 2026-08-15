import re
import os

with open("unwrapped.txt") as f:
    lines = f.readlines()

files = set()
for line in lines:
    if line.startswith("File:"):
        files.add(line.split("File:")[1].strip())

print(f"Total files: {len(files)}")
print("\n".join(sorted(list(files))))
