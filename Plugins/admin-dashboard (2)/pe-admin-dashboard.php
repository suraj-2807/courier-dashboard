<?php
/*
Plugin Name: PE Admin Dashboard
Description: Secure admin command center for shipment management and rate customization.
Version: 3.0
Author: Suraj
*/
if (!defined('ABSPATH'))
    exit;

// ══════════════════════════════════════
//  SESSION ENGINE (WordPress Transients + Cookie)
//  Replaces PHP native sessions for reliability
// ══════════════════════════════════════

// Secret key for session encryption
if (!defined('PE_SESSION_SECRET')) {
    define('PE_SESSION_SECRET', defined('AUTH_KEY') ? AUTH_KEY . 'PE_ADMIN_V3' : 'pe_default_secret_change_me_2026');
}

// Logo URL constant
if (!defined('PE_LOGO_URL')) {
    define('PE_LOGO_URL', 'https://princeexp.com/wp-content/uploads/2026/04/ChatGPT-Image-Apr-14-2026-06_03_34-AM.png');
}

// Session cookie name
if (!defined('PE_COOKIE_NAME')) {
    define('PE_COOKIE_NAME', 'pe_admin_sid');
}

/**
 * Encrypt data using AES-256-CBC
 */
function pe_session_encrypt($data)
{
    $key = hash('sha256', PE_SESSION_SECRET, true);
    $iv = openssl_random_pseudo_bytes(16);
    $encrypted = openssl_encrypt(serialize($data), 'aes-256-cbc', $key, OPENSSL_RAW_DATA, $iv);
    if ($encrypted === false)
        return null;
    return base64_encode($iv . $encrypted);
}

/**
 * Decrypt data using AES-256-CBC
 */
function pe_session_decrypt($payload)
{
    if (empty($payload))
        return null;
    $key = hash('sha256', PE_SESSION_SECRET, true);
    $raw = base64_decode($payload, true);
    if ($raw === false || strlen($raw) < 17)
        return null;
    $iv = substr($raw, 0, 16);
    $encrypted = substr($raw, 16);
    $decrypted = openssl_decrypt($encrypted, 'aes-256-cbc', $key, OPENSSL_RAW_DATA, $iv);
    if ($decrypted === false)
        return null;
    $data = @unserialize($decrypted);
    return $data !== false ? $data : null;
}

/**
 * Generate a secure random session token
 */
function pe_session_generate_token()
{
    return bin2hex(random_bytes(32));
}

/**
 * Get the current session token from cookie
 */
function pe_session_get_token()
{
    return $_COOKIE[PE_COOKIE_NAME] ?? null;
}

/**
 * Get the decrypted admin session data from transient
 */
function pe_session_get()
{
    $token = pe_session_get_token();
    if (!$token)
        return null;
    $encrypted = get_transient('pe_sess_' . $token);
    if (!$encrypted)
        return null;
    return pe_session_decrypt($encrypted);
}

/**
 * Set (encrypt and store) admin session data in transient
 */
function pe_session_set($data, $token = null)
{
    if (!$token) {
        $token = pe_session_get_token();
    }
    if (!$token)
        return false;
    $encrypted = pe_session_encrypt($data);
    if (!$encrypted)
        return false;
    // Store for 24 hours (garbage collected by WP transients)
    set_transient('pe_sess_' . $token, $encrypted, 86400);
    return true;
}

/**
 * Create a new session: generate token, set cookie, store data
 */
function pe_session_create($data)
{
    $token = pe_session_generate_token();
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
    // Set cookie — expires when browser closes (maxage=0) 
    setcookie(PE_COOKIE_NAME, $token, [
        'expires' => 0,
        'path' => '/',
        'domain' => '',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    // Also set it in the current request so pe_session_get works immediately
    $_COOKIE[PE_COOKIE_NAME] = $token;
    // Store encrypted data
    pe_session_set($data, $token);
    return $token;
}

/**
 * Clear admin session data
 */
function pe_session_clear()
{
    $token = pe_session_get_token();
    if ($token) {
        delete_transient('pe_sess_' . $token);
    }
    // Expire the cookie
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
    setcookie(PE_COOKIE_NAME, '', [
        'expires' => time() - 86400,
        'path' => '/',
        'domain' => '',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    unset($_COOKIE[PE_COOKIE_NAME]);
}

/**
 * Generate session fingerprint (binds session to browser)
 */
function pe_session_fingerprint()
{
    $ua = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';
    return hash('sha256', $ua . '|' . PE_SESSION_SECRET);
}

// ── Session Validation on Each Request ──
add_action('init', function () {
    $admin = pe_session_get();
    if ($admin) {
        // Validate fingerprint
        if (!empty($admin['fingerprint']) && $admin['fingerprint'] !== pe_session_fingerprint()) {
            pe_session_clear();
            return;
        }


        // Update last activity
        $admin['last_activity'] = time();
        pe_session_set($admin);
    }
}, 1);

// ── AJAX: Session Heartbeat (called by JS every 30s) ──
function pe_admin_ajax_heartbeat()
{
    $admin = pe_session_get();
    if (!$admin || empty($admin['logged_in'])) {
        wp_send_json_error(['expired' => true]);
    }
    $admin['last_heartbeat'] = time();
    pe_session_set($admin);
    wp_send_json_success(['alive' => true]);
}
add_action('wp_ajax_pe_admin_heartbeat', 'pe_admin_ajax_heartbeat');
add_action('wp_ajax_nopriv_pe_admin_heartbeat', 'pe_admin_ajax_heartbeat');

// ── Constants ──
define('PE_AD_DIR', plugin_dir_path(__FILE__));
define('PE_AD_URL', plugin_dir_url(__FILE__));

// ══════════════════════════════════════
//  AWBENTRY TABLE INTEGRATION
//  All shipment data now comes from AWBENTRY
//  (populated directly by ERP system)
// ══════════════════════════════════════

/**
 * Get the latest status for an AWB from parcel_history
 */
function pe_awb_get_status($awbno)
{
    global $wpdb;
    return $wpdb->get_var($wpdb->prepare(
        "SELECT activity FROM parcel_history WHERE AWBNO = %d ORDER BY date DESC, time DESC LIMIT 1",
        intval($awbno)
    )) ?: '';
}

/**
 * Get delivery date from parcel_history (date of 'delivered' activity)
 */
function pe_awb_get_delivery_date($awbno)
{
    global $wpdb;
    return $wpdb->get_var($wpdb->prepare(
        "SELECT date FROM parcel_history WHERE AWBNO = %d AND LOWER(activity) LIKE '%%delivered%%' ORDER BY date DESC LIMIT 1",
        intval($awbno)
    )) ?: '';
}

/**
 * Auto-sync: Create 'SHIPMENT BOOKED' entries in parcel_history
 * for any AWBENTRY records that don't have one yet.
 */
function pe_sync_awbentry_parcel_history()
{
    global $wpdb;
    // 1. Sync new entries (Initial "SHIPMENT BOOKED")
    $new_entries = $wpdb->get_results(
        "SELECT a.AWBNO, a.AWBDATE, a.ORIGIN
         FROM AWBENTRY a
         LEFT JOIN parcel_history ph ON ph.AWBNO = a.AWBNO
         WHERE ph.HISTORYID IS NULL
         LIMIT 50"
    );
    // Writes to parcel_history are DISABLED by user directive
    $count = 0;

    // 2. Proactive Sync: Fetch status for entries that only have "SHIPMENT BOOKED" but have AUTOTRACK enabled
    // We only process a few at a time to avoid slowing down the cron
    $pending_sync = $wpdb->get_results(
        "SELECT a.*, a.AWBNO as AWBNO_STR 
         FROM AWBENTRY a
         INNER JOIN (
            SELECT AWBNO FROM parcel_history 
            GROUP BY AWBNO 
            HAVING COUNT(*) = 1 AND MAX(activity) = 'SHIPMENT BOOKED'
         ) ph_only ON ph_only.AWBNO = a.AWBNO
         WHERE a.AUTOTRACK = 1
         LIMIT 50"
    );

    foreach ($pending_sync as $a) {
        // Construct a temporary object for pe_fetch_tracking
        $c = new stdClass();
        $c->AWBNO = strval($a->AWBNO);
        $c->VENDORID1 = $a->VENDORAWB1 ?: '';
        $c->VENDORID2 = $a->VENDORAWB2 ?: '';
        $c->VENDCODE = $a->VENDCODE ?: '';
        $c->VENDNAME = $a->VENDNAME ?: '';
        $c->SERVICE = intval($a->SERVICE ?? 0);
        $c->API = 1;
        $c->TUSER = $a->TUSER ?: '';
        $c->TPASS = $a->TPASS ?: '';
        $c->ACCODE = $a->ACCODE ?: '';
        $c->APIKEY = $a->APIKEY ?: '';

        if (function_exists('pe_fetch_tracking')) {
            $tracking = pe_fetch_tracking($c);
            if (!empty($c->STATUS) && strtolower($c->STATUS) !== 'shipment booked') {
                pe_cache_tracking_status(intval($a->AWBNO), $c->STATUS, $tracking);
            }
        }
    }

    return $count;
}

// ── WP Cron: Auto-sync AWBENTRY → parcel_history every 2 minutes ──
add_action('pe_awbentry_sync_cron', 'pe_sync_awbentry_parcel_history');

if (!wp_next_scheduled('pe_awbentry_sync_cron')) {
    wp_schedule_event(time(), 'pe_every_2_min', 'pe_awbentry_sync_cron');
}

add_filter('cron_schedules', function ($schedules) {
    $schedules['pe_every_2_min'] = [
        'interval' => 120,
        'display' => 'Every 2 Minutes'
    ];
    return $schedules;
});

// ── One-time: Add index on parcel_history (DISABLED BY USER DIRECTIVE) ──

// ══════════════════════════════════════
//  SECURITY: IP Whitelist
// ══════════════════════════════════════
function pe_admin_get_client_ip()
{
    // Get real IP behind proxies
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $ips = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
        $ip = trim($ips[0]);
    } elseif (!empty($_SERVER['HTTP_X_REAL_IP'])) {
        $ip = $_SERVER['HTTP_X_REAL_IP'];
    }
    return sanitize_text_field($ip);
}

function pe_admin_is_ip_whitelisted()
{
    return true;
}

function pe_admin_whitelist_ip($ip)
{
    $whitelist = get_option('pe_admin_ip_whitelist', []);
    if (!is_array($whitelist))
        $whitelist = [];
    if (!in_array($ip, $whitelist, true)) {
        $whitelist[] = $ip;
        update_option('pe_admin_ip_whitelist', $whitelist);
    }
}

function pe_admin_remove_whitelisted_ip($ip)
{
    $whitelist = get_option('pe_admin_ip_whitelist', []);
    if (!is_array($whitelist))
        return;
    $whitelist = array_values(array_diff($whitelist, [$ip]));
    update_option('pe_admin_ip_whitelist', $whitelist);
}

// ══════════════════════════════════════
//  SECURITY: Rate Limiting (stricter)
// ══════════════════════════════════════
function pe_admin_rate_limit_check($ip)
{
    $key = 'pe_login_attempts_' . md5($ip);
    $attempts = get_transient($key);
    if ($attempts === false)
        return true;
    return intval($attempts) < 3; // Max 3 attempts per 30 min
}
function pe_admin_rate_limit_record($ip)
{
    $key = 'pe_login_attempts_' . md5($ip);
    $attempts = get_transient($key);
    $attempts = $attempts ? intval($attempts) + 1 : 1;
    set_transient($key, $attempts, 1800); // 30 min window
}
function pe_admin_rate_limit_clear($ip)
{
    delete_transient('pe_login_attempts_' . md5($ip));
}

// ══════════════════════════════════════
//  SECURITY: Security Headers
// ══════════════════════════════════════
function pe_admin_security_headers()
{
    if (headers_sent())
        return;
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('X-XSS-Protection: 1; mode=block');
    header('Referrer-Policy: strict-origin-when-cross-origin');
}

// ══════════════════════════════════════
//  AUTH HELPERS
// ══════════════════════════════════════
function pe_admin_is_logged_in()
{
    $admin = pe_session_get();
    return !empty($admin['logged_in']);
}
function pe_admin_get_user()
{
    $admin = pe_session_get();
    return (!empty($admin['logged_in'])) ? $admin : null;
}
function pe_admin_check_ajax()
{
    if (!pe_admin_is_logged_in()) {
        wp_send_json_error(['message' => 'Session expired. Please login again.', 'expired' => true, 'new_nonce' => wp_create_nonce('pe_admin_nonce')], 401);
    }

    if (!check_ajax_referer('pe_admin_nonce', 'nonce', false)) {
        wp_send_json_error(['message' => 'Session token expired. Refreshing...', 'nonce_expired' => true, 'new_nonce' => wp_create_nonce('pe_admin_nonce')], 403);
    }
}

// ══════════════════════════════════════
//  PASSWORD HASHING HELPERS (bcrypt)
// ══════════════════════════════════════
function pe_admin_verify_password($input_pwd, $stored_hash)
{
    // Check if stored hash is bcrypt
    if (strpos($stored_hash, '$2y$') === 0 || strpos($stored_hash, '$2a$') === 0) {
        return password_verify($input_pwd, $stored_hash);
    }
    // Legacy MD5 check
    return md5($input_pwd) === $stored_hash;
}

function pe_admin_needs_rehash($stored_hash)
{
    // MD5 hashes are 32 hex chars; bcrypt starts with $2y$ or $2a$
    return (strpos($stored_hash, '$2y$') !== 0 && strpos($stored_hash, '$2a$') !== 0);
}

// ══════════════════════════════════════
//  ENQUEUE ASSETS
// ══════════════════════════════════════
function pe_ad_enqueue()
{
    wp_enqueue_style('pe-ad-fonts', 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap', [], null);
    wp_enqueue_style('pe-ad-fa', 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css', [], '6.5.1');
    wp_register_script('pe-ad-config', '', [], false, false);
    wp_enqueue_script('pe-ad-config');
    wp_localize_script('pe-ad-config', 'PE_AD', [
        'ajax_url' => admin_url('admin-ajax.php'),
        'nonce' => wp_create_nonce('pe_admin_nonce'),
        'logo_url' => PE_LOGO_URL,
    ]);
}
add_action('wp_enqueue_scripts', 'pe_ad_enqueue');

// ══════════════════════════════════════
//  REMEMBER DEVICE HELPERS (15-day cookie)
// ══════════════════════════════════════
function pe_get_device_token()
{
    $ua = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';
    return hash('sha256', $ua . '|' . PE_SESSION_SECRET . '|pe_device_trust');
}

function pe_is_device_remembered()
{
    if (empty($_COOKIE['pe_device_trust']))
        return false;
    $stored = get_option('pe_trusted_devices', []);
    $token = pe_get_device_token();
    if (isset($stored[$token]) && $stored[$token] > time()) {
        return true;
    }
    return false;
}

function pe_remember_device()
{
    $token = pe_get_device_token();
    $stored = get_option('pe_trusted_devices', []);
    if (!is_array($stored))
        $stored = [];
    // Clean expired entries
    foreach ($stored as $k => $exp) {
        if ($exp < time())
            unset($stored[$k]);
    }
    $stored[$token] = time() + (15 * 86400); // 15 days
    update_option('pe_trusted_devices', $stored);
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
    setcookie('pe_device_trust', $token, time() + (15 * 86400), '/', '', $secure, true);
}

// ══════════════════════════════════════
//  OTP EMAIL SYSTEM (PHP mail)
// ══════════════════════════════════════
define('PE_OTP_EMAIL', 'surajsabu2807@gmail.com , talatiaadil2003@gmail.com, prince.express@hotmail.com');

function pe_send_otp($purpose = 'verify')
{
    $otp = str_pad(random_int(100000, 999999), 6, '0', STR_PAD_LEFT);
    $token = pe_session_get_token();
    $key = 'pe_otp_' . md5($purpose . '_' . ($token ?: 'anon'));
    set_transient($key, $otp, 300); // Expires in 5 minutes

    $subject = 'Prince Express Admin - Verification Code';
    $message = "
    <html><body style='font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;'>
    <div style='max-width:460px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);'>
        <div style='background:linear-gradient(135deg,#bb0013,#d4001a);padding:24px 32px;'>
            <h2 style='color:#fff;margin:0;font-size:20px;'>Prince Express</h2>
            <p style='color:rgba(255,255,255,.8);margin:4px 0 0;font-size:13px;'>Admin Security Verification</p>
        </div>
        <div style='padding:32px;'>
            <p style='color:#333;font-size:15px;margin:0 0 20px;'>Your one-time verification code is:</p>
            <div style='background:#f8f9fa;border:2px dashed #bb0013;border-radius:10px;padding:20px;text-align:center;margin-bottom:20px;'>
                <span style='font-size:36px;font-weight:900;letter-spacing:8px;color:#bb0013;font-family:monospace;'>$otp</span>
            </div>
            <p style='color:#666;font-size:13px;margin:0;'>This code expires in <strong>5 minutes</strong>. Do not share it with anyone.</p>
        </div>
        <div style='background:#fafafa;padding:16px 32px;border-top:1px solid #eee;'>
            <p style='color:#999;font-size:11px;margin:0;text-align:center;'>Prince Express Command Center &bull; Secure Protocol V3.0</p>
        </div>
    </div>
    </body></html>";

    $headers = ['Content-Type: text/html; charset=UTF-8'];
    // Try to send, but return the OTP regardless so we can debug
    $sent = wp_mail(PE_OTP_EMAIL, $subject, $message, $headers);
    return $otp; // Always return OTP so the login handler can show it in debug console
}

function pe_verify_otp($purpose, $input_otp)
{
    $token = pe_session_get_token();
    $key = 'pe_otp_' . md5($purpose . '_' . ($token ?: 'anon'));
    $stored = get_transient($key);
    if (!$stored)
        return false;
    if ($stored === $input_otp) {
        delete_transient($key);
        return true;
    }
    return false;
}

// ══════════════════════════════════════
//  AJAX: SEND OTP
// ══════════════════════════════════════
function pe_admin_ajax_send_otp()
{
    if (!check_ajax_referer('pe_admin_nonce', 'nonce', false)) {
        wp_send_json_error(['message' => 'Security token expired. Please refresh.', 'nonce_expired' => true, 'new_nonce' => wp_create_nonce('pe_admin_nonce')]);
    }
    $purpose = sanitize_text_field($_POST['purpose'] ?? 'verify');
    $allowed_purposes = ['password_change', 'login', 'first_login'];
    if (!in_array($purpose, $allowed_purposes)) {
        wp_send_json_error(['message' => 'Invalid request']);
    }
    $result = pe_send_otp($purpose);
    if ($result) {
        wp_send_json_success(['message' => 'OTP sent to your registered email']);
    } else {
        wp_send_json_error(['message' => 'Failed to send OTP. Please try again.']);
    }
}
add_action('wp_ajax_pe_admin_send_otp', 'pe_admin_ajax_send_otp');
add_action('wp_ajax_nopriv_pe_admin_send_otp', 'pe_admin_ajax_send_otp');

// ══════════════════════════════════════
//  AJAX: VERIFY OTP
// ══════════════════════════════════════
function pe_admin_ajax_verify_otp()
{
    if (!check_ajax_referer('pe_admin_nonce', 'nonce', false)) {
        wp_send_json_error(['message' => 'Security token expired. Please refresh.', 'nonce_expired' => true, 'new_nonce' => wp_create_nonce('pe_admin_nonce')]);
    }
    $purpose = sanitize_text_field($_POST['purpose'] ?? '');
    $otp = sanitize_text_field($_POST['otp'] ?? '');
    if (!$purpose || !$otp) {
        wp_send_json_error(['message' => 'OTP is required']);
    }
    if (pe_verify_otp($purpose, $otp)) {
        // If verifying login OTP, set session as fully verified
        if ($purpose === 'login' || $purpose === 'first_login') {
            $admin = pe_session_get();
            if ($admin) {
                $admin['otp_verified'] = true;
                pe_session_set($admin);
            }
            // Check if remember device was requested
            if (!empty($_POST['remember_device'])) {
                pe_remember_device();
            }
        }
        wp_send_json_success(['message' => 'OTP verified successfully', 'new_nonce' => wp_create_nonce('pe_admin_nonce')]);
    } else {
        wp_send_json_error(['message' => 'Invalid or expired OTP. Please try again.']);
    }
}
add_action('wp_ajax_pe_admin_verify_otp', 'pe_admin_ajax_verify_otp');
add_action('wp_ajax_nopriv_pe_admin_verify_otp', 'pe_admin_ajax_verify_otp');

// ══════════════════════════════════════
//  AJAX: LOGIN (with bcrypt migration + OTP on every login)
// ══════════════════════════════════════
function pe_admin_ajax_login()
{
    // Nonce check — if this fails, WP sends 403 before we get here
    if (!check_ajax_referer('pe_admin_nonce', 'nonce', false)) {
        wp_send_json_error(['message' => 'Security token expired. Please refresh the page.', 'debug' => 'nonce_failed'], 403);
    }
    // ── ADD THIS BLOCK ──
    $recaptcha = $_POST['g-recaptcha-response'] ?? '';
    if (empty($recaptcha)) {
        wp_send_json_error(['message' => 'Please complete reCAPTCHA', 'debug' => 'recaptcha_missing']);
    }
    $verify = wp_remote_post('https://www.google.com/recaptcha/api/siteverify', [
        'body' => [
            'secret' => '6LfHGLgsAAAAAC-lg9PcOwN4uVu-OBXwbFUTvhXm',
            'response' => $recaptcha,
            'remoteip' => pe_admin_get_client_ip()
        ],
        'timeout' => 10
    ]);
    if (is_wp_error($verify)) {
        wp_send_json_error(['message' => 'reCAPTCHA check failed (network)']);
    }
    $body = json_decode(wp_remote_retrieve_body($verify), true);
    if (empty($body['success'])) {
        wp_send_json_error(['message' => 'reCAPTCHA verification failed', 'debug' => implode(',', $body['error-codes'] ?? [])]);
    }
    // ── END RECAPTCHA BLOCK ──

    $ip = pe_admin_get_client_ip();

    // Rate limit check
    if (!pe_admin_rate_limit_check($ip)) {
        wp_send_json_error(['message' => 'Too many failed attempts. Try again in 30 minutes.', 'debug' => 'rate_limited', 'ip' => $ip]);
    }

    global $wpdb;
    $uname = sanitize_text_field($_POST['uname'] ?? '');
    $pwd = $_POST['pwd'] ?? '';
    if (!$uname || !$pwd) {
        wp_send_json_error(['message' => 'Credentials required', 'debug' => 'empty_fields']);
    }
    if (!preg_match('/^[a-zA-Z0-9_@.\-]{2,50}$/', $uname)) {
        pe_admin_rate_limit_record($ip);
        wp_send_json_error(['message' => 'Invalid credentials', 'debug' => 'username_format_invalid']);
    }

    // Check if table exists
    $table_exists = $wpdb->get_var("SHOW TABLES LIKE 'tbl_admin'");
    if (!$table_exists) {
        wp_send_json_error(['message' => 'System not initialized. Please contact admin.', 'debug' => 'tbl_admin_missing']);
    }

    $row = $wpdb->get_row($wpdb->prepare(
        "SELECT * FROM tbl_admin WHERE uname = %s",
        $uname
    ));

    if (!$row) {
        pe_admin_rate_limit_record($ip);
        wp_send_json_error(['message' => 'Invalid credentials', 'debug' => 'user_not_found', 'uname' => $uname]);
    }

    if (!pe_admin_verify_password($pwd, $row->pwd)) {
        pe_admin_rate_limit_record($ip);
        $hash_type = (strpos($row->pwd, '$2y$') === 0 || strpos($row->pwd, '$2a$') === 0) ? 'bcrypt' : 'md5';
        wp_send_json_error(['message' => 'Invalid credentials', 'debug' => 'password_mismatch', 'hash_type' => $hash_type]);
    }

    // Auto-upgrade MD5 to bcrypt on successful login
    if (pe_admin_needs_rehash($row->pwd)) {
        $new_hash = password_hash($pwd, PASSWORD_BCRYPT, ['cost' => 12]);
        $wpdb->update('tbl_admin', ['pwd' => $new_hash], ['uname' => $row->uname]);
    }

    // Success: clear rate limit, create new session (cookie + transient)
    pe_admin_rate_limit_clear($ip);

    pe_session_create([
        'uname' => $row->uname,
        'logged_in' => true,
        'login_at' => time(),
        'last_activity' => time(),
        'last_heartbeat' => time(),
        'ip' => $ip,
        'fingerprint' => pe_session_fingerprint(),
        'otp_verified' => true, // OTP disabled
    ]);
    $wpdb->update('tbl_admin', [
        'last_login' => current_time('mysql'),
    ], ['uname' => $row->uname]);

    wp_send_json_success(['message' => 'Authorized! Redirecting...', 'new_nonce' => wp_create_nonce('pe_admin_nonce')]);
}
add_action('wp_ajax_pe_admin_login', 'pe_admin_ajax_login');
add_action('wp_ajax_nopriv_pe_admin_login', 'pe_admin_ajax_login');

// ══════════════════════════════════════
//  AJAX: LOGOUT
// ══════════════════════════════════════
function pe_admin_ajax_logout()
{
    pe_session_clear();
    wp_send_json_success();
}
add_action('wp_ajax_pe_admin_logout', 'pe_admin_ajax_logout');
add_action('wp_ajax_nopriv_pe_admin_logout', 'pe_admin_ajax_logout');

// ══════════════════════════════════════
//  AJAX: SHIPMENTS LIST (reads from AWBENTRY — optimized)
// ══════════════════════════════════════
function pe_admin_ajax_shipments()
{
    pe_admin_check_ajax();
    @set_time_limit(120); // Allow extra time for vendor API calls
    global $wpdb;
    $page = max(1, intval($_POST['page'] ?? 1));
    $per = 25;
    $offset = ($page - 1) * $per;
    $search = sanitize_text_field($_POST['search'] ?? '');
    $status = sanitize_text_field($_POST['status'] ?? '');

    $valid_statuses = ['', 'delivered', 'transit', 'booked', 'delayed'];
    if (!in_array($status, $valid_statuses))
        $status = '';

    // ── Search condition (no correlated subqueries) ──
    $search_where = '';
    if ($search) {
        $like = '%' . $wpdb->esc_like($search) . '%';
        $search_where = $wpdb->prepare(
            " AND (CAST(a.AWBNO AS CHAR) LIKE %s OR a.CNEENAME LIKE %s OR a.DESTNAME LIKE %s OR a.SNAME LIKE %s OR CAST(a.AWBDATE AS CHAR) LIKE %s OR a.VENDORAWB1 LIKE %s OR a.VENDORAWB2 LIKE %s OR a.VENDNAME LIKE %s OR a.CUSTNAME LIKE %s OR a.ORIGIN LIKE %s)",
            $like,
            $like,
            $like,
            $like,
            $like,
            $like,
            $like,
            $like,
            $like,
            $like
        );
    }

    // ── Fast total count (no subquery) ──
    $count_all = intval($wpdb->get_var("SELECT COUNT(*) FROM AWBENTRY a WHERE 1=1" . $search_where));

    // ── Get all counts in ONE query using a single pass ──
    $counts_row = $wpdb->get_row(
        "SELECT
            SUM(CASE WHEN LOWER(COALESCE(ls, '')) LIKE '%delivered%' THEN 1 ELSE 0 END) as del_c,
            SUM(CASE WHEN LOWER(COALESCE(ls, '')) LIKE '%transit%'
                      OR LOWER(COALESCE(ls, '')) LIKE '%departed%'
                      OR LOWER(COALESCE(ls, '')) LIKE '%dispatched%' THEN 1 ELSE 0 END) as trn_c,
            SUM(CASE WHEN ls IS NULL OR ls = ''
                      OR LOWER(ls) LIKE '%booked%'
                      OR LOWER(ls) LIKE '%received%' THEN 1 ELSE 0 END) as bk_c
         FROM (
            SELECT (SELECT ph.activity FROM parcel_history ph
                    WHERE ph.AWBNO = a.AWBNO ORDER BY ph.date DESC, ph.time DESC LIMIT 1) as ls
            FROM AWBENTRY a WHERE 1=1 $search_where
         ) counts_sub"
    );
    $count_delivered = intval($counts_row->del_c ?? 0);
    $count_transit = intval($counts_row->trn_c ?? 0);
    $count_booked = intval($counts_row->bk_c ?? 0);

    // ── Status filter: use a lightweight approach ──
    $status_filter = '';
    if ($status === 'delivered') {
        $status_filter = " AND a.AWBNO IN (SELECT ph.AWBNO FROM parcel_history ph WHERE LOWER(ph.activity) LIKE '%delivered%')";
    } elseif ($status === 'transit') {
        $status_filter = " AND a.AWBNO IN (SELECT ph.AWBNO FROM parcel_history ph WHERE LOWER(ph.activity) LIKE '%transit%' OR LOWER(ph.activity) LIKE '%departed%' OR LOWER(ph.activity) LIKE '%dispatched%')";
    } elseif ($status === 'booked') {
        $status_filter = " AND (a.AWBNO NOT IN (SELECT DISTINCT ph.AWBNO FROM parcel_history ph) OR a.AWBNO IN (SELECT ph.AWBNO FROM parcel_history ph WHERE LOWER(ph.activity) LIKE '%booked%'))";
    } elseif ($status === 'delayed') {
        $status_filter = " AND a.AWBNO NOT IN (SELECT ph.AWBNO FROM parcel_history ph WHERE LOWER(ph.activity) LIKE '%delivered%') AND a.AWBDATE < DATE_SUB(CURDATE(), INTERVAL 14 DAY)";
    }

    $full_where = "1=1" . $search_where . $status_filter;
    $total = intval($wpdb->get_var("SELECT COUNT(*) FROM AWBENTRY a WHERE $full_where"));

    // ── Get rows with vendor API fields for inline status fetch ──
    $sql = "SELECT a.AWBID as c_id, a.AWBNO, a.CNEENAME as CONSIGNEE, a.DESTNAME as DESTINATION,
                   a.CHARGEWEIGHT as WEIGHT, a.ACTUALWEIGHT, COALESCE(a.SERVICE, 0) as SERVICE,
                   a.VENDNAME as vendor, COALESCE(a.SHOWFWD, 0) as SHOWFWD,
                   a.VENDORAWB1 as VENDORID1, a.VENDORAWB2 as VENDORID2,
                   a.AWBDATE as BOOKINGDATE, COALESCE(a.AUTOTRACK, 0) as autotrack,
                   a.PRODCODE, a.PRODNAME,
                   a.SNAME, a.CUSTNAME, a.SPHONE1,
                   a.VENDORAWB1,
                   a.VENDCODE, a.TUSER, a.TPASS, a.ACCODE, a.APIKEY
            FROM AWBENTRY a
            WHERE $full_where ORDER BY a.AWBID DESC LIMIT " . intval($per) . " OFFSET " . intval($offset);
    $rows = $wpdb->get_results($sql);

    // ── Get status per-row, fetch live vendor status for non-delivered rows ──
    $data = [];
    foreach ($rows as $r) {
        $row_status = pe_awb_get_status(intval($r->AWBNO));

        // Re-fetch from vendor API for any non-delivered status (not just booked)
        $status_lower = strtolower($row_status ?: '');
        $is_delivered = strpos($status_lower, 'deliver') !== false;

        if (!$is_delivered && intval($r->SERVICE) > 0 && function_exists('pe_fetch_tracking')) {
            $c = new stdClass();
            $c->AWBNO = strval($r->AWBNO);
            $c->VENDORID1 = $r->VENDORID1 ?: '';
            $c->VENDORID2 = $r->VENDORID2 ?: '';
            $c->VENDCODE = $r->VENDCODE ?: '';
            $c->VENDNAME = $r->vendor ?: '';
            $c->SERVICE = intval($r->SERVICE);
            $c->API = 1;
            $c->TUSER = $r->TUSER ?: '';
            $c->TPASS = $r->TPASS ?: '';
            $c->ACCODE = $r->ACCODE ?: '';
            $c->APIKEY = $r->APIKEY ?: '';

            $tracking = pe_fetch_tracking($c);

            if (!empty($c->STATUS) && strtolower($c->STATUS) !== 'shipment booked') {
                pe_cache_tracking_status(intval($r->AWBNO), $c->STATUS, $tracking);
                $row_status = $c->STATUS;
            }
        }

        $data[] = [
            'c_id' => $r->c_id,
            'awb' => $r->AWBNO,
            'consignee' => $r->CONSIGNEE,
            'destination' => $r->DESTINATION,
            'weight' => $r->ACTUALWEIGHT ?: $r->WEIGHT,
            'service' => intval($r->SERVICE),
            'status' => $row_status ?: 'SHIPMENT BOOKED',
            'vendor' => $r->vendor ?? '',
            'showfwd' => intval($r->SHOWFWD ?? 0),
            'vendorid1' => $r->VENDORID1 ?? '',
            'vendorid2' => $r->VENDORID2 ?? '',
            'booking_date' => $r->BOOKINGDATE,
            'autotrack' => $r->autotrack ?? '',
            'prodcode' => $r->PRODCODE ?? '',
            'prodname' => $r->PRODNAME ?? '',
            'shipper' => $r->SNAME ?? '',
            'customer' => $r->CUSTNAME ?? '',
            'vendor_awb1' => $r->VENDORAWB1 ?? '',
        ];
    }
    wp_send_json_success([
        'rows' => $data,
        'total' => $total,
        'pages' => max(1, ceil($total / $per)),
        'page' => $page,
        'counts' => [
            'all' => $count_all,
            'transit' => $count_transit,
            'delivered' => $count_delivered,
            'booked' => $count_booked,
        ],
    ]);
}
add_action('wp_ajax_pe_admin_shipments', 'pe_admin_ajax_shipments');
add_action('wp_ajax_nopriv_pe_admin_shipments', 'pe_admin_ajax_shipments');

// ══════════════════════════════════════
//  AJAX: BATCH SYNC STATUS (fetches live vendor status for visible rows)
//  Called automatically after shipment table loads to fix stale "Booked" statuses
// ══════════════════════════════════════
function pe_admin_ajax_batch_sync_status()
{
    pe_admin_check_ajax();
    global $wpdb;

    $awbs_raw = $_POST['awbs'] ?? '';
    if (empty($awbs_raw)) {
        wp_send_json_error(['message' => 'No AWBs provided']);
    }

    // Parse comma-separated AWB numbers
    $awbs = array_filter(array_map('intval', explode(',', $awbs_raw)));
    if (empty($awbs)) {
        wp_send_json_error(['message' => 'Invalid AWBs']);
    }

    // Limit to 30 at a time to avoid timeouts
    $awbs = array_slice($awbs, 0, 30);

    $updated = [];

    foreach ($awbs as $awb_int) {
        // Get AWBENTRY record
        $a = $wpdb->get_row($wpdb->prepare("SELECT * FROM AWBENTRY WHERE AWBNO = %d", $awb_int));
        if (!$a || intval($a->SERVICE ?? 0) <= 0) {
            // No vendor service configured, use parcel_history as-is
            $current = pe_awb_get_status($awb_int);
            $updated[$awb_int] = $current ?: 'SHIPMENT BOOKED';
            continue;
        }

        // Check current status — skip only if already delivered (final state)
        $current = pe_awb_get_status($awb_int);
        $current_lower = strtolower($current ?: '');
        $is_delivered = strpos($current_lower, 'deliver') !== false;

        if ($is_delivered) {
            // Delivered is a final state, no need to re-fetch
            $updated[$awb_int] = $current;
            continue;
        }

        // Build object for pe_fetch_tracking
        if (!function_exists('pe_fetch_tracking')) {
            $updated[$awb_int] = $current ?: 'SHIPMENT BOOKED';
            continue;
        }

        $c = new stdClass();
        $c->AWBNO = strval($a->AWBNO);
        $c->VENDORID1 = $a->VENDORAWB1 ?: '';
        $c->VENDORID2 = $a->VENDORAWB2 ?: '';
        $c->VENDCODE = $a->VENDCODE ?: '';
        $c->VENDNAME = $a->VENDNAME ?: '';
        $c->SERVICE = intval($a->SERVICE ?? 0);
        $c->API = 1;
        $c->TUSER = $a->TUSER ?: '';
        $c->TPASS = $a->TPASS ?: '';
        $c->ACCODE = $a->ACCODE ?: '';
        $c->APIKEY = $a->APIKEY ?: '';

        $tracking = pe_fetch_tracking($c);

        if (!empty($c->STATUS) && strtolower($c->STATUS) !== 'shipment booked') {
            pe_cache_tracking_status($awb_int, $c->STATUS, $tracking);
            $updated[$awb_int] = $c->STATUS;
        } else {
            $updated[$awb_int] = $current ?: 'SHIPMENT BOOKED';
        }
    }

    wp_send_json_success(['statuses' => $updated]);
}
add_action('wp_ajax_pe_admin_batch_sync_status', 'pe_admin_ajax_batch_sync_status');
add_action('wp_ajax_nopriv_pe_admin_batch_sync_status', 'pe_admin_ajax_batch_sync_status');

// ══════════════════════════════════════
//  AJAX: SHIPMENT DETAIL (reads from AWBENTRY)
// ══════════════════════════════════════

// Origin/branch code → full city name mapping
function pe_origin_city($code)
{
    if (empty($code))
        return '';
    $map = [
        'SRT' => 'SURAT',
        'BOM' => 'MUMBAI',
        'DEL' => 'DELHI',
        'BLR' => 'BANGALORE',
        'HYD' => 'HYDERABAD',
        'CCU' => 'KOLKATA',
        'MAA' => 'CHENNAI',
        'PNQ' => 'PUNE',
        'AMD' => 'AHMEDABAD',
        'LKO' => 'LUCKNOW',
        'JAI' => 'JAIPUR',
        'GOI' => 'GOA',
        'IDR' => 'INDORE',
        'NAG' => 'NAGPUR',
        'COK' => 'KOCHI',
        'BDQ' => 'VADODARA',
        'RAJ' => 'RAJKOT',
        'GNR' => 'GANDHINAGAR',
        'MTX' => 'SURAT',
    ];
    $u = strtoupper(trim($code));
    return $map[$u] ?? $u;
}

// Persist latest vendor API status to parcel_history for list view caching
function pe_cache_tracking_status($awb_int, $status, $tracking_data = [])
{
    if (empty($status) || strtolower($status) === 'shipment booked')
        return;
    global $wpdb;

    // Check if we already have this status cached
    $existing = $wpdb->get_var($wpdb->prepare(
        "SELECT activity FROM parcel_history WHERE AWBNO = %d ORDER BY date DESC, time DESC LIMIT 1",
        $awb_int
    ));
    if (strtolower(trim($existing ?? '')) === strtolower(trim($status)))
        return;

    // Writes to parcel_history are DISABLED by user directive
    return;
}

function pe_admin_ajax_shipment_detail()
{
    pe_admin_check_ajax();
    global $wpdb;
    $awb = sanitize_text_field($_POST['awb'] ?? '');
    if (!$awb || !preg_match('/^[a-zA-Z0-9\-]{1,30}$/', $awb)) {
        wp_send_json_error(['message' => 'Invalid AWB']);
    }

    // Query AWBENTRY — get ALL columns
    $a = $wpdb->get_row($wpdb->prepare("SELECT * FROM AWBENTRY WHERE AWBNO = %d", intval($awb)));

    // Fallback to old consignee table for legacy data
    if (!$a) {
        $c = $wpdb->get_row($wpdb->prepare("SELECT * FROM consignee WHERE AWBNO = %s", $awb));
        if (!$c)
            wp_send_json_error(['message' => 'Not found']);
        $tracking = [];
        if (intval($c->API ?? 0) == 1 && function_exists('pe_fetch_tracking')) {
            $tracking = pe_fetch_tracking($c);
        } else {
            $rows = $wpdb->get_results($wpdb->prepare(
                "SELECT * FROM parcel_history WHERE AWBNO = %d ORDER BY date DESC, time DESC",
                intval($awb)
            ));
            foreach ($rows as $rw) {
                $tracking[] = [
                    'date' => $rw->date ? date('M d, Y', strtotime($rw->date)) : '',
                    'time' => $rw->time ? date('h:i A', strtotime($rw->time)) : '',
                    'location' => $rw->location ?? '',
                    'activity' => $rw->activity ?? '',
                ];
            }
        }
        wp_send_json_success(['consignee' => $c, 'tracking' => $tracking]);
        return;
    }

    // ── Build full response object from AWBENTRY ──
    $c = new stdClass();

    // Core shipment info
    $c->c_id = $a->AWBID;
    $c->AWBNO = strval($a->AWBNO);
    $c->BOOKINGDATE = $a->AWBDATE;
    $c->SERVICE = intval($a->SERVICE ?? 0);
    $c->SHOWFWD = intval($a->SHOWFWD ?? 0);

    // Consignee info
    $c->CONSIGNEE = $a->CNEENAME;
    $c->DESTINATION = $a->DESTNAME;
    $c->PHONE = $a->CNEEPHONE1 ?: '';
    $c->PHONE2 = $a->CNEEPHONE2 ?: '';
    $c->consignee_address1 = $a->CNEEADDRESS1 ?: '';
    $c->consignee_address2 = $a->CNEEADDRESS2 ?: '';
    $c->consignee_address3 = $a->CNEEADDRESS3 ?: '';
    $c->consignee_address4 = $a->CNEEADDRESS4 ?: '';
    $c->consignee_city = $a->CNEECITY ?: '';
    $c->consignee_pincode = $a->CNEEPINCODE ?: '';
    $c->consignee_country = $a->DESTNAME ?: '';

    // Vendor & product details
    $c->VENDORID1 = $a->VENDORAWB1 ?: '';
    $c->VENDORID2 = $a->VENDORAWB2 ?: '';
    $c->VENDCODE = $a->VENDCODE ?: '';
    $c->VENDNAME = $a->VENDNAME ?: '';
    $c->DESTCODE = $a->DESTCODE ?: '';
    $c->PRODCODE = $a->PRODCODE ?: '';
    $c->PRODNAME = $a->PRODNAME ?: '';

    // Booked by (shipper) details
    $c->SNAME = $a->SNAME ?: '';
    $c->SADDRESS1 = $a->SADDRESS1 ?: '';
    $c->SADDRESS2 = $a->SADDRESS2 ?: '';
    $c->SADDRESS3 = $a->SADDRESS3 ?: '';
    $c->SCITY = $a->SCITY ?: '';
    $c->SPINCODE = $a->SPINCODE ?: '';
    $c->SPHONE1 = $a->SPHONE1 ?: '';
    $c->SPHONE2 = $a->SPHONE2 ?: '';

    // Package details
    $c->WEIGHT = $a->CHARGEWEIGHT;
    $c->ACTUALWEIGHT = $a->ACTUALWEIGHT;
    $c->pcs = $a->CARTONS;
    $c->PAYMENTTYPE = $a->PAYMENTTYPE ?: '';

    // Customer & origin
    $c->customer = $a->CUSTNAME ?: '';
    $c->CUSTCODE = $a->CUSTCODE ?: '';
    $c->origin = pe_origin_city($a->ORIGIN);

    // Internal fields (kept for vendor API calls, not displayed)
    $c->API = intval($a->AUTOTRACK ?? 0);
    $c->TUSER = $a->TUSER ?: '';
    $c->TPASS = $a->TPASS ?: '';
    $c->ACCODE = $a->ACCODE ?: '';
    $c->APIKEY = $a->APIKEY ?: '';
    $c->REMARKS = $a->REMARKS ?: '';

    // ── Tracking: try vendor API first for accurate live status ──
    $tracking = [];
    if (function_exists('pe_fetch_tracking') && intval($a->SERVICE ?? 0) > 0) {
        $orig_api = $c->API;
        $c->API = 1;
        $tracking = pe_fetch_tracking($c);
        $c->API = $orig_api;
    }

    // If vendor APIs returned nothing, fall back to parcel_history
    if (empty($tracking)) {
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM parcel_history WHERE AWBNO = %d ORDER BY date DESC, time DESC",
            intval($awb)
        ));
        foreach ($rows as $rw) {
            $loc = $rw->location ?? '';
            if (preg_match('/^\d+$/', trim($loc)))
                $loc = '';
            $tracking[] = [
                'date' => $rw->date ? date('M d, Y', strtotime($rw->date)) : '',
                'time' => $rw->time ? date('h:i A', strtotime($rw->time)) : '',
                'location' => $loc,
                'activity' => $rw->activity ?? '',
            ];
        }
    }

    // Status from pe_fetch_tracking (sets $c->STATUS directly) or parcel_history
    if (empty($c->STATUS)) {
        $c->STATUS = pe_awb_get_status(intval($awb));
    }
    if (empty($c->DELIVERYDATE) || $c->DELIVERYDATE === '0000-00-00') {
        $c->DELIVERYDATE = pe_awb_get_delivery_date(intval($awb));
    }
    if (empty($c->RECEIVER))
        $c->RECEIVER = '';
    $c->DELVTIME = '';

    // Cache the latest vendor API status to parcel_history for the list view
    if (!empty($c->STATUS)) {
        pe_cache_tracking_status(intval($awb), $c->STATUS, $tracking);
    }

    wp_send_json_success([
        'consignee' => $c,
        'tracking' => $tracking,
    ]);
}
add_action('wp_ajax_pe_admin_shipment_detail', 'pe_admin_ajax_shipment_detail');
add_action('wp_ajax_nopriv_pe_admin_shipment_detail', 'pe_admin_ajax_shipment_detail');

// ══════════════════════════════════════
//  AJAX: RATE LIST
// ══════════════════════════════════════
function pe_admin_ajax_rates()
{
    pe_admin_check_ajax();
    global $wpdb;
    $country = sanitize_text_field($_POST['country'] ?? '');
    if ($country) {
        $rows = $wpdb->get_results($wpdb->prepare("SELECT * FROM tbl_rate WHERE country = %s ORDER BY service", $country));
    } else {
        $rows = [];
    }
    $countries = $wpdb->get_col("SELECT DISTINCT country FROM tbl_rate ORDER BY country");
    wp_send_json_success(['rows' => $rows, 'countries' => $countries]);
}
add_action('wp_ajax_pe_admin_rates', 'pe_admin_ajax_rates');
add_action('wp_ajax_nopriv_pe_admin_rates', 'pe_admin_ajax_rates');

// ══════════════════════════════════════
//  AJAX: RATE SAVE (single field — kept for backward compat)
// ══════════════════════════════════════
function pe_admin_ajax_rate_save()
{
    pe_admin_check_ajax();
    global $wpdb;
    $rid = intval($_POST['rid'] ?? 0);
    $col = sanitize_text_field($_POST['col'] ?? '');
    $val = sanitize_text_field($_POST['val'] ?? '');
    $allowed = ['country', 'service', 'days', 'gm500', 'kg1', 'kg1_5', 'kg2', 'kg2_5', 'kg3', 'kg3_5', 'kg4', 'kg4_5', 'kg5', 'kg5_5', 'kg6', 'kg7_10', 'kg11_16', 'kg17_20', 'kg21_30', 'kg31_50', 'kg51_70', 'kg100p'];
    if (!$rid || !in_array($col, $allowed, true)) {
        wp_send_json_error(['message' => 'Invalid field']);
    }
    if ($col !== 'country' && $col !== 'service' && $col !== 'days') {
        if ($val !== '' && !is_numeric($val)) {
            wp_send_json_error(['message' => 'Rate must be numeric']);
        }
    }
    $res = $wpdb->update('tbl_rate', [$col => $val], ['Rid' => $rid]);
    wp_send_json_success(['updated' => $res !== false]);
}
add_action('wp_ajax_pe_admin_rate_save', 'pe_admin_ajax_rate_save');
add_action('wp_ajax_nopriv_pe_admin_rate_save', 'pe_admin_ajax_rate_save');

// ══════════════════════════════════════
//  AJAX: RATE SAVE ROW (bulk — saves entire row at once)
// ══════════════════════════════════════
function pe_admin_ajax_rate_save_row()
{
    pe_admin_check_ajax();
    global $wpdb;
    $rid = intval($_POST['rid'] ?? 0);
    if (!$rid)
        wp_send_json_error(['message' => 'Invalid rate ID']);

    $allowed = ['service', 'days', 'gm500', 'kg1', 'kg1_5', 'kg2', 'kg2_5', 'kg3', 'kg3_5', 'kg4', 'kg4_5', 'kg5', 'kg5_5', 'kg6', 'kg7_10', 'kg11_16', 'kg17_20', 'kg21_30', 'kg31_50', 'kg51_70', 'kg100p'];
    $update = [];
    foreach ($allowed as $col) {
        if (isset($_POST[$col])) {
            $val = sanitize_text_field($_POST[$col]);
            if ($col !== 'service' && $col !== 'days') {
                if ($val !== '' && !is_numeric($val)) {
                    wp_send_json_error(['message' => "Rate '$col' must be numeric"]);
                }
            }
            $update[$col] = $val;
        }
    }
    if (empty($update)) {
        wp_send_json_error(['message' => 'No data to save']);
    }
    $res = $wpdb->update('tbl_rate', $update, ['Rid' => $rid]);
    wp_send_json_success(['updated' => $res !== false]);
}
add_action('wp_ajax_pe_admin_rate_save_row', 'pe_admin_ajax_rate_save_row');
add_action('wp_ajax_nopriv_pe_admin_rate_save_row', 'pe_admin_ajax_rate_save_row');

// ══════════════════════════════════════
//  AJAX: RATE ADD / DELETE
// ══════════════════════════════════════
function pe_admin_ajax_rate_add()
{
    pe_admin_check_ajax();
    global $wpdb;
    $country = sanitize_text_field($_POST['country'] ?? '');
    $service = sanitize_text_field($_POST['service'] ?? '');
    if (!$country || !$service)
        wp_send_json_error(['message' => 'Country and service required']);
    $wpdb->insert('tbl_rate', ['country' => $country, 'service' => $service, 'days' => '5-7']);
    wp_send_json_success(['rid' => $wpdb->insert_id]);
}
add_action('wp_ajax_pe_admin_rate_add', 'pe_admin_ajax_rate_add');
add_action('wp_ajax_nopriv_pe_admin_rate_add', 'pe_admin_ajax_rate_add');

function pe_admin_ajax_rate_delete()
{
    pe_admin_check_ajax();
    global $wpdb;
    $rid = intval($_POST['rid'] ?? 0);
    if (!$rid)
        wp_send_json_error(['message' => 'Invalid rate ID']);
    $wpdb->delete('tbl_rate', ['Rid' => $rid]);
    wp_send_json_success();
}
add_action('wp_ajax_pe_admin_rate_delete', 'pe_admin_ajax_rate_delete');
add_action('wp_ajax_nopriv_pe_admin_rate_delete', 'pe_admin_ajax_rate_delete');

// ══════════════════════════════════════
//  AJAX: CSV EXPORT (reads from AWBENTRY)
// ══════════════════════════════════════
function pe_admin_ajax_export()
{
    pe_admin_check_ajax();
    global $wpdb;
    $search = sanitize_text_field($_POST['search'] ?? '');
    $status_sub = "(SELECT ph.activity FROM parcel_history ph WHERE ph.AWBNO = a.AWBNO ORDER BY ph.date DESC, ph.time DESC LIMIT 1)";
    $where = "1=1";
    if ($search) {
        $like = '%' . $wpdb->esc_like($search) . '%';
        $where .= $wpdb->prepare(
            " AND (CAST(a.AWBNO AS CHAR) LIKE %s OR a.CNEENAME LIKE %s OR a.DESTNAME LIKE %s OR a.SNAME LIKE %s OR CAST(a.AWBDATE AS CHAR) LIKE %s OR a.VENDORAWB1 LIKE %s OR a.VENDORAWB2 LIKE %s OR a.VENDNAME LIKE %s OR a.CUSTNAME LIKE %s OR a.ORIGIN LIKE %s)",
            $like, $like, $like, $like, $like, $like, $like, $like, $like, $like
        );
    }
    $sql = "SELECT a.AWBID as c_id, a.AWBNO, a.CNEENAME as CONSIGNEE, a.DESTNAME as DESTINATION,
                   a.CHARGEWEIGHT as WEIGHT, a.ACTUALWEIGHT, COALESCE(a.SERVICE, 0) as SERVICE,
                   COALESCE($status_sub, '') as STATUS,
                   a.AWBDATE as BOOKINGDATE,
                   a.VENDORAWB1 as VENDORID1, a.VENDORAWB2 as VENDORID2,
                   COALESCE(a.SHOWFWD, 0) as SHOWFWD, a.CNEEPHONE1 as PHONE,
                   a.ORIGIN, a.CUSTNAME as CUSTOMER, a.VENDNAME as VENDOR,
                   a.TOTAL as NETAMOUNT
            FROM AWBENTRY a WHERE $where ORDER BY a.AWBID DESC LIMIT 5000";
    $rows = $wpdb->get_results($sql, ARRAY_A);
    wp_send_json_success(['rows' => $rows]);
}
add_action('wp_ajax_pe_admin_export', 'pe_admin_ajax_export');
add_action('wp_ajax_nopriv_pe_admin_export', 'pe_admin_ajax_export');

// ══════════════════════════════════════
//  AJAX: PASSWORD CHANGE — Step 1: Validate & Send OTP
// ══════════════════════════════════════
function pe_admin_ajax_pwd_init()
{
    pe_admin_check_ajax();
    global $wpdb;
    $old = $_POST['old_pwd'] ?? '';
    $new = $_POST['new_pwd'] ?? '';
    if (!$old || !$new)
        wp_send_json_error(['message' => 'Both fields required']);
    if (strlen($new) < 8)
        wp_send_json_error(['message' => 'Password must be at least 8 characters']);

    if (!preg_match('/[A-Z]/', $new) || !preg_match('/[0-9]/', $new)) {
        wp_send_json_error(['message' => 'Password must contain at least one uppercase letter and one number']);
    }

    $admin = pe_session_get();
    $uname = $admin['uname'] ?? '';
    $row = $wpdb->get_row($wpdb->prepare(
        "SELECT * FROM tbl_admin WHERE uname = %s",
        $uname
    ));
    if (!$row || !pe_admin_verify_password($old, $row->pwd)) {
        wp_send_json_error(['message' => 'Current password is incorrect']);
    }

    // If device is remembered, skip OTP
    if (pe_is_device_remembered()) {
        $new_hash = password_hash($new, PASSWORD_BCRYPT, ['cost' => 12]);
        $wpdb->update('tbl_admin', ['pwd' => $new_hash], ['uname' => $uname]);
        wp_send_json_success(['message' => 'Password updated successfully', 'skip_otp' => true]);
        return;
    }

    // Store pending password change in session
    $admin['pending_pwd'] = password_hash($new, PASSWORD_BCRYPT, ['cost' => 12]);
    pe_session_set($admin);

    // Send OTP
    $result = pe_send_otp('password_change');
    if ($result) {
        wp_send_json_success(['message' => 'OTP sent to your registered email', 'require_otp' => true]);
    } else {
        wp_send_json_error(['message' => 'Failed to send OTP']);
    }
}
add_action('wp_ajax_pe_admin_pwd_init', 'pe_admin_ajax_pwd_init');
add_action('wp_ajax_nopriv_pe_admin_pwd_init', 'pe_admin_ajax_pwd_init');

// ══════════════════════════════════════
//  AJAX: PASSWORD CHANGE — Step 2: Verify OTP & Apply
// ══════════════════════════════════════
function pe_admin_ajax_change_password()
{
    pe_admin_check_ajax();
    global $wpdb;
    $otp = sanitize_text_field($_POST['otp'] ?? '');
    if (!$otp)
        wp_send_json_error(['message' => 'OTP is required']);

    if (!pe_verify_otp('password_change', $otp)) {
        wp_send_json_error(['message' => 'Invalid or expired OTP']);
    }

    $admin = pe_session_get();
    $uname = $admin['uname'] ?? '';
    $new_hash = $admin['pending_pwd'] ?? '';
    if (!$new_hash)
        wp_send_json_error(['message' => 'No pending password change']);

    $wpdb->update('tbl_admin', ['pwd' => $new_hash], ['uname' => $uname]);

    // Clear pending password from session
    unset($admin['pending_pwd']);
    pe_session_set($admin);

    wp_send_json_success(['message' => 'Password updated successfully']);
}
add_action('wp_ajax_pe_admin_change_password', 'pe_admin_ajax_change_password');
add_action('wp_ajax_nopriv_pe_admin_change_password', 'pe_admin_ajax_change_password');

// ══════════════════════════════════════
//  AJAX: IP WHITELIST MANAGEMENT
// ══════════════════════════════════════
function pe_admin_ajax_get_whitelist()
{
    pe_admin_check_ajax();
    $whitelist = get_option('pe_admin_ip_whitelist', []);
    if (!is_array($whitelist))
        $whitelist = [];
    $current_ip = pe_admin_get_client_ip();
    wp_send_json_success(['ips' => $whitelist, 'current_ip' => $current_ip]);
}
add_action('wp_ajax_pe_admin_get_whitelist', 'pe_admin_ajax_get_whitelist');
add_action('wp_ajax_nopriv_pe_admin_get_whitelist', 'pe_admin_ajax_get_whitelist');

function pe_admin_ajax_add_whitelist_ip()
{
    pe_admin_check_ajax();
    $ip = sanitize_text_field($_POST['ip'] ?? '');
    if (!$ip || !filter_var($ip, FILTER_VALIDATE_IP)) {
        wp_send_json_error(['message' => 'Invalid IP address']);
    }
    pe_admin_whitelist_ip($ip);
    wp_send_json_success(['message' => 'IP added to whitelist']);
}
add_action('wp_ajax_pe_admin_add_whitelist_ip', 'pe_admin_ajax_add_whitelist_ip');
add_action('wp_ajax_nopriv_pe_admin_add_whitelist_ip', 'pe_admin_ajax_add_whitelist_ip');

function pe_admin_ajax_remove_whitelist_ip()
{
    pe_admin_check_ajax();
    $ip = sanitize_text_field($_POST['ip'] ?? '');
    $current_ip = pe_admin_get_client_ip();
    if ($ip === $current_ip) {
        wp_send_json_error(['message' => 'Cannot remove your own IP']);
    }
    pe_admin_remove_whitelisted_ip($ip);
    wp_send_json_success(['message' => 'IP removed from whitelist']);
}
add_action('wp_ajax_pe_admin_remove_whitelist_ip', 'pe_admin_ajax_remove_whitelist_ip');
add_action('wp_ajax_nopriv_pe_admin_remove_whitelist_ip', 'pe_admin_ajax_remove_whitelist_ip');

// ══════════════════════════════════════
//  SHORTCODE: [pe_admin_panel]
// ══════════════════════════════════════
function pe_admin_panel_shortcode()
{
    // Send security headers
    pe_admin_security_headers();

    // Prevent page caching so session state is always fresh (fixes multi-tab login)
    if (!headers_sent()) {
        header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
        header('Cache-Control: post-check=0, pre-check=0', false);
        header('Pragma: no-cache');
        header('Expires: Thu, 01 Jan 1970 00:00:00 GMT');
        header('X-LiteSpeed-Cache-Control: no-cache');
    }

    // IP whitelist check — show nothing if not whitelisted
    if (!pe_admin_is_ip_whitelisted()) {
        return ''; // Return empty — no login form, no dashboard, nothing
    }

    ob_start();
    if (pe_admin_is_logged_in()) {
        include PE_AD_DIR . 'pe-admin-views/dashboard.php';
    } else {
        include PE_AD_DIR . 'pe-admin-views/login.php';
    }
    return ob_get_clean();
}
add_shortcode('pe_admin_panel', 'pe_admin_panel_shortcode');
