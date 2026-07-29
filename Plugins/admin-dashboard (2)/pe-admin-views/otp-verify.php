<?php if (!defined('ABSPATH')) exit; ?>
<style>
#wpadminbar{display:none!important}html{margin-top:0!important}
*,*::before,*::after{box-sizing:border-box}

@keyframes pe-spin{to{transform:rotate(360deg)}}
@keyframes pe-fadeUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
@keyframes pe-pulse{0%,100%{opacity:.6}50%{opacity:1}}
@keyframes pe-glow{0%,100%{box-shadow:0 0 20px rgba(187,0,19,.15)}50%{box-shadow:0 0 40px rgba(187,0,19,.3)}}

.pead-otp-wrap{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;font-family:'Inter',-apple-system,sans-serif;background:linear-gradient(135deg,#0a0a0a 0%,#0c1322 50%,#060d1a 100%);overflow:hidden}
.pead-otp-wrap::before{content:'';position:absolute;top:50%;left:50%;width:800px;height:800px;transform:translate(-50%,-50%);background:radial-gradient(circle,rgba(187,0,19,.08),transparent 70%);pointer-events:none;animation:pe-pulse 4s ease infinite}
.pead-otp-card{width:100%;max-width:480px;background:#fff;border-radius:24px;padding:52px 48px;box-shadow:0 25px 80px rgba(0,0,0,.3),0 4px 16px rgba(0,0,0,.15);animation:pe-fadeUp .5s ease both;position:relative;overflow:hidden;margin:20px}
.pead-otp-card::before{content:'';position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,#bb0013,#ff3344,#bb0013);background-size:200% 100%;animation:pe-glow 3s ease infinite}
.pead-otp-card .card-logo{width:48px;height:48px;border-radius:12px;object-fit:contain;margin-bottom:20px;filter:drop-shadow(0 2px 8px rgba(187,0,19,.2))}
.pead-otp-card h2{font-size:28px;font-weight:900;color:#0f172a;margin:0 0 8px;letter-spacing:-.5px}
.pead-otp-card .subtitle{font-size:15px;color:#64748b;margin-bottom:32px;font-weight:500;line-height:1.6}
.pead-otp-card .subtitle strong{color:#bb0013}

.pead-otp-inputs{display:flex;gap:10px;justify-content:center;margin-bottom:28px}
.pead-otp-inputs input{width:52px;height:62px;border:2px solid #e2e8f0;border-radius:14px;text-align:center;font-size:26px;font-weight:900;font-family:'Courier New',monospace;color:#0f172a;background:#f8fafc;outline:none;transition:all .25s;caret-color:#bb0013}
.pead-otp-inputs input:focus{border-color:#bb0013;box-shadow:0 0 0 4px rgba(187,0,19,.08);background:#fff}
.pead-otp-inputs input.filled{border-color:#22c55e;background:rgba(34,197,94,.04)}

.pead-otp-error{background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:14px 18px;margin-bottom:22px;font-size:14px;color:#dc2626;font-weight:600;display:none;align-items:center;gap:10px;animation:pe-fadeUp .3s ease}
.pead-otp-error.show{display:flex}

.pead-otp-success{background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.2);border-radius:12px;padding:14px 18px;margin-bottom:22px;font-size:14px;color:#22c55e;font-weight:600;display:none;align-items:center;gap:10px;animation:pe-fadeUp .3s ease}
.pead-otp-success.show{display:flex}

.pead-otp-submit{width:100%;padding:18px;background:linear-gradient(135deg,#bb0013 0%,#d4001a 100%);color:#fff;border:none;border-radius:14px;font-size:17px;font-weight:800;font-family:inherit;cursor:pointer;letter-spacing:1px;transition:all .25s;display:flex;align-items:center;justify-content:center;gap:10px}
.pead-otp-submit:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(187,0,19,.35)}
.pead-otp-submit:disabled{background:#94a3b8;cursor:not-allowed;transform:none;box-shadow:none}
.pead-otp-submit .spinner{display:none;width:20px;height:20px;border:2.5px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:pe-spin .6s linear infinite}
.pead-otp-submit.loading .spinner{display:block}
.pead-otp-submit.loading .btn-text{display:none}

.pead-otp-actions{display:flex;justify-content:space-between;align-items:center;margin-top:24px}
.pead-otp-actions button{background:none;border:none;font-size:14px;font-weight:700;color:#bb0013;cursor:pointer;font-family:inherit;transition:color .2s;padding:8px 0}
.pead-otp-actions button:hover{color:#ff3344}
.pead-otp-actions button:disabled{color:#94a3b8;cursor:not-allowed}

.pead-otp-timer{font-size:13px;color:#94a3b8;font-weight:600;text-align:center;margin-top:16px}
.pead-otp-timer strong{color:#bb0013}

.pead-otp-remember{display:flex;align-items:center;gap:12px;margin:20px 0 28px;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px}
.pead-otp-toggle{width:44px;height:24px;background:#e2e8f0;border-radius:12px;position:relative;cursor:pointer;transition:background .2s;flex-shrink:0}
.pead-otp-toggle::after{content:'';position:absolute;top:2px;left:2px;width:20px;height:20px;background:#fff;border-radius:50%;transition:transform .2s;box-shadow:0 2px 4px rgba(0,0,0,.15)}
.pead-otp-toggle.active{background:#bb0013}
.pead-otp-toggle.active::after{transform:translateX(20px)}
.pead-otp-remember .rem-text{font-size:14px;color:#475569;font-weight:500;line-height:1.4}
.pead-otp-remember .rem-text small{display:block;font-size:11px;color:#94a3b8;margin-top:2px}

.pead-otp-footer{margin-top:28px;text-align:center;font-size:12px;color:#94a3b8;line-height:1.8}
.pead-otp-footer a{color:#0f172a;text-decoration:none;font-weight:600;transition:color .2s}
.pead-otp-footer a:hover{color:#bb0013}

.pead-otp-icon{width:64px;height:64px;background:linear-gradient(135deg,rgba(187,0,19,.08),rgba(187,0,19,.04));border-radius:18px;display:flex;align-items:center;justify-content:center;margin-bottom:20px}
.pead-otp-icon i{font-size:28px;color:#bb0013}

/* ── DARK MODE ── */
[data-theme="dark"] .pead-otp-wrap{background:linear-gradient(135deg,#050505 0%,#0a0a14 50%,#040810 100%)}
[data-theme="dark"] .pead-otp-card{background:#151515;box-shadow:0 25px 80px rgba(0,0,0,.6),0 4px 16px rgba(0,0,0,.4)}
[data-theme="dark"] .pead-otp-card h2{color:#e8eaed}
[data-theme="dark"] .pead-otp-card .subtitle{color:#9aa0a8}
[data-theme="dark"] .pead-otp-card .subtitle strong{color:#ff3344}
[data-theme="dark"] .pead-otp-inputs input{border-color:#333;color:#e8eaed;background:#1a1a1a}
[data-theme="dark"] .pead-otp-inputs input:focus{border-color:#bb0013;box-shadow:0 0 0 4px rgba(187,0,19,.15);background:#1e1e1e}
[data-theme="dark"] .pead-otp-inputs input.filled{border-color:#22c55e;background:rgba(34,197,94,.06)}
[data-theme="dark"] .pead-otp-error{background:rgba(220,38,38,.08);border-color:rgba(220,38,38,.2);color:#f87171}
[data-theme="dark"] .pead-otp-success{background:rgba(34,197,94,.08);border-color:rgba(34,197,94,.15);color:#4ade80}
[data-theme="dark"] .pead-otp-submit{background:linear-gradient(135deg,#bb0013,#a00010)}
[data-theme="dark"] .pead-otp-actions button{color:#ff3344}
[data-theme="dark"] .pead-otp-actions button:hover{color:#ff6677}
[data-theme="dark"] .pead-otp-actions button:disabled{color:#555}
[data-theme="dark"] .pead-otp-timer{color:#6b707a}
[data-theme="dark"] .pead-otp-timer strong{color:#ff3344}
[data-theme="dark"] .pead-otp-remember{background:#1a1a1a;border-color:#252525}
[data-theme="dark"] .pead-otp-toggle{background:#333}
[data-theme="dark"] .pead-otp-remember .rem-text{color:#9aa0a8}
[data-theme="dark"] .pead-otp-remember .rem-text small{color:#6b707a}
[data-theme="dark"] .pead-otp-footer{color:#6b707a}
[data-theme="dark"] .pead-otp-footer a{color:#e8eaed}
[data-theme="dark"] .pead-otp-footer a:hover{color:#ff3344}
[data-theme="dark"] .pead-otp-icon{background:linear-gradient(135deg,rgba(187,0,19,.12),rgba(187,0,19,.06))}

@media(max-width:600px){
    .pead-otp-card{padding:36px 24px;border-radius:20px}
    .pead-otp-card h2{font-size:24px}
    .pead-otp-inputs input{width:44px;height:54px;font-size:22px}
    .pead-otp-inputs{gap:8px}
}
@media(max-width:380px){
    .pead-otp-card{padding:28px 20px}
    .pead-otp-inputs input{width:38px;height:48px;font-size:20px;border-radius:10px}
    .pead-otp-inputs{gap:6px}
}
</style>

<div class="pead-otp-wrap" id="pead-otp-wrap">
<script>
// Apply saved theme immediately to prevent flash
(function(){
    var t = localStorage.getItem('pe_theme');
    if (t) document.getElementById('pead-otp-wrap').setAttribute('data-theme', t);
})();
</script>
    <div class="pead-otp-card">
        <img src="<?php echo esc_url(PE_LOGO_URL); ?>" alt="Prince Express" class="card-logo">
        <div class="pead-otp-icon"><i class="fa-solid fa-shield-halved"></i></div>
        <h2>Identity Verification</h2>
        <p class="subtitle">A 6-digit verification code has been sent to your <strong>registered email</strong>. Enter it below to continue.</p>
        
        <div class="pead-otp-error" id="otp-error"><i class="fa-solid fa-circle-exclamation"></i><span id="otp-error-msg"></span></div>
        <div class="pead-otp-success" id="otp-success"><i class="fa-solid fa-circle-check"></i><span id="otp-success-msg"></span></div>
        
        <div class="pead-otp-inputs" id="otp-inputs">
            <input type="text" maxlength="1" inputmode="numeric" pattern="[0-9]" data-idx="0" autofocus>
            <input type="text" maxlength="1" inputmode="numeric" pattern="[0-9]" data-idx="1">
            <input type="text" maxlength="1" inputmode="numeric" pattern="[0-9]" data-idx="2">
            <input type="text" maxlength="1" inputmode="numeric" pattern="[0-9]" data-idx="3">
            <input type="text" maxlength="1" inputmode="numeric" pattern="[0-9]" data-idx="4">
            <input type="text" maxlength="1" inputmode="numeric" pattern="[0-9]" data-idx="5">
        </div>

        <div class="pead-otp-remember">
            <div class="pead-otp-toggle" id="otp-remember" onclick="this.classList.toggle('active')"></div>
            <div class="rem-text">
                Remember this device
                <small>Skip verification for 15 days on this browser</small>
            </div>
        </div>

        <button type="button" class="pead-otp-submit" id="otp-submit" onclick="verifyFirstLoginOtp()">
            <span class="btn-text">VERIFY & CONTINUE →</span>
            <div class="spinner"></div>
        </button>

        <div class="pead-otp-actions">
            <button type="button" id="otp-resend" onclick="resendOtp()">Resend Code</button>
            <button type="button" onclick="otpLogout()">Sign Out</button>
        </div>

        <div class="pead-otp-timer" id="otp-timer">Code expires in <strong id="otp-countdown">5:00</strong></div>

        <div class="pead-otp-footer">
            Verification email sent to the admin address.<br>
            Check spam folder if not received.
        </div>
    </div>
</div>

<script>
(function(){
    var inputs = document.querySelectorAll('#otp-inputs input');
    
    // Auto-focus and navigation between OTP inputs
    inputs.forEach(function(inp, idx) {
        inp.addEventListener('input', function(e) {
            var v = inp.value.replace(/[^0-9]/g, '');
            inp.value = v;
            if (v) {
                inp.classList.add('filled');
                if (idx < 5) inputs[idx + 1].focus();
            } else {
                inp.classList.remove('filled');
            }
        });
        inp.addEventListener('keydown', function(e) {
            if (e.key === 'Backspace' && !inp.value && idx > 0) {
                inputs[idx - 1].focus();
                inputs[idx - 1].value = '';
                inputs[idx - 1].classList.remove('filled');
            }
            if (e.key === 'Enter') {
                verifyFirstLoginOtp();
            }
        });
        // Handle paste
        inp.addEventListener('paste', function(e) {
            e.preventDefault();
            var pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/[^0-9]/g, '');
            for (var i = 0; i < 6 && i < pasted.length; i++) {
                inputs[i].value = pasted[i];
                inputs[i].classList.add('filled');
            }
            if (pasted.length >= 6) inputs[5].focus();
        });
    });

    // Countdown timer
    var remaining = 300; // 5 minutes
    var timerEl = document.getElementById('otp-countdown');
    var interval = setInterval(function() {
        remaining--;
        if (remaining <= 0) {
            clearInterval(interval);
            timerEl.textContent = 'Expired';
            timerEl.style.color = '#dc2626';
            return;
        }
        var m = Math.floor(remaining / 60);
        var s = remaining % 60;
        timerEl.textContent = m + ':' + (s < 10 ? '0' : '') + s;
    }, 1000);
    window._otpTimer = interval;
})();

function getOtpValue() {
    var inputs = document.querySelectorAll('#otp-inputs input');
    var otp = '';
    inputs.forEach(function(inp) { otp += inp.value; });
    return otp;
}

function verifyFirstLoginOtp() {
    var otp = getOtpValue();
    if (otp.length !== 6) {
        showOtpError('Please enter the complete 6-digit code');
        return;
    }
    var btn = document.getElementById('otp-submit');
    btn.classList.add('loading');
    btn.disabled = true;
    hideOtpMessages();

    var remember = document.getElementById('otp-remember').classList.contains('active') ? '1' : '';

    var fd = new FormData();
    fd.append('action', 'pe_admin_verify_otp');
    fd.append('nonce', PE_AD.nonce);
    fd.append('purpose', 'login');
    fd.append('otp', otp);
    fd.append('remember_device', remember);

    fetch(PE_AD.ajax_url, {method: 'POST', body: fd, credentials: 'same-origin'})
    .then(function(r) { return r.json(); })
    .then(function(d) {
        btn.classList.remove('loading');
        btn.disabled = false;
        if (d.success) {
            if (d.data && d.data.new_nonce) PE_AD.nonce = d.data.new_nonce;
            showOtpSuccess('Verified! Redirecting...');
            setTimeout(function() { location.reload(); }, 1000);
        } else {
            showOtpError(d.data.message || 'Verification failed');
            // Clear inputs
            var inputs = document.querySelectorAll('#otp-inputs input');
            inputs.forEach(function(inp) { inp.value = ''; inp.classList.remove('filled'); });
            inputs[0].focus();
        }
    })
    .catch(function() {
        btn.classList.remove('loading');
        btn.disabled = false;
        showOtpError('Network error. Please try again.');
    });
}

function resendOtp() {
    var resendBtn = document.getElementById('otp-resend');
    resendBtn.disabled = true;
    resendBtn.textContent = 'Sending...';
    hideOtpMessages();

    var fd = new FormData();
    fd.append('action', 'pe_admin_send_otp');
    fd.append('nonce', PE_AD.nonce);
    fd.append('purpose', 'login');

    fetch(PE_AD.ajax_url, {method: 'POST', body: fd, credentials: 'same-origin'})
    .then(function(r) { return r.json(); })
    .then(function(d) {
        if (d.success) {
            showOtpSuccess('New code sent to your email');
            // Reset timer
            clearInterval(window._otpTimer);
            var remaining = 300;
            var timerEl = document.getElementById('otp-countdown');
            timerEl.style.color = '';
            window._otpTimer = setInterval(function() {
                remaining--;
                if (remaining <= 0) { clearInterval(window._otpTimer); timerEl.textContent = 'Expired'; timerEl.style.color = '#dc2626'; return; }
                var m = Math.floor(remaining / 60);
                var s = remaining % 60;
                timerEl.textContent = m + ':' + (s < 10 ? '0' : '') + s;
            }, 1000);
        } else {
            showOtpError(d.data.message || 'Failed to resend');
        }
        // Cooldown 30 seconds
        var cd = 30;
        var cdI = setInterval(function() {
            cd--;
            resendBtn.textContent = 'Resend (' + cd + 's)';
            if (cd <= 0) {
                clearInterval(cdI);
                resendBtn.textContent = 'Resend Code';
                resendBtn.disabled = false;
            }
        }, 1000);
    })
    .catch(function() {
        showOtpError('Network error');
        resendBtn.textContent = 'Resend Code';
        resendBtn.disabled = false;
    });
}

function otpLogout() {
    var fd = new FormData();
    fd.append('action', 'pe_admin_logout');
    fd.append('nonce', PE_AD.nonce);
    fetch(PE_AD.ajax_url, {method: 'POST', body: fd, credentials: 'same-origin'})
    .then(function() { location.reload(); });
}

function showOtpError(msg) {
    var el = document.getElementById('otp-error');
    document.getElementById('otp-error-msg').textContent = msg;
    el.classList.add('show');
    document.getElementById('otp-success').classList.remove('show');
}
function showOtpSuccess(msg) {
    var el = document.getElementById('otp-success');
    document.getElementById('otp-success-msg').textContent = msg;
    el.classList.add('show');
    document.getElementById('otp-error').classList.remove('show');
}
function hideOtpMessages() {
    document.getElementById('otp-error').classList.remove('show');
    document.getElementById('otp-success').classList.remove('show');
}

// Session heartbeat — keeps session alive while OTP page is open
(function(){
    function hb(){
        var fd=new FormData();
        fd.append('action','pe_admin_heartbeat');
        fd.append('nonce',PE_AD.nonce);
        fetch(PE_AD.ajax_url,{method:'POST',body:fd,credentials:'same-origin'}).catch(function(){});
    }
    hb();
    setInterval(hb, 30000);
})();
</script>
