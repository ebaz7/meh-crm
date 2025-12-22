
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
        // 1. Wait for fonts/images to fully load
        await document.fonts.ready;
        const images = Array.from(originalElement.querySelectorAll('img'));
        await Promise.all(images.map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
        }));

        // 2. Define dimensions (MM to Pixels helper logic internal to logic)
        // Standard ISO Paper Sizes
        const widthMm = format === 'a4' ? 210 : 148;
        const heightMm = format === 'a4' ? 297 : 210;
        
        // Logical Dimensions based on orientation
        const pdfPageWidthMm = orientation === 'landscape' ? heightMm : widthMm;
        const pdfPageHeightMm = orientation === 'landscape' ? widthMm : heightMm;
        
        // 3. Create Sandbox (The "Virtual Printer")
        // This forces the content to layout exactly as it would on paper
        const sandbox = document.createElement('div');
        sandbox.id = 'pdf-gen-sandbox';
        sandbox.style.position = 'fixed'; // Fixed to avoid scrollbars affecting it
        sandbox.style.top = '-10000px';
        sandbox.style.left = '0';
        sandbox.style.width = `${pdfPageWidthMm}mm`; 
        sandbox.style.minHeight = `${pdfPageHeightMm}mm`;
        sandbox.style.backgroundColor = '#ffffff';
        sandbox.style.zIndex = '-1000';
        
        // CRITICAL: Force Direction and Font for Persian
        sandbox.style.direction = 'rtl';
        sandbox.style.fontFamily = "'Vazirmatn', sans-serif";
        sandbox.style.textAlign = 'right';
        sandbox.style.boxSizing = 'border-box';
        
        // 4. Clone Element deeply
        const clonedElement = originalElement.cloneNode(true) as HTMLElement;
        
        // 5. Sanitize and Prepare Clone
        clonedElement.style.margin = '0';
        clonedElement.style.padding = '0';
        clonedElement.style.transform = 'none';
        clonedElement.style.boxShadow = 'none';
        clonedElement.style.width = '100%'; 
        clonedElement.style.maxWidth = '100%';
        clonedElement.style.height = 'auto'; 
        clonedElement.style.overflow = 'visible'; 
        
        // Remove no-print elements
        const noPrintElements = clonedElement.querySelectorAll('.no-print, button');
        noPrintElements.forEach(el => el.remove());

        // Fix Form Inputs: Convert inputs to text spans or copy values
        // HTML cloning doesn't copy current value of inputs/textareas/selects
        const originalInputs = originalElement.querySelectorAll('input, select, textarea');
        const clonedInputs = clonedElement.querySelectorAll('input, select, textarea');
        
        originalInputs.forEach((input, index) => {
            if (clonedInputs[index]) {
                const clonedInput = clonedInputs[index];
                if (input.tagName === 'SELECT') {
                    // Replace select with span for better printing
                    const selectedOpt = (input as HTMLSelectElement).options[(input as HTMLSelectElement).selectedIndex];
                    const span = document.createElement('span');
                    span.textContent = selectedOpt ? selectedOpt.text : '';
                    span.className = input.className; // Keep styles
                    span.style.border = 'none';
                    span.style.padding = '0 5px';
                    span.style.display = 'inline-block';
                    if(clonedInput.parentNode) clonedInput.parentNode.replaceChild(span, clonedInput);
                } else if (input.tagName === 'TEXTAREA') {
                    (clonedInput as HTMLTextAreaElement).value = (input as HTMLTextAreaElement).value;
                    (clonedInput as HTMLTextAreaElement).textContent = (input as HTMLTextAreaElement).value;
                } else if (input.tagName === 'INPUT') {
                    const inp = input as HTMLInputElement;
                    if (inp.type === 'checkbox' || inp.type === 'radio') {
                        (clonedInput as HTMLInputElement).checked = inp.checked;
                    } else {
                        // For text inputs, replace with value to ensure visibility
                        (clonedInput as HTMLInputElement).setAttribute('value', inp.value);
                        (clonedInput as HTMLInputElement).value = inp.value;
                    }
                }
            }
        });

        document.body.appendChild(sandbox);
        sandbox.appendChild(clonedElement);

        // 6. Capture using html2canvas
        // High scale (2 or 3) ensures text is crisp
        const canvas = await html2canvas(sandbox, {
            scale: 2, 
            useCORS: true, 
            allowTaint: true,
            backgroundColor: '#ffffff',
            logging: false,
            windowWidth: sandbox.scrollWidth,
            windowHeight: sandbox.scrollHeight
        });

        // Cleanup DOM
        document.body.removeChild(sandbox);

        // 7. Generate PDF
        // @ts-ignore
        const pdf = new jsPDF({
            orientation: orientation === 'portrait' ? 'p' : 'l',
            unit: 'mm',
            format: format,
            compress: true
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        
        const imgProps = pdf.getImageProperties(canvas.toDataURL('image/jpeg', 0.95));
        const pdfImgHeight = (imgProps.height * pdfWidth) / imgProps.width;

        // Intelligent Paging Logic
        let heightLeft = pdfImgHeight;
        let position = 0;
        let pageCount = 0;

        // First Page
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, position, pdfWidth, pdfImgHeight);
        heightLeft -= pdfHeight;
        pageCount++;

        // Subsequent Pages (if content overflows)
        while (heightLeft > 0) {
            position = heightLeft - pdfImgHeight; 
            pdf.addPage();
            pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, position, pdfWidth, pdfImgHeight);
            heightLeft -= pdfHeight;
            pageCount++;
        }
        
        const safeFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
        pdf.save(safeFilename);

        if (onComplete) onComplete();

    } catch (error) {
        console.error('PDF Generation Error:', error);
        const sb = document.getElementById('pdf-gen-sandbox');
        if (sb) document.body.removeChild(sb);
        if (onError) onError(error);
    }
};
