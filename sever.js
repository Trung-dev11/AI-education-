import express from 'express';
import multer from 'multer';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from "@google/generative-ai/server";

dotenv.config();

const app = express();
app.use(cors());
const upload = multer({ dest: 'uploads/' });

// Khởi tạo Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);

app.post('/api/generate-mindmap', upload.single('pdfFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Vui lòng tải lên một file PDF.' });
        }

        const filePath = req.file.path;

        // 1. Upload PDF lên Gemini server để phân tích
        const uploadResult = await fileManager.uploadFile(filePath, {
            mimeType: 'application/pdf',
            displayName: req.file.originalname,
        });

        // 2. Gọi mô hình Gemini 1.5 Pro (giống lõi NotebookLM)
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
        
        const prompt = `
            Hãy đóng vai là một giáo viên chuyên môn. Đọc file bài giảng PDF đính kèm và tổng hợp kiến thức thành một sơ đồ tư duy (mindmap).
            Trả về KẾT QUẢ DUY NHẤT là đoạn code Mermaid.js (không kèm giải thích, không dùng markdown block, chỉ output code thuần).
            Sử dụng cú pháp mindmap của Mermaid. Ví dụ:
            mindmap
              root((Tên bài học))
                Ý chính 1
                  Chi tiết 1.1
                  Chi tiết 1.2
                Ý chính 2
                  Chi tiết 2.1
        `;

        const result = await model.generateContent([
            {
                fileData: {
                    mimeType: uploadResult.file.mimeType,
                    fileUri: uploadResult.file.uri
                }
            },
            { text: prompt },
        ]);

        const mermaidCode = result.response.text().trim().replace(/```mermaid/g, '').replace(/```/g, '');

        // Xóa file tạm ở local
        fs.unlinkSync(filePath);

        res.json({ mindmapCode: mermaidCode });

    } catch (error) {
        console.error('Lỗi:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi trong quá trình phân tích file.' });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
console.log(`Server đang chạy tại http://localhost:${PORT}`);
});