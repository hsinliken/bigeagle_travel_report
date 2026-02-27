
import React from 'react';
import { TourPlan, TourType, DayPlan } from '../types';

interface Props {
  plan: TourPlan;
  type: TourType;
  isSummary?: boolean;
  pageHeights?: number[];
  onUpdatePageHeight?: (index: number, height: number) => void;
  onUpdatePlan?: (field: keyof TourPlan, value: any) => void;
  onUpdateDay?: (index: number, field: keyof DayPlan, value: any) => void;
}

const ItineraryPreview: React.FC<Props> = ({ plan, type, isSummary = false, pageHeights = [285, 285, 285, 285, 285], onUpdatePageHeight, onUpdatePlan, onUpdateDay }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);

  const handleLineMouseDown = (e: React.MouseEvent, index: number) => {
    if (!onUpdatePageHeight || !containerRef.current) return;
    e.preventDefault();
    
    const startY = e.clientY;
    const startHeight = pageHeights[index];
    const mmToPx = containerRef.current.offsetWidth / 210;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaPx = moveEvent.clientY - startY;
      const deltaMm = deltaPx / mmToPx;
      const newHeight = Math.max(50, Math.min(600, startHeight + deltaMm));
      onUpdatePageHeight(index, Math.round(newHeight));
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const renderImages = (day: DayPlan, dayIdx: number) => {
    const isBottom = day.imagePosition === 'bottom';
    const count = day.imageCount ?? 1;
    
    if (count === 0) return null;
    
    // 嚴格過濾與限制圖片數量，避免重複顯示
    const activeImages = (day.customImages || []).slice(0, count);
    
    if (activeImages.length === 0) return null;

    const imageElements = activeImages.map((img, i) => {
      const isSide = !isBottom;
      const summaryAspect = isSide ? 'aspect-[3/4]' : 'aspect-[16/7]';
      
      return (
        <div key={`img-wrap-${day.day}-${i}`} className={`relative group overflow-hidden print:shadow-none print:border-none rounded-2xl shadow-lg border border-slate-100 w-full h-full bg-slate-100 ${isSummary ? 'rounded-xl shadow-sm' : ''}`}>
          <img 
            src={img} 
            alt={`${day.title} - ${i + 1}`} 
            className={`w-full h-full object-cover transform transition-transform duration-700 group-hover:scale-105 ${isSummary ? summaryAspect : 'aspect-video print:aspect-square lg:aspect-square'}`}
          />
          <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/60 to-transparent print:bg-black/30">
             <p 
               contentEditable={!!onUpdateDay}
               onBlur={(e) => onUpdateDay?.(dayIdx, 'title', e.currentTarget.textContent || '')}
               suppressContentEditableWarning
               className={`text-white font-bold drop-shadow-md truncate tracking-wider opacity-80 outline-none print:drop-shadow-none ${isSummary ? 'text-[8px]' : 'text-[9px] sm:text-[11px]'}`}
             >
                {day.title}
             </p>
          </div>
        </div>
      );
    });

    if (isBottom) {
      const gridCols = {
        1: 'grid-cols-1',
        2: 'grid-cols-2',
        3: 'grid-cols-3',
        4: 'grid-cols-2 print:grid-cols-4 lg:grid-cols-4'
      }[count as 1|2|3|4] || 'grid-cols-1';

      return (
        <div className={`grid ${gridCols} gap-4 mt-8 w-full ${isSummary ? 'mt-2 gap-2' : ''}`}>
          {imageElements}
        </div>
      );
    }

    return (
      <div className={`flex flex-col gap-4 w-full ${isSummary ? 'gap-2' : ''}`}>
        {imageElements}
      </div>
    );
  };

  if (isSummary) {
    return (
      <div id="itinerary-summary-container" ref={containerRef} className="bg-white max-w-[210mm] mx-auto px-[5mm] py-[10mm] font-sans text-slate-900 relative">
        {/* Page Break Indicators (Visual only, no-print) */}
        <div className="absolute inset-0 pointer-events-none no-print">
          {pageHeights.map((h, i) => {
            const topMm = pageHeights.slice(0, i + 1).reduce((sum, curr) => sum + curr, 0);
            return (
              <div 
                key={i} 
                style={{ top: `${topMm}mm` }} 
                className="absolute w-full border-t-2 border-dashed border-red-400/50 flex items-center justify-center pointer-events-auto cursor-ns-resize group z-50"
                onMouseDown={(e) => handleLineMouseDown(e, i)}
              >
                <div className="bg-red-50 text-red-400 text-[10px] px-2 py-0.5 rounded-full -translate-y-1/2 flex items-center gap-2 shadow-sm border border-red-100 group-hover:bg-red-500 group-hover:text-white transition-colors">
                  <span className="font-black">第 {i + 1} 頁結束</span>
                  <span className="opacity-60">|</span>
                  <span>{h}mm</span>
                  <span className="text-[8px] opacity-50">(按住拖動)</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary Header */}
        <div className="mb-6 w-full">
          <img 
            src="/banner.jpg" 
            alt="BigEagle Banner" 
            className="w-full h-auto block"
          />
        </div>
        <div className="border-b-4 border-slate-900 pb-4 mb-4">
          <h1 className="text-3xl font-black tracking-tighter mb-2 leading-tight w-full">{plan.mainTitle}</h1>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-2">
            <p className="text-sm text-slate-500 font-bold">{plan.marketingSubtitle}</p>
            <div className="text-right shrink-0 whitespace-nowrap">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">大鷹旅遊</p>
              <p className="text-xs font-bold">{plan.departureInfo}</p>
            </div>
          </div>
        </div>

        {/* Flight/Transport Table */}
        {plan.flightInfo && (
          <div className="mb-6 overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="p-2 border border-slate-700 font-black uppercase tracking-wider">類別</th>
                  <th className="p-2 border border-slate-700 font-black uppercase tracking-wider">航班 / 交通資訊</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-2 border border-slate-200 bg-slate-50 font-bold w-24">出發資訊</td>
                  <td className="p-2 border border-slate-200 font-medium">{plan.departureInfo}</td>
                </tr>
                <tr>
                  <td className="p-2 border border-slate-200 bg-slate-50 font-bold w-24">去程資訊</td>
                  <td className="p-2 border border-slate-200 font-medium">{plan.flightInfo.departure}</td>
                </tr>
                <tr>
                  <td className="p-2 border border-slate-200 bg-slate-50 font-bold w-24">回程資訊</td>
                  <td className="p-2 border border-slate-200 font-medium">{plan.flightInfo.return}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Highlights Bar */}
        <div className="bg-slate-50 p-3 rounded-xl mb-6 flex flex-wrap gap-x-6 gap-y-2 border border-slate-100">
          {plan.highlights.slice(0, 4).map((h, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
              <span className="text-[12px] font-bold text-slate-700">{h}</span>
            </div>
          ))}
        </div>

        {/* Daily Summary Grid */}
        <div className="space-y-6">
          {plan.days.map((day, idx) => {
             const isBottom = day.imagePosition === 'bottom';
             const isLeft = day.imagePosition === 'left';
             const isSide = !isBottom;

             return (
               <div key={idx} className="print-break-inside-avoid border-b border-slate-100 pb-4 print:pb-8 last:border-0">
                 <div className={`flex ${isBottom || day.imageCount === 0 ? 'flex-col' : isLeft ? 'flex-row-reverse' : 'flex-row'} flex-nowrap gap-4 items-start`}>
                   
                   <div className={`flex-1 ${(isSide && day.imageCount > 0) ? 'w-3/4' : 'w-full'}`}>
                     <div className="flex items-center gap-3 mb-3">
                       <span className="bg-slate-900 text-white px-2 py-0.5 rounded text-[10px] font-black">DAY {day.day}</span>
                       <h3 className="text-[20px] font-bold text-blue-900 tracking-tight">{day.title}</h3>
                     </div>

                     {/* Itinerary Spots (Red, 12px, Bold, Natural Wrap) */}
                     <div className="mb-2">
                        <span className="text-[12px] font-black text-red-600 uppercase tracking-wider mr-2">行程：</span>
                        <span className="text-[12px] font-bold text-red-600 leading-tight">
                          {day.timeline.map((item, i) => (
                            <React.Fragment key={i}>
                              {item.activity}
                              {i < day.timeline.length - 1 && <span className="mx-1 text-red-300 font-normal">→</span>}
                            </React.Fragment>
                          ))}
                        </span>
                     </div>

                     {/* Meals & Hotel Mini Bar */}
                     <div className="flex gap-4 text-[12px] font-bold text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 mb-3">
                        <div className="flex gap-2">
                          <span>早：{day.meals.breakfast}</span>
                          <span>午：{day.meals.lunch}</span>
                          <span>晚：{day.meals.dinner}</span>
                        </div>
                        <div className="border-l border-slate-200 pl-4">
                          <span>宿：{day.accommodation}</span>
                        </div>
                     </div>
                     
                     {/* Focus Description */}
                     <div className="mb-3">
                        <p className="text-slate-600 text-[12px] leading-relaxed font-medium">
                          {day.description.length > 200 ? day.description.slice(0, 197) + '...' : day.description}
                        </p>
                     </div>

                     {isBottom && renderImages(day, idx)}
                   </div>

                   {isSide && day.imageCount > 0 && (
                     <div className="w-1/4 flex-shrink-0 max-w-[150px]">
                        {renderImages(day, idx)}
                     </div>
                   )}
                 </div>
               </div>
             );
          })}
        </div>


        <footer className="mt-8 pt-4 border-t border-slate-100 flex justify-between items-center">
          <p className="text-[9px] font-bold text-slate-400 italic">* 實際行程以說明會資料為準 *</p>
          <p className="text-[9px] font-black text-slate-900 tracking-widest uppercase">Eagle AI Itinerary</p>
        </footer>
      </div>
    );
  }

  return (
    <div id="itinerary-preview-container" className="bg-white shadow-2xl rounded-[2.5rem] overflow-hidden max-w-5xl mx-auto my-8 px-[5mm] print:shadow-none print:m-0 border border-gray-100 font-sans selection:bg-blue-100">
      {/* Banner Image */}
      <div className="w-full">
        <img 
          src="/banner.jpg" 
          alt="BigEagle Banner" 
          className="w-full h-auto block"
        />
      </div>
      {/* Header Section */}
      <div className="bg-slate-900 text-white p-12 relative overflow-hidden">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-600 rounded-full mb-6">
             <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
             <span className="text-[10px] font-black tracking-[0.3em] uppercase">
                {type === TourType.DOMESTIC ? 'Premium Domestic Journey' : `Global Discovery | ${plan.countryCity || 'Luxury Tour'}`}
             </span>
          </div>
          <h1 
            contentEditable={!!onUpdatePlan}
            onBlur={(e) => onUpdatePlan?.('mainTitle', e.currentTarget.textContent || '')}
            suppressContentEditableWarning
            className="text-4xl md:text-6xl font-black mb-6 tracking-tighter leading-[1.1] outline-none focus:ring-2 focus:ring-blue-500 rounded-lg"
          >
            {plan.mainTitle}
          </h1>
          <p 
            contentEditable={!!onUpdatePlan}
            onBlur={(e) => onUpdatePlan?.('marketingSubtitle', e.currentTarget.textContent || '')}
            suppressContentEditableWarning
            className="text-xl md:text-2xl text-blue-200 font-medium italic opacity-90 border-l-4 border-blue-500 pl-6 py-1 outline-none focus:ring-2 focus:ring-blue-500 rounded-lg"
          >
             {plan.marketingSubtitle}
          </p>
        </div>
        <div className="absolute top-0 right-0 w-1/2 h-full bg-blue-500/10 -skew-x-[20deg] translate-x-1/4"></div>
      </div>

      <div className="p-8 md:p-16">
        {/* Quick Info Bar */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 mb-20 pb-12 border-b border-slate-100">
          <div className="flex items-start space-x-5">
            <div className="bg-slate-50 p-4 rounded-2xl text-3xl border border-slate-100 shadow-sm print:shadow-none">🗓️</div>
            <div>
              <span className="text-slate-400 text-[10px] block font-black uppercase tracking-widest mb-1.5">Departure</span>
              <span 
                contentEditable={!!onUpdatePlan}
                onBlur={(e) => onUpdatePlan?.('departureInfo', e.currentTarget.textContent || '')}
                suppressContentEditableWarning
                className="text-slate-900 font-black text-xl tracking-tight outline-none focus:ring-2 focus:ring-blue-500 rounded-lg"
              >
                {plan.departureInfo}
              </span>
            </div>
          </div>
          {plan.flightInfo && (
            <div className="flex items-start space-x-5 col-span-1 md:col-span-2 lg:col-span-2">
              <div className="bg-slate-50 p-4 rounded-2xl text-3xl border border-slate-100 shadow-sm print:shadow-none">✈️</div>
              <div className="flex flex-col sm:flex-row gap-8">
                <div>
                  <span className="text-slate-400 text-[10px] block font-black uppercase tracking-widest mb-1.5">Outbound</span>
                  <span 
                    contentEditable={!!onUpdatePlan}
                    onBlur={(e) => onUpdatePlan?.('flightInfo', { ...plan.flightInfo, departure: e.currentTarget.textContent || '' })}
                    suppressContentEditableWarning
                    className="text-slate-900 font-bold text-base outline-none focus:ring-2 focus:ring-blue-500 rounded-lg"
                  >
                    {plan.flightInfo.departure}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block font-black uppercase tracking-widest mb-1.5">Inbound</span>
                  <span 
                    contentEditable={!!onUpdatePlan}
                    onBlur={(e) => onUpdatePlan?.('flightInfo', { ...plan.flightInfo, return: e.currentTarget.textContent || '' })}
                    suppressContentEditableWarning
                    className="text-slate-900 font-bold text-base outline-none focus:ring-2 focus:ring-blue-500 rounded-lg"
                  >
                    {plan.flightInfo.return}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Highlights Section */}
        <section className="mb-24">
          <div className="flex items-center gap-6 mb-10">
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter shrink-0">行程特色亮點</h2>
            <div className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {plan.highlights.map((h, i) => (
              <div key={i} className="flex items-start p-6 bg-slate-50/70 rounded-3xl border border-slate-100 hover:bg-white hover:shadow-xl hover:border-blue-100 transition-all duration-500 group print:shadow-none">
                <span className="text-blue-600 font-black text-2xl mr-5 opacity-30 group-hover:opacity-100 transition-opacity">{(i + 1).toString().padStart(2, '0')}</span>
                <p className="text-slate-800 font-bold leading-relaxed text-lg">{h}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Daily Itinerary Body */}
        <section className="space-y-40">
          <div className="flex items-center gap-6 mb-16">
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter shrink-0">精選每日行程</h2>
            <div className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent"></div>
          </div>
          
          {plan.days.map((day, idx) => {
            const isBottom = day.imagePosition === 'bottom';
            const isLeft = day.imagePosition === 'left';
            const isSide = !isBottom;
            
            return (
              <div key={idx} className={`print-break-inside-avoid flex flex-col ${isBottom || day.imageCount === 0 ? '' : isLeft ? 'print:flex-row-reverse lg:flex-row-reverse' : 'print:flex-row lg:flex-row'} gap-10 lg:gap-16 items-start relative`}>
                
                <div className={`w-full ${(isSide && day.imageCount > 0) ? 'print:flex-[2] lg:flex-[2]' : ''}`}>
                  <div className="flex items-center mb-8 justify-between">
                    <div className="flex items-center">
                      <span className="bg-blue-600 text-white px-4 py-1.5 rounded-xl text-xs font-black mr-6 tracking-widest shadow-xl print:shadow-none">DAY {day.day}</span>
                      <h3 
                        contentEditable={!!onUpdateDay}
                        onBlur={(e) => onUpdateDay?.(idx, 'title', e.currentTarget.textContent || '')}
                        suppressContentEditableWarning
                        className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter leading-tight border-b-4 border-slate-100 pb-3 flex-1 outline-none focus:ring-2 focus:ring-blue-500 rounded-lg"
                      >
                        {day.title}
                      </h3>
                    </div>
                  </div>
                  
                  <p 
                    contentEditable={!!onUpdateDay}
                    onBlur={(e) => onUpdateDay?.(idx, 'description', e.currentTarget.textContent || '')}
                    suppressContentEditableWarning
                    className="text-slate-600 text-xl leading-relaxed mb-10 whitespace-pre-wrap font-medium outline-none focus:ring-2 focus:ring-blue-500 rounded-lg"
                  >
                    {day.description}
                  </p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10">
                    <div className="bg-blue-50/40 p-8 rounded-3xl border border-blue-100/50 flex items-center">
                       <div className="w-full">
                          <span className="block text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mb-3">Gastronomy 餐食</span>
                          <div className="flex flex-col gap-1">
                            <p className="text-sm font-bold text-slate-700">早：<span className="text-slate-900">{day.meals.breakfast}</span></p>
                            <p className="text-sm font-bold text-slate-700">午：<span className="text-slate-900">{day.meals.lunch}</span></p>
                            <p className="text-sm font-bold text-slate-700">晚：<span className="text-slate-900">{day.meals.dinner}</span></p>
                          </div>
                       </div>
                    </div>
                    <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-2xl flex items-center overflow-hidden relative print:shadow-none">
                       <div className="relative z-10">
                          <span className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Accommodation 住宿</span>
                          <p className="text-xl font-black tracking-tight leading-tight">{day.accommodation}</p>
                       </div>
                       <div className="absolute top-0 right-0 w-1/2 h-full bg-white/5 -skew-x-12 translate-x-1/2"></div>
                    </div>
                  </div>

                  {/* Timeline Table Rendering */}
                  <div className="bg-slate-50 rounded-[2rem] p-10 mb-10 border border-slate-100 shadow-inner group print:shadow-none">
                    <div className="relative space-y-8 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-blue-200">
                      {day.timeline.map((item, i) => (
                        <div key={i} className="flex gap-8 items-start relative z-10 group/item">
                          <div className="w-6 h-6 rounded-full bg-white border-[5px] border-blue-600 flex-shrink-0 shadow-lg group-hover/item:scale-125 transition-transform print:shadow-none"></div>
                          <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-8">
                            <span className="text-slate-900 font-bold text-lg leading-tight">{item.activity}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {isBottom && renderImages(day, idx)}
                </div>

                {isSide && day.imageCount > 0 && (
                  <div className="w-full print:w-1/3 lg:w-1/3 flex-shrink-0 max-w-sm sticky top-8">
                     {renderImages(day, idx)}
                  </div>
                )}
              </div>
            );
          })}
        </section>

        {/* Detailed Footer Section */}
        <section className="mt-48 pt-20 border-t-4 border-slate-900 grid grid-cols-1 lg:grid-cols-2 gap-16 text-sm">
          <div className="space-y-10">
            <h3 className="text-3xl font-black text-slate-900 tracking-tighter">費用詳情與說明</h3>
            <div className="space-y-6">
              <div className="p-8 bg-blue-50/40 rounded-[2rem] border border-blue-100">
                <span className="block font-black text-blue-700 mb-5 text-base">【費用包含】</span>
                <ul className="space-y-3 text-slate-700 font-bold text-xs">
                  {plan.costIncludes.map((item, i) => (
                    <li key={i} className="flex items-start"><span className="w-2 h-2 rounded-full bg-blue-400 mr-3 mt-1 shrink-0"></span>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="p-8 bg-red-50/40 rounded-[2rem] border border-red-100">
                <span className="block font-black text-red-700 mb-5 text-base">【費用不包含】</span>
                <ul className="space-y-3 text-slate-700 font-bold text-xs">
                  {plan.costExcludes.map((item, i) => (
                    <li key={i} className="flex items-start"><span className="w-2 h-2 rounded-full bg-red-400 mr-3 mt-1 shrink-0"></span>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-10">
            <h3 className="text-3xl font-black text-slate-900 tracking-tighter">行前注意事項</h3>
            <div className="p-10 bg-slate-50 rounded-[2rem] border border-slate-100 shadow-inner print:shadow-none">
              <ul className="space-y-4">
                {plan.precautions.map((item, i) => (
                  <li key={i} className="flex items-start text-xs font-bold text-slate-600 leading-relaxed">
                    <span className="mr-4 mt-2 w-1.5 h-1.5 bg-slate-300 rounded-full flex-shrink-0"></span>{item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-10 bg-slate-900 text-white rounded-[2rem] shadow-xl print:shadow-none">
               <span className="block font-black text-slate-400 mb-4 text-xs tracking-widest uppercase">Suggested Items</span>
               <div className="flex flex-wrap gap-2">
                  {plan.suggestedItems.map((item, i) => (
                    <span key={i} className="bg-white/10 px-3 py-1 rounded-lg text-[10px] font-bold">{item}</span>
                  ))}
               </div>
            </div>
          </div>
        </section>

        <footer className="mt-40 pt-12 border-t border-slate-100 text-center">
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em] mb-6">
            * 行程內容供參考，實際以合約及行前說明會資料為準 *
          </p>
          <div className="inline-block bg-slate-900 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-2xl print:shadow-none">
            Eagle AI Studio Itinerary Engine
          </div>
        </footer>
      </div>
    </div>
  );
};

export default ItineraryPreview;
