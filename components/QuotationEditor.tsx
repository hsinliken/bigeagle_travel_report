
import React, { useState, useEffect } from 'react';
import { Quotation, QuotationItem } from '../types';

interface Props {
  quotation: Quotation;
  onUpdate: (updated: Quotation) => void;
}

const QuotationEditor: React.FC<Props> = ({ quotation, onUpdate }) => {
  const [items, setItems] = useState<QuotationItem[]>(quotation.items);
  const [sellingPrice, setSellingPrice] = useState(quotation.suggestedSellingPrice);

  useEffect(() => {
    setItems(quotation.items);
    setSellingPrice(quotation.suggestedSellingPrice);
  }, [quotation]);

  const calculateTotals = (newItems: QuotationItem[], newSellingPrice: number) => {
    const totalCost = newItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const profitMargin = newSellingPrice > 0 ? (newSellingPrice - totalCost) / newSellingPrice : 0;
    onUpdate({
      items: newItems,
      totalCost,
      suggestedSellingPrice: newSellingPrice,
      profitMargin
    });
  };

  const updateItem = (index: number, field: keyof QuotationItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
    calculateTotals(newItems, sellingPrice);
  };

  const addItem = () => {
    const newItem: QuotationItem = { category: '其他', item: '新項目', unitPrice: 0, quantity: 1, note: '' };
    const newItems = [...items, newItem];
    setItems(newItems);
    calculateTotals(newItems, sellingPrice);
  };

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
    calculateTotals(newItems, sellingPrice);
  };

  return (
    <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
      <h3 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-3">
        <span>💰 預算與報價模擬</span>
        <span className="text-sm font-normal text-slate-400">可手動調整各項成本與售價</span>
      </h3>

      <div className="overflow-x-auto mb-8">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="p-3 text-xs font-black uppercase tracking-wider rounded-tl-xl">類別</th>
              <th className="p-3 text-xs font-black uppercase tracking-wider">項目名稱</th>
              <th className="p-3 text-xs font-black uppercase tracking-wider">單價</th>
              <th className="p-3 text-xs font-black uppercase tracking-wider">數量</th>
              <th className="p-3 text-xs font-black uppercase tracking-wider">小計</th>
              <th className="p-3 text-xs font-black uppercase tracking-wider">備註</th>
              <th className="p-3 text-xs font-black uppercase tracking-wider rounded-tr-xl">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item, idx) => (
              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                <td className="p-3">
                  <input 
                    className="w-full bg-transparent border-none outline-none font-bold text-slate-700"
                    value={item.category}
                    onChange={(e) => updateItem(idx, 'category', e.target.value)}
                  />
                </td>
                <td className="p-3">
                  <input 
                    className="w-full bg-transparent border-none outline-none text-slate-600"
                    value={item.item}
                    onChange={(e) => updateItem(idx, 'item', e.target.value)}
                  />
                </td>
                <td className="p-3">
                  <input 
                    type="number"
                    className="w-24 bg-transparent border-none outline-none font-mono font-bold text-blue-600"
                    value={item.unitPrice}
                    onChange={(e) => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                  />
                </td>
                <td className="p-3">
                  <input 
                    type="number"
                    className="w-16 bg-transparent border-none outline-none font-mono"
                    value={item.quantity}
                    onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                  />
                </td>
                <td className="p-3 font-mono font-bold text-slate-900">
                  {(item.unitPrice * item.quantity).toLocaleString()}
                </td>
                <td className="p-3">
                  <input 
                    className="w-full bg-transparent border-none outline-none text-xs text-slate-400"
                    value={item.note}
                    onChange={(e) => updateItem(idx, 'note', e.target.value)}
                    placeholder="備註..."
                  />
                </td>
                <td className="p-3">
                  <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 transition-colors">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button onClick={addItem} className="mb-8 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-200 transition-all">+ 新增報價項目</button>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 border-t border-slate-100">
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
          <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">總成本 (Total Cost)</span>
          <p className="text-2xl font-black text-slate-900 font-mono">{quotation.totalCost.toLocaleString()}</p>
        </div>
        <div className="bg-blue-600 p-6 rounded-2xl shadow-xl shadow-blue-100">
          <span className="block text-[10px] font-black text-blue-200 uppercase tracking-widest mb-2">建議售價 (Selling Price)</span>
          <input 
            type="number"
            className="w-full bg-transparent border-none outline-none text-2xl font-black text-white font-mono"
            value={sellingPrice}
            onChange={(e) => {
              const val = parseFloat(e.target.value) || 0;
              setSellingPrice(val);
              calculateTotals(items, val);
            }}
          />
        </div>
        <div className={`p-6 rounded-2xl border ${quotation.profitMargin > 0.15 ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
          <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">預估利潤率 (Margin)</span>
          <p className={`text-2xl font-black font-mono ${quotation.profitMargin > 0.15 ? 'text-emerald-600' : 'text-amber-600'}`}>
            {(quotation.profitMargin * 100).toFixed(1)}%
          </p>
        </div>
      </div>
    </div>
  );
};

export default QuotationEditor;
