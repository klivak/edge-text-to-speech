class TextProcessor {
    constructor(maxChunkSize = 2000, minChunkSize = 800) {
        this.maxChunkSize = maxChunkSize;
        this.minChunkSize = minChunkSize;
        this.chunks = [];
    }

    // Розділення великого тексту на частини
    processText(text) {
        console.log('📝 Початок обробки тексту...');
        console.log('📏 Розмір тексту:', text.length, 'символів');
        
        // Очищення тексту
        let cleanText = this.cleanText(text);
        
        // Розбиття на речення
        let sentences = this.splitIntoSentences(cleanText);
        
        // Створення частин оптимального розміру
        this.chunks = this.createChunks(sentences);
        
        console.log('✅ Текст розділено на', this.chunks.length, 'частин');
        this.chunks.forEach((chunk, index) => {
            console.log(`   Частина ${index + 1}: ${chunk.length} символів`);
        });
        
        return this.chunks;
    }

    // Очищення тексту
    cleanText(text) {
        let clean = text
            .replace(/[~\|\*\^]/g, "-")
            .replace(/\\/g, "/")
            .replace(/&/g, " and ")
            .replace(/</g, "(")
            .replace(/>/g, ")")
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n");
        
        return clean;
    }

    // Розбиття на речення
    splitIntoSentences(text) {
        // Розбиваємо по знаках завершення речення
        const sentences = text.split(/(?<=[.!?])\s+/);
        return sentences.filter(sentence => sentence.trim().length > 0);
    }

    // Створення частин оптимального розміру
    createChunks(sentences) {
        const chunks = [];
        let currentChunk = "";

        for (const sentence of sentences) {
            const sentenceWithSpace = sentence + " ";
            
            // Якщо поточна частина + речення перевищує ліміт
            if ((currentChunk + sentenceWithSpace).length > this.maxChunkSize && currentChunk.length > 0) {
                // Зберігаємо поточну частину
                chunks.push(currentChunk.trim());
                currentChunk = sentenceWithSpace;
            } else {
                // Додаємо речення до поточної частини
                currentChunk += sentenceWithSpace;
            }
        }

        // Додаємо останню частину
        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }

        // Якщо частини занадто малі, об'єднуємо їх
        return this.mergeSmallChunks(chunks);
    }

    // Об'єднання малих частин
    mergeSmallChunks(chunks) {
        const mergedChunks = [];
        let currentChunk = "";

        for (const chunk of chunks) {
            if ((currentChunk + " " + chunk).length <= this.maxChunkSize) {
                currentChunk += (currentChunk ? " " : "") + chunk;
            } else {
                if (currentChunk) {
                    mergedChunks.push(currentChunk);
                }
                currentChunk = chunk;
            }
        }

        if (currentChunk) {
            mergedChunks.push(currentChunk);
        }

        return mergedChunks;
    }

    // Отримання статистики
    getStats() {
        return {
            totalChunks: this.chunks.length,
            totalCharacters: this.chunks.reduce((sum, chunk) => sum + chunk.length, 0),
            averageChunkSize: Math.round(this.chunks.reduce((sum, chunk) => sum + chunk.length, 0) / this.chunks.length),
            minChunkSize: Math.min(...this.chunks.map(chunk => chunk.length)),
            maxChunkSize: Math.max(...this.chunks.map(chunk => chunk.length))
        };
    }

    // Отримання частини за індексом
    getChunk(index) {
        return this.chunks[index] || null;
    }

    // Отримання всіх частин
    getAllChunks() {
        return [...this.chunks];
    }
}
