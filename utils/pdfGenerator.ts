
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
        // 1. Capture the element as a high-quality image
        // We set windowWidth to 1200px to force "Desktop" layout even on mobile devices
        const canvas = await html2canvas(element, {
            scale: 2, // High resolution (Retina-like)
            backgroundColor: '#ffffff',
            useCORS: true, // Allow cross-origin images (like user avatars)
            windowWidth: 1280, // Force desktop width for consistent layout
            logging: false,
            onclone: (clonedDoc) => {
                // Ensure the cloned element is visible and has correct background
                const el = clonedDoc.getElementById(elementId);
                if (el) {
                    el.style.visibility = 'visible';
                    el.style.display = 'block';
                    el.style.margin = '0';
                    el.style.transform = 'none';
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

        // 3. Calculate Image Dimensions to Fit Page (Maintain Aspect Ratio)
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
            // Fit by height
            finalHeight = pdfHeight;
            finalWidth = finalHeight * imgRatio;
        }

        // 4. Center the Image
        const x = (pdfWidth - finalWidth) / 2;
        const y = (pdfHeight - finalHeight) / 2;

        // 5. Add Image and Save
        pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);
        
        // Ensure filename ends with .pdf
        const safeFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
        pdf.save(safeFilename);

        if (onComplete) onComplete();

    } catch (error) {
        console.error('PDF Generation Error:', error);
        if (onError) onError(error);
    }
};
