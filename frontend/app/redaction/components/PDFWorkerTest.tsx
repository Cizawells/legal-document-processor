"use client";

import { useEffect, useState } from 'react';

const PDFWorkerTest = () => {
  const [workerStatus, setWorkerStatus] = useState<'checking' | 'available' | 'unavailable'>('checking');

  useEffect(() => {
    // Test if the worker file is accessible
    fetch('/pdf-worker/pdf.worker.min.js')
      .then(response => {
        if (response.ok) {
          setWorkerStatus('available');
        } else {
          setWorkerStatus('unavailable');
        }
      })
      .catch(() => {
        setWorkerStatus('unavailable');
      });
  }, []);

  if (workerStatus === 'checking') {
    return (
      <div className="text-sm text-slate-500">
        Checking PDF worker...
      </div>
    );
  }

  return (
    <div className={`text-sm ${workerStatus === 'available' ? 'text-green-600' : 'text-red-600'}`}>
      PDF Worker: {workerStatus === 'available' ? '✓ Available' : '✗ Unavailable'}
    </div>
  );
};

export default PDFWorkerTest;
