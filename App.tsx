
import React, { useState, useRef, useEffect } from 'react';
import { TourType, InputMethod, TourPlan, DayPlan, ImagePosition, TimelineItem, Quotation, HistoryRecord } from './types';
import { generateTourPlan, generateImageForDay, generateQuotation } from './services/geminiService';
import ItineraryPreview from './components/ItineraryPreview';
import QuotationEditor from './components/QuotationEditor';

const App: React.FC = () => {
  const [tourType, setTourType] = useState<TourType>(TourType.DOMESTIC);
  const [inputMethod, setInputMethod] = useState<InputMethod>(InputMethod.AUTO);
  const [productName, setProductName] = useState('');
  const [extraContent, setExtraContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<TourPlan | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSummaryMode, setIsSummaryMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageProgress, setImageProgress] = useState<string>('');
  const [pageHeights, setPageHeights] = useState([285, 285, 285, 285, 285]);
  
  // 報價相關狀態
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [costReference, setCostReference] = useState('');
  const [isQuotationLoading, setIsQuotationLoading] = useState(false);
  const [costUploadedFileName, setCostUploadedFileName] = useState<string | null>(null);
  const costFileInputRef = useRef<HTMLInputElement>(null);

  // 歷史紀錄相關狀態
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // 初始化載入歷史紀錄
  useEffect(() => {
    const saved = localStorage.getItem('itinerary_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  // 儲存歷史紀錄到 localStorage
  const saveToHistory = (plan: TourPlan, type: TourType, q?: Quotation | null) => {
    // 檢查是否已有相同標題的紀錄，有的話更新，沒有的話新增
    const existingIdx = history.findIndex(h => h.plan.mainTitle === plan.mainTitle);
    
    const newRecord: HistoryRecord = {
      id: existingIdx >= 0 ? history[existingIdx].id : Date.now().toString(),
      timestamp: Date.now(),
      plan,
      type,
      quotation: q
    };

    let updated;
    if (existingIdx >= 0) {
      updated = [...history];
      updated[existingIdx] = newRecord;
    } else {
      updated = [newRecord, ...history].slice(0, 50);
    }
    
    setHistory(updated);
    localStorage.setItem('itinerary_history', JSON.stringify(updated));
  };

  const deleteFromHistory = (id: string) => {
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    localStorage.setItem('itinerary_history', JSON.stringify(updated));
  };

  const loadFromHistory = (record: HistoryRecord) => {
    setGeneratedPlan(record.plan);
    setTourType(record.type);
    setQuotation(record.quotation || null);
    setIsEditing(true);
    setShowHistory(false);
  };

  // 檔案上傳相關狀態
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [fileParsing, setFileParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseFile = async (file: File): Promise<string> => {
    let text = '';
    const extension = file.name.split('.').pop()?.toLowerCase();

    if (extension === 'txt' || extension === 'md') {
      text = await file.text();
    } 
    else if (extension === 'docx') {
      // @ts-ignore
      const mammoth = await import('https://esm.sh/mammoth');
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      text = result.value;
    } 
    else if (extension === 'xlsx' || extension === 'xls') {
      // @ts-ignore
      const XLSX = await import('https://esm.sh/xlsx');
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        text += XLSX.utils.sheet_to_txt(sheet) + '\n';
      });
    } 
    else if (extension === 'pdf') {
      // @ts-ignore
      const pdfjs = await import('https://esm.sh/pdfjs-dist@4.0.379');
      pdfjs.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.mjs`;
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n';
      }
      text = fullText;
    } else {
      throw new Error('不支援的檔案格式，請上傳 PDF, Word, Excel 或純文字檔。');
    }
    return text;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setFileParsing(true);
    setError(null);

    try {
      const text = await parseFile(file);
      setExtraContent(text);
    } catch (err: any) {
      setError(`檔案解析失敗: ${err.message}`);
      setUploadedFileName(null);
    } finally {
      setFileParsing(false);
    }
  };

  const handleCostFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCostUploadedFileName(file.name);
    setError(null);

    try {
      const text = await parseFile(file);
      setCostReference(text);
    } catch (err: any) {
      setError(`成本檔案解析失敗: ${err.message}`);
      setCostUploadedFileName(null);
    }
  };

  const handleGenerateQuotation = async () => {
    if (!generatedPlan) return;
    setIsQuotationLoading(true);
    setError(null);
    try {
      const q = await generateQuotation(generatedPlan, costReference);
      setQuotation(q);
      // 更新歷史紀錄中的報價
      if (generatedPlan) {
        const updatedHistory = history.map(h => {
          if (h.plan.mainTitle === generatedPlan.mainTitle) {
            return { ...h, quotation: q };
          }
          return h;
        });
        setHistory(updatedHistory);
        localStorage.setItem('itinerary_history', JSON.stringify(updatedHistory));
      }
    } catch (err: any) {
      setError('報價生成失敗，請稍後再試。');
    } finally {
      setIsQuotationLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!productName.trim()) {
      setError('請輸入旅遊商品名稱');
      return;
    }

    setIsLoading(true);
    setError(null);
    setImageProgress('正在構思行程精華...');
    
    try {
      const plan = await generateTourPlan(tourType, productName, extraContent);
      
      setImageProgress('正在根據每一天具體行程構思視覺圖...');
      const updatedDays = await Promise.all(plan.days.map(async (day) => {
        try {
          const count = day.imageCount || 1;
          const imagePromises = [];
          
          const typeLabel = tourType === TourType.DOMESTIC ? "Taiwan" : "International";
          const dayContext = `${typeLabel} travel, Day ${day.day}: ${day.title}. ${day.description.slice(0, 150)}`;

          for (let i = 0; i < count; i++) {
            const variations = ["wide shot", "closeup details", "vibrant scenery", "ambient atmosphere"];
            const p = `${dayContext}, ${variations[i % variations.length]}`;
            imagePromises.push(generateImageForDay(p));
          }
          const base64Images = await Promise.all(imagePromises);
          return { ...day, customImages: base64Images };
        } catch (e) {
          return { ...day, customImages: [] };
        }
      }));

      setGeneratedPlan({ ...plan, days: updatedDays });
      setIsEditing(true); 
      saveToHistory(plan, tourType, null);
    } catch (err: any) {
      setError('生成失敗。請檢查 API Key 是否正確注入，或稍後再試。');
    } finally {
      setIsLoading(false);
      setImageProgress('');
    }
  };

  const handleDownloadHtml = () => {
    if (!generatedPlan) return;
    const content = document.getElementById('itinerary-preview-container')?.innerHTML;
    if (!content) return;

    const fullHtml = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${generatedPlan.mainTitle}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Noto Sans TC', sans-serif; background-color: #f8fafc; padding: 2rem 1rem; }
        @media print {
            .no-print { display: none !important; }
            .print-break-inside-avoid { page-break-inside: avoid; }
            body { background-color: white !important; margin: 0 !important; padding: 0 !important; }
            #itinerary-preview-container {
                width: 100% !important;
                margin: 0 !important;
                padding: 20px !important;
                box-shadow: none !important;
                border: none !important;
                border-radius: 0 !important;
            }
        }
    </style>
</head>
<body>
    <div class="max-w-5xl mx-auto">${content}</div>
    <div class="text-center mt-8 no-print">
        <button onclick="window.print()" style="background: #059669; color: white; padding: 0.75rem 2rem; border-radius: 1rem; font-weight: 900; cursor: pointer; border: none; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">🖨️ 列印或儲存為 PDF</button>
    </div>
</body>
</html>`;

    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${generatedPlan.mainTitle.replace(/\s+/g, '_')}_行程表.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadSummaryHtml = () => {
    if (!generatedPlan) return;
    const content = document.getElementById('itinerary-summary-container')?.innerHTML;
    if (!content) return;

    const fullHtml = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${generatedPlan.mainTitle} - 簡表</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Noto Sans TC', sans-serif; background-color: white; padding: 0; margin: 0; }
        @media print {
            .no-print { display: none !important; }
            body { background-color: white !important; margin: 0 !important; padding: 0 !important; }
            @page { size: A4; margin: 10mm; }
            #itinerary-summary-container { 
                width: 210mm !important; 
                margin: 0 auto !important; 
                padding: 0 !important;
                box-shadow: none !important;
                border: none !important;
            }
        }
    </style>
</head>
<body>
    <div style="max-width: 210mm; margin: 0 auto;">${content}</div>
    <div class="text-center mt-8 no-print" style="padding-bottom: 50px;">
        <button onclick="window.print()" style="background: #0f172a; color: white; padding: 0.75rem 2rem; border-radius: 1rem; font-weight: 900; cursor: pointer; border: none; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">🖨️ 列印 A4 簡表</button>
    </div>
</body>
</html>`;

    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${generatedPlan.mainTitle.replace(/\s+/g, '_')}_A4一頁簡表.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDirectPrint = () => {
    if (!generatedPlan) return;
    const content = document.getElementById(isSummaryMode ? 'itinerary-summary-container' : 'itinerary-preview-container')?.innerHTML;
    if (!content) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("彈出視窗被攔截，請允許此網站開啟彈出視窗，或使用「下載 HTML」後再列印。");
      return;
    }

    const styles = isSummaryMode ? `
        body { font-family: 'Noto Sans TC', sans-serif; background-color: white; padding: 0; margin: 0; -webkit-print-color-adjust: exact; }
        .no-print { display: none !important; }
        @media print {
            body { background-color: white !important; margin: 0 !important; padding: 0 !important; }
            .no-print { display: none !important; }
            @page { size: A4; margin: 10mm; }
            /* 徹底移除可能導致 PostScript fill 錯誤的屬性 */
            * { 
                box-shadow: none !important; 
                text-shadow: none !important; 
                filter: none !important;
                backdrop-filter: none !important;
                border-radius: 0 !important;
                clip-path: none !important;
            }
            img {
                border-radius: 0 !important;
                clip-path: none !important;
                -webkit-print-color-adjust: exact;
            }
            .bg-gradient-to-t, .bg-gradient-to-b, .bg-gradient-to-r, .bg-gradient-to-l {
                background: none !important;
                background-color: rgba(0,0,0,0.1) !important;
            }
            #itinerary-summary-container { 
                width: 210mm !important; 
                margin: 0 auto !important; 
                padding: 0 0 15mm 0 !important; 
                border: none !important;
            }
            .print-break-after { 
                page-break-after: always; 
                margin-bottom: 15mm;
            }
        }
    ` : `
        body { font-family: 'Noto Sans TC', sans-serif; background-color: #f8fafc; padding: 2rem 1rem; -webkit-print-color-adjust: exact; }
        .no-print { display: none !important; }
        @media print {
            body { background-color: white !important; margin: 0 !important; padding: 0 !important; }
            .no-print { display: none !important; }
            @page { size: A4; margin: 10mm; }
            /* 徹底移除可能導致 PostScript fill 錯誤的屬性 */
            * { 
                box-shadow: none !important; 
                text-shadow: none !important; 
                filter: none !important;
                backdrop-filter: none !important;
                border-radius: 0 !important;
                clip-path: none !important;
            }
            img {
                border-radius: 0 !important;
                clip-path: none !important;
                -webkit-print-color-adjust: exact;
            }
            .bg-gradient-to-t, .bg-gradient-to-b, .bg-gradient-to-r, .bg-gradient-to-l {
                background: none !important;
                background-color: rgba(0,0,0,0.1) !important;
            }
            #itinerary-preview-container {
                width: 100% !important;
                margin: 0 !important;
                padding: 20px !important;
                border: none !important;
                border-radius: 0 !important;
            }
        }
    `;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <base href="${window.location.origin}">
          <title>${generatedPlan.mainTitle}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;700&display=swap" rel="stylesheet">
          <style>${styles}</style>
        </head>
        <body>
          <div id="${isSummaryMode ? 'itinerary-summary-container' : 'itinerary-preview-container'}">${content}</div>
          <script>
            // 等待所有圖片載入完成後再列印
            async function waitForImages() {
              const images = document.querySelectorAll('img');
              const promises = Array.from(images).map(img => {
                if (img.complete && img.naturalHeight !== 0) return Promise.resolve();
                return new Promise(resolve => {
                  img.onload = resolve;
                  img.onerror = resolve;
                });
              });
              await Promise.all(promises);
            }

            window.onload = async function() {
              await waitForImages();
              // 給 Tailwind 一點時間處理樣式
              setTimeout(function() {
                window.stop(); // 停止任何剩餘的載入
                window.print();
                window.onafterprint = function() { window.close(); };
              }, 2000); // 增加到 2 秒以確保穩定
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const updateDayField = (index: number, field: keyof DayPlan, value: any) => {
    setGeneratedPlan(prev => {
      if (!prev) return prev;
      const newDays = [...prev.days];
      newDays[index] = { ...newDays[index], [field]: value };
      return { ...prev, days: newDays };
    });
  };

  const updatePlanField = (field: keyof TourPlan, value: any) => {
    setGeneratedPlan(prev => {
      if (!prev) return prev;
      return { ...prev, [field]: value };
    });
  };

  const updateTimelineItem = (dayIdx: number, itemIdx: number, field: keyof TimelineItem, value: string) => {
    setGeneratedPlan(prev => {
      if (!prev) return prev;
      const newDays = [...prev.days];
      const newTimeline = [...newDays[dayIdx].timeline];
      newTimeline[itemIdx] = { ...newTimeline[itemIdx], [field]: value };
      newDays[dayIdx].timeline = newTimeline;
      return { ...prev, days: newDays };
    });
  };

  const addTimelineItem = (dayIdx: number) => {
    setGeneratedPlan(prev => {
      if (!prev) return prev;
      const newDays = [...prev.days];
      newDays[dayIdx].timeline = [...newDays[dayIdx].timeline, { activity: '新活動內容' }];
      return { ...prev, days: newDays };
    });
  };

  const removeTimelineItem = (dayIdx: number, itemIdx: number) => {
    setGeneratedPlan(prev => {
      if (!prev) return prev;
      const newDays = [...prev.days];
      newDays[dayIdx].timeline = newDays[dayIdx].timeline.filter((_, i) => i !== itemIdx);
      return { ...prev, days: newDays };
    });
  };

  const handleDayImageUpload = (index: number, files: FileList | null) => {
    if (!files) return;
    const readers = Array.from(files).map(file => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });
    });
    Promise.all(readers).then(base64Images => {
      setGeneratedPlan(prev => {
        if (!prev) return prev;
        const existing = (prev.days[index].customImages || []);
        const combined = [...existing, ...base64Images].slice(0, 4);
        
        const newDays = [...prev.days];
        newDays[index] = { 
          ...newDays[index], 
          customImages: combined,
          imageCount: combined.length 
        };
        return { ...prev, days: newDays };
      });
    });
  };

  const removeImage = (dayIdx: number, imgIdx: number) => {
    setGeneratedPlan(prev => {
      if (!prev) return prev;
      const newDays = [...prev.days];
      const newImages = [...(newDays[dayIdx].customImages || [])].filter((_, i) => i !== imgIdx);
      newDays[dayIdx].customImages = newImages;
      newDays[dayIdx].imageCount = newImages.length;
      return { ...prev, days: newDays };
    });
  };

  const [regeneratingDays, setRegeneratingDays] = useState<Record<number, boolean>>({});

  const regenerateDayImages = async (idx: number) => {
    if (!generatedPlan) return;
    const day = generatedPlan.days[idx];
    const count = day.imageCount || 1;
    
    setRegeneratingDays(prev => ({ ...prev, [idx]: true }));
    
    // 清空當前圖片以顯示載入感
    updateDayField(idx, 'customImages', []);
    
    try {
      const typeLabel = tourType === TourType.DOMESTIC ? "Taiwan" : "International";
      const dayContext = `${typeLabel} travel, Day ${day.day}: ${day.title}. ${day.description.slice(0, 150)}`;
      
      const imagePromises = [];
      for (let i = 0; i < count; i++) {
        const variations = ["scenic vista", "cultural landmark", "local vibe"];
        imagePromises.push(generateImageForDay(`${dayContext}, ${variations[i % variations.length]}`));
      }
      const base64Images = await Promise.all(imagePromises);
      updateDayField(idx, 'customImages', base64Images);
    } catch (e) {
      console.error(e);
      alert("圖片重新生成失敗，請檢查網路連線或 API 額度。");
    } finally {
      setRegeneratingDays(prev => ({ ...prev, [idx]: false }));
    }
  };

  if (generatedPlan && isEditing) {
    return (
      <div className="min-h-screen bg-slate-50 py-10 px-4 no-print font-sans">
        <div className="max-w-6xl mx-auto">
          {/* Top Bar */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <div>
              <h2 className="text-3xl font-black text-slate-800 tracking-tight">🛠️ 行程細節調整</h2>
              <p className="text-slate-500 mt-1 text-sm">左側調整文字內容，右側管理視覺圖片。</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setGeneratedPlan(null)} className="px-5 py-2.5 text-slate-500 font-bold hover:text-red-500 transition-colors">取消重來</button>
              <button onClick={() => setIsEditing(false)} className="px-10 py-3 bg-blue-600 text-white rounded-2xl font-black shadow-xl hover:bg-blue-700 transition-all active:scale-95 flex items-center gap-2">
                <span>預覽行程表樣式</span>
                <span className="text-xl">🚀</span>
              </button>
            </div>
          </div>

          {/* General Information Editor */}
          <div className="bg-white p-8 md:p-12 rounded-[3rem] shadow-sm border border-slate-100 mb-16 space-y-8">
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-blue-600 text-white p-3 rounded-2xl text-xl">📋</div>
              <h3 className="text-2xl font-black text-slate-800">基本資訊設定</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">行程總標題</label>
                <input 
                  className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-blue-500 outline-none font-bold text-lg transition-all"
                  value={generatedPlan.mainTitle}
                  onChange={e => updatePlanField('mainTitle', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">行銷副標題</label>
                <input 
                  className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-blue-500 outline-none font-bold text-lg transition-all"
                  value={generatedPlan.marketingSubtitle}
                  onChange={e => updatePlanField('marketingSubtitle', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">出發資訊</label>
                <input 
                  className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-blue-500 outline-none font-bold text-lg transition-all"
                  value={generatedPlan.departureInfo}
                  onChange={e => updatePlanField('departureInfo', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">城市/國家</label>
                <input 
                  className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-blue-500 outline-none font-bold text-lg transition-all"
                  value={generatedPlan.countryCity || ''}
                  onChange={e => updatePlanField('countryCity', e.target.value)}
                />
              </div>
            </div>

            {generatedPlan.flightInfo && (
              <div className="pt-6 border-t border-slate-100">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">✈️ 航班資訊</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-slate-500">去程航班</label>
                    <input 
                      className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-blue-500 outline-none font-bold text-sm transition-all"
                      value={generatedPlan.flightInfo.departure}
                      onChange={e => updatePlanField('flightInfo', { ...generatedPlan.flightInfo, departure: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-slate-500">回程航班</label>
                    <input 
                      className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-blue-500 outline-none font-bold text-sm transition-all"
                      value={generatedPlan.flightInfo.return}
                      onChange={e => updatePlanField('flightInfo', { ...generatedPlan.flightInfo, return: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Days Loop */}
          <div className="space-y-16">
            {generatedPlan.days.map((day, idx) => (
              <div key={idx} className="bg-white p-8 md:p-12 rounded-[3rem] shadow-sm border border-slate-100 transition-all hover:shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-2 h-full bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                
                <div className="flex flex-col lg:flex-row gap-12 xl:gap-20">
                  {/* LEFT: CONTENT SECTION */}
                  <div className="flex-1 space-y-10">
                    {/* Header */}
                    <div className="flex items-center gap-6">
                      <div className="bg-slate-900 text-white w-14 h-14 flex items-center justify-center rounded-2xl font-black text-2xl shadow-2xl flex-shrink-0">D{day.day}</div>
                      <div className="flex-1 border-b-2 border-slate-100 focus-within:border-blue-500 transition-all py-1">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">當日行程標題</label>
                        <input className="w-full text-2xl font-black outline-none bg-transparent" value={day.title} onChange={e => updateDayField(idx, 'title', e.target.value)}/>
                      </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-3">
                       <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                         <span>✍️ 當日精華描述</span>
                         <span className="h-px flex-1 bg-slate-100"></span>
                       </label>
                       <textarea className="w-full h-32 p-6 rounded-[2rem] bg-slate-50 border-2 border-transparent focus:border-blue-100 focus:bg-white text-sm text-slate-600 outline-none resize-none transition-all leading-relaxed font-medium" value={day.description} onChange={e => updateDayField(idx, 'description', e.target.value)}/>
                    </div>

                    {/* Timeline Editor */}
                    <div className="space-y-4">
                       <div className="flex justify-between items-center">
                          <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <span>⏱️ 細部行程</span>
                            <span className="h-px w-20 bg-slate-100"></span>
                          </label>
                          <button onClick={() => addTimelineItem(idx)} className="text-[10px] bg-slate-900 text-white px-4 py-1.5 rounded-full font-black hover:bg-blue-600 transition-colors">+ 新增活動</button>
                       </div>
                       <div className="grid grid-cols-1 gap-3">
                          {day.timeline.map((item, tIdx) => (
                             <div key={tIdx} className="flex gap-3 group/item bg-slate-50 p-3 rounded-2xl hover:bg-slate-100 transition-colors border border-slate-100">
                                
                                <input className="flex-1 p-2.5 bg-white rounded-xl border-none text-xs font-bold text-slate-700 outline-none shadow-sm" value={item.activity} onChange={(e) => updateTimelineItem(idx, tIdx, 'activity', e.target.value)} />
                                <button onClick={() => removeTimelineItem(idx, tIdx)} className="text-slate-300 hover:text-red-500 transition-colors p-2 text-sm">✕</button>
                             </div>
                          ))}
                       </div>
                    </div>

                    {/* Meals & Accomm Group */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-slate-100">
                       <div className="space-y-4">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">🍱 餐食內容</label>
                          <div className="space-y-2">
                             {['breakfast', 'lunch', 'dinner'].map((meal) => (
                                <div key={meal} className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100/50">
                                   <span className="text-[10px] font-black text-blue-500 w-8">{meal === 'breakfast' ? '早餐' : meal === 'lunch' ? '午餐' : '晚餐'}</span>
                                   <input className="flex-1 bg-transparent border-none text-xs font-bold outline-none text-slate-700" value={(day.meals as any)[meal]} onChange={(e) => {
                                      const newMeals = { ...day.meals, [meal]: e.target.value };
                                      updateDayField(idx, 'meals', newMeals);
                                   }} />
                                </div>
                             ))}
                          </div>
                       </div>
                       <div className="space-y-4">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">🏨 住宿飯店</label>
                          <div className="relative group/input h-full">
                            <textarea className="w-full h-[116px] p-5 bg-slate-900 text-white rounded-3xl font-bold text-sm outline-none shadow-2xl focus:ring-4 focus:ring-blue-500/20 transition-all resize-none" value={day.accommodation} onChange={(e) => updateDayField(idx, 'accommodation', e.target.value)} />
                            <div className="absolute bottom-4 right-4 text-[10px] text-slate-500 font-bold opacity-0 group-focus-within/input:opacity-100">編輯住宿名稱</div>
                          </div>
                       </div>
                    </div>
                  </div>
                  
                  {/* RIGHT: IMAGE SECTION */}
                  <div className="lg:w-80 xl:w-96 flex-shrink-0">
                    <div className="bg-slate-50 rounded-[2.5rem] p-8 space-y-8 border border-slate-100 sticky top-10">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">📸 圖片排版位置</label>
                        <div className="flex gap-1 bg-slate-200 p-1.5 rounded-2xl">
                          {(['left', 'right', 'bottom'] as ImagePosition[]).map(pos => (
                            <button key={pos} onClick={() => updateDayField(idx, 'imagePosition', pos)} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${day.imagePosition === pos ? 'bg-white shadow-lg text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>{pos}</button>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex justify-between items-center mb-4">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">🖼️ 展示數量：{day.imageCount ?? 1}</label>
                          <button 
                            onClick={() => regenerateDayImages(idx)} 
                            disabled={regeneratingDays[idx]}
                            className={`text-[10px] px-4 py-1.5 rounded-full font-black shadow-lg transition-all active:scale-95 flex items-center gap-1.5 ${regeneratingDays[idx] ? 'bg-slate-400 cursor-not-allowed text-white' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200'}`}
                          >
                            <span className={regeneratingDays[idx] ? 'animate-spin' : ''}>{regeneratingDays[idx] ? '⏳' : '✨'}</span>
                            <span>{regeneratingDays[idx] ? '生成中...' : '重新生成'}</span>
                          </button>
                        </div>
                        <div className="flex items-center gap-4">
                          <input type="range" min="0" max="4" step="1" className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" value={day.imageCount ?? 1} onChange={(e) => updateDayField(idx, 'imageCount', parseInt(e.target.value))}/>
                          <span className="text-xs font-black text-slate-400">{day.imageCount ?? 1}</span>
                        </div>
                      </div>

                      <div className="space-y-4">
                         <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">當前圖片庫</label>
                         <div className="grid grid-cols-2 gap-3">
                            {day.customImages && day.customImages.length > 0 && day.customImages.map((img, i) => (
                               <div key={`edit-img-${idx}-${i}`} className="relative aspect-square group/img">
                                  <img src={img} className="w-full h-full rounded-2xl object-cover border-4 border-white shadow-sm transition-transform group-hover/img:scale-95" alt="day preview"/>
                                  <button onClick={() => removeImage(idx, i)} className="absolute -top-2 -right-2 bg-red-500 text-white w-7 h-7 rounded-full text-xs font-black shadow-lg opacity-0 group-hover/img:opacity-100 transition-all scale-75 group-hover/img:scale-100 hover:bg-red-600">✕</button>
                                  <div className="absolute inset-0 bg-blue-600/10 opacity-0 group-hover/img:opacity-100 rounded-2xl transition-opacity pointer-events-none"></div>
                               </div>
                            ))}
                            {(!day.customImages || day.customImages.length < 4) && (
                               <label className="aspect-square rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:bg-white hover:border-blue-400 hover:text-blue-500 transition-all group/upload">
                                  <span className="text-2xl text-slate-300 group-hover/upload:text-blue-400 transition-colors mb-1">+</span>
                                  <span className="text-[8px] font-black text-slate-400 group-hover/upload:text-blue-500">上傳圖片</span>
                                  <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleDayImageUpload(idx, e.target.files)}/>
                                </label>
                            )}
                         </div>
                         <p className="text-[9px] text-slate-400 text-center font-medium">點擊上方「+」可手動更換此日圖片</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Action Bar */}
          <div className="mt-16 flex justify-center pb-20">
             <button onClick={() => setIsEditing(false)} className="px-20 py-5 bg-slate-900 text-white rounded-[2rem] font-black text-xl shadow-2xl hover:bg-blue-600 transition-all active:scale-95 flex items-center gap-4">
                <span>完成調整，查看成果</span>
                <span className="text-2xl animate-bounce-right">➡️</span>
             </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4 font-sans">
      <div className="w-full max-w-4xl no-print">
        <div className="text-center mb-10">
          <div className="inline-block bg-blue-600 text-white px-3 py-1 rounded-full text-[10px] font-bold mb-3 tracking-widest uppercase shadow-lg shadow-blue-100">Eagle AI Studio</div>
          <h1 className="text-4xl font-black text-slate-900 mb-2 tracking-tight">大鷹旅遊-行程簡表</h1>
          <p className="text-slate-500 font-medium">不需部署即可透過 AI 快速產出精美企劃書</p>
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-xl p-8 mb-8 border border-slate-100">
          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-1 space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">企劃類型</label>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button onClick={() => setTourType(TourType.DOMESTIC)} className={`flex-1 py-2 rounded-lg font-black text-xs transition-all ${tourType === TourType.DOMESTIC ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>國內團體</button>
                  <button onClick={() => setTourType(TourType.INTERNATIONAL)} className={`flex-1 py-2 rounded-lg font-black text-xs transition-all ${tourType === TourType.INTERNATIONAL ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>國外團體</button>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">內容來源</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: InputMethod.AUTO, label: 'AI 生成', icon: '✨' },
                    { id: InputMethod.TEXT, label: '文字錄入', icon: '✍️' },
                    { id: InputMethod.FILE, label: '上傳檔案', icon: '📎' },
                  ].map((m) => (
                    <button key={m.id} onClick={() => setInputMethod(m.id)} className={`py-3 rounded-xl border-2 flex flex-col items-center transition-all ${inputMethod === m.id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-100 text-slate-400'}`}>
                      <span className="text-lg mb-1">{m.icon}</span>
                      <span className="text-[8px] font-black uppercase tracking-widest">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-[1.5] space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">旅遊商品名稱 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="例如：南投清境奢華三日遊"
                  className="w-full px-5 py-3 rounded-xl border-2 border-slate-100 focus:border-blue-500 outline-none font-bold text-base transition-all"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                />
              </div>

              {inputMethod === InputMethod.TEXT && (
                <textarea
                  placeholder="輸入景點重點或特殊需求..."
                  className="w-full h-24 px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-blue-500 outline-none text-sm"
                  value={extraContent}
                  onChange={(e) => setExtraContent(e.target.value)}
                />
              )}

              {inputMethod === InputMethod.FILE && (
                <div className="space-y-4">
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={`w-full h-24 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all ${uploadedFileName ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50'}`}
                  >
                    {fileParsing ? (
                      <div className="animate-pulse text-blue-600 font-bold text-sm">正在深度擷取文字資料...</div>
                    ) : uploadedFileName ? (
                      <>
                        <span className="text-blue-600 font-bold text-sm">✅ {uploadedFileName}</span>
                        <span className="text-[10px] text-slate-400 mt-1">點擊更換檔案 (支援 PDF, Word, Excel, MD)</span>
                      </>
                    ) : (
                      <>
                        <span className="text-slate-400 font-bold text-sm">📎 點擊上傳參考文件</span>
                        <span className="text-[10px] text-slate-300 mt-1">支援擷取內容：PDF, Word, Excel, Markdown</span>
                      </>
                    )}
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.docx,.xlsx,.xls,.txt,.md" onChange={handleFileUpload} />
                  
                  {extraContent && (
                    <div className="bg-slate-100 p-3 rounded-lg">
                      <div className="flex justify-between items-center mb-1">
                         <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">擷取結果預覽 ({extraContent.length} 字)</span>
                         <button onClick={() => { setExtraContent(''); setUploadedFileName(null); }} className="text-[9px] text-red-500 font-bold">清除資料</button>
                      </div>
                      <p className="text-[10px] text-slate-500 line-clamp-2 italic">{extraContent}</p>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={isLoading || fileParsing}
                className={`w-full py-4 rounded-2xl text-white font-black text-lg shadow-xl transition-all ${isLoading || fileParsing ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-95 shadow-blue-200'}`}
              >
                {isLoading ? (
                  <div className="flex flex-col items-center">
                    <span className="text-sm">處理中，請稍候...</span>
                    <span className="text-[9px] font-normal opacity-75 mt-1">{imageProgress}</span>
                  </div>
                ) : '🚀 開始 AI 企劃生成'}
              </button>

              {history.length > 0 && (
                <button 
                  onClick={() => setShowHistory(true)}
                  className="w-full mt-4 py-3 rounded-2xl text-slate-600 font-bold text-sm bg-slate-100 hover:bg-slate-200 transition-all"
                >
                  📜 查看歷史紀錄 ({history.length})
                </button>
              )}
            </div>
          </div>
        </div>
        {error && <div className="bg-red-50 text-red-700 p-4 rounded-xl mb-8 font-bold text-center border-l-4 border-red-500">{error}</div>}
      </div>

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black text-slate-800">歷史紀錄</h3>
                <p className="text-slate-400 text-sm">保留在您的設備上的最近 50 筆行程</p>
              </div>
              <button onClick={() => setShowHistory(false)} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-all">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {history.map((record) => (
                <div key={record.id} className="group bg-slate-50 hover:bg-white hover:shadow-lg p-5 rounded-2xl border border-slate-100 transition-all flex justify-between items-center">
                  <div className="cursor-pointer flex-1" onClick={() => loadFromHistory(record)}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded ${record.type === TourType.DOMESTIC ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                        {record.type === TourType.DOMESTIC ? '國內' : '國外'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">{new Date(record.timestamp).toLocaleString()}</span>
                    </div>
                    <h4 className="font-bold text-slate-800 line-clamp-1">{record.plan.mainTitle}</h4>
                    <p className="text-xs text-slate-500">{record.plan.days.length} 天行程 {record.quotation ? '• 已包含報價' : ''}</p>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); deleteFromHistory(record.id); }}
                    className="opacity-0 group-hover:opacity-100 p-2 text-red-400 hover:text-red-600 transition-all"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {generatedPlan && !isEditing && (
        <div className="w-full flex flex-col items-center animate-in fade-in duration-700">
          <div className="w-full max-w-5xl flex flex-col md:flex-row justify-between items-center mb-6 no-print px-4 gap-4">
            <div className="flex gap-2">
              <button onClick={() => setIsEditing(true)} className="bg-slate-200 text-slate-700 px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-300 transition-all shadow-sm">✏️ 修改內容</button>
              <button 
                onClick={() => {
                  if (generatedPlan) {
                    saveToHistory(generatedPlan, tourType, quotation);
                    alert("已儲存至歷史紀錄");
                  }
                }} 
                className="bg-white text-emerald-600 border border-emerald-200 px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-50 transition-all shadow-sm"
              >
                💾 儲存紀錄
              </button>
              <button 
                onClick={() => setIsSummaryMode(!isSummaryMode)} 
                className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm ${isSummaryMode ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 border border-slate-200'}`}
              >
                {isSummaryMode ? '📋 切換回完整版' : '📄 切換 A4 簡表模式'}
              </button>
            </div>
            <div className="flex items-center gap-3">
               {isSummaryMode && (
                 <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm mr-2">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">全局高度: {pageHeights[0]}mm</span>
                   <input 
                     type="range" 
                     min="200" 
                     max="400" 
                     step="1" 
                     value={pageHeights[0]} 
                     onChange={(e) => setPageHeights(Array(5).fill(parseInt(e.target.value)))}
                     className="w-24 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                   />
                 </div>
               )}
               <button onClick={isSummaryMode ? handleDownloadSummaryHtml : handleDownloadHtml} className="bg-slate-800 text-white px-6 py-3.5 rounded-2xl font-black hover:bg-black shadow-xl transition-all flex items-center gap-2 text-sm">
                  🌐 下載 {isSummaryMode ? 'A4 簡表' : 'HTML 網頁'}
               </button>
                <button 
                  onClick={handleDirectPrint} 
                  className="bg-emerald-600 text-white px-8 py-3.5 rounded-2xl font-black hover:bg-emerald-700 shadow-2xl transition-all flex items-center gap-2 text-sm"
                >
                  🖨️ 直接列印 / 儲存 PDF
                </button>
            </div>
          </div>
          <div id={isSummaryMode ? "itinerary-summary-container" : "itinerary-preview-container"} className="w-full mb-16">
            <ItineraryPreview 
              plan={generatedPlan} 
              type={tourType} 
              isSummary={isSummaryMode}
              onUpdatePlan={updatePlanField}
              onUpdateDay={updateDayField}
              pageHeights={pageHeights}
              onUpdatePageHeight={(idx, h) => {
                const newHeights = [...pageHeights];
                newHeights[idx] = h;
                setPageHeights(newHeights);
              }}
            />
          </div>

          {/* Quotation Skill Section */}
          <div className="w-full max-w-5xl mb-20 no-print">
            <div className="bg-white rounded-[2.5rem] shadow-xl p-8 md:p-12 border border-slate-100">
              <div className="flex items-center gap-4 mb-8">
                <div className="bg-emerald-600 text-white p-3 rounded-2xl text-xl">📊</div>
                <div>
                  <h3 className="text-2xl font-black text-slate-800">預算與報價技能</h3>
                  <p className="text-slate-500 text-sm">根據行程自動估算成本，並支援手動微調模擬。</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">成本參考文件 (選填)</label>
                  <div 
                    onClick={() => costFileInputRef.current?.click()}
                    className={`w-full h-32 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all ${costUploadedFileName ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-emerald-400 hover:bg-slate-50'}`}
                  >
                    {costUploadedFileName ? (
                      <span className="text-emerald-600 font-bold text-sm">✅ {costUploadedFileName}</span>
                    ) : (
                      <>
                        <span className="text-slate-400 font-bold text-sm">📎 上傳成本參考檔</span>
                        <span className="text-[10px] text-slate-300 mt-1">支援 PDF, Word, Excel, TXT</span>
                      </>
                    )}
                  </div>
                  <input type="file" ref={costFileInputRef} className="hidden" accept=".pdf,.docx,.xlsx,.xls,.txt,.md" onChange={handleCostFileUpload} />
                </div>
                <div className="flex flex-col justify-end">
                  <button
                    onClick={handleGenerateQuotation}
                    disabled={isQuotationLoading}
                    className={`w-full py-4 rounded-2xl text-white font-black text-lg shadow-xl transition-all ${isQuotationLoading ? 'bg-slate-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 shadow-emerald-100'}`}
                  >
                    {isQuotationLoading ? '正在精算成本中...' : '💰 生成自動報價單'}
                  </button>
                </div>
              </div>

              {quotation && (
                <div className="mt-12 animate-in slide-in-from-bottom duration-500">
                  <QuotationEditor 
                    quotation={quotation} 
                    onUpdate={setQuotation}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
