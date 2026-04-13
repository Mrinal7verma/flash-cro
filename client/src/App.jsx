import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { Send, Sparkles, Globe, Zap, CheckCircle2, Terminal, ExternalLink, Activity } from 'lucide-react';

const socket = io('http://localhost:5001');

function App() {
  const [url, setUrl] = useState('');
  const [adText, setAdText] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

  // Fetch permanent history from MongoDB on load
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await axios.get('http://localhost:5001/api/history');
        const formattedHistory = res.data.map(job => ({
          id: job.jobId,
          url: job.url,
          time: new Date(job.createdAt).toLocaleTimeString(),
          status: job.status,
          result: job.htmlResult ? { html: job.htmlResult } : null
        }));
        // setHistory with the database objects
        if (res.data.length > 0) setHistory(formattedHistory);
      } catch (err) { console.error("Could not load history"); }
    };
    fetchHistory();
  }, []);

  // Setup Socket.io real-time listeners
  useEffect(() => {
    socket.on('job-active', ({ id }) => {
      setHistory(prev => prev.map(j => 
        j.id === id ? { ...j, status: 'active' } : j
      ));
    });

    socket.on('job-completed', ({ id, result }) => {
      setHistory(prev => prev.map(j => 
        j.id === id ? { ...j, status: 'completed', result: result } : j
      ));
    });

    return () => {
      socket.off('job-active');
      socket.off('job-completed');
    };
  }, []);

  const handlePersonalize = async (e) => {
    e.preventDefault();
    if (!url || !adText) return;
    
    setLoading(true);
    try {
      const response = await axios.post('http://localhost:5001/api/personalize', {
        url,
        adCreative: adText
      });

      const newJob = {
        id: response.data.jobId,
        url: url,
        time: new Date().toLocaleTimeString(),
        status: response.data.status || 'waiting',
        result: response.data.cachedResult || null
      };

      setHistory([newJob, ...history]);
      setUrl('');
      setAdText('');
    } catch (err) {
      if (err.response && err.response.status === 429) {
        alert("🛑 Rate limit exceeded! Please wait 5 minutes to optimize another page.");
      } else {
        alert("Backend connection failed! Is port 5001 open?");
      }
    } finally {
      setLoading(false);
    }
  };

  const openResult = (htmlContent) => {
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(htmlContent);
      newWindow.document.close();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-blue-500/30 relative overflow-hidden">
      {/* Animated Glowing Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/20 blur-[120px] mix-blend-screen animate-blob z-0 pointer-events-none" />
      <div className="absolute bottom-[10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-600/20 blur-[150px] mix-blend-screen animate-blob z-0 pointer-events-none" style={{ animationDelay: '2s' }} />
      <div className="absolute top-[40%] left-[50%] w-[30%] h-[30%] rounded-full bg-cyan-600/10 blur-[100px] mix-blend-screen animate-blob z-0 pointer-events-none" style={{ animationDelay: '4s' }} />

      {/* Header */}
      <nav className="border-b border-white/5 bg-slate-950/50 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-xl shadow-lg shadow-blue-500/20 ring-1 ring-white/10">
              <Zap size={20} className="text-white fill-white/20" />
            </div>
            <span className="text-2xl font-black tracking-tighter text-white">
              Flash<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">CRO</span>
            </span>
          </div>
          <div className="flex items-center gap-6 text-xs font-semibold text-slate-400 tracking-wide uppercase">
            <span className="flex items-center gap-2">
              <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </div>
              API Online
            </span>
            <span className="flex items-center gap-2">
               <div className="relative flex h-2 w-2">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></span>
              </div>
              Worker Active
            </span>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-16 grid grid-cols-1 lg:grid-cols-12 gap-16">
        
        {/* Left: Input Section */}
        <div className="lg:col-span-5 space-y-10">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-widest backdrop-blur-sm">
              <Sparkles size={12} />
              AI Powered Optimization
            </div>
            <h1 className="text-5xl md:text-6xl font-black text-white leading-[1.1] tracking-tight">
              Personalize your landing page in <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">seconds.</span>
            </h1>
            <p className="text-lg text-slate-400 font-light leading-relaxed max-w-md">
              Enter a URL and your ad goals. Our distributed worker network handles scraping and generative CRO in the background.
            </p>
          </div>

          <form onSubmit={handlePersonalize} className="bg-slate-900/60 p-8 rounded-3xl border border-white/5 shadow-2xl shadow-blue-500/5 backdrop-blur-xl space-y-6 relative group overflow-hidden">
            {/* Subtle glow on form hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            <div className="space-y-2 relative z-10">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2 ml-1">
                <Globe size={14} className="text-blue-400" /> Destination URL
              </label>
              <input
                type="url" required placeholder="https://example.com"
                className="w-full bg-slate-950/50 border border-slate-700/50 focus:border-blue-500/50 p-4 rounded-xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-600 text-sm font-medium shadow-inner"
                value={url} onChange={(e) => setUrl(e.target.value)}
              />
            </div>

            <div className="space-y-2 relative z-10">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2 ml-1">
                <Sparkles size={14} className="text-purple-400" /> Ad Creative Goal
              </label>
              <textarea
                required
                placeholder="e.g. Target millennial home buyers looking for eco-friendly modern houses..."
                className="w-full bg-slate-950/50 border border-slate-700/50 focus:border-purple-500/50 p-4 h-36 rounded-xl focus:ring-4 focus:ring-purple-500/10 outline-none transition-all resize-none placeholder:text-slate-600 text-sm font-medium shadow-inner"
                value={adText} onChange={(e) => setAdText(e.target.value)}
              />
            </div>

            <button
              type="submit" disabled={loading}
              className="relative z-10 w-full group/btn overflow-hidden bg-white text-slate-950 hover:bg-slate-100 font-bold py-4 rounded-xl shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] transition-all flex items-center justify-center gap-2 disabled:bg-slate-800 disabled:text-slate-500 disabled:shadow-none hover:scale-[1.02] active:scale-100"
            >
              {loading ? (
                <span className="flex items-center gap-2"><div className="w-4 h-4 rounded-full border-2 border-slate-500 border-t-slate-200 animate-spin" /> Queuing Job...</span>
              ) : (
                <>
                  <span className="relative z-10 flex items-center gap-2">Launch Worker <Send size={16} className="group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1 transition-transform" /></span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right: Real-time Monitor */}
        <div className="lg:col-span-7 h-full min-h-[500px]">
          <div className="bg-slate-900/40 rounded-3xl border border-white/5 shadow-2xl backdrop-blur-xl h-full flex flex-col overflow-hidden relative group">
            {/* Ambient terminal glow */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent opacity-50" />
            
            <div className="p-5 border-b border-white/5 flex items-center justify-between bg-black/20">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Terminal size={14} /> Distributed Job Monitor
              </h3>
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
              </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto space-y-4">
              {history.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-60">
                  <div className="relative">
                    <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full" />
                    <div className="w-20 h-20 bg-slate-800/50 rounded-full border border-white/5 flex items-center justify-center relative z-10 backdrop-blur-sm shadow-inner">
                      <Terminal className="text-slate-500" size={32} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-slate-300 font-semibold text-lg">Awaiting Instructions</p>
                    <p className="text-slate-500 text-sm max-w-[250px] mx-auto">Submit a URL to dispatch a worker and monitor the orchestration process.</p>
                  </div>
                </div>
              ) : (
                history.map((job, i) => (
                  <div key={job.id + i} className="bg-slate-800/40 border border-white/5 p-5 rounded-2xl flex items-center justify-between animate-in slide-in-from-bottom-4 fade-in duration-500 hover:bg-slate-800/60 transition-colors backdrop-blur-md">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className={`w-12 h-12 rounded-xl border flex items-center justify-center
                          ${job.status === 'completed' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 
                            job.status === 'active' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400 animate-pulse' :
                            'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}
                        >
                          {job.status === 'completed' ? <CheckCircle2 size={24} /> : 
                           job.status === 'active' ? <Activity size={24} /> : 
                           <Terminal size={24} />}
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-slate-900 rounded-full flex items-center justify-center">
                          <div className={`w-2 h-2 rounded-full ${job.status === 'completed' ? 'bg-green-500' : 'bg-blue-500 animate-pulse'}`} />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-black text-white uppercase tracking-tight">Job {String(job.id).substring(0,8)}</p>
                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider
                            ${job.status === 'completed' ? 'bg-green-500/20 text-green-300' : 
                              job.status === 'active' ? 'bg-blue-500/20 text-blue-300' : 
                              job.status === 'failed' ? 'bg-red-500/20 text-red-300' :
                              'bg-amber-500/20 text-amber-300'}`}
                          >
                            {job.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 truncate max-w-[280px]">{job.url}</p>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                       {job.status === 'completed' && job.result?.html ? (
                        <button 
                          onClick={() => openResult(job.result.html)}
                          className="text-[11px] flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg font-bold transition-colors shadow-lg shadow-blue-900/20"
                        >
                          View Page <ExternalLink size={12} />
                        </button>
                       ) : (
                         <p className="text-xs font-mono text-slate-500 mt-2">{job.time}</p>
                       )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;