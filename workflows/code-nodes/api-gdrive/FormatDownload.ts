interface IExecuteContext {
  helpers: {
    getBinaryDataBuffer(
      itemIndex: number,
      propertyName: string,
    ): Promise<{ toString(encoding: BufferEncoding): string }>;
  };
}

export default async function (this: IExecuteContext): Promise<CodeNodeReturn> {
  const fileId = $("PrepDownload").first().json.fileId;

  // n8n最新版はバイナリをfilesystem-v2に格納するため、
  // this.helpers.getBinaryDataBuffer() で正しく読み取る
  let fileContent: string;
  try {
    const buffer = await this.helpers.getBinaryDataBuffer(0, "data");
    fileContent = buffer.toString("utf-8");
  } catch {
    // helpers が使えない場合はフォールバック
    const item = $input.first();
    fileContent = JSON.stringify(item.json);
  }

  return [
    { json: { action: "download", file_id: fileId, content: fileContent } },
  ];
}
