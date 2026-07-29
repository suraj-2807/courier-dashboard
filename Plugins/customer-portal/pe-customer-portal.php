<?php
/*
Plugin Name: PE Customer Portal
Description: Customer-facing portal for shipment booking, tracking, and self-service dashboard.
Version: 1.0
Author: Suraj
*/
if (!defined('ABSPATH'))
    exit;

// ══════════════════════════════════════
//  CONSTANTS
// ══════════════════════════════════════
define('PE_CP_DIR', plugin_dir_path(__FILE__));
define('PE_CP_URL', plugin_dir_url(__FILE__));

// Admin portal URL (where the React booking form is hosted)
if (!defined('PE_ADMIN_PORTAL_URL')) {
    define('PE_ADMIN_PORTAL_URL', 'https://purple-raccoon-753399.hostingersite.com/customer/booking');
}

// Logo URL constant (same as admin)
if (!defined('PE_CP_LOGO_URL')) {
    define('PE_CP_LOGO_URL', 'https://princeexp.com/wp-content/uploads/2026/04/ChatGPT-Image-Apr-14-2026-06_03_34-AM.png');
}

// Session cookie name (different from admin)
if (!defined('PE_CP_COOKIE_NAME')) {
    define('PE_CP_COOKIE_NAME', 'pe_customer_sid');
}

// Secret key for customer session encryption
if (!defined('PE_CP_SESSION_SECRET')) {
    define('PE_CP_SESSION_SECRET', defined('AUTH_KEY') ? AUTH_KEY . 'PE_CUSTOMER_V1' : 'pe_cust_default_secret_change_me_2026');
}

// ══════════════════════════════════════
//  SESSION ENGINE (same pattern as admin plugin)
// ══════════════════════════════════════

function pe_cp_encrypt($data)
{
    $key = hash('sha256', PE_CP_SESSION_SECRET, true);
    $iv = openssl_random_pseudo_bytes(16);
    $encrypted = openssl_encrypt(serialize($data), 'aes-256-cbc', $key, OPENSSL_RAW_DATA, $iv);
    if ($encrypted === false) return null;
    return base64_encode($iv . $encrypted);
}

function pe_cp_decrypt($payload)
{
    if (empty($payload)) return null;
    $key = hash('sha256', PE_CP_SESSION_SECRET, true);
    $raw = base64_decode($payload, true);
    if ($raw === false || strlen($raw) < 17) return null;
    $iv = substr($raw, 0, 16);
    $encrypted = substr($raw, 16);
    $decrypted = openssl_decrypt($encrypted, 'aes-256-cbc', $key, OPENSSL_RAW_DATA, $iv);
    if ($decrypted === false) return null;
    $data = @unserialize($decrypted);
    return $data !== false ? $data : null;
}

function pe_cp_session_get()
{
    $token = $_COOKIE[PE_CP_COOKIE_NAME] ?? null;
    if (!$token) return null;
    $encrypted = get_transient('pe_cp_sess_' . $token);
    if (!$encrypted) return null;
    return pe_cp_decrypt($encrypted);
}

function pe_cp_session_set($data, $token = null)
{
    if (!$token) $token = $_COOKIE[PE_CP_COOKIE_NAME] ?? null;
    if (!$token) return false;
    $encrypted = pe_cp_encrypt($data);
    if (!$encrypted) return false;
    set_transient('pe_cp_sess_' . $token, $encrypted, 86400);
    return true;
}

function pe_cp_session_create($data)
{
    $token = bin2hex(random_bytes(32));
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
    setcookie(PE_CP_COOKIE_NAME, $token, [
        'expires' => 0,
        'path' => '/',
        'domain' => '',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    $_COOKIE[PE_CP_COOKIE_NAME] = $token;
    pe_cp_session_set($data, $token);
    return $token;
}

function pe_cp_session_clear()
{
    $token = $_COOKIE[PE_CP_COOKIE_NAME] ?? null;
    if ($token) {
        delete_transient('pe_cp_sess_' . $token);
    }
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
    setcookie(PE_CP_COOKIE_NAME, '', [
        'expires' => time() - 86400,
        'path' => '/',
        'domain' => '',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    unset($_COOKIE[PE_CP_COOKIE_NAME]);
}

function pe_cp_fingerprint()
{
    $ua = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';
    return hash('sha256', $ua . '|' . PE_CP_SESSION_SECRET);
}

// ══════════════════════════════════════
//  AUTH HELPERS
// ══════════════════════════════════════

function pe_cp_is_logged_in()
{
    $cust = pe_cp_session_get();
    return !empty($cust['logged_in']);
}

function pe_cp_get_user()
{
    $cust = pe_cp_session_get();
    return (!empty($cust['logged_in'])) ? $cust : null;
}

function pe_cp_check_ajax()
{
    if (!pe_cp_is_logged_in()) {
        wp_send_json_error(['message' => 'Session expired. Please login again.', 'expired' => true, 'new_nonce' => wp_create_nonce('pe_cp_nonce')], 401);
    }
    if (!check_ajax_referer('pe_cp_nonce', 'nonce', false)) {
        wp_send_json_error(['message' => 'Session token expired. Refreshing...', 'nonce_expired' => true, 'new_nonce' => wp_create_nonce('pe_cp_nonce')], 403);
    }
}

// ── Session Validation ──
add_action('init', function () {
    $cust = pe_cp_session_get();
    if ($cust) {
        if (!empty($cust['fingerprint']) && $cust['fingerprint'] !== pe_cp_fingerprint()) {
            pe_cp_session_clear();
            return;
        }
        $cust['last_activity'] = time();
        pe_cp_session_set($cust);
    }
}, 1);

// ══════════════════════════════════════
//  ENQUEUE ASSETS
// ══════════════════════════════════════

function pe_cp_enqueue()
{
    wp_enqueue_style('pe-cp-fonts', 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap', [], null);
    wp_enqueue_style('pe-cp-fa', 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css', [], '6.5.1');
    wp_register_script('pe-cp-config', '', [], false, false);
    wp_enqueue_script('pe-cp-config');
    wp_localize_script('pe-cp-config', 'PE_CP', [
        'ajax_url' => admin_url('admin-ajax.php'),
        'nonce' => wp_create_nonce('pe_cp_nonce'),
        'logo_url' => PE_CP_LOGO_URL,
        'portal_url' => PE_ADMIN_PORTAL_URL,
    ]);
}
add_action('wp_enqueue_scripts', 'pe_cp_enqueue');

// ══════════════════════════════════════
//  AJAX: LOGIN
// ══════════════════════════════════════

function pe_cp_ajax_login()
{
    if (!check_ajax_referer('pe_cp_nonce', 'nonce', false)) {
        wp_send_json_error(['message' => 'Security token expired. Please refresh.'], 403);
    }

    global $wpdb;
    $email_or_phone = sanitize_text_field($_POST['email_or_phone'] ?? '');
    $pwd = $_POST['pwd'] ?? '';

    if (!$email_or_phone || !$pwd) {
        wp_send_json_error(['message' => 'Email/Phone and password are required']);
    }

    // Check tbl_customers table
    $table_exists = $wpdb->get_var("SHOW TABLES LIKE 'tbl_customers'");
    if (!$table_exists) {
        // Fallback: Try matching against AWBENTRY SNAME/SPHONE1 for demo
        wp_send_json_error(['message' => 'Customer system not initialized. Contact admin.']);
    }

    $row = $wpdb->get_row($wpdb->prepare(
        "SELECT * FROM tbl_customers WHERE (email = %s OR phone = %s) AND status = 'active'",
        $email_or_phone,
        $email_or_phone
    ));

    if (!$row) {
        wp_send_json_error(['message' => 'Invalid credentials']);
    }

    // Verify password (bcrypt)
    if (!password_verify($pwd, $row->password)) {
        // Legacy MD5 fallback
        if (md5($pwd) !== $row->password) {
            wp_send_json_error(['message' => 'Invalid credentials']);
        }
        // Auto-upgrade to bcrypt
        $wpdb->update('tbl_customers', [
            'password' => password_hash($pwd, PASSWORD_BCRYPT, ['cost' => 12])
        ], ['id' => $row->id]);
    }

    // Create session
    pe_cp_session_create([
        'customer_id' => $row->id,
        'name' => $row->name,
        'email' => $row->email,
        'phone' => $row->phone,
        'company' => $row->company ?? '',
        'logged_in' => true,
        'login_at' => time(),
        'last_activity' => time(),
        'fingerprint' => pe_cp_fingerprint(),
    ]);

    $wpdb->update('tbl_customers', [
        'last_login' => current_time('mysql'),
    ], ['id' => $row->id]);

    wp_send_json_success([
        'message' => 'Welcome back! Redirecting...',
        'new_nonce' => wp_create_nonce('pe_cp_nonce')
    ]);
}
add_action('wp_ajax_pe_cp_login', 'pe_cp_ajax_login');
add_action('wp_ajax_nopriv_pe_cp_login', 'pe_cp_ajax_login');

// ══════════════════════════════════════
//  AJAX: LOGOUT
// ══════════════════════════════════════

function pe_cp_ajax_logout()
{
    pe_cp_session_clear();
    wp_send_json_success();
}
add_action('wp_ajax_pe_cp_logout', 'pe_cp_ajax_logout');
add_action('wp_ajax_nopriv_pe_cp_logout', 'pe_cp_ajax_logout');

// ══════════════════════════════════════
//  AJAX: HEARTBEAT
// ══════════════════════════════════════

function pe_cp_ajax_heartbeat()
{
    $cust = pe_cp_session_get();
    if (!$cust || empty($cust['logged_in'])) {
        wp_send_json_error(['expired' => true]);
    }
    $cust['last_heartbeat'] = time();
    pe_cp_session_set($cust);
    wp_send_json_success(['alive' => true]);
}
add_action('wp_ajax_pe_cp_heartbeat', 'pe_cp_ajax_heartbeat');
add_action('wp_ajax_nopriv_pe_cp_heartbeat', 'pe_cp_ajax_heartbeat');

// ══════════════════════════════════════
//  AJAX: CUSTOMER SHIPMENTS
// ══════════════════════════════════════

function pe_cp_ajax_shipments()
{
    pe_cp_check_ajax();
    global $wpdb;

    $cust = pe_cp_get_user();
    $page = max(1, intval($_POST['page'] ?? 1));
    $per = 15;
    $offset = ($page - 1) * $per;
    $search = sanitize_text_field($_POST['search'] ?? '');

    // Match shipments by customer name, phone, or email
    $customer_name = $wpdb->esc_like($cust['name']);
    $customer_phone = $wpdb->esc_like($cust['phone'] ?? '');
    $customer_email = $wpdb->esc_like($cust['email'] ?? '');

    $where = $wpdb->prepare(
        "(a.SNAME LIKE %s OR a.SPHONE1 LIKE %s OR a.CUSTNAME LIKE %s)",
        '%' . $customer_name . '%',
        '%' . $customer_phone . '%',
        '%' . $customer_name . '%'
    );

    if ($search) {
        $like = '%' . $wpdb->esc_like($search) . '%';
        $where .= $wpdb->prepare(
            " AND (CAST(a.AWBNO AS CHAR) LIKE %s OR a.CNEENAME LIKE %s OR a.DESTNAME LIKE %s)",
            $like, $like, $like
        );
    }

    $total = intval($wpdb->get_var("SELECT COUNT(*) FROM AWBENTRY a WHERE $where"));

    $rows = $wpdb->get_results(
        "SELECT a.AWBID as c_id, a.AWBNO, a.CNEENAME as CONSIGNEE, a.DESTNAME as DESTINATION,
                a.CHARGEWEIGHT as WEIGHT, a.AWBDATE as BOOKINGDATE, a.VENDNAME as vendor,
                a.SNAME, a.VENDORAWB1
         FROM AWBENTRY a
         WHERE $where
         ORDER BY a.AWBID DESC
         LIMIT " . intval($per) . " OFFSET " . intval($offset)
    );

    $data = [];
    foreach ($rows as $r) {
        $status = '';
        $ph = $wpdb->get_var($wpdb->prepare(
            "SELECT activity FROM parcel_history WHERE AWBNO = %d ORDER BY date DESC, time DESC LIMIT 1",
            intval($r->AWBNO)
        ));
        $status = $ph ?: 'SHIPMENT BOOKED';

        $data[] = [
            'awb' => $r->AWBNO,
            'consignee' => $r->CONSIGNEE,
            'destination' => $r->DESTINATION,
            'weight' => $r->WEIGHT,
            'booking_date' => $r->BOOKINGDATE,
            'vendor' => $r->vendor ?? '',
            'status' => $status,
            'shipper' => $r->SNAME ?? '',
            'vendor_awb1' => $r->VENDORAWB1 ?? '',
        ];
    }

    // Get counts
    $count_all = $total;
    $_st_sub = "(SELECT ph.activity FROM parcel_history ph WHERE ph.AWBNO = a.AWBNO ORDER BY ph.date DESC, ph.time DESC LIMIT 1)";
    $count_delivered = intval($wpdb->get_var("SELECT COUNT(*) FROM AWBENTRY a WHERE $where AND LOWER(COALESCE($_st_sub, '')) LIKE '%delivered%'"));
    $count_transit = intval($wpdb->get_var("SELECT COUNT(*) FROM AWBENTRY a WHERE $where AND (LOWER(COALESCE($_st_sub, '')) LIKE '%transit%' OR LOWER(COALESCE($_st_sub, '')) LIKE '%departed%')"));

    wp_send_json_success([
        'rows' => $data,
        'total' => $total,
        'pages' => max(1, ceil($total / $per)),
        'page' => $page,
        'counts' => [
            'all' => $count_all,
            'delivered' => $count_delivered,
            'transit' => $count_transit,
            'booked' => $count_all - $count_delivered - $count_transit,
        ],
    ]);
}
add_action('wp_ajax_pe_cp_shipments', 'pe_cp_ajax_shipments');
add_action('wp_ajax_nopriv_pe_cp_shipments', 'pe_cp_ajax_shipments');

// ══════════════════════════════════════
//  AJAX: SHIPMENT DETAIL + TRACKING
// ══════════════════════════════════════

function pe_cp_ajax_shipment_detail()
{
    pe_cp_check_ajax();
    global $wpdb;

    $awb = intval($_POST['awb'] ?? 0);
    if (!$awb) {
        wp_send_json_error(['message' => 'AWB number required']);
    }

    $row = $wpdb->get_row($wpdb->prepare(
        "SELECT a.* FROM AWBENTRY a WHERE a.AWBNO = %d",
        $awb
    ));

    if (!$row) {
        wp_send_json_error(['message' => 'Shipment not found']);
    }

    // Tracking history
    $history = $wpdb->get_results($wpdb->prepare(
        "SELECT activity, date, time, location FROM parcel_history WHERE AWBNO = %d ORDER BY date DESC, time DESC",
        $awb
    ));

    wp_send_json_success([
        'shipment' => [
            'awb' => $row->AWBNO,
            'date' => $row->AWBDATE,
            'shipper' => $row->SNAME,
            'consignee' => $row->CNEENAME,
            'destination' => $row->DESTNAME,
            'origin' => $row->ORIGIN ?? '',
            'weight' => $row->CHARGEWEIGHT ?: $row->ACTUALWEIGHT,
            'pieces' => $row->PIECES ?? 1,
            'vendor' => $row->VENDNAME ?? '',
            'vendor_awb' => $row->VENDORAWB1 ?? '',
            'product' => $row->PRODNAME ?? '',
        ],
        'tracking' => array_map(function ($h) {
            return [
                'activity' => $h->activity,
                'date' => $h->date,
                'time' => $h->time,
                'location' => $h->location ?? '',
            ];
        }, $history),
    ]);
}
add_action('wp_ajax_pe_cp_shipment_detail', 'pe_cp_ajax_shipment_detail');
add_action('wp_ajax_nopriv_pe_cp_shipment_detail', 'pe_cp_ajax_shipment_detail');

// ══════════════════════════════════════
//  AJAX: UPDATE PROFILE
// ══════════════════════════════════════

function pe_cp_ajax_update_profile()
{
    pe_cp_check_ajax();
    global $wpdb;

    $cust = pe_cp_get_user();
    $name = sanitize_text_field($_POST['name'] ?? '');
    $email = sanitize_email($_POST['email'] ?? '');
    $phone = sanitize_text_field($_POST['phone'] ?? '');
    $company = sanitize_text_field($_POST['company'] ?? '');

    if (!$name || !$email) {
        wp_send_json_error(['message' => 'Name and Email are required']);
    }

    $existing = $wpdb->get_var($wpdb->prepare(
        "SELECT id FROM tbl_customers WHERE email = %s AND id != %d",
        $email,
        $cust['customer_id']
    ));
    if ($existing) {
        wp_send_json_error(['message' => 'Email address is already registered by another account']);
    }

    $wpdb->update('tbl_customers', [
        'name' => $name,
        'email' => $email,
        'phone' => $phone,
        'company' => $company
    ], ['id' => $cust['customer_id']]);

    $cust['name'] = $name;
    $cust['email'] = $email;
    $cust['phone'] = $phone;
    $cust['company'] = $company;
    pe_cp_session_set($cust);

    wp_send_json_success([
        'message' => 'Profile updated successfully!',
        'user' => $cust
    ]);
}
add_action('wp_ajax_pe_cp_update_profile', 'pe_cp_ajax_update_profile');

// ══════════════════════════════════════
//  AJAX: UPDATE PASSWORD
// ══════════════════════════════════════

function pe_cp_ajax_update_password()
{
    pe_cp_check_ajax();
    global $wpdb;

    $cust = pe_cp_get_user();
    $current_pwd = $_POST['current_pwd'] ?? '';
    $new_pwd = $_POST['new_pwd'] ?? '';

    if (!$current_pwd || !$new_pwd) {
        wp_send_json_error(['message' => 'Both current and new passwords are required']);
    }

    $row = $wpdb->get_row($wpdb->prepare(
        "SELECT password FROM tbl_customers WHERE id = %d",
        $cust['customer_id']
    ));

    if (!$row) {
        wp_send_json_error(['message' => 'Account not found']);
    }

    if (!password_verify($current_pwd, $row->password) && md5($current_pwd) !== $row->password) {
        wp_send_json_error(['message' => 'Incorrect current password']);
    }

    $hashed = password_hash($new_pwd, PASSWORD_BCRYPT, ['cost' => 12]);

    $wpdb->update('tbl_customers', [
        'password' => $hashed
    ], ['id' => $cust['customer_id']]);

    wp_send_json_success([
        'message' => 'Password updated successfully!'
    ]);
}
add_action('wp_ajax_pe_cp_update_password', 'pe_cp_ajax_update_password');

// ══════════════════════════════════════
//  SHORTCODE: [pe_customer_portal]
// ══════════════════════════════════════

function pe_cp_shortcode()
{
    // Prevent caching
    if (!headers_sent()) {
        header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
        header('Pragma: no-cache');
        header('X-LiteSpeed-Cache-Control: no-cache');
    }

    ob_start();
    if (pe_cp_is_logged_in()) {
        include PE_CP_DIR . 'pe-customer-views/dashboard.php';
    } else {
        include PE_CP_DIR . 'pe-customer-views/login.php';
    }
    return ob_get_clean();
}
add_shortcode('pe_customer_portal', 'pe_cp_shortcode');

// ══════════════════════════════════════
//  TABLE CREATION ON ACTIVATION
// ══════════════════════════════════════

register_activation_hook(__FILE__, function () {
    global $wpdb;
    $charset = $wpdb->get_charset_collate();
    $sql = "CREATE TABLE IF NOT EXISTS tbl_customers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) NOT NULL,
        phone VARCHAR(20) DEFAULT '',
        company VARCHAR(150) DEFAULT '',
        password VARCHAR(255) NOT NULL,
        status ENUM('active','inactive') DEFAULT 'active',
        last_login DATETIME DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY idx_email (email)
    ) $charset;";

    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    dbDelta($sql);
});
