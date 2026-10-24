/**
 * ヘルスチェックの確認先一覧。1 件 1 item で CheckTargets (HTTP) に渡す。
 * Workers / Pages と n8n の公開 URL は Uptime Kuma から移したもの（2026-10 Kuma 撤去）。
 * n8n の公開 URL は外回り (DNS → nginx → 証明書) で自分を叩き、n8n は動いているのに外から入れない故障を拾う。
 */
const TARGETS = [
  {
    name: "HistLink Backend",
    url: "https://histlink-backend.onrender.com/health",
    service: "n8n",
    repo: "n8n-server",
  },
  {
    name: "shirankedo",
    url: "https://shirankedo.y-fudo.workers.dev/",
    service: "cf-worker",
    repo: "shirankedo",
  },
  {
    name: "worldpulse-api",
    url: "https://worldpulse-api.y-fudo.workers.dev/health",
    service: "cf-worker",
    repo: "WorldPulse",
  },
  {
    name: "worldpulse-front",
    url: "https://worldpulse.pages.dev/",
    service: "cf-worker",
    repo: "WorldPulse",
  },
  {
    name: "n8n 公開 URL",
    url: "https://yushin-n8n.duckdns.org/healthz",
    service: "n8n",
    repo: "n8n-server",
  },
];

export default function (): CodeNodeReturn {
  return TARGETS.map((target) => ({ json: { ...target } }));
}
