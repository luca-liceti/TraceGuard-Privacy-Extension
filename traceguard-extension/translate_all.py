import pyjson5
import json
import time
import translators as ts
import os

with open('src/lib/translations.ts', 'r', encoding='utf-8') as f:
    content = f.read()

prefix = "export const resources = "
json_str = content[content.find(prefix) + len(prefix):].strip()
if json_str.endswith(';'):
    json_str = json_str[:-1]

data = pyjson5.decode(json_str)

# Read new keys
with open('new_keys.txt', 'r', encoding='utf-8') as f:
    new_keys = [line.strip() for line in f.readlines() if line.strip()]

# Existing keys
existing_keys = set(data['es']['translation'].keys())

# We need to translate only new keys
keys_to_translate = [k for k in new_keys if k not in existing_keys]

def translate_list(texts, target_lang):
    translated_dict = {}
    chunk_size = 30
    for i in range(0, len(texts), chunk_size):
        chunk = texts[i:i+chunk_size]
        text_to_translate = "\n||\n".join(chunk)
        try:
            res = ts.translate_text(text_to_translate, translator='bing', from_language='en', to_language=target_lang)
            translated = res.split('\n||\n')
            for j, t in enumerate(chunk):
                translated_dict[t] = translated[j].strip() if j < len(translated) else t
            time.sleep(1)
        except Exception as e:
            print(f"Error chunk {i} ({target_lang}): {e}, falling back to google")
            for t in chunk:
                try:
                    translated_dict[t] = ts.translate_text(t, translator='google', from_language='en', to_language=target_lang).strip()
                    time.sleep(0.5)
                except Exception as ex:
                    print(f"Failed {t}: {ex}")
                    translated_dict[t] = t
    return translated_dict

if keys_to_translate:
    print(f"Translating {len(keys_to_translate)} new keys...")
    
    es_new = translate_list(keys_to_translate, 'es')
    fr_new = translate_list(keys_to_translate, 'fr')
    de_new = translate_list(keys_to_translate, 'de')
    
    for k in keys_to_translate:
        data['es']['translation'][k] = es_new.get(k, k)
        data['fr']['translation'][k] = fr_new.get(k, k)
        data['de']['translation'][k] = de_new.get(k, k)
        
    new_json_str = json.dumps(data, indent=2, ensure_ascii=False)
    new_content = f"export const resources = {new_json_str};\n"
    
    with open('src/lib/translations.ts', 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print("Translations updated successfully.")
else:
    print("No new keys to translate.")
