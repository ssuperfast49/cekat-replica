import fs from 'fs';
import path from 'path';

const inputPath = 'C:\\Users\\resha\\.gemini\\antigravity\\brain\\d07a7cf9-191e-4c26-82cd-33c3b9a8d12c\\.system_generated\\steps\\895\\output.txt';
const outputPath = 'c:\\Users\\resha\\OneDrive - Sumindex\\Desktop\\Kerjaan\\Freelance\\cekat-replica\\src\\integrations\\supabase\\types.ts';

try {
  const data = fs.readFileSync(inputPath, 'utf8');
  const json = JSON.parse(data);
  fs.writeFileSync(outputPath, json.types, 'utf8');
  console.log('Successfully updated types.ts');
} catch (err) {
  console.error('Error updating types.ts:', err);
  process.exit(1);
}
