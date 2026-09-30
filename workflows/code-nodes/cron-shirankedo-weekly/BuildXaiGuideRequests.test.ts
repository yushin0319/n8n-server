import { afterEach, describe, expect, it, vi } from "vitest";
import { XAI_GUIDE_LIMIT, XAI_INDEX_URL } from "./_shared/deprecations";
import { buildXaiGuideRequests } from "./BuildXaiGuideRequests";

const LLMS_TXT =
  "- [Migration Guides — Model Retirement (May 15, 2026)](https://docs.x.ai/developers/migration/may-15-retirement.md)";

describe("buildXaiGuideRequests", () => {
  it("llms.txt の移行ガイドを取得対象にする", () => {
    expect(
      buildXaiGuideRequests([
        { vendor: "openai", statusCode: 200, body: "x" },
        { vendor: "xai-index", statusCode: 200, body: LLMS_TXT },
      ]),
    ).toEqual([
      {
        vendor: "xai",
        url: "https://docs.x.ai/developers/migration/may-15-retirement.md",
      },
    ]);
  });

  it("n8n の既定キー（data）の本文も読む", () => {
    expect(
      buildXaiGuideRequests([
        { vendor: "xai-index", statusCode: 200, data: LLMS_TXT },
      ]),
    ).toEqual([
      {
        vendor: "xai",
        url: "https://docs.x.ai/developers/migration/may-15-retirement.md",
      },
    ]);
  });

  it.each([
    [[{ vendor: "xai-index", statusCode: 500 }], "llms.txt: HTTP 500"],
    [[{ vendor: "xai-index", error: {} }], "llms.txt: HTTP error"],
    [[{ vendor: "xai-index", statusCode: 200 }], "llms.txt: 本文がありません"],
    [
      [{ vendor: "xai-index", statusCode: 200, body: "no links" }],
      "llms.txt に移行ガイドのリンクがありません",
    ],
    [[], "llms.txt の取得結果がありません"],
  ])("取れない場合も 1 件出力し理由を入れる（%#）", (pages, reason) => {
    expect(buildXaiGuideRequests(pages as IDataObject[])).toEqual([
      { vendor: "xai", url: XAI_INDEX_URL, indexError: reason },
    ]);
  });
});

describe("buildXaiGuideRequests（上限・例外）", () => {
  afterEach(() => {
    vi.doUnmock("./_shared/deprecations");
    vi.resetModules();
  });

  it(`移行ガイドは最大 ${XAI_GUIDE_LIMIT} 件まで取り、超えたら警告を付ける`, () => {
    const many = Array.from(
      { length: XAI_GUIDE_LIMIT + 5 },
      (_, i) =>
        `- [Migration Guides — ${i}](https://docs.x.ai/developers/migration/g${i}.md)`,
    ).join("\n");
    const out = buildXaiGuideRequests([
      { vendor: "xai-index", statusCode: 200, body: many },
    ]);
    expect(out).toHaveLength(XAI_GUIDE_LIMIT);
    expect(out[0].truncated).toBe(
      `移行ガイド ${XAI_GUIDE_LIMIT + 5} 件のうち先頭 ${XAI_GUIDE_LIMIT} 件だけ取得`,
    );
  });

  it("llms.txt の解析で例外が出ても 1 件出力して続行する", async () => {
    vi.resetModules();
    vi.doMock("./_shared/deprecations", async (importOriginal) => {
      const mod =
        await importOriginal<typeof import("./_shared/deprecations")>();
      return {
        ...mod,
        parseXaiIndex: () => {
          throw new Error("boom");
        },
      };
    });
    const { buildXaiGuideRequests: build } = await import(
      "./BuildXaiGuideRequests"
    );
    expect(
      build([{ vendor: "xai-index", statusCode: 200, body: LLMS_TXT }]),
    ).toEqual([
      {
        vendor: "xai",
        url: XAI_INDEX_URL,
        indexError: "llms.txt の解析で例外: Error: boom",
      },
    ]);
  });
});
