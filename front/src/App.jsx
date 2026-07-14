import React, { useState, useCallback, useEffect } from "react";
import Plot from 'react-plotly.js';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const Input = ({ placeholder, value, onChange, className = "" }) => (
  <input type="text" placeholder={placeholder} value={value} onChange={onChange} className={`w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${className}`} />
);

const Button = ({ children, onClick, disabled = false, variant = "primary", className = ""}) => {
  let baseStyle = "px-4 py-2.5 rounded-lg font-medium shadow-md transition-all duration-200 flex justify-center items-center active:scale-[0.98] ";
  if ( variant === "primary" ) baseStyle += "bg-blue-600 text-white hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed";
  else if ( variant === "secondary" ) baseStyle += "bg-gray-700 text-gray-200 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed";
  else if ( variant === "success" ) baseStyle += "bg-emerald-600 text-white hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed";
  return <button onClick={onClick} disabled={disabled} className={`${baseStyle} ${className}`}>{children}</button>;
};

const Card = ({ children, className = ""}) => (
  <div className={`bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-gray-700/50 ${className}`}>{children}</div>
);

const Alert = ({ message, type = 'info'}) => {
  let colors = { info: 'bg-blue-900/30 border-blue-500 text-blue-300', error: 'bg-red-900/30 border-red-500 text-red-300', success: 'bg-emerald-900/30 border-emerald-500 text-emerald-300' };
  return (
    <div className={`p-4 border-l-4 rounded-r-lg ${colors[type]} transition-all duration-300 flex items-start`} role="alert">
      <div><p className="font-bold tracking-wider text-xs uppercase opacity-80 mb-1">{type}</p><p className="text-sm">{message}</p></div>
    </div>
  );
};

const DataTable = React.memo(({data, searchTerm, onCellEdit}) => {
  if (!data || data.columns.length === 0) return <div className="text-center p-12 text-gray-500 italic">No data loaded.</div>;

  const columns = data.columns;
  const rowsWithIndex = data.data.map((row, idx) => ({ ...row, _originalIndex: idx}));
  const filteredRows = rowsWithIndex.filter(row => {
    if (!searchTerm) return true;
    return columns.some(col => String(row[col]).toLowerCase().includes(searchTerm.toLowerCase()));
  });

  return (
    <div className="overflow-y-auto h-[60vh] border border-gray-700 rounded-xl shadow-inner bg-gray-900/50 overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-700 relative text-left">
        <thead className="bg-gray-800/90 sticky top-0 z-10 backdrop-blur-md">
          <tr>
            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">#</th>
            {columns.map((col, index) => (
              <th key={index} className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/50">
            {filteredRows.map((row, index) => (
              <tr key={row._originalIndex} className="hover:bg-gray-800/50 transition duration-150">
                <td className="px-6 py-3.5 text-sm font-medium text-gray-500 border-r border-gray-800/50">{index + 1}</td>
                {columns.map((col, colIndex) => (
                  <td key={colIndex} contentEditable suppressContentEditableWarning onBlur={(e) => onCellEdit(row._originalIndex, col, e.currentTarget.textContent)} className="px-6 py-3.5 whitespace-nowrap text-sm text-gray-300 outline-none focus:bg-blue-900/20 focus:text-blue-200 cursor-text">
                    {String(row[col] !== null ? row[col] : "")}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
      {filteredRows.length === 0 && <div className="p-8 text-center text-gray-500">No results found.</div>}
    </div>
  );
});

const App = () => {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [data, setData] = useState(null);
  const [sessionId, setSessionId] = useState(null); 
  
  const [query, setQuery] = useState("");
  const [queryHistory, setQueryHistory] = useState([]);
  
  const [llmQuery, setLlmQuery] = useState("");
  const [llmResult, setLlmResult] = useState({ explanation: "", code: "" });
  
  const [consoleOutput, setConsoleOutput] = useState("");
  const [plotData, setPlotData] = useState(null); 
  const [plotlyData, setPlotlyData] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: 'info'});
  const [searchTerm, setSearchTerm] = useState("");

  const showMessage = (text, type = 'info') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: 'info'}), 5000);
  };

  // NEW: Session Persistence Hook
  useEffect(() => {
    const savedSession = localStorage.getItem("workspace_session");
    const savedFileName = localStorage.getItem("workspace_filename");
    
    if (savedSession) {
      setLoading(true);
      fetch(`${BASE_URL}/load_session/${savedSession}`)
        .then(res => { if (!res.ok) throw new Error("Expired"); return res.json(); })
        .then(result => {
          if (result.status === 'success') {
            setData(result.data);
            setSessionId(result.session_id);
            setFileName(savedFileName || "Restored Session");
            showMessage("Workspace restored securely.", "success");
          }
        })
        .catch(() => {
            localStorage.removeItem("workspace_session");
            localStorage.removeItem("workspace_filename");
        })
        .finally(() => setLoading(false));
    }
  }, []);

  const handleFileUpload = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setData(null);
      setSessionId(null);
      setLlmResult({ explanation: "", code: "" });
      setConsoleOutput("");
      setPlotData(null);
      setPlotlyData(null);
      setQueryHistory([]);
      setSearchTerm("");
      showMessage(`File selected: ${selectedFile.name}`, 'info');
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setFileName("");
    setData(null);
    setSessionId(null);
    setQuery("");
    setLlmQuery("");
    setLlmResult({ explanation: "", code: "" });
    setConsoleOutput("");
    setPlotData(null);
    setPlotlyData(null);
    setQueryHistory([]);
    setSearchTerm("");
    localStorage.removeItem("workspace_session");
    localStorage.removeItem("workspace_filename");
    const fileInput = document.getElementById('file-upload-input');
    if (fileInput) fileInput.value = '';
    showMessage("Workspace cleared.", "info");
  };

  const uploadFile = useCallback(async () => {
    if (!file) return showMessage("Please select a file first.", 'error');
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await fetch(`${BASE_URL}/upload`, { method: 'POST', body: formData });
      const result = await response.json();
      if (response.ok) {
        setData(result.data);
        setSessionId(result.session_id); 
        localStorage.setItem("workspace_session", result.session_id);
        localStorage.setItem("workspace_filename", file.name);
        showMessage(`File uploaded successfully!`, 'success');
      } else {
        showMessage(`Upload Error: ${result.detail || 'Server error'}`, 'error');
      }
    } catch {
      showMessage(`Network Error.`, 'error');
    } finally {
      setLoading(false);
    }
  }, [file]);

  const pollTaskStatus = async (jobId, currentSessionId, currentQuery) => {
    try {
      const res = await fetch(`${BASE_URL}/task_status/${jobId}?session_id=${currentSessionId}`);
      const statusResult = await res.json();

      if (statusResult.status === "finished") {
        setData(statusResult.data);
        setConsoleOutput(statusResult.console_output || "Execution successful. No output.");
        setPlotData(statusResult.base64_plot || null);
        setPlotlyData(statusResult.plotly_json || null);
        setQueryHistory(prev => {
           if (!prev.includes(currentQuery)) return [currentQuery, ...prev].slice(0, 5);
           return prev;
        });
        showMessage("Query executed!", "success");
        setLoading(false);
      } else if (statusResult.status === "failed") {
        showMessage(`Execution failed: ${statusResult.detail}`, "error");
        setLoading(false);
      } else {
        setTimeout(() => pollTaskStatus(jobId, currentSessionId, currentQuery), 1000);
      }
    } catch {
      showMessage("Error checking task status.", "error");
      setLoading(false);
    }
  };

  const executeQuery = useCallback(async () => {
    if (!data || !sessionId) return showMessage("No data loaded.", 'error');
    if (!query.trim()) return showMessage("Please enter a query.", 'error');
    setLoading(true);
    setConsoleOutput("");
    setPlotData(null);
    setPlotlyData(null);
    const formData = new FormData();
    formData.append("query_code", query);
    formData.append("session_id", sessionId); 
    try {
      const response = await fetch(`${BASE_URL}/execute_query`, { method: 'POST', body: formData });
      const result = await response.json();
      if(response.ok) { pollTaskStatus(result.job_id, sessionId, query); } 
      else { showMessage(`Execution failed: ${result.detail || 'Error'}`, 'error'); setLoading(false); }
    } catch { showMessage(`Network Error.`, 'error'); setLoading(false); }
  }, [data, query, sessionId]);

  const explainQuery = useCallback(async () => {
    if (!sessionId) return showMessage("Upload a file first.", 'error');
    if (!llmQuery.trim()) return showMessage("Ask a question.", 'error');
    setLlmResult({ explanation: "Thinking...", code: "" });
    setLoading(true);
    const formData = new FormData();
    formData.append("natural_language_query", llmQuery);
    formData.append("session_id", sessionId); 
    try {
      const response = await fetch(`${BASE_URL}/explain_query`, { method: 'POST', body: formData });
      const result = await response.json();
      if (response.ok) setLlmResult({ explanation: result.explanation, code: result.code });
      else setLlmResult({ explanation: `LLM Error: ${result.detail}`, code: "" });
    } catch { setLlmResult({ explanation: "Network Error.", code: "" });
    } finally { setLoading(false); }
  }, [llmQuery, sessionId]);

  // NEW: Autonomous Auto-Clean Function
  const autoClean = useCallback(async () => {
    if (!sessionId) return showMessage("Upload a file first.", 'error');
    setLlmResult({ explanation: "Analyzing data profile and generating cleaning script...", code: "" });
    setLoading(true);
    const formData = new FormData();
    formData.append("session_id", sessionId); 
    try {
      const response = await fetch(`${BASE_URL}/auto_clean_recipe`, { method: 'POST', body: formData });
      const result = await response.json();
      if (response.ok) {
        setLlmResult({ explanation: "✨ Auto-Clean Recipe Generated:\n\n" + result.explanation, code: result.code });
        setQuery(result.code);
        showMessage("Auto-Clean script generated! Review and click Execute.", "success");
      } else {
        setLlmResult({ explanation: `Failed: ${result.detail}`, code: "" });
      }
    } catch {
      setLlmResult({ explanation: "Network Error.", code: "" });
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const handleCellEdit = useCallback((originalRowIndex, columnName, newValue) => {
    setData(prevData => {
      if (!prevData) return prevData;

      const updatedData = [...prevData.data];
      updatedData[originalRowIndex] = {
        ...updatedData[originalRowIndex],
        [columnName]: newValue
      };

      return { ...prevData, data: updatedData };
    });
  }, []);

  const handleExport = (format) => {
    if (!sessionId) return;
    window.open(`${BASE_URL}/export/${sessionId}?fmt=${format}`, '_blank');
  };

  const downloadGraph = () => {
    if (!plotData) return;
    const link = document.createElement("a");
    link.href = `data:image/png;base64,${plotData}`;
    link.download = "Workspace_Graph.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen p-4 md:p-8 font-sans">
      <header className="text-center mb-10 mt-4 relative">
        {/* Desktop User Guide Button (Absolute positioned to the right) */}
        <div className="absolute top-0 right-0 hidden md:block">
          <a 
            href="/user_guide.pdf" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-gray-800/80 hover:bg-gray-700 text-blue-300 text-sm font-bold tracking-wider uppercase rounded-lg border border-blue-900/50 hover:border-blue-500/50 shadow-[0_0_10px_rgba(59,130,246,0.1)] hover:shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all duration-200 backdrop-blur-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            User Guide
          </a>
        </div>
        
        <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-3 tracking-tight">
          <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-400 to-emerald-400">AI Data</span> Workspace
        </h1>
        <p className="text-gray-400 max-w-2xl mx-auto">Upload, query, edit, and visualize your datasets with LLM-powered assistance in a secure sandbox.</p>
        
        {/* Mobile User Guide Button (Shows under the text on small screens) */}
        <div className="mt-5 flex justify-center md:hidden">
          <a 
            href="/user_guide.pdf" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-gray-800/80 hover:bg-gray-700 text-blue-300 text-sm font-bold tracking-wider uppercase rounded-lg border border-blue-900/50 transition-all duration-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            User Guide
          </a>
        </div>
      </header>
      
      {message.text && <div className="mb-6 max-w-5xl mx-auto"><Alert message={message.text} type={message.type} /></div>}
      
      <main className="max-w-[1400px] mx-auto grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-1 flex flex-col gap-6">
          <Card>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-bold text-gray-100 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                Ingestion
              </h2>
              {fileName && (
                 <button onClick={handleRemoveFile} title="Clear Workspace" className="p-1 text-gray-500 cursor-pointer hover:text-red-400 hover:bg-red-400/10 rounded transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                 </button>
              )}
            </div>
            <div className="relative border-2 border-dashed border-gray-600 hover:border-blue-500 rounded-xl p-4 transition-colors text-center cursor-pointer bg-gray-800/50">
                <input id="file-upload-input" type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                <div className="pointer-events-none">
                    <svg className="mx-auto h-8 w-8 text-gray-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <p className="text-sm text-gray-300 font-medium truncate w-full px-4">{fileName ? fileName : "Click or drag file here"}</p>
                    <p className="text-xs text-gray-500 mt-1">.CSV, .XLSX</p>
                </div>
            </div>
            <Button onClick={uploadFile} disabled={!file || loading} className="w-full cursor-pointer mt-4">{loading && file && !data ? 'Processing...' : 'Load into Sandbox'}</Button>
          </Card>

          <Card className="grow flex flex-col">
            <h2 className="text-lg font-bold text-gray-100 flex items-center mb-4">
              <svg className="w-5 h-5 mr-2 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
              Query Sandbox
            </h2>
            {queryHistory.length > 0 && (
              <div className="mb-4">
                <div className="flex flex-wrap gap-2">
                  {queryHistory.map((q, i) => (
                    <button key={i} onClick={() => setQuery(q)} className="text-[10px] uppercase font-bold tracking-wider bg-gray-700/50 hover:bg-gray-600 text-gray-300 px-2.5 py-1.5 rounded-md border border-gray-600 transition-colors truncate max-w-full" title={q}>
                      {q.length > 30 ? q.substring(0, 30) + '...' : q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <textarea 
              rows="6" 
              placeholder="# Write Pandas code here...&#10;df['Total'] = df['Price'] * df['Qty']" 
              value={query} 
              onChange={(e) => setQuery(e.target.value)} 
              className="w-full p-3 bg-[#0d1117] text-gray-300 border border-gray-700 rounded-lg focus:ring-1 focus:ring-blue-500 font-mono text-sm resize-none grow shadow-inner"
            ></textarea>
            <Button onClick={executeQuery} disabled={!query || loading || !data} variant="success" className="mt-4 cursor-pointer w-full">{loading && query ? 'Running...' : 'Execute Query'}</Button>
            
            {consoleOutput && (
              <div className="mt-5">
                <div className="bg-black border border-gray-700 rounded-lg overflow-hidden shadow-inner">
                   <div className="bg-gray-800 px-3 py-1.5 border-b border-gray-700 flex space-x-1.5 items-center">
                     <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div><div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div><div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                     <span className="text-[10px] text-gray-400 font-mono ml-2 uppercase">Stdout</span>
                   </div>
                   <div className="p-3 font-mono text-xs text-green-400 h-32 overflow-y-auto whitespace-pre-wrap">{consoleOutput}</div>
                </div>
              </div>
            )}

            {(plotData || plotlyData) && (
              <div className="mt-5 pt-5 border-t border-gray-700/50">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">{plotlyData ? 'Interactive Plot' : 'Static Figure'}</h3>
                  {plotData && (
                    <button onClick={downloadGraph} className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer flex items-center font-medium bg-blue-900/20 px-2 py-1 rounded">Download PNG</button>
                  )}
                </div>
                <div className="bg-gray-900 p-2 rounded-lg border border-gray-700 overflow-hidden">
                  {plotlyData ? (
                    <Plot data={JSON.parse(plotlyData).data} layout={{...JSON.parse(plotlyData).layout, paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', font: { color: '#9ca3af' }, autosize: true, margin: { t: 40, r: 20, l: 40, b: 40 }}} useResizeHandler={true} style={{ width: '100%', minHeight: '400px' }} config={{ responsive: true, displayModeBar: true }} />
                  ) : (
                    <img src={`data:image/png;base64,${plotData}`} alt="Generated Plot" className="w-full h-auto cursor-pointer rounded" />
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>
        
        <div className="xl:col-span-3 flex flex-col gap-6">
          <Card className="grow">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-5 gap-4">
              <h2 className="text-lg font-bold text-gray-100 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                Workspace View
              </h2>
              <div className="flex flex-wrap gap-3 items-center">
                <Input placeholder="Filter rows..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full md:w-56 h-9 py-1 text-sm bg-gray-900" />
                {data && (
                  <div className="flex bg-gray-900 border border-gray-700 rounded-lg overflow-hidden shadow-sm h-9">
                    <button onClick={() => handleExport('csv')} className="hover:bg-gray-700 text-gray-300 text-xs font-bold px-3 border-r border-gray-700 transition-colors uppercase">.CSV</button>
                    <button onClick={() => handleExport('excel')} className="hover:bg-gray-700 text-gray-300 text-xs font-bold px-3 transition-colors uppercase">.XLSX</button>
                  </div>
                )}
              </div>
            </div>
            <DataTable data={data} searchTerm={searchTerm} onCellEdit={handleCellEdit} />
          </Card>
          
          <Card className="bg-linear-to-r from-gray-800 to-gray-800/80 border-blue-900/30">
            <h2 className="text-lg font-bold text-gray-100 flex items-center mb-4"><span className="text-2xl mr-2">🤖</span>AI Copilot</h2>
            <div className="flex flex-col md:flex-row gap-3 mb-4">
              <Input placeholder="Describe what you want to do with your data..." value={llmQuery} onChange={(e) => setLlmQuery(e.target.value)} className="grow bg-gray-900" />
              <Button onClick={explainQuery} disabled={!llmQuery || loading} variant="primary" className=" cursor-pointer whitespace-nowrap">Ask AI</Button>
              {/* NEW: Magic Clean Button */}
              <Button onClick={autoClean} disabled={loading || !data} variant="success" className="whitespace-nowrap cursor-pointer flex items-center border border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_20px_rgba(16,185,129,0.5)]">
                ✨ Magic Clean
              </Button>
            </div>
            
            <div className="bg-gray-900/50 p-5 rounded-xl border border-gray-700/50 min-h-[120px] flex flex-col gap-3 relative">
              {llmResult.explanation ? (
                <>
                  <p className="text-sm text-gray-300 leading-relaxed font-medium whitespace-pre-wrap">{llmResult.explanation}</p>
                  {llmResult.code && (
                    <div className="bg-black/60 rounded-lg p-3 relative group border border-gray-700 mt-2">
                      <pre className="text-emerald-400 font-mono text-sm overflow-x-auto whitespace-pre-wrap">{llmResult.code}</pre>
                      <button onClick={() => setQuery(llmResult.code)} className="absolute top-1/2 -translate-y-1/2 right-3 cursor-pointer bg-blue-600/90 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200">
                        Transfer to Editor →
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500 italic">
                  {data ? "Copilot is ready. Ask a question or click Magic Clean to analyze the dataset." : "Awaiting data context..."}
                </div>
              )}
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
export default App;