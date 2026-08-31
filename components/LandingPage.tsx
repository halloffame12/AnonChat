import React, { useEffect, useState, useRef } from 'react';
import { MessageCircle, Zap, Shield, Globe, Heart, Lock, ArrowRight, Users, Sparkles, Smile, Github } from 'lucide-react';
import AvatarPeep, { AvatarPeepCluster } from './AvatarPeep';

interface LandingPageProps {
  onGetStarted: () => void;
}

const PEER_SEEDS = ['alice', 'bob', 'charlie', 'diana', 'eve', 'frank', 'grace', 'hank'];
const HERO_PEERS = ['maya', 'leo', 'zara', 'max'];

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
  const [stats, setStats] = useState<{ onlineUsers: number; totalMessages: number } | null>(null);
  const [avatarLoaded, setAvatarLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setAvatarLoaded(true), 300);

    const apiUrl = (import.meta as any).env.VITE_API_URL || 'http://localhost:3001';
    const fetchStats = () => {
      fetch(`${apiUrl}/api/stats`)
        .then(r => r.json())
        .then(data => setStats({ onlineUsers: data.onlineUsers, totalMessages: data.totalMessages }))
        .catch(() => {});
    };
    fetchStats();
    const interval = setInterval(fetchStats, 10000);

    return () => { clearTimeout(t); clearInterval(interval); };
  }, []);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToTop = () => {
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div ref={containerRef} className="h-screen h-[100dvh] w-full bg-warm-50 text-dark overflow-y-auto overflow-x-hidden font-sans relative scroll-smooth selection:bg-primary/20">
      {/* Decorative background blobs */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="gradient-blob w-[500px] h-[500px] bg-primary/10 -top-32 -left-32" />
        <div className="gradient-blob w-[400px] h-[400px] bg-accent-light/15 top-1/3 -right-20" />
        <div className="gradient-blob w-[300px] h-[300px] bg-sage/15 bottom-1/4 left-1/4" />
        {/* Dotted pattern overlay */}
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'radial-gradient(circle, #7c5cbf 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
      </div>

      {/* Navbar */}
      <nav className="relative z-50 container mx-auto px-6 py-5 flex justify-between items-center sticky top-0 bg-warm-50/85 backdrop-blur-lg border-b border-warm-200/60">
        <div className="flex items-center gap-2.5 font-bold text-xl tracking-tight cursor-pointer" onClick={scrollToTop}>
          <div className="w-9 h-9 bg-gradient-to-br from-primary to-primary-dark rounded-xl flex items-center justify-center shadow-soft">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <span className="hidden sm:inline text-dark">AnonChat<span className="text-primary">Live</span></span>
        </div>
        <div className="hidden md:flex items-center gap-7 text-warm-600 text-sm font-semibold">
          <button onClick={() => scrollToSection('how-it-works')} className="hover:text-primary transition-colors">How it Works</button>
          <button onClick={() => scrollToSection('features')} className="hover:text-primary transition-colors">Features</button>
          <button onClick={() => scrollToSection('community')} className="hover:text-primary transition-colors">Community</button>
          <button onClick={() => scrollToSection('safety')} className="hover:text-primary transition-colors">Safety</button>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/halloffame12/AnonChat"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-warm-600 bg-white border border-warm-200 rounded-xl hover:border-primary/30 hover:text-primary hover:shadow-soft transition-all"
          >
            <Github className="w-4 h-4" />
            Star
            <div className="flex items-center gap-0.5 ml-0.5 text-amber-500">
              <svg className="w-3 h-3 fill-current" viewBox="0 0 16 16"><path d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z"/></svg>
            </div>
          </a>
          <button
            onClick={onGetStarted}
            className="px-5 py-2.5 bg-primary text-white rounded-2xl font-bold text-sm shadow-warm hover:shadow-xl hover:scale-[1.03] active:scale-[0.97] transition-all"
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* === HERO === */}
      <header className="relative z-10 container mx-auto px-6 pt-12 md:pt-20 pb-16 md:pb-28 text-center">
        {/* Live badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white shadow-soft border border-warm-100 text-primary text-[11px] font-bold uppercase tracking-wider mb-8 animate-fade-in-up">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span>{stats ? `${stats.onlineUsers.toLocaleString()} people chatting now` : 'Loading live stats...'}</span>
        </div>

        {/* Hero Peeps cluster — the main illustration */}
        <div className={`flex justify-center gap-2 sm:gap-3 mb-8 transition-all duration-1000 ease-out ${avatarLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <AvatarPeep seed={HERO_PEERS[0]} size={96} className="!w-11 !h-11 sm:!w-14 sm:!h-14 md:!w-16 md:!h-16 ring-4 ring-white shadow-soft -rotate-6 hover:rotate-0 transition-transform duration-300" />
          <AvatarPeep seed={HERO_PEERS[1]} size={96} className="!w-[52px] !h-[52px] sm:!w-16 sm:!h-16 md:!w-20 md:!h-20 ring-4 ring-white shadow-soft translate-y-2 hover:translate-y-0 transition-transform duration-300" />
          <AvatarPeep seed={HERO_PEERS[2]} size={96} className="!w-12 !h-12 sm:!w-[60px] sm:!h-[60px] md:!w-[72px] md:!h-[72px] ring-4 ring-white shadow-soft -translate-y-1 hover:translate-y-0 transition-transform duration-300" />
          <AvatarPeep seed={HERO_PEERS[3]} size={96} className="!w-11 !h-11 sm:!w-14 sm:!h-14 md:!w-[68px] md:!h-[68px] ring-4 ring-white shadow-soft rotate-3 hover:rotate-0 transition-transform duration-300" />
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.1] mb-6 tracking-tight text-balance animate-fade-in-up [animation-delay:0.1s]">
          Talk to Strangers,{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-primary-light to-accent-light">
            Make Real Connections.
          </span>
        </h1>

        <p className="text-base md:text-lg text-warm-600 max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in-up [animation-delay:0.2s]">
          The next generation of anonymous chat. Secure, fast, and beautifully designed 
          for meaningful conversations without boundaries.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 animate-fade-in-up [animation-delay:0.3s]">
          <button
            onClick={onGetStarted}
            className="w-full sm:w-auto px-8 py-3.5 bg-primary text-white rounded-2xl font-bold text-base shadow-warm hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 group"
          >
            <Zap className="w-5 h-5 fill-white" />
            Start Chatting Free
          </button>
          <button
            onClick={() => scrollToSection('how-it-works')}
            className="w-full sm:w-auto px-8 py-3.5 bg-white text-dark rounded-2xl font-bold text-base border-2 border-warm-200 hover:border-primary/30 hover:bg-warm-50 transition-all flex items-center justify-center gap-2"
          >
            See How it Works
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap items-center justify-center gap-6 mt-10 text-xs text-warm-600 font-medium animate-fade-in-up [animation-delay:0.4s]">
          <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> No Sign-up</span>
          <span className="flex items-center gap-1.5"><Smile className="w-3.5 h-3.5" /> 100% Anonymous</span>
          <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Global Community</span>
        </div>
      </header>

      {/* === HOW IT WORKS === */}
      <section id="how-it-works" className="relative z-10 py-20 md:py-28 bg-white border-y border-warm-100">
        <div className="container mx-auto px-6">
          <div className="text-center mb-14">
            <span className="text-primary font-bold tracking-wider uppercase text-xs">Simple Steps</span>
            <h2 className="text-3xl md:text-4xl font-extrabold mt-2 mb-3 text-dark">How It Works</h2>
            <p className="text-warm-500">Three steps to your first conversation</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8 relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-16 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20" />

            {/* Step 1 */}
            <div className="relative bg-warm-50 border border-warm-200 p-8 rounded-3xl text-center group hover:border-primary/30 hover:shadow-soft transition-all z-10">
              <div className="absolute -top-3 -left-3 w-8 h-8 bg-primary text-white rounded-xl flex items-center justify-center text-sm font-extrabold shadow-soft">1</div>
              <div className="flex justify-center mb-5">
                <AvatarPeep seed="step-pick" size={88} className="ring-4 ring-white shadow-soft group-hover:scale-105 transition-transform duration-300" />
              </div>
              <h3 className="text-lg font-bold text-dark mb-2">Pick an Identity</h3>
              <p className="text-sm text-warm-500 leading-relaxed">Choose a temporary username. No email, no sign-up, no data stored.</p>
            </div>

            {/* Step 2 */}
            <div className="relative bg-warm-50 border border-warm-200 p-8 rounded-3xl text-center group hover:border-primary/30 hover:shadow-soft transition-all z-10 md:-mt-4">
              <div className="absolute -top-3 -left-3 w-8 h-8 bg-primary text-white rounded-xl flex items-center justify-center text-sm font-extrabold shadow-soft">2</div>
              <div className="flex justify-center mb-5">
                <AvatarPeep seed="step-match" size={88} className="ring-4 ring-white shadow-soft group-hover:scale-105 transition-transform duration-300" flip />
              </div>
              <h3 className="text-lg font-bold text-dark mb-2">Get Matched</h3>
              <p className="text-sm text-warm-500 leading-relaxed">Our smart algorithm finds you a like-minded partner in seconds.</p>
            </div>

            {/* Step 3 */}
            <div className="relative bg-warm-50 border border-warm-200 p-8 rounded-3xl text-center group hover:border-primary/30 hover:shadow-soft transition-all z-10">
              <div className="absolute -top-3 -left-3 w-8 h-8 bg-primary text-white rounded-xl flex items-center justify-center text-sm font-extrabold shadow-soft">3</div>
              <div className="flex justify-center mb-5">
                <AvatarPeep seed="step-chat" size={88} className="ring-4 ring-white shadow-soft group-hover:scale-105 transition-transform duration-300" />
              </div>
              <h3 className="text-lg font-bold text-dark mb-2">Start Chatting</h3>
              <p className="text-sm text-warm-500 leading-relaxed">Connect instantly with text, emojis, reactions, and more.</p>
            </div>
          </div>
        </div>
      </section>

      {/* === FEATURES === */}
      <section id="features" className="relative z-10 py-20 md:py-28">
        <div className="container mx-auto px-6">
          <div className="text-center mb-14">
            <span className="text-primary font-bold tracking-wider uppercase text-xs">Why Choose Us</span>
            <h2 className="text-3xl md:text-4xl font-extrabold mt-2 mb-3 text-dark">Everything You Need</h2>
            <p className="text-warm-500">Premium features, completely free</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            <FeatureCard
              icon={<Shield className="w-6 h-6" />}
              title="Truly Anonymous"
              description="No emails, no phone numbers. Just pick a name and start."
              iconBg="bg-emerald-100 text-emerald-600"
              borderColor="hover:border-emerald-300"
            />
            <FeatureCard
              icon={<Globe className="w-6 h-6" />}
              title="Global Community"
              description="Connect with people from 150+ countries and explore cultures."
              iconBg="bg-blue-100 text-blue-600"
              borderColor="hover:border-blue-300"
            />
            <FeatureCard
              icon={<Lock className="w-6 h-6" />}
              title="Secure & Private"
              description="End-to-end encrypted. Your history vanishes when you leave."
              iconBg="bg-rose-100 text-rose-600"
              borderColor="hover:border-rose-300"
            />
            <FeatureCard
              icon={<Zap className="w-6 h-6" />}
              title="Instant Matching"
              description="Lightning-fast matching. Zero waiting time."
              iconBg="bg-amber-100 text-amber-600"
              borderColor="hover:border-amber-300"
            />
            <FeatureCard
              icon={<Heart className="w-6 h-6" />}
              title="Group Chats"
              description="Create or join public rooms to chat with multiple people."
              iconBg="bg-purple-100 text-purple-600"
              borderColor="hover:border-purple-300"
            />
            <FeatureCard
              icon={<Sparkles className="w-6 h-6" />}
              title="Clean Experience"
              description="Distraction-free design. Just you and the conversation."
              iconBg="bg-pink-100 text-pink-600"
              borderColor="hover:border-pink-300"
            />
          </div>
        </div>
      </section>

      {/* === COMMUNITY === */}
      <section id="community" className="relative z-10 py-20 md:py-28 bg-gradient-to-b from-white to-warm-50 border-y border-warm-100">
        <div className="container mx-auto px-6 text-center">
          <div className="max-w-3xl mx-auto">
            {/* Large peep cluster */}
            <div className="flex justify-center mb-8">
              <AvatarPeepCluster seeds={PEER_SEEDS} size={64} max={8} className="[&>*]:ring-4 [&>*]:ring-white" />
            </div>

            <span className="text-primary font-bold tracking-wider uppercase text-xs">Community</span>
            <h2 className="text-3xl md:text-5xl font-extrabold mt-2 mb-4 text-dark">A Growing Community</h2>
            <p className="text-warm-500 text-base md:text-lg mb-12 leading-relaxed max-w-xl mx-auto">
              {stats ? `${stats.onlineUsers.toLocaleString()} people are online right now, connecting anonymously.` : 'People connecting anonymously, making new friends every day.'}
            </p>

            <div className="grid grid-cols-2 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl p-6 shadow-soft border border-warm-100">
                <div className="text-3xl font-extrabold text-dark mb-1">{stats ? stats.onlineUsers.toLocaleString() : '...'}</div>
                <div className="text-xs text-warm-500 font-semibold uppercase tracking-wider">Online Now</div>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-soft border border-warm-100">
                <div className="text-3xl font-extrabold text-dark mb-1">{stats ? stats.totalMessages.toLocaleString() : '...'}</div>
                <div className="text-xs text-warm-500 font-semibold uppercase tracking-wider">Messages Sent</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* === SAFETY === */}
      <section id="safety" className="relative z-10 py-20 md:py-28">
        <div className="container mx-auto px-6">
          <div className="bg-white rounded-3xl p-8 md:p-12 border border-warm-100 shadow-soft relative overflow-hidden">
            <div className="gradient-blob w-80 h-80 bg-sage/10 -top-20 -right-20" />
            <div className="gradient-blob w-60 h-60 bg-primary/5 -bottom-20 -left-20" />

            <div className="grid md:grid-cols-2 gap-10 items-center relative z-10">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sage/10 text-sage text-[11px] font-bold uppercase tracking-wider mb-5">
                  <Shield className="w-3.5 h-3.5" /> Safety First
                </div>
                <h2 className="text-3xl md:text-4xl font-extrabold text-dark mb-5">Your Safety is Our Priority</h2>
                <div className="space-y-5">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-xl bg-sage/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Shield className="w-4 h-4 text-sage" />
                    </div>
                    <div>
                      <h4 className="font-bold text-dark text-sm mb-0.5">Active Moderation</h4>
                      <p className="text-sm text-warm-500">AI and human moderators work 24/7 to keep the platform clean.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Shield className="w-4 h-4 text-accent" />
                    </div>
                    <div>
                      <h4 className="font-bold text-dark text-sm mb-0.5">Report & Block</h4>
                      <p className="text-sm text-warm-500">Instantly block or report anyone who makes you uncomfortable.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Lock className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-bold text-dark text-sm mb-0.5">No Personal Data</h4>
                      <p className="text-sm text-warm-500">We never ask for your real identity. Your secrets are safe.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center gap-6">
                <AvatarPeep seed="safety-peep" size={180} className="ring-4 ring-white shadow-soft" />
                <div className="bg-warm-50 p-6 rounded-2xl border border-warm-200 w-full">
                  <h3 className="font-bold text-dark text-base mb-3">Community Guidelines</h3>
                  <ul className="space-y-3 text-sm text-warm-600">
                    <li className="flex items-start gap-2.5"><span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />Be respectful. Harassment is not tolerated.</li>
                    <li className="flex items-start gap-2.5"><span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />No inappropriate content. Keep it clean.</li>
                    <li className="flex items-start gap-2.5"><span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />Never share personal information.</li>
                    <li className="flex items-start gap-2.5"><span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />You must be 13+ to use this service.</li>
                  </ul>
                  <button
                    onClick={onGetStarted}
                    className="btn-primary w-full mt-6"
                  >
                    I Agree & Start Chatting
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* === FINAL CTA === */}
      <section className="relative z-10 py-20 bg-gradient-to-b from-warm-50 to-white border-t border-warm-100">
        <div className="container mx-auto px-6 text-center">
          <div className="max-w-lg mx-auto">
            <AvatarPeep seed="cta-peep" size={100} className="ring-4 ring-white shadow-soft mx-auto mb-6" />
            <h2 className="text-3xl md:text-4xl font-extrabold text-dark mb-3">Ready to Connect?</h2>
            <p className="text-warm-500 mb-8">{stats ? `${stats.onlineUsers.toLocaleString()} people are chatting right now.` : 'Join the conversation.'}</p>
            <button
              onClick={onGetStarted}
              className="btn-primary px-10 py-4 text-lg"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Start Chatting Free
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-warm-200 bg-warm-50 py-10 relative z-10">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-2 font-bold text-lg">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary-dark rounded-lg flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-white" />
              </div>
              <span className="text-dark">AnonChat<span className="text-primary">Live</span></span>
            </div>
            <div className="flex items-center gap-6 text-sm text-warm-500">
              <a href="https://github.com/halloffame12/AnonChat" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors font-medium inline-flex items-center gap-1.5">
                <Github className="w-4 h-4" /> GitHub
              </a>
              <a href="https://github.com/halloffame12/AnonChat/stargazers" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors font-medium inline-flex items-center gap-1">
                <svg className="w-3.5 h-3.5 fill-amber-500" viewBox="0 0 16 16"><path d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z"/></svg>
                Star
              </a>
            </div>
          </div>
          <div className="text-center text-xs text-warm-500">
            &copy; {new Date().getFullYear()} AnonChat Live. Connecting the world anonymously.
          </div>
        </div>
      </footer>
    </div>
  );
};

const FeatureCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  iconBg: string;
  borderColor: string;
}> = ({ icon, title, description, iconBg, borderColor }) => (
  <div className={`bg-white p-6 rounded-2xl border-2 border-warm-100 hover:-translate-y-1 transition-all duration-300 group ${borderColor} shadow-sm hover:shadow-soft`}>
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 ${iconBg}`}>
      {icon}
    </div>
    <h3 className="font-bold text-dark mb-1.5">{title}</h3>
    <p className="text-sm text-warm-500 leading-relaxed">{description}</p>
  </div>
);
