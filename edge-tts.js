class EdgeTTS {
    constructor() {
        this.socket = null;
        this.audioData = [];
        this.isConnected = false;
        this.onStatusChange = null;
        this.dataSeparator = new TextEncoder().encode("Path:audio\r\n");
    }

    // Генерація UUID для з'єднання
    generateConnectionId() {
        const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = (Math.random() * 16) | 0;
            const v = c == 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
        return uuid.replace(/-/g, '');
    }

    // Отримання поточної дати у правильному форматі
    getCurrentTimestamp() {
        const date = new Date();
        const options = {
            weekday: 'short',
            month: 'short',
            day: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short',
        };
        const dateString = date.toLocaleString('en-US', options);
        return dateString.replace(/\u200E/g, '') + ' GMT+0000 (Coordinated Universal Time)';
    }

    // Створення SSML розмітки
    createSSML(text, voice, pitch = "+0Hz", rate = "+0%") {
        const voiceName = `Microsoft Server Speech Text to Speech Voice (${voice})`;
        return `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>` +
               `<voice name='${voiceName}'>` +
               `<prosody pitch='${pitch}' rate='${rate}' volume='+0%'>` +
               `${text}` +
               `</prosody></voice></speak>`;
    }

    // Створення заголовків для SSML
    createSSMLHeaders(requestId, timestamp, ssml) {
        return `X-RequestId:${requestId}\r\n` +
               `Content-Type:application/ssml+xml\r\n` +
               `X-Timestamp:${timestamp}Z\r\n` +
               `Path:ssml\r\n\r\n` +
               ssml;
    }

    // Пошук індексу байтового роздільника
    findSeparatorIndex(uint8Array, separator) {
        for (let i = 0; i < uint8Array.length - separator.length + 1; i++) {
            let found = true;
            for (let j = 0; j < separator.length; j++) {
                if (uint8Array[i + j] !== separator[j]) {
                    found = false;
                    break;
                }
            }
            if (found) {
                return i;
            }
        }
        return -1;
    }

    // Обробка отриманих аудіо даних
    async processAudioData() {
        console.log('🔧 Початок обробки аудіо даних...');
        console.log('📊 Кількість аудіо блоків:', this.audioData.length);
        
        const totalSize = this.audioData.reduce((total, blob) => total + blob.size, 0);
        console.log('📏 Загальний розмір аудіо даних:', totalSize, 'байт');
        
        const combinedArray = new Uint8Array(totalSize);
        
        let offset = 0;
        let processedBlocks = 0;
        
        for (const blob of this.audioData) {
            const arrayBuffer = await blob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            
            // Знаходимо роздільник та витягуємо аудіо дані
            const separatorIndex = this.findSeparatorIndex(uint8Array, this.dataSeparator);
            if (separatorIndex !== -1) {
                const audioStart = separatorIndex + this.dataSeparator.length;
                const audioBytes = uint8Array.slice(audioStart);
                combinedArray.set(audioBytes, offset);
                offset += audioBytes.length;
                processedBlocks++;
                console.log(`✅ Оброблено блок ${processedBlocks}, розмір аудіо:`, audioBytes.length, 'байт');
            } else {
                console.warn('⚠️ Не знайдено роздільник в аудіо блоці');
            }
        }

        // Обрізаємо масив до фактичного розміру
        const finalArray = combinedArray.slice(0, offset);
        console.log('🎯 Фінальний розмір аудіо:', finalArray.length, 'байт');
        
        return new Blob([finalArray], { type: 'audio/mpeg' });
    }

    // Генерація аудіо з тексту
    async generateAudio(text, voice, pitch = "+0Hz", rate = "+0%") {
        return new Promise((resolve, reject) => {
            console.log('🎯 Початок генерації аудіо...');
            console.log('📊 Статистика тексту:', {
                довжина: text.length,
                символів: text.length,
                слів: text.split(/\s+/).filter(word => word.length > 0).length,
                рядків: text.split('\n').length
            });
            
            if (!text.trim()) {
                console.error('❌ Помилка: Текст порожній');
                reject(new Error('Текст не може бути порожнім'));
                return;
            }

            // Перевірка обмежень Edge TTS
            console.log('📋 Обмеження Edge TTS:');
            console.log('   • Максимальна довжина тексту: ~3000 символів');
            console.log('   • Рекомендована довжина: 1000-2000 символів');
            console.log('   • Обмеження WebSocket: ~64KB на повідомлення');
            console.log('   • Таймаут з\'єднання: 30 секунд');
            
            if (text.length > 3000) {
                console.error('❌ Помилка: Текст перевищує ліміт Edge TTS');
                console.error('📏 Поточний розмір:', text.length, 'символів');
                console.error('📏 Максимальний розмір: 3000 символів');
                reject(new Error(`Текст занадто довгий (${text.length} символів). Максимум: 3000 символів`));
                return;
            }
            
            if (text.length > 2000) {
                console.warn('⚠️ Попередження: Великий обсяг тексту', text.length, 'символів');
                console.warn('💡 Рекомендація: Розділіть текст на менші частини');
            }

            this.audioData = [];
            const connectionId = this.generateConnectionId();
            const timestamp = this.getCurrentTimestamp();
            
            console.log('🔗 Параметри з\'єднання:', {
                connectionId: connectionId,
                voice: voice,
                pitch: pitch,
                rate: rate
            });

            // Створення WebSocket з'єднання
            const wsUrl = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4&ConnectionId=${connectionId}`;
            
            this.socket = new WebSocket(wsUrl);

            this.socket.onopen = () => {
                console.log('✅ WebSocket з\'єднання встановлено');
                this.isConnected = true;
                if (this.onStatusChange) {
                    this.onStatusChange('Підключено до сервісу...');
                }

                // Відправка конфігурації
                const configMessage = `X-Timestamp:${timestamp}\r\n` +
                    `Content-Type:application/json; charset=utf-8\r\n` +
                    `Path:speech.config\r\n\r\n` +
                    `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":false,"wordBoundaryEnabled":true},"outputFormat":"audio-24khz-96kbitrate-mono-mp3"}}}}\r\n`;
                
                console.log('📤 Відправка конфігурації...');
                this.socket.send(configMessage);

                // Відправка SSML
                const ssml = this.createSSML(text, voice, pitch, rate);
                const ssmlMessage = this.createSSMLHeaders(connectionId, timestamp, ssml);
                
                console.log('📤 Відправка SSML...');
                console.log('📝 SSML розмір:', ssmlMessage.length, 'байт');
                this.socket.send(ssmlMessage);

                if (this.onStatusChange) {
                    this.onStatusChange('Генерую аудіо...');
                }
            };

            this.socket.onmessage = async (event) => {
                const data = event.data;
                
                if (typeof data === 'string') {
                    console.log('📨 Отримано текстове повідомлення:', data.substring(0, 100) + '...');
                    
                    if (data.includes('Path:turn.end')) {
                        console.log('🏁 Отримано сигнал завершення генерації');
                        // Завершення генерації
                        try {
                            console.log('🔧 Обробка аудіо даних...');
                            const audioBlob = await this.processAudioData();
                            console.log('✅ Аудіо успішно згенеровано, розмір:', audioBlob.size, 'байт');
                            
                            if (this.onStatusChange) {
                                this.onStatusChange('Аудіо згенеровано успішно!');
                            }
                            resolve(audioBlob);
                        } catch (error) {
                            console.error('❌ Помилка обробки аудіо:', error);
                            reject(error);
                        }
                        this.socket.close();
                    }
                } else if (data instanceof Blob) {
                    // Збираємо аудіо дані
                    console.log('🎵 Отримано аудіо блок, розмір:', data.size, 'байт');
                    this.audioData.push(data);
                }
            };

            this.socket.onerror = (error) => {
                console.error('❌ WebSocket помилка:', error);
                if (this.onStatusChange) {
                    this.onStatusChange('Помилка підключення');
                }
                reject(new Error('Помилка WebSocket з\'єднання'));
            };

            this.socket.onclose = (event) => {
                console.log('🔌 WebSocket з\'єднання закрито:', {
                    code: event.code,
                    reason: event.reason,
                    wasClean: event.wasClean
                });
                this.isConnected = false;
            };
        });
    }

    // Завантаження аудіо файлу
    downloadAudio(audioBlob, filename = 'audio.mp3') {
        const url = URL.createObjectURL(audioBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    // Закриття з'єднання
    disconnect() {
        if (this.socket && this.isConnected) {
            this.socket.close();
        }
    }
}

