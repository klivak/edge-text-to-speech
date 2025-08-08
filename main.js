// Отримання елементів DOM
const textInput = document.getElementById('text-input');
const voicesSelect = document.getElementById('voices');
const filterEnglishCheckbox = document.getElementById('filter-english');
const rateSlider = document.getElementById('rate');
const pitchSlider = document.getElementById('pitch');
const rateDisplay = document.getElementById('rate-display');
const pitchDisplay = document.getElementById('pitch-display');
const generateBtn = document.getElementById('generate-btn');
const randomQuoteBtn = document.getElementById('random-quote');
const clearTextBtn = document.getElementById('clear-text');
const saveSettingsBtn = document.getElementById('save-settings');
const clearSettingsBtn = document.getElementById('clear-settings');
const etaDiv = document.getElementById('eta');
const statusDiv = document.getElementById('status');
const charCount = document.getElementById('char-count');
// Блокування автозбереження після очищення налаштувань
let skipSaveSettings = false;

// Створення екземплярів
const tts = new EdgeTTS();
const textProcessor = new TextProcessor(2000, 800);

// Функція оновлення статусу
function updateStatus(message, type = '') {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    console.log(`📱 UI Статус [${type}]: ${message}`);
}

// Оцінка часу (ETA)
function estimateEta(charCount, partsCount = 1) {
    // Евристика: ~35-60 символів/сек залежно від швидкості мережі і відповіді сервера
    // Візьмемо середнє 45 симв/сек, плюс накладні 1.2 сек на частину
    const charsPerSecond = 45;
    const baseOverheadSec = 1.2;
    const seconds = Math.ceil(charCount / charsPerSecond + partsCount * baseOverheadSec);
    const minutes = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return minutes > 0 ? `${minutes} хв ${sec} с` : `${sec} с`;
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

        // Показати орієнтовний час
        const totalChars = text.length;
        const eta = estimateEta(totalChars, textChunks.length);
        etaDiv.textContent = `Орієнтовний час озвучки: ${eta}`;
        
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
                // Оновлювати ETA по ходу
                const doneChars = textChunks.slice(0, i).reduce((n, s) => n + s.length, 0);
                const remaining = totalChars - doneChars;
                etaDiv.textContent = `Орієнтовний час озвучки: ${estimateEta(remaining, textChunks.length - i)}`;
                
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
        // Очистити ETA після завершення
        // Залишимо останню оцінку ще на екрані; можна очистити при потребі
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
function saveSettings(ignoreSkip = false) {
    if (skipSaveSettings && !ignoreSkip) {
        console.log('⏭️ Пропущено автозбереження (skipSaveSettings=true)');
        return;
    }
    const settings = {
        voice: voicesSelect.value,
        rate: rateSlider.value,
        pitch: pitchSlider.value,
        text: textInput.value,
        filterEnglish: !!(filterEnglishCheckbox && filterEnglishCheckbox.checked)
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
            
            if (settings.voice) {
                // Якщо фільтр English застосовано — тимчасово знімемо, щоб опція існувала
                let restoreFilter = false;
                if (filterEnglishCheckbox && filterEnglishCheckbox.checked && !settings.voice.startsWith('en-')) {
                    restoreFilter = true;
                    applyEnglishFilter(false);
                }
                voicesSelect.value = settings.voice;
                if (restoreFilter) {
                    applyEnglishFilter(true);
                }
            }
            if (settings.rate !== undefined) {
                rateSlider.value = settings.rate;
                rateDisplay.textContent = formatSliderValue(settings.rate, '%');
            }
            if (settings.pitch !== undefined) {
                pitchSlider.value = settings.pitch;
                pitchDisplay.textContent = formatSliderValue(settings.pitch, 'Hz');
            }
            if (settings.text) textInput.value = settings.text;

            if (filterEnglishCheckbox && typeof settings.filterEnglish === 'boolean') {
                filterEnglishCheckbox.checked = settings.filterEnglish;
            }
        }
    } catch (error) {
        console.error('Помилка завантаження налаштувань:', error);
    }
}

// Автоматичне збереження налаштувань
voicesSelect.addEventListener('change', saveSettings);
rateSlider.addEventListener('change', saveSettings);
pitchSlider.addEventListener('change', saveSettings);
// Зберігати і під час руху повзунків
rateSlider.addEventListener('input', saveSettings);
pitchSlider.addEventListener('input', saveSettings);
textInput.addEventListener('input', debounce(saveSettings, 1000));

// --- Сортування списку голосів за абеткою ---
function sortVoicesOptions() {
    const currentValue = voicesSelect.value;
    const options = Array.from(voicesSelect.options);
    options.sort((a, b) => {
        const aIsRu = a.value.trim().toLowerCase().startsWith('ru-');
        const bIsRu = b.value.trim().toLowerCase().startsWith('ru-');
        // RU опції в кінець списку
        if (aIsRu && !bIsRu) return 1;
        if (!aIsRu && bIsRu) return -1;
        // Інакше — алфавітно
        return a.text.localeCompare(b.text, undefined, { sensitivity: 'base' });
    });
    voicesSelect.innerHTML = '';
    for (const opt of options) voicesSelect.appendChild(opt);
    // Відновити попередній вибір, якщо є
    const hasPrev = options.some(o => o.value === currentValue);
    if (hasPrev) voicesSelect.value = currentValue;
}

// --- Фільтр лише English ---
function applyEnglishFilter(checked) {
    const desiredPrefix = 'en-';
    for (const option of Array.from(voicesSelect.options)) {
        const isEnglish = option.value.trim().startsWith(desiredPrefix);
        option.hidden = checked ? !isEnglish : false;
    }

    // Якщо обраний голос не English або став прихованим — обрати перший видимий (перший English)
    const selectedOption = voicesSelect.selectedOptions[0];
    const isSelectedVisible = selectedOption && !selectedOption.hidden;
    const isSelectedEnglish = voicesSelect.value.trim().startsWith(desiredPrefix);
    if (checked && (!isSelectedVisible || !isSelectedEnglish)) {
        const firstVisible = Array.from(voicesSelect.options).find(o => !o.hidden);
        if (firstVisible) voicesSelect.value = firstVisible.value;
    }

    saveSettings();
}

if (filterEnglishCheckbox) {
    filterEnglishCheckbox.addEventListener('change', (e) => {
        applyEnglishFilter(e.target.checked);
    });
}

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
    // Сортування списку голосів після завантаження налаштувань
    sortVoicesOptions();
    // За замовчуванням вмикаємо фільтр English, якщо налаштування ще не збережені
    if (filterEnglishCheckbox) {
        if (localStorage.getItem('edgeTTSSettings') === null) {
            filterEnglishCheckbox.checked = true;
        }
        applyEnglishFilter(filterEnglishCheckbox.checked);
    }
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
    if (!skipSaveSettings) {
        saveSettings();
    } else {
        console.log('⏭️ Пропущено збереження перед виходом (skipSaveSettings=true)');
    }
    tts.disconnect();
});

// --- Випадкова цитата ---
const QUOTES = [
    'Слова — це, звісно, наймогутніша зброя людства. — Кіплінг',
    'Вперед і вгору — ось наш шлях. — Г. Сковорода',
    'Дорогу осилит идущий. — Сенека',
    'The only limit to our realization of tomorrow is our doubts of today. — F. D. Roosevelt',
    'Simplicity is the soul of efficiency. — Austin Freeman',
    'Talk is cheap. Show me the code. — Linus Torvalds',
    'Stay hungry. Stay foolish. — Steve Jobs',
    'Make it work, make it right, make it fast. — Kent Beck'
];

function insertRandomQuote() {
    const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    // Якщо в textarea вже є текст — додамо з нового рядка
    textInput.value = textInput.value ? (textInput.value.trimEnd() + '\n' + quote) : quote;
    updateCharCount();
    saveSettings();
}

if (randomQuoteBtn) {
    randomQuoteBtn.addEventListener('click', insertRandomQuote);
}

function clearText() {
    textInput.value = '';
    updateCharCount();
    if (etaDiv) etaDiv.textContent = '';
    saveSettings();
}

if (clearTextBtn) {
    clearTextBtn.addEventListener('click', clearText);
}

function clearAllSettings() {
    try {
        localStorage.removeItem('edgeTTSSettings');
        skipSaveSettings = true;
        updateStatus('Налаштування очищено', 'success');
        // Скинути UI
        rateSlider.value = '0';
        pitchSlider.value = '0';
        rateDisplay.textContent = formatSliderValue(rateSlider.value, '%');
        pitchDisplay.textContent = formatSliderValue(pitchSlider.value, 'Hz');
        // Пересортувати голоси (RU в кінець) і перевстановити фільтр English
        sortVoicesOptions();
        if (filterEnglishCheckbox) {
            // Залишити стан галочки як є, але застосувати фільтр до списку
            applyEnglishFilter(filterEnglishCheckbox.checked);
        }
    } catch (e) {
        console.error('Не вдалося очистити налаштування', e);
        updateStatus('Помилка очищення налаштувань', 'error');
    }
}

if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', () => {
        // Дозволяємо зберегти вручну навіть якщо був режим skip
        saveSettings(true);
        // Після явного збереження надалі можна знову автозберігати
        skipSaveSettings = false;
        updateStatus('Налаштування збережено', 'success');
    });
}

if (clearSettingsBtn) {
    clearSettingsBtn.addEventListener('click', clearAllSettings);
}
