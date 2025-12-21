
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
    const element = document.getElementById(elementId);
    
    if (!element) {
        console.error(`Element with ID '${elementId}' not found.`);
        if (onError) onError(new Error('Element not found'));
        return;
    }

    try {
        // Define page size in mm
        const pageWidth = format === 'a4' ? 210 : 148;
        const pageHeight = format === 'a4' ? 297 : 210;
        
        // Swap for landscape
        const finalPageWidth = orientation === 'landscape' ? pageHeight : pageWidth;
        const finalPageHeight = orientation === 'landscape' ? pageWidth : pageHeight;

        // 1. Capture the element
        const canvas = await html2canvas(element, {
            scale: 2, // High resolution
            backgroundColor: '#ffffff',
            useCORS: true,
            logging: false,
            scrollX: 0,
            scrollY: 0,
            // Ensure we capture desktop-like width even on mobile
            windowWidth: 1920,
            onclone: (clonedDoc) => {
                const el = clonedDoc.getElementById(elementId);
                if (el) {
                    // CRITICAL FIX: Reset positioning to ensure capture starts from 0,0 without margins
                    el.style.margin = '0';
                    el.style.transform = 'none';
                    el.style.position = 'static'; // Prevent absolute positioning issues
                    el.style.boxShadow = 'none'; // Remove shadows in PDF
                    // Force element to fit content width/height to avoid clipping
                    el.style.width = 'fit-content';
                    el.style.height = 'auto';
                    el.style.minHeight = 'fit-content';
                    el.style.maxHeight = 'none';
                    el.style.overflow = 'visible';
                }
            }
        });

        const imgData = canvas.toDataURL('image/png');

        // 2. Initialize jsPDF
        // @ts-ignore
        const pdf = new jsPDF({
            orientation: orientation === 'portrait' ? 'p' : 'l',
            unit: 'mm',
            format: format
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        // 3. Calculate Dimensions to Fit
        const imgProps = pdf.getImageProperties(imgData);
        const imgRatio = imgProps.width / imgProps.height;
        const pageRatio = pdfWidth / pdfHeight;

        let finalWidth = pdfWidth;
        let finalHeight = pdfHeight;

        // If image is wider relative to page, fit by width
        if (imgRatio > pageRatio) {
            finalWidth = pdfWidth;
            finalHeight = finalWidth / imgRatio;
        } else {
            // If image is taller, fit by height
            finalHeight = pdfHeight;
            finalWidth = finalHeight * imgRatio;
        }

        // 4. Center the Image
        const x = (pdfWidth - finalWidth) / 2;
        const y = (pdfHeight - finalHeight) / 2;

        // 5. Add Image
        pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);
        
        const safeFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
        pdf.save(safeFilename);

        if (onComplete) onComplete();

    } catch (error) {
        console.error('PDF Generation Error:', error);
        if (onError) onError(error);
    }
};
