import { describe, expect, it, vi, beforeEach } from "vitest";
import accumulateTranslations from "./AccumulateTranslations";

describe("AccumulateTranslations", () => {
  let staticData: IDataObject;

  beforeEach(() => {
    vi.unstubAllGlobals();
    staticData = {};
    vi.stubGlobal("$getWorkflowStaticData", () => staticData);
  });

  it("display_nameとdescriptionを正しくパースする", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          candidates: [
            {
              content: {
                parts: [
                  { text: "1. Open WebUI | ローカルLLM用WebUI\n2. VS Code | 高機能コードエディタ" },
                ],
              },
            },
          ],
        },
      }),
      all: () => [{ json: {} }],
    });
    vi.stubGlobal("$", (nodeName: string) => {
      if (nodeName === "SplitTranslateBatches") {
        return {
          first: () => ({
            json: {
              repos: [
                { repo: "owner/open-webui", name: "open-webui", description: "orig", language: "Python", stars: 5000 },
                { repo: "microsoft/vscode", name: "vscode", description: "orig2", language: "TypeScript", stars: 150000 },
              ],
            },
          }),
        };
      }
      throw new Error(`Unknown node: ${nodeName}`);
    });

    accumulateTranslations();
    const translations = staticData.translations as IDataObject[];
    expect(translations).toHaveLength(2);
    expect(translations[0].displayName).toBe("Open WebUI");
    expect(translations[0].description).toBe("ローカルLLM用WebUI");
    expect(translations[1].displayName).toBe("VS Code");
    expect(translations[1].description).toBe("高機能コードエディタ");
  });

  it("対応する行がない場合でもフォールバックする", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          candidates: [
            { content: { parts: [{ text: "1. Tool Name | 説明文" }] } },
          ],
        },
      }),
      all: () => [{ json: {} }],
    });
    vi.stubGlobal("$", (nodeName: string) => {
      if (nodeName === "SplitTranslateBatches") {
        return {
          first: () => ({
            json: {
              repos: [
                { repo: "owner/tool", name: "tool", description: "fallback desc", language: "Go", stars: 100 },
                { repo: "owner/other", name: "other", description: "other desc", language: "Rust", stars: 200 },
              ],
            },
          }),
        };
      }
      throw new Error(`Unknown node: ${nodeName}`);
    });

    accumulateTranslations();
    const translations = staticData.translations as IDataObject[];
    expect(translations).toHaveLength(2);
    // 2番目のリポには対応する行がないのでフォールバック
    expect(translations[1].displayName).toBe("other");
    expect(translations[1].description).toBe("other desc");
  });
});
