export const resizeImage = (base64Str: string, maxWidth: number = 1280): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => resolve(base64Str);
  });
};

export const mergeImages = async (
  before: string, 
  after: string, 
  durationMinutes: number
): Promise<string> => {
  try {
    const [imgBefore, imgAfter] = await Promise.all([
      loadImage(before),
      loadImage(after)
    ]);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const isBeforeLandscape = imgBefore.width > imgBefore.height;

    if (isBeforeLandscape) {
      // 1. 가로형 -> 상하(Vertical) 배치
      const targetWidth = 1080;
      const scaledBeforeHeight = imgBefore.height * (targetWidth / imgBefore.width);
      const scaledAfterHeight = imgAfter.height * (targetWidth / imgAfter.width);

      canvas.width = targetWidth;
      canvas.height = scaledBeforeHeight + scaledAfterHeight;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(imgBefore, 0, 0, targetWidth, scaledBeforeHeight);
      ctx.drawImage(imgAfter, 0, scaledBeforeHeight, targetWidth, scaledAfterHeight);
    } else {
      // 2. 세로형 -> 좌우(Side-by-Side) 배치
      const targetHeight = 1080;
      const scaledBeforeWidth = imgBefore.width * (targetHeight / imgBefore.height);
      const scaledAfterWidth = imgAfter.width * (targetHeight / imgAfter.height);

      canvas.width = scaledBeforeWidth + scaledAfterWidth;
      canvas.height = targetHeight;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(imgBefore, 0, 0, scaledBeforeWidth, targetHeight);
      ctx.drawImage(imgAfter, scaledBeforeWidth, 0, scaledAfterWidth, targetHeight);
    }

    // --- 정보 바 (오버레이) ---
    const fontSize = Math.round(Math.max(canvas.width, canvas.height) * 0.035);
    const now = new Date();
    const dateStr = now.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\./g, '/').replace(/ /g, '');
    const footerText = `${dateStr} | ${durationMinutes}분 소요 | 요래됐슴당 ✨`;

    ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    const textMetrics = ctx.measureText(footerText);
    const textWidth = textMetrics.width;
    
    const paddingH = fontSize * 1.5;
    const paddingV = fontSize * 0.8;
    const margin = fontSize;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    const boxWidth = textWidth + paddingH * 2;
    const boxHeight = fontSize + paddingV * 2;
    const boxX = (canvas.width - boxWidth) / 2;
    const boxY = canvas.height - boxHeight - margin;

    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxWidth, boxHeight, boxHeight / 2);
      ctx.fill();
    } else {
      ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(footerText, boxX + boxWidth / 2, boxY + boxHeight / 2 + 1);

    return canvas.toDataURL('image/jpeg', 0.9);
  } catch (error) {
    console.error("Merge failed:", error);
    return '';
  }
};

const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};