import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runM1VerificationSuite } from './m1_verification.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data_in', 'pile_specs.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));

const report = await runM1VerificationSuite(db);
console.log(`=== M1 VERIFICATION SUITE: ${report.passedCount}/${report.totalTests} PASSED ===`);
for (const r of report.results) {
  console.log(`[${r.passed ? 'PASS' : 'FAIL'}] ${r.name} -> ${r.detail}`);
}
if (!report.allPassed) process.exit(1);
