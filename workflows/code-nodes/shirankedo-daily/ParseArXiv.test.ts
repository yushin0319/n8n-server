import { beforeEach, describe, expect, it, vi } from "vitest";
import parseArXiv from "./ParseArXiv";

function callAndGetItems() {
  const result = parseArXiv();
  const items = Array.isArray(result) ? result : [result];
  return items as INodeExecutionData[];
}

describe("ParseArXiv", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("Atom XMLからエントリを正しくパースする", () => {
    const xml = `<?xml version="1.0"?>
<feed>
  <entry>
    <title>Attention Is All You Need</title>
    <id>http://arxiv.org/abs/1706.03762v1</id>
    <summary>We propose a new architecture...</summary>
  </entry>
  <entry>
    <title>BERT: Pre-training of Deep Bidirectional Transformers</title>
    <id>http://arxiv.org/abs/1810.04805v1</id>
    <summary>We introduce BERT, a language model...</summary>
  </entry>
</feed>`;
    vi.stubGlobal("$input", {
      first: () => ({ json: { data: xml } }),
    });

    const items = callAndGetItems();

    expect(items).toHaveLength(2);
    expect(items[0].json.title).toBe("Attention Is All You Need");
    expect(items[0].json.url).toBe("http://arxiv.org/abs/1706.03762v1");
    expect(items[0].json.source).toBe("arxiv");
    expect(items[0].json.description).toBe("We propose a new architecture...");
    expect(items[1].json.title).toBe(
      "BERT: Pre-training of Deep Bidirectional Transformers",
    );
  });

  it("タイトル内の改行・空白を正規化する", () => {
    const xml = `<feed><entry>
      <title>Multi\n  Line   Title</title>
      <id>http://arxiv.org/abs/test</id>
      <summary>desc</summary>
    </entry></feed>`;
    vi.stubGlobal("$input", {
      first: () => ({ json: { data: xml } }),
    });

    const items = callAndGetItems();
    expect(items[0].json.title).toBe("Multi Line Title");
  });

  it("summaryからHTMLタグを除去する", () => {
    const xml = `<feed><entry>
      <title>Test</title>
      <id>http://arxiv.org/abs/test</id>
      <summary>Text with <b>bold</b> and <a href="x">link</a></summary>
    </entry></feed>`;
    vi.stubGlobal("$input", {
      first: () => ({ json: { data: xml } }),
    });

    const items = callAndGetItems();
    expect(items[0].json.description).toBe("Text with bold and link");
  });

  it("30件で打ち切る", () => {
    const entries = Array.from(
      { length: 50 },
      (_, i) =>
        `<entry><title>Paper ${i}</title><id>http://arxiv.org/abs/${i}</id><summary>desc</summary></entry>`,
    ).join("");
    const xml = `<feed>${entries}</feed>`;
    vi.stubGlobal("$input", {
      first: () => ({ json: { data: xml } }),
    });

    const items = callAndGetItems();
    expect(items).toHaveLength(30);
  });

  it("空XMLの場合はarXiv emptyを返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { data: "" } }),
    });

    const items = callAndGetItems();
    expect(items).toHaveLength(1);
    expect(items[0].json.title).toBe("arXiv empty");
    expect(items[0].json.url).toBe("");
  });

  it("dataがundefinedの場合もarXiv emptyを返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: {} }),
    });

    const items = callAndGetItems();
    expect(items[0].json.title).toBe("arXiv empty");
  });

  it("titleが空のエントリはスキップする", () => {
    const xml = `<feed>
      <entry><title></title><id>http://arxiv.org/abs/1</id><summary>d</summary></entry>
      <entry><title>Valid</title><id>http://arxiv.org/abs/2</id><summary>d</summary></entry>
    </feed>`;
    vi.stubGlobal("$input", {
      first: () => ({ json: { data: xml } }),
    });

    const items = callAndGetItems();
    expect(items).toHaveLength(1);
    expect(items[0].json.title).toBe("Valid");
  });
});
