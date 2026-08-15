const { Project, SyntaxKind, Node } = require("ts-morph");
const fs = require("fs");

const project = new Project({
  tsConfigFilePath: "tsconfig.json",
});

const filesToProcess = new Set();
const unwrapped = fs.readFileSync("unwrapped.txt", "utf-8").split("\n");
for (const line of unwrapped) {
  if (line.startsWith("File: ")) {
    filesToProcess.add(line.replace("File: ", "").trim());
  }
}

function isTranslatable(text) {
  text = text.trim();
  if (!text) return false;
  if (text.length <= 1) return false;
  if (/^[\d\s\W_]+$/.test(text)) return false;
  if (["TraceGuard", "UPS", "WSS", "N/A", "URLhaus", "ToS;DR"].includes(text)) return false; 
  return /[a-zA-Z]/.test(text);
}

for (const filePath of filesToProcess) {
  if (!fs.existsSync(filePath)) continue;
  
  const sourceFile = project.getSourceFile(filePath);
  if (!sourceFile) continue;

  let needsTranslation = false;
  const newKeys = new Set();

  sourceFile.forEachDescendant(node => {
    if (Node.isJsxText(node)) {
      const text = node.getLiteralText();
      const trimmed = text.trim();
      if (isTranslatable(trimmed)) {
        needsTranslation = true;
        const safeText = trimmed.replace(/"/g, '\\"').replace(/\n/g, ' ');
        node.replaceWithText(`{t("${safeText}")}`);
        newKeys.add(trimmed.replace(/\n/g, ' '));
      }
    }
  });
  
  sourceFile.forEachDescendant(node => {
    if (Node.isStringLiteral(node) && Node.isJsxAttribute(node.getParent())) {
      const text = node.getLiteralValue();
      const attrName = node.getParent().getNameNode().getText();
      if (["placeholder", "title", "alt", "label", "description"].includes(attrName) && isTranslatable(text)) {
        needsTranslation = true;
        const safeText = text.replace(/"/g, '\\"').replace(/\n/g, ' ');
        node.replaceWithText(`{t("${safeText}")}`);
        newKeys.add(text.replace(/\n/g, ' '));
      }
    }
  });

  if (needsTranslation) {
    const importDecl = sourceFile.getImportDeclaration(decl => decl.getModuleSpecifierValue() === "react-i18next");
    if (!importDecl) {
      sourceFile.addImportDeclaration({
        namedImports: ["useTranslation"],
        moduleSpecifier: "react-i18next"
      });
    }

    const functions = [
      ...sourceFile.getFunctions(),
      ...sourceFile.getVariableDeclarations().filter(v => 
        v.getInitializer() && (Node.isArrowFunction(v.getInitializer()) || Node.isFunctionExpression(v.getInitializer()))
      ).map(v => v.getInitializer())
    ];

    for (const func of functions) {
      let name = "";
      if (Node.isFunctionDeclaration(func)) name = func.getName() || "";
      else if (func.getParent() && Node.isVariableDeclaration(func.getParent())) {
        name = func.getParent().getName() || "";
      }

      if (!name || name[0] !== name[0].toUpperCase()) {
        continue;
      }

      let body = func.getBody();
      if (body && Node.isBlock(body)) {
        const hasHook = body.getStatements().some(s => s.getText().includes("useTranslation"));
        if (!hasHook) {
          body.insertStatements(0, "const { t } = useTranslation();");
        }
      }
    }
    
    fs.appendFileSync("new_keys.txt", Array.from(newKeys).join("\n") + "\n");
    sourceFile.saveSync();
    console.log(`Updated ${filePath}`);
  }
}
console.log("Done");
