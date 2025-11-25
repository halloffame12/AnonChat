import React, { useEffect, useState, useRef } from 'react';
import { MessageCircle, Zap, Shield, Globe, Heart, Users, Lock, ArrowRight, UserPlus, MessageSquare, Sparkles } from 'lucide-react';
import { Button } from './ui/Button';

interface LandingPageProps {
  onGetStarted: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
  const [activeUsers, setActiveUsers] = useState(2451);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Simulate live user count fluctuation
    const interval = setInterval(() => {
      setActiveUsers(prev => prev + Math.floor(Math.random() * 5) - 2);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const scrollToTop = () => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div ref={containerRef} className="h-screen w-full bg-slate-950 text-white overflow-y-auto overflow-x-hidden font-sans relative selection:bg-indigo-500/30 scroll-smooth">
      {/* Background Elements */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px]"></div>
      </div>

      {/* Navbar */}
      <nav className="relative z-50 container mx-auto px-6 py-6 flex justify-between items-center backdrop-blur-sm sticky top-0 bg-slate-950/80 border-b border-slate-800/50">
        <div 
          className="flex items-center gap-2 font-bold text-2xl tracking-tight cursor-pointer"
          onClick={scrollToTop}
        >
          <div className="w-10 h-10 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 transform hover:rotate-3 transition-transform">
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          <span className="hidden sm:inline">AnonChat<span className="text-indigo-400">Live</span></span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-slate-300 text-sm font-medium">
          <button onClick={() => scrollToSection('how-it-works')} className="hover:text-white transition-colors">How it Works</button>
          <button onClick={() => scrollToSection('features')} className="hover:text-white transition-colors">Features</button>
          <button onClick={() => scrollToSection('community')} className="hover:text-white transition-colors">Community</button>
          <button onClick={() => scrollToSection('safety')} className="hover:text-white transition-colors">Safety</button>
        </div>
        <Button onClick={onGetStarted} variant="primary" className="shadow-indigo-500/20 shadow-lg hover:shadow-indigo-500/40 transition-all">
          Login
        </Button>
      </nav>

      {/* Hero */}
      <header className="relative z-10 container mx-auto px-6 pt-16 md:pt-28 pb-20 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-8 animate-fade-in-up shadow-xl backdrop-blur-sm">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          <span className="bg-gradient-to-r from-indigo-300 to-purple-300 bg-clip-text text-transparent">
            {activeUsers.toLocaleString()} users online now
          </span>
        </div>
        
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold leading-tight mb-8 tracking-tight animate-fade-in-up" style={{animationDelay: '0.1s'}}>
          Talk to Strangers,<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
            Make Real Connections.
          </span>
        </h1>
        
        <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-12 leading-relaxed animate-fade-in-up" style={{animationDelay: '0.2s'}}>
          Experience the next generation of anonymous chat. Secure, fast, and beautifully designed for meaningful conversations without boundaries.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up" style={{animationDelay: '0.3s'}}>
          <button 
            onClick={onGetStarted}
            className="w-full sm:w-auto px-8 py-4 bg-white text-slate-950 rounded-full font-bold text-lg shadow-xl shadow-indigo-500/10 hover:scale-105 hover:shadow-indigo-500/20 transition-all duration-200 flex items-center justify-center gap-2 group"
          >
            <Zap className="w-5 h-5 text-indigo-600 fill-indigo-600 group-hover:text-indigo-700 transition-colors" />
            Talk to Stranger
          </button>
          <button 
            onClick={() => scrollToSection('how-it-works')}
            className="w-full sm:w-auto px-8 py-4 bg-slate-800/50 text-white rounded-full font-bold text-lg border border-slate-700 hover:bg-slate-800 transition-colors backdrop-blur-sm flex items-center justify-center gap-2"
          >
            How it Works
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* How It Works */}
      <section id="how-it-works" className="relative z-10 py-20 bg-slate-900/30 border-y border-slate-800/50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-slate-400">Start chatting in three simple steps</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 relative">
             {/* Connector Line (Desktop) */}
            <div className="hidden md:block absolute top-12 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-indigo-900 to-transparent"></div>

            <StepCard 
              number="01"
              icon={<UserPlus className="w-6 h-6 text-white" />}
              title="Pick an Identity"
              description="Choose a temporary username. No registration or email required."
            />
             <StepCard 
              number="02"
              icon={<Sparkles className="w-6 h-6 text-white" />}
              title="Get Matched"
              description="Our smart algorithm finds you a partner based on your preferences."
            />
             <StepCard 
              number="03"
              icon={<MessageSquare className="w-6 h-6 text-white" />}
              title="Start Chatting"
              description="Connect instantly. Exchange text, emojis, and have fun!"
            />
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="relative z-10 container mx-auto px-6 py-24">
        <div className="text-center mb-16">
             <span className="text-indigo-400 font-bold tracking-wider uppercase text-sm">Why Choose Us</span>
            <h2 className="text-3xl md:text-4xl font-bold mt-2 mb-4">Premium Features, Free for Everyone</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          <FeatureCard 
            icon={<Shield className="w-8 h-8 text-emerald-400" />}
            title="Truly Anonymous"
            description="No emails, no phone numbers. Just pick a temporary username and start chatting instantly."
            color="group-hover:border-emerald-500/50"
          />
          <FeatureCard 
            icon={<Globe className="w-8 h-8 text-blue-400" />}
            title="Global Community"
            description="Connect with people from over 150 countries. Break language barriers and explore cultures."
            color="group-hover:border-blue-500/50"
          />
          <FeatureCard 
            icon={<Lock className="w-8 h-8 text-rose-400" />}
            title="Secure & Private"
            description="Your conversations are encrypted and not stored. History vanishes when you leave."
            color="group-hover:border-rose-500/50"
          />
          <FeatureCard 
            icon={<Zap className="w-8 h-8 text-amber-400" />}
            title="Instant Matching"
            description="Zero waiting time. Our lightning fast servers connect you in milliseconds."
            color="group-hover:border-amber-500/50"
          />
           <FeatureCard 
            icon={<Users className="w-8 h-8 text-purple-400" />}
            title="Group Chats"
            description="Create public or private groups to chat with multiple people at once."
            color="group-hover:border-purple-500/50"
          />
           <FeatureCard 
            icon={<Heart className="w-8 h-8 text-pink-400" />}
            title="Clean Interface"
            description="A distraction-free experience designed to help you focus on the conversation."
            color="group-hover:border-pink-500/50"
          />
        </div>
      </section>

      {/* Community Section */}
      <section id="community" className="relative z-10 py-24 bg-gradient-to-b from-slate-900 to-slate-950 border-t border-slate-800">
         <div className="container mx-auto px-6 text-center">
             <div className="max-w-3xl mx-auto">
                 <div className="w-16 h-16 bg-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-indigo-400">
                     <Users className="w-8 h-8" />
                 </div>
                 <h2 className="text-3xl md:text-5xl font-bold mb-6">A Growing Community</h2>
                 <p className="text-slate-400 text-lg mb-10 leading-relaxed">
                     Join thousands of users who are making new friends every day. From casual chats to deep conversations, 
                     find your tribe in a safe and welcoming environment.
                 </p>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                     <StatItem number="10k+" label="Daily Users" />
                     <StatItem number="150+" label="Countries" />
                     <StatItem number="1M+" label="Messages" />
                     <StatItem number="4.9" label="Rating" />
                 </div>
             </div>
         </div>
      </section>

      {/* Safety Section */}
      <section id="safety" className="relative z-10 container mx-auto px-6 py-24">
        <div className="bg-slate-900 rounded-3xl p-8 md:p-12 border border-slate-800 relative overflow-hidden">
             <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none"></div>
             
             <div className="grid md:grid-cols-2 gap-12 items-center relative z-10">
                 <div>
                     <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-6">
                         <Shield className="w-4 h-4" /> Safety First
                     </div>
                     <h2 className="text-3xl md:text-4xl font-bold mb-6">Your Safety is Our Priority</h2>
                     <div className="space-y-6">
                         <SafetyItem 
                            title="Active Moderation" 
                            description="Our AI and human moderators work 24/7 to keep the platform clean."
                        />
                         <SafetyItem 
                            title="Report & Block" 
                            description="Instantly block anyone who makes you uncomfortable and report them."
                        />
                         <SafetyItem 
                            title="No Personal Data" 
                            description="We don't ask for your personal details, so your identity remains yours."
                        />
                     </div>
                 </div>
                 <div className="bg-slate-950 p-8 rounded-2xl border border-slate-800">
                     <h3 className="font-bold text-xl mb-4 text-white">Community Guidelines</h3>
                     <ul className="space-y-4 text-slate-400 text-sm">
                         <li className="flex items-start gap-3">
                             <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2"></span>
                             Be respectful to everyone. Harassment is not tolerated.
                         </li>
                         <li className="flex items-start gap-3">
                             <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2"></span>
                             No inappropriate content. Keep it clean.
                         </li>
                         <li className="flex items-start gap-3">
                             <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2"></span>
                             Do not share personal information like address or phone numbers.
                         </li>
                         <li className="flex items-start gap-3">
                             <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2"></span>
                             You must be 13+ to use this service.
                         </li>
                     </ul>
                     <Button onClick={onGetStarted} variant="primary" className="w-full mt-8">
                         I Agree & Start Chatting
                     </Button>
                 </div>
             </div>
        </div>
      </section>

      <footer className="border-t border-slate-800 bg-slate-950 py-12 relative z-10">
        <div className="container mx-auto px-6 text-center text-slate-500 text-sm">
            <div className="flex justify-center gap-6 mb-8">
                <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
                <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
                <a href="#" className="hover:text-white transition-colors">Contact</a>
            </div>
          <p>&copy; 2024 AnonChat Live. Connecting the world anonymously.</p>
        </div>
      </footer>
    </div>
  );
};

const FeatureCard: React.FC<{icon: React.ReactNode, title: string, description: string, color: string}> = ({icon, title, description, color}) => (
  <div className={`bg-slate-900/50 backdrop-blur-sm p-8 rounded-3xl border border-slate-800 hover:bg-slate-800/50 transition-all duration-300 hover:-translate-y-1 group ${color}`}>
    <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
      {icon}
    </div>
    <h3 className="text-xl font-bold mb-3 text-slate-100">{title}</h3>
    <p className="text-slate-400 leading-relaxed">{description}</p>
  </div>
);

const StepCard: React.FC<{number: string, icon: React.ReactNode, title: string, description: string}> = ({number, icon, title, description}) => (
    <div className="relative bg-slate-900 border border-slate-800 p-8 rounded-3xl text-center group hover:border-indigo-500/30 transition-colors z-10">
        <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform">
            {icon}
        </div>
        <div className="absolute top-4 right-6 text-4xl font-bold text-slate-800 -z-10 opacity-50 select-none">
            {number}
        </div>
        <h3 className="text-xl font-bold mb-3">{title}</h3>
        <p className="text-slate-400 text-sm">{description}</p>
    </div>
);

const StatItem: React.FC<{number: string, label: string}> = ({number, label}) => (
    <div>
        <div className="text-3xl md:text-4xl font-bold text-white mb-2">{number}</div>
        <div className="text-slate-500 text-sm uppercase tracking-wider font-medium">{label}</div>
    </div>
);

const SafetyItem: React.FC<{title: string, description: string}> = ({title, description}) => (
    <div className="flex gap-4">
        <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0 mt-1">
            <Shield className="w-4 h-4 text-emerald-400" />
        </div>
        <div>
            <h4 className="text-lg font-bold text-white mb-1">{title}</h4>
            <p className="text-slate-400 text-sm">{description}</p>
        </div>
    </div>
);