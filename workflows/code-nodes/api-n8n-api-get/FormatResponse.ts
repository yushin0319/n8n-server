/**
 * n8n REST API レスポンスを {status, data} 形式に整形して webhook の呼び出し元
 * (webhook.py n8n-api-get) に返す。レスポンスの構造は呼び出し対象 endpoint に
 * よって変わる (workflows は {data: [...]}, executions も {data: [...]} 等) の
 * で、薄くラップするだけにする。
 */
export default function (): CodeNodeReturn {
  const apiResponse = $input.first().json as IDataObject;

  return [
    {
      json: {
        status: "ok",
        data: apiResponse,
      },
    },
  ];
}
