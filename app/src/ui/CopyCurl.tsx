import { Btn } from './controls';
import type { Ctx } from './ctx';

export const API_BASE = 'https://aegis.host360.ai/api/v2';

/** The API call behind what a screen shows or does, as a cURL command with a placeholder token. */
export function curlFor(method: 'GET' | 'POST' | 'DELETE', path: string, query?: Record<string, string | undefined>, body?: Record<string, unknown>) {
  const q = Object.entries(query || {}).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v!)}`).join('&');
  return [`curl -X ${method} '${API_BASE}${path}${q ? '?' + q : ''}'`, `  -H 'Authorization: Bearer $AEGIS_TOKEN'`, ...(body ? [`  -H 'Content-Type: application/json'`, `  -d '${JSON.stringify(body)}'`] : [])].join(' \\\n');
}

/** "Copy as cURL": the same request the screen makes, for scripts and runbooks. The command is in the tooltip. */
export function CopyCurl({ ctx, method = 'GET', path, query, body, size }: { ctx: Ctx; method?: 'GET' | 'POST' | 'DELETE'; path: string; query?: Record<string, string | undefined>; body?: Record<string, unknown>; size?: 'sm' }) {
  const cmd = curlFor(method, path, query, body);
  const copy = () => {
    const p = navigator.clipboard?.writeText(cmd);
    if (!p) return ctx.toast('Copy is blocked here. The command is in the tooltip.', 'warn');
    p.then(() => ctx.toast(`cURL copied: ${method} ${path}`, 'ok'), () => ctx.toast('Copy is blocked here. The command is in the tooltip.', 'warn'));
  };
  return (
    <span data-tip={cmd} style={{ display: 'inline-flex' }}>
      <Btn kind="ghost" size={size} icon="square-terminal" onClick={copy}>
        Copy as cURL
      </Btn>
    </span>
  );
}
