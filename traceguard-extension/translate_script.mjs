import fs from 'fs';
import { translate } from '@vitalets/google-translate-api';

const filePath = 'src/lib/translations.ts';

async function run() {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const prefix = 'export const resources = ';
  let jsonStr = fileContent.substring(fileContent.indexOf(prefix) + prefix.length).trim();
  if (jsonStr.endsWith(';')) jsonStr = jsonStr.slice(0, -1);

  // We need to parse this string. Since it's not strict JSON, let's use eval or Function to get the object
  const data = new Function(`return ${jsonStr}`)();

  const englishKeys = Object.keys(data.es.translation);

  if (!data.fr) data.fr = { translation: {} };
  if (!data.de) data.de = { translation: {} };

  const delay = (ms) => new Promise(res => setTimeout(res, ms));

  async function translateBatch(keys, lang) {
    const results = {};
    // Chunking to avoid large requests
    const chunkSize = 20;
    for (let i = 0; i < keys.length; i += chunkSize) {
      const chunk = keys.slice(i, i + chunkSize);
      try {
        const textToTranslate = chunk.join('\n|||\n');
        const res = await translate(textToTranslate, { to: lang });
        const translations = res.text.split('\n|||\n');
        
        for (let j = 0; j < chunk.length; j++) {
          results[chunk[j]] = translations[j] ? translations[j].trim() : chunk[j];
        }
        await delay(500);
      } catch (err) {
        console.error(`Error chunk ${i} for ${lang}:`, err.message);
        // Fallback to individual
        for (let key of chunk) {
          try {
             const singleRes = await translate(key, { to: lang });
             results[key] = singleRes.text;
             await delay(200);
          } catch(e) {
             console.error(`Error on single ${key}:`, e.message);
             results[key] = key;
          }
        }
      }
    }
    return results;
  }

  console.log("Translating to French...");
  data.fr.translation = await translateBatch(englishKeys, 'fr');
  
  console.log("Translating to German...");
  data.de.translation = await translateBatch(englishKeys, 'de');

  const newContent = `${prefix}${JSON.stringify(data, null, 2)};\n`;
  fs.writeFileSync(filePath, newContent, 'utf8');
  console.log("Done!");
}

run().catch(console.error);
