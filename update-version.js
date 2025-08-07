const fs = require('fs');
const path = require('path');

// Функція для оновлення версії в HTML файлі
function updateVersion() {
    const timestamp = Date.now();
    const version = `v=${timestamp}`;
    
    // Читаємо HTML файл
    let htmlContent = fs.readFileSync('index.html', 'utf8');
    
    // Оновлюємо версії для CSS та JS файлів
    htmlContent = htmlContent.replace(/style\.css\?v=[^"]*/g, `style.css?${version}`);
    htmlContent = htmlContent.replace(/edge-tts\.js\?v=[^"]*/g, `edge-tts.js?${version}`);
    htmlContent = htmlContent.replace(/main\.js\?v=[^"]*/g, `main.js?${version}`);
    
    // Записуємо оновлений HTML
    fs.writeFileSync('index.html', htmlContent);
    
    console.log(`✅ Версії оновлено: ${version}`);
}

// Запускаємо оновлення
updateVersion();
