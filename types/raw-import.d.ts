/** vitest（vite）の ?raw import: ファイル内容を文字列として読む（テストのフィクスチャ用） */
declare module "*?raw" {
  const content: string;
  export default content;
}
