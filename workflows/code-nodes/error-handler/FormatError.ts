export default function (): CodeNodeReturn {
  const WF_MAP: Record<string, string> = {
    'c8ZI0oriZgjePMud': 'Notion Tasks',
    'oGx9uiLsxLGfGDcJ': 'Gmail to Notion',
    'eR0S42ouMZUeNKG6': 'Notion Emails',
    'BG2MtyVnocJvwz2f': 'GitHub日次サマリー',
    'NKY960IvoIjpLH6m': 'Recurring Tasks',
    'hzu5NmntpfNSEIgO': 'Health Check',
    'IVGYXlxoKKGURa4y': 'Server Status',
    '8CCP4flWRe4eaKoF': 'Discord Notify',
    'LeUNzin0uEbk6co6': 'shirankedo 日次Cron',
    'VhYZCXeMg7PyDHCQ': 'shirankedo 週次Cron',
    '0PSOcLu8sEC0Tqdh': 'Google Drive - Download',
    '17S2wXRFXrbJhjAY': 'Google Drive - Info',
    'HTACtJzFhDDHBrxO': 'Google Drive - Delete',
    'k4xdXUWPDExWYflR': 'Google Drive - Share',
    'nPtIUfy3eRC7fEfP': 'Google Drive - Rename',
    'owtleGxULdMzYtL2': 'Google Drive - Move',
    'pbIjsYaZDTPrjEqq': 'Google Drive - Search',
    'r3wJRXG0qggIu4PM': 'Google Drive - Upload',
    'u4CCn8cD1WEPqRJL': 'Google Drive - Mkdir',
    'xUEes8CKUMYTBPHN': 'Google Drive - List',
  };
  const errorData = $input.first().json;
  const execution = errorData.execution || {};
  const error = execution.error || {};
  const execUrl = execution.url || '';
  const lastNode = execution.lastNodeExecuted || 'unknown';
  const errorDetail = (error.description || error.message || 'unknown').substring(0, 200);
  let wfName = 'unknown';
  const match = execUrl.match(/\/workflow\/([^\/]+)\//);
  if (match) wfName = WF_MAP[match[1]] || match[1];
  return [{ json: { embed: {
    title: 'n8nエラー発生',
    color: 15158332,
    fields: [
      { name: 'ワークフロー', value: wfName, inline: true },
      { name: 'ノード', value: lastNode, inline: true },
      { name: 'エラー内容', value: errorDetail }
    ]
  }}}];
}
