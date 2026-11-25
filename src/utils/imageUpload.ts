const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
]);

const MAX_RAW_FILE_BYTES = 12 * 1024 * 1024; // 12 MB antes da compressão
const MAX_DIMENSION_PX = 1000;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Não foi possível ler o arquivo de imagem.'));
      }
    };
    reader.onerror = () => reject(new Error('Erro ao ler o arquivo selecionado.'));
    reader.readAsDataURL(file);
  });
}

function compressImageDataUrl(dataUrl: string, mimeType: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Preserve animated GIFs directly if already small enough
    if (mimeType === 'image/gif') {
      resolve(dataUrl);
      return;
    }

    const img = new Image();
    img.onload = () => {
      try {
        let { width, height } = img;
        if (width > MAX_DIMENSION_PX || height > MAX_DIMENSION_PX) {
          const ratio = Math.min(MAX_DIMENSION_PX / width, MAX_DIMENSION_PX / height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Keep PNG/WebP transparency when uploading PNG or WebP; use JPEG for photos
        const targetMime = mimeType === 'image/png' ? 'image/webp' : (mimeType === 'image/webp' ? 'image/webp' : 'image/jpeg');
        let compressed = canvas.toDataURL(targetMime, 0.85);

        // Fallback if browser doesn't encode webp (returns image/png)
        if (targetMime === 'image/webp' && !compressed.startsWith('data:image/webp')) {
          compressed = canvas.toDataURL('image/png');
        }

        resolve(compressed);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('O arquivo selecionado não é uma imagem válida.'));
    img.src = dataUrl;
  });
}

/**
 * Lê, valida, otimiza e envia uma imagem do computador para o servidor,
 * retornando a URL curta persistida no banco (/api/images/...).
 */
export async function uploadImageFromComputer(file: File, role: string = 'admin'): Promise<string> {
  if (!file) {
    throw new Error('Nenhum arquivo selecionado.');
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
    throw new Error('Formato não suportado. Selecione uma imagem JPG, PNG, WEBP ou GIF.');
  }

  if (file.size > MAX_RAW_FILE_BYTES) {
    throw new Error('A imagem é muito grande (máximo 12 MB). Escolha uma imagem menor.');
  }

  const rawDataUrl = await readFileAsDataUrl(file);
  const optimizedDataUrl = await compressImageDataUrl(rawDataUrl, file.type);

  const response = await fetch('/api/upload-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageData: optimizedDataUrl,
      fileName: file.name,
      role
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.url) {
    throw new Error(data?.error || 'Erro ao enviar imagem para o servidor.');
  }

  return data.url as string;
}
