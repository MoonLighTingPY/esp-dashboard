import React, { useEffect, useState } from 'react';
import { getPDFs, deletePDF, renamePDF } from './utils/indexedDB';
import { TextField } from '@mui/material';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
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
  const [selectedFiles, setSelectedFiles] = useState<number[]>([]);

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

  const handleBulkDelete = async () => {
    for (const id of selectedFiles) {
      await deletePDF(id);
    }
    setPdfs(pdfs.filter(pdf => !selectedFiles.includes(pdf.id)));
    setSelectedFiles([]);
  };

  const handleBulkDownload = () => {
    selectedFiles.forEach(id => {
      const pdf = pdfs.find(pdf => pdf.id === id);
      if (pdf) {
        downloadPDF(pdf.pdfData, pdf.fileName);
      }
    });
  };

  const handleDownloadAsZip = async () => {
    const zip = new JSZip();
    selectedFiles.forEach(id => {
      const pdf = pdfs.find(pdf => pdf.id === id);
      if (pdf) {
        zip.file(pdf.fileName, pdf.pdfData);
      }
    });
    const content = await zip.generateAsync({ type: 'blob' });
    const zipFileName = `Motor Reports-${new Date().toISOString().split('T')[0]}.zip`;
    saveAs(content, zipFileName);
  };

  const toggleSelectFile = (id: number) => {
    setSelectedFiles(prevSelectedFiles =>
      prevSelectedFiles.includes(id)
        ? prevSelectedFiles.filter(fileId => fileId !== id)
        : [...prevSelectedFiles, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedFiles.length === pdfs.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(pdfs.map(pdf => pdf.id));
    }
  };

  const filteredPdfs = pdfs.filter(pdf => pdf.fileName.toLowerCase().includes(searchTerm.toLowerCase()));

  if (!isVisible) return null;

  return (
    <div className="file-manager-modal">
      <div className="file-manager-content">
        <div className="file-manager-header">
          <div>
          <h2>Saved Reports (PDFs)</h2>
          <p className="file-manager-description">View, download, rename, or delete your saved reports. You can also download multiple reports as a ZIP archive. </p>
          </div>
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
                <input
                  type="checkbox"
                  checked={selectedFiles.includes(pdf.id)}
                  onChange={() => toggleSelectFile(pdf.id)}
                />
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
                    <span className="file-name">{pdf.fileName}</span>
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
          <div className="bulk-actions">
            <button className="select-all-button" onClick={handleSelectAll}>
              {selectedFiles.length === pdfs.length ? 'Deselect All' : 'Select All'}
            </button>         
            {selectedFiles.length > 0 && (
              <>
                <button className="download-zip-button" onClick={handleDownloadAsZip}>Download as Zip</button>
                <button className="download-selected-button" onClick={handleBulkDownload}>Download as PDF</button>
                <button className="delete-selected-button" onClick={handleBulkDelete}>Delete Selected</button>
              </>
            )}
          </div>

      </div>
    </div>
  );
};

export default FileManager;