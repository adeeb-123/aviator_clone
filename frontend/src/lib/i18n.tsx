'use client';

import { createContext, useContext, useEffect, useState } from 'react';

export type Lang = 'en' | 'hi';

/** Translation dictionary. English is the source of truth; missing keys fall back to it. */
const DICT: Record<string, Record<Lang, string>> = {
  // nav
  'nav.play': { en: 'Play', hi: 'खेलें' },
  'nav.rewards': { en: '🎁 Rewards', hi: '🎁 इनाम' },
  'nav.tournaments': { en: '🏆 Tournaments', hi: '🏆 टूर्नामेंट' },
  'nav.stats': { en: 'My Stats', hi: 'मेरे आँकड़े' },
  'nav.history': { en: 'History', hi: 'इतिहास' },
  'nav.profile': { en: 'Profile', hi: 'प्रोफ़ाइल' },
  'nav.fairness': { en: 'Provably Fair', hi: 'प्रमाणित निष्पक्ष' },
  'nav.rtp': { en: 'RTP', hi: 'आरटीपी' },
  'nav.admin': { en: 'Admin', hi: 'एडमिन' },
  'nav.wallet': { en: 'Wallet', hi: 'वॉलेट' },
  'nav.login': { en: 'Login / Register', hi: 'लॉगिन / रजिस्टर' },
  'nav.logout': { en: 'Logout', hi: 'लॉगआउट' },
  'common.balance': { en: 'Balance', hi: 'बैलेंस' },
  // bet panel
  'bet.manual': { en: 'Manual', hi: 'मैनुअल' },
  'bet.auto': { en: 'Auto', hi: 'ऑटो' },
  'bet.bet': { en: 'Bet', hi: 'दांव' },
  'bet.cashout': { en: 'Cash Out', hi: 'कैश आउट' },
  'bet.autocashout': { en: 'Auto cashout', hi: 'ऑटो कैशआउट' },
  'bet.rebet': { en: 'Rebet', hi: 'फिर दांव' },
  'bet.start': { en: '▶ Start auto-bet', hi: '▶ ऑटो-बेट शुरू' },
  'bet.stop': { en: '■ Stop auto-bet', hi: '■ ऑटो-बेट बंद' },
  'bet.strategy': { en: 'Strategy', hi: 'रणनीति' },
  'bet.rounds': { en: 'Rounds (∞ if empty)', hi: 'राउंड (खाली = ∞)' },
  'bet.cashAt': { en: 'Cash out @', hi: 'कैश आउट @' },
  'bet.waiting': { en: 'Waiting for round…', hi: 'राउंड का इंतज़ार…' },
  'bet.cashed': { en: 'Cashed', hi: 'कैश किया' },
  'bet.loginToBet': { en: 'Please log in to bet', hi: 'दांव के लिए लॉगिन करें' },
  'bet.sessionPL': { en: 'Session P/L', hi: 'सत्र लाभ/हानि' },
  'bet.stopProfit': { en: 'Stop if profit ≥ ₹', hi: 'लाभ ≥ ₹ पर रुकें' },
  'bet.stopLoss': { en: 'Stop if loss ≥ ₹', hi: 'हानि ≥ ₹ पर रुकें' },
  // game
  'game.nextRound': { en: 'Next round in', hi: 'अगला राउंड' },
  'game.placeBets': { en: 'Place your bets', hi: 'अपना दांव लगाएं' },
  'game.flewAway': { en: 'Flew away!', hi: 'उड़ गया!' },
  // chat
  'chat.title': { en: 'Live Chat', hi: 'लाइव चैट' },
  'chat.message': { en: 'Message…', hi: 'संदेश…' },
  'chat.send': { en: 'Send', hi: 'भेजें' },
  'chat.loginToChat': { en: 'Log in to chat', hi: 'चैट के लिए लॉगिन करें' },
  'chat.sayHi': { en: 'Say hi to the table 👋', hi: 'सबको नमस्ते कहें 👋' },
  // leaderboard / wins
  'lb.title': { en: '🏆 Top Winners', hi: '🏆 शीर्ष विजेता' },
  'lb.today': { en: 'today', hi: 'आज' },
  'lb.week': { en: 'week', hi: 'सप्ताह' },
  'lb.all': { en: 'all', hi: 'सभी' },
  'lb.none': { en: 'No winners yet.', hi: 'अभी कोई विजेता नहीं।' },
  'wins.live': { en: '🏆 Live wins', hi: '🏆 लाइव जीत' },
  'reward.claim': { en: '🎁 Claim daily reward', hi: '🎁 दैनिक इनाम लें' },
  // auth
  'auth.welcome': { en: 'Welcome back', hi: 'वापसी पर स्वागत है' },
  'auth.create': { en: 'Create your account', hi: 'खाता बनाएं' },
  'auth.email': { en: 'Email', hi: 'ईमेल' },
  'auth.password': { en: 'Password', hi: 'पासवर्ड' },
  'auth.username': { en: 'Username', hi: 'यूज़रनेम' },
  'auth.login': { en: 'Login', hi: 'लॉगिन' },
  'auth.register': { en: 'Register', hi: 'रजिस्टर' },
};

interface I18nCtx { lang: Lang; setLang: (l: Lang) => void; t: (key: string) => string }
const Ctx = createContext<I18nCtx>({ lang: 'en', setLang: () => {}, t: (k) => k });

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');
  useEffect(() => {
    const saved = (typeof window !== 'undefined' && localStorage.getItem('aviatorLang')) as Lang | null;
    if (saved === 'en' || saved === 'hi') setLangState(saved);
  }, []);
  const setLang = (l: Lang) => { setLangState(l); if (typeof window !== 'undefined') localStorage.setItem('aviatorLang', l); };
  const t = (key: string) => DICT[key]?.[lang] ?? DICT[key]?.en ?? key;
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export const useT = () => useContext(Ctx);
