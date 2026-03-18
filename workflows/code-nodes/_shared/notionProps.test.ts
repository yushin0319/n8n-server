import { describe, expect, it } from "vitest";
import {
  notionDate,
  notionLastEdited,
  notionMultiSelectFirst,
  notionRelation,
  notionRichText,
  notionSelect,
  notionStatus,
  notionTitle,
  notionUniqueId,
} from "./notionProps";

const mkProp = (type: string, value: unknown) => ({ [type]: value });

describe("notionTitle", () => {
  it("titleテキストを結合して返す", () => {
    const props = {
      名前: mkProp("title", [
        { plain_text: "Hello " },
        { plain_text: "World" },
      ]),
    };
    expect(notionTitle(props, "名前")).toBe("Hello World");
  });

  it("プロパティ未定義時はfallbackを返す", () => {
    expect(notionTitle({}, "名前")).toBe("(無題)");
    expect(notionTitle({}, "名前", "デフォルト")).toBe("デフォルト");
  });
});

describe("notionRichText", () => {
  it("rich_textテキストを結合して返す", () => {
    const props = {
      説明: mkProp("rich_text", [{ plain_text: "テスト説明" }]),
    };
    expect(notionRichText(props, "説明")).toBe("テスト説明");
  });

  it("プロパティ未定義時は空文字を返す", () => {
    expect(notionRichText({}, "説明")).toBe("");
  });
});

describe("notionSelect", () => {
  it("select名を返す", () => {
    const props = { 重要度: mkProp("select", { name: "重要" }) };
    expect(notionSelect(props, "重要度")).toBe("重要");
  });

  it("未定義時はfallbackを返す", () => {
    expect(notionSelect({}, "重要度", "未設定")).toBe("未設定");
  });
});

describe("notionStatus", () => {
  it("status名を返す", () => {
    const props = { ステータス: mkProp("status", { name: "完了" }) };
    expect(notionStatus(props, "ステータス")).toBe("完了");
  });
});

describe("notionDate", () => {
  it("date.startを返す", () => {
    const props = { 日時: mkProp("date", { start: "2026-03-18" }) };
    expect(notionDate(props, "日時")).toBe("2026-03-18");
  });

  it("dateがnullなら空文字を返す", () => {
    const props = { 日時: { date: null } };
    expect(notionDate(props, "日時")).toBe("");
  });
});

describe("notionUniqueId", () => {
  it("unique_id.numberを返す", () => {
    const props = { ID: mkProp("unique_id", { number: 42 }) };
    expect(notionUniqueId(props, "ID")).toBe(42);
  });

  it("未定義時はundefinedを返す", () => {
    expect(notionUniqueId({}, "ID")).toBeUndefined();
  });
});

describe("notionRelation", () => {
  it("relation IDの配列を返す", () => {
    const props = {
      親タスク: mkProp("relation", [{ id: "abc" }, { id: "def" }]),
    };
    expect(notionRelation(props, "親タスク")).toEqual(["abc", "def"]);
  });

  it("未定義時は空配列を返す", () => {
    expect(notionRelation({}, "親タスク")).toEqual([]);
  });
});

describe("notionMultiSelectFirst", () => {
  it("最初のmulti_select名を返す", () => {
    const props = {
      頻度: mkProp("multi_select", [{ name: "weekly" }, { name: "daily" }]),
    };
    expect(notionMultiSelectFirst(props, "頻度")).toBe("weekly");
  });

  it("未定義時はfallbackを返す", () => {
    expect(notionMultiSelectFirst({}, "頻度", "monthly")).toBe("monthly");
  });
});

describe("notionLastEdited", () => {
  it("last_edited_timeを返す", () => {
    const props = {
      更新日: { last_edited_time: "2026-03-18T00:00:00Z" },
    };
    expect(notionLastEdited(props, "更新日")).toBe("2026-03-18T00:00:00Z");
  });

  it("未定義時は空文字を返す", () => {
    expect(notionLastEdited({}, "更新日")).toBe("");
  });
});
