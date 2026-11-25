/**
 * Utilitário de normalização de URLs de imagem.
 * Garante que nenhuma imagem utilize o domínio antigo 'jaws.app.br',
 * substituindo-o sempre por 'b3.seg.br'.
 */
export function sanitizeImageUrl(url: string | undefined | null): string {
  if (!url || typeof url !== 'string') return '';
  return url.replace(/jaws\.app\.br/gi, 'b3.seg.br');
}

/**
 * Sanitiza recursivamente strings ou objetos que contenham URLs de imagem.
 */
export function sanitizeImageDeep<T>(val: T): T {
  if (!val) return val;
  if (typeof val === 'string') {
    return sanitizeImageUrl(val) as unknown as T;
  }
  if (Array.isArray(val)) {
    return val.map(item => sanitizeImageDeep(item)) as unknown as T;
  }
  if (typeof val === 'object') {
    const res: any = {};
    for (const [k, v] of Object.entries(val)) {
      res[k] = sanitizeImageDeep(v);
    }
    return res as T;
  }
  return val;
}
