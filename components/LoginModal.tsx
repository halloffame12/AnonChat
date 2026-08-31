import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Gender } from '../types';
import AvatarPeep from './AvatarPeep';
import { User, MapPin, Hash, Dice5, Sparkles, Shield } from 'lucide-react';

const INTEREST_OPTIONS = [
  'Gaming', 'Music', 'Movies', 'Anime', 'Sports',
  'Tech', 'Art', 'Travel', 'Books', 'Food',
  'Fitness', 'Photography', 'Coding', 'Fashion', 'Science'
];

const WARM_GRADIENT = 'from-primary via-primary-light to-primary-dark';

export const LoginModal: React.FC = () => {
  const { login, isConnecting, connectionError } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    age: '',
    gender: Gender.Male,
    location: '',
    interests: [] as string[]
  });
  const [peepSeed, setPeepSeed] = useState(Date.now().toString());
  const [error, setError] = useState('');
  const [step, setStep] = useState<'info' | 'interests'>('info');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (connectionError) setError(connectionError);
  }, [connectionError]);

  const handleUsernameChange = (v: string) => {
    setFormData(prev => ({ ...prev, username: v }));
    if (v.trim()) setPeepSeed(v.trim() + '-' + Date.now());
  };

  const rerollPeep = () => {
    setPeepSeed(formData.username.trim() ? formData.username + '-' + Date.now() : Date.now().toString());
  };

  const toggleInterest = (interest: string) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : prev.interests.length < 5
          ? [...prev.interests, interest]
          : prev.interests
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (step === 'info') {
      const ageNum = parseInt(formData.age);
      if (!formData.username.trim()) { setError('Choose a username'); return; }
      if (formData.username.trim().length < 2) { setError('Username too short'); return; }
      if (isNaN(ageNum) || ageNum < 13) { setError('You must be at least 13'); return; }
      setStep('interests');
      return;
    }

    if (formData.interests.length < 3) { setError('Pick at least 3 interests'); return; }

    try {
      await login(formData.username, parseInt(formData.age), formData.gender, formData.location, formData.interests);
    } catch {
      setError('Login failed. Try again.');
    }
  };

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 overflow-y-auto bg-warm-50 overscroll-contain">
      <div className="min-h-[100dvh] min-h-screen w-full flex items-center justify-center p-0 md:p-4">
        <div className="w-full min-h-screen md:min-h-0 md:max-w-md bg-white md:rounded-3xl md:shadow-soft md:border md:border-warm-100 overflow-hidden animate-fade-in-up">
          {/* Header — full width on mobile, rounded-top on desktop */}
          <div className={`relative bg-gradient-to-br ${WARM_GRADIENT} px-6 pt-8 pb-6 text-center overflow-hidden`}>
            <div className="gradient-blob w-64 h-64 bg-white/10 -top-20 -right-20" />
            <div className="gradient-blob w-48 h-48 bg-white/5 -bottom-10 -left-10" />

            {/* Peep avatar */}
            <div className="relative z-10 mb-3">
              <div className="inline-block relative">
                <AvatarPeep seed={peepSeed} size={step === 'info' ? 88 : 72} className="ring-4 ring-white/30 shadow-2xl transition-all duration-500" />
                <button
                  type="button"
                  onClick={rerollPeep}
                  className="absolute -bottom-1 -right-1 w-9 h-9 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/40 transition-all border border-white/30"
                  title="Reroll avatar"
                  aria-label="Reroll avatar"
                >
                  <Dice5 className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold text-white relative z-10 tracking-tight">
              {step === 'info' ? 'AnonChat Live' : 'Your Interests'}
            </h1>
            <p className="text-white/70 mt-1 text-sm font-medium relative z-10">
              {step === 'info' ? 'Your secret identity awaits' : 'Help us find your tribe'}
            </p>

            {/* Step indicator */}
            <div className="flex items-center justify-center gap-2 mt-4 relative z-10">
              <div className={`w-2 h-2 rounded-full transition-all ${step === 'info' ? 'bg-white w-6' : 'bg-white/40'}`} />
              <div className={`w-2 h-2 rounded-full transition-all ${step === 'interests' ? 'bg-white w-6' : 'bg-white/40'}`} />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="bg-accent/10 text-accent px-4 py-3 rounded-2xl text-sm border border-accent/20 flex items-center gap-2 animate-fade-in-down">
                <span className="w-1.5 h-1.5 bg-accent rounded-full shrink-0" />
                {error}
              </div>
            )}

            {step === 'info' && (
              <>
                {/* Username */}
                <div className="space-y-1.5">
                  <label htmlFor="username" className="block text-xs font-bold text-warm-600 uppercase tracking-wider ml-1">Username</label>
                  <div className="relative group">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400 group-focus-within:text-primary transition-colors" />
                    <input
                      id="username"
                      type="text"
                      className="input-warm pl-10"
                      placeholder="Choose a cool name..."
                      value={formData.username}
                      onChange={(e) => handleUsernameChange(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>

                {/* Age + Gender row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label htmlFor="age" className="block text-xs font-bold text-warm-600 uppercase tracking-wider ml-1">Age</label>
                    <input
                      id="age"
                      type="number"
                      min="13"
                      className="input-warm"
                      value={formData.age}
                      placeholder="18"
                      onChange={(e) => setFormData({...formData, age: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="gender" className="block text-xs font-bold text-warm-600 uppercase tracking-wider ml-1">Gender</label>
                    <div className="relative">
                      <select
                        id="gender"
                        aria-label="Gender"
                        className="input-warm appearance-none cursor-pointer"
                        value={formData.gender}
                        onChange={(e) => setFormData({...formData, gender: e.target.value as Gender})}
                      >
                        <option value={Gender.Male}>Male</option>
                        <option value={Gender.Female}>Female</option>
                        <option value={Gender.Other}>Other</option>
                      </select>
                      <svg className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3 h-3 text-warm-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Location */}
                <div className="space-y-1.5">
                  <label htmlFor="location" className="block text-xs font-bold text-warm-600 uppercase tracking-wider ml-1">Location <span className="text-warm-400 font-normal normal-case">(optional)</span></label>
                  <div className="relative group">
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400 group-focus-within:text-primary transition-colors" />
                    <input
                      id="location"
                      type="text"
                      className="input-warm pl-10"
                      placeholder="City, Country"
                      value={formData.location}
                      onChange={(e) => setFormData({...formData, location: e.target.value})}
                    />
                  </div>
                </div>

                {/* Next button */}
                <button
                  type="submit"
                  className="btn-primary w-full text-lg py-4"
                >
                  Continue
                  <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              </>
            )}

            {step === 'interests' && (
              <>
                {/* Interests */}
                <fieldset className="space-y-1.5 border-0 p-0 m-0">
                  <legend className="block text-xs font-bold text-warm-600 uppercase tracking-wider pb-2 flex items-center gap-1">
                    <Hash className="w-3 h-3" /> Pick your interests
                  </legend>
                  <p className="text-xs text-warm-500 mb-2">Select 3–5 to find better matches</p>
                  <div className="flex flex-wrap gap-2">
                    {INTEREST_OPTIONS.map(interest => {
                      const selected = formData.interests.includes(interest);
                      return (
                        <button
                          key={interest}
                          type="button"
                          onClick={() => toggleInterest(interest)}
                          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all border-2 ${
                            selected
                              ? 'bg-primary text-white border-primary shadow-sm'
                              : 'bg-white text-warm-600 border-warm-200 hover:border-primary/40 hover:text-primary'
                          }`}
                        >
                          {interest}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isConnecting}
                  className="btn-primary w-full text-lg py-4 mt-2"
                >
                  {isConnecting ? (
                    <span className="flex items-center gap-2">
                      <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Entering...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Sparkles className="w-5 h-5" />
                      Enter Anonymously
                    </span>
                  )}
                </button>

                {/* Back */}
                <button
                  type="button"
                  onClick={() => setStep('info')}
                  className="w-full text-center text-sm text-warm-500 hover:text-warm-700 font-medium py-2 transition-colors"
                >
                  ← Back
                </button>
              </>
            )}

            {/* Trust footer */}
            <div className="flex items-center justify-center gap-2 text-xs text-warm-500 pt-2 border-t border-warm-100">
              <Shield className="w-3 h-3" />
              <span>End-to-end encrypted • No data stored</span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
