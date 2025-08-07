// Отримання елементів DOM
const textInput = document.getElementById('text-input');
const voicesSelect = document.getElementById('voices');
const rateSlider = document.getElementById('rate');
const pitchSlider = document.getElementById('pitch');
const rateDisplay = document.getElementById('rate-display');
const pitchDisplay = document.getElementById('pitch-display');
const generateBtn = document.getElementById('generate-btn');
const statusDiv = document.getElementById('status');
const charCount = document.getElementById('char-count');

// Створення екземплярів
const tts = new EdgeTTS();
const textProcessor = new TextProcessor(2000, 800);

// Функція оновлення статусу
function updateStatus(message, type = '') {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    console.log(`📱 UI Статус [${type}]: ${message}`);
}

// Функція форматування значень слайдерів
function formatSliderValue(value, unit) {
    const numValue = parseInt(value);
    return numValue >= 0 ? `+${numValue}${unit}` : `${numValue}${unit}`;
}

// Функція оновлення лічильника символів
function updateCharCount() {
    const count = textInput.value.length;
    charCount.textContent = count;
    
    // Логування при зміні кількості символів
    if (count % 100 === 0 && count > 0) {
        console.log(`📊 Лічильник символів: ${count}`);
    }
    
    // Попередження при великих текстах
    if (count > 3000 && count % 500 === 0) {
        console.warn(`⚠️ Великий текст: ${count} символів`);
    }
}

// Обробники подій для слайдерів
rateSlider.addEventListener('input', (e) => {
    const value = formatSliderValue(e.target.value, '%');
    rateDisplay.textContent = value;
    console.log(`🎚️ Швидкість змінено: ${value}`);
});

pitchSlider.addEventListener('input', (e) => {
    const value = formatSliderValue(e.target.value, 'Hz');
    pitchDisplay.textContent = value;
    console.log(`🎚️ Тональність змінено: ${value}`);
});

// Налаштування callback для статусу TTS
tts.onStatusChange = (message) => {
    updateStatus(message, 'processing');
    console.log(`🎵 TTS Статус: ${message}`);
};

// Основна функція генерації аудіо
async function generateAudio() {
    console.log('🚀 Початок генерації аудіо...');
    
    const text = textInput.value.trim();
    const voice = voicesSelect.value;
    const rate = formatSliderValue(rateSlider.value, '%');
    const pitch = formatSliderValue(pitchSlider.value, 'Hz');

    console.log('📋 Параметри генерації:', {
        довжина_тексту: text.length,
        голос: voice,
        швидкість: rate,
        тональність: pitch
    });

    // Перевірка введеного тексту
    if (!text) {
        console.error('❌ Помилка: Текст порожній');
        updateStatus('Будь ласка, введіть текст для озвучування', 'error');
        return;
    }

    // Блокування кнопки під час генерації
    generateBtn.disabled = true;
    generateBtn.textContent = 'Генерую...';
    
    try {
        console.log('⏳ Підготовка до генерації...');
        updateStatus('Підготовка до генерації...', 'processing');
        
        // Обробка тексту (розділення на частини якщо потрібно)
        const textChunks = textProcessor.processText(text);
        const stats = textProcessor.getStats();
        
        console.log('📊 Статистика обробки:', stats);
        
        if (textChunks.length === 1) {
            // Один файл - звичайна генерація
            console.log('🎵 Генерація одного файлу...');
            const audioBlob = await tts.generateAudio(textChunks[0], voice, pitch, rate);
            
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:]/g, '-');
            const voiceName = voice.split(',')[1].trim().replace('Neural', '');
            const filename = `audio_${voiceName}_${timestamp}.mp3`;
            
            tts.downloadAudio(audioBlob, filename);
            updateStatus(`Аудіо файл "${filename}" готовий!`, 'success');
            
        } else {
            // Кілька файлів - генерація по частинах
            console.log(`🎵 Генерація ${textChunks.length} частин...`);
            updateStatus(`Генерую ${textChunks.length} частин...`, 'processing');
            
            const audioBlobs = [];
            
            for (let i = 0; i < textChunks.length; i++) {
                console.log(`📝 Генерація частини ${i + 1}/${textChunks.length}...`);
                updateStatus(`Генерую частину ${i + 1}/${textChunks.length}...`, 'processing');
                
                try {
                    const audioBlob = await tts.generateAudio(textChunks[i], voice, pitch, rate);
                    audioBlobs.push(audioBlob);
                    console.log(`✅ Частина ${i + 1} згенерована, розмір:`, audioBlob.size, 'байт');
                } catch (error) {
                    console.error(`❌ Помилка генерації частини ${i + 1}:`, error);
                    updateStatus(`Помилка частини ${i + 1}: ${error.message}`, 'error');
                    return;
                }
            }
            
            // Об'єднання всіх аудіо файлів
            console.log('🔗 Об\'єднання аудіо файлів...');
            updateStatus('Об\'єднання файлів...', 'processing');
            
            const combinedBlob = await combineAudioBlobs(audioBlobs);
            
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:]/g, '-');
            const voiceName = voice.split(',')[1].trim().replace('Neural', '');
            const filename = `audio_${voiceName}_${timestamp}_combined.mp3`;
            
            tts.downloadAudio(combinedBlob, filename);
            updateStatus(`Об'єднаний аудіо файл "${filename}" готовий!`, 'success');
        }
        
    } catch (error) {
        console.error('❌ Помилка генерації аудіо:', error);
        console.error('📋 Деталі помилки:', {
            повідомлення: error.message,
            стек: error.stack
        });
        updateStatus(`Помилка: ${error.message}`, 'error');
    } finally {
        // Розблокування кнопки
        generateBtn.disabled = false;
        generateBtn.textContent = 'Згенерувати аудіо';
        console.log('🔓 Кнопка розблокована');
    }
}

// Обробник кнопки генерації
generateBtn.addEventListener('click', generateAudio);

// Обробник Enter в текстовому полі (Ctrl+Enter для генерації)
textInput.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        generateAudio();
    }
});

// Збереження налаштувань в localStorage
function saveSettings() {
    const settings = {
        voice: voicesSelect.value,
        rate: rateSlider.value,
        pitch: pitchSlider.value,
        text: textInput.value
    };
    localStorage.setItem('edgeTTSSettings', JSON.stringify(settings));
    console.log('💾 Налаштування збережено:', {
        голос: settings.voice,
        швидкість: settings.rate,
        тональність: settings.pitch,
        розмір_тексту: settings.text.length
    });
}

// Завантаження налаштувань з localStorage
function loadSettings() {
    try {
        const savedSettings = localStorage.getItem('edgeTTSSettings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            
            if (settings.voice) voicesSelect.value = settings.voice;
            if (settings.rate !== undefined) {
                rateSlider.value = settings.rate;
                rateDisplay.textContent = formatSliderValue(settings.rate, '%');
            }
            if (settings.pitch !== undefined) {
                pitchSlider.value = settings.pitch;
                pitchDisplay.textContent = formatSliderValue(settings.pitch, 'Hz');
            }
            if (settings.text) textInput.value = settings.text;
        }
    } catch (error) {
        console.error('Помилка завантаження налаштувань:', error);
    }
}

// Автоматичне збереження налаштувань
voicesSelect.addEventListener('change', saveSettings);
rateSlider.addEventListener('change', saveSettings);
pitchSlider.addEventListener('change', saveSettings);
textInput.addEventListener('input', debounce(saveSettings, 1000));

// Оновлення лічильника символів при введенні тексту
textInput.addEventListener('input', updateCharCount);

// Функція затримки для оптимізації збереження тексту
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Функція розділення великого тексту на частини
function splitLargeText(text, maxLength = 2000) {
    if (text.length <= maxLength) {
        return [text];
    }
    
    console.log('✂️ Розділення великого тексту на частини...');
    console.log('📏 Загальний розмір:', text.length, 'символів');
    console.log('📏 Максимальний розмір частини:', maxLength, 'символів');
    
    const parts = [];
    let currentPart = '';
    const sentences = text.split(/(?<=[.!?])\s+/);
    
    for (const sentence of sentences) {
        if ((currentPart + sentence).length > maxLength && currentPart.length > 0) {
            parts.push(currentPart.trim());
            currentPart = sentence;
        } else {
            currentPart += (currentPart ? ' ' : '') + sentence;
        }
    }
    
    if (currentPart.trim()) {
        parts.push(currentPart.trim());
    }
    
    console.log('📋 Створено частин:', parts.length);
    parts.forEach((part, index) => {
        console.log(`   Частина ${index + 1}: ${part.length} символів`);
    });
    
    return parts;
}

// Функція об'єднання аудіо файлів
async function combineAudioBlobs(audioBlobs) {
    console.log('🔗 Початок об\'єднання аудіо файлів...');
    console.log('📊 Кількість файлів для об\'єднання:', audioBlobs.length);
    
    // Конвертуємо всі Blob в ArrayBuffer
    const arrayBuffers = [];
    let totalSize = 0;
    
    for (let i = 0; i < audioBlobs.length; i++) {
        const arrayBuffer = await audioBlobs[i].arrayBuffer();
        arrayBuffers.push(arrayBuffer);
        totalSize += arrayBuffer.byteLength;
        console.log(`📝 Файл ${i + 1}: ${arrayBuffer.byteLength} байт`);
    }
    
    // Створюємо загальний ArrayBuffer
    const combinedBuffer = new ArrayBuffer(totalSize);
    const combinedView = new Uint8Array(combinedBuffer);
    
    let offset = 0;
    for (const arrayBuffer of arrayBuffers) {
        const view = new Uint8Array(arrayBuffer);
        combinedView.set(view, offset);
        offset += arrayBuffer.byteLength;
    }
    
    console.log('✅ Об\'єднання завершено, загальний розмір:', totalSize, 'байт');
    
    return new Blob([combinedBuffer], { type: 'audio/mpeg' });
}

// Ініціалізація при завантаженні сторінки
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    updateCharCount(); // Ініціалізація лічильника символів
    updateStatus('Готовий до роботи. Введіть текст та натисніть "Згенерувати аудіо"');
    
    // Примусове оновлення при F5 або Ctrl+R
    window.addEventListener('beforeunload', () => {
        if (performance.navigation.type === 1) {
            // Примусове оновлення кешу
            window.location.reload(true);
        }
    });
});

// Очищення ресурсів при закритті сторінки
window.addEventListener('beforeunload', () => {
    saveSettings();
    tts.disconnect();
});
