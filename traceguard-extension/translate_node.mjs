import fs from 'fs';
import { translate } from '@vitalets/google-translate-api';
import JSON5 from 'json5'; // Wait, does the project have json5? Let's check package.json.
// If no json5, I can use a simple regex to insert the keys.
