class MangaTranslator {
    constructor() {
        this.originalImage = null;
        this.translatedImage = null;
        this.worker = null;
        this.textRegions = [];
        this.isTesseractReady = false;
        
        this.initializeElements();
        this.initializeTesseract();
    }

    initializeElements() {
        this.imageInput = document.getElementById('imageInput');
        this.translateBtn = document.getElementById('translateBtn');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.originalCanvas = document.getElementById('originalCanvas');
        this.translatedCanvas = document.getElementById('translatedCanvas');
        this.debugOutput = document.getElementById('debugOutput');

        this.imageInput.addEventListener('change', (e) => this.handleImageUpload(e));
        this.translateBtn.addEventListener('click', () => this.translateImage());
        this.downloadBtn.addEventListener('click', () => this.downloadImage());
    }

    async initializeTesseract() {
        try {
            this.log('🚀 Đang khởi tạo Tesseract OCR...');
            
            // Cách khởi tạo mới cho Tesseract.js v4
            const { createWorker } = Tesseract;
            this.worker = createWorker({
                logger: progress => {
                    if (progress.status === 'recognizing text') {
                        this.log(`OCR: ${Math.round(progress.progress * 100)}%`);
                    }
                }
            });

            await this.worker.load();
            await this.worker.loadLanguage('eng');
            await this.worker.initialize('eng');
            
            // Cấu hình cho text manga
            await this.worker.setParameters({
                tessedit_pageseg_mode: '7', // PSM_SINGLE_LINE
                tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,!?-()[]\'\"/',
            });

            this.isTesseractReady = true;
            this.log('✅ Tesseract đã sẵn sàng');
        } catch (error) {
            this.log(`❌ Lỗi khởi tạo Tesseract: ${error.message}`);
            this.isTesseractReady = false;
        }
    }

    log(message) {
        const timestamp = new Date().toLocaleTimeString();
        this.debugOutput.textContent += `[${timestamp}] ${message}\n`;
        this.debugOutput.scrollTop = this.debugOutput.scrollHeight;
        console.log(message);
    }

    handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            this.originalImage = new Image();
            this.originalImage.onload = () => {
                this.displayImage(this.originalImage, this.originalCanvas);
                this.translateBtn.disabled = false;
                this.log(`✅ Đã tải ảnh: ${file.name} (${this.originalImage.width}x${this.originalImage.height})`);
            };
            this.originalImage.onerror = () => {
                this.log('❌ Lỗi tải ảnh');
            };
            this.originalImage.src = e.target.result;
        };
        reader.onerror = () => {
            this.log('❌ Lỗi đọc file');
        };
        reader.readAsDataURL(file);
    }

    displayImage(img, canvas) {
        const ctx = canvas.getContext('2d');
        // Giới hạn kích thước hiển thị
        const maxWidth = 600;
        const scale = Math.min(1, maxWidth / img.width);
        
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }

    async translateImage() {
        if (!this.originalImage) {
            this.log('❌ Chưa có ảnh để dịch');
            return;
        }

        if (!this.isTesseractReady) {
            this.log('❌ Tesseract chưa sẵn sàng');
            return;
        }

        this.translateBtn.disabled = true;
        this.log('🎯 Bắt đầu dịch...');

        try {
            // Bước 1: Nhận diện text với Tesseract
            this.log('🔍 Đang nhận diện text...');
            
            const result = await this.worker.recognize(this.originalImage);
            this.log(`📊 Kết quả OCR: ${JSON.stringify(result.data).substring(0, 200)}...`);
            
            if (result && result.data && result.data.words) {
                this.textRegions = result.data.words.filter(word => 
                    word.confidence > 30 && word.text && word.text.trim().length > 0
                );
                this.log(`📝 Tìm thấy ${this.textRegions.length} vùng text`);

                // Hiển thị các text tìm thấy
                this.textRegions.forEach((region, index) => {
                    this.log(`📖 [${index + 1}] "${region.text}" (độ tin cậy: ${region.confidence}%)`);
                });

                // Bước 2: Tạo ảnh đã dịch
                await this.createTranslatedImage();

                this.downloadBtn.disabled = false;
                this.log('✅ Hoàn thành dịch!');
            } else {
                this.log('❌ Không tìm thấy text trong ảnh');
                // Thử phương pháp fallback
                await this.fallbackTranslation();
            }

        } catch (error) {
            this.log(`❌ Lỗi dịch ảnh: ${error.message}`);
            console.error('Chi tiết lỗi:', error);
            // Thử phương pháp fallback
            await this.fallbackTranslation();
        } finally {
            this.translateBtn.disabled = false;
        }
    }

    async fallbackTranslation() {
        this.log('🔄 Sử dụng phương pháp fallback...');
        
        try {
            // Tạo canvas từ ảnh gốc
            const canvas = this.translatedCanvas;
            const ctx = canvas.getContext('2d');
            
            canvas.width = this.originalImage.width;
            canvas.height = this.originalImage.height;
            ctx.drawImage(this.originalImage, 0, 0);
            
            // Thêm thông báo
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fillRect(50, 50, canvas.width - 100, 100);
            
            ctx.fillStyle = 'red';
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Không thể nhận diện text', canvas.width / 2, 100);
            ctx.fillText('Vui lòng thử ảnh khác', canvas.width / 2, 130);
            
            this.downloadBtn.disabled = false;
            this.log('✅ Đã tạo ảnh fallback');
        } catch (error) {
            this.log(`❌ Lỗi fallback: ${error.message}`);
        }
    }

    async createTranslatedImage() {
        const canvas = this.translatedCanvas;
        const ctx = canvas.getContext('2d');
        
        // Copy ảnh gốc
        canvas.width = this.originalImage.width;
        canvas.height = this.originalImage.height;
        ctx.drawImage(this.originalImage, 0, 0);

        // Xử lý từng vùng text
        let translatedCount = 0;
        
        for (const region of this.textRegions) {
            try {
                const success = await this.processTextRegion(ctx, region);
                if (success) translatedCount++;
                
                // Nghỉ giữa các lần dịch để tránh rate limit
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                this.log(`⚠️ Lỗi xử lý vùng text: ${error.message}`);
            }
        }
        
        this.log(`✅ Đã dịch ${translatedCount}/${this.textRegions.length} vùng text`);
    }

    async processTextRegion(ctx, region) {
        const { text, bbox } = region;
        
        if (!text || !bbox) return false;

        const { x0, y0, x1, y1 } = bbox;
        const cleanText = text.trim();
        
        if (cleanText.length < 1) return false;

        this.log(`📝 Đang dịch: "${cleanText}"`);

        // Dịch text
        const translatedText = await this.translateText(cleanText);
        
        if (!translatedText || translatedText === cleanText) {
            this.log(`⚠️ Không dịch được: "${cleanText}"`);
            return false;
        }

        this.log(`🌐 → "${translatedText}"`);

        // Tính toán kích thước box
        const padding = 10;
        const boxX = Math.max(0, x0 - padding);
        const boxY = Math.max(0, y0 - padding);
        const boxWidth = Math.min(ctx.canvas.width - boxX, (x1 - x0) + padding * 2);
        const boxHeight = Math.min(ctx.canvas.height - boxY, (y1 - y0) + padding * 2);

        // Vẽ nền trắng
        ctx.fillStyle = 'white';
        ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

        // Vẽ viền
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

        // Tìm font size phù hợp
        const fontSize = this.findOptimalFontSize(ctx, translatedText, boxWidth - 10, boxHeight - 10);
        ctx.font = `${fontSize}px Arial`;
        ctx.fillStyle = 'black';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';

        // Vẽ text đã dịch
        const textX = boxX + boxWidth / 2;
        const textY = boxY + boxHeight / 2;
        ctx.fillText(translatedText, textX, textY);

        return true;
    }

    findOptimalFontSize(ctx, text, maxWidth, maxHeight) {
        let fontSize = 20;
        ctx.font = `${fontSize}px Arial`;
        let textWidth = ctx.measureText(text).width;
        
        while ((textWidth > maxWidth || fontSize > maxHeight) && fontSize > 8) {
            fontSize--;
            ctx.font = `${fontSize}px Arial`;
            textWidth = ctx.measureText(text).width;
        }
        
        return fontSize;
    }

    async translateText(text) {
        // Từ điển dịch mẫu cho manga
        const dictionary = {
            'actually': 'thực ra',
            'interested': 'quan tâm',
            'novelist': 'nhà văn',
            'happy': 'hạnh phúc',
            'seriously': 'nghiêm túc',
            'pretty': 'khá',
            'nice': 'tốt',
            'period': 'tiết học',
            'bell': 'chuông',
            'confess': 'tỏ tình',
            'might': 'có lẽ',
            'wanted': 'muốn',
            'novelist': 'tiểu thuyết gia',
            'hell': 'quỷ',
            'first': 'đầu tiên',
            'always': 'luôn luôn',
            'turn': 'lượt',
            'ding': 'ting'
        };

        // Tìm các từ trong từ điển
        const words = text.toLowerCase().split(/\s+/);
        const translatedWords = words.map(word => {
            // Xóa ký tự đặc biệt
            const cleanWord = word.replace(/[^a-zA-Z]/g, '');
            return dictionary[cleanWord] || word;
        });

        return translatedWords.join(' ');
    }

    downloadImage() {
        try {
            const link = document.createElement('a');
            link.download = `translated-${Date.now()}.png`;
            link.href = this.translatedCanvas.toDataURL('image/png');
            link.click();
            this.log('💾 Đã tải ảnh xuống');
        } catch (error) {
            this.log(`❌ Lỗi tải ảnh: ${error.message}`);
        }
    }
}

// Khởi chạy ứng dụng
document.addEventListener('DOMContentLoaded', () => {
    new MangaTranslator();
});