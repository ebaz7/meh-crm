
import { apiCall } from '../services/apiService';

type PdfFormat = 'A4' | 'A5' | 'A3';
type PdfOrientation = 'portrait' | 'landscape';

interface PdfOptions {
    elementId: string;
    filename: string;
    format?: PdfFormat;
    orientation?: PdfOrientation;
    onComplete?: () => void;
    onError?: (error: any) => void;
}

export const generatePdf = async ({
    elementId,
    filename,
    format = 'A4',
    orientation = 'portrait',
    onComplete,
    onError
}: PdfOptions) => {
    const originalElement = document.getElementById(elementId);
    
    if (!originalElement) {
        if (onError) onError(new Error('Element not found'));
        return;
    }

    try {
        // 1. Get HTML Content
        // We clone to ensure we get current values of inputs/selects which innerHTML might miss
        const clone = originalElement.cloneNode(true) as HTMLElement;
        
        // Remove no-print elements from clone
        const noPrints = clone.querySelectorAll('.no-print');
        noPrints.forEach(el => el.remove());

        // Sync inputs values to attributes for proper rendering
        const inputs = clone.querySelectorAll('input, select, textarea');
        inputs.forEach((input: any) => {
            if (input.type === 'checkbox' || input.type === 'radio') {
                if (input.checked) input.setAttribute('checked', 'checked');
            } else if (input.tagName === 'SELECT') {
                const selectedOption = input.options[input.selectedIndex];
                if (selectedOption) selectedOption.setAttribute('selected', 'selected');
            } else {
                input.setAttribute('value', input.value);
                input.textContent = input.value; // For textarea
            }
        });

        const htmlContent = clone.outerHTML;

        // 2. Prepare Full HTML Document for Puppeteer
        // We inject the standard Tailwind CDN and local styles to ensure exact replication
        const fullHtml = `
            <!DOCTYPE html>
            <html lang="fa" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <script src="https://cdn.tailwindcss.com"></script>
                <link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" rel="stylesheet" type="text/css" />
                <style>
                    body { font-family: 'Vazirmatn', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    /* Ensure inputs look like text in print */
                    input, select, textarea { background: transparent; border: none; font-family: inherit; }
                    /* Layout fixes */
                    .printable-content { margin: 0 auto; width: 100%; box-shadow: none !important; }
                </style>
            </head>
            <body>
                ${htmlContent}
            </body>
            </html>
        `;

        // 3. Send to Backend
        const response = await fetch('/api/render-pdf', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                html: fullHtml,
                landscape: orientation === 'landscape',
                format: format
            })
        });

        if (!response.ok) throw new Error('Server PDF Generation Failed');

        // 4. Download Blob
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        if (onComplete) onComplete();

    } catch (error) {
        console.error('PDF Generator Error:', error);
        // Fallback to window.print if server fails (optional, but good UX)
        // alert('تولید PDF سمت سرور با خطا مواجه شد. از چاپ مرورگر استفاده می‌شود.');
        // window.print();
        if (onError) onError(error);
    }
};
