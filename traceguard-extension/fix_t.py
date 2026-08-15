import re

files = [
    "src/components/data-table.tsx",
    "src/components/legacy-data-table.tsx"
]

for file in files:
    with open(file, "r") as f:
        content = f.read()
    
    # Remove `const { t } = useTranslation();` inside GroupedTableBody which takes `t` as prop.
    # We can just remove duplicate `const { t } = useTranslation();` from the same block.
    # Wait, GroupedTableBody takes `t` as prop, so the declaration is an error.
    
    content = content.replace("    const { t } = useTranslation();\n  const colCount = columns.length", "  const colCount = columns.length")
    content = content.replace("  const { t } = useTranslation();\n  const colCount = columns.length", "  const colCount = columns.length")
    
    with open(file, "w") as f:
        f.write(content)
