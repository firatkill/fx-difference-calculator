// Sentetik örnek faturalardan, kullanıcının yükleyeceği tek dış zip formatında
// bir arşiv üretir (tarayıcıda manuel test için). Gerçek fatura kullanılmaz.
// Kullanım: npm run make-fixture
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { sampleArchive, sampleArchiveFiles } from "./synthetic-invoices.mjs";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const outDir = join(root, "tests", "fixtures", "generated");
const outFile = join(outDir, "ornek-faturalar.zip");

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, sampleArchive());
console.log(`${outFile} yazıldı (${Object.keys(sampleArchiveFiles()).length} dosya)`);
