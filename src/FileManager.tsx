import React, { useEffect, useState } from 'react';
import { getPDFs, deletePDF, renamePDF } from './utils/indexedDB';
import { TextField } from '@mui/material';
import './index.css';

interface FileManagerProps {
  onClose: () => void;
}

const FileManager: React.FC<FileManagerProps> = ({ onClose }) => {
  const [pdfs, setPdfs] = useState<{ id: number, fileName: string, pdfData: Blob }[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newFileName, setNewFileName] = useState<string>('');
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchPDFs = async () => {
      const savedPDFs = await getPDFs();
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

  const handleDelete = async (id: number) => {
    await deletePDF(id);
    setPdfs(pdfs.filter(pdf => pdf.id !== id));
  };

  const handleRename = async (id: number) => {
    await renamePDF(id, newFileName);
    setPdfs(pdfs.map(pdf => (pdf.id === id ? { ...pdf, fileName: newFileName } : pdf)));
    setEditingId(null);
    setNewFileName('');
  };

  const filteredPdfs = pdfs.filter(pdf => pdf.fileName.toLowerCase().includes(searchTerm.toLowerCase()));

  if (!isVisible) return null;

  return (
    <div className="file-manager-modal">
      <div className="file-manager-content">
      <div className="file-manager-header">
      <h2>Saved Reports (PDFs)</h2>
      <div className="close-icon-container" onClick={() => { setIsVisible(false); onClose(); }}>
        <svg className="close-icon" viewBox="0 0 24 24">
          <line x1="4" y1="4" x2="20" y2="20" />
          <line x1="4" y1="20" x2="20" y2="4" />
        </svg>
      </div>
      
    </div>

        <TextField
          label="Search reports"
          variant="outlined"
          fullWidth
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ marginBottom: '1rem' }}
        />
        <div className="file-manager-list">
          <ul>
            {filteredPdfs.map(pdf => (
              <li key={pdf.id}>
                
                {editingId === pdf.id ? (
                  <>
                    <input
                      type="text"
                      value={newFileName}
                      onChange={(e) => setNewFileName(e.target.value)}
                    />
                    <div className="button-group">
                      <button className="save-button" onClick={() => handleRename(pdf.id)}>Save</button>
                      <button className="cancel-button" onClick={() => setEditingId(null)}>Cancel</button>
                    </div>
                  </>
                ) : (
                  <>
                    {pdf.fileName}
                    <div className="button-group">
                      <button className="download-button" onClick={() => downloadPDF(pdf.pdfData, pdf.fileName)}>Download</button>
                      <button className="delete-button" onClick={() => handleDelete(pdf.id)}>Delete</button>
                      <button className="rename-button" onClick={() => { setEditingId(pdf.id); setNewFileName(pdf.fileName); }}>Rename</button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default FileManager;