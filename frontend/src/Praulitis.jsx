import React, { useState, useEffect, useRef } from "react";
import Hls from "hls.js";

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
  .pn-login-btn{background:var(--forest);color:var(--amber-pale);border:none;border-radius:var(--r);padding:8px 18px;font-size:12px;font-weight:500;letter-spacing:.5px;text-transform:uppercase;cursor:pointer;text-decoration:none;transition:background .2s;display:inline-block}
  .pn-login-btn:hover{background:var(--forest-mid)}

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
  .pn-frame-inner img{width:100%;height:100%;object-fit:cover;display:block}
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

  /* EMPTY STATE */
  .pn-empty{text-align:center;padding:60px 0;color:var(--stone);font-size:14px}

  /* MEMBERS */
  .pn-members-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:24px}
  .pn-member-card{border-radius:var(--rlg);overflow:hidden;background:var(--cream);border:1px solid rgba(196,123,30,.1);transition:transform .3s,box-shadow .3s;cursor:pointer}
  .pn-member-card:hover{transform:translateY(-4px);box-shadow:var(--shadow)}
  .pn-member-photo{aspect-ratio:3/4;position:relative;overflow:hidden}
  .pn-member-photo-inner{width:100%;height:100%;display:flex;align-items:center;justify-content:center}
  .pn-member-photo-inner img{width:100%;height:100%;object-fit:cover}
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
  .pn-event-row{display:grid;grid-template-columns:100px 1fr auto;align-items:center;gap:32px;padding:24px 32px;background:rgba(245,232,200,.03);border-radius:var(--r);border:1px solid rgba(245,232,200,.06);margin-bottom:1px;transition:background .2s;text-decoration:none}
  .pn-event-row:hover{background:rgba(245,232,200,.07)}
  .pn-event-date{text-align:center}
  .pn-event-day{font-family:'Cormorant Garamond',serif;font-size:40px;font-weight:300;line-height:1;color:var(--amber-light)}
  .pn-event-month{font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:rgba(245,232,200,.4)}
  .pn-event-title{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:400;color:var(--amber-pale);margin-bottom:6px}
  .pn-event-venue{font-size:12px;color:rgba(245,232,200,.5);display:flex;align-items:center;gap:6px}
  .pn-event-venue::before{content:'◦';font-size:8px;color:var(--amber)}
  .pn-event-ticket-btn{background:transparent;color:var(--amber-light);border:1px solid rgba(233,168,58,.3);border-radius:var(--r);padding:10px 20px;font-size:11px;font-weight:500;letter-spacing:.6px;text-transform:uppercase;cursor:pointer;white-space:nowrap;transition:background .2s,border-color .2s}
  .pn-event-ticket-btn:hover{background:rgba(233,168,58,.1);border-color:var(--amber-light)}

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
  .pn-gallery-inner img{width:100%;height:100%;object-fit:cover;position:absolute;inset:0}
  .pn-gallery-overlay{position:absolute;inset:0;background:rgba(28,58,46,.7);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .2s}
  .pn-gallery-overlay span{font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:var(--amber-pale);font-weight:500}
  .pn-lightbox{position:fixed;inset:0;z-index:9999;background:rgba(10,22,16,.92);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;cursor:zoom-out}
  .pn-lightbox img{max-width:100%;max-height:80vh;border-radius:var(--rlg);box-shadow:0 8px 48px rgba(0,0,0,.6);cursor:default}
  .pn-lightbox-caption{margin-top:14px;color:var(--amber-pale);font-size:13px;letter-spacing:.5px;text-align:center;max-width:600px}
  .pn-lightbox-close{position:absolute;top:20px;right:24px;background:none;border:none;color:var(--amber-pale);font-size:28px;cursor:pointer;line-height:1;opacity:.7;transition:opacity .15s}
  .pn-lightbox-close:hover{opacity:1}
  .pn-video-modal{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.92);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px}
  .pn-video-modal video{max-width:100%;max-height:80vh;border-radius:var(--rlg);box-shadow:0 8px 48px rgba(0,0,0,.6)}
  .pn-video-modal-title{margin-top:14px;color:var(--amber-pale);font-size:14px;text-align:center;max-width:700px}
  .pn-video-modal-close{position:absolute;top:20px;right:24px;background:none;border:none;color:#fff;font-size:28px;cursor:pointer;line-height:1;opacity:.7;transition:opacity .15s}
  .pn-video-modal-close:hover{opacity:1}

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
  .pn-video-card{border-radius:var(--rlg);overflow:hidden;background:var(--white);border:1px solid rgba(196,123,30,.1);transition:transform .3s,box-shadow .3s;cursor:pointer;text-decoration:none;display:block}
  .pn-video-card:hover{transform:translateY(-3px);box-shadow:var(--shadow)}
  .pn-video-thumb{aspect-ratio:16/9;position:relative;overflow:hidden}
  .pn-video-thumb-inner{width:100%;height:100%;display:flex;align-items:center;justify-content:center}
  .pn-video-thumb-inner img{width:100%;height:100%;object-fit:cover}
  .pn-video-play{width:56px;height:56px;border-radius:50%;background:rgba(196,123,30,.9);display:flex;align-items:center;justify-content:center;transition:transform .2s;position:absolute}
  .pn-video-card:hover .pn-video-play{transform:scale(1.1)}
  .pn-video-info{padding:16px 18px}
  .pn-video-title{font-family:'Cormorant Garamond',serif;font-size:18px;font-weight:500;color:var(--forest);margin-bottom:6px}
  .pn-video-meta{display:flex;align-items:center;justify-content:space-between}
  .pn-video-date{font-size:11px;color:var(--stone)}
  .pn-video-dur-badge{font-size:10px;font-weight:500;background:var(--forest);color:var(--amber-pale);padding:2px 8px;border-radius:20px}

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

  /* PERIOD MARKER */
  .pn-period-marker{display:flex;align-items:center;gap:16px;margin:32px 0 16px;grid-column:1/-1}
  .pn-period-marker-line{flex:1;height:1px;background:rgba(196,123,30,.2)}
  .pn-period-marker-label{font-family:'Cormorant Garamond',serif;font-size:13px;font-weight:500;letter-spacing:2px;text-transform:uppercase;color:var(--amber);white-space:nowrap;padding:4px 12px;border:1px solid rgba(196,123,30,.25);border-radius:20px}
  .pn-events-section .pn-period-marker-line{background:rgba(245,232,200,.1)}
  .pn-events-section .pn-period-marker-label{color:var(--amber-light);border-color:rgba(233,168,58,.2)}

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
    .pn-links{display:none}
  }
  .pn-hamburger{display:none;flex-direction:column;gap:5px;cursor:pointer;padding:8px;background:none;border:none;z-index:101}
  .pn-hamburger span{display:block;width:24px;height:2px;background:var(--charcoal);border-radius:2px;transition:all .25s}
  .pn-hamburger.open span:nth-child(1){transform:translateY(7px) rotate(45deg)}
  .pn-hamburger.open span:nth-child(2){opacity:0}
  .pn-hamburger.open span:nth-child(3){transform:translateY(-7px) rotate(-45deg)}
  .pn-mobile-menu{display:none;position:fixed;top:68px;left:0;right:0;background:rgba(245,240,232,.97);backdrop-filter:blur(12px);border-bottom:1px solid rgba(196,123,30,.2);z-index:99;flex-direction:column;padding:12px 0}
  .pn-mobile-menu.open{display:flex}
  .pn-mobile-menu a{padding:14px 24px;font-size:15px;color:var(--charcoal);text-decoration:none;border-bottom:1px solid rgba(196,123,30,.08)}
  .pn-mobile-menu a:last-child{border-bottom:none}
  .pn-mobile-menu a:active{background:rgba(196,123,30,.08)}
  .pn-back-top{position:fixed;bottom:24px;right:20px;z-index:90;width:44px;height:44px;border-radius:50%;background:var(--forest);color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 12px rgba(0,0,0,.25);opacity:0;pointer-events:none;transition:opacity .3s}
  .pn-back-top.visible{opacity:1;pointer-events:auto}
  @media(max-width:768px){.pn-hamburger{display:flex}}
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

function AudioCard({ track, isPlaying, progress, onPlay, onPause, onTimeUpdate, onEnded, audioRef }) {
  const src = track.url || `/static/uploads/audio/${track.filename}`;
  return (
    <div className="pn-audio-card">
      <audio ref={isPlaying ? audioRef : null} src={src} onTimeUpdate={onTimeUpdate} onEnded={onEnded} />
      <div className="pn-audio-header">
        <div className="pn-audio-thumb">♪</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="pn-audio-title">{track.title}</div>
          <div className="pn-audio-album">Praulits · {track.album}</div>
        </div>
      </div>
      <div className="pn-audio-player">
        <button className="pn-play-btn" aria-label={isPlaying ? "Pauze" : "Atskaņot"} onClick={isPlaying ? onPause : onPlay}>
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>
        <Waveform id={track.id} progress={progress} />
        <span className="pn-audio-dur">{track.duration}</span>
      </div>
    </div>
  );
}

const _MONTHS_LV = ['','Janvāris','Februāris','Marts','Aprīlis','Maijs','Jūnijs','Jūlijs','Augusts','Septembris','Oktobris','Novembris','Decembris'];

function periodLabel(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length < 2) return null;
  return `${_MONTHS_LV[parseInt(parts[1], 10)]} ${parts[0]}`;
}

function PeriodMarker({ label }) {
  return (
    <div className="pn-period-marker">
      <div className="pn-period-marker-line" />
      <div className="pn-period-marker-label">{label}</div>
      <div className="pn-period-marker-line" />
    </div>
  );
}

/* ─── MAIN COMPONENT ─── */
function HlsVideo({ src, hlsUrl, onClick }) {
  const ref = useRef(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (hlsUrl && Hls.isSupported()) {
      const hls = new Hls({
        startLevel: 0,              // always start at lowest quality (360p), upgrade after measuring speed
        abrEwmaFastVoD: 4.0,        // react to speed changes within ~4 segments
        abrEwmaSlowVoD: 15.0,       // conservative long-term average (don't jump quality too eagerly)
        abrBandWidthFactor: 0.85,   // only switch up if bandwidth is 85% of next level's requirement
        abrBandWidthUpFactor: 0.7,  // extra conservative switching up
        maxBufferLength: 30,        // buffer 30s ahead
        maxMaxBufferLength: 60,
        maxBufferSize: 60 * 1000 * 1000,
        fragLoadingTimeOut: 20000,  // 20s timeout per segment (slow mobile)
        manifestLoadingTimeOut: 10000,
        manifestLoadingMaxRetry: 3,
        levelLoadingTimeOut: 10000,
      });
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
      return () => hls.destroy();
    } else if (hlsUrl && video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS
      video.src = hlsUrl;
      video.play().catch(() => {});
    } else {
      video.src = src;
      video.play().catch(() => {});
    }
  }, [src, hlsUrl]);
  return <video ref={ref} controls style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 10, boxShadow: '0 8px 48px rgba(0,0,0,.6)' }} onClick={onClick} />;
}

export default function Praulitis() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showBackTop, setShowBackTop] = useState(false);
  const [playing, setPlaying] = useState(null);
  const [progress, setProgress] = useState({});
  const [lightbox, setLightbox] = useState(null); // {src, caption}
  const [videoPlayer, setVideoPlayer] = useState(null); // {src, title, id}
  const [linkCopied, setLinkCopied] = useState(false);
  const audioRef = useRef(null);

  // API data
  const [members, setMembers] = useState([]);
  const [events, setEvents] = useState([]);
  const [gallery, setGallery] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [videos, setVideos] = useState([]);
  const [content, setContent] = useState({});

  // Fetch all data on mount
  useEffect(() => {
    fetch('/api/members').then(r => r.json()).then(setMembers).catch(() => {});
    fetch('/api/events').then(r => r.json()).then(setEvents).catch(() => {});
    fetch('/api/gallery').then(r => r.json()).then(setGallery).catch(() => {});
    fetch('/api/music').then(r => r.json()).then(setTracks).catch(() => {});
    fetch('/api/videos').then(r => r.json()).then(data => {
      setVideos(data);
      // Open video if URL hash matches on first load
      const m = window.location.hash.match(/^#video-(\d+)$/);
      if (m) {
        const v = data.find(x => String(x.id) === m[1]);
        if (v && (v.url || v.filename)) {
          const src = v.url || `/static/uploads/videos/${v.filename}`;
          setVideoPlayer({ src, hlsUrl: v.hls_url || null, title: v.title, id: v.id });
        }
      }
    }).catch(() => {});
    fetch('/api/content').then(r => r.json()).then(setContent).catch(() => {});
  }, []);

  // GoatCounter analytics
  useEffect(() => {
    const script = document.createElement("script");
    script.async = true;
    script.src = "/count.js";
    script.setAttribute("data-goatcounter", "/count");
    document.head.appendChild(script);
    return () => { try { document.head.removeChild(script); } catch(_) {} };
  }, []);

  // Inject styles once
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // Nav scroll shadow + back-to-top visibility
  useEffect(() => {
    const handler = () => {
      setScrolled(window.scrollY > 40);
      setShowBackTop(window.scrollY > 400);
    };
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // Intersection fade-in — re-run when data loads
  useEffect(() => {
    const els = document.querySelectorAll(".pn-fade");
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e, i) => {
        if (e.isIntersecting) setTimeout(() => e.target.classList.add("visible"), i * 60);
      });
    }, { threshold: 0.1 });
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [members, events, gallery, tracks, videos]);

  // GoatCounter event helper
  const track = (path, title) => {
    window.goatcounter?.count({ path, title, event: true });
  };

  // Video deep-link helpers
  const openVideo = (v) => {
    const src = v.url || (v.filename ? `/static/uploads/videos/${v.filename}` : null);
    if (!src) return;
    history.pushState(null, '', `#video-${v.id}`);
    setVideoPlayer({ src, hlsUrl: v.hls_url || null, title: v.title, id: v.id });
    setLinkCopied(false);
    track('video-play', v.title);
  };
  const closeVideo = () => {
    history.pushState(null, '', window.location.pathname + window.location.search);
    setVideoPlayer(null);
    setLinkCopied(false);
  };
  const copyVideoLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  // Real audio playback
  const handlePlay = (trackId) => {
    setPlaying(trackId);
    setProgress(p => ({ ...p, [trackId]: p[trackId] || 0 }));
    setTimeout(() => audioRef.current?.play(), 0);
    const t = tracks.find(x => x.id === trackId);
    if (t) track(`audio-play`, t.title);
  };
  const handlePause = () => {
    audioRef.current?.pause();
    setPlaying(null);
  };
  const handleTimeUpdate = (trackId) => {
    const el = audioRef.current;
    if (!el || !el.duration) return;
    setProgress(p => ({ ...p, [trackId]: (el.currentTime / el.duration) * 100 }));
  };
  const handleEnded = (trackId) => {
    setPlaying(null);
    setProgress(p => ({ ...p, [trackId]: 0 }));
  };
  useEffect(() => () => audioRef.current?.pause(), []);

  const spanClass = (n) => `pn-span-${n}`;

  const navSections = [
    { href: "#members", label: "Ansamblis" },
    { href: "#events",  label: "Pasākumi" },
    { href: "#gallery", label: "Galerija" },
    { href: "#music",   label: "Mūzika" },
    { href: "#videos",  label: "Video" },
  ];

  return (
    <>
      {/* NAV */}
      <nav className={`pn-nav${scrolled ? " scrolled" : ""}`}>
        <a className="pn-logo" href="#home"><em>✦</em> Praulits</a>
        <div className="pn-links">
          {navSections.map(({ href, label }) => (
            <a key={href} href={href}>{label}</a>
          ))}
          <a href="/login" className="pn-login-btn">Ieiet</a>
        </div>
        <button className={`pn-hamburger${menuOpen ? " open" : ""}`} aria-label="Izvēlne" onClick={() => setMenuOpen(o => !o)}>
          <span /><span /><span />
        </button>
      </nav>

      {/* MOBILE MENU */}
      <div className={`pn-mobile-menu${menuOpen ? " open" : ""}`}>
        {navSections.map(({ href, label }) => (
          <a key={href} href={href} onClick={() => setMenuOpen(false)}>{label}</a>
        ))}
        <a href="/login" onClick={() => setMenuOpen(false)}>Ieiet</a>
      </div>

      {/* BACK TO TOP */}
      <button className={`pn-back-top${showBackTop ? " visible" : ""}`} aria-label="Uz augšu" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 15l-6-6-6 6"/></svg>
      </button>

      {/* HERO */}
      <section className="pn-hero" id="home">
        <div className="pn-hero-bg" />
        <div className="pn-hero-text pn-fade visible">
          <div className="pn-eyebrow">Folkloras kopa</div>
          <h1 className="pn-hero-title">Folkloras kopa<br /><em>Praulits</em></h1>
          <p className="pn-hero-sub">Prauliena · Madonas novads · Latvija</p>
          <p className="pn-hero-desc">
            {content.home_intro || "Folkloras kopa \"Praulits\" kopj senās dziedāšanas tradīcijas."}
          </p>
          <div className="pn-hero-cta">
            <a href="#events" className="pn-btn-primary">Pasākumi</a>
            <a href="#music"  className="pn-btn-outline">Klausīties</a>
          </div>
        </div>
        <div className="pn-hero-visual">
          <div className="pn-hero-frame">
            <div className="pn-frame-inner">
              {content.hero_image
                ? <img src={content.hero_image} alt="Praulits" />
                : <div className="pn-folk-ornament">✦</div>}
            </div>
            <div className="pn-hero-caption">
              <p>"{content.hero_quote || 'Dziedām dziesmas, ko dziedāja mūsu vecmāmiņas'}"</p>
              <span>{content.hero_location || 'Prauliena · Madonas novads'}</span>
            </div>
          </div>
        </div>
        <div className="pn-scroll-hint">Ritināt</div>
      </section>

      {/* MEMBERS */}
      <section className="pn-section" id="members" style={{ background: "var(--white)" }}>
        <div className="pn-section-header">
          <div>
            <div className="pn-section-label">Kolektīvs</div>
            <h2 className="pn-section-title">Mūsu <em>dalībnieki</em></h2>
          </div>
          <div className="pn-section-count">{String(members.length).padStart(2, '0')}</div>
        </div>
        {members.length === 0 ? (
          <div className="pn-empty">Dalībnieki vēl nav pievienoti.</div>
        ) : (
          <div className="pn-members-grid">
            {members.map((m) => (
              <div key={m.id} className="pn-member-card pn-fade">
                <div className="pn-member-photo">
                  <div className="pn-member-photo-inner" style={m.photo_filename ? {} : { background: `linear-gradient(${m.grad})` }}>
                    {m.photo_filename
                      ? <img src={m.photo_url || `/static/uploads/photos/${m.photo_filename}`} alt={m.name} />
                      : <span className="pn-member-initials">{m.initials}</span>
                    }
                  </div>
                  {m.instrument && <div className="pn-instrument-badge">{m.instrument}</div>}
                </div>
                <div className="pn-member-info">
                  <div className="pn-member-name">{m.name}</div>
                  <div className="pn-member-role">{m.role}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* EVENTS */}
      <section className="pn-section pn-events-section" id="events">
        <div className="pn-section-header">
          <div>
            <div className="pn-section-label">Koncerti un svētki</div>
            <h2 className="pn-section-title">Gaidāmie <em>pasākumi</em></h2>
          </div>
          <div className="pn-section-count">{String(events.length).padStart(2, '0')}</div>
        </div>
        {events.length === 0 ? (
          <div className="pn-empty" style={{ color: "rgba(245,232,200,.4)" }}>Pasākumi vēl nav pievienoti.</div>
        ) : (() => {
          let lastPeriod = null;
          return events.map((ev) => {
            const period = periodLabel(ev.date);
            const marker = period !== lastPeriod ? (lastPeriod = period, <PeriodMarker key={`p-${ev.id}`} label={period} />) : null;
            return (
              <div key={ev.id}>
                {marker}
                <a href={`/events/${ev.slug}`} className="pn-event-row pn-fade">
                  <div className="pn-event-date">
                    <div className="pn-event-day">{ev.day}</div>
                    <div className="pn-event-month">{ev.month}</div>
                  </div>
                  <div>
                    <div className="pn-event-title">{ev.title}</div>
                    {ev.venue && <div className="pn-event-venue">{ev.venue}</div>}
                  </div>
                  <span className="pn-event-ticket-btn">Uzzināt vairāk →</span>
                </a>
              </div>
            );
          });
        })()}
      </section>

      {/* GALLERY */}
      <section className="pn-section pn-gallery-section" id="gallery">
        <div className="pn-section-header">
          <div>
            <div className="pn-section-label">Fotogrāfijas</div>
            <h2 className="pn-section-title">Foto <em>galerija</em></h2>
          </div>
          <div className="pn-section-count">{String(gallery.length).padStart(2, '0')}</div>
        </div>
        {gallery.length === 0 ? (
          <div className="pn-empty">Galerija ir tukša.</div>
        ) : (() => {
          let lastPeriod = null;
          return (
            <div className="pn-gallery-grid">
              {gallery.map((g) => {
                const period = periodLabel(g.taken_date);
                const marker = period !== lastPeriod ? (lastPeriod = period, <PeriodMarker key={`gp-${g.id}`} label={period} />) : null;
                return (
                  <React.Fragment key={g.id}>
                    {marker}
                    <div className={`pn-gallery-item ${spanClass(g.span)} pn-fade`}
                      onClick={() => { setLightbox({ src: g.url || `/static/uploads/photos/${g.filename}`, caption: g.caption || g.album || '' }); track('gallery-open', g.caption || g.album || g.filename); }}>
                      <div className="pn-gallery-inner" style={{ background: "linear-gradient(135deg,#1c3a2e,#0e2018)", position: "relative" }}>
                        <img src={g.url || `/static/uploads/photos/${g.filename}`} alt={g.caption || g.album || 'Foto'} />
                      </div>
                      <div className="pn-gallery-overlay"><span>{g.caption || g.album || 'Apskatīt'}</span></div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          );
        })()}
      </section>

      {/* AUDIO */}
      <section className="pn-section" id="music" style={{ background: "var(--white)" }}>
        <div className="pn-section-header">
          <div>
            <div className="pn-section-label">Diskografija</div>
            <h2 className="pn-section-title">Klausīties <em>mūziku</em></h2>
          </div>
          <div className="pn-section-count">{String(tracks.length).padStart(2, '0')}</div>
        </div>
        {tracks.length === 0 ? (
          <div className="pn-empty">Audio ieraksti vēl nav pievienoti.</div>
        ) : (() => {
          let lastPeriod = null;
          return (
            <div className="pn-audio-grid">
              {tracks.map((t) => {
                const period = periodLabel(t.date);
                const marker = period !== lastPeriod ? (lastPeriod = period, <PeriodMarker key={`ap-${t.id}`} label={period} />) : null;
                return (
                  <React.Fragment key={t.id}>
                    {marker}
                    <AudioCard
                      track={t}
                      isPlaying={playing === t.id}
                      progress={progress[t.id] || 0}
                      onPlay={() => handlePlay(t.id)}
                      onPause={() => handlePause(t.id)}
                      onTimeUpdate={() => handleTimeUpdate(t.id)}
                      onEnded={() => handleEnded(t.id)}
                      audioRef={audioRef}
                    />
                  </React.Fragment>
                );
              })}
            </div>
          );
        })()}
      </section>

      {/* VIDEO */}
      <section className="pn-section pn-video-section" id="videos">
        <div className="pn-section-header">
          <div>
            <div className="pn-section-label">Ieraksti</div>
            <h2 className="pn-section-title">Skatīties <em>video</em></h2>
          </div>
          <div className="pn-section-count">{String(videos.length).padStart(2, '0')}</div>
        </div>
        {videos.length === 0 ? (
          <div className="pn-empty">Video vēl nav pievienoti.</div>
        ) : (() => {
          let lastPeriod = null;
          return (
            <div className="pn-video-grid">
              {videos.map((v) => {
                const period = periodLabel(v.date);
                const marker = period !== lastPeriod ? (lastPeriod = period, <PeriodMarker key={`vp-${v.id}`} label={period} />) : null;
                const href = v.youtube_url || null;
                const localSrc = v.url || (v.filename ? `/static/uploads/videos/${v.filename}` : null);
                return (
                  <React.Fragment key={v.id}>
                    {marker}
                    <a href={href || '#'} target={href ? "_blank" : undefined} rel={href ? "noopener noreferrer" : undefined}
                      className="pn-video-card pn-fade"
                      onClick={!href && localSrc ? (e) => { e.preventDefault(); openVideo(v); } : undefined}>
                      <div className="pn-video-thumb">
                        <div className="pn-video-thumb-inner" style={{ background: `linear-gradient(${v.grad})` }}>
                          {v.thumbnail && <img src={v.thumbnail_url || `/static/uploads/photos/${v.thumbnail}`} alt={v.title} />}
                        </div>
                        <div className="pn-video-play"><VideoPlayIcon /></div>
                      </div>
                      <div className="pn-video-info">
                        <div className="pn-video-title">{v.title}</div>
                        <div className="pn-video-meta">
                          <span className="pn-video-date">{v.date}</span>
                          {v.dur && <span className="pn-video-dur-badge">{v.dur}</span>}
                        </div>
                      </div>
                    </a>
                  </React.Fragment>
                );
              })}
            </div>
          );
        })()}
      </section>

      {/* FOOTER */}
      <footer className="pn-footer">
        <div className="pn-footer-divider">✦ ✦ ✦ ✦ ✦</div>
        <div className="pn-footer-inner">
          <div>
            <div className="pn-footer-logo"><em>Praulits</em></div>
            <p className="pn-footer-tagline">
              Folkloras kopa no Praulienas — kopjam senās dziedāšanas tradīcijas jau vairākus gadu desmitus.
            </p>
            <div className="pn-footer-social">
              <a className="pn-social-btn" href="#" aria-label="Facebook">f</a>
              <a className="pn-social-btn" href="#" aria-label="YouTube">▶</a>
            </div>
          </div>
          <div className="pn-footer-col">
            <h4>Lapas</h4>
            {navSections.map(({ href, label }) => (
              <a key={href} href={href}>{label}</a>
            ))}
          </div>
          <div className="pn-footer-col">
            <h4>Dalībnieki</h4>
            <a href="/member">Dalībnieku zona</a>
            <a href="/member/schedule">Mēģinājumi</a>
            <a href="/login">Ieiet</a>
          </div>
        </div>
        <div className="pn-footer-bottom">
          <span>Prauliena · Madonas novads · Latvija</span>
          <span>© {new Date().getFullYear()} Folkloras kopa "Praulits"</span>
        </div>
      </footer>

      {lightbox && (
        <div className="pn-lightbox" onClick={() => setLightbox(null)}>
          <button className="pn-lightbox-close" onClick={() => setLightbox(null)}>✕</button>
          <img src={lightbox.src} alt={lightbox.caption} onClick={e => e.stopPropagation()} />
          {lightbox.caption && <div className="pn-lightbox-caption">{lightbox.caption}</div>}
        </div>
      )}

      {videoPlayer && (
        <div className="pn-video-modal" onClick={closeVideo}>
          <button className="pn-video-modal-close" onClick={closeVideo}>✕</button>
          <HlsVideo src={videoPlayer.src} hlsUrl={videoPlayer.hlsUrl} onClick={e => e.stopPropagation()} />
          {videoPlayer.title && <div className="pn-video-modal-title">{videoPlayer.title}</div>}
          <button onClick={e => { e.stopPropagation(); copyVideoLink(); }}
            style={{ marginTop: 10, background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.3)', color: '#fff', borderRadius: 4, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>
            {linkCopied ? '✓ Saite nokopēta' : '🔗 Kopēt saiti'}
          </button>
        </div>
      )}
    </>
  );
}
