<?php
if (!defined('ABSPATH')) exit;
$admin = pe_admin_get_user();
global $wpdb;
// Status subquery: derive from parcel_history since AWBENTRY has no STATUS column
$_st_sub = "(SELECT ph.activity FROM parcel_history ph WHERE ph.AWBNO = a.AWBNO ORDER BY ph.date DESC, ph.time DESC LIMIT 1)";
$ts = intval($wpdb->get_var("SELECT COUNT(*) FROM AWBENTRY a"));
$dc = intval($wpdb->get_var("SELECT COUNT(*) FROM AWBENTRY a WHERE LOWER(COALESCE($_st_sub, '')) LIKE '%delivered%'"));
$ac = intval($wpdb->get_var("SELECT COUNT(*) FROM AWBENTRY a WHERE LOWER(COALESCE($_st_sub, '')) NOT LIKE '%delivered%' AND a.AWBDATE < DATE_SUB(CURDATE(), INTERVAL 14 DAY)"));
// Avg transit: use parcel_history delivered date vs AWBDATE
$ad = $wpdb->get_var("SELECT ROUND(AVG(DATEDIFF(
    (SELECT ph2.date FROM parcel_history ph2 WHERE ph2.AWBNO = a.AWBNO AND LOWER(ph2.activity) LIKE '%delivered%' ORDER BY ph2.date DESC LIMIT 1),
    a.AWBDATE
)),1) FROM AWBENTRY a WHERE (SELECT ph3.date FROM parcel_history ph3 WHERE ph3.AWBNO = a.AWBNO AND LOWER(ph3.activity) LIKE '%delivered%' ORDER BY ph3.date DESC LIMIT 1) IS NOT NULL AND a.AWBDATE IS NOT NULL AND a.AWBDATE != '0000-00-00'") ?: '—';
?>
<style>
#wpadminbar{display:none!important}html{margin-top:0!important}
*,*::before,*::after{box-sizing:border-box}

/* ── ANIMATIONS ── */
@keyframes pe-spin{to{transform:rotate(360deg)}}
@keyframes pe-fadeIn{from{opacity:0}to{opacity:1}}
@keyframes pe-fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes pe-slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
@keyframes pe-shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
@keyframes pe-countUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes pe-pulse{0%,100%{opacity:.4}50%{opacity:.8}}
@keyframes pe-ripple{to{transform:scale(4);opacity:0}}

/* ── THEME VARIABLES ── */
:root,[data-theme="light"]{--bg:#f0f2f5;--bg2:#e8ecf1;--bg3:#dde2e9;--card:#fff;--card2:#f8fafc;--bdr:#dfe3e8;--bdr2:#c4ccd4;--text:#0f172a;--text2:#475569;--text3:#94a3b8;--sh:0 2px 8px rgba(0,0,0,.06);--sh2:0 8px 32px rgba(0,0,0,.08);--sidebar:#0c1322;--sb-text:#8896a8;--sb-active:rgba(187,0,19,.08);--glass:rgba(255,255,255,.7);--glass-bdr:rgba(255,255,255,.3)}
[data-theme="dark"]{--bg:#0a0a0a;--bg2:#111;--bg3:#1a1a1a;--card:#151515;--card2:#1a1a1a;--bdr:#252525;--bdr2:#333;--text:#e8eaed;--text2:#9aa0a8;--text3:#6b707a;--sh:0 2px 8px rgba(0,0,0,.3);--sh2:0 8px 32px rgba(0,0,0,.4);--sidebar:#050505;--sb-text:#6b707a;--sb-active:rgba(187,0,19,.12);--glass:rgba(21,21,21,.8);--glass-bdr:rgba(50,50,50,.4)}
:root{--red:#bb0013;--red2:#dc2626;--green:#22c55e;--blue:#3b82f6;--amber:#f59e0b}

/* ── LOADING OVERLAY ── */
.pead-loader{position:fixed;inset:0;z-index:200000;background:linear-gradient(135deg,#0c1322 0%,#060d1a 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;transition:opacity .4s,visibility .4s}
.pead-loader.hidden{opacity:0;visibility:hidden;pointer-events:none}
.pead-loader-logo{width:72px;height:72px;border-radius:18px;object-fit:contain;margin-bottom:24px;animation:pe-pulse 1.5s ease infinite}
.pead-loader-bar{width:200px;height:3px;background:#1a1a2e;border-radius:3px;overflow:hidden;margin-top:16px}
.pead-loader-bar::after{content:'';display:block;width:40%;height:100%;background:linear-gradient(90deg,#bb0013,#ff3344);border-radius:3px;animation:pe-shimmer 1.2s ease infinite}
.pead-loader-text{color:#4a5568;font-size:14px;font-weight:600;letter-spacing:2px;margin-top:16px;font-family:'Inter',sans-serif}

/* ── APP ── */
.pead-app{position:fixed;inset:0;z-index:99999;display:flex;font-family:'Inter',sans-serif;background:var(--bg);color:var(--text);font-size:16px;opacity:0;transition:opacity .3s}
.pead-app.loaded{opacity:1}

/* ── SIDEBAR ── */
.pead-sidebar{width:260px;background:var(--sidebar);display:flex;flex-direction:column;flex-shrink:0;border-right:1px solid rgba(255,255,255,.06)}
.pead-sb-brand{padding:24px;border-bottom:1px solid rgba(255,255,255,.06);display:flex;align-items:center;gap:14px}
.pead-sb-brand img{width:42px;height:42px;border-radius:10px;object-fit:contain}
.pead-sb-brand .sb-info h3{font-size:17px;font-weight:900;color:var(--red);margin:0;letter-spacing:1px}
.pead-sb-brand .sb-info p{font-size:10px;font-weight:700;color:#4a5568;letter-spacing:3px;margin:2px 0 0;text-transform:uppercase}
.pead-sb-nav{flex:1;padding:12px 0;overflow-y:auto}
.pead-sb-sec{font-size:10px;font-weight:800;color:#4a5568;letter-spacing:2.5px;text-transform:uppercase;padding:18px 24px 8px}
.pead-sb-item{display:flex;align-items:center;gap:14px;padding:14px 24px;color:var(--sb-text);font-size:15px;font-weight:600;cursor:pointer;transition:all .15s;border-left:3px solid transparent;text-decoration:none;position:relative;overflow:hidden}
.pead-sb-item:hover{color:#c6d0da;background:rgba(255,255,255,.03)}
.pead-sb-item.active{color:var(--red);background:var(--sb-active);border-left-color:var(--red)}
.pead-sb-item i{width:20px;text-align:center;font-size:15px}
.pead-sb-item .ct{margin-left:auto;background:var(--red);color:#fff;font-size:10px;font-weight:800;padding:3px 10px;border-radius:12px}
.pead-sb-bottom{padding:18px;border-top:1px solid rgba(255,255,255,.06)}
.pead-sb-link{display:flex;align-items:center;gap:11px;padding:10px 12px;color:#4a5568;font-size:14px;font-weight:600;cursor:pointer;text-decoration:none;border-radius:8px;transition:all .15s}
.pead-sb-link:hover{color:var(--red);background:rgba(187,0,19,.06)}
.pead-sb-link i{width:18px;text-align:center}

/* ── TOPBAR ── */
.pead-main{flex:1;display:flex;flex-direction:column;overflow:hidden}
.pead-topbar{display:flex;align-items:center;gap:16px;padding:14px 28px;background:var(--card);border-bottom:1px solid var(--bdr);flex-shrink:0}
.pead-search{flex:1;max-width:500px;display:flex;align-items:center;gap:10px;background:var(--bg);border:1.5px solid var(--bdr);border-radius:12px;padding:0 16px;transition:all .2s}
.pead-search:focus-within{border-color:var(--red);box-shadow:0 0 0 3px rgba(187,0,19,.06)}
.pead-search i{color:var(--text3);font-size:16px}
.pead-search input{flex:1;padding:12px 0;border:none;background:transparent;font-size:15px;font-family:inherit;color:var(--text);outline:none;font-weight:500}
.pead-search input::placeholder{color:var(--text3)}
.pead-topbar-r{display:flex;align-items:center;gap:12px;margin-left:auto}
.pead-ticon{width:42px;height:42px;border-radius:10px;background:var(--bg);border:1.5px solid var(--bdr);display:flex;align-items:center;justify-content:center;color:var(--text3);font-size:16px;cursor:pointer;transition:all .15s;position:relative}
.pead-ticon:hover{background:var(--bg2);color:var(--text2);transform:translateY(-1px)}
.pead-ndot{position:absolute;top:6px;right:6px;width:8px;height:8px;background:var(--red);border-radius:50%;border:2px solid var(--card)}
.pead-adm{display:flex;align-items:center;gap:12px;padding-left:16px;border-left:1.5px solid var(--bdr)}
.pead-adm .nm{font-size:14px;font-weight:700;color:var(--text)}
.pead-adm .rl{font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:1px}
.pead-av{width:40px;height:40px;background:linear-gradient(135deg,#bb0013,#d4001a);border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;font-weight:800;box-shadow:0 2px 8px rgba(187,0,19,.3)}

/* ── CONTENT ── */
.pead-content{flex:1;overflow-y:auto;padding:28px}
.pead-view{display:none;animation:pe-fadeIn .3s ease}.pead-view.active{display:block}
.pead-pt{font-size:32px;font-weight:900;color:var(--text);letter-spacing:-.5px;margin:0 0 4px}
.pead-ps{font-size:15px;color:var(--text3);margin:0 0 24px;font-weight:500}

/* ── STATS ── */
.pead-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-bottom:24px}
.pead-stat{background:var(--card);border-radius:16px;padding:24px 26px;border:1px solid var(--bdr);box-shadow:var(--sh);display:flex;justify-content:space-between;align-items:flex-start;position:relative;overflow:hidden;transition:all .2s;cursor:default}
.pead-stat:hover{transform:translateY(-3px);box-shadow:var(--sh2)}
.pead-stat::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--red)}
.pead-stat:nth-child(2)::before{background:var(--amber)}.pead-stat:nth-child(3)::before{background:var(--blue)}
.pead-sl{font-size:12px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px}
.pead-sv{font-size:42px;font-weight:900;color:var(--text);letter-spacing:-1.5px;line-height:1;animation:pe-countUp .5s ease}
.pead-sc{font-size:13px;font-weight:600;margin-top:8px}.pead-sc.g{color:var(--green)}.pead-sc.w{color:var(--amber)}.pead-sc.b{color:var(--blue)}
.pead-si{width:48px;height:48px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;background:rgba(187,0,19,.08);color:var(--red)}
.pead-stat:nth-child(2) .pead-si{background:rgba(245,158,11,.08);color:var(--amber)}
.pead-stat:nth-child(3) .pead-si{background:rgba(59,130,246,.08);color:var(--blue)}

/* ── SKELETON LOADING ── */
.pead-skeleton{background:linear-gradient(90deg,var(--bg2) 25%,var(--bg3) 50%,var(--bg2) 75%);background-size:800px 100%;animation:pe-shimmer 1.5s ease infinite;border-radius:8px;height:20px}

/* ── FILTER BAR ── */
.pead-fb{display:flex;align-items:center;gap:10px;margin-bottom:18px;flex-wrap:wrap}
.pead-fs{flex:1;min-width:240px;display:flex;align-items:center;gap:10px;background:var(--card);border:1.5px solid var(--bdr);border-radius:12px;padding:0 16px;transition:all .2s}
.pead-fs:focus-within{border-color:var(--red);box-shadow:0 0 0 3px rgba(187,0,19,.06)}
.pead-fs i{color:var(--text3);font-size:15px}
.pead-fs input{flex:1;padding:12px 0;border:none;background:transparent;font-size:15px;font-family:inherit;color:var(--text);outline:none;font-weight:500}
.pead-fs input::placeholder{color:var(--text3)}
.pead-pills{display:flex;gap:6px;flex-wrap:wrap}
.pead-pill{padding:10px 18px;border-radius:10px;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer;transition:all .15s;border:1.5px solid var(--bdr);background:var(--card);color:var(--text3);letter-spacing:.3px}
.pead-pill:hover{border-color:var(--bdr2);color:var(--text2);transform:translateY(-1px)}
.pead-pill.on{background:var(--red);color:#fff;border-color:var(--red);box-shadow:0 4px 12px rgba(187,0,19,.25)}
.pead-pill .n{opacity:.6;font-size:11px;margin-left:4px}
.pead-fa{display:flex;gap:8px;margin-left:auto}
.pead-btn{display:inline-flex;align-items:center;gap:8px;padding:10px 18px;border-radius:10px;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer;transition:all .15s;border:1.5px solid var(--bdr);background:var(--card);color:var(--text2);letter-spacing:.3px}
.pead-btn:hover{border-color:var(--bdr2);color:var(--text);transform:translateY(-1px)}
.pead-btn i{font-size:12px}
.pead-btn-r{background:linear-gradient(135deg,#bb0013,#d4001a);border-color:var(--red);color:#fff;box-shadow:0 2px 8px rgba(187,0,19,.2)}
.pead-btn-r:hover{box-shadow:0 4px 16px rgba(187,0,19,.35);background:linear-gradient(135deg,#a00010,#c4001a)}

/* ── TABLE ── */
.pead-tc{background:var(--card);border-radius:16px;border:1px solid var(--bdr);box-shadow:var(--sh);overflow:hidden}
.pead-th{display:flex;justify-content:space-between;align-items:center;padding:18px 22px;border-bottom:1px solid var(--bdr)}
.pead-th h3{font-size:17px;font-weight:800;display:flex;align-items:center;gap:10px;margin:0;color:var(--text)}
.pead-th h3 i{color:var(--red);font-size:16px}
.pead-th .tb{font-size:11px;font-weight:700;background:rgba(187,0,19,.08);color:var(--red);padding:4px 12px;border-radius:14px;margin-left:8px}
.pead-tw{overflow-x:auto}
table.pead-t{width:100%;border-collapse:collapse;min-width:1100px}
.pead-t thead th{padding:14px 16px;font-size:11px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:1.2px;text-align:left;border-bottom:1px solid var(--bdr);background:var(--bg2);white-space:nowrap}
.pead-t tbody tr{border-bottom:1px solid rgba(187,0,19,.08);cursor:pointer;transition:all .12s}
.pead-t tbody tr:hover{background:rgba(187,0,19,.02)}
.pead-t tbody td{padding:16px;font-size:14px;font-weight:500;color:var(--text2);white-space:nowrap}
.pead-t .idc{color:var(--red);font-weight:800;font-size:13px}
.pead-t .awbc{font-weight:700;color:var(--text);font-family:'Courier New',monospace;font-size:14px;letter-spacing:.5px}
.pead-t .nmc{font-weight:700;color:var(--text);max-width:200px;overflow:hidden;text-overflow:ellipsis}
.pead-badge{display:inline-block;padding:4px 12px;border-radius:6px;font-size:11px;font-weight:800;letter-spacing:.4px;text-transform:uppercase}
.b0{background:rgba(34,197,94,.08);color:var(--green)}.b5{background:rgba(59,130,246,.08);color:var(--blue)}
.b1007{background:rgba(187,0,19,.08);color:var(--red)}.bx{background:var(--bg2);color:var(--text3)}
.pead-st{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:600}
.pead-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.dd{background:var(--green)}.dt{background:var(--amber)}.db{background:var(--text3)}.dr{background:var(--red2)}.dbl{background:var(--blue)}.dof{background:#8b5cf6}
.pead-fw{font-size:11px;font-weight:800;padding:4px 10px;border-radius:6px;letter-spacing:.4px}
.fw1{background:rgba(34,197,94,.08);color:var(--green)}.fw0{background:var(--bg2);color:var(--text3)}

/* ── PAGINATION ── */
.pead-pg{display:flex;justify-content:space-between;align-items:center;padding:16px 22px;border-top:1px solid var(--bdr)}
.pead-pi{font-size:14px;color:var(--text3)}.pead-pi strong{color:var(--red)}
.pead-pbs{display:flex;gap:4px}
.pead-pb{width:38px;height:38px;border-radius:8px;border:1.5px solid var(--bdr);background:var(--card);color:var(--text3);font-size:13px;font-weight:700;font-family:inherit;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s}
.pead-pb:hover{background:var(--bg2);transform:translateY(-1px)}.pead-pb.on{background:var(--red);color:#fff;border-color:var(--red)}.pead-pb:disabled{opacity:.3;cursor:not-allowed}

/* ── DETAIL PANEL ── */
.pead-do{display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:100000;justify-content:flex-end;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.pead-do.show{display:flex}
.pead-dp{width:680px;max-width:100%;background:var(--card);height:100%;overflow-y:auto;border-left:1px solid var(--bdr);animation:pe-slideIn .3s ease}
.pead-dh{padding:24px 26px;border-bottom:1px solid var(--bdr);display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;background:var(--card);z-index:2}
.pead-dh h3{font-size:20px;font-weight:800;margin:0;display:flex;align-items:center;gap:10px;color:var(--text)}
.pead-dh h3 i{color:var(--red)}
.pead-dc{width:36px;height:36px;border-radius:10px;border:1.5px solid var(--bdr);background:var(--card);cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text3);font-size:14px;transition:all .15s}
.pead-dc:hover{background:rgba(187,0,19,.08);color:var(--red);border-color:rgba(187,0,19,.2)}
.pead-db{padding:26px}
.pead-ds{margin-bottom:24px;animation:pe-fadeUp .3s ease both}
.pead-ds:nth-child(2){animation-delay:.05s}.pead-ds:nth-child(3){animation-delay:.1s}.pead-ds:nth-child(4){animation-delay:.15s}
.pead-ds h4{font-size:12px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:2px;margin:0 0 14px;display:flex;align-items:center;gap:8px}
.pead-ds h4 i{color:var(--red);font-size:13px}
.pead-dg{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.pead-df{background:var(--bg);border:1px solid var(--bdr);border-radius:10px;padding:12px 14px}
.pead-df .l{font-size:10px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}
.pead-df .v{font-size:14px;font-weight:600;color:var(--text);word-break:break-all}
.pead-df.fl{grid-column:1/-1}
/*.pead-df .v.m{font-family:'Courier New',monospace;font-size:13px;color:var(--text2)}*/

/* ── SHIPMENT DETAIL ITEMS TABLE ── */
.pead-dit{width:100%;border-collapse:collapse;font-size:14px}
.pead-dit th{text-align:left;padding:10px 12px;font-size:10px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid var(--bdr);background:var(--bg2);border-radius:8px 8px 0 0}
.pead-dit td{padding:10px 12px;border-bottom:1px solid var(--bg);color:var(--text2)}

/* ── ENHANCED TRACKING TIMELINE ── */
.pead-tl{list-style:none;padding:0;margin:0}
.pead-tl li{position:relative;padding:14px 0 14px 36px;border-left:2px solid var(--red);margin-left:10px;animation:pe-fadeUp .3s ease both}
.pead-tl li:nth-child(1){animation-delay:0s}.pead-tl li:nth-child(2){animation-delay:.05s}.pead-tl li:nth-child(3){animation-delay:.1s}
.pead-tl li::before{content:'';position:absolute;left:-7px;top:18px;width:12px;height:12px;border-radius:50%;background:var(--red);border:3px solid var(--card);box-shadow:0 0 0 2px rgba(187,0,19,.3)}
.pead-tl li:first-child::before{background:var(--green);box-shadow:0 0 0 2px rgba(34,197,94,.3),0 0 12px rgba(34,197,94,.2)}
.pead-tl-card{background:var(--bg);border:1px solid var(--bdr);border-radius:10px;padding:14px 16px;transition:all .15s}
.pead-tl-card:hover{border-color:var(--bdr2);box-shadow:var(--sh)}
.pead-tla{font-weight:700;color:var(--text);font-size:15px;margin-bottom:6px;display:flex;align-items:center;gap:8px}
.pead-tla i{font-size:13px;color:var(--red)}
.pead-tl li:first-child .pead-tla i{color:var(--green)}
.pead-tlm{font-size:13px;color:var(--text3);display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.pead-tlm i{font-size:10px}
.pead-tl-empty{text-align:center;padding:40px;color:var(--text3)}
.pead-tl-empty i{font-size:40px;display:block;margin-bottom:12px;opacity:.2}

/* ── STATUS PROGRESS BAR ── */
.pead-progress{display:flex;align-items:center;gap:0;margin-bottom:24px;padding:0 4px}
.pead-progress-step{flex:1;text-align:center;position:relative}
.pead-progress-step .dot{width:28px;height:28px;border-radius:50%;background:var(--bg3);border:3px solid var(--bdr);margin:0 auto 8px;display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--text3);position:relative;z-index:1;transition:all .3s}
.pead-progress-step.done .dot{background:var(--green);border-color:var(--green);color:#fff}
.pead-progress-step.current .dot{background:var(--blue);border-color:var(--blue);color:#fff;box-shadow:0 0 0 4px rgba(59,130,246,.2)}
.pead-progress-step .lbl{font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px}
.pead-progress-step.done .lbl{color:var(--green)}
.pead-progress-step.current .lbl{color:var(--blue)}
.pead-progress-line{flex:1;height:3px;background:var(--bg3);margin:0 -8px;position:relative;top:-18px}
.pead-progress-line.done{background:var(--green)}

/* ── RATE CUSTOMIZER ── */
.pead-rsel select{padding:12px 36px 12px 16px;border:1.5px solid var(--bdr);border-radius:12px;font-size:15px;font-weight:600;font-family:inherit;background:var(--card);color:var(--text);outline:none;min-width:220px;appearance:none;cursor:pointer;transition:all .2s;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2394a3b8'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center}
.pead-rsel select:focus{border-color:var(--red)}
.pead-rtop{display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap}
.pead-rinfo{font-size:14px;color:var(--text3)}.pead-rinfo strong{color:var(--text)}
.pead-rc{background:var(--card);border:1px solid var(--bdr);border-radius:16px;box-shadow:var(--sh);overflow:hidden}
.pead-rch{display:flex;justify-content:space-between;align-items:center;padding:18px 22px;border-bottom:1px solid var(--bdr);background:var(--bg2)}
.pead-rch h3{font-size:16px;font-weight:800;margin:0;display:flex;align-items:center;gap:8px;color:var(--text)}.pead-rch h3 i{color:var(--red);font-size:14px}
.pead-rscroll{overflow:auto;max-height:520px}
.pead-rt{width:100%;border-collapse:collapse;font-size:13px}
.pead-rt thead{position:sticky;top:0;z-index:1}
.pead-rt th{padding:12px 8px;font-size:10px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.8px;border-bottom:1px solid var(--bdr);background:var(--card);white-space:nowrap;text-align:center}
.pead-rt th:first-child,.pead-rt th:nth-child(2),.pead-rt th:nth-child(3){text-align:left}
.pead-rt td{padding:4px 4px;border-bottom:1px solid var(--bg);text-align:center}
.pead-rt td:first-child{text-align:left;padding-left:12px;font-weight:700;color:var(--text);font-size:12px;white-space:nowrap}
.pead-rt tbody tr:hover{background:var(--bg)}
.ri{width:64px;padding:6px 5px;border:1px solid transparent;border-radius:6px;font-size:13px;font-weight:600;font-family:'Courier New',monospace;background:transparent;color:var(--text);text-align:right;transition:all .15s}
.ri:hover{border-color:var(--bdr);background:var(--bg2)}
.ri:focus{border-color:var(--red);background:var(--card);outline:none;box-shadow:0 0 0 3px rgba(187,0,19,.1)}
.ri.ok{animation:rflash .5s ease}
.ri.err{border-color:var(--red2)!important}
.riw{width:90px;text-align:left;font-family:inherit}
@keyframes rflash{0%{background:rgba(34,197,94,.15)}100%{background:transparent}}
.pead-rdel{width:30px;height:30px;border:none;background:rgba(220,38,38,.06);color:var(--red2);border-radius:8px;cursor:pointer;font-size:11px;display:flex;align-items:center;justify-content:center;margin:0 auto;transition:all .15s}
.pead-rdel:hover{background:rgba(220,38,38,.15);transform:scale(1.1)}
.pead-rem{padding:60px 24px;text-align:center;color:var(--text3)}
.pead-rem i{font-size:40px;display:block;margin-bottom:14px;opacity:.2}
.pead-rem p{font-size:16px;font-weight:600;margin:0}

/* ── RATE ACTION BUTTONS ── */
.pead-ract{display:flex;gap:6px;align-items:center;justify-content:center;white-space:nowrap}
.pead-ract-btn{padding:6px 12px;border-radius:8px;font-size:11px;font-weight:800;font-family:inherit;cursor:pointer;border:1.5px solid var(--bdr);background:var(--card);color:var(--text2);transition:all .15s;display:inline-flex;align-items:center;gap:5px;letter-spacing:.3px}
.pead-ract-btn:hover{transform:translateY(-1px);box-shadow:var(--sh)}
.pead-ract-btn.edit{border-color:var(--blue);color:var(--blue);background:rgba(59,130,246,.06)}
.pead-ract-btn.edit:hover{background:rgba(59,130,246,.12)}
.pead-ract-btn.save{border-color:var(--green);color:var(--green);background:rgba(34,197,94,.06)}
.pead-ract-btn.save:hover{background:rgba(34,197,94,.12)}
.pead-ract-btn.cancel{border-color:var(--text3);color:var(--text3);background:transparent}
.pead-ract-btn.cancel:hover{background:var(--bg2)}
.pead-ract-btn.del{border-color:var(--red2);color:var(--red2);background:rgba(220,38,38,.06)}
.pead-ract-btn.del:hover{background:rgba(220,38,38,.12)}
.pead-rt td.rate-val{font-family:'Courier New',monospace;font-size:13px;font-weight:600;color:var(--text)}
.pead-rt tr.editing td{background:rgba(59,130,246,.03)}
.pead-rt tr.editing .ri{border-color:var(--bdr);background:var(--card)}

/* ── OTP MODAL ── */
.pead-otp-modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:200000;align-items:center;justify-content:center;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
.pead-otp-modal.show{display:flex}
.pead-otp-modal-card{background:var(--card);border-radius:20px;padding:36px;max-width:440px;width:90%;box-shadow:0 25px 60px rgba(0,0,0,.2);animation:pe-fadeUp .3s ease}
.pead-otp-modal-card h3{font-size:22px;font-weight:800;margin:0 0 8px;color:var(--text);display:flex;align-items:center;gap:10px}
.pead-otp-modal-card h3 i{color:var(--red);font-size:20px}
.pead-otp-modal-card .otp-desc{font-size:14px;color:var(--text2);margin:0 0 24px;line-height:1.6}
.pead-otp-modal-card .otp-desc strong{color:var(--red)}
.pead-otp-modal-inputs{display:flex;gap:8px;justify-content:center;margin-bottom:20px}
.pead-otp-modal-inputs input{width:48px;height:58px;border:2px solid var(--bdr);border-radius:12px;text-align:center;font-size:24px;font-weight:900;font-family:'Courier New',monospace;color:var(--text);background:var(--bg);outline:none;transition:all .2s}
.pead-otp-modal-inputs input:focus{border-color:var(--red);box-shadow:0 0 0 3px rgba(187,0,19,.08)}
.pead-otp-modal-inputs input.filled{border-color:var(--green)}
.pead-otp-modal-actions{display:flex;gap:10px;margin-top:20px}
.pead-otp-modal-actions .pead-btn{flex:1;justify-content:center;padding:14px}
.pead-otp-msg{padding:10px 14px;border-radius:10px;font-size:13px;font-weight:600;margin-bottom:16px;display:none}
.pead-otp-msg.ok{display:block;background:rgba(34,197,94,.08);color:var(--green);border:1px solid rgba(34,197,94,.2)}
.pead-otp-msg.no{display:block;background:rgba(220,38,38,.08);color:var(--red2);border:1px solid rgba(220,38,38,.2)}
.pead-otp-modal-timer{text-align:center;font-size:12px;color:var(--text3);margin-top:12px}
.pead-otp-modal-timer strong{color:var(--red)}

/* ── SETTINGS ── */
.pead-set-card{background:var(--card);border:1px solid var(--bdr);border-radius:16px;box-shadow:var(--sh);padding:28px;max-width:520px;margin-bottom:24px;transition:all .2s}
.pead-set-card:hover{box-shadow:var(--sh2)}
.pead-set-card h3{font-size:18px;font-weight:800;margin:0 0 20px;display:flex;align-items:center;gap:10px;color:var(--text)}
.pead-set-card h3 i{color:var(--red)}
.pead-sfg{margin-bottom:16px}
.pead-sfg label{display:block;font-size:11px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px}
.pead-sfg input{width:100%;padding:14px 16px;border:1.5px solid var(--bdr);border-radius:10px;background:var(--bg);color:var(--text);font-size:15px;font-family:inherit;outline:none;transition:all .2s}
.pead-sfg input:focus{border-color:var(--red);box-shadow:0 0 0 3px rgba(187,0,19,.06)}
.pead-set-msg{padding:12px 16px;border-radius:10px;font-size:14px;font-weight:600;margin-bottom:16px;display:none}
.pead-set-msg.ok{display:block;background:rgba(34,197,94,.08);color:var(--green);border:1px solid rgba(34,197,94,.2)}
.pead-set-msg.no{display:block;background:rgba(220,38,38,.08);color:var(--red2);border:1px solid rgba(220,38,38,.2)}

/* ── IP WHITELIST TABLE ── */
.pead-ip-list{list-style:none;padding:0;margin:0}
.pead-ip-list li{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border:1px solid var(--bdr);border-radius:10px;margin-bottom:8px;background:var(--bg);font-size:14px;font-weight:600;font-family:'Courier New',monospace;color:var(--text)}
.pead-ip-list li .ip-you{font-size:10px;font-weight:800;color:var(--green);text-transform:uppercase;letter-spacing:1px;font-family:'Inter',sans-serif;margin-left:8px}
.pead-ip-rm{width:28px;height:28px;border:none;background:rgba(220,38,38,.06);color:var(--red2);border-radius:6px;cursor:pointer;font-size:10px;display:flex;align-items:center;justify-content:center;transition:all .15s}
.pead-ip-rm:hover{background:rgba(220,38,38,.15)}

/* ── FOOTER ── */
.pead-footer{display:flex;justify-content:center;align-items:center;gap:32px;padding:12px 28px;background:var(--card);border-top:1px solid var(--bdr);flex-shrink:0}
.pead-footer span{font-size:11px;font-weight:700;color:var(--text3);letter-spacing:1px;text-transform:uppercase;display:flex;align-items:center;gap:6px}
.pead-footer .dg{width:7px;height:7px;border-radius:50%;background:var(--green)}

/* ── RESPONSIVE ── */
@media(max-width:1200px){.pead-stats{grid-template-columns:repeat(2,1fr)}}
@media(max-width:900px){
    .pead-sidebar{position:fixed;left:-280px;z-index:100001;transition:left .25s ease;height:100%;box-shadow:4px 0 24px rgba(0,0,0,.4);width:280px}
    .pead-sidebar.open{left:0}
    .pead-sbt{display:flex!important}
    .pead-dp{width:100%}
    .pead-stats{grid-template-columns:1fr}
    .pead-fb{flex-direction:column;align-items:stretch}
    .pead-fa{margin-left:0}
    .pead-topbar{padding:12px 16px}
    .pead-content{padding:18px 16px}
    .pead-pt{font-size:26px}
    .pead-ps{font-size:14px}
    .pead-adm{display:none}
    .pead-search{max-width:none;display:none !important;}
    .pead-pg{flex-direction:column;gap:12px;text-align:center}
    .pead-footer{gap:16px;flex-wrap:wrap;padding:10px 16px}
    .pead-footer span{font-size:9px}
    .pead-dg{grid-template-columns:1fr}
}
@media(min-width:901px){.pead-sbt{display:none!important}}
@media(max-width:480px){
    .pead-content{padding:14px 12px}
    .pead-pt{font-size:22px}
    .pead-sv{font-size:34px}
    .pead-stat{padding:18px 20px}
    .pead-pills{gap:4px}
    .pead-pill{padding:8px 12px;font-size:12px}
    .pead-set-card{padding:20px}
}

/* ── MOBILE OVERLAY ── */
.pead-overlay{display:none;background:rgba(0,0,0,.4);z-index:100000;}
.pead-overlay.show{display:block}
</style>

<!-- LOADING OVERLAY -->
<div class="pead-loader" id="pead-loader">
    <img src="<?php echo esc_url(PE_LOGO_URL); ?>" alt="Loading" class="pead-loader-logo">
    <div class="pead-loader-bar"></div>
    <div class="pead-loader-text">INITIALIZING SYSTEMS</div>
</div>

<!-- MOBILE OVERLAY -->
<div class="pead-overlay" id="pead-overlay" onclick="document.getElementById('pead-sidebar').classList.remove('open');this.classList.remove('show')"></div>

<div class="pead-app" data-theme="light" id="pead-app">
<aside class="pead-sidebar" id="pead-sidebar">
<div class="pead-sb-brand">
    <img src="<?php echo esc_url(PE_LOGO_URL); ?>" alt="PE">
    <div class="sb-info"><h3>Prince Express</h3><p>Command Center</p></div>
</div>
<nav class="pead-sb-nav">
<div class="pead-sb-sec">Navigation</div>
<a class="pead-sb-item active" data-view="dashboard" onclick="sv('dashboard',this)"><i class="fa-solid fa-chart-line"></i> Dashboard</a>
<a class="pead-sb-item" data-view="shipments" onclick="sv('shipments',this)"><i class="fa-solid fa-boxes-stacked"></i> Shipments <span class="ct"><?php echo number_format($ts); ?></span></a>
<a class="pead-sb-item" data-view="rates" onclick="sv('rates',this)"><i class="fa-solid fa-sliders"></i> Rate Customization</a>
<div class="pead-sb-sec" style="margin-top:14px">System</div>
<a class="pead-sb-item" data-view="settings" onclick="sv('settings',this)"><i class="fa-solid fa-gear"></i> Settings</a>
</nav>
<div class="pead-sb-bottom"><a class="pead-sb-link" onclick="doLogout()"><i class="fa-solid fa-right-from-bracket"></i> Sign Out</a></div>
</aside>

<div class="pead-main">
<header class="pead-topbar">
<button class="pead-ticon pead-sbt" onclick="document.getElementById('pead-sidebar').classList.toggle('open');document.getElementById('pead-overlay').classList.toggle('show')"><i class="fa-solid fa-bars"></i></button>
<div class="pead-search"><i class="fa-solid fa-magnifying-glass"></i><input type="text" id="gsearch" placeholder="Search AWB, consignee, date, shipper, destination..." onkeydown="if(event.key==='Enter'){sv('shipments',document.querySelector('[data-view=shipments]'));loadS(1);}"></div>
<div class="pead-topbar-r">
<div class="pead-ticon" onclick="toggleTheme()" title="Toggle Dark/Light Mode"><i class="fa-solid fa-circle-half-stroke"></i></div>
<div class="pead-ticon"><i class="fa-solid fa-bell"></i><span class="pead-ndot"></span></div>
<div class="pead-adm"><div><span class="nm"><?php echo esc_html(ucfirst($admin['uname'])); ?></span><br><span class="rl">Administrator</span></div></div>
<div class="pead-av"><?php echo strtoupper(substr($admin['uname'],0,1)); ?></div>
</div>
</header>

<div class="pead-content">
<!-- DASHBOARD -->
<div class="pead-view active" id="view-dashboard">
<h1 class="pead-pt">Shipment Telemetry</h1><p class="pead-ps">Real-time oversight of global freight movements.</p>
<div class="pead-stats">
<div class="pead-stat"><div><div class="pead-sl">Live Shipments</div><div class="pead-sv"><?php echo number_format($ts); ?></div><div class="pead-sc g"><?php echo number_format($ts-$dc); ?> active</div></div><div class="pead-si"><i class="fa-solid fa-signal"></i></div></div>
<div class="pead-stat"><div><div class="pead-sl">Critical Alerts</div><div class="pead-sv"><?php echo str_pad($ac,2,'0',STR_PAD_LEFT); ?></div><div class="pead-sc w">Requires attention</div></div><div class="pead-si"><i class="fa-solid fa-triangle-exclamation"></i></div></div>
<div class="pead-stat"><div><div class="pead-sl">Avg. Transit Time</div><div class="pead-sv"><?php echo esc_html($ad); ?> <span style="font-size:16px;font-weight:600;color:var(--text3)">Days</span></div><div class="pead-sc b">Optimized</div></div><div class="pead-si"><i class="fa-solid fa-clock"></i></div></div>
</div>
<div id="sc1"></div>
</div>

<!-- SHIPMENTS -->
<div class="pead-view" id="view-shipments"><h1 class="pead-pt">All Shipments</h1><p class="pead-ps">Browse, search, filter all shipment records.</p><div id="sc2"></div></div>

<!-- RATES -->
<div class="pead-view" id="view-rates"><h1 class="pead-pt">Rate Customization</h1><p class="pead-ps">View and edit shipping rates per country. Use the Edit button to modify rates.</p><div id="rc"></div></div>

<!-- SETTINGS -->
<div class="pead-view" id="view-settings">
<h1 class="pead-pt">Settings</h1><p class="pead-ps">Manage your account, security, and preferences.</p>
<div class="pead-set-card"><h3><i class="fa-solid fa-palette"></i> Appearance</h3>
<p style="font-size:14px;color:var(--text2);margin:0 0 14px;">Toggle between light and dark mode using the <i class="fa-solid fa-circle-half-stroke" style="font-size:13px;"></i> button in the top bar.</p>
</div>
<div class="pead-set-card"><h3><i class="fa-solid fa-key"></i> Change Password</h3>
<div class="pead-set-msg" id="pwd-msg"></div>
<form onsubmit="return changePwd(event)">
<div class="pead-sfg"><label>Current Password</label><input type="password" id="old-pwd" required></div>
<div class="pead-sfg"><label>New Password (min 8 chars, 1 uppercase, 1 number)</label><input type="password" id="new-pwd" required minlength="8"></div>
<button type="submit" class="pead-btn pead-btn-r" style="margin-top:4px;"><i class="fa-solid fa-check"></i> Update Password</button>
</form>
</div>
<div class="pead-set-card"><h3><i class="fa-solid fa-shield-halved"></i> Security Info</h3>
<div class="pead-dg" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
<div class="pead-df"><div class="l">Logged In As</div><div class="v"><?php echo esc_html($admin['uname']); ?></div></div>
<div class="pead-df"><div class="l">Session Started</div><div class="v"><?php echo date('M d, Y h:i A', $admin['login_at'] ?? time()); ?></div></div>
<div class="pead-df"><div class="l">IP Address</div><div class="v m"><?php echo esc_html($admin['ip'] ?? $_SERVER['REMOTE_ADDR']); ?></div></div>
<div class="pead-df"><div class="l">Session Timeout</div><div class="v">Active until browser close</div></div>
</div>
</div>

</div>
</div>

<footer class="pead-footer">
<span><span class="dg"></span> Global Ops: Normal</span>
<span><i class="fa-solid fa-clock" style="font-size:9px"></i> Last Updated: Just Now</span>
<span><img src="<?php echo esc_url(PE_LOGO_URL); ?>" alt="" style="width:14px;height:14px;border-radius:3px"> Secure Protocol V3.0</span>
</footer>
</div>
</div>

<div class="pead-do" id="pead-do" onclick="if(event.target===this)closeD()"><div class="pead-dp" id="pead-dp"></div></div>

<!-- OTP Modal for Password Change -->
<div class="pead-otp-modal" id="pwd-otp-modal">
<div class="pead-otp-modal-card">
<h3><i class="fa-solid fa-shield-halved"></i> Verify OTP</h3>
<p class="otp-desc">A <strong>6-digit code</strong> has been sent to your registered email. Enter it to confirm your password change.</p>
<div class="pead-otp-msg" id="pwd-otp-msg"></div>
<div class="pead-otp-modal-inputs" id="pwd-otp-inputs">
<input type="text" maxlength="1" inputmode="numeric" data-idx="0">
<input type="text" maxlength="1" inputmode="numeric" data-idx="1">
<input type="text" maxlength="1" inputmode="numeric" data-idx="2">
<input type="text" maxlength="1" inputmode="numeric" data-idx="3">
<input type="text" maxlength="1" inputmode="numeric" data-idx="4">
<input type="text" maxlength="1" inputmode="numeric" data-idx="5">
</div>
<div class="pead-otp-modal-timer">Code expires in <strong id="pwd-otp-countdown">5:00</strong></div>
<div class="pead-otp-modal-actions">
<button class="pead-btn" onclick="closePwdOtpModal()"><i class="fa-solid fa-xmark"></i> Cancel</button>
<button class="pead-btn pead-btn-r" id="pwd-otp-verify" onclick="verifyPwdOtp()"><i class="fa-solid fa-check"></i> Verify & Update</button>
</div>
</div>
</div>

<script>
var pg=1,qs='',st='',tg='sc1';
var SN={'0':'Standard','5':'Premium','1001':'Sain Express','1007':'PE Global','1008':'Pace Group','1009':'Sairaj','1019':'FlySwift'};
var SC={'0':'b0','5':'b5','1007':'b1007'};

/* ── Loading Overlay ── */
function hideLoader(){
    var l=document.getElementById('pead-loader');
    if(l){l.classList.add('hidden');setTimeout(function(){l.style.display='none';},500);}
    var app=document.getElementById('pead-app');
    if(app)app.classList.add('loaded');
}

/* ── Theme toggle ── */
function toggleTheme(){
    var app=document.querySelector('.pead-app');
    var t=app.getAttribute('data-theme')==='dark'?'light':'dark';
    app.setAttribute('data-theme',t);
    localStorage.setItem('pe_theme',t);
}
(function(){var t=localStorage.getItem('pe_theme');if(t){document.addEventListener('DOMContentLoaded',function(){var a=document.querySelector('.pead-app');if(a)a.setAttribute('data-theme',t);});}})();

/* ── AJAX helper ── */
function peajax(action,params,callback,retried){
    var fd=new FormData();fd.append('action',action);fd.append('nonce',PE_AD.nonce);
    if(params){for(var k in params){if(params.hasOwnProperty(k))fd.append(k,params[k]);}}
    fetch(PE_AD.ajax_url,{method:'POST',body:fd,credentials:'same-origin'})
    .then(function(r){return r.json();})
    .then(function(d){
        if(!d.success&&d.data){
            if(d.data.nonce_expired&&d.data.new_nonce&&!retried){PE_AD.nonce=d.data.new_nonce;return peajax(action,params,callback,true);}
            if(d.data.expired){location.reload();return;}
        }
        if(callback)callback(d);
    }).catch(function(err){console.error('AJAX error:',action,err);});
}

/* ── View Switcher ── */
function sv(v,el){
    document.querySelectorAll('.pead-view').forEach(function(x){x.classList.remove('active');});
    document.querySelectorAll('.pead-sb-item').forEach(function(x){x.classList.remove('active');});
    document.getElementById('view-'+v).classList.add('active');
    if(el)el.classList.add('active');
    document.getElementById('pead-sidebar').classList.remove('open');
    document.getElementById('pead-overlay').classList.remove('show');
    if(v==='dashboard'||v==='shipments'){tg=v==='dashboard'?'sc1':'sc2';loadS(1);}
    if(v==='rates')loadR();

}

/* ── Skeleton Loader ── */
function skeleton(rows){
    var h='<div class="pead-tc"><div class="pead-th"><h3><i class="fa-solid fa-layer-group"></i> Loading... </h3></div><div class="pead-tw"><table class="pead-t"><tbody>';
    for(var i=0;i<(rows||5);i++){h+='<tr><td colspan="10" style="padding:20px 16px"><div class="pead-skeleton" style="width:'+(60+Math.random()*30)+'%;height:16px"></div></td></tr>';}
    h+='</tbody></table></div></div>';return h;
}

/* ── Status dot helper ── */
function getStatusDot(st){
    if(!st)return {dot:'db',label:'Booked'};
    var s=st.toLowerCase();
    if(s.indexOf('deliver')>=0) return {dot:'dd',label:'Delivered'};
    if(s.indexOf('transit')>=0||s.indexOf('depart')>=0||s.indexOf('dispatch')>=0) return {dot:'dt',label:'In Transit'};
    if(s.indexOf('customs')>=0||s.indexOf('clear')>=0) return {dot:'dbl',label:'Customs'};
    if(s.indexOf('out for')>=0) return {dot:'dof',label:'Out for Delivery'};
    if(s.indexOf('arrived')>=0) return {dot:'dt',label:'Arrived'};
    if(s.indexOf('book')>=0||s.indexOf('received')>=0) return {dot:'db',label:'Booked'};
    return {dot:'dt',label:st.length>20?st.substring(0,20)+'…':st};
}

/* ── Load Shipments ── */
function loadS(p){
    pg=p||1;qs=document.getElementById('gsearch').value;
    document.getElementById(tg).innerHTML=skeleton(6);
    peajax('pe_admin_shipments',{page:pg,search:qs,status:st},function(d){
        if(!d.success)return;
        var r=d.data,cn=r.counts||{},h='';
        h+='<div class="pead-fb"><div class="pead-fs"><i class="fa-solid fa-magnifying-glass"></i><input type="text" id="tsearch" placeholder="Search AWB, consignee, date, shipper, destination..." value="'+qs.replace(/"/g,'&quot;')+'" onkeydown="if(event.key===\'Enter\'){document.getElementById(\'gsearch\').value=this.value;loadS(1);}"></div>';
        h+='<div class="pead-pills">';
        h+=pill('','All',cn.all)+pill('transit','In Transit',cn.transit)+pill('delivered','Delivered',cn.delivered)+pill('booked','Booked',cn.booked);
        h+='</div><div class="pead-fa"><button class="pead-btn" onclick="doExport()"><i class="fa-solid fa-download"></i> Export</button></div></div>';
        h+='<div class="pead-tc"><div class="pead-th"><h3><i class="fa-solid fa-layer-group"></i> Active Inventory <span class="tb">'+r.total+'</span></h3></div>';
        h+='<div class="pead-tw"><table class="pead-t"><thead><tr><th>AWB</th><th>Date</th><th>Shipper</th><th>Consignee</th><th>Destination</th><th>Vendor</th><th>Vendor AWB</th><th>Weight</th><th>Status</th></tr></thead><tbody>';
        if(!r.rows.length)h+='<tr><td colspan="10" style="text-align:center;padding:50px;color:var(--text3)"><i class="fa-solid fa-inbox" style="font-size:28px;display:block;margin-bottom:10px;opacity:.2"></i>No shipments found</td></tr>';
        r.rows.forEach(function(rw){
            var stDot=getStatusDot(rw.status);
            h+='<tr data-awb="'+rw.awb+'" onclick="showD(\''+rw.awb+'\')">'; 
            // h+='<td class="idc">#PRN-'+rw.c_id+'</td>';
            h+='<td class="awbc">'+rw.awb+'</td>';
            h+='<td style="font-weight:600;color:var(--text2)">'+(rw.booking_date||'—')+'</td>';
            h+='<td class="nmc">'+(rw.shipper||'—')+'</td>';
            h+='<td class="nmc">'+rw.consignee+'</td>';
            h+='<td><i class="fa-solid fa-location-dot" style="color:var(--text3);font-size:10px;margin-right:4px"></i>'+rw.destination+'</td>';
            h+='<td style="font-size:12px;color:var(--text3)">'+(rw.vendor||'—')+'</td>';
            h+='<td style="font-size:12px;font-family:Courier New,monospace;color:var(--text2)">'+(rw.vendor_awb1||'—')+'</td>';
            h+='<td style="font-weight:600">'+(rw.weight||'—')+' kg</td>';
            h+='<td class="status-cell" id="st-'+rw.awb+'"><div class="pead-st"><span class="pead-dot '+stDot.dot+'"></span>'+stDot.label+'</div></td></tr>';
        });
        h+='</tbody></table></div>';
        h+='<div class="pead-pg"><div class="pead-pi">Showing <strong>'+r.rows.length+'</strong> of <strong>'+r.total+'</strong> · Page '+r.page+'/'+r.pages+'</div><div class="pead-pbs">';
        h+='<button class="pead-pb" onclick="loadS('+(r.page-1)+')" '+(r.page<=1?'disabled':'')+'><i class="fa-solid fa-chevron-left" style="font-size:11px"></i></button>';
        for(var i=Math.max(1,r.page-2);i<=Math.min(r.pages,r.page+2);i++)h+='<button class="pead-pb'+(i===r.page?' on':'')+'" onclick="loadS('+i+')">'+i+'</button>';
        h+='<button class="pead-pb" onclick="loadS('+(r.page+1)+')" '+(r.page>=r.pages?'disabled':'')+'><i class="fa-solid fa-chevron-right" style="font-size:11px"></i></button>';
        h+='</div></div></div>';
        document.getElementById(tg).innerHTML=h;
        var o=tg==='sc1'?'sc2':'sc1';document.getElementById(o).innerHTML=h;
        // Batch-sync live vendor statuses for all visible rows
        batchSyncStatus(r.rows);
    });
}
function pill(v,l,c){return '<button class="pead-pill'+(st===v?' on':'')+'" onclick="st=\''+v+'\';loadS(1);">'+l+(c!==undefined?' <span class="n">'+c+'</span>':'')+'</button>';}

/* ── Batch Status Sync (auto-fetch live statuses for visible rows) ── */
function batchSyncStatus(rows){
    if(!rows||!rows.length)return;
    // Send ALL visible AWBs to the server — server determines staleness and fetches live vendor status
    var allAwbs=[];
    rows.forEach(function(rw){ allAwbs.push(rw.awb); });
    if(!allAwbs.length)return;
    // Call batch sync endpoint
    peajax('pe_admin_batch_sync_status',{awbs:allAwbs.join(',')},function(d){
        if(!d.success||!d.data||!d.data.statuses)return;
        var statuses=d.data.statuses;
        for(var awb in statuses){
            if(!statuses.hasOwnProperty(awb))continue;
            var newStatus=statuses[awb];
            var stDot=getStatusDot(newStatus);
            // Update status cell in both sc1 and sc2 containers
            var cells=document.querySelectorAll('#st-'+awb);
            cells.forEach(function(cell){
                var oldHtml=cell.innerHTML;
                var newHtml='<div class="pead-st"><span class="pead-dot '+stDot.dot+'"></span>'+stDot.label+'</div>';
                // Only flash if status actually changed
                if(oldHtml!==newHtml){
                    cell.innerHTML=newHtml;
                    cell.style.transition='background .3s';
                    cell.style.background='rgba(34,197,94,.08)';
                    setTimeout(function(){cell.style.background='';},1500);
                }
            });
        }
    });
}

/* ── Shipment Detail with Progress Bar & Enhanced Timeline ── */
function showD(awb){
    document.getElementById('pead-do').classList.add('show');
    document.getElementById('pead-dp').innerHTML='<div style="padding:80px;text-align:center;color:var(--text3)"><i class="fa-solid fa-circle-notch fa-spin" style="font-size:32px;color:var(--red)"></i><p style="margin-top:16px;font-size:15px;font-weight:600">Loading shipment data...</p></div>';
    peajax('pe_admin_shipment_detail',{awb:awb},function(d){
        if(!d.success){closeD();return;}
        var c=d.data.consignee,tr=d.data.tracking;
        var st=(c.STATUS||'').toLowerCase(),stg=0;
        if(st.indexOf('book')>=0||st.indexOf('received')>=0||st==='')stg=0;
        else if(st.indexOf('transit')>=0||st.indexOf('depart')>=0||st.indexOf('dispatch')>=0)stg=1;
        else if(st.indexOf('customs')>=0||st.indexOf('clear')>=0)stg=2;
        else if(st.indexOf('deliver')>=0)stg=3;
        else stg=0;

        var h='<div class="pead-dh"><h3><i class="fa-solid fa-box"></i> AWB #'+(c.AWBNO||'')+'</h3><button class="pead-dc" onclick="closeD()"><i class="fa-solid fa-xmark"></i></button></div><div class="pead-db">';
        // Progress bar
        var steps=['Booked','In Transit','Customs','Delivered'],h2='<div class="pead-progress">';
        for(var i=0;i<steps.length;i++){
            var cls=i<stg?'done':(i===stg?'current':'');
            var icon=i<stg?'<i class="fa-solid fa-check" style="font-size:10px"></i>':''+(i+1);
            h2+='<div class="pead-progress-step '+cls+'"><div class="dot">'+icon+'</div><div class="lbl">'+steps[i]+'</div></div>';
            if(i<steps.length-1)h2+='<div class="pead-progress-line'+(i<stg?' done':'')+'"></div>';
        }
        h2+='</div>';h+=h2;

        // 1. Customer Details (Booking Info)
        h+=sec('fa-clipboard-list','Customer Details')+grd([f('Booking Date',c.BOOKINGDATE||'\u2014'),f('Customer',c.customer||'\u2014'),f('Customer Code',c.CUSTCODE||'\u2014'),f('Origin',c.origin||'\u2014'),f('Status',c.STATUS||'Booked'),f('Delivery Date',c.DELIVERYDATE||'Awaiting'),f('Receiver',c.RECEIVER||'\u2014'),f('Forwarding',c.SHOWFWD?'ON':'OFF')])+'</div>';

        // 2. Shipper Details
        var saddr=[c.SADDRESS1,c.SADDRESS2,c.SADDRESS3].filter(Boolean).join(', ');
        h+=sec('fa-building','Shipper Details')+grd([f('Shipper Name',c.SNAME||'\u2014'),f('Phone 1',c.SPHONE1||'\u2014'),f('Phone 2',c.SPHONE2||'\u2014'),f('Address',saddr||'\u2014','',1),f('City',c.SCITY||'\u2014'),f('Pincode',c.SPINCODE||'\u2014')])+'</div>';

        // 3. Consignee Details
        h+=sec('fa-user','Consignee Details')+grd([f('Consignee Name',c.CONSIGNEE),f('Destination',c.DESTINATION)])+'</div>';

        // 4. Consignee Contact & Address
        var addr=[c.consignee_address1,c.consignee_address2,c.consignee_address3,c.consignee_address4].filter(Boolean).join(', ');
        h+=sec('fa-map-pin','Consignee Contact & Address')+grd([f('Phone 1',c.PHONE||'\u2014'),f('Phone 2',c.PHONE2||'\u2014'),f('Address',addr||'\u2014','',1),f('City',c.consignee_city||'\u2014'),f('Pincode',c.consignee_pincode||'\u2014'),f('Country',c.consignee_country||'\u2014')])+'</div>';

        // 5. Vendor & Product Details
        h+=sec('fa-tags','Vendor & Product Details')+grd([f('Vendor AWB 1',c.VENDORID1||'\u2014','m'),f('Vendor AWB 2',c.VENDORID2||'\u2014','m'),f('Vendor Code',c.VENDCODE||'\u2014'),f('Vendor Name',c.VENDNAME||'\u2014'),f('Dest Code',c.DESTCODE||'\u2014'),f('Prod Code',c.PRODCODE||'\u2014'),f('Product Name',c.PRODNAME||'\u2014'),f('Forwarding',c.SHOWFWD?'ON':'OFF')])+'</div>';

        // 5. Package Details
        h+=sec('fa-box-open','Package Details')+grd([f('Charge Weight',c.WEIGHT?(c.WEIGHT+' kg'):'\u2014'),f('Actual Weight',c.ACTUALWEIGHT?(c.ACTUALWEIGHT+' kg'):'\u2014'),f('Pieces / Cartons',c.pcs||'\u2014'),f('Payment Type',c.PAYMENTTYPE||'\u2014')])+'</div>';

        // 6. Tracking History
        if(tr&&tr.length){
            h+=sec('fa-route','Tracking History \u2014 '+tr.length+' events');
            h+='<ul class="pead-tl">';
            tr.forEach(function(t,idx){
                var icon='fa-circle-dot',acl=t.activity?t.activity.toLowerCase():'';
                if(acl.indexOf('deliver')>=0)icon='fa-circle-check';
                else if(acl.indexOf('transit')>=0||acl.indexOf('depart')>=0)icon='fa-truck';
                else if(acl.indexOf('customs')>=0||acl.indexOf('clear')>=0)icon='fa-shield-halved';
                else if(acl.indexOf('book')>=0||acl.indexOf('received')>=0)icon='fa-box';
                else if(acl.indexOf('arrived')>=0)icon='fa-plane-arrival';
                h+='<li style="animation-delay:'+(.05*idx)+'s"><div class="pead-tl-card"><div class="pead-tla"><i class="fa-solid '+icon+'"></i> '+(t.activity||'\u2014')+'</div><div class="pead-tlm"><i class="fa-regular fa-calendar"></i> '+(t.date||'')+'  <i class="fa-regular fa-clock"></i> '+(t.time||'')+'  <i class="fa-solid fa-location-dot"></i> '+(t.location||'\u2014')+'</div></div></li>';
            });
            h+='</ul></div>';
        } else if(!tr||!tr.length){
            h+=sec('fa-route','Tracking History')+'<div class="pead-tl-empty"><i class="fa-solid fa-satellite-dish"></i><p style="font-size:15px;font-weight:600;margin:0">No tracking events recorded yet</p></div></div>';
        }
        h+='</div>';document.getElementById('pead-dp').innerHTML=h;
    });
}
function sec(i,t){return '<div class="pead-ds"><h4><i class="fa-solid '+i+'"></i> '+t+'</h4>';}
function grd(a){return '<div class="pead-dg">'+a.join('')+'</div>';}
function f(l,v,c,fl){return '<div class="pead-df'+(fl?' fl':'')+'"><div class="l">'+l+'</div><div class="v'+(c?' '+c:'')+'">'+(v||'—')+'</div></div>';}
function closeD(){document.getElementById('pead-do').classList.remove('show');}

/* ── Export ── */
function doExport(){
    peajax('pe_admin_export',{search:qs},function(d){
        if(!d.success||!d.data.rows.length)return;var rows=d.data.rows,csv=Object.keys(rows[0]).join(',')+'\n';
        rows.forEach(function(r){csv+=Object.values(r).map(function(v){return '"'+(v||'')+'"';}).join(',')+'\n';});
        var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='shipments_'+Date.now()+'.csv';a.click();
    });
}

/* ── Rates (edit-by-button) ── */
var rateWC=['gm500','kg1','kg1_5','kg2','kg2_5','kg3','kg3_5','kg4','kg4_5','kg5','kg5_5','kg6','kg7_10','kg11_16','kg17_20','kg21_30','kg31_50','kg51_70','kg100p'];
var rateWL=['500g','1kg','1.5','2kg','2.5','3kg','3.5','4kg','4.5','5kg','5.5','6kg','7-10','11-16','17-20','21-30','31-50','51-70','100+'];
var rateData={}; // Store original values for cancel

function loadR(country){
    peajax('pe_admin_rates',country?{country:country}:{},function(d){
        if(!d.success)return;var cs=d.data.countries,rows=d.data.rows;
        var h='<div class="pead-rtop"><div class="pead-rsel"><select id="rcountry" onchange="loadR(this.value)"><option value="">— Select Country —</option>';
        cs.forEach(function(c){h+='<option value="'+c+'"'+(c===country?' selected':'')+'>'+c.toUpperCase()+'</option>';});
        h+='</select></div>';
        if(country){h+='<div class="pead-rinfo"><strong>'+rows.length+'</strong> tiers for <strong>'+country.toUpperCase()+'</strong></div><div style="margin-left:auto"><button class="pead-btn pead-btn-r" onclick="addRate()"><i class="fa-solid fa-plus"></i> Add Service</button></div>';}
        h+='</div>';
        if(!country||!rows.length){h+='<div class="pead-rc"><div class="pead-rem"><i class="fa-solid fa-globe"></i><p>'+(country?'No rates for '+country:'Select a country to manage rates')+'</p></div></div>';}
        else{
            h+='<div class="pead-rc"><div class="pead-rch"><h3><i class="fa-solid fa-table-cells"></i> Rate Matrix — '+country.toUpperCase()+'</h3></div>';
            h+='<div class="pead-rscroll"><table class="pead-rt"><thead><tr><th style="min-width:100px">Service</th><th style="min-width:100px">Days</th>';
            rateWL.forEach(function(l){h+='<th>'+l+'</th>';});
            h+='<th style="min-width:140px;text-align:center">Actions</th></tr></thead><tbody>';
            rows.forEach(function(rw){
                rateData[rw.Rid]=JSON.parse(JSON.stringify(rw)); // Store originals
                h+='<tr id="rrow-'+rw.Rid+'">';
                h+='<td class="rate-val" id="rv-'+rw.Rid+'-service">'+(rw.service||'—')+'</td>';
                h+='<td class="rate-val" id="rv-'+rw.Rid+'-days">'+(rw.days||'—')+'</td>';
                rateWC.forEach(function(c){
                    h+='<td class="rate-val" id="rv-'+rw.Rid+'-'+c+'">'+(rw[c]||'—')+'</td>';
                });
                h+='<td><div class="pead-ract" id="ract-'+rw.Rid+'">';
                h+='<button class="pead-ract-btn edit" onclick="editRateRow('+rw.Rid+')"><i class="fa-solid fa-pen"></i> Edit</button>';
                h+='<button class="pead-ract-btn del" onclick="delRate('+rw.Rid+')"><i class="fa-solid fa-trash-can"></i> Delete</button>';
                h+='</div></td></tr>';
            });
            h+='</tbody></table></div></div>';
        }
        document.getElementById('rc').innerHTML=h;
    });
}

function editRateRow(rid){
    var row=document.getElementById('rrow-'+rid);
    if(!row)return;
    row.classList.add('editing');
    var data=rateData[rid]||{};
    // Service & Days
    var svcEl=document.getElementById('rv-'+rid+'-service');
    svcEl.innerHTML='<input class="ri riw" id="ri-'+rid+'-service" value="'+(data.service||'').toString().replace(/"/g,'&quot;')+'">';
    var daysEl=document.getElementById('rv-'+rid+'-days');
    daysEl.innerHTML='<input class="ri riw" id="ri-'+rid+'-days" value="'+(data.days||'').toString().replace(/"/g,'&quot;')+'">';
    // Weight columns
    rateWC.forEach(function(c){
        var el=document.getElementById('rv-'+rid+'-'+c);
        el.innerHTML='<input class="ri" id="ri-'+rid+'-'+c+'" value="'+(data[c]||'').toString().replace(/"/g,'&quot;')+'">';
    });
    // Swap action buttons to Save/Cancel
    var actEl=document.getElementById('ract-'+rid);
    actEl.innerHTML='<button class="pead-ract-btn save" onclick="saveRateRow('+rid+')"><i class="fa-solid fa-check"></i> Save</button><button class="pead-ract-btn cancel" onclick="cancelRateRow('+rid+')"><i class="fa-solid fa-xmark"></i> Cancel</button>';
    // Focus first input
    var firstInp=document.getElementById('ri-'+rid+'-service');
    if(firstInp)firstInp.focus();
}

function cancelRateRow(rid){
    var data=rateData[rid]||{};
    var row=document.getElementById('rrow-'+rid);
    if(row)row.classList.remove('editing');
    // Restore display values
    var svcEl=document.getElementById('rv-'+rid+'-service');
    svcEl.textContent=data.service||'—';
    var daysEl=document.getElementById('rv-'+rid+'-days');
    daysEl.textContent=data.days||'—';
    rateWC.forEach(function(c){
        var el=document.getElementById('rv-'+rid+'-'+c);
        el.textContent=data[c]||'—';
    });
    // Restore action buttons
    var actEl=document.getElementById('ract-'+rid);
    actEl.innerHTML='<button class="pead-ract-btn edit" onclick="editRateRow('+rid+')"><i class="fa-solid fa-pen"></i> Edit</button><button class="pead-ract-btn del" onclick="delRate('+rid+')"><i class="fa-solid fa-trash-can"></i> Delete</button>';
}

function saveRateRow(rid){
    var params={rid:rid};
    var svcInp=document.getElementById('ri-'+rid+'-service');
    var daysInp=document.getElementById('ri-'+rid+'-days');
    if(svcInp)params.service=svcInp.value;
    if(daysInp)params.days=daysInp.value;
    rateWC.forEach(function(c){
        var inp=document.getElementById('ri-'+rid+'-'+c);
        if(inp)params[c]=inp.value;
    });
    // Save entire row via bulk endpoint
    peajax('pe_admin_rate_save_row',params,function(d){
        if(d.success){
            // Update stored data
            if(!rateData[rid])rateData[rid]={};
            for(var k in params){if(k!=='rid')rateData[rid][k]=params[k];}
            var row=document.getElementById('rrow-'+rid);
            if(row)row.classList.remove('editing');
            // Switch back to display mode with updated values
            var svcEl=document.getElementById('rv-'+rid+'-service');
            svcEl.textContent=params.service||'—';
            var daysEl=document.getElementById('rv-'+rid+'-days');
            daysEl.textContent=params.days||'—';
            rateWC.forEach(function(c){
                var el=document.getElementById('rv-'+rid+'-'+c);
                el.textContent=params[c]||'—';
            });
            // Restore action buttons
            var actEl=document.getElementById('ract-'+rid);
            actEl.innerHTML='<button class="pead-ract-btn edit" onclick="editRateRow('+rid+')"><i class="fa-solid fa-pen"></i> Edit</button><button class="pead-ract-btn del" onclick="delRate('+rid+')"><i class="fa-solid fa-trash-can"></i> Delete</button>';
            // Flash green on row
            if(row){row.style.background='rgba(34,197,94,.08)';setTimeout(function(){row.style.background='';},800);}
        } else {
            alert(d.data&&d.data.message?d.data.message:'Failed to save rate');
        }
    });
}

function addRate(){var c=document.getElementById('rcountry').value,s=prompt('Service name:');if(!s)return;peajax('pe_admin_rate_add',{country:c,service:s},function(){loadR(c);});}
function delRate(rid){if(!confirm('Delete this rate row?'))return;var c=document.getElementById('rcountry').value;peajax('pe_admin_rate_delete',{rid:rid},function(){loadR(c);});}

/* ── Password Change (2-step with OTP) ── */
var pwdOtpTimer=null;
function changePwd(e){e.preventDefault();
    var msg=document.getElementById('pwd-msg');msg.className='pead-set-msg';msg.style.display='none';
    // Step 1: Validate credentials and send OTP
    peajax('pe_admin_pwd_init',{old_pwd:document.getElementById('old-pwd').value,new_pwd:document.getElementById('new-pwd').value},function(d){
        if(!d.success){
            msg.textContent=d.data.message||'Error';msg.className='pead-set-msg no';msg.style.display='block';
            return;
        }
        // If device remembered, OTP is skipped
        if(d.data.skip_otp){
            msg.textContent=d.data.message||'Password updated!';msg.className='pead-set-msg ok';msg.style.display='block';
            document.getElementById('old-pwd').value='';document.getElementById('new-pwd').value='';
            return;
        }
        // Show OTP modal
        if(d.data.require_otp){
            msg.textContent='OTP sent to your email. Please verify.';msg.className='pead-set-msg ok';msg.style.display='block';
            openPwdOtpModal();
        }
    });
    return false;
}

function openPwdOtpModal(){
    document.getElementById('pwd-otp-modal').classList.add('show');
    var inputs=document.querySelectorAll('#pwd-otp-inputs input');
    inputs.forEach(function(inp){inp.value='';inp.classList.remove('filled');});
    inputs[0].focus();
    document.getElementById('pwd-otp-msg').className='pead-otp-msg';
    document.getElementById('pwd-otp-msg').style.display='none';
    // Setup OTP input navigation
    inputs.forEach(function(inp,idx){
        inp.oninput=function(){
            var v=inp.value.replace(/[^0-9]/g,'');inp.value=v;
            if(v){inp.classList.add('filled');if(idx<5)inputs[idx+1].focus();}
            else{inp.classList.remove('filled');}
        };
        inp.onkeydown=function(e){
            if(e.key==='Backspace'&&!inp.value&&idx>0){inputs[idx-1].focus();inputs[idx-1].value='';inputs[idx-1].classList.remove('filled');}
            if(e.key==='Enter')verifyPwdOtp();
        };
        inp.onpaste=function(e){
            e.preventDefault();
            var p=(e.clipboardData||window.clipboardData).getData('text').replace(/[^0-9]/g,'');
            for(var i=0;i<6&&i<p.length;i++){inputs[i].value=p[i];inputs[i].classList.add('filled');}
            if(p.length>=6)inputs[5].focus();
        };
    });
    // Start countdown
    var rem=300;
    var cdEl=document.getElementById('pwd-otp-countdown');
    if(pwdOtpTimer)clearInterval(pwdOtpTimer);
    pwdOtpTimer=setInterval(function(){
        rem--;if(rem<=0){clearInterval(pwdOtpTimer);cdEl.textContent='Expired';cdEl.style.color='var(--red2)';return;}
        var m=Math.floor(rem/60),s=rem%60;
        cdEl.textContent=m+':'+(s<10?'0':'')+s;
    },1000);
}

function closePwdOtpModal(){
    document.getElementById('pwd-otp-modal').classList.remove('show');
    if(pwdOtpTimer)clearInterval(pwdOtpTimer);
}

function verifyPwdOtp(){
    var inputs=document.querySelectorAll('#pwd-otp-inputs input');
    var otp='';inputs.forEach(function(i){otp+=i.value;});
    if(otp.length!==6){showPwdOtpMsg('Please enter the full 6-digit code','no');return;}
    var btn=document.getElementById('pwd-otp-verify');
    btn.disabled=true;btn.innerHTML='<i class="fa-solid fa-circle-notch fa-spin"></i> Verifying...';
    peajax('pe_admin_change_password',{otp:otp},function(d){
        btn.disabled=false;btn.innerHTML='<i class="fa-solid fa-check"></i> Verify & Update';
        if(d.success){
            showPwdOtpMsg(d.data.message||'Password updated!','ok');
            setTimeout(function(){
                closePwdOtpModal();
                var msg=document.getElementById('pwd-msg');
                msg.textContent='Password updated successfully';msg.className='pead-set-msg ok';msg.style.display='block';
                document.getElementById('old-pwd').value='';document.getElementById('new-pwd').value='';
            },1200);
        } else {
            showPwdOtpMsg(d.data.message||'Invalid OTP','no');
            inputs.forEach(function(i){i.value='';i.classList.remove('filled');});
            inputs[0].focus();
        }
    });
}

function showPwdOtpMsg(text,type){
    var el=document.getElementById('pwd-otp-msg');
    el.textContent=text;el.className='pead-otp-msg '+type;el.style.display='block';
}

/* ── Logout ── */
function doLogout(){peajax('pe_admin_logout',{},function(){location.reload();});}

/* ── Session Heartbeat (keeps session alive while tab is open) ── */
function peHeartbeat(){
    var fd=new FormData();
    fd.append('action','pe_admin_heartbeat');
    fd.append('nonce',PE_AD.nonce);
    fetch(PE_AD.ajax_url,{method:'POST',body:fd,credentials:'same-origin'})
    .then(function(r){return r.json();})
    .then(function(d){
        if(!d.success && d.data && d.data.expired){
            // Session expired server-side, redirect to login
            location.reload();
        }
    }).catch(function(){});
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded',function(){
    loadS(1);
    setTimeout(hideLoader,1200);
    // Start heartbeat — ping every 30 seconds
    peHeartbeat();
    setInterval(peHeartbeat, 30000);
});
</script>
