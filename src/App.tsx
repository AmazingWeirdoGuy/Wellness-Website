import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Feather,
  Flame,
  Heart,
  LockKeyhole,
  Mail,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Wind,
  X,
} from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { BurnEffect, BURN_DURATION_MS } from './BurnEffect';
import { MindfulnessMinigames, createMindfulnessState } from './MindfulnessMinigames';
import { useBookTurn, type PageDirection } from './useBookTurn';

type Section = 'contents' | 'checkin' | 'letout' | 'guided' | 'minigames' | 'kind';
type InfoPage = 'about' | 'contact' | 'terms' | 'privacy';
const CONTACT_EMAIL = 'ronnie111555@gmail.com';
const SITE_ORIGIN = 'https://wellnessdiary.org';
const founderSchema = {
  '@type': 'Person',
  '@id': `${SITE_ORIGIN}/about/#founder`,
  name: 'Rungphob Lertvilaivithaya',
  givenName: 'Rungphob',
  familyName: 'Lertvilaivithaya',
  alternateName: 'Ronnie',
  url: `${SITE_ORIGIN}/about/`,
  description: 'Rungphob Lertvilaivithaya, also known as Ronnie, is a high school student and the founder and creator of Wellness Diary.',
  image: `${SITE_ORIGIN}/founder-rungphob.webp`,
  email: `mailto:${CONTACT_EMAIL}`,
  mainEntityOfPage: { '@id': `${SITE_ORIGIN}/about/#webpage` },
} as const;

const publicPageMeta = {
  about: {
    title: 'Rungphob Lertvilaivithaya (Ronnie) | Wellness Diary Founder',
    description: 'Meet Rungphob Lertvilaivithaya (Ronnie), the student founder of Wellness Diary. Learn why he created this private space for journaling and mindfulness.',
  },
  contact: {
    title: 'Contact Rungphob Lertvilaivithaya | Wellness Diary',
    description: 'Get in touch with Rungphob Lertvilaivithaya about Wellness Diary, accessibility, ideas, or thoughtful feedback.',
  },
} as const;

const sections: Array<{ id: Section; label: string; short: string; icon: typeof Heart }> = [
  { id: 'contents', label: 'Contents', short: 'Open', icon: BookOpen },
  { id: 'checkin', label: 'Check In', short: '01', icon: Heart },
  { id: 'letout', label: 'Let It Out', short: '02', icon: Feather },
  { id: 'guided', label: 'Guided Pages', short: '03', icon: Sparkles },
  { id: 'minigames', label: 'Mindfulness Minigames', short: '04', icon: Wind },
  { id: 'kind', label: 'Kind Words', short: '05', icon: Mail },
];

const prompts = [
  'What’s been weighing on you?',
  'What do you wish someone understood today?',
  'What has been quietly asking for your attention?',
];

const feelings = ['Tender', 'Restless', 'Heavy', 'Hopeful', 'Numb', 'Clear', 'Lonely', 'Grateful'];
const guidedPrompts = [
  'What would feel like a small kindness to yourself tonight?',
  'Which part of today deserves to be remembered gently?',
  'If your worry could speak, what would it ask for?',
];

const kindWords = [
  'You can take this slowly. There is no prize for carrying everything at once.',
  'Being tired of being strong is a very human thing.',
  'Start with the kindest true thing you can find.',
  'Rest is part of the work, not something you have to earn.',
  'You do not need to solve the whole day right now.',
  'Small steps still move you toward gentler ground.',
  'You are allowed to protect the quiet you need.',
  'Today does not have to be perfect to hold something good.',
  'Your feelings can be real without being permanent.',
  'Pause long enough to notice what your heart has been carrying.',
  'You can change your mind when something no longer fits.',
  'A quiet no can be an act of care.',
  'You deserve kindness before you have everything figured out.',
  'Your pace is still a pace.',
  'It is okay to need more time than you expected.',
  'You have made it through every day that brought you here.',
  'One gentle choice is enough for this moment.',
  'You do not have to make yourself smaller to make others comfortable.',
  'Let this moment be unfinished without calling it a failure.',
  'There is room for joy beside everything that feels heavy.',
  'You are more than the hardest thing on your mind today.',
  'Asking for help is a way of choosing yourself.',
  'You can begin again without explaining the old beginning.',
  'The version of you that is learning deserves patience too.',
  'Your softness is not a weakness.',
  'Some days, getting through is more than enough.',
  'You may set down what was never yours to carry.',
  'Not every thought needs an answer.',
  'You can celebrate progress before the finish line.',
  'Take up the space your breath already knows you deserve.',
  'Your needs are not an inconvenience.',
  'A difficult moment does not erase a meaningful day.',
  'You can be proud of the boundaries that keep you whole.',
  'Leave room for something unexpectedly tender.',
  'You are still worthy on the days you feel uncertain.',
  'The smallest act of care still counts.',
  'You do not owe productivity every hour of your life.',
  'There is courage in admitting that something hurts.',
  'You can listen to yourself without rushing to fix yourself.',
  'It is enough to meet this day as you are.',
  'The day can be hard and you can still be gentle with yourself.',
  'Your worth does not rise and fall with your energy.',
  'You may be a work in progress and a whole person at once.',
  'What you need matters, even when it is hard to name.',
  'You can hold hope lightly; it does not have to be loud.',
  'Let yourself notice how far you have already come.',
  'You deserve relationships where your nervous system can rest.',
  'You are allowed to outgrow old ways of surviving.',
  'You have permission to make today a little easier.',
  'Keep the next step small enough to feel kind.',
] as const;

const drawKindWords = (previous: readonly string[] = []) => {
  const pool = kindWords.filter((note) => !previous.includes(note));
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }
  return pool.slice(0, 3);
};

function LegalLinks({ onOpen }: { onOpen: (page: InfoPage) => void }) {
  return (
    <div className="legal-links" aria-label="Legal">
      <button onClick={() => onOpen('terms')}>Terms of use</button>
      <span aria-hidden="true">·</span>
      <button onClick={() => onOpen('privacy')}>Privacy policy</button>
    </div>
  );
}

function AboutSpread({ publicPage = false }: { publicPage?: boolean }) {
  const FounderHeading = publicPage ? 'h1' : 'h2';
  const GreetingHeading = publicPage ? 'h2' : 'h3';
  return (
    <div className="about-spread">
      <section className="about-panel about-intro">
        <div className="eyebrow">A little about this place</div>
        <h2>Made for the moments between.</h2>
        <div className="about-copy">
          <p>Wellness Diary is a quiet, self-guided space for noticing what is true, putting words somewhere safe for this moment, and making a little room to breathe.</p>
          <p>It was made with the belief that reflection does not need to be polished to be useful. You can arrive tired, uncertain, hopeful, or unfinished. The page will meet you there.</p>
          <p className="about-mantra">Take what helps. Leave what does not. There is no right way to use these pages.</p>
        </div>
      </section>
      <section className="about-panel about-founder" id="founder" aria-labelledby="info-page-title">
        <div className="eyebrow">Meet the founder</div>
        <div className="founder-header">
          <div className="founder-portrait">
            <img src="/founder-rungphob.webp" alt="Portrait of Rungphob Lertvilaivithaya" />
          </div>
          <div className="founder-identity">
            <FounderHeading id="info-page-title" className="founder-name">Rungphob Lertvilaivithaya</FounderHeading>
            <p className="founder-byline">Founder and creator of Wellness Diary</p>
            <div className="founder-roles" aria-label="Student, Creator, Wellbeing Advocate">
              <span>Student</span><span>Creator</span><span>Wellbeing Advocate</span>
            </div>
          </div>
        </div>
        <div className="founder-copy">
          <GreetingHeading>Hi, you can call me Ronnie.</GreetingHeading>
          <p>I’m a high school student who cares about mental wellbeing and enjoys using technology and creativity to make useful things for others.</p>
          <p>I started Wellness Diary because I wanted to create somewhere people could pause, write honestly, and give themselves a little breathing room. As a student, I know how much school, expectations, and figuring out your future can take up in your head. I’m still finding my way through it, too.</p>
          <p>I’m constantly learning and working to make this space more thoughtful, useful, and welcoming. If you have feedback, an idea, or just want to say hi, I’d love to hear from you.</p>
          <p>Thank you for spending a little of your day here. I hope you find something that helps.</p>
          <p className="founder-signature">— Ronnie</p>
          {CONTACT_EMAIL.includes('@') && <a className="quiet-button founder-contact" href={`mailto:${CONTACT_EMAIL}`}><Mail size={14} /> Say hello</a>}
          <p className="founder-privacy">Journal entries stay private in this session and are never submitted as feedback.</p>
        </div>
      </section>
    </div>
  );
}

function ContactContent() {
  return (
    <div className="info-page-content">
      <div className="eyebrow">A note from the other side</div>
      <h1 id="public-info-title">We would like to hear from you.</h1>
      <div className="info-copy">
        <p>Get in touch with <a href="/about/">Rungphob Lertvilaivithaya (Ronnie)</a>, the founder of Wellness Diary, for questions, accessibility notes, or thoughtful feedback. I would love to hear from you.</p>
        <a className="contact-link" href={`mailto:${CONTACT_EMAIL}`}><Mail size={17} strokeWidth={1.4} /> {CONTACT_EMAIL} <ArrowRight size={15} strokeWidth={1.4} /></a>
        <p className="info-small">Please do not send urgent or crisis information by email. Wellness Diary is not a monitored crisis service.</p>
      </div>
    </div>
  );
}

function SeoHead({ page }: { page: keyof typeof publicPageMeta }) {
  useEffect(() => {
    const metadata = publicPageMeta[page];
    const canonicalUrl = `${SITE_ORIGIN}/${page}/`;
    const previousTitle = document.title;
    const managedMeta = new Map<string, { element: HTMLMetaElement; previous: string | null; created: boolean }>();
    const setMeta = (selector: string, attributes: Record<string, string>, content: string) => {
      let element = document.head.querySelector<HTMLMetaElement>(selector);
      const created = !element;
      if (!element) {
        element = document.createElement('meta');
        Object.entries(attributes).forEach(([key, value]) => element?.setAttribute(key, value));
        document.head.appendChild(element);
      }
      managedMeta.set(selector, { element, previous: created ? null : element.getAttribute('content'), created });
      element.setAttribute('content', content);
    };
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    const previousCanonical = canonical.getAttribute('href');
    canonical.href = canonicalUrl;
    const structuredData = document.createElement('script');
    structuredData.type = 'application/ld+json';
    structuredData.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': page === 'about' ? ['AboutPage', 'ProfilePage'] : 'ContactPage',
      '@id': `${canonicalUrl}#webpage`,
      name: metadata.title,
      description: metadata.description,
      url: canonicalUrl,
      inLanguage: 'en',
      isPartOf: {
        '@type': 'WebSite',
        '@id': `${SITE_ORIGIN}/#website`,
        name: 'Wellness Diary',
        url: `${SITE_ORIGIN}/`,
        creator: { '@id': founderSchema['@id'] },
      },
      mainEntity: founderSchema,
    });
    document.head.appendChild(structuredData);
    document.title = metadata.title;
    setMeta('meta[name="description"]', { name: 'description' }, metadata.description);
    setMeta('meta[property="og:title"]', { property: 'og:title' }, metadata.title);
    setMeta('meta[property="og:description"]', { property: 'og:description' }, metadata.description);
    setMeta('meta[property="og:url"]', { property: 'og:url' }, canonicalUrl);
    setMeta('meta[property="og:type"]', { property: 'og:type' }, page === 'about' ? 'profile' : 'website');
    setMeta('meta[property="og:image"]', { property: 'og:image' }, founderSchema.image);
    setMeta('meta[property="og:image:alt"]', { property: 'og:image:alt' }, 'Rungphob Lertvilaivithaya, founder of Wellness Diary');
    setMeta('meta[name="twitter:card"]', { name: 'twitter:card' }, 'summary');
    setMeta('meta[name="twitter:image"]', { name: 'twitter:image' }, founderSchema.image);
    setMeta('meta[name="twitter:image:alt"]', { name: 'twitter:image:alt' }, 'Rungphob Lertvilaivithaya, founder of Wellness Diary');
    setMeta('meta[name="twitter:title"]', { name: 'twitter:title' }, metadata.title);
    setMeta('meta[name="twitter:description"]', { name: 'twitter:description' }, metadata.description);
    return () => {
      document.title = previousTitle;
      if (previousCanonical) canonical!.href = previousCanonical;
      else canonical?.remove();
      structuredData.remove();
      managedMeta.forEach(({ element, previous, created }) => {
        if (created) element.remove();
        else if (previous === null) element.removeAttribute('content');
        else element.setAttribute('content', previous);
      });
    };
  }, [page]);
  return null;
}

function PublicInfoPage({ page }: { page: 'about' | 'contact' }) {
  return (
    <>
      <SeoHead page={page} />
      <main className="public-info-shell">
        <article className={`info-page public-info-page ${page === 'about' ? 'info-page-about' : ''}`}>
          <div className="info-page-top">
            <a className="info-brand-lockup" href="/" aria-label="Wellness Diary home">
              <img className="brand-mark-image" src="/wellness-diary-mark.svg" alt="" />
              <span className="brand-name">Wellness Diary</span>
            </a>
            <a className="quiet-button" href="/"><ArrowLeft size={15} /> Back to journal</a>
          </div>
          {page === 'about' ? <AboutSpread publicPage /> : <ContactContent />}
          <div className="info-page-bottom"><span>Wellness Diary</span><nav className="info-footer-links" aria-label="Site"><a href="/about/">About Rungphob Lertvilaivithaya</a><a href="/contact/">Contact</a></nav></div>
        </article>
      </main>
    </>
  );
}

function InfoPageView({ page, onClose }: { page: InfoPage; onClose: () => void }) {
  const content: Record<InfoPage, { eyebrow: string; title: string; body: ReactNode }> = {
    about: {
      eyebrow: 'A little about this place',
      title: 'Made for the moments between.',
      body: (
        <>
          <p>Wellness Diary is a quiet, self-guided space for noticing what is true, putting words somewhere safe for this moment, and making a little room to breathe.</p>
          <p>It was made with the belief that reflection does not need to be polished to be useful. You can arrive tired, uncertain, hopeful, or unfinished. The page will meet you there.</p>
          <p>Take what helps. Leave what does not. There is no right way to use these pages.</p>
        </>
      ),
    },
    contact: {
      eyebrow: 'A note from the other side',
      title: 'We would like to hear from you.',
      body: (
        <>
          <p>For questions, accessibility notes, or thoughtful feedback about Wellness Diary, send a note and we will read it with care.</p>
          <a className="contact-link" href={`mailto:${CONTACT_EMAIL}`}><Mail size={17} strokeWidth={1.4} /> {CONTACT_EMAIL} <ArrowRight size={15} strokeWidth={1.4} /></a>
          <p className="info-small">Please do not send urgent or crisis information by email. Wellness Diary is not a monitored crisis service.</p>
        </>
      ),
    },
    terms: {
      eyebrow: 'The small print',
      title: 'Terms of use',
      body: (
        <>
          <p>Wellness Diary is provided as a self-guided reflection and wellbeing tool. It is not medical advice, therapy, diagnosis, or a replacement for care from a qualified professional.</p>
          <p>You are responsible for deciding whether a prompt or activity feels right for you. You may stop at any time. If you are in immediate danger or may hurt yourself, contact local emergency support now.</p>
          <p>These pages are offered as-is for personal use. By using the site, you understand that it does not monitor your entries or provide emergency response.</p>
        </>
      ),
    },
    privacy: {
      eyebrow: 'A clear promise',
      title: 'Privacy policy',
      body: (
        <>
          <p>We don’t save or send your entries. Wellness Diary has no accounts, database, cookies, tracking scripts, or saved journal history.</p>
          <p>Your writing, check-in answers, and activity marks live only in the active page’s memory while you are here. We do not transmit them to external services.</p>
          <div className="info-callout"><LockKeyhole size={18} strokeWidth={1.4} /><span>For a fresh start, use “Clear session” or simply close this page. This is a self-guided tool, not a monitored service.</span></div>
        </>
      ),
    },
  };
  const current = content[page];

  return (
    <div className="info-layer" role="dialog" aria-modal="true" aria-labelledby="info-page-title">
      <div className={`info-page ${page === 'about' ? 'info-page-about' : ''}`}>
        <div className="info-page-top">
          <span className="info-brand-lockup">
            <img className="brand-mark-image" src="/wellness-diary-mark.svg" alt="" />
            <span className="brand-name">Wellness Diary</span>
          </span>
          <button className="quiet-button" onClick={onClose} data-testid="button-close-info"><X size={15} /> Back to journal</button>
        </div>
        {page === 'about' ? <AboutSpread /> : <div className="info-page-content">
          <div className="eyebrow">{current.eyebrow}</div>
          <h2 id="info-page-title">{current.title}</h2>
          <div className="info-copy">{current.body}</div>
        </div>}
        <div className="info-page-bottom"><span>Wellness Diary</span><span>Made for a little room to breathe.</span></div>
      </div>
    </div>
  );
}

function Cover({ onOpen, onSupport, onInfo }: { onOpen: () => void; onSupport: () => void; onInfo: (page: InfoPage) => void }) {
  return (
    <main className="cover" data-testid="screen-cover">
      <nav className="cover-topnav" aria-label="Site">
        <a href="/about/">About us</a>
        <a href="/contact/">Contact</a>
      </nav>
      <div className="cover-inner">
        <div className="cover-copy">
          <div className="cover-kicker eyebrow">A private place to return to</div>
          <h1><span className="cover-word cover-word-wellness">Wellness</span><em className="cover-word cover-word-diary">Diary</em></h1>
          <p className="cover-tagline">A little room to breathe.</p>
          <div className="cover-actions">
            <button className="primary-button" onClick={onOpen} data-testid="button-open-journal">
              Open your journal <ArrowRight size={16} strokeWidth={1.5} />
            </button>
            <button className="quiet-button" onClick={onSupport} data-testid="button-cover-support">
              <ShieldCheck size={15} strokeWidth={1.5} /> Get support
            </button>
          </div>
        </div>
        <div className="cover-mark" aria-hidden="true">
          <div className="cover-mark-spine" />
          <div className="cover-mark-frame" />
          <img className="cover-mark-logo" src="/wellness-diary-mark.svg" alt="" />
          <div className="cover-mark-line" />
          <div className="cover-mark-word">For the things<br />you carry</div>
        </div>
      </div>
      <div className="cover-footnote eyebrow"><span>01</span> — No account · no history · just this moment</div>
      <div className="cover-legal"><LegalLinks onOpen={onInfo} /></div>
    </main>
  );
}

function Header({
  active,
  onChange,
  onHome,
  onSupport,
}: {
  active: Section;
  onChange: (section: Section) => void;
  onHome: () => void;
  onSupport: () => void;
}) {
  const bookmarksRef = useRef<HTMLElement | null>(null);
  const activeBookmarkRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const bookmarks = bookmarksRef.current;
    const activeBookmark = activeBookmarkRef.current;
    if (!bookmarks || !activeBookmark || window.innerWidth > 780) return;

    const left = activeBookmark.offsetLeft - (bookmarks.clientWidth - activeBookmark.clientWidth) / 2;
    bookmarks.scrollTo({
      left: Math.max(0, left),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  }, [active]);

  return (
    <>
      <header className="journal-topbar">
        <button className="brand-lockup" onClick={onHome} data-testid="button-brand-home">
          <span className="brand-stamp"><img className="brand-mark-image" src="/wellness-diary-mark.svg" alt="" /></span>
          <span className="brand-name">Wellness Diary</span>
        </button>
        <div className="top-actions">
          <span className="session-note"><LockKeyhole size={12} /> Private · this session</span>
          <nav className="journal-links" aria-label="Site">
            <a href="/about/">About us</a>
            <a href="/contact/">Contact</a>
          </nav>
          <button className="quiet-button" onClick={onSupport} data-testid="button-header-support">
            <ShieldCheck size={14} strokeWidth={1.5} /> Support
          </button>
        </div>
      </header>
      <nav ref={bookmarksRef} className="bookmarks" aria-label="Journal sections">
        {sections.map(({ id, label, short, icon: Icon }) => (
          <button
            ref={active === id ? activeBookmarkRef : undefined}
            key={id}
            className={`bookmark ${active === id ? 'active' : ''}`}
            onClick={() => onChange(id)}
            aria-current={active === id ? 'page' : undefined}
            data-testid={`button-nav-${id}`}
          >
            <Icon size={13} strokeWidth={1.5} /> {id === 'contents' ? label : `${short} · ${label}`}
          </button>
        ))}
      </nav>
    </>
  );
}

function CheckInPage({
  selectedFeelings,
  onToggleFeeling,
  selectedNeeds,
  onToggleNeed,
}: {
  selectedFeelings: string[];
  onToggleFeeling: (feeling: string) => void;
  selectedNeeds: string[];
  onToggleNeed: (need: string) => void;
}) {
  return (
    <div className="spread" data-testid="page-check-in">
      <section className="sheet">
        <div className="sheet-content" tabIndex={0} role="region" aria-label="How you are feeling">
          <div className="sheet-rubric eyebrow"><span>Today, as it is</span><span className="page-no">01 / 08</span></div>
          <label className="prompt-label">How are you arriving here?</label>
          <p className="page-subtitle">There is no right answer. Notice what is true without needing to fix it.</p>
          <div className="divider-note">Name what’s present</div>
          <div className="feelings" role="group" aria-label="Choose feelings">
            {feelings.map((feeling) => (
              <button
                className={`feeling ${selectedFeelings.includes(feeling) ? 'selected' : ''}`}
                key={feeling}
                onClick={() => onToggleFeeling(feeling)}
                aria-pressed={selectedFeelings.includes(feeling)}
                data-testid={`button-feeling-${feeling.toLowerCase()}`}
              >
                {selectedFeelings.includes(feeling) && <Check size={13} />} {feeling}
              </button>
            ))}
          </div>
          <div className="feeling-score" data-testid="text-feeling-status">
            {selectedFeelings.length ? `${selectedFeelings.length} feeling${selectedFeelings.length > 1 ? 's' : ''} named` : 'You can choose more than one'}
          </div>
        </div>
      </section>
      <section className="sheet">
        <div className="sheet-content" tabIndex={0} role="region" aria-label="What you need">
          <div className="sheet-rubric eyebrow"><span>A softer inventory</span><span className="page-no">02 / 08</span></div>
          <p className="prompt-label" id="needs-question">What do you need a little more of?</p>
          <div className="need-list" role="group" aria-labelledby="needs-question">
            {['A slower pace', 'A bit of company', 'Permission to feel this', 'One uncomplicated thing'].map((item) => (
              <label className={`need-option ${selectedNeeds.includes(item) ? 'selected' : ''}`} key={item}>
                <input
                  className="need-input"
                  type="checkbox"
                  checked={selectedNeeds.includes(item)}
                  onChange={() => onToggleNeed(item)}
                  data-testid={`checkbox-checkin-${item.toLowerCase().replaceAll(' ', '-')}`}
                />
                <span className="need-box" aria-hidden="true"><Check size={13} strokeWidth={2} /></span>
                <span>{item}</span>
              </label>
            ))}
          </div>
          <div className="support-strip">
            <Heart size={17} strokeWidth={1.3} />
            <div><strong>For right now</strong>You do not have to make a plan. Being here counts.</div>
          </div>
        </div>
      </section>
    </div>
  );
}

function WritingPage({
  mode,
  content,
  prompt,
  onContentChange,
  onPromptChange,
  onBurn,
  burning,
}: {
  mode: 'letout' | 'guided';
  content: string;
  prompt: string;
  onContentChange: (value: string) => void;
  onPromptChange: (value: string) => void;
  onBurn: () => void;
  burning: boolean;
}) {
  const isGuided = mode === 'guided';
  const alternatives = isGuided ? guidedPrompts : prompts.slice(1);
  return (
    <div className="spread" data-testid={`page-${mode}`}>
      <section className={`sheet writing-sheet ${burning ? 'is-burning' : ''}`}>
        <div className="sheet-content" tabIndex={0} role="region" aria-label="Writing page">
          <div className="sheet-rubric eyebrow">
            <span>{isGuided ? 'A small doorway in' : 'Nothing to perform'}</span>
            <span className="page-no">{isGuided ? '05 / 08' : '03 / 08'}</span>
          </div>
          <label className="prompt-label" htmlFor="journal-writing">{prompt}</label>
          {isGuided && <p className="page-subtitle">Take the first thought that arrives. You can leave the rest at the door.</p>}
          <textarea
            id="journal-writing"
            className="writing-area"
            value={content}
            onChange={(event) => onContentChange(event.target.value)}
            disabled={burning}
            placeholder="Let the page hold it for a while..."
            aria-label="Journal entry"
            data-testid="textarea-journal-entry"
          />
          <div className="writing-foot">
            <span className="writing-feedback" aria-live="polite" data-testid="status-writing-feedback">
              {burning ? 'Letting this page go…' : content.length ? 'Held in this moment' : 'Your words stay in active memory only'}
            </span>
            <div className="writing-tools">
              <button className="text-button" onClick={onBurn} disabled={burning} data-testid="button-burn-page"><Flame size={12} /> Burn this page</button>
            </div>
          </div>
        </div>
        {burning && <BurnEffect />}
      </section>
      <section className="sheet">
        <div className="sheet-content" tabIndex={0} role="region" aria-label="Writing prompts">
          <div className="sheet-rubric eyebrow"><span>{isGuided ? 'Choose a thread' : 'If another door feels kinder'}</span><span className="page-no">{isGuided ? '06 / 08' : '04 / 08'}</span></div>
          <p className="prompt-label">You could begin with...</p>
          <div className="prompt-list">
            {alternatives.map((alternative) => (
              <button
                className={`prompt-option ${alternative === prompt ? 'active' : ''}`}
                key={alternative}
                onClick={() => onPromptChange(alternative)}
                data-testid={`button-prompt-${alternative.slice(0, 18).replaceAll(' ', '-').toLowerCase()}`}
              >
                {alternative}
              </button>
            ))}
          </div>
          <div className="support-strip">
            <Feather size={17} strokeWidth={1.3} />
            <div><strong>No polished ending required</strong>A fragment, a list, or one honest sentence is enough.</div>
          </div>
        </div>
      </section>
    </div>
  );
}

function KindPage() {
  const [notes, setNotes] = useState<string[]>(() => drawKindWords());
  const refreshNotes = () => setNotes((current) => drawKindWords(current));
  return (
    <div className="spread" data-testid="page-kind-words">
      <section className="sheet">
        <div className="sheet-content" tabIndex={0} role="region" aria-label="Kind words for you">
          <div className="sheet-rubric eyebrow"><span>Tucked in for later</span><span className="page-no">09 / 10</span></div>
          <p className="prompt-label">A few words to keep nearby.</p>
          <div className="notes-stack" aria-live="polite">
            <div className="kind-note"><span className="eyebrow">A note for you</span><p>{notes[0]}</p></div>
            <div className="kind-note"><span className="eyebrow">Another note</span><p>{notes[1]}</p></div>
          </div>
        </div>
      </section>
      <section className="sheet">
        <div className="sheet-content" tabIndex={0} role="region" aria-label="Kind words for a friend">
          <div className="sheet-rubric eyebrow"><span>Leave one here</span><span className="page-no">10 / 10</span></div>
          <p className="prompt-label">What would you say to a dear friend?</p>
          <div className="kind-note" aria-live="polite"><span className="eyebrow">Your note</span><p>{notes[2]}</p></div>
          <div className="kind-actions">
            <button className="quiet-button" onClick={refreshNotes} data-testid="button-kind-refresh"><Sparkles size={14} /> Refresh options</button>
          </div>
        </div>
      </section>
    </div>
  );
}

function ContentsPage({ onChange }: { onChange: (section: Section) => void }) {
  return (
    <div className="spread" data-testid="page-contents">
      <section className="sheet">
        <div className="sheet-content" tabIndex={0} role="region" aria-label="Welcome to your journal">
          <div className="sheet-rubric eyebrow"><span>Wellness Diary</span><span className="page-no">Index</span></div>
          <p className="prompt-label">A place to begin, or begin again.</p>
          <p className="page-subtitle">No account. No saved history. Just a quiet set of pages for this visit.</p>
          <div className="support-strip"><LockKeyhole size={17} strokeWidth={1.3} /><div><strong>Private by design</strong>We don’t save or send your entries. Close this page and this session is gone.</div></div>
        </div>
      </section>
      <section className="sheet">
        <div className="sheet-content" tabIndex={0} role="region" aria-label="Journal contents">
          <div className="sheet-rubric eyebrow"><span>Turn to a page</span><span className="page-no">Contents</span></div>
          <div className="contents-grid">
            {sections.slice(1).map(({ id, label, short }) => (
              <button className="contents-item" key={id} onClick={() => onChange(id)} data-testid={`button-contents-${id}`}>
                <span className="contents-no">{short}</span><strong>{label}</strong>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function SupportModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="support-title" data-testid="dialog-support">
      <div className="modal-card">
        <button className="text-button" onClick={onClose} aria-label="Close support" data-testid="button-close-support"><X size={16} /></button>
        <div className="eyebrow">A clear note about care</div>
        <h2 id="support-title">You deserve more support than a page can give.</h2>
        <p>Wellness Diary is not therapy, a diagnosis, or a monitored crisis service. If you feel in immediate danger or may hurt yourself, contact your local emergency service now.</p>
        <p>If you are in the United States or Canada, call or text <strong>988</strong>. Elsewhere, find a local crisis line through your country’s emergency or health service. If possible, tell someone you trust that you need company.</p>
        <div className="modal-actions">
          <button className="quiet-button" onClick={onClose} data-testid="button-support-back">Back to journal</button>
          <button className="primary-button" onClick={onClose} data-testid="button-find-support">I understand <ArrowRight size={14} /></button>
        </div>
      </div>
    </div>
  );
}

function BurnModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="burn-title" data-testid="dialog-burn">
      <div className="modal-card">
        <div className="eyebrow"><Flame size={13} /> A deliberate release</div>
        <h2 id="burn-title">Burn this page?</h2>
        <p>Let the words go up in a little burst of flame. A fresh page will be waiting when the fire settles.</p>
        <div className="modal-actions">
          <button className="quiet-button" onClick={onCancel} data-testid="button-cancel-burn">Keep writing</button>
          <button className="primary-button" onClick={onConfirm} data-testid="button-confirm-burn">Burn page <Flame size={14} /></button>
        </div>
      </div>
    </div>
  );
}

function Journal({ onHome }: { onHome: () => void }) {
  const bookFrameRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState<Section>('contents');
  const queuedPage = useRef<Section | null>(null);
  const { prepareTurn, isTurning, busy, finishTurn } = useBookTurn(bookFrameRef, active);
  const [infoPage, setInfoPage] = useState<InfoPage | null>(null);
  const [showSupport, setShowSupport] = useState(false);
  const [sessionNoticeOpen, setSessionNoticeOpen] = useState(true);
  const [showBurn, setShowBurn] = useState(false);
  const [burningPage, setBurningPage] = useState<Section | null>(null);
  const burnTimer = useRef<number | null>(null);
  const [content, setContent] = useState('');
  const [prompt, setPrompt] = useState(prompts[0]);
  const [selectedFeelings, setSelectedFeelings] = useState<string[]>([]);
  const [selectedNeeds, setSelectedNeeds] = useState<string[]>([]);
  const [mindfulness, setMindfulness] = useState(createMindfulnessState);
  const [toast, setToast] = useState('');

  const activeLabel = useMemo(() => sections.find((section) => section.id === active)?.label ?? 'Contents', [active]);
  const activeIndex = sections.findIndex((section) => section.id === active);
  const navigateTo = (section: Section, direction?: PageDirection) => {
    if (busy.current) {
      queuedPage.current = section;
      return;
    }
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    if (section === active) {
      bookFrameRef.current?.querySelectorAll('.sheet-content').forEach((page) => page.scrollTo({ top: 0 }));
      return;
    }
    const targetIndex = sections.findIndex((item) => item.id === section);
    const nextDirection = direction ?? (targetIndex > activeIndex ? 'next' : 'previous');
    prepareTurn(nextDirection, Math.abs(targetIndex - activeIndex));
    if (section === 'letout') setPrompt(prompts[0]);
    if (section === 'guided') setPrompt(guidedPrompts[0]);
    setActive(section);
  };
  useEffect(() => {
    if (isTurning || queuedPage.current === null) return;
    const section = queuedPage.current;
    queuedPage.current = null;
    navigateTo(section);
  }, [isTurning]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => () => {
    if (burnTimer.current !== null) window.clearTimeout(burnTimer.current);
  }, []);

  const clearSession = () => {
    queuedPage.current = null;
    finishTurn();
    if (burnTimer.current !== null) window.clearTimeout(burnTimer.current);
    burnTimer.current = null;
    setBurningPage(null);
    setContent('');
    setSelectedFeelings([]);
    setSelectedNeeds([]);
    setMindfulness(createMindfulnessState());
    setPrompt(prompts[0]);
    setToast('This session is clear. Nothing was saved.');
  };
  const confirmBurn = () => {
    if (burnTimer.current !== null) return;
    setShowBurn(false);
    setBurningPage(active);
    burnTimer.current = window.setTimeout(() => {
      setContent('');
      setBurningPage(null);
      burnTimer.current = null;
      setToast('A fresh page, whenever you’re ready.');
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : BURN_DURATION_MS);
  };

  return (
    <main className="journal-shell">
      <Header active={active} onChange={navigateTo} onHome={() => { queuedPage.current = null; finishTurn(); setSessionNoticeOpen(true); onHome(); }} onSupport={() => setShowSupport(true)} />
      <div className="journal-main">
        <div className="page-meta">
          <div>
            <div className="eyebrow">A quiet moment, page by page</div>
            <h2 className="page-title">{activeLabel}</h2>
          </div>
          <div className="page-count">{active === 'contents' ? 'Your open cover' : 'Active memory only'}</div>
        </div>
        <div className="book-stage">
          <button
            className="page-arrow page-arrow-left"
            onClick={() => activeIndex > 0 && navigateTo(sections[activeIndex - 1].id, 'previous')}
            disabled={activeIndex <= 0}
            aria-label="Turn to previous page"
            data-testid="button-previous-page"
          >
            <ArrowLeft size={19} strokeWidth={1.4} />
          </button>
          <div ref={bookFrameRef} className="page-turn-frame">
          {active === 'contents' && <ContentsPage onChange={navigateTo} />}
          {active === 'checkin' && (
            <CheckInPage
              selectedFeelings={selectedFeelings}
              onToggleFeeling={(feeling) => setSelectedFeelings((current) => current.includes(feeling) ? current.filter((item) => item !== feeling) : [...current, feeling])}
              selectedNeeds={selectedNeeds}
              onToggleNeed={(need) => setSelectedNeeds((current) => current.includes(need) ? current.filter((item) => item !== need) : [...current, need])}
            />
          )}
          {(active === 'letout' || active === 'guided') && <WritingPage key={active} mode={active} content={content} prompt={prompt} onContentChange={setContent} onPromptChange={setPrompt} onBurn={() => setShowBurn(true)} burning={burningPage === active} />}
          {active === 'minigames' && <MindfulnessMinigames state={mindfulness} setState={setMindfulness} onSupport={() => setShowSupport(true)} />}
          {active === 'kind' && <KindPage />}
          </div>
          <button
            className="page-arrow page-arrow-right"
            onClick={() => activeIndex < sections.length - 1 && navigateTo(sections[activeIndex + 1].id, 'next')}
            disabled={activeIndex >= sections.length - 1}
            aria-label="Turn to next page"
            data-testid="button-next-page"
          >
            <ArrowRight size={19} strokeWidth={1.4} />
          </button>
        </div>
        <div className="session-bar">
          <p><LockKeyhole size={12} /> Your entries and activity marks live in active memory only. They are never saved, sent, or shared.</p>
          <button className="quiet-button session-clear" onClick={clearSession} data-testid="button-clear-session"><RotateCcw size={13} /> Clear session</button>
        </div>
      </div>
      <footer className="footer-note">
        <p className="creator-credit">Created by <a href="/about/" rel="author">Rungphob Lertvilaivithaya</a></p>
        <p>Wellness Diary is a self-guided reflection tool, not therapy or a monitored crisis service. If you need immediate help, contact local emergency support.</p>
        <LegalLinks onOpen={setInfoPage} />
      </footer>
      {sessionNoticeOpen && (
        <aside className="session-notice" role="dialog" aria-label="Privacy reminder">
          <div className="session-notice-copy">
            <LockKeyhole size={17} strokeWidth={1.4} aria-hidden="true" />
            <div>
              <strong>A private visit</strong>
              <p>Nothing here is tracked, saved, or sent. Your entries stay in this session and disappear when you leave.</p>
            </div>
          </div>
          <button className="quiet-button" onClick={() => setSessionNoticeOpen(false)}>I understand</button>
        </aside>
      )}
      {showSupport && <SupportModal onClose={() => setShowSupport(false)} />}
      {showBurn && <BurnModal onCancel={() => setShowBurn(false)} onConfirm={confirmBurn} />}
      {infoPage && <InfoPageView page={infoPage} onClose={() => setInfoPage(null)} />}
      {toast && <div className="toast-note" role="status" data-testid="status-toast"><Check size={14} /> {toast}</div>}
    </main>
  );
}

function Home() {
  const [opened, setOpened] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [infoPage, setInfoPage] = useState<InfoPage | null>(null);
  const showCover = () => {
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    setOpened(false);
  };
  return (
    <>
      <div hidden={opened}><Cover onOpen={() => setOpened(true)} onSupport={() => setShowSupport(true)} onInfo={setInfoPage} /></div>
      <div hidden={!opened}><Journal onHome={showCover} /></div>
      {showSupport && <SupportModal onClose={() => setShowSupport(false)} />}
      {infoPage && <InfoPageView page={infoPage} onClose={() => setInfoPage(null)} />}
    </>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/about" component={() => <PublicInfoPage page="about" />} />
      <Route path="/about/" component={() => <PublicInfoPage page="about" />} />
      <Route path="/contact" component={() => <PublicInfoPage page="contact" />} />
      <Route path="/contact/" component={() => <PublicInfoPage page="contact" />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <RoutedErrorBoundary><Router /></RoutedErrorBoundary>
    </WouterRouter>
  );
}

export default App;
