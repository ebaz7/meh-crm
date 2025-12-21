
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
        if (onError) onError(new Error('Element not found'));
        return;
    }

    try {
        // 1. Define dimensions in MM
        const widthMm = format === 'a4' ? 210 : 148;
        const heightMm = format === 'a4' ? 297 : 210;
        
        // Adjust for orientation
        const pdfPageWidth = orientation === 'landscape' ? heightMm : widthMm;
        const pdfPageHeight = orientation === 'landscape' ? widthMm : heightMm;

        // 2. Create Sandbox
        const sandbox = document.createElement('div');
        sandbox.style.position = 'fixed';
        sandbox.style.top = '-10000px';
        sandbox.style.left = '-10000px';
        // Set sandbox width exactly to page width (minus a small buffer to prevent overflow)
        sandbox.style.width = `${pdfPageWidth}mm`; 
        sandbox.style.minHeight = `${pdfPageHeight}mm`;
        sandbox.style.backgroundColor = '#ffffff';
        sandbox.style.zIndex = '-1';
        // Force font and direction on sandbox to ensure text renders correctly
        sandbox.style.fontFamily = "'Vazirmatn', sans-serif";
        sandbox.style.direction = 'rtl';
        sandbox.style.textAlign = 'right';
        document.body.appendChild(sandbox);

        // 3. Clone Element
        const clonedElement = originalElement.cloneNode(true) as HTMLElement;
        
        // 4. Reset Styles on Clone to Ensure it fits perfectly
        clonedElement.style.margin = '0 auto'; // Center horizontally
        clonedElement.style.padding = '0';
        clonedElement.style.width = '100%'; 
        clonedElement.style.maxWidth = '100%';
        clonedElement.style.height = 'auto';
        clonedElement.style.boxShadow = 'none';
        clonedElement.style.border = 'none';
        clonedElement.style.transform = 'none';
        
        // Remove Classes that might conflict
        clonedElement.classList.remove('fixed', 'absolute', 'shadow-2xl', 'mx-auto');
        
        sandbox.appendChild(clonedElement);

        // 5. Capture
        const canvas = await html2canvas(sandbox, {
            scale: 3, // Higher scale for sharper text
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            windowWidth: 1920 // Simulate desktop width for layout
        });

        document.body.removeChild(sandbox);

        const imgData = canvas.toDataURL('image/jpeg', 0.95); // JPEG is faster/smaller than PNG

        // 6. Create PDF
        // @ts-ignore
        const pdf = new jsPDF({
            orientation: orientation === 'portrait' ? 'p' : 'l',
            unit: 'mm',
            format: format
        });

        // 7. Add Image with Margins (Safe Area)
        const margin = 5; // 5mm margin
        const printWidth = pdfPageWidth - (margin * 2);
        
        const imgProps = pdf.getImageProperties(imgData);
        const imgRatio = imgProps.width / imgProps.height;
        const printHeight = printWidth / imgRatio;

        // Centering Vertically if content is small, otherwise top aligned with margin
        let yPos = margin;
        // If content fits within one page height with margins, we can center vertically optionally
        // But usually top-aligned is safer for reports. 
        
        pdf.addImage(imgData, 'JPEG', margin, yPos, printWidth, printHeight);
        
        const safeFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
        pdf.save(safeFilename);

        if (onComplete) onComplete();

    } catch (error) {
        console.error('PDF Generation Error:', error);
        if (onError) onError(error);
    }
};
