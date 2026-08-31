<?php
if (!defined('ABSPATH')) exit;
$cust = pe_cp_get_user();
global $wpdb;

// Build precise WHERE clause for logged-in customer's shipments only
$cust_id = intval($cust['customer_id'] ?? ($cust['id'] ?? 0));
$cust_phone = trim($cust['phone'] ?? '');
$cust_email = trim($cust['email'] ?? '');
$cust_name = trim($cust['name'] ?? '');

$match_clauses = [];
$match_params = [];

// 1. CUSTCODE match (ID e.g. "1" or "CUST-1")
if ($cust_id > 0) {
    $match_clauses[] = "a.CUSTCODE = %s OR a.CUSTCODE = %s";
    $match_params[] = strval($cust_id);
    $match_params[] = 'CUST-' . $cust_id;
}

// 2. Phone match (exact, non-empty)
if ($cust_phone !== '') {
    $match_clauses[] = "a.SPHONE1 = %s OR a.SPHONE2 = %s";
    $match_params[] = $cust_phone;
    $match_params[] = $cust_phone;
}

// 3. Email match (exact in CUSTNAME or in REMARKS)
if ($cust_email !== '') {
    $match_clauses[] = "LOWER(a.CUSTNAME) = LOWER(%s) OR a.REMARKS LIKE %s";
    $match_params[] = $cust_email;
    $match_params[] = '%' . $wpdb->esc_like($cust_email) . '%';
}

// 4. Exact full name match (NOT like '%%')
if (strlen($cust_name) >= 3) {
    $match_clauses[] = "LOWER(TRIM(a.SNAME)) = LOWER(TRIM(%s))";
    $match_params[] = $cust_name;
}

if (empty($match_clauses)) {
    $where_cust = "1=0";
} else {
    $where_cust = $wpdb->prepare("(" . implode(" OR ", $match_clauses) . ")", ...$match_params);
}

$_st = "(SELECT ph.activity FROM parcel_history ph WHERE ph.AWBNO = a.AWBNO ORDER BY ph.date DESC, ph.time DESC LIMIT 1)";
$ts = intval($wpdb->get_var("SELECT COUNT(*) FROM AWBENTRY a WHERE $where_cust"));
$dc = intval($wpdb->get_var("SELECT COUNT(*) FROM AWBENTRY a WHERE $where_cust AND LOWER(COALESCE($_st, '')) LIKE '%delivered%'"));
$tc = intval($wpdb->get_var("SELECT COUNT(*) FROM AWBENTRY a WHERE $where_cust AND (LOWER(COALESCE($_st, '')) LIKE '%transit%' OR LOWER(COALESCE($_st, '')) LIKE '%departed%')"));

$iframe_booking_url = esc_url(add_query_arg([
    'cust_name' => $cust['name'],
    'cust_email' => $cust['email'],
    'cust_phone' => $cust['phone'],
    'cust_company' => $cust['company'] ?? '',
    'cust_id' => $cust['customer_id'] ?? ''
], PE_ADMIN_PORTAL_URL));

// Count pending requests for sidebar badge
$cust_email_for_req = $cust['email'] ?? '';
$cust_phone_for_req = $cust['phone'] ?? '';
$cust_id_for_req = $cust['customer_id'] ?? 0;
$where_requests = $wpdb->prepare(
    "(customer_email = %s OR sender_email = %s OR customer_phone = %s OR sender_phone = %s" .
    ($cust_id_for_req ? " OR customer_id = %d" : "") . ")",
    ...array_merge(
        [$cust_email_for_req, $cust_email_for_req, $cust_phone_for_req, $cust_phone_for_req],
        $cust_id_for_req ? [$cust_id_for_req] : []
    )
);
$pending_requests_count = intval($wpdb->get_var("SELECT COUNT(*) FROM booking_requests WHERE status = 'pending' AND ($where_requests)"));

// Fetch customer balance & credit limit
$cust_balance = 0.00;
$cust_credit_limit = 0.00;
if (!empty($cust['customer_id'])) {
    $cb = $wpdb->get_row($wpdb->prepare("SELECT current_balance, credit_limit FROM tbl_customers WHERE id = %d", intval($cust['customer_id'])));
    if ($cb) {
        $cust_balance = floatval($cb->current_balance);
        $cust_credit_limit = floatval($cb->credit_limit);
    }
}
?>
<style>
#wpadminbar{display:none!important}html{margin-top:0!important}
*,*::before,*::after{box-sizing:border-box}

@keyframes cp-fadeIn{from{opacity:0}to{opacity:1}}
@keyframes cp-fadeUp{from{opacity:0;transform:translateY(15px)}to{opacity:1;transform:translateY(0)}}
@keyframes cp-slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
@keyframes cp-shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
@keyframes cp-spin{to{transform:rotate(360deg)}}
@keyframes cp-pulse-live{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.85)}}

:root{
  --cpbg:#f8fafc;
  --cpcard:#fff;
  --cpbdr:#e2e8f0;
  --cptext:#0f172a;
  --cptext2:#475569;
  --cptext3:#94a3b8;
  --cpred:#bb0013;
  --cpred-hover:#a00010;
  --cpgreen:#10b981;
  --cpblue:#3b82f6;
  --cpamber:#f59e0b;
  --cpsh:0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05);
  --cpsh2:0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);
}

.cp-app{position:fixed;inset:0;z-index:99999;display:flex;font-family:'Inter',sans-serif;background:var(--cpbg);color:var(--cptext);font-size:14px;overflow:hidden}

/* ── SIDEBAR ── */
.cp-sidebar{width:260px;background:#0f172a;border-right:1px solid #1e293b;display:flex;flex-direction:column;flex-shrink:0;position:relative;z-index:10}
.cp-sidebar-brand{display:flex;align-items:center;gap:12px;padding:24px;border-bottom:1px solid #1e293b}
.cp-sidebar-brand img{width:36px;height:36px;border-radius:8px;object-fit:contain;filter:drop-shadow(0 2px 8px rgba(187,0,19,.2))}
.cp-sidebar-brand h3{font-size:15px;font-weight:900;color:#fff;margin:0;letter-spacing:1px}
.cp-sidebar-brand p{font-size:10px;font-weight:700;color:var(--cptext3);letter-spacing:1.5px;margin:2px 0 0;text-transform:uppercase}

.cp-sidebar-nav{flex:1;padding:24px 16px;display:flex;flex-direction:column;gap:6px;overflow-y:auto}
.cp-nav-item{display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:12px;color:#94a3b8;font-weight:600;text-decoration:none;cursor:pointer;transition:all .2s;border:none;background:transparent;text-align:left;width:100%;font-size:14px}
.cp-nav-item:hover{color:#fff;background:rgba(255,255,255,0.05)}
.cp-nav-item.active{color:#fff;background:var(--cpred);box-shadow:0 4px 12px rgba(187,0,19,.25)}
.cp-nav-item i{font-size:16px;width:20px;text-align:center}

.cp-sidebar-footer{padding:20px 24px;border-top:1px solid #1e293b;background:#090d16;display:flex;flex-direction:column;gap:12px}
.cp-user-info{display:flex;align-items:center;gap:12px}
.cp-user-avatar{width:36px;height:36px;background:linear-gradient(135deg,#bb0013,#d4001a);border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:14px;box-shadow:0 2px 8px rgba(187,0,19,.3)}
.cp-user-details{flex:1;min-width:0}
.cp-user-name{font-size:13px;font-weight:700;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cp-user-role{font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:1px}
.cp-logout-btn{padding:8px 12px;border-radius:8px;border:1px solid #334155;background:transparent;color:#94a3b8;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:all .15s}
.cp-logout-btn:hover{border-color:var(--cpred);color:#fff;background:var(--cpred)}

/* ── MAIN CONTENT ── */
.cp-main{flex:1;display:flex;flex-direction:column;overflow:hidden;position:relative}
.cp-main-content{flex:1;overflow-y:auto;padding:32px;display:none}
.cp-main-content.active{display:block;animation:cp-fadeIn .3s ease}

/* ── HEADER & TYPOGRAPHY ── */
.cp-hdr-wrap{margin-bottom:28px}
.cp-page-title{font-size:26px;font-weight:900;color:var(--cptext);letter-spacing:-.5px;margin:0 0 4px}
.cp-page-sub{font-size:14px;color:var(--cptext2);margin:0;font-weight:500}

/* ── STATS ── */
.cp-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px}
.cp-stat{background:var(--cpcard);border-radius:16px;padding:22px 24px;border:1px solid var(--cpbdr);box-shadow:var(--cpsh);display:flex;justify-content:space-between;align-items:flex-start;position:relative;overflow:hidden;transition:all .2s;cursor:default}
.cp-stat:hover{transform:translateY(-3px);box-shadow:var(--cpsh2)}
.cp-stat::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--cpred)}
.cp-stat:nth-child(2)::before{background:var(--cpamber)}
.cp-stat:nth-child(3)::before{background:var(--cpgreen)}
.cp-stat:nth-child(4)::before{background:var(--cpblue)}
.cp-stat-label{font-size:11px;font-weight:800;color:var(--cptext3);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px}
.cp-stat-value{font-size:32px;font-weight:900;color:var(--cptext);letter-spacing:-1px;line-height:1}
.cp-stat-desc{font-size:12px;font-weight:600;margin-top:6px}
.cp-stat-desc.g{color:var(--cpgreen)}.cp-stat-desc.w{color:var(--cpamber)}.cp-stat-desc.b{color:var(--cpblue)}.cp-stat-desc.r{color:var(--cpred)}
.cp-stat-icon{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
.cp-stat:nth-child(1) .cp-stat-icon{background:rgba(187,0,19,.08);color:var(--cpred)}
.cp-stat:nth-child(2) .cp-stat-icon{background:rgba(245,158,11,.08);color:var(--cpamber)}
.cp-stat:nth-child(3) .cp-stat-icon{background:rgba(16,185,129,.08);color:var(--cpgreen)}
.cp-stat:nth-child(4) .cp-stat-icon{background:rgba(59,130,246,.08);color:var(--cpblue)}

/* ── NEW BOOKING CTA ── */
.cp-cta-card{background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);border-radius:16px;padding:24px 28px;margin-bottom:24px;display:flex;align-items:center;justify-content:space-between;gap:24px;box-shadow:0 4px 24px rgba(0,0,0,.08);position:relative;overflow:hidden}
.cp-cta-card::before{content:'';position:absolute;top:-60px;right:-40px;width:220px;height:220px;background:radial-gradient(circle,rgba(187,0,19,.15),transparent 70%);pointer-events:none}
.cp-cta-info h3{font-size:20px;font-weight:800;color:#fff;margin:0 0 4px}
.cp-cta-info p{font-size:13px;color:#94a3b8;margin:0;max-width:400px}
.cp-cta-btn-link{display:inline-flex;align-items:center;gap:8px;padding:12px 24px;background:linear-gradient(135deg,#bb0013,#d4001a);color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;transition:all .2s;text-decoration:none;box-shadow:0 4px 12px rgba(187,0,19,.3)}
.cp-cta-btn-link:hover{transform:translateY(-1px);box-shadow:0 6px 18px rgba(187,0,19,.4)}

/* ── SHIPMENT TABLE ── */
.cp-tc{background:var(--cpcard);border-radius:16px;border:1px solid var(--cpbdr);box-shadow:var(--cpsh);overflow:hidden}
.cp-th{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--cpbdr)}
.cp-th h3{font-size:15px;font-weight:800;display:flex;align-items:center;gap:8px;margin:0;color:var(--cptext)}
.cp-th h3 i{color:var(--cpred)}
.cp-th .badge{font-size:11px;font-weight:700;background:rgba(187,0,19,.08);color:var(--cpred);padding:3px 10px;border-radius:14px;margin-left:6px}
.cp-tw{overflow-x:auto}
table.cp-t{width:100%;border-collapse:collapse;min-width:750px}
.cp-t thead th{padding:12px 16px;font-size:10px;font-weight:800;color:var(--cptext3);text-transform:uppercase;letter-spacing:1px;text-align:left;border-bottom:1px solid var(--cpbdr);background:#f8fafc}
.cp-t tbody tr{border-bottom:1px solid #f1f5f9;cursor:pointer;transition:all .15s}
.cp-t tbody tr:hover{background:rgba(187,0,19,.02)}
.cp-t tbody td{padding:14px 16px;font-size:13px;font-weight:500;color:var(--cptext2)}
.cp-t .awbc{font-weight:700;color:var(--cptext);font-family:monospace;font-size:14px}
.cp-t .nmc{font-weight:600;color:var(--cptext);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cp-st{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600}
.cp-dot{width:7px;height:7px;border-radius:50%}
.dd{background:var(--cpgreen)}.dt{background:var(--cpamber)}.db{background:var(--cptext3)}.dr{background:#ef4444}.dbl{background:var(--cpblue)}

/* ── FILTER & SEARCH ── */
.cp-fb{display:flex;gap:12px;margin-bottom:16px}
.cp-fs{flex:1;display:flex;align-items:center;gap:10px;background:var(--cpcard);border:1px solid var(--cpbdr);border-radius:12px;padding:0 14px;transition:all .2s;box-shadow:var(--cpsh)}
.cp-fs:focus-within{border-color:var(--cpred);box-shadow:0 0 0 3px rgba(187,0,19,.06)}
.cp-fs i{color:var(--cptext3)}
.cp-fs input{flex:1;padding:10px 0;border:none;background:transparent;font-size:13px;font-family:inherit;color:var(--cptext);outline:none}

/* ── PAGINATION ── */
.cp-pg{display:flex;justify-content:space-between;align-items:center;padding:14px 20px;border-top:1px solid var(--cpbdr);background:#f8fafc}
.cp-pi{font-size:12px;color:var(--cptext3)}.cp-pi strong{color:var(--cpred)}
.cp-pbs{display:flex;gap:4px}
.cp-pb{width:32px;height:32px;border-radius:6px;border:1px solid var(--cpbdr);background:var(--cpcard);color:var(--cptext3);font-size:11px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s}
.cp-pb:hover{background:#f1f5f9;color:var(--cptext2)}.cp-pb.on{background:var(--cpred);color:#fff;border-color:var(--cpred)}.cp-pb:disabled{opacity:.4;cursor:not-allowed}

/* ── IFRAME VIEW ── */
.cp-iframe-wrapper{width:100%;height:calc(100vh - 64px);border:none;border-radius:16px;background:var(--cpcard);overflow:hidden;box-shadow:var(--cpsh);border:1px solid var(--cpbdr)}

/* ── PROFILE VIEW FORM ── */
.cp-profile-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}
.cp-profile-card{background:var(--cpcard);border-radius:16px;border:1px solid var(--cpbdr);padding:24px;box-shadow:var(--cpsh);animation:cp-fadeUp .3s ease both}
.cp-profile-card h3{font-size:16px;font-weight:800;margin:0 0 16px;color:var(--cptext);display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--cpbdr);padding-bottom:12px}
.cp-profile-card h3 i{color:var(--cpred)}
.cp-form-group{margin-bottom:16px}
.cp-form-group label{display:block;font-size:12px;font-weight:700;color:var(--cptext2);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px}
.cp-form-input{width:100%;padding:10px 14px;background:#f8fafc;border:1px solid var(--cpbdr);border-radius:8px;font-size:13px;color:var(--cptext);transition:all .2s;font-family:inherit;font-weight:500}
.cp-form-input:focus{border-color:var(--cpred);background:#fff;box-shadow:0 0 0 3px rgba(187,0,19,.06);outline:none}
.cp-form-submit{padding:10px 20px;background:var(--cpred);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;transition:all .15s}
.cp-form-submit:hover{background:var(--cpred-hover)}

/* ── DETAIL PANEL ── */
.cp-do{display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:100000;justify-content:flex-end;backdrop-filter:blur(4px)}
.cp-do.show{display:flex}
.cp-dp{width:560px;max-width:100%;background:var(--cpcard);height:100%;overflow-y:auto;border-left:1px solid var(--cpbdr);animation:cp-slideIn .3s ease}
.cp-dh{padding:20px 24px;border-bottom:1px solid var(--cpbdr);display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;background:var(--cpcard);z-index:2}
.cp-dh h3{font-size:16px;font-weight:800;margin:0;display:flex;align-items:center;gap:8px;color:var(--cptext)}
.cp-dh h3 i{color:var(--cpred)}
.cp-dc{width:32px;height:32px;border-radius:6px;border:1px solid var(--cpbdr);background:var(--cpcard);cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--cptext3)}
.cp-dc:hover{background:rgba(187,0,19,.08);color:var(--cpred)}
.cp-db-body{padding:24px}
.cp-ds{margin-bottom:20px}
.cp-ds h4{font-size:11px;font-weight:800;color:var(--cptext3);text-transform:uppercase;letter-spacing:1.5px;margin:0 0 10px;display:flex;align-items:center;gap:6px}
.cp-ds h4 i{color:var(--cpred)}
.cp-dg{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.cp-df{background:#f8fafc;border:1px solid var(--cpbdr);border-radius:10px;padding:10px 14px}
.cp-df .l{font-size:9px;font-weight:800;color:var(--cptext3);text-transform:uppercase;margin-bottom:3px}
.cp-df .v{font-size:13px;font-weight:600;color:var(--cptext)}
.cp-df.fl{grid-column:1/-1}

/* ── TIMELINE ── */
.cp-tl{list-style:none;padding:0;margin:0}
.cp-tl li{position:relative;padding:10px 0 10px 24px;border-left:2px solid var(--cpred);margin-left:6px}
.cp-tl li::before{content:'';position:absolute;left:-5px;top:14px;width:8px;height:8px;border-radius:50%;background:var(--cpred);border:2px solid var(--cpcard)}
.cp-tl li:first-child::before{background:var(--cpgreen)}
.cp-tl-card{background:#f8fafc;border:1px solid var(--cpbdr);border-radius:8px;padding:10px 12px}
.cp-tla{font-weight:700;color:var(--cptext);font-size:13px;margin-bottom:2px}
.cp-tlm{font-size:11px;color:var(--cptext3)}

/* ── SKELETON ── */
.cp-skeleton{background:linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%);background-size:800px 100%;animation:cp-shimmer 1.5s ease infinite;border-radius:6px;height:16px}

/* ── RESPONSIVE ── */
@media(max-width:960px){
  .cp-app{flex-direction:column}
  .cp-sidebar{width:100%;height:auto;flex-direction:row;justify-content:space-between;align-items:center;padding:10px 16px;border-bottom:1px solid #1e293b}
  .cp-sidebar-brand{padding:0;border-bottom:none}
  .cp-sidebar-nav{flex-direction:row;padding:0;gap:4px;overflow-x:auto}
  .cp-nav-item{padding:8px 12px;font-size:13px}
  .cp-sidebar-footer{display:none}
  .cp-main-content{padding:20px 16px}
  .cp-stats{grid-template-columns:repeat(2,1fr)}
  .cp-profile-grid{grid-template-columns:1fr}
}
@media(max-width:480px){
  .cp-sidebar-brand h3{display:none}
  .cp-stats{grid-template-columns:1fr}
}

/* ── REQUEST STATUS STYLES ── */
.st-pending { color: var(--cpamber); font-weight: 700; }
.st-processing { color: var(--cpblue); font-weight: 700; }
.st-confirmed { color: var(--cpgreen); font-weight: 700; }
.st-rejected { color: var(--cpred); font-weight: 700; }

.bg-pending { background: var(--cpamber) !important; }
.bg-processing { background: var(--cpblue) !important; }
.bg-confirmed { background: var(--cpgreen) !important; }
.bg-rejected { background: var(--cpred) !important; }

.cp-status-tab.active {
  background: #fff !important;
  color: var(--cptext) !important;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

/* ── LIVE INDICATOR ── */
.cp-live-badge{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:14px;background:rgba(16,185,129,.08);font-size:10px;font-weight:800;color:var(--cpgreen);letter-spacing:.5px;margin-left:8px;text-transform:uppercase;transition:opacity .3s}
.cp-live-dot{width:6px;height:6px;border-radius:50%;background:var(--cpgreen);animation:cp-pulse-live 1.5s ease-in-out infinite}
.cp-live-badge.paused{opacity:.3}
.cp-live-badge.paused .cp-live-dot{animation:none}

/* ── TOAST NOTIFICATIONS ── */
.cp-toast-container{position:fixed;top:20px;right:20px;z-index:200000;display:flex;flex-direction:column;gap:10px;pointer-events:none}
.cp-toast{pointer-events:auto;display:flex;align-items:center;gap:12px;padding:14px 20px;border-radius:12px;background:#fff;border:1px solid var(--cpbdr);box-shadow:0 12px 40px rgba(0,0,0,.12),0 4px 12px rgba(0,0,0,.06);min-width:300px;max-width:420px;animation:cp-toast-in .4s ease;font-size:13px;font-weight:600;color:var(--cptext)}
.cp-toast.removing{animation:cp-toast-out .3s ease forwards}
.cp-toast-icon{width:34px;height:34px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0}
.cp-toast-icon.success{background:rgba(16,185,129,.1);color:var(--cpgreen)}
.cp-toast-icon.info{background:rgba(59,130,246,.1);color:var(--cpblue)}
.cp-toast-icon.warning{background:rgba(245,158,11,.1);color:var(--cpamber)}
.cp-toast-icon.error{background:rgba(187,0,19,.1);color:var(--cpred)}
.cp-toast-body{flex:1;min-width:0}
.cp-toast-title{font-weight:700;margin-bottom:2px}
.cp-toast-desc{font-size:11px;color:var(--cptext2);font-weight:500}
@keyframes cp-toast-in{from{opacity:0;transform:translateX(40px) scale(.95)}to{opacity:1;transform:translateX(0) scale(1)}}
@keyframes cp-toast-out{to{opacity:0;transform:translateX(40px) scale(.95)}}

/* ── ROW HIGHLIGHT ON CHANGE ── */
@keyframes cp-row-highlight{0%{background:rgba(16,185,129,.12)}100%{background:transparent}}
.cp-t tbody tr.cp-row-changed{animation:cp-row-highlight 2s ease-out}
</style>

<div class="cp-app" id="cp-app">

  <!-- SIDEBAR -->
  <aside class="cp-sidebar">
    <div class="cp-sidebar-brand">
      <img src="<?php echo esc_url(PE_CP_LOGO_URL); ?>" alt="PE">
      <div>
        <h3>Prince Express</h3>
        <p>Customer Portal</p>
      </div>
    </div>

    <nav class="cp-sidebar-nav">
      <button class="cp-nav-item active" onclick="cpSwitchTab('shipments', this)">
        <i class="fa-solid fa-boxes-stacked"></i> My Shipments
      </button>
      <button class="cp-nav-item" onclick="cpSwitchTab('requests', this)">
        <i class="fa-solid fa-clipboard-list"></i> My Requests
        <?php if ($pending_requests_count > 0): ?>
          <span class="cp-nav-badge" style="background:var(--cpamber);color:#fff;border-radius:10px;padding:1px 6px;font-size:10px;font-weight:700;margin-left:auto"><?php echo $pending_requests_count; ?></span>
        <?php endif; ?>
      </button>
      <button class="cp-nav-item" onclick="cpSwitchTab('new-booking', this)">
        <i class="fa-solid fa-plus"></i> Request Booking
      </button>
      <button class="cp-nav-item" onclick="cpSwitchTab('addresses', this)">
        <i class="fa-solid fa-address-book"></i> Address Book
      </button>
      <button class="cp-nav-item" onclick="cpSwitchTab('documents', this)">
        <i class="fa-solid fa-file-shield"></i> My Documents
      </button>
      <button class="cp-nav-item" onclick="cpSwitchTab('profile', this)">
        <i class="fa-solid fa-user-gear"></i> My Profile
      </button>
    </nav>

    <div class="cp-sidebar-footer">
      <div class="cp-user-info">
        <div class="cp-user-avatar"><?php echo strtoupper(substr($cust['name'], 0, 1)); ?></div>
        <div class="cp-user-details">
          <div class="cp-user-name" id="cp-sidebar-uname"><?php echo esc_html($cust['name']); ?></div>
          <div class="cp-user-role">Customer Account</div>
        </div>
      </div>
      <button class="cp-logout-btn" onclick="cpLogout()">
        <i class="fa-solid fa-right-from-bracket"></i> Sign Out
      </button>
    </div>
  </aside>

  <!-- MAIN -->
  <main class="cp-main">

    <!-- TAB 1: SHIPMENTS -->
    <div class="cp-main-content active" id="tab-shipments">
      <div class="cp-hdr-wrap">
        <h1 class="cp-page-title">Welcome, <span id="cp-welcome-uname"><?php echo esc_html(ucfirst($cust['name'])); ?></span></h1>
        <p class="cp-page-sub">Manage your shipments, view detailed statuses, and request new bookings.</p>
      </div>

      <!-- Stats -->
      <div class="cp-stats" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
        <div class="cp-stat"><div><div class="cp-stat-label">Total Shipments</div><div class="cp-stat-value"><?php echo number_format($ts); ?></div><div class="cp-stat-desc r">All time</div></div><div class="cp-stat-icon"><i class="fa-solid fa-boxes-stacked"></i></div></div>
        <div class="cp-stat"><div><div class="cp-stat-label">In Transit</div><div class="cp-stat-value"><?php echo str_pad($tc, 2, '0', STR_PAD_LEFT); ?></div><div class="cp-stat-desc w">On the way</div></div><div class="cp-stat-icon"><i class="fa-solid fa-truck"></i></div></div>
        <div class="cp-stat"><div><div class="cp-stat-label">Delivered</div><div class="cp-stat-value"><?php echo number_format($dc); ?></div><div class="cp-stat-desc g">Completed</div></div><div class="cp-stat-icon"><i class="fa-solid fa-circle-check"></i></div></div>
        <div class="cp-stat"><div><div class="cp-stat-label">Account Balance</div><div class="cp-stat-value" style="font-size:20px; font-weight:800; color:<?php echo $cust_balance > 0 ? 'var(--cpgreen)' : 'var(--cptext)'; ?>">₹<?php echo number_format($cust_balance, 2); ?></div><div class="cp-stat-desc b">Available / Net</div></div><div class="cp-stat-icon"><i class="fa-solid fa-wallet"></i></div></div>
        <div class="cp-stat"><div><div class="cp-stat-label">Credit Limit</div><div class="cp-stat-value" style="font-size:20px; font-weight:800; color:var(--cpblue);">₹<?php echo number_format($cust_credit_limit, 2); ?></div><div class="cp-stat-desc r">Approved Limit</div></div><div class="cp-stat-icon"><i class="fa-solid fa-shield-halved"></i></div></div>
      </div>

      <!-- Quick CTA -->
      <div class="cp-cta-card">
        <div class="cp-cta-info">
          <h3>Need to ship a package? 📦</h3>
          <p>Fill in your shipment details and our team will handle the rest. You'll receive your AWB number instantly.</p>
        </div>
        <button class="cp-cta-btn-link" onclick="cpSwitchTab('new-booking')" style="border:none;cursor:pointer;">
          <i class="fa-solid fa-plus"></i> Request Booking
        </button>
      </div>

      <!-- Search & Filters -->
      <div class="cp-fb">
        <div class="cp-fs" style="position:relative; width: 100%; max-width: 450px;">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input type="text" id="cp-search" placeholder="Search AWB, consignee, destination..." oninput="cpDebounceShipmentsSearch()" onkeydown="if(event.key==='Enter')cpLoadShipments(1);">
          <button type="button" id="cp-search-clear" onclick="cpClearShipmentsSearch()" style="display:none; position:absolute; right:12px; top:50%; transform:translateY(-50%); background:transparent; border:none; color:var(--cptext3); cursor:pointer; font-size:13px;"><i class="fa-solid fa-xmark"></i></button>
        </div>
      </div>
      <div id="cp-shipments-container"></div>
    </div>

    <!-- TAB 2: REQUESTS -->
    <div class="cp-main-content" id="tab-requests">
      <div class="cp-hdr-wrap">
        <h1 class="cp-page-title">Booking Requests <span class="cp-live-badge" id="cp-live-badge"><span class="cp-live-dot"></span>Live</span></h1>
        <p class="cp-page-sub">Track progress and status updates for your submitted booking requests.</p>
      </div>

      <!-- Filters & Search -->
      <div class="cp-fb" style="flex-wrap: wrap; gap: 12px; margin-bottom: 20px;">
        <div class="cp-fs" style="position:relative; min-width: 250px; flex: 1; max-width: 450px;">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input type="text" id="cp-req-search" placeholder="Search AWB, consignee, city..." oninput="cpDebounceRequestsSearch()" onkeydown="if(event.key==='Enter')cpLoadRequests(1);">
          <button type="button" id="cp-req-search-clear" onclick="cpClearRequestsSearch()" style="display:none; position:absolute; right:12px; top:50%; transform:translateY(-50%); background:transparent; border:none; color:var(--cptext3); cursor:pointer; font-size:13px;"><i class="fa-solid fa-xmark"></i></button>
        </div>
        
        <!-- Status Tabs for Requests -->
        <div class="cp-status-tabs" style="display: flex; gap: 6px; background: rgba(0,0,0,0.03); padding: 4px; border-radius: 8px; border: 1px solid var(--cpbdr);">
          <button class="cp-status-tab active" onclick="cpSetRequestStatusFilter('', this)" style="border:none; background:transparent; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:700; color:var(--cptext2); cursor:pointer;">All</button>
          <button class="cp-status-tab" onclick="cpSetRequestStatusFilter('pending', this)" style="border:none; background:transparent; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:700; color:var(--cptext2); cursor:pointer;">Pending</button>
          <button class="cp-status-tab" onclick="cpSetRequestStatusFilter('processing', this)" style="border:none; background:transparent; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:700; color:var(--cptext2); cursor:pointer;">Processing</button>
          <button class="cp-status-tab" onclick="cpSetRequestStatusFilter('confirmed', this)" style="border:none; background:transparent; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:700; color:var(--cptext2); cursor:pointer;">Confirmed</button>
          <button class="cp-status-tab" onclick="cpSetRequestStatusFilter('rejected', this)" style="border:none; background:transparent; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:700; color:var(--cptext2); cursor:pointer;">Rejected</button>
        </div>
      </div>
      <div id="cp-requests-container"></div>
    </div>

    <!-- TAB 3: MY PROFILE -->
    <div class="cp-main-content" id="tab-profile">
      <div class="cp-hdr-wrap">
        <h1 class="cp-page-title">Account Settings</h1>
        <p class="cp-page-sub">Keep your contact information up-to-date and manage password security.</p>
      </div>

      <div class="cp-profile-grid">
        <!-- Personal Details -->
        <div class="cp-profile-card">
          <h3><i class="fa-solid fa-address-card"></i> Personal Details</h3>
          <form id="cp-profile-form">
            <div class="cp-form-group">
              <label>Full Name</label>
              <input type="text" id="profile-name" class="cp-form-input" value="<?php echo esc_attr($cust['name']); ?>" required>
            </div>
            <div class="cp-form-group">
              <label>Email Address</label>
              <input type="email" id="profile-email" class="cp-form-input" value="<?php echo esc_attr($cust['email']); ?>" required>
            </div>
            <div class="cp-form-group">
              <label>Phone Number</label>
              <input type="text" id="profile-phone" class="cp-form-input" value="<?php echo esc_attr($cust['phone']); ?>">
            </div>
            <div class="cp-form-group">
              <label>Company Name</label>
              <input type="text" id="profile-company" class="cp-form-input" value="<?php echo esc_attr($cust['company'] ?? ''); ?>">
            </div>
            <button type="submit" class="cp-form-submit" id="profile-submit">Save Changes</button>
          </form>
        </div>

        <!-- Security -->
        <div class="cp-profile-card">
          <h3><i class="fa-solid fa-shield-halved"></i> Change Password</h3>
          <form id="cp-password-form">
            <div class="cp-form-group">
              <label>Current Password</label>
              <input type="password" id="pass-current" class="cp-form-input" placeholder="Enter current password" required>
            </div>
            <div class="cp-form-group">
              <label>New Password</label>
              <input type="password" id="pass-new" class="cp-form-input" placeholder="Min. 6 characters" required>
            </div>
            <div class="cp-form-group">
              <label>Confirm New Password</label>
              <input type="password" id="pass-confirm" class="cp-form-input" placeholder="Confirm new password" required>
            </div>
            <button type="submit" class="cp-form-submit" id="password-submit">Update Password</button>
          </form>
        </div>
      </div>
    </div>

    <!-- TAB 4: NEW BOOKING -->
    <div class="cp-main-content" id="tab-new-booking">
      <div class="cp-hdr-wrap" style="margin-bottom:16px;">
        <h1 class="cp-page-title">Submit Booking Request</h1>
        <p class="cp-page-sub">Fill out the details below to submit a shipment booking request.</p>
      </div>
      <div style="background:var(--cpcard); border-radius:16px; border:1px solid var(--cpbdr); overflow:hidden; box-shadow:var(--cpsh);">
        <iframe id="pe-booking-iframe" src="<?php echo $iframe_booking_url; ?>" style="width:100%; height:calc(100vh - 180px); border:none;" title="Booking Request Form"></iframe>
      </div>
    </div>

    <!-- TAB 5: ADDRESS BOOK -->
    <div class="cp-main-content" id="tab-addresses">
      <div class="cp-hdr-wrap" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <div>
          <h1 class="cp-page-title">Address Book</h1>
          <p class="cp-page-sub">Save and manage your frequently used pickup and delivery addresses.</p>
        </div>
        <button class="cp-cta-btn-link" onclick="cpOpenAddressModal()" style="border:none; cursor:pointer; padding:10px 18px; border-radius:10px; background:var(--cpred); color:#fff; font-weight:700; font-size:13px; display:inline-flex; align-items:center; gap:8px;">
          <i class="fa-solid fa-plus"></i> Add New Address
        </button>
      </div>

      <div id="cp-addresses-container">
        <div style="padding:40px; text-align:center;"><div style="width:30px;height:30px;border:3px solid #e5e7eb;border-top-color:#bb0013;border-radius:50%;animation:cp-spin .6s linear infinite;margin:0 auto 16px"></div><p style="color:#94a3b8;">Loading address book...</p></div>
      </div>
    </div>

    <!-- TAB 6: MY DOCUMENTS / KYC -->
    <div class="cp-main-content" id="tab-documents">
      <div class="cp-hdr-wrap">
        <h1 class="cp-page-title">My Documents & KYC</h1>
        <p class="cp-page-sub">Upload, view, and store your identity documents, invoices, and shipping certificates.</p>
      </div>

      <!-- Quick Upload Card -->
      <div class="cp-profile-card" style="margin-bottom:24px; background:var(--cpcard); border-radius:16px; border:1px solid var(--cpbdr); padding:24px; box-shadow:var(--cpsh);">
        <h3 style="font-size:15px; font-weight:800; color:var(--cptext); margin:0 0 16px; display:flex; align-items:center; gap:8px;">
          <i class="fa-solid fa-cloud-arrow-up" style="color:var(--cpred);"></i> Upload New Document
        </h3>
        <form id="cp-doc-upload-form" enctype="multipart/form-data" onsubmit="cpHandleDocUpload(event)">
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:16px; margin-bottom:16px;">
            <div class="cp-form-group">
              <label style="font-size:11px; font-weight:700; color:var(--cptext2); text-transform:uppercase; display:block; margin-bottom:6px;">Document Type *</label>
              <select id="doc-upload-type" class="cp-form-input" required style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid var(--cpbdr); font-size:13px;">
                <option value="Aadhaar Card">Aadhaar Card</option>
                <option value="PAN Card">PAN Card</option>
                <option value="Passport">Passport</option>
                <option value="GST Certificate">GST Certificate</option>
                <option value="IEC Certificate">IEC Certificate</option>
                <option value="Commercial Invoice">Commercial Invoice</option>
                <option value="Packing List">Packing List</option>
                <option value="Other">Other Document</option>
              </select>
            </div>
            <div class="cp-form-group">
              <label style="font-size:11px; font-weight:700; color:var(--cptext2); text-transform:uppercase; display:block; margin-bottom:6px;">Document Name (Optional)</label>
              <input type="text" id="doc-upload-name" class="cp-form-input" placeholder="e.g. Director Aadhaar Card" style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid var(--cpbdr); font-size:13px;">
            </div>
            <div class="cp-form-group">
              <label style="font-size:11px; font-weight:700; color:var(--cptext2); text-transform:uppercase; display:block; margin-bottom:6px;">Document Number (Optional)</label>
              <input type="text" id="doc-upload-number" class="cp-form-input" placeholder="e.g. 12-digit Aadhaar / PAN" style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid var(--cpbdr); font-size:13px;">
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:16px; flex-wrap:wrap;">
            <input type="file" id="doc-upload-file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" required style="font-size:13px;">
            <button type="submit" id="doc-upload-btn" class="cp-form-submit" style="padding:10px 20px; border-radius:10px; background:var(--cpred); color:#fff; font-weight:700; font-size:13px; border:none; cursor:pointer;">
              <i class="fa-solid fa-arrow-up-from-bracket"></i> Upload & Save Document
            </button>
          </div>
        </form>
      </div>

      <div id="cp-documents-container">
        <div style="padding:40px; text-align:center;"><div style="width:30px;height:30px;border:3px solid #e5e7eb;border-top-color:#bb0013;border-radius:50%;animation:cp-spin .6s linear infinite;margin:0 auto 16px"></div><p style="color:#94a3b8;">Loading documents...</p></div>
      </div>
    </div>

  </main>
</div>

<!-- ADDRESS MODAL -->
<div class="cp-do" id="cp-addr-modal-overlay" onclick="if(event.target===this)cpCloseAddressModal()">
  <div class="cp-dp" style="max-width:560px; padding:28px; border-radius:20px; background:#fff; margin:auto; box-shadow:var(--cpsh2);">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:1px solid var(--cpbdr); padding-bottom:14px;">
      <h3 style="font-size:18px; font-weight:900; color:var(--cptext); margin:0;" id="cp-addr-modal-title">
        <i class="fa-solid fa-address-book" style="color:var(--cpred); margin-right:8px;"></i> Add New Address
      </h3>
      <button onclick="cpCloseAddressModal()" style="border:none; background:transparent; font-size:18px; color:var(--cptext3); cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <form id="cp-address-form" onsubmit="cpHandleAddressSubmit(event)">
      <input type="hidden" id="addr-id" value="">
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
        <div class="cp-form-group">
          <label style="font-size:11px; font-weight:700; color:var(--cptext2); text-transform:uppercase;">Address Type *</label>
          <select id="addr-type" class="cp-form-input" style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid var(--cpbdr);">
            <option value="both">Both (Sender & Receiver)</option>
            <option value="sender">Sender (Pickup Address)</option>
            <option value="receiver">Receiver (Delivery Address)</option>
          </select>
        </div>
        <div class="cp-form-group">
          <label style="font-size:11px; font-weight:700; color:var(--cptext2); text-transform:uppercase;">Contact Person / Name *</label>
          <input type="text" id="addr-name" class="cp-form-input" required placeholder="Full Name" style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid var(--cpbdr);">
        </div>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
        <div class="cp-form-group">
          <label style="font-size:11px; font-weight:700; color:var(--cptext2); text-transform:uppercase;">Company Name</label>
          <input type="text" id="addr-company" class="cp-form-input" placeholder="Company Name" style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid var(--cpbdr);">
        </div>
        <div class="cp-form-group">
          <label style="font-size:11px; font-weight:700; color:var(--cptext2); text-transform:uppercase;">Phone Number *</label>
          <input type="tel" id="addr-phone" class="cp-form-input" required placeholder="+91 99999 99999" style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid var(--cpbdr);">
        </div>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
        <div class="cp-form-group">
          <label style="font-size:11px; font-weight:700; color:var(--cptext2); text-transform:uppercase;">Email Address</label>
          <input type="email" id="addr-email" class="cp-form-input" placeholder="email@example.com" style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid var(--cpbdr);">
        </div>
        <div class="cp-form-group">
          <label style="font-size:11px; font-weight:700; color:var(--cptext2); text-transform:uppercase;">Alternate Phone</label>
          <input type="tel" id="addr-phone2" class="cp-form-input" placeholder="Alt phone" style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid var(--cpbdr);">
        </div>
      </div>
      <div class="cp-form-group" style="margin-bottom:12px;">
        <label style="font-size:11px; font-weight:700; color:var(--cptext2); text-transform:uppercase;">Address Line 1 *</label>
        <input type="text" id="addr-line1" class="cp-form-input" required placeholder="Flat / Building / Street" style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid var(--cpbdr);">
      </div>
      <div class="cp-form-group" style="margin-bottom:12px;">
        <label style="font-size:11px; font-weight:700; color:var(--cptext2); text-transform:uppercase;">Address Line 2</label>
        <input type="text" id="addr-line2" class="cp-form-input" placeholder="Area / Landmark" style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid var(--cpbdr);">
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-bottom:12px;">
        <div class="cp-form-group">
          <label style="font-size:11px; font-weight:700; color:var(--cptext2); text-transform:uppercase;">City *</label>
          <input type="text" id="addr-city" class="cp-form-input" required placeholder="City" style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid var(--cpbdr);">
        </div>
        <div class="cp-form-group">
          <label style="font-size:11px; font-weight:700; color:var(--cptext2); text-transform:uppercase;">State</label>
          <input type="text" id="addr-state" class="cp-form-input" placeholder="State" style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid var(--cpbdr);">
        </div>
        <div class="cp-form-group">
          <label style="font-size:11px; font-weight:700; color:var(--cptext2); text-transform:uppercase;">Pincode</label>
          <input type="text" id="addr-pincode" class="cp-form-input" placeholder="Pincode" style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid var(--cpbdr);">
        </div>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px;">
        <div class="cp-form-group">
          <label style="font-size:11px; font-weight:700; color:var(--cptext2); text-transform:uppercase;">Country</label>
          <input type="text" id="addr-country" class="cp-form-input" value="INDIA" placeholder="Country" style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid var(--cpbdr);">
        </div>
        <div class="cp-form-group">
          <label style="font-size:11px; font-weight:700; color:var(--cptext2); text-transform:uppercase;">GST / Tax ID</label>
          <input type="text" id="addr-gstin" class="cp-form-input" placeholder="GSTIN / ID No" style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid var(--cpbdr);">
        </div>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:10px;">
        <button type="button" onclick="cpCloseAddressModal()" style="padding:8px 16px; border-radius:8px; border:1px solid var(--cpbdr); background:transparent; font-size:13px; font-weight:600; cursor:pointer;">Cancel</button>
        <button type="submit" id="addr-submit-btn" style="padding:8px 20px; border-radius:8px; border:none; background:var(--cpred); color:#fff; font-size:13px; font-weight:700; cursor:pointer;">Save Address</button>
      </div>
    </form>
  </div>
</div>

<!-- DETAIL PANEL -->
<div class="cp-do" id="cp-detail-overlay" onclick="if(event.target===this)cpCloseDetail()">
  <div class="cp-dp" id="cp-detail-panel"></div>
</div>

<!-- TOAST CONTAINER -->
<div class="cp-toast-container" id="cp-toast-container"></div>

<script>
var cpPage=1, cpSearch='', cpShipSearchTimer=null;
var cpReqPage=1, cpReqSearch='', cpReqStatus='', cpReqSearchTimer=null;

function cpDebounceShipmentsSearch() {
    var val = (document.getElementById('cp-search')?.value || '').trim();
    var clearBtn = document.getElementById('cp-search-clear');
    if (clearBtn) clearBtn.style.display = val ? 'block' : 'none';
    clearTimeout(cpShipSearchTimer);
    cpShipSearchTimer = setTimeout(function() {
        cpLoadShipments(1);
    }, 350);
}

function cpClearShipmentsSearch() {
    var inp = document.getElementById('cp-search');
    if (inp) { inp.value = ''; }
    var clearBtn = document.getElementById('cp-search-clear');
    if (clearBtn) clearBtn.style.display = 'none';
    cpLoadShipments(1);
}

function cpDebounceRequestsSearch() {
    var val = (document.getElementById('cp-req-search')?.value || '').trim();
    var clearBtn = document.getElementById('cp-req-search-clear');
    if (clearBtn) clearBtn.style.display = val ? 'block' : 'none';
    clearTimeout(cpReqSearchTimer);
    cpReqSearchTimer = setTimeout(function() {
        cpLoadRequests(1);
    }, 350);
}

function cpClearRequestsSearch() {
    var inp = document.getElementById('cp-req-search');
    if (inp) { inp.value = ''; }
    var clearBtn = document.getElementById('cp-req-search-clear');
    if (clearBtn) clearBtn.style.display = 'none';
    cpLoadRequests(1);
}

// Tab Switching Engine
function cpSwitchTab(tabId, btn) {
    document.querySelectorAll('.cp-main-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.cp-nav-item').forEach(i => i.classList.remove('active'));
    
    if (!btn) {
        var items = document.querySelectorAll('.cp-nav-item');
        items.forEach(item => {
            var onclickAttr = item.getAttribute('onclick') || '';
            if (onclickAttr.indexOf("'" + tabId + "'") >= 0) {
                btn = item;
            }
        });
    }
    
    document.getElementById('tab-' + tabId).classList.add('active');
    if (btn) btn.classList.add('active');
    
    // Reload iframe when hitting tab 2
    if (tabId === 'new-booking') {
        var frame = document.getElementById('pe-booking-iframe');
        if (frame) frame.src = frame.src;
    }
    if (tabId === 'requests') {
        cpLoadRequests(1);
    }
}

function cpSetRequestStatusFilter(st, btn) {
    document.querySelectorAll('.cp-status-tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    cpReqStatus = st;
    cpLoadRequests(1);
}

function cpLoadRequests(p, silent) {
    cpReqPage = p || 1;
    cpReqSearch = document.getElementById('cp-req-search').value;
    if (!silent) document.getElementById('cp-requests-container').innerHTML = cpSkeleton();
    cpAjax('pe_cp_my_requests', { page: cpReqPage, search: cpReqSearch, status: cpReqStatus }, function(d) {
        if (!d.success) return;
        var r = d.data;
        // Store hash to detect changes for polling
        var newHash = JSON.stringify(r.rows.map(function(rw){return rw.request_awb+':'+rw.status}));
        
        // Detect status changes and show toast notifications
        if (silent && cpReqLastHash && newHash !== cpReqLastHash) {
            try {
                var oldItems = JSON.parse(cpReqLastHash);
                var newItems = JSON.parse(newHash);
                var oldMap = {};
                oldItems.forEach(function(item) {
                    var parts = item.split(':');
                    oldMap[parts[0]] = parts[1];
                });
                newItems.forEach(function(item) {
                    var parts = item.split(':');
                    var awb = parts[0], st = parts[1];
                    if (oldMap[awb] && oldMap[awb] !== st) {
                        var stLabel = st.charAt(0).toUpperCase() + st.slice(1);
                        var iconType = st === 'confirmed' ? 'success' : st === 'rejected' ? 'error' : st === 'processing' ? 'info' : 'warning';
                        cpShowToast(iconType, 'Status Updated', 'Request ' + awb + ' is now ' + stLabel);
                    }
                });
            } catch(e) {}
        }
        
        if (silent && newHash === cpReqLastHash) return; // No change, skip re-render
        var prevHash = cpReqLastHash;
        cpReqLastHash = newHash;
        var h = '';
        h += '<div class="cp-tc"><div class="cp-th"><h3><i class="fa-solid fa-clipboard-list"></i> Booking Requests <span class="badge">' + r.total + '</span></h3></div>';
        h += '<div class="cp-tw"><table class="cp-t"><thead><tr><th>Request AWB</th><th>Date Submitted</th><th>Receiver</th><th>Destination</th><th>Package</th><th>Status</th></tr></thead><tbody>';
        if (!r.rows.length) h += '<tr><td colspan="6" style="text-align:center;padding:50px;color:var(--cptext3)"><i class="fa-solid fa-inbox" style="font-size:28px;display:block;margin-bottom:10px;opacity:.2"></i>No booking requests found</td></tr>';
        
        r.rows.forEach(function(rw) {
            var stLabel = rw.status.charAt(0).toUpperCase() + rw.status.slice(1);
            var stClass = 'st-' + rw.status;
            var dotClass = 'bg-' + rw.status;
            
            var formattedDate = rw.created_at ? new Date(rw.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
            
            h += '<tr onclick="cpShowRequestDetail(\'' + rw.request_awb + '\')">'; 
            h += '<td class="awbc">' + rw.request_awb + '</td>';
            h += '<td style="font-weight:600;color:var(--cptext2)">' + formattedDate + '</td>';
            h += '<td class="nmc">' + (rw.receiver_name || '—') + '</td>';
            h += '<td><i class="fa-solid fa-location-dot" style="color:var(--cptext3);font-size:10px;margin-right:4px"></i>' + (rw.receiver_city || '—') + '</td>';
            h += '<td style="font-weight:600">' + (rw.weight || '—') + ' kg (' + (rw.package_type || 'parcel') + ')</td>';
            h += '<td><div class="cp-st"><span class="cp-dot ' + dotClass + '"></span><span class="' + stClass + '">' + stLabel + '</span></div></td></tr>';
        });
        h += '</tbody></table></div>';
        h += '<div class="cp-pg"><div class="cp-pi">Showing <strong>' + r.rows.length + '</strong> of <strong>' + r.total + '</strong> · Page ' + r.page + '/' + r.pages + '</div><div class="cp-pbs">';
        h += '<button class="cp-pb" onclick="cpLoadRequests(' + (r.page - 1) + ')" ' + (r.page <= 1 ? 'disabled' : '') + '><i class="fa-solid fa-chevron-left" style="font-size:10px"></i></button>';
        for (var i = Math.max(1, r.page - 2); i <= Math.min(r.pages, r.page + 2); i++) h += '<button class="cp-pb' + (i === r.page ? ' on' : '') + '" onclick="cpLoadRequests(' + i + ')">' + i + '</button>';
        h += '<button class="cp-pb" onclick="cpLoadRequests(' + (r.page + 1) + ')" ' + (r.page >= r.pages ? 'disabled' : '') + '><i class="fa-solid fa-chevron-right" style="font-size:10px"></i></button>';
        h += '</div></div></div>';
        document.getElementById('cp-requests-container').innerHTML = h;
    });
}

function cpShowRequestDetail(awb) {
    cpDetailOpenAwb = awb; // Track which detail is open for polling
    var panel = document.getElementById('cp-detail-panel');
    panel.innerHTML = '<div style="padding:40px;text-align:center"><div style="width:30px;height:30px;border:3px solid #e5e7eb;border-top-color:#bb0013;border-radius:50%;animation:cp-spin .6s linear infinite;margin:0 auto 16px"></div><p style="color:#94a3b8;font-size:14px">Loading request details...</p></div>';
    document.getElementById('cp-detail-overlay').classList.add('show');
    cpRenderRequestDetail(awb, false);
    cpStartDetailPolling();
}

function cpRenderRequestDetail(awb, silent) {
    var panel = document.getElementById('cp-detail-panel');
    cpAjax('pe_cp_request_detail', { request_awb: awb }, function(d) {
        if (!d.success) { if (!silent) panel.innerHTML = '<div style="padding:40px;text-align:center;color:#dc2626">Failed to load details</div>'; return; }
        var r = d.data.request, tl = d.data.timeline;
        // Hash check for silent updates
        var newHash = r.status + ':' + tl.length + ':' + (tl.length ? tl[0].title : '');
        if (silent && newHash === cpDetailLastHash) return;
        cpDetailLastHash = newHash;
        var stLabel = r.status.charAt(0).toUpperCase() + r.status.slice(1);
        var dotClass = 'bg-' + r.status;
        var stClass = 'st-' + r.status;
        
        var formattedDate = r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
        
        var h = '';
        h += '<div class="cp-dh"><h3><i class="fa-solid fa-clipboard-list"></i> Request ' + r.request_awb + ' <span class="cp-live-badge" style="font-size:9px"><span class="cp-live-dot"></span>Live</span></h3><button class="cp-dc" onclick="cpCloseDetail()"><i class="fa-solid fa-xmark"></i></button></div>';
        h += '<div class="cp-db-body">';
        
        // Status & Link to Shipment
        h += '<div class="cp-ds"><h4><i class="fa-solid fa-circle-info"></i> Current Status</h4>';
        h += '<div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:#f8fafc; border-radius:10px; border:1px solid #e2e8f0">';
        h += '  <div style="display:flex; align-items:center; gap:8px;">';
        h += '    <span class="cp-dot ' + dotClass + '" style="width:10px;height:10px"></span>';
        h += '    <span class="' + stClass + '" style="font-size:15px;font-weight:800">' + stLabel + '</span>';
        h += '  </div>';
        
        if (r.tracking_number) {
            h += '  <button onclick="cpCloseDetail(); cpSwitchTab(\'shipments\'); document.getElementById(\'cp-search\').value=\'' + r.tracking_number + '\'; cpLoadShipments(1);" style="border:1px solid var(--cpbdr); background:#fff; padding:6px 12px; border-radius:8px; font-size:12px; font-weight:700; color:var(--cptext2); cursor:pointer;">';
            h += '    <i class="fa-solid fa-truck-ramp-box" style="margin-right:4px;"></i> Track Shipment ' + r.tracking_number;
            h += '  </button>';
        }
        h += '</div></div>';
        
        // Sender/Receiver Details
        h += '<div class="cp-ds"><h4><i class="fa-solid fa-route"></i> Route Details</h4><div class="cp-dg">';
        h += '<div class="cp-df"><div class="l">Sender Name</div><div class="v">' + (r.sender_name || '—') + '</div></div>';
        h += '<div class="cp-df"><div class="l">Receiver Name</div><div class="v">' + (r.receiver_name || '—') + '</div></div>';
        h += '<div class="cp-df"><div class="l">Sender City</div><div class="v">' + (r.sender_city || '—') + '</div></div>';
        h += '<div class="cp-df"><div class="l">Receiver City</div><div class="v">' + (r.receiver_city || '—') + '</div></div>';
        h += '<div class="cp-df fl"><div class="l">Sender Address</div><div class="v">' + [r.sender_address, r.sender_address_2, r.sender_city, r.sender_pincode, r.sender_state].filter(Boolean).join(', ') + '</div></div>';
        h += '<div class="cp-df fl"><div class="l">Receiver Address</div><div class="v">' + [r.receiver_address, r.receiver_address_2, r.receiver_city, r.receiver_pincode, r.receiver_state, r.receiver_country].filter(Boolean).join(', ') + '</div></div>';
        h += '</div></div>';
        
        // Package Details
        h += '<div class="cp-ds"><h4><i class="fa-solid fa-box"></i> Package Details</h4><div class="cp-dg">';
        h += '<div class="cp-df"><div class="l">Package Type</div><div class="v" style="text-transform:capitalize;">' + (r.package_type || '—') + '</div></div>';
        h += '<div class="cp-df"><div class="l">Weight</div><div class="v">' + (r.weight || '—') + ' kg</div></div>';
        h += '<div class="cp-df"><div class="l">No. of Pieces</div><div class="v">' + (r.no_of_pieces || '1') + '</div></div>';
        h += '<div class="cp-df"><div class="l">Declared Value</div><div class="v">₹' + (r.declared_value || '0') + '</div></div>';
        if (r.total_amount || r.shipping_charge) {
            h += '<div class="cp-df"><div class="l">Final Amount / Charges</div><div class="v" style="font-weight:800; color:var(--cpred);">₹' + (r.total_amount || r.shipping_charge || '0') + '</div></div>';
        }
        if (r.content_description) h += '<div class="cp-df fl"><div class="l">Content Description</div><div class="v">' + r.content_description + '</div></div>';
        if (r.remarks) h += '<div class="cp-df fl"><div class="l">Special Instructions / Remarks</div><div class="v">' + r.remarks + '</div></div>';
        if (r.admin_notes) h += '<div class="cp-df fl" style="border-color:rgba(187,0,19,.15); background:rgba(187,0,19,.02);"><div class="l" style="color:var(--cpred)">Admin Notes</div><div class="v">' + r.admin_notes + '</div></div>';
        h += '</div></div>';
        
        // Parcels & Dimensions Table (multi-box)
        if (r.parcels && Array.isArray(r.parcels) && r.parcels.length > 0) {
            h += '<div class="cp-ds"><h4><i class="fa-solid fa-boxes-stacked"></i> Parcels & Dimensions (' + r.parcels.length + ' boxes)</h4>';
            h += '<div style="overflow-x:auto; border:1px solid var(--cpbdr); border-radius:10px;">';
            h += '<table style="width:100%; border-collapse:collapse; font-size:12px;">';
            h += '<thead><tr style="background:var(--cpbg2); border-bottom:1px solid var(--cpbdr);">';
            h += '<th style="padding:8px 10px; text-align:left; font-size:9px; font-weight:800; color:var(--cptext3); text-transform:uppercase; letter-spacing:.5px;">Box</th>';
            h += '<th style="padding:8px 10px; text-align:left; font-size:9px; font-weight:800; color:var(--cptext3); text-transform:uppercase; letter-spacing:.5px;">Weight (kg)</th>';
            h += '<th style="padding:8px 10px; text-align:left; font-size:9px; font-weight:800; color:var(--cptext3); text-transform:uppercase; letter-spacing:.5px;">L × B × H (cm)</th>';
            h += '<th style="padding:8px 10px; text-align:left; font-size:9px; font-weight:800; color:var(--cptext3); text-transform:uppercase; letter-spacing:.5px;">Vol. Wt</th>';
            h += '<th style="padding:8px 10px; text-align:left; font-size:9px; font-weight:800; color:var(--cptext3); text-transform:uppercase; letter-spacing:.5px;">Chg. Wt</th>';
            h += '</tr></thead><tbody>';
            r.parcels.forEach(function(p, i) {
                h += '<tr style="border-bottom:1px solid rgba(0,0,0,.05);">';
                h += '<td style="padding:8px 10px; font-weight:600; color:var(--cptext1);">' + (p.box_no || (i+1)) + '</td>';
                h += '<td style="padding:8px 10px; color:var(--cptext2);">' + (p.weight || '—') + '</td>';
                h += '<td style="padding:8px 10px; color:var(--cptext2);">' + (p.length||0) + ' × ' + (p.breadth||0) + ' × ' + (p.height||0) + '</td>';
                h += '<td style="padding:8px 10px; color:var(--cptext2);">' + (p.volumetric_weight || '—') + '</td>';
                h += '<td style="padding:8px 10px; font-weight:600; color:var(--cptext1);">' + (p.chargeable_weight || '—') + '</td>';
                h += '</tr>';
            });
            h += '</tbody></table></div></div>';
        }
        
        // Invoice Items Table
        if (r.invoice_items && Array.isArray(r.invoice_items) && r.invoice_items.length > 0) {
            h += '<div class="cp-ds"><h4><i class="fa-solid fa-file-invoice"></i> Invoice Items (' + r.invoice_items.length + ')</h4>';
            h += '<div style="overflow-x:auto; border:1px solid var(--cpbdr); border-radius:10px;">';
            h += '<table style="width:100%; border-collapse:collapse; font-size:12px;">';
            h += '<thead><tr style="background:var(--cpbg2); border-bottom:1px solid var(--cpbdr);">';
            h += '<th style="padding:8px 10px; text-align:left; font-size:9px; font-weight:800; color:var(--cptext3); text-transform:uppercase; letter-spacing:.5px;">#</th>';
            h += '<th style="padding:8px 10px; text-align:left; font-size:9px; font-weight:800; color:var(--cptext3); text-transform:uppercase; letter-spacing:.5px;">Box</th>';
            h += '<th style="padding:8px 10px; text-align:left; font-size:9px; font-weight:800; color:var(--cptext3); text-transform:uppercase; letter-spacing:.5px;">Description</th>';
            h += '<th style="padding:8px 10px; text-align:left; font-size:9px; font-weight:800; color:var(--cptext3); text-transform:uppercase; letter-spacing:.5px;">HS Code</th>';
            h += '<th style="padding:8px 10px; text-align:left; font-size:9px; font-weight:800; color:var(--cptext3); text-transform:uppercase; letter-spacing:.5px;">Qty</th>';
            h += '<th style="padding:8px 10px; text-align:left; font-size:9px; font-weight:800; color:var(--cptext3); text-transform:uppercase; letter-spacing:.5px;">Rate</th>';
            h += '<th style="padding:8px 10px; text-align:left; font-size:9px; font-weight:800; color:var(--cptext3); text-transform:uppercase; letter-spacing:.5px;">Amount</th>';
            h += '</tr></thead><tbody>';
            r.invoice_items.forEach(function(item, i) {
                h += '<tr style="border-bottom:1px solid rgba(0,0,0,.05);">';
                h += '<td style="padding:8px 10px; color:var(--cptext3);">' + (item.sr_no || (i+1)) + '</td>';
                h += '<td style="padding:8px 10px; color:var(--cptext2);">' + (item.box_no || '—') + '</td>';
                h += '<td style="padding:8px 10px; font-weight:600; color:var(--cptext1); max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + (item.description || '—') + '</td>';
                h += '<td style="padding:8px 10px; color:var(--cptext2);">' + (item.hs_code || '—') + '</td>';
                h += '<td style="padding:8px 10px; color:var(--cptext2);">' + (item.quantity || '—') + ' ' + (item.unit_type || '') + '</td>';
                h += '<td style="padding:8px 10px; color:var(--cptext2);">' + (item.unit_rates || item.rate || '—') + '</td>';
                h += '<td style="padding:8px 10px; font-weight:600; color:var(--cptext1);">₹' + (item.amount || item.cost || '—') + '</td>';
                h += '</tr>';
            });
            h += '</tbody></table></div></div>';
        }
        
        // Attached Documents
        if (r.documents && Array.isArray(r.documents) && r.documents.length > 0) {
            h += '<div class="cp-ds"><h4><i class="fa-solid fa-paperclip"></i> Attached Documents (' + r.documents.length + ')</h4><div class="cp-dg">';
            r.documents.forEach(function(doc, i) {
                h += '<div class="cp-df fl" style="display:flex; align-items:center; gap:10px;">';
                h += '<i class="fa-solid fa-file-lines" style="color:var(--cpred); font-size:16px;"></i>';
                h += '<div style="flex:1; min-width:0;"><div class="l" style="font-size:12px; font-weight:600; color:var(--cptext1);">' + (doc.doc_type || doc.name || 'Document ' + (i+1)) + '</div>';
                if (doc.doc_number) h += '<div style="font-size:10px; color:var(--cptext3);">No: ' + doc.doc_number + '</div>';
                h += '</div>';
                if (doc.file_url) h += '<a href="' + doc.file_url + '" target="_blank" rel="noopener noreferrer" download style="font-size:11px; font-weight:700; color:var(--cpred); text-decoration:none; display:inline-flex; align-items:center; gap:4px;"><i class="fa-solid fa-arrow-up-right-from-square" style="font-size:10px;"></i> View / Download</a>';
                h += '</div>';
            });
            h += '</div></div>';
        }
        
        // Timeline Section (Merges Status Changes + Shipping Events)
        h += '<div class="cp-ds"><h4><i class="fa-solid fa-clock-rotate-left"></i> Progress Timeline</h4>';
        if (tl.length) {
            h += '<ul class="cp-tl">';
            tl.forEach(function(t, i) {
                var iconHtml = '<i class="fa-solid fa-circle-dot"></i>';
                var borderStyle = '';
                var dotColorClass = 'bg-pending';
                
                if (t.type === 'status_change') {
                    if (t.description.indexOf('confirmed') >= 0) {
                        dotColorClass = 'bg-confirmed';
                        iconHtml = '<i class="fa-solid fa-circle-check"></i>';
                    } else if (t.description.indexOf('rejected') >= 0) {
                        dotColorClass = 'bg-rejected';
                        iconHtml = '<i class="fa-solid fa-circle-xmark"></i>';
                    } else {
                        dotColorClass = 'bg-processing';
                        iconHtml = '<i class="fa-solid fa-circle-dot"></i>';
                    }
                } else if (t.type === 'shipment_created') {
                    dotColorClass = 'bg-confirmed';
                    iconHtml = '<i class="fa-solid fa-truck-fast"></i>';
                } else if (t.type === 'tracking_update') {
                    dotColorClass = 'bg-processing';
                    iconHtml = '<i class="fa-solid fa-location-arrow"></i>';
                    if (t.title.toLowerCase().indexOf('deliver') >= 0) {
                        dotColorClass = 'bg-confirmed';
                        iconHtml = '<i class="fa-solid fa-house-chimney-check"></i>';
                    }
                }
                
                h += '<li style="animation-delay:' + (.03 * i) + 's; border-left-color: ' + (i === 0 ? 'var(--cpgreen)' : 'var(--cpbdr)') + ';"><div class="cp-tl-card"><div class="cp-tla" style="display:flex; align-items:center; gap:6px;">' + iconHtml + t.title + '</div><div style="font-size:12px; color:var(--cptext2); margin:4px 0;">' + t.description + '</div><div class="cp-tlm"><i class="fa-solid fa-calendar"></i> ' + t.date + '</div></div></li>';
            });
            h += '</ul>';
        } else {
            h += '<div class="cp-tl-empty"><i class="fa-solid fa-route"></i><p>No timeline updates yet</p></div>';
        }
        h += '</div></div>';
        
        panel.innerHTML = h;
    });
}

// AJAX request wrapper
function cpAjax(action, params, callback, retried) {
    var fd = new FormData();
    fd.append('action', action);
    fd.append('nonce', PE_CP.nonce);
    if (params) {
        for (var k in params) {
            if (params.hasOwnProperty(k)) fd.append(k, params[k]);
        }
    }
    fetch(PE_CP.ajax_url, { method: 'POST', body: fd, credentials: 'same-origin' })
        .then(r => r.json())
        .then(d => {
            if (!d.success && d.data) {
                if (d.data.nonce_expired && d.data.new_nonce && !retried) {
                    PE_CP.nonce = d.data.new_nonce;
                    return cpAjax(action, params, callback, true);
                }
                if (d.data.expired) {
                    location.reload();
                    return;
                }
            }
            if (callback) callback(d);
        })
        .catch(err => console.error('CP AJAX Error:', action, err));
}

// Toast Notification System
function cpShowToast(type, title, desc) {
    var container = document.getElementById('cp-toast-container');
    if (!container) return;
    var iconMap = {
        success: 'fa-circle-check',
        info: 'fa-circle-info',
        warning: 'fa-triangle-exclamation',
        error: 'fa-circle-xmark'
    };
    var toast = document.createElement('div');
    toast.className = 'cp-toast';
    toast.innerHTML = '<div class="cp-toast-icon ' + type + '"><i class="fa-solid ' + (iconMap[type] || 'fa-circle-info') + '"></i></div>'
        + '<div class="cp-toast-body"><div class="cp-toast-title">' + title + '</div><div class="cp-toast-desc">' + desc + '</div></div>';
    container.appendChild(toast);
    // Auto-remove after 5 seconds
    setTimeout(function() {
        toast.classList.add('removing');
        setTimeout(function() { toast.remove(); }, 300);
    }, 5000);
}

function cpLogout() {
    cpAjax('pe_cp_logout', {}, function() {
        location.reload();
    });
}

function cpGetStatusDot(st) {
    if (!st) return { dot: 'db', label: 'Booked' };
    var s = st.toLowerCase();
    if (s.indexOf('deliver') >= 0) return { dot: 'dd', label: 'Delivered' };
    if (s.indexOf('transit') >= 0 || s.indexOf('depart') >= 0 || s.indexOf('dispatch') >= 0) return { dot: 'dt', label: 'In Transit' };
    if (s.indexOf('customs') >= 0) return { dot: 'dbl', label: 'Customs' };
    if (s.indexOf('book') >= 0 || s.indexOf('received') >= 0) return { dot: 'db', label: 'Booked' };
    return { dot: 'dt', label: st.length > 25 ? st.substring(0, 25) + '…' : st };
}

function cpSkeleton() {
    var h = '<div class="cp-tc"><div class="cp-th"><h3><i class="fa-solid fa-layer-group"></i> Loading...</h3></div><div class="cp-tw"><table class="cp-t"><tbody>';
    for (var i = 0; i < 5; i++) h += '<tr><td colspan="7" style="padding:18px 16px"><div class="cp-skeleton" style="width:' + (50 + Math.random() * 40) + '%;height:16px"></div></td></tr>';
    h += '</tbody></table></div></div>';
    return h;
}

function cpLoadShipments(p) {
    cpPage = p || 1;
    cpSearch = document.getElementById('cp-search').value;
    document.getElementById('cp-shipments-container').innerHTML = cpSkeleton();
    cpAjax('pe_cp_shipments', { page: cpPage, search: cpSearch }, function(d) {
        if (!d.success) return;
        var r = d.data, h = '';
        h += '<div class="cp-tc"><div class="cp-th"><h3><i class="fa-solid fa-layer-group"></i> Your Shipments <span class="badge">' + r.total + '</span></h3></div>';
        h += '<div class="cp-tw"><table class="cp-t"><thead><tr><th>AWB</th><th>Booking Date</th><th>Consignee</th><th>Destination</th><th>Weight</th><th>Amount</th><th>Status</th></tr></thead><tbody>';
        if (!r.rows.length) h += '<tr><td colspan="7" style="text-align:center;padding:50px;color:var(--cptext3)"><i class="fa-solid fa-inbox" style="font-size:28px;display:block;margin-bottom:10px;opacity:.2"></i>No shipments found</td></tr>';
        r.rows.forEach(function(rw) {
            var stDot = cpGetStatusDot(rw.status);
            h += '<tr onclick="cpShowDetail(\'' + rw.awb + '\')">';
            h += '<td class="awbc">' + rw.awb + '</td>';
            h += '<td style="font-weight:600;color:var(--cptext2)">' + (rw.booking_date || '—') + '</td>';
            h += '<td class="nmc">' + rw.consignee + '</td>';
            h += '<td><i class="fa-solid fa-location-dot" style="color:var(--cptext3);font-size:10px;margin-right:4px"></i>' + rw.destination + '</td>';
            h += '<td style="font-weight:600">' + (rw.weight || '—') + ' kg</td>';
            h += '<td style="font-weight:700;color:var(--cptext)">' + (rw.amount ? '₹' + Number(rw.amount).toLocaleString('en-IN') : '—') + '</td>';
            h += '<td><div class="cp-st"><span class="cp-dot ' + stDot.dot + '"></span>' + stDot.label + '</div></td></tr>';
        });
        h += '</tbody></table></div>';
        h += '<div class="cp-pg"><div class="cp-pi">Showing <strong>' + r.rows.length + '</strong> of <strong>' + r.total + '</strong> · Page ' + r.page + '/' + r.pages + '</div><div class="cp-pbs">';
        h += '<button class="cp-pb" onclick="cpLoadShipments(' + (r.page - 1) + ')" ' + (r.page <= 1 ? 'disabled' : '') + '><i class="fa-solid fa-chevron-left" style="font-size:10px"></i></button>';
        for (var i = Math.max(1, r.page - 2); i <= Math.min(r.pages, r.page + 2); i++) h += '<button class="cp-pb' + (i === r.page ? ' on' : '') + '" onclick="cpLoadShipments(' + i + ')">' + i + '</button>';
        h += '<button class="cp-pb" onclick="cpLoadShipments(' + (r.page + 1) + ')" ' + (r.page >= r.pages ? 'disabled' : '') + '><i class="fa-solid fa-chevron-right" style="font-size:10px"></i></button>';
        h += '</div></div></div>';
        document.getElementById('cp-shipments-container').innerHTML = h;
    });
}

function cpShowDetail(awb) {
    var panel = document.getElementById('cp-detail-panel');
    panel.innerHTML = '<div style="padding:40px;text-align:center"><div style="width:30px;height:30px;border:3px solid #e5e7eb;border-top-color:#bb0013;border-radius:50%;animation:cp-spin .6s linear infinite;margin:0 auto 16px"></div><p style="color:#94a3b8;font-size:14px">Loading shipment details...</p></div>';
    document.getElementById('cp-detail-overlay').classList.add('show');
    cpAjax('pe_cp_shipment_detail', { awb: awb }, function(d) {
        if (!d.success) { panel.innerHTML = '<div style="padding:40px;text-align:center;color:#dc2626">Failed to load details</div>'; return; }
        var s = d.data.shipment, tr = d.data.tracking;
        var stDot = cpGetStatusDot(tr.length ? tr[0].activity : '');
        var h = '';
        h += '<div class="cp-dh"><h3><i class="fa-solid fa-box"></i> AWB ' + s.awb + '</h3><button class="cp-dc" onclick="cpCloseDetail()"><i class="fa-solid fa-xmark"></i></button></div>';
        h += '<div class="cp-db-body">';
        h += '<div class="cp-ds"><h4><i class="fa-solid fa-circle-info"></i> Current Status</h4><div style="display:flex;align-items:center;gap:8px;padding:12px 16px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0"><span class="cp-dot ' + stDot.dot + '" style="width:10px;height:10px"></span><span style="font-size:15px;font-weight:700;color:#0f172a">' + stDot.label + '</span></div></div>';
        h += '<div class="cp-ds"><h4><i class="fa-solid fa-box"></i> Shipment Details</h4><div class="cp-dg">';
        h += '<div class="cp-df"><div class="l">AWB Number</div><div class="v" style="font-family:Courier New,monospace">' + s.awb + '</div></div>';
        h += '<div class="cp-df"><div class="l">Booking Date</div><div class="v">' + (s.date || '—') + '</div></div>';
        h += '<div class="cp-df"><div class="l">Shipper</div><div class="v">' + (s.shipper || '—') + '</div></div>';
        h += '<div class="cp-df"><div class="l">Consignee</div><div class="v">' + (s.consignee || '—') + '</div></div>';
        h += '<div class="cp-df"><div class="l">Origin</div><div class="v">' + (s.origin || '—') + '</div></div>';
        h += '<div class="cp-df"><div class="l">Destination</div><div class="v">' + (s.destination || '—') + '</div></div>';
        h += '<div class="cp-df"><div class="l">Weight</div><div class="v">' + (s.weight || '—') + ' kg</div></div>';
        h += '<div class="cp-df"><div class="l">Pieces</div><div class="v">' + (s.pieces || '1') + '</div></div>';
        if (s.amount) {
            h += '<div class="cp-df"><div class="l">Total Amount</div><div class="v" style="font-weight:800;color:var(--cpgreen)">₹' + Number(s.amount).toLocaleString('en-IN') + '</div></div>';
            h += '<div class="cp-df"><div class="l">Balance Due</div><div class="v" style="font-weight:700;' + (s.balance > 0 ? 'color:var(--cpred)' : 'color:var(--cptext2)') + '">₹' + Number(s.balance || 0).toLocaleString('en-IN') + '</div></div>';
        }
        if (s.vendor) h += '<div class="cp-df"><div class="l">Carrier</div><div class="v">' + s.vendor + '</div></div>';
        if (s.vendor_awb) h += '<div class="cp-df"><div class="l">Vendor AWB</div><div class="v" style="font-family:Courier New,monospace">' + s.vendor_awb + '</div></div>';
        h += '</div></div>';
        h += '<div class="cp-ds"><h4><i class="fa-solid fa-route"></i> Tracking History</h4>';
        if (tr.length) {
            h += '<ul class="cp-tl">';
            tr.forEach(function(t, i) {
                h += '<li style="animation-delay:' + (.03 * i) + 's"><div class="cp-tl-card"><div class="cp-tla"><i class="fa-solid ' + (i === 0 ? 'fa-circle-check' : 'fa-circle-dot') + '"></i>' + t.activity + '</div><div class="cp-tlm"><i class="fa-solid fa-calendar"></i> ' + t.date + ' ' + t.time + (t.location ? ' &nbsp;·&nbsp; <i class="fa-solid fa-location-dot"></i> ' + t.location : '') + '</div></div></li>';
            });
            h += '</ul>';
        } else {
            h += '<div class="cp-tl-empty"><i class="fa-solid fa-route"></i><p>No tracking events yet</p></div>';
        }
        h += '</div></div>';
        panel.innerHTML = h;
    });
}

function cpCloseDetail() {
    document.getElementById('cp-detail-overlay').classList.remove('show');
    cpDetailOpenAwb = null;
    cpDetailLastHash = null;
    cpStopDetailPolling();
}

// listen to iframe events (e.g. successful booking or cancelled back click)
window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'PE_GO_BACK') {
        cpSwitchTab('shipments', document.querySelectorAll('.cp-nav-item')[0]);
    }
    if (event.data && event.data.type === 'PE_BOOKING_SUCCESS') {
        cpLoadRequests(1); // refresh requests list
        // Switch to requests tab after brief delay
        setTimeout(function() {
            cpSwitchTab('requests');
        }, 1500);
    }
});

// Profile update form handler
document.getElementById('cp-profile-form').addEventListener('submit', function(e) {
    e.preventDefault();
    var btn = document.getElementById('profile-submit');
    btn.disabled = true; btn.textContent = 'Saving...';
    cpAjax('pe_cp_update_profile', {
        name: document.getElementById('profile-name').value,
        email: document.getElementById('profile-email').value,
        phone: document.getElementById('profile-phone').value,
        company: document.getElementById('profile-company').value
    }, function(res) {
        btn.disabled = false; btn.textContent = 'Save Changes';
        if (res.success) {
            alert('Profile updated successfully!');
            document.getElementById('cp-sidebar-uname').textContent = res.data.user.name;
            document.getElementById('cp-welcome-uname').textContent = res.data.user.name;
        } else {
            alert(res.data.message || 'Failed to update profile');
        }
    });
});

// Password change form handler
document.getElementById('cp-password-form').addEventListener('submit', function(e) {
    e.preventDefault();
    var pass = document.getElementById('pass-new').value;
    var confirm = document.getElementById('pass-confirm').value;
    if (pass !== confirm) {
        alert("New passwords do not match!");
        return;
    }
    var btn = document.getElementById('password-submit');
    btn.disabled = true; btn.textContent = 'Updating...';
    cpAjax('pe_cp_update_password', {
        current_pwd: document.getElementById('pass-current').value,
        new_pwd: pass
    }, function(res) {
        btn.disabled = false; btn.textContent = 'Update Password';
        if (res.success) {
            alert('Password updated successfully!');
            document.getElementById('cp-password-form').reset();
        } else {
            alert(res.data.message || 'Failed to update password');
        }
    });
});

// ══════════════════════════════════════
//  AUTO-POLLING ENGINE (Real-Time Updates)
// ══════════════════════════════════════
var cpReqLastHash = null;
var cpDetailOpenAwb = null;
var cpDetailLastHash = null;
var cpReqPollTimer = null;
var cpDetailPollTimer = null;
var cpActiveTab = 'shipments';
var CP_REQ_POLL_MS = 15000;  // 15 seconds
var CP_DETAIL_POLL_MS = 10000; // 10 seconds

function cpStartReqPolling() {
    cpStopReqPolling();
    cpReqPollTimer = setInterval(function() {
        if (document.hidden) return; // skip if tab not visible
        cpLoadRequests(cpReqPage, true); // silent refresh
    }, CP_REQ_POLL_MS);
    cpUpdateLiveBadge(true);
}

function cpStopReqPolling() {
    if (cpReqPollTimer) { clearInterval(cpReqPollTimer); cpReqPollTimer = null; }
    cpUpdateLiveBadge(false);
}

function cpStartDetailPolling() {
    cpStopDetailPolling();
    if (!cpDetailOpenAwb) return;
    cpDetailPollTimer = setInterval(function() {
        if (document.hidden) return;
        if (!cpDetailOpenAwb) { cpStopDetailPolling(); return; }
        cpRenderRequestDetail(cpDetailOpenAwb, true);
    }, CP_DETAIL_POLL_MS);
}

function cpStopDetailPolling() {
    if (cpDetailPollTimer) { clearInterval(cpDetailPollTimer); cpDetailPollTimer = null; }
}

function cpUpdateLiveBadge(active) {
    var badge = document.getElementById('cp-live-badge');
    if (badge) {
        badge.classList.toggle('paused', !active);
    }
}

// Hook into tab switching to start/stop polling & load data
var _origCpSwitchTab = cpSwitchTab;
cpSwitchTab = function(tabId, btn) {
    _origCpSwitchTab(tabId, btn);
    cpActiveTab = tabId;
    if (tabId === 'requests') {
        cpStartReqPolling();
    } else if (tabId === 'addresses') {
        cpStopReqPolling();
        cpLoadAddresses();
    } else if (tabId === 'documents') {
        cpStopReqPolling();
        cpLoadDocuments();
    } else {
        cpStopReqPolling();
        cpReqLastHash = null;
    }
};

// ══════════════════════════════════════
//  ADDRESS BOOK CONTROLLER
// ══════════════════════════════════════
var cpSavedAddresses = [];

function cpLoadAddresses() {
    var c = document.getElementById('cp-addresses-container');
    if (!c) return;
    cpAjax('pe_cp_get_addresses', {}, function(res) {
        if (!res.success) {
            c.innerHTML = '<div style="padding:40px;text-align:center;color:#dc2626;">Failed to load addresses.</div>';
            return;
        }
        cpSavedAddresses = res.data.addresses || [];
        cpRenderAddresses();
    });
}

function cpRenderAddresses() {
    var c = document.getElementById('cp-addresses-container');
    if (!c) return;
    if (!cpSavedAddresses.length) {
        c.innerHTML = '<div style="background:var(--cpcard); border-radius:16px; border:1px dashed var(--cpbdr); padding:48px 24px; text-align:center;">' +
            '<div style="width:48px; height:48px; border-radius:12px; background:rgba(187,0,19,0.08); color:var(--cpred); display:flex; align-items:center; justify-content:center; margin:0 auto 12px; font-size:20px;"><i class="fa-solid fa-address-book"></i></div>' +
            '<h3 style="font-size:16px; font-weight:800; color:var(--cptext); margin:0 0 6px;">No Saved Addresses</h3>' +
            '<p style="font-size:13px; color:var(--cptext2); margin:0 0 16px;">Save your pickup and delivery contacts here to quickly autofill them when creating shipments.</p>' +
            '<button onclick="cpOpenAddressModal()" style="border:none; cursor:pointer; padding:9px 18px; border-radius:10px; background:var(--cpred); color:#fff; font-weight:700; font-size:13px;"><i class="fa-solid fa-plus"></i> Add Address</button>' +
            '</div>';
        return;
    }

    var h = '<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:16px;">';
    cpSavedAddresses.forEach(function(a) {
        var typeBadge = '<span style="background:rgba(0,0,0,0.06); color:var(--cptext2); padding:3px 8px; border-radius:6px; font-size:10px; font-weight:800; text-transform:uppercase;">' + (a.address_type || 'BOTH') + '</span>';
        if (a.is_default) {
            typeBadge += ' <span style="background:#ecfdf5; color:#059669; padding:3px 8px; border-radius:6px; font-size:10px; font-weight:800; text-transform:uppercase;">DEFAULT</span>';
        }
        h += '<div style="background:var(--cpcard); border-radius:16px; border:1px solid var(--cpbdr); padding:20px; box-shadow:var(--cpsh); display:flex; flex-direction:column; justify-content:space-between;">';
        h += '<div>';
        h += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">' + typeBadge + '<div style="display:flex; gap:6px;">' +
            '<button onclick="cpEditAddress(' + a.id + ')" title="Edit" style="border:none; background:rgba(0,0,0,0.04); width:28px; height:28px; border-radius:6px; color:var(--cptext2); cursor:pointer;"><i class="fa-solid fa-pen" style="font-size:11px;"></i></button>' +
            '<button onclick="cpDeleteAddress(' + a.id + ')" title="Delete" style="border:none; background:rgba(220,38,38,0.08); width:28px; height:28px; border-radius:6px; color:#dc2626; cursor:pointer;"><i class="fa-solid fa-trash" style="font-size:11px;"></i></button>' +
            '</div></div>';
        h += '<h4 style="font-size:15px; font-weight:800; color:var(--cptext); margin:0 0 2px;">' + (a.name || '—') + '</h4>';
        if (a.company) h += '<div style="font-size:12px; font-weight:600; color:var(--cpred); margin-bottom:8px; text-transform:uppercase;">' + a.company + '</div>';
        h += '<div style="font-size:13px; color:var(--cptext2); line-height:1.4; margin-bottom:12px;">' + (a.address || '') + (a.address_2 ? ', ' + a.address_2 : '') + '<br><strong>' + (a.city || '') + '</strong>' + (a.state ? ', ' + a.state : '') + (a.pincode ? ' - ' + a.pincode : '') + '<br><span style="font-weight:700; color:var(--cptext);">' + (a.country || 'INDIA') + '</span></div>';
        h += '</div>';
        h += '<div style="border-top:1px solid var(--cpbdr); padding-top:10px; font-size:12px; color:var(--cptext2); display:flex; flex-direction:column; gap:4px;">';
        if (a.phone) h += '<div><i class="fa-solid fa-phone" style="width:14px; margin-right:6px; color:var(--cptext3);"></i>' + a.phone + (a.phone_2 ? ' / ' + a.phone_2 : '') + '</div>';
        if (a.email) h += '<div><i class="fa-solid fa-envelope" style="width:14px; margin-right:6px; color:var(--cptext3);"></i>' + a.email + '</div>';
        if (a.gstin_no) h += '<div><i class="fa-solid fa-id-card" style="width:14px; margin-right:6px; color:var(--cptext3);"></i>' + (a.gstin_type ? a.gstin_type + ': ' : '') + a.gstin_no + '</div>';
        h += '</div>';
        h += '</div>';
    });
    h += '</div>';
    c.innerHTML = h;
}

function cpOpenAddressModal(addr) {
    document.getElementById('cp-address-form').reset();
    document.getElementById('addr-id').value = addr ? addr.id : '';
    document.getElementById('cp-addr-modal-title').innerHTML = addr
        ? '<i class="fa-solid fa-pen" style="color:var(--cpred); margin-right:8px;"></i> Edit Address'
        : '<i class="fa-solid fa-address-book" style="color:var(--cpred); margin-right:8px;"></i> Add New Address';
    if (addr) {
        document.getElementById('addr-type').value = addr.address_type || 'both';
        document.getElementById('addr-name').value = addr.name || '';
        document.getElementById('addr-company').value = addr.company || '';
        document.getElementById('addr-phone').value = addr.phone || '';
        document.getElementById('addr-phone2').value = addr.phone_2 || '';
        document.getElementById('addr-email').value = addr.email || '';
        document.getElementById('addr-line1').value = addr.address || '';
        document.getElementById('addr-line2').value = addr.address_2 || '';
        document.getElementById('addr-city').value = addr.city || '';
        document.getElementById('addr-state').value = addr.state || '';
        document.getElementById('addr-pincode').value = addr.pincode || '';
        document.getElementById('addr-country').value = addr.country || 'INDIA';
        document.getElementById('addr-gstin').value = addr.gstin_no || '';
    }
    document.getElementById('cp-addr-modal-overlay').classList.add('show');
}

function cpCloseAddressModal() {
    document.getElementById('cp-addr-modal-overlay').classList.remove('show');
}

function cpEditAddress(id) {
    var addr = cpSavedAddresses.find(a => a.id == id);
    if (addr) cpOpenAddressModal(addr);
}

function cpHandleAddressSubmit(e) {
    e.preventDefault();
    var btn = document.getElementById('addr-submit-btn');
    btn.disabled = true; btn.textContent = 'Saving...';
    var payload = {
        id: document.getElementById('addr-id').value,
        address_type: document.getElementById('addr-type').value,
        name: document.getElementById('addr-name').value,
        company: document.getElementById('addr-company').value,
        phone: document.getElementById('addr-phone').value,
        phone_2: document.getElementById('addr-phone2').value,
        email: document.getElementById('addr-email').value,
        address: document.getElementById('addr-line1').value,
        address_2: document.getElementById('addr-line2').value,
        city: document.getElementById('addr-city').value,
        state: document.getElementById('addr-state').value,
        pincode: document.getElementById('addr-pincode').value,
        country: document.getElementById('addr-country').value,
        gstin_no: document.getElementById('addr-gstin').value
    };
    cpAjax('pe_cp_save_address', payload, function(res) {
        btn.disabled = false; btn.textContent = 'Save Address';
        if (res.success) {
            cpCloseAddressModal();
            cpLoadAddresses();
        } else {
            alert(res.data?.message || 'Failed to save address');
        }
    });
}

function cpDeleteAddress(id) {
    if (!confirm('Are you sure you want to delete this address?')) return;
    cpAjax('pe_cp_delete_address', { id: id }, function(res) {
        if (res.success) {
            cpLoadAddresses();
        } else {
            alert(res.data?.message || 'Failed to delete address');
        }
    });
}

// ══════════════════════════════════════
//  DOCUMENTS & KYC CONTROLLER
// ══════════════════════════════════════
var cpSavedDocs = [];

function cpLoadDocuments() {
    var c = document.getElementById('cp-documents-container');
    if (!c) return;
    cpAjax('pe_cp_get_documents', {}, function(res) {
        if (!res.success) {
            c.innerHTML = '<div style="padding:40px;text-align:center;color:#dc2626;">Failed to load documents.</div>';
            return;
        }
        cpSavedDocs = res.data.documents || [];
        cpRenderDocuments();
    });
}

function cpRenderDocuments() {
    var c = document.getElementById('cp-documents-container');
    if (!c) return;
    if (!cpSavedDocs.length) {
        c.innerHTML = '<div style="background:var(--cpcard); border-radius:16px; border:1px dashed var(--cpbdr); padding:48px 24px; text-align:center;">' +
            '<div style="width:48px; height:48px; border-radius:12px; background:rgba(187,0,19,0.08); color:var(--cpred); display:flex; align-items:center; justify-content:center; margin:0 auto 12px; font-size:20px;"><i class="fa-solid fa-file-shield"></i></div>' +
            '<h3 style="font-size:16px; font-weight:800; color:var(--cptext); margin:0 0 6px;">No Documents Uploaded Yet</h3>' +
            '<p style="font-size:13px; color:var(--cptext2); margin:0;">Upload your KYC documents or invoices above to save them securely for all future courier bookings.</p>' +
            '</div>';
        return;
    }

    var h = '<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:16px;">';
    cpSavedDocs.forEach(function(d) {
        var sizeKb = d.file_size ? Math.round(d.file_size / 1024) + ' KB' : '';
        h += '<div style="background:var(--cpcard); border-radius:16px; border:1px solid var(--cpbdr); padding:20px; box-shadow:var(--cpsh); display:flex; flex-direction:column; justify-content:space-between;">';
        h += '<div>';
        h += '<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">';
        h += '<div style="display:flex; align-items:center; gap:10px;">';
        h += '<div style="width:36px; height:36px; border-radius:10px; background:rgba(187,0,19,0.08); color:var(--cpred); display:flex; align-items:center; justify-content:center; font-size:16px;"><i class="fa-solid fa-file-lines"></i></div>';
        h += '<div>';
        h += '<div style="font-size:14px; font-weight:800; color:var(--cptext);">' + (d.doc_name || d.file_name || d.doc_type) + '</div>';
        h += '<span style="background:rgba(0,0,0,0.05); color:var(--cptext2); padding:2px 6px; border-radius:4px; font-size:10px; font-weight:700; text-transform:uppercase;">' + d.doc_type + '</span>';
        h += '</div></div>';
        h += '<button onclick="cpDeleteDocument(' + d.id + ')" title="Delete" style="border:none; background:rgba(220,38,38,0.08); width:28px; height:28px; border-radius:6px; color:#dc2626; cursor:pointer;"><i class="fa-solid fa-trash" style="font-size:11px;"></i></button>';
        h += '</div>';

        if (d.doc_number) {
            h += '<div style="font-size:12px; color:var(--cptext2); margin-bottom:8px;"><strong>Doc No:</strong> ' + d.doc_number + '</div>';
        }
        h += '</div>';

        h += '<div style="border-top:1px solid var(--cpbdr); padding-top:10px; display:flex; justify-content:space-between; align-items:center;">';
        h += '<span style="font-size:11px; color:var(--cptext3); font-weight:600;">' + (sizeKb ? sizeKb + ' · ' : '') + (d.created_at ? d.created_at.substring(0, 10) : '') + '</span>';
        if (d.file_url) {
            h += '<a href="' + d.file_url + '" target="_blank" rel="noopener noreferrer" download style="font-size:12px; font-weight:700; color:var(--cpred); text-decoration:none; display:inline-flex; align-items:center; gap:4px;"><i class="fa-solid fa-arrow-up-right-from-square" style="font-size:10px;"></i> View / Download</a>';
        }
        h += '</div>';
        h += '</div>';
    });
    h += '</div>';
    c.innerHTML = h;
}

function cpHandleDocUpload(e) {
    e.preventDefault();
    var fileInput = document.getElementById('doc-upload-file');
    if (!fileInput.files || !fileInput.files[0]) {
        alert('Please choose a file to upload');
        return;
    }
    var btn = document.getElementById('doc-upload-btn');
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading...';

    var formData = new FormData();
    formData.append('action', 'pe_cp_upload_document');
    formData.append('nonce', PE_CP.nonce);
    formData.append('file', fileInput.files[0]);
    formData.append('doc_type', document.getElementById('doc-upload-type').value);
    formData.append('doc_name', document.getElementById('doc-upload-name').value);
    formData.append('doc_number', document.getElementById('doc-upload-number').value);

    fetch(PE_CP.ajax_url, {
        method: 'POST',
        body: formData
    })
    .then(r => r.json())
    .then(res => {
        btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-arrow-up-from-bracket"></i> Upload & Save Document';
        if (res.success) {
            document.getElementById('cp-doc-upload-form').reset();
            cpLoadDocuments();
        } else {
            alert(res.data?.message || 'Upload failed');
        }
    })
    .catch(err => {
        btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-arrow-up-from-bracket"></i> Upload & Save Document';
        alert('Upload error: ' + err.message);
    });
}

function cpDeleteDocument(id) {
    if (!confirm('Are you sure you want to delete this document?')) return;
    cpAjax('pe_cp_delete_document', { id: id }, function(res) {
        if (res.success) {
            cpLoadDocuments();
        } else {
            alert(res.data?.message || 'Failed to delete document');
        }
    });
}

// Pause/resume polling on tab visibility change
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        cpUpdateLiveBadge(false);
    } else {
        if (cpActiveTab === 'requests') {
            cpUpdateLiveBadge(true);
            cpLoadRequests(cpReqPage, true); // immediate refresh on return
        }
        if (cpDetailOpenAwb) {
            cpRenderRequestDetail(cpDetailOpenAwb, true);
        }
    }
});

// Init
cpLoadShipments(1);
</script>
