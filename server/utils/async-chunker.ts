/**
 * Og'ir massivlarni Event Loop'ni bloklamasdan qayta ishlash uchun Chunking utilita.
 * Bot orqali ommaviy xabar yuborish yoki Email yuborishda ishlatiladi.
 */
export async function processInChunks<T>(
  items: T[],
  chunkSize: number,
  delayMs: number,
  processor: (item: T) => Promise<void>
): Promise<void> {
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    
    // Chunk ichidagi barcha elementlarni parallel ishlash
    await Promise.all(chunk.map(processor));
    
    // Node.js Event Loop'ga boshqa API so'rovlarni qabul qilish uchun "nafas olishga" ruxsat berish
    if (i + chunkSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}
