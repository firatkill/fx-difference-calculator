// docs/invoice_zip_example klasörünü, kullanıcının yükleyeceği tek dış zip
// formatında paketler (tarayıcıda manuel test için).
// Kullanım: npm run make-fixture
import { zipSync } from "fflate";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const srcDir = join(root, "docs", "invoice_zip_example");
const outDir = join(root, "tests", "fixtures", "generated");
const outFile = join(outDir, "ornek-faturalar.zip");

function collect(dir, files = {}) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      collect(full, files);
    } else {
      // .DS_Store dahil her şeyi koy: gerçek dünya gürültüsü test edilsin
      files[relative(srcDir, full)] = readFileSync(full);
    }
  }
  return files;
}

const files = collect(srcDir);
mkdirSync(outDir, { recursive: true });
// İç .zip'ler zaten sıkıştırılmış; level 0 yeterli ve hızlı
writeFileSync(outFile, zipSync(files, { level: 0 }));
console.log(`${outFile} yazıldı (${Object.keys(files).length} dosya)`);
