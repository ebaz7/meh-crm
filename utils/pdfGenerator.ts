
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
        // --- 1. CONFIGURATION ---
        // A4 in mm: 210 x 297. In pixels at 2 (roughly 96dpi * 2 for quality):
        // Portrait: ~1600px width. Landscape: ~2200px width.
        const scaleFactor = 2;
        const isLandscape = orientation === 'landscape';
        
        // Target widths for the HTML canvas to simulate a "page"
        // We use slightly larger fixed widths to ensure content fits comfortably before scaling down to PDF
        const targetWidth = isLandscape ? 2200 : 1600; 

        // --- 2. CLONING & PREPARATION ---
        const cloneContainer = document.createElement('div');
        cloneContainer.style.position = 'absolute';
        cloneContainer.style.top = '0';
        cloneContainer.style.left = '-10000px'; // Off-screen
        cloneContainer.style.width = `${targetWidth}px`;
        cloneContainer.style.zIndex = '-1000';
        cloneContainer.style.backgroundColor = '#ffffff';
        
        // Deep clone
        const clone = originalElement.cloneNode(true) as HTMLElement;
        
        // Reset styles on the clone to ensure it expands fully
        clone.style.width = '100%';
        clone.style.height = 'auto';
        clone.style.minHeight = 'auto';
        clone.style.maxHeight = 'none';
        clone.style.overflow = 'visible';
        clone.style.margin = '0';
        clone.style.padding = '20px'; // Add padding for "paper" feel
        clone.style.transform = 'none';
        clone.style.border = 'none';
        clone.style.boxShadow = 'none';
        
        // Force RTL if needed (fixes garbled text sometimes)
        if (!clone.getAttribute('dir')) {
            clone.setAttribute('dir', 'rtl');
        }

        // Recursively remove scrollbars and force full height on all children
        const descendants = clone.getElementsByTagName('*');
        for (let i = 0; i < descendants.length; i++) {
            const el = descendants[i] as HTMLElement;
            el.style.overflow = 'visible';
            el.style.maxHeight = 'none';
            // Force fonts to ensure rendering
            el.style.fontVariant = 'normal';
            el.style.fontFeatureSettings = 'normal';
        }

        cloneContainer.appendChild(clone);
        document.body.appendChild(cloneContainer);

        // Wait a moment for layout to settle and images to load
        await new Promise(resolve => setTimeout(resolve, 500));

        // --- 3. CAPTURE ---
        const canvas = await html2canvas(clone, {
            scale: scaleFactor,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            width: targetWidth, // Force capture width
            windowWidth: targetWidth,
            height: clone.scrollHeight, // Capture full height
            windowHeight: clone.scrollHeight,
            onclone: (doc) => {
                // Additional safety measure for fonts inside the iframe html2canvas creates
                const style = doc.createElement('style');
                style.innerHTML = `* { font-variant: normal !important; letter-spacing: normal !important; }`;
                doc.head.appendChild(style);
            }
        });

        // Cleanup
        document.body.removeChild(cloneContainer);

        const imgData = canvas.toDataURL('image/jpeg', 0.95); // JPEG slightly smaller/faster than PNG

        // --- 4. PDF GENERATION ---
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
        const pageRatio = pdfPageWidth / pdfPageHeight;

        let finalWidth = pdfPageWidth;
        let finalHeight = finalWidth / imgRatio;

        // If image is too tall for one page, we fit by width. 
        // If it's wider than the page (unlikely with our logic), fit by width.
        // For reports, we typically want to "Fit to Width" and let it scroll or fit on one page if possible.
        // Here we attempt "Best Fit" for single page view.
        
        if (finalHeight > pdfPageHeight) {
            // It's a long report.
            // Option A: Scale down to fit height (might be too small)
            // Option B: Multi-page (complex)
            // Option C: Just fit width and cut off (bad)
            // Option D: User requested "Fit to page" mostly. 
            // Let's try to fit width, but if it overflows significantly, we might scale down.
            // However, usually for "Stock Report", fitting width is key.
            
            // Let's scale to fit PAGE HEIGHT if it overflows, to ensure nothing is cut off, 
            // even if it makes text smaller. This guarantees "whole report" is visible.
            if (finalHeight > pdfPageHeight) {
                 finalHeight = pdfPageHeight;
                 finalWidth = finalHeight * imgRatio;
            }
        }

        // Center vertically and horizontally
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
