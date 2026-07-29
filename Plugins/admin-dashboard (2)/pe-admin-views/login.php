<?php if (!defined('ABSPATH')) exit; ?>
<style>
#wpadminbar{display:none!important}html{margin-top:0!important}
*,*::before,*::after{box-sizing:border-box}

/* ── LOGIN ANIMATIONS ── */
@keyframes pe-spin{to{transform:rotate(360deg)}}
@keyframes pe-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes pe-fadeUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
@keyframes pe-fadeIn{from{opacity:0}to{opacity:1}}
@keyframes pe-slideRight{from{opacity:0;transform:translateX(-40px)}to{opacity:1;transform:translateX(0)}}
@keyframes pe-pulse{0%,100%{opacity:.6}50%{opacity:1}}
@keyframes pe-glow{0%,100%{box-shadow:0 0 20px rgba(187,0,19,.15)}50%{box-shadow:0 0 40px rgba(187,0,19,.3)}}
@keyframes pe-scanline{0%{top:-100%}100%{top:200%}}
@keyframes pe-gridMove{0%{background-position:0 0}100%{background-position:50px 50px}}

.pead-login-wrap{position:fixed;inset:0;z-index:99999;display:flex;font-family:'Inter',-apple-system,sans-serif;background:#eef2f7;overflow:hidden}

/* ── LEFT PANEL ── */
.pead-login-left{flex:0 0 50%;background:linear-gradient(145deg,#000 0%,#0a1020 50%,#060d1a 100%);display:flex;flex-direction:column;justify-content:center;padding:64px 72px;position:relative;overflow:hidden}
.pead-login-left::before{content:'';position:absolute;top:-120px;right:-80px;width:600px;height:600px;background:radial-gradient(circle,rgba(187,0,19,.1),transparent 70%);pointer-events:none;animation:pe-float 6s ease infinite}
.pead-login-left::after{content:'';position:absolute;bottom:-80px;left:-60px;width:400px;height:400px;background:radial-gradient(circle,rgba(187,0,19,.06),transparent 70%);pointer-events:none;animation:pe-float 8s ease infinite 1s}
/* Grid pattern overlay */
.pead-login-left .grid-overlay{position:absolute;inset:0;background-image:linear-gradient(rgba(187,0,19,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(187,0,19,.03) 1px,transparent 1px);background-size:50px 50px;animation:pe-gridMove 20s linear infinite;pointer-events:none}
/* Scanline effect */
.pead-login-left .scanline{position:absolute;left:0;right:0;height:100px;background:linear-gradient(transparent,rgba(187,0,19,.03),transparent);animation:pe-scanline 6s linear infinite;pointer-events:none}

.pead-brand{display:flex;align-items:center;gap:16px;margin-bottom:52px;position:relative;z-index:1;animation:pe-slideRight .6s ease .1s both}
.pead-brand-logo{width:56px;height:56px;border-radius:14px;object-fit:contain;filter:drop-shadow(0 4px 12px rgba(187,0,19,.3))}
.pead-brand-text{font-size:20px;font-weight:900;color:#bb0013;letter-spacing:3px}
.pead-brand-sub{font-size:11px;font-weight:700;color:#4a5568;letter-spacing:4px;margin-top:3px}

.pead-hero-title{font-size:64px;font-weight:900;color:#fff;line-height:1.08;letter-spacing:-2px;margin-bottom:28px;position:relative;z-index:1;animation:pe-slideRight .6s ease .2s both}
.pead-hero-title span{color:#bb0013;text-shadow:0 0 40px rgba(187,0,19,.3)}
.pead-hero-desc{font-size:18px;color:#64748b;line-height:1.7;max-width:420px;position:relative;z-index:1;margin-bottom:36px;animation:pe-slideRight .6s ease .3s both}

.pead-hero-badges{display:flex;flex-direction:column;gap:12px;position:relative;z-index:1;animation:pe-slideRight .6s ease .4s both}
.pead-hero-badge{display:inline-flex;align-items:center;gap:12px;background:rgba(187,0,19,.06);border:1px solid rgba(187,0,19,.12);border-radius:12px;padding:14px 22px;transition:all .3s}
.pead-hero-badge:hover{background:rgba(187,0,19,.1);border-color:rgba(187,0,19,.25);transform:translateX(4px)}
.pead-hero-badge i{color:#bb0013;font-size:18px;width:20px;text-align:center}
.pead-hero-badge span{font-size:14px;font-weight:600;color:#94a3b8;letter-spacing:.5px}

/* ── RIGHT PANEL ── */
.pead-login-right{flex:1;display:flex;align-items:center;justify-content:center;padding:40px;position:relative;background:linear-gradient(135deg,#f8fafc 0%,#eef2f7 100%)}
.pead-login-right::before{content:'';position:absolute;top:60px;right:60px;width:200px;height:200px;background:radial-gradient(circle,rgba(187,0,19,.04),transparent 70%);border-radius:50%;pointer-events:none}

.pead-login-card{width:100%;max-width:480px;background:#fff;border-radius:24px;padding:52px 48px;box-shadow:0 25px 80px rgba(0,0,0,.08),0 4px 16px rgba(0,0,0,.04);animation:pe-fadeUp .5s ease .2s both;position:relative;overflow:hidden}
.pead-login-card::before{content:'';position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,#bb0013,#ff3344,#bb0013);background-size:200% 100%;animation:pe-glow 3s ease infinite}
.pead-login-card .card-logo{width:48px;height:48px;border-radius:12px;object-fit:contain;margin-bottom:20px;filter:drop-shadow(0 2px 8px rgba(187,0,19,.2))}
.pead-login-card h2{font-size:32px;font-weight:900;color:#0f172a;margin:0 0 8px;letter-spacing:-.5px}
.pead-login-card .subtitle{font-size:16px;color:#64748b;margin-bottom:36px;font-weight:500}

.pead-fg{margin-bottom:24px}
.pead-fg-label{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.pead-fg-label span{font-size:13px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:2px}
.pead-fg-label a{font-size:12px;font-weight:700;color:#bb0013;text-decoration:none;letter-spacing:.5px;transition:color .2s}
.pead-fg-label a:hover{color:#ff3344}

.pead-input-wrap{display:flex;align-items:center;background:#f8fafc;border:2px solid #e2e8f0;border-radius:14px;padding:0 18px;transition:all .25s}
.pead-input-wrap:focus-within{border-color:#bb0013;box-shadow:0 0 0 4px rgba(187,0,19,.08);background:#fff}
.pead-input-wrap i{color:#94a3b8;font-size:18px;margin-right:14px;flex-shrink:0;transition:color .2s}
.pead-input-wrap:focus-within i{color:#bb0013}
.pead-input-wrap input{flex:1;padding:18px 0;background:transparent;border:none;color:#0f172a;font-size:17px;font-family:inherit;font-weight:500;outline:none}
.pead-input-wrap input::placeholder{color:#94a3b8;font-weight:400}
.pead-input-wrap .pead-eye{background:none;border:none;color:#cbd5e1;font-size:17px;cursor:pointer;padding:6px;margin-left:8px;transition:color .2s}
.pead-input-wrap .pead-eye:hover{color:#bb0013}

.pead-remember{display:flex;align-items:center;gap:12px;margin:28px 0 32px}
.pead-toggle{width:48px;height:26px;background:#e2e8f0;border-radius:13px;position:relative;cursor:pointer;transition:background .2s;flex-shrink:0}
.pead-toggle::after{content:'';position:absolute;top:3px;left:3px;width:20px;height:20px;background:#fff;border-radius:50%;transition:transform .2s;box-shadow:0 2px 4px rgba(0,0,0,.15)}
.pead-toggle.active{background:#bb0013}
.pead-toggle.active::after{transform:translateX(22px)}
.pead-remember span{font-size:15px;color:#475569;font-weight:500}

.pead-submit{width:100%;padding:18px;background:linear-gradient(135deg,#bb0013 0%,#d4001a 100%);color:#fff;border:none;border-radius:14px;font-size:17px;font-weight:800;font-family:inherit;cursor:pointer;letter-spacing:1px;transition:all .25s;display:flex;align-items:center;justify-content:center;gap:10px;position:relative;overflow:hidden}
.pead-submit::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.1),transparent);opacity:0;transition:opacity .2s}
.pead-submit:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(187,0,19,.35)}
.pead-submit:hover::before{opacity:1}
.pead-submit:active{transform:translateY(0);box-shadow:0 4px 12px rgba(187,0,19,.25)}
.pead-submit:disabled{background:#94a3b8;cursor:not-allowed;transform:none;box-shadow:none}
.pead-submit .spinner{display:none;width:20px;height:20px;border:2.5px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:pe-spin .6s linear infinite}
.pead-submit.loading .spinner{display:block}
.pead-submit.loading .btn-text{display:none}

.pead-error{background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:14px 18px;margin-bottom:22px;font-size:15px;color:#dc2626;font-weight:600;display:none;align-items:center;gap:10px;animation:pe-fadeUp .3s ease}
.pead-error.show{display:flex}

.pead-footer-links{margin-top:32px;text-align:center;font-size:13px;color:#94a3b8;line-height:2}
.pead-footer-links a{color:#0f172a;text-decoration:none;font-weight:600;transition:color .2s}
.pead-footer-links a:hover{color:#bb0013}

.pead-login-bottom{position:absolute;bottom:28px;left:0;right:0;display:flex;justify-content:center;gap:36px}
.pead-login-bottom a{font-size:12px;font-weight:700;color:#64748b;text-decoration:none;letter-spacing:2px;text-transform:uppercase;transition:all .2s;padding:6px 12px;border-radius:6px}
.pead-login-bottom a:hover{color:#bb0013;background:rgba(187,0,19,.05)}

/* ── RESPONSIVE ── */
@media(max-width:1024px){
    .pead-login-left{padding:48px 48px}
    .pead-hero-title{font-size:48px}
    .pead-hero-desc{font-size:16px}
}
@media(max-width:900px){
    .pead-login-left{display:none}
    .pead-login-right{padding:24px;background:linear-gradient(135deg,#f8fafc 0%,#eef2f7 100%)}
    .pead-login-wrap{background:#f1f5f9}
    .pead-login-card{max-width:520px}
}
@media(max-width:600px){
    .pead-login-right{padding:16px;align-items:flex-start;padding-top:40px}
    .pead-login-card{padding:36px 28px;border-radius:20px}
    .pead-login-card h2{font-size:26px}
    .pead-login-card .subtitle{font-size:14px;margin-bottom:28px}
    .pead-fg-label span{font-size:11px}
    .pead-input-wrap input{font-size:16px;padding:16px 0}
    .pead-input-wrap i{font-size:16px}
    .pead-submit{padding:16px;font-size:15px}
    .pead-remember span{font-size:14px}
    .pead-login-bottom{gap:20px}
    .pead-login-bottom a{font-size:10px;letter-spacing:1px}
}
@media(max-width:380px){
    .pead-login-card{padding:28px 20px}
    .pead-login-card h2{font-size:22px}
}
</style>

<div class="pead-login-wrap" id="pead-login-wrap">
    <div class="pead-login-left">
        <div class="grid-overlay"></div>
        <div class="scanline"></div>
        <div class="pead-brand">
            <img src="<?php echo esc_url(PE_LOGO_URL); ?>" alt="Prince Express" class="pead-brand-logo">
            <div>
                <div class="pead-brand-text">PRINCE EXPRESS</div>
                <div class="pead-brand-sub">INTERNATIONAL COURIER</div>
            </div>
        </div>
        <div class="pead-hero-title">Global<br>Command<br><span>Center.</span></div>
        <div class="pead-hero-desc">Authorized administrative access only. System activity is monitored for security and compliance protocols.</div>
        <div class="pead-hero-badges">
            <div class="pead-hero-badge">
                <i class="fa-solid fa-shield-halved"></i>
                <span>Encrypted End-to-End Tunnel Active</span>
            </div>
            <div class="pead-hero-badge">
                <i class="fa-solid fa-fingerprint"></i>
                <span>Biometric Session Fingerprinting</span>
            </div>
            <div class="pead-hero-badge">
                <i class="fa-solid fa-network-wired"></i>
                <span>IP Whitelist Protection Enabled</span>
            </div>
        </div>
    </div>
    <div class="pead-login-right">
        <div class="pead-login-card">
            <img src="<?php echo esc_url(PE_LOGO_URL); ?>" alt="Prince Express" class="card-logo">
            <h2>Internal Authentication</h2>
            <p class="subtitle">Verify your credentials to access the command center</p>
            <div class="pead-error" id="pead-error"><i class="fa-solid fa-circle-exclamation"></i><span id="pead-error-msg"></span></div>
            <form id="pead-login-form" autocomplete="off">
                <div class="pead-fg">
                    <div class="pead-fg-label"><span>Administrator ID</span></div>
                    <div class="pead-input-wrap">
                        <i class="fa-solid fa-user-shield"></i>
                        <input type="text" name="uname" id="pead-uname" placeholder="Enter admin username" required autocomplete="username">
                    </div>
                </div>
                <div class="pead-fg">
                    <div class="pead-fg-label"><span>Access Token</span><a href="#" onclick="return false;">Forgot Password?</a></div>
                    <div class="pead-input-wrap">
                        <i class="fa-solid fa-key"></i>
                        <input type="password" name="pwd" id="pead-pwd" placeholder="••••••••••••••••" required autocomplete="current-password">
                        <button type="button" class="pead-eye" onclick="peadTogglePwd()"><i class="fa-solid fa-eye-slash" id="pead-eye-icon"></i></button>
                    </div>
                </div>
                <div class="g-recaptcha" data-sitekey="6LfHGLgsAAAAAFoxP08O4gMZS8miuIMeB9nBrqAA"></div>
                <button type="submit" class="pead-submit" id="pead-submit-btn">
                    <span class="btn-text">AUTHORIZE ACCESS &nbsp;→</span>
                    <div class="spinner"></div>
                </button>
            </form>
            <div class="pead-footer-links">
                Use of this system constitutes agreement to the <a href="#">Privacy Policy</a><br>and <a href="#">Terms of Operation</a>.
            </div>
        </div>
    </div>
</div>
<script src="https://www.google.com/recaptcha/api.js" async defer></script>
<script>
function peadTogglePwd(){
    var inp=document.getElementById('pead-pwd'),ic=document.getElementById('pead-eye-icon');
    if(inp.type==='password'){inp.type='text';ic.className='fa-solid fa-eye';}
    else{inp.type='password';ic.className='fa-solid fa-eye-slash';}
}
document.getElementById('pead-login-form').addEventListener('submit',function(e){
    e.preventDefault();
    var btn=document.getElementById('pead-submit-btn');
    var err=document.getElementById('pead-error');
    var msg=document.getElementById('pead-error-msg');
    btn.classList.add('loading');btn.disabled=true;
    err.classList.remove('show');
    var fd=new FormData();
    fd.append('action','pe_admin_login');
    fd.append('nonce',PE_AD.nonce);
    fd.append('uname',document.getElementById('pead-uname').value);
    fd.append('pwd',document.getElementById('pead-pwd').value);

    // ✅ reCAPTCHA check
    var recaptcha = grecaptcha.getResponse();
    if(!recaptcha){
        btn.classList.remove('loading');
        btn.disabled=false;
        msg.textContent='Please verify reCAPTCHA';
        err.classList.add('show');
        return;
    }
    
    fd.append('g-recaptcha-response', recaptcha);
    fetch(PE_AD.ajax_url,{method:'POST',body:fd,credentials:'same-origin'})
    .then(function(r){return r.text();})
    .then(function(raw){
        var d;
        try { d = JSON.parse(raw); } catch(e) {
            btn.classList.remove('loading');btn.disabled=false;
            msg.textContent='Server returned invalid response.';err.classList.add('show');
            return;
        }
        btn.classList.remove('loading');btn.disabled=false;
        if(d.success){
            if(d.data && d.data.new_nonce) PE_AD.nonce = d.data.new_nonce;
            msg.textContent = d.data.message || 'Authorized! Redirecting...';
            err.style.background = 'rgba(34,197,94,.08)';
            err.style.borderColor = 'rgba(34,197,94,.3)';
            err.style.color = '#22c55e';
            err.classList.add('show');
            setTimeout(function(){ window.location.href=window.location.pathname+'?_='+Date.now(); }, 1500);
        }
        else{
            msg.textContent=d.data.message||'Authentication failed';err.classList.add('show');
        }
    })
    .catch(function(e){
        btn.classList.remove('loading');btn.disabled=false;
        msg.textContent='Network error: ' + e.message;err.classList.add('show');
    });
});
</script>
