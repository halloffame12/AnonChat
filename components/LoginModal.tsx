import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Gender } from '../types';
import { Button } from './ui/Button';
import { MessageCircle, Shield, User, MapPin } from 'lucide-react';

export const LoginModal: React.FC = () => {
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    age: '',
    gender: Gender.Male,
    location: ''
  });
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const ageNum = parseInt(formData.age);
    if (!formData.username.trim()) {
      setError('Username is required');
      return;
    }
    if (isNaN(ageNum) || ageNum < 13) {
      setError('You must be at least 13 years old');
      return;
    }

    setLoading(true);
    try {
      await login(formData.username, ageNum, formData.gender, formData.location);
    } catch (err) {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-fade-in-up border border-slate-800">
        <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-8 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl transform translate-x-10 -translate-y-10"></div>
          
          <div className="mx-auto bg-white/20 w-20 h-20 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-md shadow-lg relative z-10 border border-white/20">
            <MessageCircle className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-white relative z-10 tracking-tight">AnonChat Live</h1>
          <p className="text-indigo-100 mt-2 text-sm font-medium relative z-10">Your secret identity awaits</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          {error && (
            <div className="bg-rose-50 text-rose-600 p-3 rounded-xl text-sm border border-rose-100 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-rose-500 rounded-full"></span>
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Username</label>
            <div className="relative group">
                <User className="absolute left-3 top-3 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                <input
                type="text"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-base font-medium"
                placeholder="e.g., CyberNinja"
                value={formData.username}
                onChange={(e) => setFormData({...formData, username: e.target.value})}
                />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Age</label>
              <input
                type="number"
                min="13"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-base font-medium"
                value={formData.age}
                placeholder="18+"
                onChange={(e) => setFormData({...formData, age: e.target.value})}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Gender</label>
              <div className="relative">
                <select
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-base font-medium appearance-none cursor-pointer"
                    value={formData.gender}
                    onChange={(e) => setFormData({...formData, gender: e.target.value as Gender})}
                >
                    <option value={Gender.Male}>Male</option>
                    <option value={Gender.Female}>Female</option>
                    <option value={Gender.Other}>Other</option>
                </select>
                <div className="absolute right-3 top-4 pointer-events-none">
                    <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Location (Optional)</label>
             <div className="relative group">
                <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                <input
                type="text"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-base font-medium"
                placeholder="City, Country"
                value={formData.location}
                onChange={(e) => setFormData({...formData, location: e.target.value})}
                />
            </div>
          </div>

          <div className="pt-4">
            <Button type="submit" className="w-full py-4 text-lg shadow-xl shadow-indigo-500/20 hover:shadow-indigo-500/40 rounded-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 border-none transform active:scale-95 transition-all" isLoading={loading}>
              Enter Anonymously
            </Button>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-slate-400 mt-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
            <Shield className="w-3 h-3 text-slate-400" />
            <span>Your session is temporary and fully encrypted</span>
          </div>
        </form>
      </div>
    </div>
  );
};