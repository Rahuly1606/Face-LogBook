// Support for file uploads in serverless functions
// Based on middleware solutions from Vercel documentation

import formidable from 'formidable';
import { createReadStream } from 'fs';
import { Readable } from 'stream';

export const config = {
    api: {
        bodyParser: false,
    },
};

export default async function parseMultipartForm(req) {
    return new Promise((resolve, reject) => {
        const form = new formidable.IncomingForm({
            keepExtensions: true,
            maxFileSize: 10 * 1024 * 1024, // 10MB
        });

        form.parse(req, async (err, fields, files) => {
            if (err) {
                return reject(err);
            }

            // Convert files to format that can be sent to the backend
            const processedFiles = {};

            for (const key in files) {
                const file = files[key];

                // Create a readable stream from the file
                const fileStream = createReadStream(file.filepath);
                const chunks = [];

                for await (const chunk of fileStream) {
                    chunks.push(chunk);
                }

                // Combine chunks into a single buffer
                const fileData = Buffer.concat(chunks);

                processedFiles[key] = {
                    name: file.originalFilename,
                    data: fileData,
                    mimetype: file.mimetype,
                    size: file.size,
                };
            }

            resolve({
                fields,
                files: processedFiles,
            });
        });
    });
}