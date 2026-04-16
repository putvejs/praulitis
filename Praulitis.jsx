import { useState, useEffect, useRef } from "react";

/* ─── DATA ─── */
const MEMBERS = [
  { initials: "AM", name: "Annija Mārtinsone", role: "Lead vocals · Founder", instrument: "Vocals", grad: "160deg,#2d5c46,#1c3a2e" },
  { initials: "JK", name: "Jānis Kalniņš", role: "Kokle · Harmony vocals", instrument: "Kokle", grad: "160deg,#2d5c46,#1a3a2e" },
  { initials: "LB", name: "Linda Bērziņa", role: "Pīpīte · Percussion", instrument: "Pīpīte", grad: "160deg,#3a5230,#243820" },
  { initials: "EP", name: "Edgars Pētersons", role: "Violin · Composer", instrument: "Violin", grad: "160deg,#1c3a2e,#122818" },
  { initials: "MO", name: "Marta Ozola", role: "Frame drum · Percussion", instrument: "Drums", grad: "160deg,#2e4535,#1e3226" },
  { initials: "RZ", name: "Rihards Zariņš", role: "Accordion · Arrangements", instrument: "Accordion", grad: "160deg,#384a35,#252e22" },
  { initials: "IJ", name: "Ilze Jēkabsone", role: "Double bass · Vocals", instrument: "Bass", grad: "160deg,#405535,#2a3822" },
];

const EVENTS = [
  { day: "12", month: "Apr 2025", title: "Lieldienu Folklore Evening", venue: "Latvian National History Museum, Rīga", badge: { label: "Tomorrow", cls: "soon" } },
  { day: "3",  month: "May 2025", title: "Spring Folklore Festival", venue: "Sigulda Open Air Stage", badge: null },
  { day: "21", month: "Jun 2025", title: "Jāņu Night — Summer Solstice", venue: "Ethnographic Open-Air Museum, Rīga", badge: { label: "Free Entry", cls: "new" } },
  { day: "14", month: "Jul 2025", title: "Nordic Folk Music Summit", venue: "Tallinn Song Festival Grounds, Estonia", badge: null },
  { day: "29", month: "Aug 2025", title: "Autumn Dainas Concert", venue: "Great Guild Hall, Rīga", badge: null },
];

const TRACKS = [
  { id: 1, title: "Saule, Māra, Laima", album: "Meža Dziesmas (2023)", duration: "3:42" },
  { id: 2, title: "Lietusmātes Daina",  album: "Meža Dziesmas (2023)", duration: "4:18" },
  { id: 3, title: "Jāņu Nakts",         album: "Live at Sigulda (2022)", duration: "5:07" },
  { id: 4, title: "Zemes Māte",         album: "Pirmie Soļi (2018)", duration: "3:55" },
];

const VIDEOS = [
  { title: "Jāņu Night Live — Ethnographic Museum", date: "June 21, 2024", dur: "18:32", grad: "135deg,#1c3a2e,#0e2018" },
  { title: "Kokle Solo — Behind the Strings", date: "March 5, 2024", dur: "7:14", grad: "135deg,#1c4030,#132a20" },
  { title: "Recording Session — Meža Dziesmas", date: "Oct 12, 2023", dur: "12:48", grad: "135deg,#1e3a30,#152a22" },
];

const MANAGED_CONTENT = [
  { title: "Saule, Māra, Laima", type: "🎵 Audio", date: "Mar 2023", status: "public" },
  { title: "Backstage — Sigulda 2024", type: "📷 Photo", date: "Jun 2024", status: "private" },
  { title: "Recording Session Oct 2023", type: "🎬 Video", date: "Oct 2023", status: "public" },
  { title: "New Album Artwork Draft", type: "📷 Photo", date: "Jan 2025", status: "draft" },
  { title: "Jāņu Night Live 2024", type: "🎬 Video", date: "Jun 2024", status: "public" },
];

const GALLERY_ITEMS = [
  { span: 6, label: "✦ Concert · Rīga 2024", private: false, grad: "135deg,#1c3a2e,#0e2018" },
  { span: 3, label: "Rehearsal", private: false, grad: "135deg,#1c3a2e,#142a20" },
  { span: 3, label: "Jāņi", private: true, grad: "135deg,#2d5c46,#1c3a2e" },
  { span: 4, label: "Backstage", private: false, grad: "135deg,#233a2a,#1a2e22" },
  { span: 8, label: "✦ Sigulda Open-Air Festival · 2024", private: false, grad: "135deg,#1c3a2e,#28503c" },
  { span: 4, label: "Recording", private: true, grad: "135deg,#2e4a38,#1e3228" },
];

/* ─── STYLES ─── */
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap');

  :root {
    --forest:#1c3a2e; --forest-mid:#2d5c46; --forest-light:#4a8c6c;
    --amber:#c47b1e; --amber-light:#e9a83a; --amber-pale:#f7e8c8;
    --cream:#f5f0e8; --linen:#ede7d9; --charcoal:#1e1e1a;
    --charcoal-mid:#3a3a35; --stone:#8c8878; --stone-light:#b5b0a5;
    --white:#faf8f4; --r:4px; --rlg:10px;
    --shadow:0 4px 24px rgba(28,58,46,.10);
    --shadow-sm:0 2px 8px rgba(28,58,46,.07);
  }
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  html{scroll-behavior:smooth}
  body{font-family:'DM Sans',sans-serif;background:var(--white);color:var(--charcoal);overflow-x:hidden}

  /* NAV */
  .pn-nav{position:fixed;top:0;left:0;right:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:0 4vw;height:68px;background:rgba(245,240,232,.92);backdrop-filter:blur(12px);border-bottom:1px solid rgba(196,123,30,.15);transition:box-shadow .3s}
  .pn-nav.scrolled{box-shadow:var(--shadow-sm)}
  .pn-logo{font-family:'Cormorant Garamond',serif;font-size:26px;font-weight:600;color:var(--forest);text-decoration:none;display:flex;align-items:center;gap:10px}
  .pn-logo em{color:var(--amber);font-style:italic}
  .pn-links{display:flex;align-items:center;gap:28px}
  .pn-links a{font-size:13px;font-weight:400;letter-spacing:.6px;text-transform:uppercase;color:var(--charcoal-mid);text-decoration:none;transition:color .2s}
  .pn-links a:hover{color:var(--forest)}
  .pn-admin-btn{background:var(--forest);color:var(--amber-pale);border:none;border-radius:var(--r);padding:8px 18px;font-size:12px;font-weight:500;letter-spacing:.5px;text-transform:uppercase;cursor:pointer;transition:background .2s}
  .pn-admin-btn:hover{background:var(--forest-mid)}
  .pn-admin-btn.active{background:var(--amber);color:var(--charcoal)}

  /* HERO */
  .pn-hero{min-height:100vh;display:grid;grid-template-columns:1fr 1fr;padding-top:68px;background:var(--forest);position:relative;overflow:hidden}
  .pn-hero-bg{position:absolute;inset:0;opacity:.06;background-image:repeating-linear-gradient(60deg,var(--amber-light) 0,var(--amber-light) 1px,transparent 0,transparent 50%);background-size:32px 32px}
  .pn-hero-text{display:flex;flex-direction:column;justify-content:center;padding:80px 8vw;position:relative;z-index:2}
  .pn-eyebrow{font-size:11px;font-weight:500;letter-spacing:2.5px;text-transform:uppercase;color:var(--amber-light);margin-bottom:20px;display:flex;align-items:center;gap:12px}
  .pn-eyebrow::before{content:'';display:inline-block;width:32px;height:1px;background:var(--amber-light)}
  .pn-hero-title{font-family:'Cormorant Garamond',serif;font-size:clamp(52px,7vw,96px);font-weight:300;line-height:1;color:var(--amber-pale);letter-spacing:-1px;margin-bottom:8px}
  .pn-hero-title em{font-style:italic;color:var(--amber-light)}
  .pn-hero-sub{font-family:'Cormorant Garamond',serif;font-size:clamp(14px,2vw,18px);font-weight:300;font-style:italic;color:rgba(245,232,200,.55);letter-spacing:1px;margin-bottom:40px}
  .pn-hero-desc{font-size:15px;line-height:1.8;color:rgba(245,232,200,.7);max-width:440px;margin-bottom:48px}
  .pn-hero-cta{display:flex;gap:14px;flex-wrap:wrap}
  .pn-btn-primary{background:var(--amber);color:var(--charcoal);border:none;border-radius:var(--r);padding:14px 32px;font-size:13px;font-weight:500;letter-spacing:.5px;text-transform:uppercase;cursor:pointer;text-decoration:none;transition:background .2s;display:inline-block}
  .pn-btn-primary:hover{background:var(--amber-light)}
  .pn-btn-outline{background:transparent;color:var(--amber-pale);border:1px solid rgba(245,232,200,.35);border-radius:var(--r);padding:13px 32px;font-size:13px;font-weight:400;letter-spacing:.5px;text-transform:uppercase;cursor:pointer;text-decoration:none;transition:border-color .2s,color .2s;display:inline-block}
  .pn-btn-outline:hover{border-color:var(--amber-light);color:var(--amber-light)}
  .pn-hero-stats{display:flex;gap:32px;margin-top:48px;padding-top:32px;border-top:1px solid rgba(245,232,200,.1)}
  .pn-stat-num{font-family:'Cormorant Garamond',serif;font-size:36px;font-weight:300;color:var(--amber-light)}
  .pn-stat-lbl{font-size:11px;letter-spacing:1px;text-transform:uppercase;color:rgba(245,232,200,.45)}
  .pn-hero-visual{display:flex;align-items:center;justify-content:center;position:relative;z-index:2}
  .pn-hero-frame{width:75%;max-width:480px;aspect-ratio:3/4;border-radius:var(--rlg);background:var(--forest-mid);position:relative;overflow:hidden;box-shadow:0 32px 80px rgba(0,0,0,.35)}
  .pn-frame-inner{width:100%;height:100%;background:linear-gradient(160deg,var(--forest-mid),var(--forest));display:flex;align-items:center;justify-content:center}
  .pn-folk-ornament{font-family:'Cormorant Garamond',serif;font-size:80px;color:rgba(196,123,30,.3);line-height:1}
  .pn-hero-caption{position:absolute;bottom:24px;left:24px;right:24px;background:rgba(28,58,46,.8);backdrop-filter:blur(8px);border-radius:var(--r);padding:14px 18px;border-left:3px solid var(--amber)}
  .pn-hero-caption p{font-size:13px;color:var(--amber-pale);font-style:italic}
  .pn-hero-caption span{font-size:11px;color:var(--stone-light);display:block;margin-top:2px}
  .pn-scroll-hint{position:absolute;bottom:32px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:8px;color:rgba(245,232,200,.3);font-size:11px;letter-spacing:1.5px;text-transform:uppercase;z-index:2}
  .pn-scroll-hint::after{content:'';width:1px;height:40px;background:rgba(245,232,200,.2);animation:scrollPulse 2s infinite}
  @keyframes scrollPulse{0%,100%{opacity:.3}50%{opacity:.8}}

  /* SECTIONS */
  .pn-section{padding:96px 4vw}
  .pn-section-header{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:56px;border-bottom:1px solid var(--linen);padding-bottom:24px}
  .pn-section-label{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--amber);font-weight:500;margin-bottom:8px}
  .pn-section-title{font-family:'Cormorant Garamond',serif;font-size:clamp(36px,4vw,56px);font-weight:300;color:var(--forest);line-height:1.1}
  .pn-section-title em{font-style:italic;color:var(--amber)}
  .pn-section-count{font-family:'Cormorant Garamond',serif;font-size:72px;font-weight:300;color:var(--linen);line-height:1;user-select:none}

  /* MEMBERS */
  .pn-members-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:24px}
  .pn-member-card{border-radius:var(--rlg);overflow:hidden;background:var(--cream);border:1px solid rgba(196,123,30,.1);transition:transform .3s,box-shadow .3s;cursor:pointer}
  .pn-member-card:hover{transform:translateY(-4px);box-shadow:var(--shadow)}
  .pn-member-photo{aspect-ratio:3/4;position:relative;overflow:hidden}
  .pn-member-photo-inner{width:100%;height:100%;display:flex;align-items:center;justify-content:center}
  .pn-member-initials{font-family:'Cormorant Garamond',serif;font-size:48px;font-weight:300;color:rgba(245,232,200,.4)}
  .pn-instrument-badge{position:absolute;top:14px;left:14px;background:var(--amber);color:var(--charcoal);font-size:10px;font-weight:500;letter-spacing:.5px;text-transform:uppercase;padding:4px 10px;border-radius:20px}
  .pn-member-info{padding:20px 22px 22px}
  .pn-member-name{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:500;color:var(--forest);margin-bottom:4px}
  .pn-member-role{font-size:12px;color:var(--stone);letter-spacing:.3px}

  /* EVENTS */
  .pn-events-section{background:var(--forest)}
  .pn-events-section .pn-section-title{color:var(--amber-pale)}
  .pn-events-section .pn-section-label{color:var(--amber-light)}
  .pn-events-section .pn-section-header{border-bottom-color:rgba(245,232,200,.1)}
  .pn-events-section .pn-section-count{color:rgba(245,232,200,.07)}
  .pn-event-row{display:grid;grid-template-columns:100px 1fr auto;align-items:center;gap:32px;padding:24px 32px;background:rgba(245,232,200,.03);border-radius:var(--r);border:1px solid rgba(245,232,200,.06);margin-bottom:1px;transition:background .2s;cursor:pointer}
  .pn-event-row:hover{background:rgba(245,232,200,.07)}
  .pn-event-date{text-align:center}
  .pn-event-day{font-family:'Cormorant Garamond',serif;font-size:40px;font-weight:300;line-height:1;color:var(--amber-light)}
  .pn-event-month{font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:rgba(245,232,200,.4)}
  .pn-event-title{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:400;color:var(--amber-pale);margin-bottom:6px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
  .pn-event-venue{font-size:12px;color:rgba(245,232,200,.5);display:flex;align-items:center;gap:6px}
  .pn-event-venue::before{content:'◦';font-size:8px;color:var(--amber)}
  .pn-event-ticket-btn{background:transparent;color:var(--amber-light);border:1px solid rgba(233,168,58,.3);border-radius:var(--r);padding:10px 20px;font-size:11px;font-weight:500;letter-spacing:.6px;text-transform:uppercase;cursor:pointer;white-space:nowrap;transition:background .2s,border-color .2s}
  .pn-event-ticket-btn:hover{background:rgba(233,168,58,.1);border-color:var(--amber-light)}
  .pn-badge{font-size:9px;letter-spacing:1px;text-transform:uppercase;font-weight:500;padding:3px 8px;border-radius:20px;white-space:nowrap}
  .pn-badge-soon{background:rgba(233,168,58,.15);color:var(--amber-light)}
  .pn-badge-new{background:rgba(74,140,108,.2);color:#6dcfa7}

  /* GALLERY */
  .pn-gallery-section{background:var(--linen)}
  .pn-gallery-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:12px}
  .pn-gallery-item{border-radius:var(--rlg);overflow:hidden;position:relative;cursor:pointer;transition:opacity .2s}
  .pn-gallery-item:hover{opacity:.88}
  .pn-gallery-item:hover .pn-gallery-overlay{opacity:1}
  .pn-span-6{grid-column:span 6;aspect-ratio:4/3}
  .pn-span-4{grid-column:span 4;aspect-ratio:4/3}
  .pn-span-3{grid-column:span 3;aspect-ratio:3/4}
  .pn-span-8{grid-column:span 8;aspect-ratio:16/9}
  .pn-gallery-inner{width:100%;height:100%;min-height:180px;display:flex;align-items:center;justify-content:center;font-family:'Cormorant Garamond',serif;color:rgba(245,232,200,.25);font-size:18px;padding:16px;text-align:center}
  .pn-gallery-overlay{position:absolute;inset:0;background:rgba(28,58,46,.7);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .2s}
  .pn-gallery-overlay span{font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:var(--amber-pale);font-weight:500}
  .pn-private-badge{position:absolute;top:10px;right:10px;background:rgba(0,0,0,.55);color:rgba(245,232,200,.8);font-size:9px;font-weight:500;letter-spacing:.5px;text-transform:uppercase;padding:3px 8px;border-radius:20px;backdrop-filter:blur(4px)}

  /* AUDIO */
  .pn-audio-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px}
  .pn-audio-card{background:var(--cream);border-radius:var(--rlg);border:1px solid rgba(196,123,30,.12);padding:20px 24px;display:flex;flex-direction:column;gap:14px;cursor:pointer}
  .pn-audio-header{display:flex;align-items:center;gap:14px}
  .pn-audio-thumb{width:52px;height:52px;border-radius:var(--r);background:linear-gradient(135deg,var(--forest-mid),var(--forest));flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:22px;color:rgba(196,123,30,.7)}
  .pn-audio-title{font-family:'Cormorant Garamond',serif;font-size:18px;font-weight:500;color:var(--forest);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .pn-audio-album{font-size:12px;color:var(--stone);margin-top:2px}
  .pn-audio-player{display:flex;align-items:center;gap:12px}
  .pn-play-btn{width:36px;height:36px;border-radius:50%;background:var(--forest);color:var(--amber-pale);border:none;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:background .2s}
  .pn-play-btn:hover{background:var(--forest-mid)}
  .pn-waveform{flex:1;height:32px;display:flex;align-items:center;gap:2px}
  .pn-wv-bar{flex:1;border-radius:2px;background:var(--stone-light);transition:background .1s}
  .pn-wv-bar.played{background:var(--amber)}
  .pn-audio-dur{font-size:11px;color:var(--stone);flex-shrink:0;font-variant-numeric:tabular-nums}

  /* VIDEO */
  .pn-video-section{background:var(--linen)}
  .pn-video-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px}
  .pn-video-card{border-radius:var(--rlg);overflow:hidden;background:var(--white);border:1px solid rgba(196,123,30,.1);transition:transform .3s,box-shadow .3s;cursor:pointer}
  .pn-video-card:hover{transform:translateY(-3px);box-shadow:var(--shadow)}
  .pn-video-thumb{aspect-ratio:16/9;position:relative;overflow:hidden}
  .pn-video-thumb-inner{width:100%;height:100%;display:flex;align-items:center;justify-content:center}
  .pn-video-play{width:56px;height:56px;border-radius:50%;background:rgba(196,123,30,.9);display:flex;align-items:center;justify-content:center;transition:transform .2s}
  .pn-video-card:hover .pn-video-play{transform:scale(1.1)}
  .pn-video-info{padding:16px 18px}
  .pn-video-title{font-family:'Cormorant Garamond',serif;font-size:18px;font-weight:500;color:var(--forest);margin-bottom:6px}
  .pn-video-meta{display:flex;align-items:center;justify-content:space-between}
  .pn-video-date{font-size:11px;color:var(--stone)}
  .pn-video-dur-badge{font-size:10px;font-weight:500;background:var(--forest);color:var(--amber-pale);padding:2px 8px;border-radius:20px}

  /* ADMIN */
  .pn-admin-backdrop{position:fixed;top:68px;left:0;right:0;bottom:0;z-index:90;background:rgba(28,58,46,.55);backdrop-filter:blur(4px);padding:24px;overflow-y:auto;display:flex;flex-direction:column;align-items:center;gap:20px}
  .pn-admin-modal{background:var(--white);border-radius:16px;width:100%;max-width:900px;border:1px solid var(--linen);overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.25)}
  .pn-admin-header{background:var(--forest);padding:20px 28px;display:flex;align-items:center;justify-content:space-between}
  .pn-admin-title{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:400;color:var(--amber-pale)}
  .pn-admin-tabs{display:flex;gap:4px}
  .pn-admin-tab{background:rgba(245,232,200,.08);color:rgba(245,232,200,.6);border:none;border-radius:var(--r);padding:7px 14px;font-size:11px;font-weight:500;letter-spacing:.5px;text-transform:uppercase;cursor:pointer;transition:all .2s}
  .pn-admin-tab.active,.pn-admin-tab:hover{background:var(--amber);color:var(--charcoal)}
  .pn-admin-body{padding:28px}
  .pn-upload-zone{border:2px dashed rgba(196,123,30,.25);border-radius:var(--rlg);padding:40px;text-align:center;background:rgba(196,123,30,.03);cursor:pointer;transition:border-color .2s,background .2s;margin-bottom:24px}
  .pn-upload-zone:hover{border-color:var(--amber);background:rgba(196,123,30,.06)}
  .pn-upload-icon{font-size:32px;margin-bottom:12px;color:var(--amber)}
  .pn-upload-text{font-size:15px;color:var(--charcoal-mid)}
  .pn-upload-sub{font-size:12px;color:var(--stone);margin-top:4px}
  .pn-form{display:flex;flex-direction:column;gap:16px}
  .pn-form-row{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .pn-form-group{display:flex;flex-direction:column;gap:6px}
  .pn-form-group label{font-size:11px;font-weight:500;letter-spacing:.5px;text-transform:uppercase;color:var(--stone)}
  .pn-form-group input,.pn-form-group select,.pn-form-group textarea{background:var(--cream);border:1px solid rgba(196,123,30,.18);border-radius:var(--r);padding:10px 14px;font-size:14px;color:var(--charcoal);font-family:'DM Sans',sans-serif;transition:border-color .2s;outline:none}
  .pn-form-group input:focus,.pn-form-group select:focus,.pn-form-group textarea:focus{border-color:var(--amber)}
  .pn-form-group textarea{resize:vertical;min-height:80px}
  .pn-vis-toggle{display:flex;border:1px solid rgba(196,123,30,.2);border-radius:var(--r);overflow:hidden}
  .pn-vis-opt{flex:1;padding:9px 14px;background:var(--cream);border:none;cursor:pointer;font-size:12px;font-weight:500;color:var(--stone);transition:all .15s}
  .pn-vis-opt.selected{background:var(--forest);color:var(--amber-pale)}
  .pn-save-btn{background:var(--amber);color:var(--charcoal);border:none;border-radius:var(--r);padding:12px 28px;font-size:13px;font-weight:500;letter-spacing:.4px;cursor:pointer;transition:background .2s;align-self:flex-end;margin-top:8px}
  .pn-save-btn:hover{background:var(--amber-light)}
  .pn-table{width:100%;border-collapse:collapse}
  .pn-table th{font-size:10px;font-weight:500;letter-spacing:1px;text-transform:uppercase;color:var(--stone);text-align:left;padding:10px 14px;border-bottom:1px solid var(--linen)}
  .pn-table td{padding:14px;border-bottom:1px solid var(--linen);font-size:13px;color:var(--charcoal-mid);vertical-align:middle}
  .pn-table tr:last-child td{border-bottom:none}
  .pn-status-dot{width:7px;height:7px;border-radius:50%;display:inline-block;margin-right:6px}
  .pn-dot-public{background:#4a8c6c}
  .pn-dot-private{background:var(--stone-light)}
  .pn-dot-draft{background:rgba(196,123,30,.4)}
  .pn-tbl-btn{background:none;border:1px solid var(--linen);border-radius:var(--r);padding:4px 10px;font-size:11px;color:var(--stone);cursor:pointer;margin-right:6px;transition:all .15s}
  .pn-tbl-btn:hover{border-color:var(--amber);color:var(--amber)}
  .pn-tbl-btn.danger:hover{border-color:#c0392b;color:#c0392b}

  /* FOOTER */
  .pn-footer{background:var(--charcoal);padding:64px 4vw 40px}
  .pn-footer-divider{text-align:center;font-family:'Cormorant Garamond',serif;font-size:24px;color:rgba(196,123,30,.2);letter-spacing:8px;margin-bottom:24px}
  .pn-footer-inner{display:grid;grid-template-columns:2fr 1fr 1fr;gap:48px;margin-bottom:48px}
  .pn-footer-logo{font-family:'Cormorant Garamond',serif;font-size:32px;font-weight:300;color:var(--amber-pale);margin-bottom:12px}
  .pn-footer-logo em{font-style:italic;color:var(--amber-light)}
  .pn-footer-tagline{font-size:13px;color:var(--stone);line-height:1.7;max-width:280px}
  .pn-footer-social{display:flex;gap:10px;margin-top:20px}
  .pn-social-btn{width:36px;height:36px;border-radius:var(--r);background:rgba(245,232,200,.06);border:1px solid rgba(245,232,200,.1);display:flex;align-items:center;justify-content:center;color:rgba(245,232,200,.4);font-size:13px;cursor:pointer;transition:all .2s;text-decoration:none}
  .pn-social-btn:hover{background:rgba(196,123,30,.15);color:var(--amber-light);border-color:rgba(196,123,30,.3)}
  .pn-footer-col h4{font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:var(--amber);font-weight:500;margin-bottom:16px}
  .pn-footer-col a{display:block;font-size:13px;color:var(--stone);text-decoration:none;margin-bottom:8px;transition:color .15s}
  .pn-footer-col a:hover{color:var(--amber-pale)}
  .pn-footer-bottom{display:flex;align-items:center;justify-content:space-between;padding-top:24px;border-top:1px solid rgba(245,232,200,.07);font-size:11px;color:rgba(140,136,120,.6)}

  /* TOAST */
  .pn-toast{position:fixed;bottom:32px;right:32px;z-index:200;background:var(--forest);color:var(--amber-pale);border-radius:var(--rlg);padding:14px 22px;font-size:14px;box-shadow:var(--shadow);display:flex;align-items:center;gap:10px;transform:translateY(80px);opacity:0;transition:transform .35s ease,opacity .35s ease;pointer-events:none}
  .pn-toast.show{transform:translateY(0);opacity:1}
  .pn-toast-dot{width:8px;height:8px;border-radius:50%;background:var(--amber-light);flex-shrink:0}

  /* FADE IN */
  .pn-fade{opacity:0;transform:translateY(20px);transition:opacity .6s ease,transform .6s ease}
  .pn-fade.visible{opacity:1;transform:translateY(0)}

  @media(max-width:768px){
    .pn-hero{grid-template-columns:1fr}
    .pn-hero-visual{display:none}
    .pn-footer-inner{grid-template-columns:1fr;gap:32px}
    .pn-event-row{grid-template-columns:70px 1fr}
    .pn-event-ticket-btn{display:none}
    .pn-span-8,.pn-span-6{grid-column:span 12}
    .pn-span-4,.pn-span-3{grid-column:span 6}
    .pn-form-row{grid-template-columns:1fr}
    .pn-links{display:none}
  }
`;

/* ─── SUB-COMPONENTS ─── */

function Waveform({ id, progress }) {
  const bars = Array.from({ length: 40 }, (_, i) => ({
    height: 20 + ((Math.sin(i * 0.7) + Math.cos(i * 0.4)) * 30 + 50),
    played: i < Math.floor(progress / 100 * 40),
  }));
  return (
    <div className="pn-waveform">
      {bars.map((b, i) => (
        <div key={i} className={`pn-wv-bar${b.played ? " played" : ""}`} style={{ height: `${b.height}%` }} />
      ))}
    </div>
  );
}

function PlayIcon() {
  return <svg viewBox="0 0 16 16" style={{ fill: "currentColor", width: 14, height: 14, marginLeft: 2 }}><path d="M3 2l11 6-11 6z" /></svg>;
}
function PauseIcon() {
  return <svg viewBox="0 0 16 16" style={{ fill: "currentColor", width: 12, height: 12 }}><rect x="2" y="2" width="4" height="12" /><rect x="10" y="2" width="4" height="12" /></svg>;
}
function VideoPlayIcon() {
  return <svg viewBox="0 0 16 16" style={{ fill: "white", width: 20, height: 20, marginLeft: 3 }}><path d="M3 2l11 6-11 6z" /></svg>;
}

function AudioCard({ track, isPlaying, progress, onToggle }) {
  return (
    <div className="pn-audio-card" onClick={onToggle}>
      <div className="pn-audio-header">
        <div className="pn-audio-thumb">♪</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="pn-audio-title">{track.title}</div>
          <div className="pn-audio-album">Praulitis · {track.album}</div>
        </div>
      </div>
      <div className="pn-audio-player">
        <button className="pn-play-btn" aria-label={isPlaying ? "Pause" : "Play"} onClick={e => { e.stopPropagation(); onToggle(); }}>
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>
        <Waveform id={track.id} progress={progress} />
        <span className="pn-audio-dur">{track.duration}</span>
      </div>
    </div>
  );
}

function VisToggle({ value, onChange }) {
  const opts = ["🌐 Public", "🔒 Members Only", "👁 Draft"];
  return (
    <div className="pn-vis-toggle">
      {opts.map(opt => (
        <button key={opt} className={`pn-vis-opt${value === opt ? " selected" : ""}`} onClick={() => onChange(opt)}>{opt}</button>
      ))}
    </div>
  );
}

/* ─── ADMIN TABS ─── */
function UploadTab({ onToast }) {
  const [vis, setVis] = useState("🌐 Public");
  return (
    <div>
      <div className="pn-upload-zone" onClick={() => onToast("File browser would open here")}>
        <div className="pn-upload-icon">↑</div>
        <div className="pn-upload-text">Drag &amp; drop files here, or click to browse</div>
        <div className="pn-upload-sub">Images (JPG, PNG) · Audio (MP3, WAV, FLAC) · Video (MP4, MOV) · Max 500 MB</div>
      </div>
      <div className="pn-form">
        <div className="pn-form-row">
          <div className="pn-form-group"><label>Title</label><input type="text" placeholder="e.g. Summer Concert 2025" /></div>
          <div className="pn-form-group"><label>Content Type</label><select><option>Photo</option><option>Audio Track</option><option>Video</option></select></div>
        </div>
        <div className="pn-form-group"><label>Description</label><textarea placeholder="Optional description or caption..." /></div>
        <div className="pn-form-row">
          <div className="pn-form-group"><label>Date</label><input type="date" /></div>
          <div className="pn-form-group"><label>Tags</label><input type="text" placeholder="concert, 2025, sigulda" /></div>
        </div>
        <div className="pn-form-group"><label>Visibility</label><VisToggle value={vis} onChange={setVis} /></div>
        <button className="pn-save-btn" onClick={() => onToast("Content uploaded and saved!")}>Save &amp; Publish</button>
      </div>
    </div>
  );
}

function EventsTab({ onToast }) {
  const [vis, setVis] = useState("🌐 Public");
  return (
    <div className="pn-form">
      <div className="pn-form-row">
        <div className="pn-form-group"><label>Event Title</label><input type="text" placeholder="e.g. Jāņu Night Concert" /></div>
        <div className="pn-form-group"><label>Event Type</label><select><option>Concert</option><option>Festival</option><option>Workshop</option><option>Rehearsal</option></select></div>
      </div>
      <div className="pn-form-row">
        <div className="pn-form-group"><label>Date &amp; Time</label><input type="datetime-local" /></div>
        <div className="pn-form-group"><label>Venue</label><input type="text" placeholder="e.g. Great Guild Hall, Rīga" /></div>
      </div>
      <div className="pn-form-group"><label>Description</label><textarea placeholder="Event details, lineup, special notes..." /></div>
      <div className="pn-form-row">
        <div className="pn-form-group"><label>Ticket Link (optional)</label><input type="url" placeholder="https://biļetes.lv/..." /></div>
        <div className="pn-form-group"><label>Ticket Price</label><input type="text" placeholder="e.g. €12 / Free" /></div>
      </div>
      <div className="pn-form-group"><label>Visibility</label><VisToggle value={vis} onChange={setVis} /></div>
      <button className="pn-save-btn" onClick={() => onToast("Event published!")}>Add Event</button>
    </div>
  );
}

function ManageTab({ onToast }) {
  const [rows, setRows] = useState(MANAGED_CONTENT.map(r => ({ ...r })));
  const toggle = (i) => {
    setRows(prev => prev.map((r, idx) => {
      if (idx !== i) return r;
      const next = r.status === "public" ? "draft" : "public";
      onToast(next === "public" ? "Published!" : "Moved to draft");
      return { ...r, status: next };
    }));
  };
  return (
    <table className="pn-table">
      <thead><tr><th>Title</th><th>Type</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            <td><strong>{row.title}</strong></td>
            <td>{row.type}</td>
            <td>{row.date}</td>
            <td>
              <span className={`pn-status-dot pn-dot-${row.status === "private" ? "private" : row.status === "draft" ? "draft" : "public"}`} />
              {row.status === "private" ? "Members only" : row.status === "draft" ? "Draft" : "Public"}
            </td>
            <td>
              <button className="pn-tbl-btn" onClick={() => onToast("Editing " + row.title)}>Edit</button>
              <button className={`pn-tbl-btn${row.status === "public" ? " danger" : ""}`} onClick={() => toggle(i)}>
                {row.status === "public" ? "Unpublish" : "Publish"}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ─── MAIN COMPONENT ─── */
export default function Praulitis() {
  const [scrolled, setScrolled] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminTab, setAdminTab] = useState("upload");
  const [toast, setToast] = useState({ show: false, msg: "" });
  const [playing, setPlaying] = useState(null);
  const [progress, setProgress] = useState({});
  const intervalRef = useRef(null);

  // inject styles once
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // nav scroll shadow
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // intersection fade-in
  useEffect(() => {
    const els = document.querySelectorAll(".pn-fade");
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e, i) => {
        if (e.isIntersecting) setTimeout(() => e.target.classList.add("visible"), i * 60);
      });
    }, { threshold: 0.1 });
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  // audio playback sim
  const handlePlay = (trackId) => {
    if (playing === trackId) {
      clearInterval(intervalRef.current);
      setPlaying(null);
      return;
    }
    clearInterval(intervalRef.current);
    setPlaying(trackId);
    setProgress(p => ({ ...p, [trackId]: 0 }));
    intervalRef.current = setInterval(() => {
      setProgress(p => {
        const cur = (p[trackId] || 0) + 1;
        if (cur >= 100) { clearInterval(intervalRef.current); setPlaying(null); return { ...p, [trackId]: 0 }; }
        return { ...p, [trackId]: cur };
      });
    }, 80);
  };
  useEffect(() => () => clearInterval(intervalRef.current), []);

  const showToast = (msg) => {
    setToast({ show: true, msg });
    setTimeout(() => setToast(t => ({ ...t, show: false })), 3000);
  };

  const toggleAdmin = () => {
    setAdminOpen(o => !o);
    document.body.style.overflow = adminOpen ? "" : "hidden";
  };

  const spanClass = (n) => `pn-span-${n}`;

  return (
    <>
      {/* NAV */}
      <nav className={`pn-nav${scrolled ? " scrolled" : ""}`}>
        <a className="pn-logo" href="#home"><em>✦</em> Praulitis</a>
        <div className="pn-links">
          {["members", "events", "gallery", "music", "videos"].map(s => (
            <a key={s} href={`#${s}`}>{s.charAt(0).toUpperCase() + s.slice(1)}</a>
          ))}
          <button className={`pn-admin-btn${adminOpen ? " active" : ""}`} onClick={toggleAdmin}>
            {adminOpen ? "Close Panel" : "Member Login"}
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="pn-hero" id="home">
        <div className="pn-hero-bg" />
        <div className="pn-hero-text pn-fade visible">
          <div className="pn-eyebrow">Latvian Folklore Ensemble</div>
          <h1 className="pn-hero-title">Praulitis<br /><em>Folklore</em></h1>
          <p className="pn-hero-sub">Dainas · Kokles · Tradition</p>
          <p className="pn-hero-desc">We carry the ancient songs of Latvia — weaving folk melodies, traditional instruments, and the living spirit of our ancestors into music for today.</p>
          <div className="pn-hero-cta">
            <a href="#events" className="pn-btn-primary">Upcoming Events</a>
            <a href="#music" className="pn-btn-outline">Listen Now</a>
          </div>
          <div className="pn-hero-stats">
            {[["7", "Members"], ["14", "Years"], ["200+", "Concerts"]].map(([n, l]) => (
              <div key={l}><div className="pn-stat-num">{n}</div><div className="pn-stat-lbl">{l}</div></div>
            ))}
          </div>
        </div>
        <div className="pn-hero-visual">
          <div className="pn-hero-frame">
            <div className="pn-frame-inner"><div className="pn-folk-ornament">✦</div></div>
            <div className="pn-hero-caption">
              <p>"Singing the songs our grandmothers sang"</p>
              <span>Rīga, Latvia · Summer Solstice Festival 2024</span>
            </div>
          </div>
        </div>
        <div className="pn-scroll-hint">Scroll</div>
      </section>

      {/* MEMBERS */}
      <section className="pn-section" id="members" style={{ background: "var(--white)" }}>
        <div className="pn-section-header">
          <div><div className="pn-section-label">The Ensemble</div><h2 className="pn-section-title">Band <em>Members</em></h2></div>
          <div className="pn-section-count">07</div>
        </div>
        <div className="pn-members-grid">
          {MEMBERS.map((m) => (
            <div key={m.initials} className="pn-member-card pn-fade">
              <div className="pn-member-photo">
                <div className="pn-member-photo-inner" style={{ background: `linear-gradient(${m.grad})` }}>
                  <span className="pn-member-initials">{m.initials}</span>
                </div>
                <div className="pn-instrument-badge">{m.instrument}</div>
              </div>
              <div className="pn-member-info">
                <div className="pn-member-name">{m.name}</div>
                <div className="pn-member-role">{m.role}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* EVENTS */}
      <section className="pn-section pn-events-section" id="events">
        <div className="pn-section-header">
          <div><div className="pn-section-label">Concerts &amp; Festivals</div><h2 className="pn-section-title">Upcoming <em>Events</em></h2></div>
          <div className="pn-section-count">05</div>
        </div>
        {EVENTS.map((ev) => (
          <div key={ev.day + ev.month} className="pn-event-row pn-fade">
            <div className="pn-event-date">
              <div className="pn-event-day">{ev.day}</div>
              <div className="pn-event-month">{ev.month}</div>
            </div>
            <div>
              <div className="pn-event-title">
                {ev.title}
                {ev.badge && <span className={`pn-badge pn-badge-${ev.badge.cls}`}>{ev.badge.label}</span>}
              </div>
              <div className="pn-event-venue">{ev.venue}</div>
            </div>
            <button className="pn-event-ticket-btn" onClick={() => showToast("Redirecting to tickets…")}>Get Tickets →</button>
          </div>
        ))}
      </section>

      {/* GALLERY */}
      <section className="pn-section pn-gallery-section" id="gallery">
        <div className="pn-section-header">
          <div><div className="pn-section-label">Photography</div><h2 className="pn-section-title">Photo <em>Gallery</em></h2></div>
          <div className="pn-section-count">24</div>
        </div>
        <div className="pn-gallery-grid">
          {GALLERY_ITEMS.map((g, i) => (
            <div key={i} className={`pn-gallery-item ${spanClass(g.span)} pn-fade`}>
              <div className="pn-gallery-inner" style={{ background: `linear-gradient(${g.grad})` }}>{g.label}</div>
              <div className="pn-gallery-overlay"><span>View Photo</span></div>
              {g.private && <div className="pn-private-badge">Members only</div>}
            </div>
          ))}
        </div>
      </section>

      {/* AUDIO */}
      <section className="pn-section" id="music" style={{ background: "var(--white)" }}>
        <div className="pn-section-header">
          <div><div className="pn-section-label">Discography</div><h2 className="pn-section-title">Listen to <em>our Music</em></h2></div>
          <div className="pn-section-count">12</div>
        </div>
        <div className="pn-audio-grid">
          {TRACKS.map((t) => (
            <AudioCard
              key={t.id}
              track={t}
              isPlaying={playing === t.id}
              progress={progress[t.id] || 0}
              onToggle={() => handlePlay(t.id)}
            />
          ))}
        </div>
      </section>

      {/* VIDEO */}
      <section className="pn-section pn-video-section" id="videos">
        <div className="pn-section-header">
          <div><div className="pn-section-label">Recordings</div><h2 className="pn-section-title">Watch our <em>Videos</em></h2></div>
          <div className="pn-section-count">08</div>
        </div>
        <div className="pn-video-grid">
          {VIDEOS.map((v) => (
            <div key={v.title} className="pn-video-card pn-fade" onClick={() => showToast("Opening: " + v.title)}>
              <div className="pn-video-thumb">
                <div className="pn-video-thumb-inner" style={{ background: `linear-gradient(${v.grad})` }}>
                  <div className="pn-video-play"><VideoPlayIcon /></div>
                </div>
              </div>
              <div className="pn-video-info">
                <div className="pn-video-title">{v.title}</div>
                <div className="pn-video-meta">
                  <span className="pn-video-date">{v.date}</span>
                  <span className="pn-video-dur-badge">{v.dur}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="pn-footer">
        <div className="pn-footer-divider">✦ ᛏ ✦ ᛏ ✦</div>
        <div className="pn-footer-inner">
          <div>
            <div className="pn-footer-logo"><em>Praulitis</em> Folklore</div>
            <p className="pn-footer-tagline">Carrying the ancient songs of Latvia forward. Rooted in tradition, alive in the present.</p>
            <div className="pn-footer-social">
              {["f", "◎", "▷", "♪"].map((icon, i) => <a key={i} className="pn-social-btn">{icon}</a>)}
            </div>
          </div>
          <div className="pn-footer-col">
            <h4>Navigate</h4>
            {["members", "events", "gallery", "music", "videos"].map(s => (
              <a key={s} href={`#${s}`}>{s.charAt(0).toUpperCase() + s.slice(1)}</a>
            ))}
          </div>
          <div className="pn-footer-col">
            <h4>Contact</h4>
            <a href="#">praulitis@folk.lv</a>
            <a href="#">Booking &amp; Press</a>
            <a href="#">Rīga, Latvia</a>
          </div>
        </div>
        <div className="pn-footer-bottom">
          <span>© 2025 Praulitis Folklore Ensemble</span>
          <span>Made with ♥ in Rīga</span>
        </div>
      </footer>

      {/* ADMIN PANEL */}
      {adminOpen && (
        <div className="pn-admin-backdrop" onClick={e => e.target === e.currentTarget && toggleAdmin()}>
          <div className="pn-admin-modal">
            <div className="pn-admin-header">
              <div className="pn-admin-title">Content Manager</div>
              <div className="pn-admin-tabs">
                {["upload", "events", "manage"].map(tab => (
                  <button key={tab} className={`pn-admin-tab${adminTab === tab ? " active" : ""}`} onClick={() => setAdminTab(tab)}>
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="pn-admin-body">
              {adminTab === "upload"  && <UploadTab onToast={showToast} />}
              {adminTab === "events"  && <EventsTab onToast={showToast} />}
              {adminTab === "manage"  && <ManageTab onToast={showToast} />}
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      <div className={`pn-toast${toast.show ? " show" : ""}`}>
        <div className="pn-toast-dot" />
        <span>{toast.msg}</span>
      </div>
    </>
  );
}
