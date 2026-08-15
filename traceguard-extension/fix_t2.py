import re

file = "src/components/data-table.tsx"
with open(file, "r") as f:
    content = f.read()

content = re.sub(r'const \{ t \} = useTranslation\(\);\s+const colCount', 'const colCount', content)

with open(file, "w") as f:
    f.write(content)
