
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
        // 1. Wait for fonts to be fully loaded to prevent garbled text
        await document.fonts.ready;

        // 2. Define dimensions (MM to Pixels helper)
        // 1mm ~ 3.78px at 96 DPI
        const widthMm = format === 'a4' ? 210 : 148;
        const heightMm = format === 'a4' ? 297 : 210;
        
        // Logical Dimensions based on orientation
        const pdfPageWidthMm = orientation === 'landscape' ? heightMm : widthMm;
        const pdfPageHeightMm = orientation === 'landscape' ? widthMm : heightMm;

        // 3. Create a Sandbox Container (Off-screen but rendered)
        // We use this to ensure the layout is calculated exactly as it would be on paper
        const sandbox = document.createElement('div');
        sandbox.id = 'pdf-gen-sandbox';
        sandbox.style.position = 'absolute';
        sandbox.style.top = '-9999px';
        sandbox.style.left = '0'; // Keep left 0 to avoid layout shifting issues
        // Force the sandbox width to match the target PDF width exactly
        // This prevents responsive styles from changing the layout during capture
        sandbox.style.width = `${pdfPageWidthMm}mm`; 
        sandbox.style.minHeight = `${pdfPageHeightMm}mm`;
        sandbox.style.backgroundColor = '#ffffff';
        sandbox.style.zIndex = '-1000';
        sandbox.style.overflow = 'visible'; // Allow content to flow
        
        // CRITICAL: Force Direction and Font for Persian Support
        sandbox.style.direction = 'rtl';
        sandbox.style.fontFamily = "'Vazirmatn', sans-serif";
        sandbox.style.textAlign = 'right';
        sandbox.style.boxSizing = 'border-box';

        document.body.appendChild(sandbox);

        // 4. Clone the element
        const clonedElement = originalElement.cloneNode(true) as HTMLElement;
        
        // 5. Sanitize Clone Styles
        // Reset positioning that might break the flow in the sandbox
        clonedElement.style.position = 'static'; 
        clonedElement.style.margin = '0';
        clonedElement.style.transform = 'none';
        clonedElement.style.boxShadow = 'none';
        // Force width to 100% of the sandbox (which is already set to PDF width)
        clonedElement.style.width = '100%'; 
        clonedElement.style.maxWidth = '100%';
        clonedElement.style.height = 'auto';
        
        // Remove interactive elements or UI-specific classes if needed
        const noPrintElements = clonedElement.querySelectorAll('.no-print');
        noPrintElements.forEach(el => el.remove());

        // Fix Input values (Cloned inputs often lose their values)
        const originalInputs = originalElement.querySelectorAll('input, select, textarea');
        const clonedInputs = clonedElement.querySelectorAll('input, select, textarea');
        originalInputs.forEach((input, index) => {
            if (clonedInputs[index]) {
                if (input.tagName === 'SELECT') {
                    (clonedInputs[index] as HTMLSelectElement).value = (input as HTMLSelectElement).value;
                } else if (input.tagName === 'INPUT' && (input as HTMLInputElement).type !== 'file') {
                    (clonedInputs[index] as HTMLInputElement).value = (input as HTMLInputElement).value;
                    // For checkboxes/radios
                    (clonedInputs[index] as HTMLInputElement).checked = (input as HTMLInputElement).checked;
                } else if (input.tagName === 'TEXTAREA') {
                    (clonedInputs[index] as HTMLTextAreaElement).value = (input as HTMLTextAreaElement).value;
                }
            }
        });

        sandbox.appendChild(clonedElement);

        // 6. Capture High-Resolution Image
        const canvas = await html2canvas(sandbox, {
            scale: 3, // High Quality (300 DPI equiv)
            useCORS: true, // Allow cross-origin images
            allowTaint: true,
            backgroundColor: '#ffffff',
            logging: false,
            // Force the canvas window size to emulate a desktop screen to prevent mobile responsiveness
            windowWidth: 1920, 
            onclone: (doc) => {
                // Additional safety to ensure fonts are visible
                const el = doc.getElementById('pdf-gen-sandbox');
                if (el) el.style.fontVariantLigatures = 'no-common-ligatures';
            }
        });

        // Cleanup DOM
        document.body.removeChild(sandbox);

        // 7. Convert to PDF
        // @ts-ignore
        const pdf = new jsPDF({
            orientation: orientation === 'portrait' ? 'p' : 'l',
            unit: 'mm',
            format: format,
            compress: true
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        
        // Calculate image height based on aspect ratio to prevent stretching
        const imgProps = pdf.getImageProperties(canvas.toDataURL('image/jpeg', 0.95));
        const pdfImgHeight = (imgProps.height * pdfWidth) / imgProps.width;

        // Add Image to PDF
        // We use JPEG with 0.95 quality for a good balance of sharpness and file size
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pdfWidth, pdfImgHeight);
        
        const safeFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
        pdf.save(safeFilename);

        if (onComplete) onComplete();

    } catch (error) {
        console.error('PDF Generation Error:', error);
        // Clean up sandbox if error occurs before cleanup
        const sb = document.getElementById('pdf-gen-sandbox');
        if (sb) document.body.removeChild(sb);
        
        if (onError) onError(error);
    }
};
