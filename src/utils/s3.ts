import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

const s3 = new S3Client({
    region: process.env.S3_REGION || 'wjv-1',
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY as string,
        secretAccessKey: process.env.S3_SECRET_KEY as string,
    },
});

export const uploadExcelToS3 = async (fileBuffer: Buffer, originalName: string): Promise<string> => {
    const ext = path.extname(originalName);
    const uniqueName = `import-pelamar/${Date.now()}-${uuidv4()}${ext}`;

    const command = new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_UPLOAD as string,
        Key: uniqueName,
        Body: fileBuffer,
        ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        // ACL: 'public-read' // Uncomment jika file ingin bisa diakses publik langsung via URL
    });

    await s3.send(command);
    return uniqueName; // Mengembalikan nama/path file untuk disimpan di log
};