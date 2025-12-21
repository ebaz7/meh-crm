
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
        // 1. Define exact paper dimensions in MM
        // A4: 210 x 297, A5: 148 x 210
        const widthMm = format === 'a4' ? 210 : 148;
        const heightMm = format === 'a4' ? 297 : 210;
        
        // Adjust for orientation
        const pdfPageWidth = orientation === 'landscape' ? heightMm : widthMm;
        const pdfPageHeight = orientation === 'landscape' ? widthMm : heightMm;

        // 2. Create Sandbox
        // We make the sandbox essentially a "viewport" of the exact paper size
        const sandbox = document.createElement('div');
        sandbox.style.position = 'fixed';
        sandbox.style.top = '-10000px';
        sandbox.style.left = '-10000px';
        sandbox.style.width = `${pdfPageWidth}mm`; 
        sandbox.style.minHeight = `${pdfPageHeight}mm`;
        sandbox.style.backgroundColor = '#ffffff';
        sandbox.style.zIndex = '-1';
        
        // CRITICAL: Force Flexbox centering inside the sandbox
        // This ensures whatever we clone into it sits perfectly in the middle horizontally
        sandbox.style.display = 'flex';
        sandbox.style.flexDirection = 'column';
        sandbox.style.alignItems = 'center'; // Center horizontally
        sandbox.style.justifyContent = 'flex-start'; // Align top
        
        // Force font and direction
        sandbox.style.fontFamily = "'Vazirmatn', sans-serif";
        sandbox.style.direction = 'rtl';
        
        document.body.appendChild(sandbox);

        // 3. Clone Element
        const clonedElement = originalElement.cloneNode(true) as HTMLElement;
        
        // 4. Clean up the clone styles to ensure it behaves well in the sandbox
        // Reset margins that might push it off-center
        clonedElement.style.margin = '0'; 
        clonedElement.style.marginTop = '5mm'; // Small top margin for aesthetics
        clonedElement.style.padding = '0';
        // Force the element to respect the page width (minus a safe margin)
        clonedElement.style.width = `${pdfPageWidth - 10}mm`; 
        clonedElement.style.maxWidth = '100%';
        clonedElement.style.boxShadow = 'none';
        clonedElement.style.border = 'none';
        clonedElement.style.transform = 'none';
        
        // Remove classes that might interfere
        clonedElement.classList.remove('fixed', 'absolute', 'shadow-2xl', 'mx-auto', 'my-auto');
        
        sandbox.appendChild(clonedElement);

        // 5. Capture
        const canvas = await html2canvas(sandbox, {
            scale: 2.5, // Good balance between quality and file size
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            windowWidth: 1920 // Simulate desktop to prevent mobile layout shifts
        });

        document.body.removeChild(sandbox);

        const imgData = canvas.toDataURL('image/jpeg', 0.98);

        // 6. Create PDF
        // @ts-ignore
        const pdf = new jsPDF({
            orientation: orientation === 'portrait' ? 'p' : 'l',
            unit: 'mm',
            format: format
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        // 7. Add Image
        // Since we sized the sandbox exactly to the page, we can fit the image exactly
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        
        const safeFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
        pdf.save(safeFilename);

        if (onComplete) onComplete();

    } catch (error) {
        console.error('PDF Generation Error:', error);
        if (onError) onError(error);
    }
};
