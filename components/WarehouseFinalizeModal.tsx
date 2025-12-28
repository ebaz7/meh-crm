
import React, { useState } from 'react';
import { ExitPermit, ExitPermitItem } from '../types';
import { Save, X, Package, Calculator } from 'lucide-react';

interface Props {
  permit: ExitPermit;
  onClose: () => void;
  onConfirm: (updatedItems: ExitPermitItem[]) => void;
}

const WarehouseFinalizeModal: React.FC<Props> = ({ permit, onClose, onConfirm }) => {
  // Initialize state with current items
  const [items, setItems] = useState<ExitPermitItem[]>(
    permit.items && permit.items.length > 0 
      ? permit.items.map(i => ({...i})) 
      : [{ id: 'legacy', goodsName: permit.goodsName || '', cartonCount: permit.cartonCount || 0, weight: permit.weight || 0 }]
  );

  const handleUpdateItem = (index: number, field: keyof ExitPermitItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const totalWeight = items.reduce((sum, i) => sum + (Number(i.weight) || 0), 0);
  const totalCount = items.reduce((sum, i) => sum + (Number(i.cartonCount) || 0), 0);

  const handleSave = () => {
    if (items.some(i => !i.goodsName)) {
      alert("نام کالا نمی‌تواند خالی باشد.");
      return;
    }
    onConfirm(items);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-orange-50 p-4 border-b border-orange-100 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-orange-100 p-2 rounded-lg text-orange-600">
              <Package size={24} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-800">تایید نهایی انبار (توزین خروج)</h3>
              <p className="text-xs text-gray-500">لطفاً وزن و تعداد دقیق بارگیری شده را وارد کنید</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto bg-gray-50">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm text-center">
              <thead className="bg-gray-100 text-gray-700 font-bold">
                <tr>
                  <th className="p-3 w-12">#</th>
                  <th className="p-3 text-right">شرح کالا</th>
                  <th className="p-3 w-32">تعداد (کارتن)</th>
                  <th className="p-3 w-32">وزن (کیلوگرم)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-blue-50/30 transition-colors">
                    <td className="p-3 text-gray-500 font-mono">{idx + 1}</td>
                    <td className="p-3">
                      <input 
                        className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        value={item.goodsName}
                        onChange={e => handleUpdateItem(idx, 'goodsName', e.target.value)}
                        placeholder="نام کالا"
                      />
                    </td>
                    <td className="p-3">
                      <input 
                        type="number"
                        className="w-full border rounded-lg p-2 text-center font-mono font-bold text-blue-600 focus:ring-2 focus:ring-blue-500 outline-none"
                        value={item.cartonCount}
                        onChange={e => handleUpdateItem(idx, 'cartonCount', Number(e.target.value))}
                        placeholder="0"
                      />
                    </td>
                    <td className="p-3">
                      <input 
                        type="number"
                        className="w-full border rounded-lg p-2 text-center font-mono font-bold text-green-600 focus:ring-2 focus:ring-green-500 outline-none"
                        value={item.weight}
                        onChange={e => handleUpdateItem(idx, 'weight', Number(e.target.value))}
                        placeholder="0"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan={2} className="p-3 text-left pl-6 font-bold text-gray-600 flex items-center justify-end gap-2">
                    <Calculator size={16}/> جمع کل:
                  </td>
                  <td className="p-3 font-black text-blue-700 font-mono text-lg">{totalCount}</td>
                  <td className="p-3 font-black text-green-700 font-mono text-lg">{totalWeight}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-white flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-50 transition-colors">
            انصراف
          </button>
          <button onClick={handleSave} className="px-6 py-2 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-700 shadow-lg shadow-orange-200 flex items-center gap-2 transition-transform active:scale-95">
            <Save size={18} />
            تایید نهایی و ارسال به انتظامات
          </button>
        </div>
      </div>
    </div>
  );
};

export default WarehouseFinalizeModal;
