import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runM1VerificationSuite } from './m1_verification.js';
import { runM2VerificationSuite } from './m2_verification.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data_in', 'pile_specs.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));

const reportM1 = await runM1VerificationSuite(db);
console.log(`=== M1 VERIFICATION SUITE: ${reportM1.passedCount}/${reportM1.totalTests} PASSED ===`);
for (const r of reportM1.results) {
  console.log(`[${r.passed ? 'PASS' : 'FAIL'}] ${r.name} -> ${r.detail}`);
}

const reportM2 = await runM2VerificationSuite(db);
console.log(`\n=== M2 VERIFICATION SUITE: ${reportM2.passedCount}/${reportM2.totalTests} PASSED ===`);
for (const r of reportM2.results) {
  console.log(`[${r.passed ? 'PASS' : 'FAIL'}] ${r.name} -> ${r.detail}`);
}

if (!reportM1.allPassed || !reportM2.allPassed) process.exit(1);
