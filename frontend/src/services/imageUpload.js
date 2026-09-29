// Re-encode through a canvas before upload: this resizes for mobile bandwidth
// and drops EXIF metadata such as the GPS location where the photo was taken.
export async function prepareImageForUpload(file, maxSize = 1200) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
  if (!blob) throw new Error('Image could not be prepared for upload.');
  return new File([blob], `${crypto.randomUUID()}.jpg`, { type: 'image/jpeg' });
}
