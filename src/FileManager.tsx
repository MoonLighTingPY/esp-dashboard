import React, { useEffect, useState } from 'react';
import { getPDFs } from './utils/indexedDB';

const FileManager: React.FC = () => {
  const [pdfs, setPdfs] = useState<{ id: number, fileName: string, pdfData: Blob }[]>([]);

  useEffect(() => {
    const fetchPDFs = async () => {
      const savedPDFs = await getPDFs();
      // Sort PDFs by id in descending order
      savedPDFs.sort((a, b) => b.id - a.id);
      setPdfs(savedPDFs);
    };
    fetchPDFs();
  }, []);

  const downloadPDF = (pdfData: Blob, fileName: string) => {
    const url = URL.createObjectURL(pdfData);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h2>Saved PDFs</h2>
      <ul>
        {pdfs.map(pdf => (
          <li key={pdf.id}>
            {pdf.fileName}
            <button onClick={() => downloadPDF(pdf.pdfData, pdf.fileName)}>Download</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default FileManager;