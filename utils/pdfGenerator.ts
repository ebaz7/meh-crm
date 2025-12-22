
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
        // 1. Wait for fonts to ensure Persian text renders correctly
        await document.fonts.ready;

        // 2. Calculate Standard Dimensions (in mm)
        // A4: 210 x 297, A5: 148 x 210
        const widthMm = format === 'a4' ? 210 : 148;
        const heightMm = format === 'a4' ? 297 : 210;
        
        // Logical Dimensions based on requested orientation
        // This forces the "Sandbox" to emulate a real paper sheet
        const sandboxWidthMm = orientation === 'landscape' ? heightMm : widthMm;
        const sandboxMinHeightMm = orientation === 'landscape' ? widthMm : heightMm;

        // 3. Create The "Smart Sandbox"
        // This hidden div mimics a desktop browser window of the exact PDF size
        // It solves the issue where mobile phones render layouts differently
        const sandbox = document.createElement('div');
        sandbox.id = 'pdf-smart-sandbox';
        sandbox.style.position = 'absolute';
        sandbox.style.top = '-10000px';
        sandbox.style.left = '-10000px';
        // Force width to match PDF width exactly (converts mm to pixels approx)
        sandbox.style.width = `${sandboxWidthMm}mm`; 
        sandbox.style.minHeight = `${sandboxMinHeightMm}mm`;
        sandbox.style.height = 'auto'; // Allow growing for long lists
        sandbox.style.backgroundColor = '#ffffff';
        sandbox.style.zIndex = '-1000';
        sandbox.style.overflow = 'visible'; // Important: Don't clip content
        sandbox.style.direction = 'rtl'; // Force RTL for Persian
        
        document.body.appendChild(sandbox);

        // 4. Clone Content
        const clonedElement = originalElement.cloneNode(true) as HTMLElement;
        
        // 5. Sanitize & Normalize Clone
        // Reset specific styles that might break print layout
        clonedElement.style.position = 'static'; 
        clonedElement.style.margin = '0';
        clonedElement.style.transform = 'none';
        clonedElement.style.boxShadow = 'none';
        clonedElement.style.width = '100%'; // Fill the sandbox
        clonedElement.style.height = 'auto'; 
        clonedElement.style.maxHeight = 'none';
        clonedElement.style.overflow = 'visible';
        
        // Remove no-print elements from the clone
        const noPrintElements = clonedElement.querySelectorAll('.no-print');
        noPrintElements.forEach(el => el.remove());

        // Sync Form Values (Inputs/Selects don't clone values automatically)
        const originalInputs = originalElement.querySelectorAll('input, select, textarea');
        const clonedInputs = clonedElement.querySelectorAll('input, select, textarea');
        originalInputs.forEach((input, index) => {
            if (clonedInputs[index]) {
                if (input.tagName === 'SELECT') {
                    (clonedInputs[index] as HTMLSelectElement).value = (input as HTMLSelectElement).value;
                } else if (input.tagName === 'INPUT' && (input as HTMLInputElement).type !== 'file') {
                    (clonedInputs[index] as HTMLInputElement).value = (input as HTMLInputElement).value;
                    (clonedInputs[index] as HTMLInputElement).checked = (input as HTMLInputElement).checked;
                } else if (input.tagName === 'TEXTAREA') {
                    (clonedInputs[index] as HTMLTextAreaElement).value = (input as HTMLTextAreaElement).value;
                }
            }
        });

        sandbox.appendChild(clonedElement);

        // 6. Capture High-Quality Image
        const canvas = await html2canvas(sandbox, {
            scale: 2, // 2x scale for Retina-like sharpness
            useCORS: true, 
            allowTaint: true,
            backgroundColor: '#ffffff',
            logging: false,
            // Ensure we capture the full scroll height of the sandbox
            windowWidth: sandbox.offsetWidth,
            windowHeight: sandbox.scrollHeight
        });

        // Cleanup Sandbox
        document.body.removeChild(sandbox);

        // 7. Generate PDF
        // @ts-ignore
        const pdf = new jsPDF({
            orientation: orientation === 'portrait' ? 'p' : 'l',
            unit: 'mm',
            format: format,
            compress: true
        });

        const pdfPageWidth = pdf.internal.pageSize.getWidth();
        const pdfPageHeight = pdf.internal.pageSize.getHeight();
        
        const imgProps = pdf.getImageProperties(canvas.toDataURL('image/jpeg', 0.95));
        const imgHeight = (imgProps.height * pdfPageWidth) / imgProps.width;

        // Intelligent Paging Logic
        let heightLeft = imgHeight;
        let position = 0;

        // First page
        pdf.addImage(imgProps.data, 'JPEG', 0, position, pdfPageWidth, imgHeight);
        heightLeft -= pdfPageHeight;

        // Add extra pages if content is long
        while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgProps.data, 'JPEG', 0, position, pdfPageWidth, imgHeight);
            heightLeft -= pdfPageHeight;
        }
        
        const safeFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
        pdf.save(safeFilename);

        if (onComplete) onComplete();

    } catch (error) {
        console.error('Smart PDF Generation Error:', error);
        const sb = document.getElementById('pdf-smart-sandbox');
        if (sb) document.body.removeChild(sb);
        if (onError) onError(error);
    }
};
