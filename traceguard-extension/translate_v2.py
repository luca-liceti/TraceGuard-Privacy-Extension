import pyjson5
import json
import time
import translators as ts

with open('src/lib/translations.ts', 'r', encoding='utf-8') as f:
    content = f.read()

prefix = "export const resources = "
json_str = content[content.find(prefix) + len(prefix):].strip()
if json_str.endswith(';'):
    json_str = json_str[:-1]

data = pyjson5.decode(json_str)
english_keys = list(data['es']['translation'].keys())

if 'fr' not in data: data['fr'] = {'translation': {}}
if 'de' not in data: data['de'] = {'translation': {}}

def translate_list(texts, target_lang):
    translated_dict = {}
    chunk_size = 50
    for i in range(0, len(texts), chunk_size):
        chunk = texts[i:i+chunk_size]
        text_to_translate = "\n||\n".join(chunk)
        try:
            res = ts.translate_text(text_to_translate, translator='bing', from_language='en', to_language=target_lang)
            translated = res.split('\n||\n')
            for j, t in enumerate(chunk):
                translated_dict[t] = translated[j] if j < len(translated) else t
            time.sleep(1)
        except Exception as e:
            print(f"Error chunk {i}: {e}, falling back to single translation")
            for t in chunk:
                try:
                    translated_dict[t] = ts.translate_text(t, translator='google', from_language='en', to_language=target_lang)
                    time.sleep(0.5)
                except Exception as ex:
                    print(f"Failed {t}: {ex}")
                    translated_dict[t] = t
    return translated_dict

print("Translating FR...")
data['fr']['translation'] = translate_list(english_keys, 'fr')

print("Translating DE...")
data['de']['translation'] = translate_list(english_keys, 'de')

new_json_str = json.dumps(data, indent=2, ensure_ascii=False)
new_content = f"export const resources = {new_json_str};\n"

with open('src/lib/translations.ts', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Done translating!")
