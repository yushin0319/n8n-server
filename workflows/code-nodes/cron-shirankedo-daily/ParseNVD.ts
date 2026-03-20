/** CVSS メトリクスの型 */
interface CvssMetric {
  cvssData?: { baseScore?: number };
}

/** NVD CVE エントリの型 */
interface NvdCveEntry {
  cve?: {
    id?: string;
    descriptions?: { lang: string; value: string }[];
    metrics?: {
      cvssMetricV31?: CvssMetric[];
      cvssMetricV30?: CvssMetric[];
    };
    published?: string;
  };
}

/** パース結果の型 */
interface ParsedVuln {
  cveId: string;
  description: string;
  cvssScore: number;
  publishedAt: string;
}

export default function (): CodeNodeReturn {
  // NVD APIレスポンスをパース（CVSS >= 8.0 フィルタ + 既存CVE除外）
  const nvdData = $("FetchNVD").first().json;
  const existingData = $("FetchExistingCVEs").first().json;
  const existingIds = new Set((existingData.data as string[]) || []);
  const vulns = (nvdData.vulnerabilities || []) as NvdCveEntry[];

  const results: ParsedVuln[] = [];
  for (const v of vulns) {
    const cve = v.cve || {};
    const cveId = cve.id || "";
    if (existingIds.has(cveId)) continue;

    const descriptions = cve.descriptions || [];
    const enDesc = descriptions.find((d) => d.lang === "en");
    const description = enDesc ? enDesc.value : "";

    const metrics = cve.metrics || {};
    let cvssScore: number | null = null;
    if (metrics.cvssMetricV31 && metrics.cvssMetricV31.length > 0) {
      cvssScore = metrics.cvssMetricV31[0].cvssData?.baseScore ?? null;
    } else if (metrics.cvssMetricV30 && metrics.cvssMetricV30.length > 0) {
      cvssScore = metrics.cvssMetricV30[0].cvssData?.baseScore ?? null;
    }
    if (cvssScore === null || cvssScore < 8.0) continue;

    const publishedAt = cve.published ? cve.published.substring(0, 10) : "";
    if (cveId && description) {
      results.push({
        cveId,
        description: description.substring(0, 500),
        cvssScore,
        publishedAt,
      });
    }
  }

  return [{ json: { vulnerabilities: results, count: results.length } }];
}
