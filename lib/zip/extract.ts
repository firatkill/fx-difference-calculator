import { unzipSync } from "fflate";

/**
 * Dış zip'i özyinelemeli tarar: içindeki tüm .zip'lere (max derinlik) girer,
 * bulduğu tüm .xml dosyalarını toplar. Klasör yapısına güvenilmez;
 * .DS_Store, __MACOSX vb. yok sayılır. (bkz. docs/plan.md bölüm 7)
 */

export interface ExtractedXml {
  /** Kaynak yolu; iç zip sınırları "!/" ile ayrılır */
  path: string;
  data: Uint8Array;
}

export interface ExtractError {
  path: string;
  message: string;
}

export interface ExtractResult {
  xmls: ExtractedXml[];
  /** Taranan zip sayısı (dış zip dahil) */
  zipCount: number;
  errors: ExtractError[];
}

const MAX_DEPTH = 5;

function isJunk(path: string): boolean {
  const name = path.split("/").pop() ?? path;
  return (
    path.startsWith("__MACOSX/") ||
    path.includes("/__MACOSX/") ||
    name === ".DS_Store" ||
    name.startsWith("._")
  );
}

/** Olay döngüsünü kilitlememek için ara sıra nefes aldır */
function yieldToLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export async function extractInvoiceXmls(
  data: Uint8Array,
  onProgress?: (processedZips: number) => void,
): Promise<ExtractResult> {
  const result: ExtractResult = { xmls: [], zipCount: 0, errors: [] };
  await walkZip(data, "", 0, result, onProgress);
  return result;
}

async function walkZip(
  data: Uint8Array,
  parentPath: string,
  depth: number,
  result: ExtractResult,
  onProgress?: (processedZips: number) => void,
): Promise<void> {
  if (depth > MAX_DEPTH) {
    result.errors.push({
      path: parentPath || "(kök)",
      message: `İç içe zip derinliği ${MAX_DEPTH} seviyeyi aştı`,
    });
    return;
  }

  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(data, { filter: (f) => !isJunk(f.name) });
  } catch (err) {
    result.errors.push({
      path: parentPath || "(kök)",
      message: `Zip açılamadı: ${err instanceof Error ? err.message : String(err)}`,
    });
    return;
  }

  result.zipCount++;
  onProgress?.(result.zipCount);

  let processed = 0;
  for (const [name, content] of Object.entries(entries)) {
    if (name.endsWith("/")) continue; // klasör kaydı
    const fullPath = parentPath ? `${parentPath}!/${name}` : name;
    const lower = name.toLowerCase();

    if (lower.endsWith(".zip")) {
      await walkZip(content, fullPath, depth + 1, result, onProgress);
    } else if (lower.endsWith(".xml")) {
      result.xmls.push({ path: fullPath, data: content });
    }
    // diğer uzantılar sessizce atlanır

    if (++processed % 20 === 0) await yieldToLoop();
  }
}
