
import React, { useState, useEffect } from 'react';
import { login } from '../services/authService';
import { getServerHost, setServerHost } from '../services/apiService';
import { User } from '../types';
import { LogIn, KeyRound, Loader2, Settings, Server } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [serverUrl, setServerUrl] = useState('');

  useEffect(() => {
    const savedUsername = localStorage.getItem('saved_username');
    if (savedUsername) setUsername(savedUsername);
    
    // Load current server URL
    setServerUrl(getServerHost());
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const user = await login(username, password);
    setLoading(false);
    if (user) {
      localStorage.setItem('saved_username', username);
      onLogin(user);
    } else {
      setError('نام کاربری یا رمز عبور اشتباه است.');
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
      e.preventDefault();
      if(!serverUrl) {
          alert("لطفا آدرس سرور را وارد کنید");
          return;
      }
      setServerHost(serverUrl);
      setShowSettings(false);
      alert("تنظیمات سرور ذخیره شد.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4 relative">
        
      {/* Settings Toggle Button */}
      <button 
        onClick={() => setShowSettings(!showSettings)} 
        className="absolute top-4 right-4 p-2 text-gray-400 hover:text-blue-600 transition-colors z-10"
        title="تنظیمات اتصال"
      >
        <Settings size={24} />
      </button>

      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-200 relative overflow-hidden">
        
        {showSettings ? (
            // SERVER SETTINGS VIEW
            <div className="animate-fade-in space-y-6">
                <div className="flex flex-col items-center mb-6">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 mb-4 border border-gray-200">
                        <Server size={32} />
                    </div>
                    <h1 className="text-xl font-bold text-gray-800">تنظیمات سرور</h1>
                    <p className="text-gray-500 mt-2 text-xs text-center">آدرس سایت یا IP سرور را وارد کنید<br/>(مثال: https://mysite.com)</p>
                </div>
                
                <form onSubmit={handleSaveSettings} className="space-y-4">
                    <div>
                        <label className="text-sm font-bold text-gray-700 block mb-2">آدرس سرور</label>
                        <input 
                            type="text" 
                            value={serverUrl} 
                            onChange={(e) => setServerUrl(e.target.value)} 
                            className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-gray-50 text-left dir-ltr" 
                            placeholder="https://example.com"
                            required 
                        />
                    </div>
                    <button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-medium shadow-lg shadow-green-600/20 transition-all">
                        ذخیره تنظیمات
                    </button>
                    <button type="button" onClick={() => setShowSettings(false)} className="w-full bg-gray-100 text-gray-600 py-3 rounded-xl font-medium hover:bg-gray-200 transition-all">
                        بازگشت به ورود
                    </button>
                </form>
            </div>
        ) : (
            // LOGIN VIEW
            <>
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white mb-4 shadow-lg shadow-blue-600/30">
                        <KeyRound size={32} />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-800">ورود به سیستم مالی</h1>
                    <p className="text-gray-500 mt-2 text-sm">لطفا برای ادامه وارد شوید</p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center border border-red-100">{error}</div>}
                  <div className="space-y-2"><label className="text-sm font-medium text-gray-700 block">نام کاربری</label><input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-gray-50 focus:bg-white text-left dir-ltr" required /></div>
                  <div className="space-y-2"><label className="text-sm font-medium text-gray-700 block">رمز عبور</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-gray-50 focus:bg-white text-left dir-ltr" required /></div>
                  <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-medium shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70">{loading ? <Loader2 className="animate-spin" /> : <LogIn size={20} />}ورود به حساب کاربری</button>
                </form>
            </>
        )}
      </div>
    </div>
  );
};
export default Login;
