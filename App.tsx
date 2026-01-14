
import React, { useState, useEffect, useRef } from 'react';
import { GenerationStage, ProductData, GeneratedSlice, ChatMessage } from './types';
import { 
  generateDesignPlan, 
  generateSectionImage, 
  finalizeSectionText,
  sendChatMessageToBrain
} from './services/geminiService';
import StageProgress from './components/StageProgress';

const App: React.FC = () => {
  const [productName, setProductName] = useState('');
  const [specText, setSpecText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [stage, setStage] = useState<GenerationStage>(GenerationStage.IDLE);
  const [resultSlices, setResultSlices] = useState<GeneratedSlice[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [isPreviewVertical, setIsPreviewVertical] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isBrainThinking, setIsBrainThinking] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [chatMessages, isBrainThinking]);

  const handleGenerate = async () => {
    if (!productName || images.length === 0) return alert('이미지와 상품명을 입력하세요.');
    setStage(GenerationStage.THINKING);
    setResultSlices([]);
    setCurrentPage(0);

    try {
      const plan = await generateDesignPlan({ name: productName, specs: specText, images });
      setStage(GenerationStage.GENERATING);

      const slices: GeneratedSlice[] = [];
      for (let i = 0; i < plan.sections.length; i++) {
        const section = plan.sections[i];
        const imgUrl = await generateSectionImage(section.prompt, images[0]);
        const textResult = await finalizeSectionText(imgUrl, { name: productName, specs: specText, images }, section.type, section.title);
        
        slices.push({ 
          url: imgUrl, 
          title: section.title, 
          copy: textResult.copy, 
          description: textResult.description,
          type: section.type as any
        });
        setResultSlices([...slices]);
      }
      setStage(GenerationStage.COMPLETED);
    } catch (err: any) {
      setStage(GenerationStage.ERROR);
      alert(`장애 발생: ${err.message}`);
    }
  };

  const downloadOne = (idx: number) => {
    const slice = resultSlices[idx];
    const canvas = document.createElement('canvas');
    canvas.width = 1080; canvas.height = 1920;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = slice.url;
    img.onload = () => {
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, 1080, 1920);
      const grad = ctx.createLinearGradient(0, 0, 0, 900);
      grad.addColorStop(0, 'rgba(0,0,0,0.95)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, 1080, 900);
      ctx.textAlign = "center"; ctx.fillStyle = "white";
      ctx.font = "900 110px 'Noto Sans KR'";
      ctx.fillText(slice.copy, 540, 300);
      ctx.font = "500 50px 'Noto Sans KR'";
      const words = slice.description.split(' ');
      ctx.fillText(slice.description, 540, 420);
      const link = document.createElement('a');
      link.download = `page_${idx + 1}.png`; link.href = canvas.toDataURL(); link.click();
    };
  };

  const downloadAll = () => {
    resultSlices.forEach((_, i) => setTimeout(() => downloadOne(i), i * 600));
  };

  const updateSliceManual = (idx: number, field: 'copy' | 'description', value: string) => {
    const newSlices = [...resultSlices];
    newSlices[idx] = { ...newSlices[idx], [field]: value };
    setResultSlices(newSlices);
  };

  const handleBrainChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isBrainThinking) return;
    const userMsg: ChatMessage = { role: 'user', text: chatInput, timestamp: Date.now() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsBrainThinking(true);
    try {
      const response = await sendChatMessageToBrain(chatInput, chatMessages, {
        product: { name: productName, specs: specText, images },
        currentSlice: resultSlices[currentPage],
        sliceIndex: currentPage
      });
      setChatMessages(prev => [...prev, { role: 'model', text: response.text, timestamp: Date.now() }]);
      if (response.action) {
        const newSlices = [...resultSlices];
        newSlices[currentPage] = { ...newSlices[currentPage], ...response.action };
        setResultSlices(newSlices);
      }
    } catch (e) {} finally { setIsBrainThinking(false); }
  };

  return (
    <div className="min-h-screen bg-[#030305] text-slate-300 font-sans selection:bg-blue-500/30">
      <header className="bg-[#08080a]/80 backdrop-blur-xl border-b border-white/5 py-4 px-8 sticky top-0 z-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center font-black text-white shadow-lg">B</div>
          <span className="font-black text-white italic uppercase tracking-tight text-sm">Brain Orchestrator <span className="text-blue-500">V.Final</span></span>
        </div>
        <div className="flex gap-4">
          <button onClick={handleGenerate} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-2.5 rounded-xl font-black transition-all text-xs uppercase tracking-widest shadow-xl shadow-blue-600/20 active:scale-95">
            {stage === GenerationStage.IDLE || stage === GenerationStage.COMPLETED ? 'Build Page' : 'Orchestrating...'}
          </button>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-4 space-y-8">
          <section className="bg-[#08080a] p-8 rounded-[32px] border border-white/5 shadow-2xl">
            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-6">Commander Input</h2>
            <div className="space-y-4">
              <input value={productName} onChange={e => setProductName(e.target.value)} placeholder="PRODUCT IDENTITY" className="w-full bg-black/50 border border-white/5 p-4 rounded-2xl text-white text-xs outline-none focus:border-blue-500 transition-all" />
              <textarea value={specText} onChange={e => setSpecText(e.target.value)} placeholder="TECHNICAL SPECIFICATIONS..." rows={4} className="w-full bg-black/50 border border-white/5 p-4 rounded-2xl text-slate-400 text-xs outline-none focus:border-blue-500 resize-none leading-relaxed" />
              <div className="grid grid-cols-4 gap-2">
                {images.map((img, i) => <img key={i} src={img} className="aspect-square object-cover rounded-xl border border-white/10" />)}
                <label className="aspect-square rounded-xl border-2 border-dashed border-white/5 flex items-center justify-center cursor-pointer hover:bg-white/5 text-slate-700 font-black text-xl transition-all">+</label>
                <input type="file" multiple className="hidden" onChange={e => {
                  const files = e.target.files; if (!files) return;
                  Array.from(files).forEach((f: any) => {
                    const r = new FileReader(); r.onload = () => setImages(prev => [...prev, r.result as string]); r.readAsDataURL(f);
                  });
                }} />
              </div>
            </div>
          </section>
          <StageProgress stage={stage} />
          
          {resultSlices.length > 0 && (
            <section className="bg-blue-600/5 p-6 rounded-[32px] border border-blue-500/10 space-y-4">
              <h2 className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Manual Edit</h2>
              <div className="space-y-3">
                <input value={resultSlices[currentPage].copy} onChange={e => updateSliceManual(currentPage, 'copy', e.target.value)} className="w-full bg-black border border-white/5 p-3 rounded-xl text-white text-xs" placeholder="카피 수정" />
                <textarea value={resultSlices[currentPage].description} onChange={e => updateSliceManual(currentPage, 'description', e.target.value)} className="w-full bg-black border border-white/5 p-3 rounded-xl text-slate-400 text-xs" rows={2} placeholder="설명 수정" />
              </div>
            </section>
          )}
        </div>

        <div className="lg:col-span-8 flex flex-col items-center gap-8">
          <div className="flex gap-4 w-full max-w-[480px]">
            <button onClick={() => setIsPreviewVertical(!isPreviewVertical)} className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${isPreviewVertical ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-500'}`}>
              {isPreviewVertical ? 'Single View' : 'Vertical Scroll'}
            </button>
            {resultSlices.length > 0 && (
              <>
                <button onClick={() => downloadOne(currentPage)} className="flex-1 bg-slate-900 border border-white/5 text-white py-4 rounded-2xl text-[10px] font-black uppercase">Partial Save</button>
                <button onClick={downloadAll} className="flex-1 bg-blue-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-blue-600/20">Full Export</button>
              </>
            )}
          </div>

          <div className="w-full max-w-[480px] aspect-[9/16] bg-black rounded-[60px] border-[12px] border-[#121215] shadow-[0_50px_100px_rgba(0,0,0,0.8)] overflow-hidden relative group">
            {resultSlices.length > 0 ? (
              isPreviewVertical ? (
                <div className="h-full overflow-y-auto custom-scrollbar scroll-smooth">
                  {resultSlices.map((s, i) => <SliceView key={i} slice={s} index={i} />)}
                </div>
              ) : (
                <div className="h-full relative">
                  <SliceView slice={resultSlices[currentPage]} index={currentPage} />
                  <div className="absolute inset-x-0 bottom-12 flex justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setCurrentPage(p => Math.max(0, p-1))} className="w-12 h-12 bg-black/80 backdrop-blur-xl border border-white/10 rounded-full text-white">←</button>
                    <button onClick={() => setCurrentPage(p => Math.min(resultSlices.length-1, p+1))} className="w-12 h-12 bg-black/80 backdrop-blur-xl border border-white/10 rounded-full text-white">→</button>
                  </div>
                </div>
              )
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-800 gap-4">
                <div className="w-20 h-20 rounded-3xl bg-slate-900 flex items-center justify-center animate-pulse"><svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg></div>
                <span className="font-black italic uppercase tracking-[0.4em] text-[10px]">Awaiting Core Commands</span>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Brain Chat Bot */}
      <div className={`fixed bottom-10 right-10 z-[100] transition-all duration-500 ease-in-out ${isChatOpen ? 'w-[420px] h-[600px]' : 'w-16 h-16'}`}>
        {!isChatOpen ? (
          <button onClick={() => setIsChatOpen(true)} className="w-full h-full bg-blue-600 rounded-full shadow-[0_0_40px_rgba(37,99,235,0.4)] flex items-center justify-center hover:scale-110 transition-transform">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
          </button>
        ) : (
          <div className="w-full h-full bg-[#08080a]/98 backdrop-blur-3xl border border-white/10 rounded-[40px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            <header className="p-6 border-b border-white/5 flex items-center justify-between">
              <span className="text-[10px] font-black text-white uppercase italic tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                Brain Command Center
              </span>
              <button onClick={() => setIsChatOpen(false)} className="text-slate-600 hover:text-white transition-colors">×</button>
            </header>
            <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {chatMessages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-4 rounded-3xl text-[11px] leading-relaxed shadow-sm ${m.role === 'user' ? 'bg-blue-600 text-white rounded-br-none font-bold' : 'bg-white/5 text-slate-300 border border-white/5 rounded-bl-none'}`}>{m.text}</div>
                </div>
              ))}
              {isBrainThinking && <div className="text-[10px] text-blue-500 font-bold animate-pulse p-4 flex gap-2"><span>오케스트레이터 분석 중</span><span className="animate-bounce">.</span><span className="animate-bounce delay-100">.</span><span className="animate-bounce delay-200">.</span></div>}
            </div>
            <form onSubmit={handleBrainChat} className="p-5 bg-black/50 border-t border-white/5 flex gap-2">
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="명령어를 입력하십시오..." className="flex-1 bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-[11px] text-white outline-none focus:border-blue-500" />
              <button type="submit" className="bg-blue-600 p-4 rounded-2xl text-white shadow-lg shadow-blue-600/20">▲</button>
            </form>
          </div>
        )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #2563eb; border-radius: 10px; }
      `}</style>
    </div>
  );
};

const SliceView: React.FC<{ slice: GeneratedSlice, index: number }> = ({ slice, index }) => (
  <div className="relative w-full aspect-[9/16] bg-black">
    <img src={slice.url} className="w-full h-full object-cover" alt={slice.title} />
    <div className="absolute inset-0 bg-gradient-to-b from-black/95 via-black/30 to-transparent h-[50%]" />
    <div className="absolute top-[12%] left-0 w-full px-10 text-center animate-in fade-in slide-in-from-top-4 duration-700">
      <h2 className="text-white font-black leading-[1.15] mb-4 text-[38px] drop-shadow-[0_10px_20px_rgba(0,0,0,1)]">{slice.copy}</h2>
      <p className="text-white/90 font-bold leading-relaxed text-[18px] drop-shadow-lg">{slice.description}</p>
    </div>
    <div className="absolute top-8 left-8 px-4 py-1.5 bg-blue-600 rounded-full text-[10px] font-black text-white shadow-2xl border border-white/20">
      {slice.type === 'hero' ? 'HERO HIT-SHOT' : slice.type === 'specs' ? 'TECH DATA' : `CORE USP ${index}`}
    </div>
    {slice.type === 'specs' && (
      <div className="absolute inset-x-8 bottom-16 bg-black/60 backdrop-blur-xl border border-white/10 p-6 rounded-3xl">
        <div className="text-[10px] font-bold text-blue-400 mb-2 uppercase tracking-widest">Specifications</div>
        <div className="text-white/80 text-[11px] whitespace-pre-wrap leading-relaxed">{slice.description}</div>
      </div>
    )}
  </div>
);

export default App;
