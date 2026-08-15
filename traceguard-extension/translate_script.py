import pyjson5
import json
import time
from deep_translator import GoogleTranslator

# Read the file
with open('src/lib/translations.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Extract the JSON object
prefix = "export const resources = "
json_str = content[content.find(prefix) + len(prefix):].strip()
if json_str.endswith(';'):
    json_str = json_str[:-1]

# Parse the JS object
data = pyjson5.decode(json_str)

# Get English keys from 'es'
english_keys = list(data['es']['translation'].keys())

# Initialize fr and de dictionaries
if 'fr' not in data:
    data['fr'] = {'translation': {}}
if 'de' not in data:
    data['de'] = {'translation': {}}

# Translate in chunks to avoid rate limits
def translate_list(texts, target_lang):
    translator = GoogleTranslator(source='en', target=target_lang)
    translated_dict = {}
    
    # Process in chunks
    chunk_size = 50
    for i in range(0, len(texts), chunk_size):
        chunk = texts[i:i+chunk_size]
        try:
            results = translator.translate_batch(chunk)
            for j, text in enumerate(chunk):
                translated_dict[text] = results[j]
            time.sleep(1) # Be nice to the API
        except Exception as e:
            print(f"Error translating to {target_lang} at chunk {i}: {e}")
            # fallback to individual translations
            for text in chunk:
                try:
                    res = GoogleTranslator(source='en', target=target_lang).translate(text)
                    translated_dict[text] = res
                    time.sleep(0.5)
                except Exception as ex:
                    print(f"Error on {text}: {ex}")
                    translated_dict[text] = text
    return translated_dict

print("Translating to French...")
fr_translations = translate_list(english_keys, 'fr')

print("Translating to German...")
de_translations = translate_list(english_keys, 'de')

data['fr']['translation'] = fr_translations
data['de']['translation'] = de_translations

# Convert back to TS file format
new_json_str = json.dumps(data, indent=2, ensure_ascii=False)
new_content = f"export const resources = {new_json_str};\n"

with open('src/lib/translations.ts', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Done!")
