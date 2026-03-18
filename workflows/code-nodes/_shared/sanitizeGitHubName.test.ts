import { describe, expect, it } from "vitest";
import { sanitizeGitHubName } from "./sanitizeGitHubName";

describe("sanitizeGitHubName", () => {
  it("正常なowner/nameはそのまま返す", () => {
    expect(sanitizeGitHubName("facebook")).toBe("facebook");
    expect(sanitizeGitHubName("react")).toBe("react");
    expect(sanitizeGitHubName("my-repo.js")).toBe("my-repo.js");
    expect(sanitizeGitHubName("repo_name")).toBe("repo_name");
  });

  it("ダブルクォートを除去する", () => {
    expect(sanitizeGitHubName('evil"owner')).toBe("evilowner");
  });

  it("バックスラッシュを除去する", () => {
    expect(sanitizeGitHubName("evil\\owner")).toBe("evilowner");
  });

  it("日本語・特殊文字を除去する", () => {
    expect(sanitizeGitHubName("テスト")).toBe("");
    expect(sanitizeGitHubName("owner<script>")).toBe("ownerscript");
  });

  it("空文字列はそのまま返す", () => {
    expect(sanitizeGitHubName("")).toBe("");
  });
});
