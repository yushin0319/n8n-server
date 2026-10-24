import { describe, expect, it } from "vitest";
import buildTargets from "./BuildTargets";

function targets() {
  return (buildTargets() as INodeExecutionData[]).map((i) => i.json);
}

describe("BuildTargets", () => {
  it("確認先を 1 件 1 item で返し、各 item に name / url / service / repo がある", () => {
    const list = targets();
    expect(list.length).toBeGreaterThanOrEqual(5);
    for (const t of list) {
      expect(typeof t.name).toBe("string");
      expect(String(t.url)).toMatch(/^https:\/\//);
      expect(["n8n", "cf-worker"]).toContain(t.service);
      expect(["n8n-server", "shirankedo", "WorldPulse"]).toContain(t.repo);
    }
  });

  it("HistLink は従来どおり service=n8n / repo=n8n-server（観測性 DB の件名を変えない）", () => {
    const histlink = targets().find((t) => t.name === "HistLink Backend");
    expect(histlink).toEqual({
      name: "HistLink Backend",
      url: "https://histlink-backend.onrender.com/health",
      service: "n8n",
      repo: "n8n-server",
    });
  });

  it("Uptime Kuma から移した Workers / Pages と n8n の公開 URL を含む", () => {
    const urls = targets().map((t) => t.url);
    expect(urls).toEqual(
      expect.arrayContaining([
        "https://shirankedo.y-fudo.workers.dev/",
        "https://worldpulse-api.y-fudo.workers.dev/health",
        "https://worldpulse.pages.dev/",
        "https://yushin-n8n.duckdns.org/healthz",
      ]),
    );
  });
});
