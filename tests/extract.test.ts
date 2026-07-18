import { describe, expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { extractInvoiceXmls } from "@/lib/zip/extract";

const xml = (id: string) => strToU8(`<Invoice><ID>${id}</ID></Invoice>`);

describe("extractInvoiceXmls", () => {
  it("iç içe zipleri özyinelemeli tarar, gürültüyü atlar", async () => {
    // gerçek yapıyı taklit et: yıl/ay klasörleri içinde fatura zipleri
    const innerZip1 = zipSync({ "f1.xml": xml("F1") });
    const innerZip2 = zipSync({ "f2.xml": xml("F2") });
    const outer = zipSync({
      "2025/07/DEL1~1.zip": innerZip1,
      "2025/08/DEL2~2.zip": innerZip2,
      "2025/08/dogrudan.xml": xml("F3"), // zip'siz duran xml de yakalanmalı
      "2025/.DS_Store": strToU8("junk"),
      "__MACOSX/._x": strToU8("junk"),
      "2025/07/okuma.txt": strToU8("ignore"),
    });

    const result = await extractInvoiceXmls(outer);

    expect(result.errors).toHaveLength(0);
    expect(result.zipCount).toBe(3); // dış + 2 iç
    expect(result.xmls.map((x) => x.path).sort()).toEqual([
      "2025/07/DEL1~1.zip!/f1.xml",
      "2025/08/DEL2~2.zip!/f2.xml",
      "2025/08/dogrudan.xml",
    ]);
  });

  it("iki seviye iç içe zipleri açar", async () => {
    const level2 = zipSync({ "derin.xml": xml("D") });
    const level1 = zipSync({ "ic.zip": level2 });
    const outer = zipSync({ "dis.zip": level1 });

    const result = await extractInvoiceXmls(outer);
    expect(result.xmls).toHaveLength(1);
    expect(result.xmls[0].path).toBe("dis.zip!/ic.zip!/derin.xml");
  });

  it("derinlik sınırını aşınca hata kaydeder, çökmez", async () => {
    let z = zipSync({ "f.xml": xml("X") });
    for (let i = 0; i < 7; i++) z = zipSync({ [`z${i}.zip`]: z });

    const result = await extractInvoiceXmls(z);
    expect(result.xmls).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("bozuk zip için hata kaydeder, çökmez", async () => {
    const outer = zipSync({
      "bozuk.zip": strToU8("bu bir zip degil"),
      "saglam.xml": xml("OK"),
    });
    const result = await extractInvoiceXmls(outer);
    expect(result.xmls).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].path).toBe("bozuk.zip");
  });
});
