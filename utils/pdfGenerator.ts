
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

type PdfFormat = 'a4' | 'a5';
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
    format = 'a4',
    orientation = 'portrait',
    onComplete,
    onError
}: PdfOptions) => {
    const originalElement = document.getElementById(elementId);
    
    if (!originalElement) {
        console.error(`Element with ID '${elementId}' not found.`);
        if (onError) onError(new Error('Element not found'));
        return;
    }

    try {
        // --- 1. SETUP DIMENSIONS ---
        // A4 pixels at 96 DPI * 2 (Scale) approx:
        // Portrait: 1600px width
        // Landscape: 2300px width
        // We set a fixed large width for the canvas to ensure tables don't crunch
        const isLandscape = orientation === 'landscape';
        const targetWidth = isLandscape ? 2300 : 1600;

        // --- 2. CLONE & PREPARE ---
        // Create a hidden container to hold the clone
        const cloneContainer = document.createElement('div');
        cloneContainer.style.position = 'fixed';
        cloneContainer.style.top = '-10000px';
        cloneContainer.style.left = '-10000px';
        cloneContainer.style.zIndex = '-1000';
        // Force the container to be large enough to hold full content without scrolling
        cloneContainer.style.width = `${targetWidth}px`;
        cloneContainer.style.height = 'auto';
        cloneContainer.style.overflow = 'visible';
        
        // Deep clone the element
        const clone = originalElement.cloneNode(true) as HTMLElement;
        
        // Force styles on the clone to ensure full visibility
        clone.style.width = '100%';
        clone.style.height = 'auto';
        clone.style.minHeight = 'auto';
        clone.style.maxHeight = 'none';
        clone.style.overflow = 'visible';
        clone.style.margin = '0';
        clone.style.padding = '20px';
        clone.style.transform = 'none';
        clone.style.border = 'none';
        
        // Ensure RTL direction is preserved
        if (!clone.style.direction) clone.style.direction = 'rtl';

        // Recursively clean up children (remove scrollbars from tables)
        const descendants = clone.getElementsByTagName('*');
        for (let i = 0; i < descendants.length; i++) {
            const el = descendants[i] as HTMLElement;
            el.style.overflow = 'visible';
            el.style.maxHeight = 'none';
            // Fix Persian font rendering issues
            el.style.fontVariant = 'normal';
            el.style.fontFeatureSettings = 'normal';
            el.style.letterSpacing = 'normal';
        }

        cloneContainer.appendChild(clone);
        document.body.appendChild(cloneContainer);

        // Allow DOM to settle (images load, fonts render)
        await new Promise(resolve => setTimeout(resolve, 300));

        // --- 3. CAPTURE ---
        const canvas = await html2canvas(clone, {
            scale: 2, // High resolution
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            width: targetWidth, // Capture the full expanded width
            windowWidth: targetWidth,
            height: clone.scrollHeight + 50, // Capture full expanded height + padding
            windowHeight: clone.scrollHeight + 100,
            onclone: (doc) => {
                // Double safe font fix
                const style = doc.createElement('style');
                style.innerHTML = `* { font-variant: normal !important; letter-spacing: normal !important; -webkit-font-smoothing: antialiased; }`;
                doc.head.appendChild(style);
            }
        });

        // Cleanup DOM
        document.body.removeChild(cloneContainer);

        const imgData = canvas.toDataURL('image/jpeg', 0.98);

        // --- 4. GENERATE PDF ---
        // @ts-ignore
        const pdf = new jsPDF({
            orientation: isLandscape ? 'l' : 'p',
            unit: 'mm',
            format: format
        });

        const pdfPageWidth = pdf.internal.pageSize.getWidth();
        const pdfPageHeight = pdf.internal.pageSize.getHeight();

        const imgProps = pdf.getImageProperties(imgData);
        const imgRatio = imgProps.width / imgProps.height;
        
        // Calculate dimensions to fit width (most important for reports)
        let finalWidth = pdfPageWidth;
        let finalHeight = finalWidth / imgRatio;

        // If it's a very long report (taller than one page), 
        // standard behavior for single-image export is "Fit Page" or "Fit Width".
        // To prevent cutting off data in "Fit Width" mode if it exceeds height:
        // We will scale it down to fit the PAGE if it's too tall, 
        // OR we just center it if it fits. 
        
        // Logic: Try Fit Width. If Height > PageHeight, force Fit Height to ensure nothing is cut.
        // (User can zoom in PDF).
        if (finalHeight > pdfPageHeight) {
             finalHeight = pdfPageHeight;
             finalWidth = finalHeight * imgRatio;
        }

        // Center the image
        const x = (pdfPageWidth - finalWidth) / 2;
        const y = (pdfPageHeight - finalHeight) / 2;

        pdf.addImage(imgData, 'JPEG', x, y, finalWidth, finalHeight);
        
        const safeFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
        pdf.save(safeFilename);

        if (onComplete) onComplete();

    } catch (error) {
        console.error('PDF Generation Error:', error);
        if (onError) onError(error);
    }
};
