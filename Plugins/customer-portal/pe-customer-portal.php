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

// Sync API key (must match WP_SYNC_KEY in Node.js .env)
if (!defined('PE_CP_SYNC_KEY')) {
    define('PE_CP_SYNC_KEY', 'pe_sync_2026_prince_express_secret');
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
            " AND (CAST(a.AWBNO AS CHAR) LIKE %s OR a.CNEENAME LIKE %s OR a.DESTNAME LIKE %s OR a.SNAME LIKE %s OR a.VENDORAWB1 LIKE %s OR a.VENDORAWB2 LIKE %s OR a.VENDNAME LIKE %s OR CAST(a.AWBDATE AS CHAR) LIKE %s)",
            $like, $like, $like, $like, $like, $like, $like, $like
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
//  AJAX: CUSTOMER REQUESTS
// ══════════════════════════════════════

function pe_cp_ajax_my_requests()
{
    pe_cp_check_ajax();
    global $wpdb;

    $cust = pe_cp_get_user();
    $page = max(1, intval($_POST['page'] ?? 1));
    $per = 15;
    $offset = ($page - 1) * $per;
    $search = sanitize_text_field($_POST['search'] ?? '');
    $status = sanitize_text_field($_POST['status'] ?? '');

    $cust_email = strtolower(trim($cust['email'] ?? ''));
    $cust_phone = preg_replace('/[^0-9]/', '', $cust['phone'] ?? '');
    $cust_phone_last10 = strlen($cust_phone) >= 10 ? substr($cust_phone, -10) : $cust_phone;
    $cust_id = intval($cust['customer_id'] ?? 0);

    // Flexible matching by customer_id, email, or phone
    $where_conds = [];
    $params = [];

    if ($cust_id > 0) {
        $where_conds[] = "customer_id = %d";
        $params[] = $cust_id;
    }
    if ($cust_email) {
        $where_conds[] = "LOWER(TRIM(customer_email)) = %s OR LOWER(TRIM(sender_email)) = %s";
        $params[] = $cust_email;
        $params[] = $cust_email;
    }
    if ($cust_phone_last10) {
        $where_conds[] = "customer_phone LIKE %s OR sender_phone LIKE %s";
        $like_phone = '%' . $wpdb->esc_like($cust_phone_last10) . '%';
        $params[] = $like_phone;
        $params[] = $like_phone;
    }

    $where_str = count($where_conds) > 0 ? "(" . implode(" OR ", $where_conds) . ")" : "1=1";
    $where = $wpdb->prepare($where_str, ...$params);

    if ($status) {
        $where .= $wpdb->prepare(" AND status = %s", $status);
    }

    if ($search) {
        $like = '%' . $wpdb->esc_like($search) . '%';
        $where .= $wpdb->prepare(
            " AND (request_awb LIKE %s OR receiver_name LIKE %s OR sender_name LIKE %s OR sender_city LIKE %s OR receiver_city LIKE %s OR receiver_country LIKE %s OR customer_phone LIKE %s OR sender_phone LIKE %s OR receiver_phone LIKE %s OR order_reference LIKE %s)",
            $like, $like, $like, $like, $like, $like, $like, $like, $like, $like
        );
    }

    $total = intval($wpdb->get_var("SELECT COUNT(*) FROM booking_requests WHERE $where"));

    $rows = $wpdb->get_results(
        "SELECT * FROM booking_requests 
         WHERE $where 
         ORDER BY id DESC 
         LIMIT " . intval($per) . " OFFSET " . intval($offset)
    );

    $data = [];
    foreach ($rows as $r) {
        $data[] = [
            'id' => $r->id,
            'request_awb' => $r->request_awb,
            'created_at' => $r->created_at,
            'sender_name' => $r->sender_name,
            'sender_city' => $r->sender_city,
            'receiver_name' => $r->receiver_name,
            'receiver_city' => $r->receiver_city,
            'package_type' => $r->package_type,
            'weight' => $r->weight,
            'status' => $r->status,
            'shipment_id' => $r->shipment_id,
            'tracking_number' => $r->tracking_number,
        ];
    }

    // Get count breakdown for requests
    $where_base = $where;

    $count_all = intval($wpdb->get_var("SELECT COUNT(*) FROM booking_requests WHERE $where_base"));
    $count_pending = intval($wpdb->get_var("SELECT COUNT(*) FROM booking_requests WHERE $where_base AND status = 'pending'"));
    $count_processing = intval($wpdb->get_var("SELECT COUNT(*) FROM booking_requests WHERE $where_base AND status = 'processing'"));
    $count_confirmed = intval($wpdb->get_var("SELECT COUNT(*) FROM booking_requests WHERE $where_base AND status = 'confirmed'"));
    $count_rejected = intval($wpdb->get_var("SELECT COUNT(*) FROM booking_requests WHERE $where_base AND status = 'rejected'"));

    wp_send_json_success([
        'rows' => $data,
        'total' => $total,
        'pages' => max(1, ceil($total / $per)),
        'page' => $page,
        'counts' => [
            'all' => $count_all,
            'pending' => $count_pending,
            'processing' => $count_processing,
            'confirmed' => $count_confirmed,
            'rejected' => $count_rejected,
        ],
    ]);
}
add_action('wp_ajax_pe_cp_my_requests', 'pe_cp_ajax_my_requests');
add_action('wp_ajax_nopriv_pe_cp_my_requests', 'pe_cp_ajax_my_requests');

function pe_cp_ajax_request_detail()
{
    pe_cp_check_ajax();
    global $wpdb;

    $request_awb = sanitize_text_field($_POST['request_awb'] ?? '');
    if (!$request_awb) {
        wp_send_json_error(['message' => 'Request AWB number required']);
    }

    // Fetch request by request_awb
    $request = $wpdb->get_row($wpdb->prepare("SELECT * FROM booking_requests WHERE request_awb = %s", $request_awb));

    if (!$request) {
        wp_send_json_error(['message' => 'Booking request not found']);
    }

    // Fetch request_updates
    $updates = $wpdb->get_results($wpdb->prepare(
        "SELECT * FROM request_updates WHERE request_id = %d ORDER BY created_at DESC",
        $request->id
    ));

    $timeline = [];
    foreach ($updates as $up) {
        $timeline[] = [
            'type' => $up->update_type,
            'title' => $up->title,
            'description' => $up->description,
            'date' => date('d M Y, h:i A', strtotime($up->created_at)),
            'timestamp' => strtotime($up->created_at)
        ];
    }

    // Fetch physical parcel tracking history if tracking number is linked
    if (!empty($request->tracking_number)) {
        $awb_no = intval($request->tracking_number);
        $history = $wpdb->get_results($wpdb->prepare(
            "SELECT activity, date, time, location FROM parcel_history WHERE AWBNO = %d ORDER BY date DESC, time DESC",
            $awb_no
        ));
        foreach ($history as $h) {
            $dt_str = $h->date . ' ' . $h->time;
            $timeline[] = [
                'type' => 'tracking_update',
                'title' => $h->activity,
                'description' => 'Location: ' . ($h->location ?: 'Origin/In Transit'),
                'date' => date('d M Y, h:i A', strtotime($dt_str)),
                'timestamp' => strtotime($dt_str)
            ];
        }
    }

    // Sort timeline by timestamp DESC
    usort($timeline, function ($a, $b) {
        return $b['timestamp'] - $a['timestamp'];
    });

    // Parse JSON fields so frontend can render parcels, items & documents
    $json_fields = ['parcels', 'invoice_items', 'documents'];
    foreach ($json_fields as $jf) {
        if (!empty($request->$jf) && is_string($request->$jf)) {
            $decoded = json_decode($request->$jf, true);
            $request->$jf = is_array($decoded) ? $decoded : null;
        }
    }

    wp_send_json_success([
        'request' => $request,
        'timeline' => $timeline
    ]);
}
add_action('wp_ajax_pe_cp_request_detail', 'pe_cp_ajax_request_detail');
add_action('wp_ajax_nopriv_pe_cp_request_detail', 'pe_cp_ajax_request_detail');

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
//  AJAX: GET ADDRESSES
// ══════════════════════════════════════

function pe_cp_ajax_get_addresses()
{
    pe_cp_check_ajax();
    global $wpdb;
    $cust = pe_cp_get_user();
    $custId = intval($cust['customer_id'] ?? 0);
    $email = sanitize_email($cust['email'] ?? '');
    $phone = sanitize_text_field($cust['phone'] ?? '');

    $table_exists = $wpdb->get_var("SHOW TABLES LIKE 'customer_addresses'");
    if (!$table_exists) {
        wp_send_json_success(['addresses' => []]);
    }

    $where = "1=1";
    if ($custId > 0) {
        $where .= $wpdb->prepare(" AND (customer_id = %d OR LOWER(customer_email) = LOWER(%s) OR customer_phone = %s)", $custId, $email, $phone);
    } elseif ($email) {
        $where .= $wpdb->prepare(" AND (LOWER(customer_email) = LOWER(%s) OR customer_phone = %s)", $email, $phone);
    }

    $rows = $wpdb->get_results("SELECT * FROM customer_addresses WHERE $where ORDER BY is_default DESC, updated_at DESC", ARRAY_A);
    wp_send_json_success(['addresses' => $rows ?: []]);
}
add_action('wp_ajax_pe_cp_get_addresses', 'pe_cp_ajax_get_addresses');

// ══════════════════════════════════════
//  AJAX: SAVE ADDRESS
// ══════════════════════════════════════

function pe_cp_ajax_save_address()
{
    pe_cp_check_ajax();
    global $wpdb;
    $cust = pe_cp_get_user();
    $custId = intval($cust['customer_id'] ?? 0);

    $id = intval($_POST['id'] ?? 0);
    $name = sanitize_text_field($_POST['name'] ?? '');
    $company = sanitize_text_field($_POST['company'] ?? '');
    $phone = sanitize_text_field($_POST['phone'] ?? '');
    $phone_2 = sanitize_text_field($_POST['phone_2'] ?? '');
    $email = sanitize_email($_POST['email'] ?? '');
    $address = sanitize_textarea_field($_POST['address'] ?? '');
    $address_2 = sanitize_text_field($_POST['address_2'] ?? '');
    $city = sanitize_text_field($_POST['city'] ?? '');
    $state = sanitize_text_field($_POST['state'] ?? '');
    $pincode = sanitize_text_field($_POST['pincode'] ?? '');
    $country = sanitize_text_field($_POST['country'] ?? 'INDIA');
    $gstin_type = sanitize_text_field($_POST['gstin_type'] ?? '');
    $gstin_no = sanitize_text_field($_POST['gstin_no'] ?? '');
    $address_type = sanitize_text_field($_POST['address_type'] ?? 'both');
    $is_default = !empty($_POST['is_default']) ? 1 : 0;

    if (!$name || !$phone || !$address || !$city) {
        wp_send_json_error(['message' => 'Name, Phone, Address Line 1, and City are required']);
    }

    if ($is_default && $custId > 0) {
        $wpdb->query($wpdb->prepare("UPDATE customer_addresses SET is_default = 0 WHERE customer_id = %d", $custId));
    }

    $data = [
        'customer_id'    => $custId ?: null,
        'customer_email' => sanitize_email($cust['email'] ?? ''),
        'customer_phone' => sanitize_text_field($cust['phone'] ?? ''),
        'address_type'   => $address_type,
        'name'           => $name,
        'company'        => $company,
        'phone'          => $phone,
        'phone_2'        => $phone_2,
        'email'          => $email,
        'address'        => $address,
        'address_2'      => $address_2,
        'city'           => $city,
        'state'          => $state,
        'pincode'        => $pincode,
        'country'        => $country ?: 'INDIA',
        'gstin_type'     => $gstin_type,
        'gstin_no'       => $gstin_no,
        'is_default'     => $is_default
    ];

    if ($id > 0) {
        $wpdb->update('customer_addresses', $data, ['id' => $id]);
        $savedId = $id;
    } else {
        $wpdb->insert('customer_addresses', $data);
        $savedId = $wpdb->insert_id;
    }

    $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM customer_addresses WHERE id = %d", $savedId), ARRAY_A);
    wp_send_json_success(['message' => 'Address saved successfully!', 'address' => $row]);
}
add_action('wp_ajax_pe_cp_save_address', 'pe_cp_ajax_save_address');

// ══════════════════════════════════════
//  AJAX: DELETE ADDRESS
// ══════════════════════════════════════

function pe_cp_ajax_delete_address()
{
    pe_cp_check_ajax();
    global $wpdb;
    $id = intval($_POST['id'] ?? 0);
    if ($id > 0) {
        $wpdb->delete('customer_addresses', ['id' => $id]);
    }
    wp_send_json_success(['message' => 'Address deleted']);
}
add_action('wp_ajax_pe_cp_delete_address', 'pe_cp_ajax_delete_address');

// ══════════════════════════════════════
//  AJAX: GET DOCUMENTS
// ══════════════════════════════════════

function pe_cp_ajax_get_documents()
{
    pe_cp_check_ajax();
    global $wpdb;
    $cust = pe_cp_get_user();
    $custId = intval($cust['customer_id'] ?? 0);
    $email = sanitize_email($cust['email'] ?? '');
    $phone = sanitize_text_field($cust['phone'] ?? '');

    $table_exists = $wpdb->get_var("SHOW TABLES LIKE 'customer_documents'");
    if (!$table_exists) {
        wp_send_json_success(['documents' => []]);
    }

    $where = "1=1";
    if ($custId > 0) {
        $where .= $wpdb->prepare(" AND (customer_id = %d OR LOWER(customer_email) = LOWER(%s) OR customer_phone = %s)", $custId, $email, $phone);
    } elseif ($email) {
        $where .= $wpdb->prepare(" AND (LOWER(customer_email) = LOWER(%s) OR customer_phone = %s)", $email, $phone);
    }

    $rows = $wpdb->get_results("SELECT * FROM customer_documents WHERE $where ORDER BY created_at DESC", ARRAY_A);
    wp_send_json_success(['documents' => $rows ?: []]);
}
add_action('wp_ajax_pe_cp_get_documents', 'pe_cp_ajax_get_documents');

// ══════════════════════════════════════
//  AJAX: UPLOAD DOCUMENT
// ══════════════════════════════════════

function pe_cp_ajax_upload_document()
{
    pe_cp_check_ajax();
    global $wpdb;
    $cust = pe_cp_get_user();
    $custId = intval($cust['customer_id'] ?? 0);

    if (empty($_FILES['file'])) {
        wp_send_json_error(['message' => 'No file was uploaded']);
    }

    require_once ABSPATH . 'wp-admin/includes/file.php';
    $file = $_FILES['file'];
    $upload_overrides = ['test_form' => false];
    $movefile = wp_handle_upload($file, $upload_overrides);

    if ($movefile && !isset($movefile['error'])) {
        $doc_type = sanitize_text_field($_POST['doc_type'] ?? 'Other');
        $doc_name = sanitize_text_field($_POST['doc_name'] ?? $file['name']);
        $doc_number = sanitize_text_field($_POST['doc_number'] ?? '');
        $notes = sanitize_textarea_field($_POST['notes'] ?? '');

        $wpdb->insert('customer_documents', [
            'customer_id'    => $custId ?: null,
            'customer_email' => sanitize_email($cust['email'] ?? ''),
            'customer_phone' => sanitize_text_field($cust['phone'] ?? ''),
            'doc_type'       => $doc_type,
            'doc_name'       => $doc_name,
            'doc_number'     => $doc_number,
            'file_url'       => $movefile['url'],
            'file_name'      => $file['name'],
            'file_size'      => intval($file['size']),
            'file_type'      => $file['type'],
            'notes'          => $notes
        ]);

        $docId = $wpdb->insert_id;
        $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM customer_documents WHERE id = %d", $docId), ARRAY_A);
        wp_send_json_success(['message' => 'Document uploaded successfully!', 'document' => $row]);
    } else {
        wp_send_json_error(['message' => $movefile['error'] ?? 'Upload failed']);
    }
}
add_action('wp_ajax_pe_cp_upload_document', 'pe_cp_ajax_upload_document');

// ══════════════════════════════════════
//  AJAX: DELETE DOCUMENT
// ══════════════════════════════════════

function pe_cp_ajax_delete_document()
{
    pe_cp_check_ajax();
    global $wpdb;
    $id = intval($_POST['id'] ?? 0);
    if ($id > 0) {
        $wpdb->delete('customer_documents', ['id' => $id]);
    }
    wp_send_json_success(['message' => 'Document deleted']);
}
add_action('wp_ajax_pe_cp_delete_document', 'pe_cp_ajax_delete_document');

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

    // Customer accounts table
    $sql_customers = "CREATE TABLE IF NOT EXISTS tbl_customers (
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

    // Booking requests table (synced from Node.js backend)
    $sql_booking_requests = "CREATE TABLE IF NOT EXISTS booking_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        request_awb VARCHAR(20) NOT NULL,
        customer_id INT DEFAULT NULL,
        customer_name VARCHAR(100) DEFAULT '',
        customer_email VARCHAR(150) DEFAULT '',
        customer_phone VARCHAR(20) DEFAULT '',
        customer_company VARCHAR(150) DEFAULT '',
        sender_name VARCHAR(100) DEFAULT '',
        sender_company VARCHAR(150) DEFAULT '',
        sender_email VARCHAR(150) DEFAULT '',
        sender_phone VARCHAR(20) DEFAULT '',
        sender_address VARCHAR(255) DEFAULT '',
        sender_address_2 VARCHAR(255) DEFAULT '',
        sender_city VARCHAR(100) DEFAULT '',
        sender_pincode VARCHAR(20) DEFAULT '',
        sender_state VARCHAR(100) DEFAULT '',
        sender_country VARCHAR(100) DEFAULT 'INDIA',
        sender_gstin_type VARCHAR(50) DEFAULT '',
        sender_gstin_no VARCHAR(50) DEFAULT '',
        receiver_name VARCHAR(100) DEFAULT '',
        receiver_email VARCHAR(150) DEFAULT '',
        receiver_phone VARCHAR(20) DEFAULT '',
        receiver_address VARCHAR(255) DEFAULT '',
        receiver_address_2 VARCHAR(255) DEFAULT '',
        receiver_city VARCHAR(100) DEFAULT '',
        receiver_pincode VARCHAR(20) DEFAULT '',
        receiver_state VARCHAR(100) DEFAULT '',
        receiver_country VARCHAR(100) DEFAULT '',
        receiver_gstin_type VARCHAR(50) DEFAULT '',
        receiver_gstin_no VARCHAR(50) DEFAULT '',
        package_type VARCHAR(50) DEFAULT 'parcel',
        weight DECIMAL(10,2) DEFAULT 0,
        length_cm DECIMAL(10,2) DEFAULT 0,
        breadth DECIMAL(10,2) DEFAULT 0,
        height DECIMAL(10,2) DEFAULT 0,
        no_of_pieces INT DEFAULT 1,
        content_description TEXT,
        declared_value DECIMAL(10,2) DEFAULT 0,
        is_fragile TINYINT DEFAULT 0,
        remarks TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        admin_notes TEXT,
        shipment_id INT DEFAULT NULL,
        tracking_number VARCHAR(50) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY idx_request_awb (request_awb),
        KEY idx_customer_id (customer_id),
        KEY idx_customer_email (customer_email),
        KEY idx_status (status)
    ) $charset;";

    // Request updates / timeline table (synced from Node.js backend)
    $sql_request_updates = "CREATE TABLE IF NOT EXISTS request_updates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        request_id INT NOT NULL,
        update_type VARCHAR(30) DEFAULT 'info',
        title VARCHAR(255) NOT NULL,
        description TEXT,
        metadata LONGTEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_request_id (request_id)
    ) $charset;";

    // Customer addresses table
    $sql_customer_addresses = "CREATE TABLE IF NOT EXISTS customer_addresses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT DEFAULT NULL,
        customer_email VARCHAR(150) DEFAULT '',
        customer_phone VARCHAR(50) DEFAULT '',
        address_type VARCHAR(20) DEFAULT 'both',
        name VARCHAR(100) NOT NULL,
        company VARCHAR(150) DEFAULT '',
        phone VARCHAR(50) NOT NULL,
        phone_2 VARCHAR(50) DEFAULT '',
        email VARCHAR(150) DEFAULT '',
        address TEXT NOT NULL,
        address_2 VARCHAR(255) DEFAULT '',
        city VARCHAR(100) NOT NULL,
        state VARCHAR(100) DEFAULT '',
        pincode VARCHAR(20) DEFAULT '',
        country VARCHAR(100) DEFAULT 'INDIA',
        gstin_type VARCHAR(50) DEFAULT '',
        gstin_no VARCHAR(50) DEFAULT '',
        is_default TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_cust_id (customer_id),
        KEY idx_cust_email (customer_email)
    ) $charset;";

    // Customer documents table
    $sql_customer_documents = "CREATE TABLE IF NOT EXISTS customer_documents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT DEFAULT NULL,
        customer_email VARCHAR(150) DEFAULT '',
        customer_phone VARCHAR(50) DEFAULT '',
        doc_type VARCHAR(100) NOT NULL,
        doc_name VARCHAR(255) DEFAULT '',
        doc_number VARCHAR(100) DEFAULT '',
        file_url VARCHAR(500) NOT NULL,
        file_name VARCHAR(255) DEFAULT '',
        file_size INT DEFAULT 0,
        file_type VARCHAR(50) DEFAULT '',
        notes TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_cust_id (customer_id),
        KEY idx_cust_email (customer_email)
    ) $charset;";

    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    dbDelta($sql_customers);
    dbDelta($sql_booking_requests);
    dbDelta($sql_request_updates);
    dbDelta($sql_customer_addresses);
    dbDelta($sql_customer_documents);
});

// ══════════════════════════════════════
//  SELF-HEALING TABLE CREATION ON INIT
// ══════════════════════════════════════

add_action('init', function () {
    global $wpdb;
    // Only run once per day (use transient to avoid repeated checks)
    if (get_transient('pe_cp_tables_checked')) return;

    $charset = $wpdb->get_charset_collate();

    // Check if customer_addresses table exists
    if (!$wpdb->get_var("SHOW TABLES LIKE 'customer_addresses'")) {
        $wpdb->query("CREATE TABLE IF NOT EXISTS customer_addresses (
            id INT AUTO_INCREMENT PRIMARY KEY,
            customer_id INT DEFAULT NULL,
            customer_email VARCHAR(150) DEFAULT '',
            customer_phone VARCHAR(50) DEFAULT '',
            address_type VARCHAR(20) DEFAULT 'both',
            name VARCHAR(100) NOT NULL,
            company VARCHAR(150) DEFAULT '',
            phone VARCHAR(50) NOT NULL,
            phone_2 VARCHAR(50) DEFAULT '',
            email VARCHAR(150) DEFAULT '',
            address TEXT NOT NULL,
            address_2 VARCHAR(255) DEFAULT '',
            city VARCHAR(100) NOT NULL,
            state VARCHAR(100) DEFAULT '',
            pincode VARCHAR(20) DEFAULT '',
            country VARCHAR(100) DEFAULT 'INDIA',
            gstin_type VARCHAR(50) DEFAULT '',
            gstin_no VARCHAR(50) DEFAULT '',
            is_default TINYINT(1) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_cust_id (customer_id),
            KEY idx_cust_email (customer_email)
        ) $charset");
    }

    // Check if customer_documents table exists
    if (!$wpdb->get_var("SHOW TABLES LIKE 'customer_documents'")) {
        $wpdb->query("CREATE TABLE IF NOT EXISTS customer_documents (
            id INT AUTO_INCREMENT PRIMARY KEY,
            customer_id INT DEFAULT NULL,
            customer_email VARCHAR(150) DEFAULT '',
            customer_phone VARCHAR(50) DEFAULT '',
            doc_type VARCHAR(100) NOT NULL,
            doc_name VARCHAR(255) DEFAULT '',
            doc_number VARCHAR(100) DEFAULT '',
            file_url VARCHAR(500) NOT NULL,
            file_name VARCHAR(255) DEFAULT '',
            file_size INT DEFAULT 0,
            file_type VARCHAR(50) DEFAULT '',
            notes TEXT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_cust_id (customer_id),
            KEY idx_cust_email (customer_email)
        ) $charset");
    }

    // Check if booking_requests table exists
    if (!$wpdb->get_var("SHOW TABLES LIKE 'booking_requests'")) {
        $wpdb->query("CREATE TABLE IF NOT EXISTS booking_requests (
            id INT AUTO_INCREMENT PRIMARY KEY,
            request_awb VARCHAR(20) NOT NULL,
            customer_id INT DEFAULT NULL,
            customer_name VARCHAR(100) DEFAULT '',
            customer_email VARCHAR(150) DEFAULT '',
            customer_phone VARCHAR(20) DEFAULT '',
            customer_company VARCHAR(150) DEFAULT '',
            sender_name VARCHAR(100) DEFAULT '',
            sender_company VARCHAR(150) DEFAULT '',
            sender_email VARCHAR(150) DEFAULT '',
            sender_phone VARCHAR(20) DEFAULT '',
            sender_address VARCHAR(255) DEFAULT '',
            sender_address_2 VARCHAR(255) DEFAULT '',
            sender_city VARCHAR(100) DEFAULT '',
            sender_pincode VARCHAR(20) DEFAULT '',
            sender_state VARCHAR(100) DEFAULT '',
            sender_country VARCHAR(100) DEFAULT 'INDIA',
            sender_gstin_type VARCHAR(50) DEFAULT '',
            sender_gstin_no VARCHAR(50) DEFAULT '',
            receiver_name VARCHAR(100) DEFAULT '',
            receiver_email VARCHAR(150) DEFAULT '',
            receiver_phone VARCHAR(20) DEFAULT '',
            receiver_address VARCHAR(255) DEFAULT '',
            receiver_address_2 VARCHAR(255) DEFAULT '',
            receiver_city VARCHAR(100) DEFAULT '',
            receiver_pincode VARCHAR(20) DEFAULT '',
            receiver_state VARCHAR(100) DEFAULT '',
            receiver_country VARCHAR(100) DEFAULT '',
            receiver_gstin_type VARCHAR(50) DEFAULT '',
            receiver_gstin_no VARCHAR(50) DEFAULT '',
            package_type VARCHAR(50) DEFAULT 'parcel',
            weight DECIMAL(10,2) DEFAULT 0,
            length_cm DECIMAL(10,2) DEFAULT 0,
            breadth DECIMAL(10,2) DEFAULT 0,
            height DECIMAL(10,2) DEFAULT 0,
            no_of_pieces INT DEFAULT 1,
            content_description TEXT,
            declared_value DECIMAL(10,2) DEFAULT 0,
            is_fragile TINYINT DEFAULT 0,
            remarks TEXT,
            status VARCHAR(20) DEFAULT 'pending',
            admin_notes TEXT,
            shipment_id INT DEFAULT NULL,
            tracking_number VARCHAR(50) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY idx_request_awb (request_awb),
            KEY idx_customer_id (customer_id),
            KEY idx_customer_email (customer_email),
            KEY idx_status (status)
        ) $charset");
    } else {
        // Table exists, check for and add any missing columns dynamically (self-healing)
        $columns = $wpdb->get_col("DESCRIBE booking_requests");
        if ($columns) {
            $missing_columns = [
                'sender_gstin_type'   => "VARCHAR(50) DEFAULT '' AFTER sender_country",
                'sender_gstin_no'     => "VARCHAR(50) DEFAULT '' AFTER sender_gstin_type",
                'receiver_gstin_type' => "VARCHAR(50) DEFAULT '' AFTER receiver_country",
                'receiver_gstin_no'   => "VARCHAR(50) DEFAULT '' AFTER receiver_gstin_type",
                'length_cm'           => "DECIMAL(10,2) DEFAULT 0 AFTER weight",
                'breadth'             => "DECIMAL(10,2) DEFAULT 0 AFTER length_cm",
                'height'              => "DECIMAL(10,2) DEFAULT 0 AFTER breadth",
                'no_of_pieces'        => "INT DEFAULT 1 AFTER height",
                'declared_value'      => "DECIMAL(10,2) DEFAULT 0 AFTER content_description",
                'is_fragile'          => "TINYINT DEFAULT 0 AFTER declared_value",
                'admin_notes'         => "TEXT AFTER status",
                'shipment_id'         => "INT DEFAULT NULL AFTER admin_notes",
                'tracking_number'     => "VARCHAR(50) DEFAULT NULL AFTER shipment_id",
            ];

            foreach ($missing_columns as $col => $definition) {
                if (!in_array($col, $columns)) {
                    $wpdb->query("ALTER TABLE booking_requests ADD COLUMN $col $definition");
                }
            }
        }
    }

    if (!$wpdb->get_var("SHOW TABLES LIKE 'request_updates'")) {
        $wpdb->query("CREATE TABLE IF NOT EXISTS request_updates (
            id INT AUTO_INCREMENT PRIMARY KEY,
            request_id INT NOT NULL,
            update_type VARCHAR(30) DEFAULT 'info',
            title VARCHAR(255) NOT NULL,
            description TEXT,
            metadata LONGTEXT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY idx_request_id (request_id)
        ) $charset");
    }

    // AWBENTRY & parcel_history table checks (DISABLED BY USER DIRECTIVE: NO SCHEMA OR DATA WRITES)
    // Table creation and column alterations for AWBENTRY and parcel_history are completely disabled.

    set_transient('pe_cp_tables_checked', 1, DAY_IN_SECONDS);
}, 5);

// ══════════════════════════════════════
//  REST API: SYNC ENDPOINTS (Node.js → WP)
// ══════════════════════════════════════

add_action('rest_api_init', function () {
    // Sync a new booking request from Node.js backend
    register_rest_route('pe-cp/v1', '/sync-booking', [
        'methods' => 'POST',
        'callback' => 'pe_cp_rest_sync_booking',
        'permission_callback' => 'pe_cp_rest_verify_sync_key',
    ]);

    // Sync a status update from Node.js backend
    register_rest_route('pe-cp/v1', '/sync-status', [
        'methods' => 'POST',
        'callback' => 'pe_cp_rest_sync_status',
        'permission_callback' => 'pe_cp_rest_verify_sync_key',
    ]);

    // Sync a new shipment / AWB entry from Node.js backend
    register_rest_route('pe-cp/v1', '/sync-awb', [
        'methods' => 'POST',
        'callback' => 'pe_cp_rest_sync_awb',
        'permission_callback' => 'pe_cp_rest_verify_sync_key',
    ]);
});

/**
 * Verify the sync API key from the request header.
 */
function pe_cp_rest_verify_sync_key($request)
{
    $key = $request->get_header('X-Sync-Key');
    if (!$key || !defined('PE_CP_SYNC_KEY')) return false;
    return hash_equals(PE_CP_SYNC_KEY, $key);
}

/**
 * REST: Sync a new booking request into the WP database.
 * Called by Node.js backend after creating a booking request.
 */
function pe_cp_rest_sync_booking($request)
{
    global $wpdb;
    $d = $request->get_json_params();

    $awb = sanitize_text_field($d['request_awb'] ?? '');
    if (!$awb) {
        return new WP_REST_Response(['success' => false, 'message' => 'request_awb required'], 400);
    }

    // Check if already exists (idempotent)
    $exists = $wpdb->get_var($wpdb->prepare("SELECT id FROM booking_requests WHERE request_awb = %s", $awb));
    if ($exists) {
        return new WP_REST_Response(['success' => true, 'message' => 'Already synced']);
    }

    $wpdb->insert('booking_requests', [
        'request_awb'         => $awb,
        'customer_id'         => intval($d['customer_id'] ?? 0) ?: null,
        'customer_name'       => sanitize_text_field($d['customer_name'] ?? ''),
        'customer_email'      => sanitize_email($d['customer_email'] ?? ''),
        'customer_phone'      => sanitize_text_field($d['customer_phone'] ?? ''),
        'customer_company'    => sanitize_text_field($d['customer_company'] ?? ''),
        'sender_name'         => sanitize_text_field($d['sender_name'] ?? ''),
        'sender_company'      => sanitize_text_field($d['sender_company'] ?? ''),
        'sender_email'        => sanitize_email($d['sender_email'] ?? ''),
        'sender_phone'        => sanitize_text_field($d['sender_phone'] ?? ''),
        'sender_address'      => sanitize_text_field($d['sender_address'] ?? ''),
        'sender_address_2'    => sanitize_text_field($d['sender_address_2'] ?? ''),
        'sender_city'         => sanitize_text_field($d['sender_city'] ?? ''),
        'sender_pincode'      => sanitize_text_field($d['sender_pincode'] ?? ''),
        'sender_state'        => sanitize_text_field($d['sender_state'] ?? ''),
        'sender_country'      => sanitize_text_field($d['sender_country'] ?? 'INDIA'),
        'sender_gstin_type'   => sanitize_text_field($d['sender_gstin_type'] ?? ''),
        'sender_gstin_no'     => sanitize_text_field($d['sender_gstin_no'] ?? ''),
        'receiver_name'       => sanitize_text_field($d['receiver_name'] ?? ''),
        'receiver_email'      => sanitize_email($d['receiver_email'] ?? ''),
        'receiver_phone'      => sanitize_text_field($d['receiver_phone'] ?? ''),
        'receiver_address'    => sanitize_text_field($d['receiver_address'] ?? ''),
        'receiver_address_2'  => sanitize_text_field($d['receiver_address_2'] ?? ''),
        'receiver_city'       => sanitize_text_field($d['receiver_city'] ?? ''),
        'receiver_pincode'    => sanitize_text_field($d['receiver_pincode'] ?? ''),
        'receiver_state'      => sanitize_text_field($d['receiver_state'] ?? ''),
        'receiver_country'    => sanitize_text_field($d['receiver_country'] ?? ''),
        'receiver_gstin_type' => sanitize_text_field($d['receiver_gstin_type'] ?? ''),
        'receiver_gstin_no'   => sanitize_text_field($d['receiver_gstin_no'] ?? ''),
        'package_type'        => sanitize_text_field($d['package_type'] ?? 'parcel'),
        'weight'              => floatval($d['weight'] ?? 0),
        'length_cm'           => floatval($d['length'] ?? 0),
        'breadth'             => floatval($d['breadth'] ?? 0),
        'height'              => floatval($d['height'] ?? 0),
        'no_of_pieces'        => intval($d['no_of_pieces'] ?? 1),
        'content_description' => sanitize_textarea_field($d['content_description'] ?? ''),
        'declared_value'      => floatval($d['declared_value'] ?? 0),
        'is_fragile'          => intval($d['is_fragile'] ?? 0),
        'remarks'             => sanitize_textarea_field($d['remarks'] ?? ''),
        'status'              => sanitize_text_field($d['status'] ?? 'pending'),
    ]);

    $local_id = $wpdb->insert_id;

    // Insert initial timeline entry
    if ($local_id) {
        $wpdb->insert('request_updates', [
            'request_id'  => $local_id,
            'update_type' => 'info',
            'title'       => 'Request Submitted',
            'description' => 'Your booking request has been submitted successfully and is awaiting review.',
        ]);
    }

    return new WP_REST_Response(['success' => true, 'wp_id' => $local_id]);
}

/**
 * REST: Sync a status update into the WP database.
 * Called by Node.js backend after admin changes booking request status.
 */
function pe_cp_rest_sync_status($request)
{
    global $wpdb;
    $d = $request->get_json_params();

    $awb = sanitize_text_field($d['request_awb'] ?? '');
    if (!$awb) {
        return new WP_REST_Response(['success' => false, 'message' => 'request_awb required'], 400);
    }

    // Find local booking request by AWB
    $local = $wpdb->get_row($wpdb->prepare(
        "SELECT * FROM booking_requests WHERE request_awb = %s", $awb
    ));

    if (!$local) {
        return new WP_REST_Response(['success' => false, 'message' => 'Booking request not found in WP DB'], 404);
    }

    // Update the booking request fields
    $update_data = ['status' => sanitize_text_field($d['status'] ?? 'pending')];

    if (isset($d['admin_notes'])) {
        $update_data['admin_notes'] = sanitize_textarea_field($d['admin_notes']);
    }
    if (isset($d['shipment_id'])) {
        $update_data['shipment_id'] = intval($d['shipment_id']) ?: null;
    }
    if (isset($d['tracking_number'])) {
        $update_data['tracking_number'] = sanitize_text_field($d['tracking_number']);
    }

    $wpdb->update('booking_requests', $update_data, ['id' => $local->id]);

    // Sync to AWBENTRY & parcel_history (DISABLED BY USER DIRECTIVE)
    // No writes permitted to AWBENTRY or parcel_history.

    // Insert timeline entries
    $updates = $d['updates'] ?? [];
    foreach ($updates as $upd) {
        $wpdb->insert('request_updates', [
            'request_id'  => $local->id,
            'update_type' => sanitize_text_field($upd['type'] ?? 'info'),
            'title'       => sanitize_text_field($upd['title'] ?? ''),
            'description' => sanitize_textarea_field($upd['description'] ?? ''),
            'metadata'    => isset($upd['metadata']) ? wp_json_encode($upd['metadata']) : null,
        ]);
    }

    return new WP_REST_Response(['success' => true, 'synced_updates' => count($updates)]);
}

/**
 * REST: Sync a new AWB / shipment entry into the WP database.
 * Called by Node.js backend after direct booking (shipment) creation.
 */
function pe_cp_rest_sync_awb($request)
{
    global $wpdb;
    $d = $request->get_json_params();

    $awb_no = intval($d['awb_no'] ?? 0);
    if (!$awb_no) {
        return new WP_REST_Response(['success' => false, 'message' => 'awb_no required and must be an integer'], 400);
    }

    // Writes to AWBENTRY and parcel_history are DISABLED by user directive
    return new WP_REST_Response(['success' => true, 'message' => 'Sync received (AWBENTRY & parcel_history writes disabled)'], 200);

    return new WP_REST_Response(['success' => true, 'message' => 'AWB entry synced successfully']);
}
