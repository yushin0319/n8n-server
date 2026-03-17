/**
 * n8n Code Node v2 グローバル変数の型定義.
 *
 * Code Node サンドボックス内で利用可能な変数・関数の型を定義する。
 * tsc --noEmit による静的チェックに使用。
 */

// --- 基本型 ---

/** n8n の汎用データオブジェクト */
type IDataObject = Record<string, any>;

/** 1アイテムの実行データ */
interface INodeExecutionData {
  json: IDataObject;
  binary?: Record<string, IBinaryData>;
  pairedItem?: IPairedItemData | IPairedItemData[];
  error?: Error;
}

interface IBinaryData {
  data: string;
  mimeType: string;
  fileName?: string;
  fileSize?: number;
  fileExtension?: string;
}

interface IPairedItemData {
  item: number;
  input?: number;
}

// --- $input ---

interface INodeInput {
  /** 全入力アイテムを取得 */
  all(): INodeExecutionData[];
  /** 最初のアイテムを取得 */
  first(): INodeExecutionData;
  /** 最後のアイテムを取得 */
  last(): INodeExecutionData;
  /** 現在のアイテム（Run Once for Each Item モード） */
  item: INodeExecutionData;
  /** パラメータ値 */
  params: IDataObject;
}

// --- $() ノード参照関数 ---

interface INodeReference {
  /** 参照先ノードの全出力アイテム */
  all(): INodeExecutionData[];
  /** 参照先ノードの最初のアイテム */
  first(): INodeExecutionData;
  /** 参照先ノードの最後のアイテム */
  last(): INodeExecutionData;
  /** 参照先ノードの指定アイテム */
  item: INodeExecutionData;
  /** パラメータ値 */
  params: IDataObject;
  /** コンテキスト */
  context: IDataObject;
  /** アイテム数 */
  itemCount: number;
}

// --- $workflow ---

interface IWorkflowData {
  id: string;
  name: string;
  active: boolean;
}

// --- $execution ---

interface IExecutionData {
  id: string;
  mode: "manual" | "trigger" | "webhook" | "cli" | "error" | "integrated";
  resumeUrl?: string;
  resumeFormUrl?: string;
  customData: {
    get(key: string): string | undefined;
    getAll(): Record<string, string>;
    set(key: string, value: string): void;
    setAll(data: Record<string, string>): void;
  };
}

// --- Code Node の戻り値型 ---

/** Code Node が返すべき型 */
type CodeNodeReturn =
  | INodeExecutionData
  | INodeExecutionData[]
  | INodeExecutionData[][];

// --- グローバル変数宣言 ---

declare const $input: INodeInput;
declare const $json: IDataObject;
declare const $binary: Record<string, IBinaryData> | undefined;
declare const $itemIndex: number;
declare const $runIndex: number;
declare const $node: Record<string, INodeReference>;
declare const $prevNode: { name: string; outputIndex: number; runIndex: number };
declare const $workflow: IWorkflowData;
declare const $execution: IExecutionData;
declare const $env: Record<string, string>;
declare const $now: Date;
declare const $today: Date;

/** 他ノードのデータを参照する関数 */
declare function $(nodeName: string): INodeReference;
