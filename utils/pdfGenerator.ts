
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
        // 1. Create a deep clone of the element to manipulate for printing without affecting the UI
        const clone = originalElement.cloneNode(true) as HTMLElement;
        
        // 2. Set up a hidden container for the clone to "expand" fully
        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.top = '-9999px';
        container.style.left = '-9999px';
        container.style.zIndex = '-1';
        container.style.overflow = 'visible'; // Allow content to overflow nicely
        
        // Force the clone to expand to its full scroll dimensions
        // We set width explicitly to match the intended PDF width roughly, or let it fit content
        // For reports like Currency/Stock, we want it to fit content width if it's wide
        const isLandscape = orientation === 'landscape';
        const targetWidth = isLandscape ? '297mm' : '210mm';
        
        clone.style.width = targetWidth; 
        clone.style.height = 'auto';
        clone.style.overflow = 'visible';
        clone.style.maxHeight = 'none';
        clone.style.margin = '0';
        clone.style.transform = 'none';
        
        // Remove scrollbars from clone's children if any
        const scrollables = clone.querySelectorAll('*');
        scrollables.forEach((el: any) => {
            el.style.overflow = 'visible';
            el.style.maxHeight = 'none';
        });

        container.appendChild(clone);
        document.body.appendChild(container);

        // 3. Capture the expanded clone
        const canvas = await html2canvas(clone, {
            scale: 2, // Quality
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            width: clone.scrollWidth, // Capture full width
            height: clone.scrollHeight, // Capture full height
            windowWidth: clone.scrollWidth,
            windowHeight: clone.scrollHeight
        });

        // 4. Remove the temp container
        document.body.removeChild(container);

        const imgData = canvas.toDataURL('image/png');

        // 5. Initialize jsPDF
        // @ts-ignore
        const pdf = new jsPDF({
            orientation: orientation === 'portrait' ? 'p' : 'l',
            unit: 'mm',
            format: format
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        // 6. Calculate scaling to fit page
        const imgProps = pdf.getImageProperties(imgData);
        const imgRatio = imgProps.width / imgProps.height;
        const pageRatio = pdfWidth / pdfHeight;

        let finalWidth = pdfWidth;
        let finalHeight = pdfHeight;

        // "Best Fit" Logic
        if (imgRatio > pageRatio) {
            // Image is wider than page (relative to ratio) -> Fit by Width
            finalWidth = pdfWidth;
            finalHeight = finalWidth / imgRatio;
        } else {
            // Image is taller -> Fit by Height (or width if we want it to scroll across pages, but here we fit single page)
            // Usually for reports we prefer fitting width even if it leaves whitespace at bottom
            finalWidth = pdfWidth;
            finalHeight = finalWidth / imgRatio;
            
            // If height exceeds page (super long report), shrink to fit height? 
            // Better UX for long reports is usually Fit Width, even if it spans pages (multi-page).
            // But for single page snapshot:
            if (finalHeight > pdfHeight) {
                 finalHeight = pdfHeight;
                 finalWidth = finalHeight * imgRatio;
            }
        }

        // 7. Center the image on the PDF page
        const x = (pdfWidth - finalWidth) / 2;
        const y = (pdfHeight - finalHeight) / 2; // Center vertically if short, top if long? Let's center.

        pdf.addImage(imgData, 'PNG', x, y < 0 ? 0 : y, finalWidth, finalHeight);
        
        const safeFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
        pdf.save(safeFilename);

        if (onComplete) onComplete();

    } catch (error) {
        console.error('PDF Generation Error:', error);
        if (onError) onError(error);
    }
};
