<?php if (!defined('ABSPATH')) exit; ?>
<style>
#wpadminbar{display:none!important}html{margin-top:0!important}
*,*::before,*::after{box-sizing:border-box}

/* ── ANIMATIONS ── */
@keyframes cp-spin{to{transform:rotate(360deg)}}
@keyframes cp-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes cp-fadeUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
@keyframes cp-fadeIn{from{opacity:0}to{opacity:1}}
@keyframes cp-slideRight{from{opacity:0;transform:translateX(-40px)}to{opacity:1;transform:translateX(0)}}
@keyframes cp-glow{0%,100%{box-shadow:0 0 20px rgba(187,0,19,.15)}50%{box-shadow:0 0 40px rgba(187,0,19,.3)}}
@keyframes cp-gridMove{0%{background-position:0 0}100%{background-position:50px 50px}}
@keyframes cp-gradientShift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}

.cp-login-wrap{position:fixed;inset:0;z-index:99999;display:flex;font-family:'Inter',-apple-system,sans-serif;background:#eef2f7;overflow:hidden}

/* ── LEFT PANEL ── */
.cp-login-left{flex:0 0 50%;background:linear-gradient(145deg,#000 0%,#0a1020 50%,#060d1a 100%);display:flex;flex-direction:column;justify-content:center;padding:64px 72px;position:relative;overflow:hidden}
.cp-login-left::before{content:'';position:absolute;top:-120px;right:-80px;width:600px;height:600px;background:radial-gradient(circle,rgba(187,0,19,.12),transparent 70%);pointer-events:none;animation:cp-float 6s ease infinite}
.cp-login-left::after{content:'';position:absolute;bottom:-80px;left:-60px;width:400px;height:400px;background:radial-gradient(circle,rgba(187,0,19,.06),transparent 70%);pointer-events:none;animation:cp-float 8s ease infinite 1s}
.cp-login-left .grid-overlay{position:absolute;inset:0;background-image:linear-gradient(rgba(187,0,19,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(187,0,19,.03) 1px,transparent 1px);background-size:50px 50px;animation:cp-gridMove 20s linear infinite;pointer-events:none}

.cp-brand{display:flex;align-items:center;gap:16px;margin-bottom:52px;position:relative;z-index:1;animation:cp-slideRight .6s ease .1s both}
.cp-brand-logo{width:56px;height:56px;border-radius:14px;object-fit:contain;filter:drop-shadow(0 4px 12px rgba(187,0,19,.3))}
.cp-brand-text{font-size:20px;font-weight:900;color:#bb0013;letter-spacing:3px}
.cp-brand-sub{font-size:11px;font-weight:700;color:#4a5568;letter-spacing:4px;margin-top:3px}

.cp-hero-title{font-size:56px;font-weight:900;color:#fff;line-height:1.1;letter-spacing:-2px;margin-bottom:28px;position:relative;z-index:1;animation:cp-slideRight .6s ease .2s both}
.cp-hero-title span{color:#bb0013;text-shadow:0 0 40px rgba(187,0,19,.3)}
.cp-hero-desc{font-size:17px;color:#64748b;line-height:1.7;max-width:420px;position:relative;z-index:1;margin-bottom:36px;animation:cp-slideRight .6s ease .3s both}

.cp-hero-features{display:flex;flex-direction:column;gap:12px;position:relative;z-index:1;animation:cp-slideRight .6s ease .4s both}
.cp-hero-feature{display:inline-flex;align-items:center;gap:12px;background:rgba(187,0,19,.06);border:1px solid rgba(187,0,19,.12);border-radius:12px;padding:14px 22px;transition:all .3s}
.cp-hero-feature:hover{background:rgba(187,0,19,.1);border-color:rgba(187,0,19,.25);transform:translateX(4px)}
.cp-hero-feature i{color:#bb0013;font-size:18px;width:20px;text-align:center}
.cp-hero-feature span{font-size:14px;font-weight:600;color:#94a3b8;letter-spacing:.5px}

/* ── RIGHT PANEL ── */
.cp-login-right{flex:1;display:flex;align-items:center;justify-content:center;padding:40px;position:relative;background:linear-gradient(135deg,#f8fafc 0%,#eef2f7 100%)}

.cp-login-card{width:100%;max-width:480px;background:#fff;border-radius:24px;padding:52px 48px;box-shadow:0 25px 80px rgba(0,0,0,.08),0 4px 16px rgba(0,0,0,.04);animation:cp-fadeUp .5s ease .2s both;position:relative;overflow:hidden}
.cp-login-card::before{content:'';position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,#bb0013,#ff3344,#bb0013);background-size:200% 100%;animation:cp-gradientShift 3s ease infinite}
.cp-login-card .card-logo{width:48px;height:48px;border-radius:12px;object-fit:contain;margin-bottom:20px;filter:drop-shadow(0 2px 8px rgba(187,0,19,.2))}
.cp-login-card h2{font-size:30px;font-weight:900;color:#0f172a;margin:0 0 8px;letter-spacing:-.5px}
.cp-login-card .subtitle{font-size:15px;color:#64748b;margin-bottom:36px;font-weight:500}

.cp-fg{margin-bottom:24px}
.cp-fg-label{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.cp-fg-label span{font-size:12px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:2px}
.cp-input-wrap{display:flex;align-items:center;background:#f8fafc;border:2px solid #e2e8f0;border-radius:14px;padding:0 18px;transition:all .25s}
.cp-input-wrap:focus-within{border-color:#bb0013;box-shadow:0 0 0 4px rgba(187,0,19,.08);background:#fff}
.cp-input-wrap i{color:#94a3b8;font-size:18px;margin-right:14px;flex-shrink:0;transition:color .2s}
.cp-input-wrap:focus-within i{color:#bb0013}
.cp-input-wrap input{flex:1;padding:18px 0;background:transparent;border:none;color:#0f172a;font-size:16px;font-family:inherit;font-weight:500;outline:none}
.cp-input-wrap input::placeholder{color:#94a3b8;font-weight:400}
.cp-input-wrap .cp-eye{background:none;border:none;color:#cbd5e1;font-size:17px;cursor:pointer;padding:6px;margin-left:8px;transition:color .2s}
.cp-input-wrap .cp-eye:hover{color:#bb0013}

.cp-submit{width:100%;padding:18px;background:linear-gradient(135deg,#bb0013 0%,#d4001a 100%);color:#fff;border:none;border-radius:14px;font-size:16px;font-weight:800;font-family:inherit;cursor:pointer;letter-spacing:1px;transition:all .25s;display:flex;align-items:center;justify-content:center;gap:10px;position:relative;overflow:hidden;margin-top:8px}
.cp-submit:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(187,0,19,.35)}
.cp-submit:active{transform:translateY(0)}
.cp-submit:disabled{background:#94a3b8;cursor:not-allowed;transform:none;box-shadow:none}
.cp-submit .spinner{display:none;width:20px;height:20px;border:2.5px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:cp-spin .6s linear infinite}
.cp-submit.loading .spinner{display:block}
.cp-submit.loading .btn-text{display:none}

.cp-error{background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:14px 18px;margin-bottom:22px;font-size:14px;color:#dc2626;font-weight:600;display:none;align-items:center;gap:10px;animation:cp-fadeUp .3s ease}
.cp-error.show{display:flex}

.cp-footer-links{margin-top:32px;text-align:center;font-size:13px;color:#94a3b8;line-height:2}
.cp-footer-links a{color:#0f172a;text-decoration:none;font-weight:600;transition:color .2s}
.cp-footer-links a:hover{color:#bb0013}

/* ── RESPONSIVE ── */
@media(max-width:1024px){
    .cp-login-left{padding:48px 48px}
    .cp-hero-title{font-size:42px}
    .cp-hero-desc{font-size:15px}
}
@media(max-width:900px){
    .cp-login-left{display:none}
    .cp-login-right{padding:24px}
    .cp-login-card{max-width:520px}
}
@media(max-width:600px){
    .cp-login-right{padding:16px;align-items:flex-start;padding-top:40px}
    .cp-login-card{padding:36px 28px;border-radius:20px}
    .cp-login-card h2{font-size:24px}
    .cp-login-card .subtitle{font-size:14px;margin-bottom:28px}
    .cp-input-wrap input{font-size:16px;padding:16px 0}
    .cp-submit{padding:16px;font-size:15px}
}
</style>

<div class="cp-login-wrap" id="cp-login-wrap">
    <div class="cp-login-left">
        <div class="grid-overlay"></div>
        <div class="cp-brand">
            <img src="<?php echo esc_url(PE_CP_LOGO_URL); ?>" alt="Prince Express" class="cp-brand-logo">
            <div>
                <div class="cp-brand-text">PRINCE EXPRESS</div>
                <div class="cp-brand-sub">INTERNATIONAL COURIER</div>
            </div>
        </div>
        <div class="cp-hero-title">Ship With<br><span>Confidence.</span></div>
        <div class="cp-hero-desc">Access your personal dashboard to manage bookings, track parcels, and download invoices — all in one place.</div>
        <div class="cp-hero-features">
            <div class="cp-hero-feature">
                <i class="fa-solid fa-truck-fast"></i>
                <span>Real-time Shipment Tracking</span>
            </div>
            <div class="cp-hero-feature">
                <i class="fa-solid fa-box"></i>
                <span>Self-Service Booking Portal</span>
            </div>
            <div class="cp-hero-feature">
                <i class="fa-solid fa-shield-halved"></i>
                <span>Insured International Shipping</span>
            </div>
        </div>
    </div>
    <div class="cp-login-right">
        <div class="cp-login-card">
            <img src="<?php echo esc_url(PE_CP_LOGO_URL); ?>" alt="Prince Express" class="card-logo">
            <h2>Customer Login</h2>
            <p class="subtitle">Enter your credentials to access your shipping dashboard</p>
            <div class="cp-error" id="cp-error"><i class="fa-solid fa-circle-exclamation"></i><span id="cp-error-msg"></span></div>
            <form id="cp-login-form" autocomplete="off">
                <div class="cp-fg">
                    <div class="cp-fg-label"><span>Email or Phone</span></div>
                    <div class="cp-input-wrap">
                        <i class="fa-solid fa-envelope"></i>
                        <input type="text" name="email_or_phone" id="cp-email" placeholder="Enter your email or phone number" required autocomplete="email">
                    </div>
                </div>
                <div class="cp-fg">
                    <div class="cp-fg-label"><span>Password</span></div>
                    <div class="cp-input-wrap">
                        <i class="fa-solid fa-lock"></i>
                        <input type="password" name="pwd" id="cp-pwd" placeholder="••••••••••••••••" required autocomplete="current-password">
                        <button type="button" class="cp-eye" onclick="cpTogglePwd()"><i class="fa-solid fa-eye-slash" id="cp-eye-icon"></i></button>
                    </div>
                </div>
                <button type="submit" class="cp-submit" id="cp-submit-btn">
                    <span class="btn-text">SIGN IN &nbsp;→</span>
                    <div class="spinner"></div>
                </button>
            </form>
            <div class="cp-footer-links">
                Don't have an account? <a href="#">Contact Us</a><br>
                <a href="<?php echo esc_url(home_url()); ?>">← Back to Website</a>
            </div>
        </div>
    </div>
</div>

<script>
function cpTogglePwd(){
    var inp=document.getElementById('cp-pwd'),ic=document.getElementById('cp-eye-icon');
    if(inp.type==='password'){inp.type='text';ic.className='fa-solid fa-eye';}
    else{inp.type='password';ic.className='fa-solid fa-eye-slash';}
}
document.getElementById('cp-login-form').addEventListener('submit',function(e){
    e.preventDefault();
    var btn=document.getElementById('cp-submit-btn');
    var err=document.getElementById('cp-error');
    var msg=document.getElementById('cp-error-msg');
    btn.classList.add('loading');btn.disabled=true;
    err.classList.remove('show');
    var fd=new FormData();
    fd.append('action','pe_cp_login');
    fd.append('nonce',PE_CP.nonce);
    fd.append('email_or_phone',document.getElementById('cp-email').value);
    fd.append('pwd',document.getElementById('cp-pwd').value);
    fetch(PE_CP.ajax_url,{method:'POST',body:fd,credentials:'same-origin'})
    .then(function(r){return r.text();})
    .then(function(raw){
        var d;
        try{d=JSON.parse(raw);}catch(e){
            btn.classList.remove('loading');btn.disabled=false;
            msg.textContent='Server returned invalid response.';err.classList.add('show');
            return;
        }
        btn.classList.remove('loading');btn.disabled=false;
        if(d.success){
            if(d.data&&d.data.new_nonce)PE_CP.nonce=d.data.new_nonce;
            msg.textContent=d.data.message||'Welcome! Redirecting...';
            err.style.background='rgba(34,197,94,.08)';
            err.style.borderColor='rgba(34,197,94,.3)';
            err.style.color='#22c55e';
            err.classList.add('show');
            setTimeout(function(){window.location.href=window.location.pathname+'?_='+Date.now();},1200);
        } else {
            msg.textContent=d.data.message||'Login failed';err.classList.add('show');
        }
    })
    .catch(function(e){
        btn.classList.remove('loading');btn.disabled=false;
        msg.textContent='Network error: '+e.message;err.classList.add('show');
    });
});
</script>
