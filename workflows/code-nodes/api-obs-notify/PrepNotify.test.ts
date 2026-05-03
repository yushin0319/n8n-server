import { beforeEach, describe, expect, it, vi } from "vitest";
import prepNotify from "./PrepNotify";

function callAndGetItems() {
  const result = prepNotify();
  const items = Array.isArray(result) ? result : [result];
  return items as INodeExecutionData[];
}

const minimalBody = {
  severity: "info",
  service: "n8n",
  subject: "test",
};

describe("PrepNotify", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("正常系 (info): channel/envKey/Discord/Notion payload を構築", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { body: minimalBody } }),
    });

    const items = callAndGetItems();

    expect(items[0].json.channel).toBe("obs-info");
    expect(items[0].json.envKey).toBe("OBS_WEBHOOK_INFO_URL");
    const discord = JSON.parse(items[0].json.discordBody as string);
    expect(discord.embeds[0].title).toBe("test");
    expect(discord.embeds[0].color).toBe(0x3498db);
    expect(discord.content).toBeUndefined();

    const notion = JSON.parse(items[0].json.notionBody as string);
    expect(notion.parent.database_id).toBe(
      "3552570f-e49f-80a6-9186-c1a14b7d9547",
    );
    expect(notion.properties.severity.select.name).toBe("info");
    expect(notion.properties.service.select.name).toBe("n8n");
    expect(notion.properties.discord_channel.select.name).toBe("obs-info");
    expect(notion.properties.subject.title[0].text.content).toBe("test");
  });

  it("severity=warning: yellow color / envKey", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { body: { ...minimalBody, severity: "warning" } },
      }),
    });
    const items = callAndGetItems();
    expect(items[0].json.envKey).toBe("OBS_WEBHOOK_WARNING_URL");
    expect(items[0].json.channel).toBe("obs-warning");
    const discord = JSON.parse(items[0].json.discordBody as string);
    expect(discord.embeds[0].color).toBe(0xf1c40f);
    expect(discord.content).toBeUndefined();
  });

  it("severity=critical: red color / @here / envKey", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { body: { ...minimalBody, severity: "critical" } },
      }),
    });
    const items = callAndGetItems();
    expect(items[0].json.envKey).toBe("OBS_WEBHOOK_CRITICAL_URL");
    expect(items[0].json.channel).toBe("obs-critical");
    const discord = JSON.parse(items[0].json.discordBody as string);
    expect(discord.embeds[0].color).toBe(0xe74c3c);
    expect(discord.content).toBe("@here");
  });

  it("repo / summary / url / raw_payload は任意", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          body: {
            ...minimalBody,
            severity: "warning",
            repo: "shirankedo",
            summary: "RSS 0件",
            url: "https://example.com/issue/1",
            raw_payload: { foo: "bar" },
          },
        },
      }),
    });

    const items = callAndGetItems();
    const notion = JSON.parse(items[0].json.notionBody as string);
    expect(notion.properties.repo.select.name).toBe("shirankedo");
    expect(notion.properties.summary.rich_text[0].text.content).toBe("RSS 0件");
    expect(notion.properties.url.url).toBe("https://example.com/issue/1");
    expect(notion.properties.raw_payload.rich_text[0].text.content).toBe(
      JSON.stringify({ foo: "bar" }),
    );

    const discord = JSON.parse(items[0].json.discordBody as string);
    expect(discord.embeds[0].url).toBe("https://example.com/issue/1");
    expect(discord.embeds[0].footer.text).toContain("shirankedo");
  });

  it("raw_payload が文字列ならそのまま使う", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { body: { ...minimalBody, raw_payload: "raw string" } },
      }),
    });
    const notion = JSON.parse(callAndGetItems()[0].json.notionBody as string);
    expect(notion.properties.raw_payload.rich_text[0].text.content).toBe(
      "raw string",
    );
  });

  it("subject 2000 字超は Notion 側で切り詰め (256 字超は Discord 側で切り詰め)", () => {
    const long = "あ".repeat(3000);
    vi.stubGlobal("$input", {
      first: () => ({
        json: { body: { ...minimalBody, subject: long } },
      }),
    });
    const items = callAndGetItems();
    const notion = JSON.parse(items[0].json.notionBody as string);
    expect(notion.properties.subject.title[0].text.content.length).toBe(2000);
    const discord = JSON.parse(items[0].json.discordBody as string);
    expect(discord.embeds[0].title.length).toBe(256);
  });

  it("summary 2000 字超は Notion 側で切り詰め (4096 字超は Discord 側で切り詰め)", () => {
    const long = "x".repeat(5000);
    vi.stubGlobal("$input", {
      first: () => ({
        json: { body: { ...minimalBody, summary: long } },
      }),
    });
    const items = callAndGetItems();
    const notion = JSON.parse(items[0].json.notionBody as string);
    expect(notion.properties.summary.rich_text[0].text.content.length).toBe(
      2000,
    );
    const discord = JSON.parse(items[0].json.discordBody as string);
    expect(discord.embeds[0].description.length).toBe(4096);
  });

  it("raw_payload が長文 JSON でも 2000 字に切り詰め", () => {
    const big = { data: "y".repeat(5000) };
    vi.stubGlobal("$input", {
      first: () => ({
        json: { body: { ...minimalBody, raw_payload: big } },
      }),
    });
    const notion = JSON.parse(callAndGetItems()[0].json.notionBody as string);
    expect(notion.properties.raw_payload.rich_text[0].text.content.length).toBe(
      2000,
    );
  });

  it("severity 不正で throw", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { body: { ...minimalBody, severity: "fatal" } },
      }),
    });
    expect(() => prepNotify()).toThrow("severity must be one of");
  });

  it("service が許可リスト外で throw", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { body: { ...minimalBody, service: "unknown-service" } },
      }),
    });
    expect(() => prepNotify()).toThrow("service must be one of");
  });

  it("subject 欠如で throw", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { body: { severity: "info", service: "n8n" } },
      }),
    });
    expect(() => prepNotify()).toThrow("subject is required");
  });

  it("repo が許可リスト外で throw", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { body: { ...minimalBody, repo: "unknown-repo" } },
      }),
    });
    expect(() => prepNotify()).toThrow("repo must be one of");
  });
});
