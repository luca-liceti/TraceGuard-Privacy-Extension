import fs from 'fs';
import { translate } from '@vitalets/google-translate-api';

const filePath = 'src/lib/translations.ts';

async function run() {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const prefix = 'export const resources = ';
  let jsonStr = fileContent.substring(fileContent.indexOf(prefix) + prefix.length).trim();
  if (jsonStr.endsWith(';')) jsonStr = jsonStr.slice(0, -1);

  const data = new Function(`return ${jsonStr}`)();
  
  if (!data.es) data.es = { translation: {} };
  if (!data.fr) data.fr = { translation: {} };
  if (!data.de) data.de = { translation: {} };

  const existingKeys = Object.keys(data.es.translation);
  const newKeys = fs.readFileSync('new_keys.txt', 'utf8').split('\n').map(l => l.trim()).filter(Boolean);
  const keysToTranslate = newKeys.filter(k => !existingKeys.includes(k));

  const delay = (ms) => new Promise(res => setTimeout(res, ms));

  async function translateBatch(keys, lang) {
    const results = {};
    const chunkSize = 15;
    for (let i = 0; i < keys.length; i += chunkSize) {
      const chunk = keys.slice(i, i + chunkSize);
      try {
        console.log(`Translating chunk ${i} to ${lang}...`);
        const textToTranslate = chunk.join('\n|||\n');
        const res = await translate(textToTranslate, { to: lang });
        const translations = res.text.split('\n|||\n');
        
        for (let j = 0; j < chunk.length; j++) {
          results[chunk[j]] = translations[j] ? translations[j].trim() : chunk[j];
        }
        await delay(1000);
      } catch (err) {
        console.error(`Error chunk ${i} for ${lang}:`, err.message);
        for (let key of chunk) {
          try {
             const singleRes = await translate(key, { to: lang });
             results[key] = singleRes.text;
             await delay(500);
          } catch(e) {
             console.error(`Error on single ${key}:`, e.message);
             results[key] = key;
          }
        }
      }
    }
    return results;
  }

  if (keysToTranslate.length > 0) {
      console.log(`Translating ${keysToTranslate.length} keys...`);
      const esTrans = await translateBatch(keysToTranslate, 'es');
      const frTrans = await translateBatch(keysToTranslate, 'fr');
      const deTrans = await translateBatch(keysToTranslate, 'de');
      
      for (const k of keysToTranslate) {
          data.es.translation[k] = esTrans[k] || k;
          data.fr.translation[k] = frTrans[k] || k;
          data.de.translation[k] = deTrans[k] || k;
      }
      
      const newContent = `${prefix}${JSON.stringify(data, null, 2)};\n`;
      fs.writeFileSync(filePath, newContent, 'utf8');
      console.log("Translations added successfully!");
  } else {
      console.log("No new keys to translate.");
  }
}

run().catch(console.error);
