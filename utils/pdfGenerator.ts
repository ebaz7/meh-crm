
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
        const pageWidth = orientation === 'landscape' ? heightMm : widthMm;
        const pageHeight = orientation === 'landscape' ? widthMm : heightMm;

        // 2. Create a "Sandbox" container off-screen
        // This forces the content to layout exactly as if it were on a paper of that size
        const sandbox = document.createElement('div');
        sandbox.style.position = 'fixed';
        sandbox.style.top = '-10000px';
        sandbox.style.left = '-10000px';
        sandbox.style.width = `${pageWidth}mm`;
        sandbox.style.minHeight = `${pageHeight}mm`; // Allow expansion
        sandbox.style.backgroundColor = '#ffffff';
        sandbox.style.zIndex = '-1';
        document.body.appendChild(sandbox);

        // 3. Clone the element deeply
        const clonedElement = originalElement.cloneNode(true) as HTMLElement;
        
        // 4. Reset styles on the clone to ensure it fills the sandbox
        clonedElement.style.margin = '0';
        clonedElement.style.padding = '0'; // We handle padding in PDF placement if needed
        clonedElement.style.width = '100%'; 
        clonedElement.style.height = 'auto';
        clonedElement.style.transform = 'none';
        clonedElement.style.boxShadow = 'none';
        clonedElement.style.border = 'none';
        
        // Remove specific layout constraints that might exist on screen
        clonedElement.classList.remove('mx-auto'); 
        
        sandbox.appendChild(clonedElement);

        // 5. Capture the sandbox
        const canvas = await html2canvas(sandbox, {
            scale: 2, // High DPI
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            width: sandbox.offsetWidth, // Force exact width capture
            height: sandbox.offsetHeight
        });

        // 6. Cleanup
        document.body.removeChild(sandbox);

        const imgData = canvas.toDataURL('image/png');

        // 7. Create PDF
        // @ts-ignore
        const pdf = new jsPDF({
            orientation: orientation === 'portrait' ? 'p' : 'l',
            unit: 'mm',
            format: format
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        // 8. Scale Image to fit PDF Width
        const imgProps = pdf.getImageProperties(imgData);
        const imgRatio = imgProps.width / imgProps.height;
        
        // Calculate height based on width to maintain aspect ratio
        const finalHeight = pdfWidth / imgRatio;

        // If the content is taller than one page, we might need logic for multi-page (simple scaling for now)
        // For simple reports, we fit width and let height be whatever (or fit to page if strictly required)
        
        // Add image starting at 0,0
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, finalHeight);
        
        const safeFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
        pdf.save(safeFilename);

        if (onComplete) onComplete();

    } catch (error) {
        console.error('PDF Generation Error:', error);
        if (onError) onError(error);
    }
};
