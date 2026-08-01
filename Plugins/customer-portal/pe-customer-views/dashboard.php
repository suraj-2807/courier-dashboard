<?php
if (!defined('ABSPATH')) exit;
$cust = pe_cp_get_user();
global $wpdb;

// Quick stats queries for dashboard tab
$customer_name = $wpdb->esc_like($cust['name']);
$customer_phone = $wpdb->esc_like($cust['phone'] ?? '');
$where_cust = $wpdb->prepare(
    "(a.SNAME LIKE %s OR a.SPHONE1 LIKE %s OR a.CUSTNAME LIKE %s)",
    '%' . $customer_name . '%',
    '%' . $customer_phone . '%',
    '%' . $customer_name . '%'
);
$_st = "(SELECT ph.activity FROM parcel_history ph WHERE ph.AWBNO = a.AWBNO ORDER BY ph.date DESC, ph.time DESC LIMIT 1)";
$ts = intval($wpdb->get_var("SELECT COUNT(*) FROM AWBENTRY a WHERE $where_cust"));
$dc = intval($wpdb->get_var("SELECT COUNT(*) FROM AWBENTRY a WHERE $where_cust AND LOWER(COALESCE($_st, '')) LIKE '%delivered%'"));
$tc = intval($wpdb->get_var("SELECT COUNT(*) FROM AWBENTRY a WHERE $where_cust AND (LOWER(COALESCE($_st, '')) LIKE '%transit%' OR LOWER(COALESCE($_st, '')) LIKE '%departed%')"));

$new_booking_url = esc_url(add_query_arg([
    'cust_name' => $cust['name'],
    'cust_email' => $cust['email'],
    'cust_phone' => $cust['phone'],
    'cust_company' => $cust['company'] ?? ''
], home_url('/new-booking/')));

// Count pending requests for sidebar badge
$cust_email_for_req = $cust['email'] ?? '';
$cust_phone_for_req = $cust['phone'] ?? '';
$where_requests = $wpdb->prepare(
    "(customer_email = %s OR sender_email = %s OR customer_phone = %s OR sender_phone = %s)",
    $cust_email_for_req, $cust_email_for_req, $cust_phone_for_req, $cust_phone_for_req
);
$pending_requests_count = intval($wpdb->get_var("SELECT COUNT(*) FROM booking_requests WHERE status = 'pending' AND ($where_requests)"));
?>
<style>
#wpadminbar{display:none!important}html{margin-top:0!important}
*,*::before,*::after{box-sizing:border-box}

@keyframes cp-fadeIn{from{opacity:0}to{opacity:1}}
@keyframes cp-fadeUp{from{opacity:0;transform:translateY(15px)}to{opacity:1;transform:translateY(0)}}
@keyframes cp-slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
@keyframes cp-shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
@keyframes cp-spin{to{transform:rotate(360deg)}}

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
      <a class="cp-nav-item" href="<?php echo $new_booking_url; ?>" target="_self">
        <i class="fa-solid fa-plus"></i> Request Booking
      </a>
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
      <div class="cp-stats">
        <div class="cp-stat"><div><div class="cp-stat-label">Total Shipments</div><div class="cp-stat-value"><?php echo number_format($ts); ?></div><div class="cp-stat-desc r">All time</div></div><div class="cp-stat-icon"><i class="fa-solid fa-boxes-stacked"></i></div></div>
        <div class="cp-stat"><div><div class="cp-stat-label">In Transit</div><div class="cp-stat-value"><?php echo str_pad($tc, 2, '0', STR_PAD_LEFT); ?></div><div class="cp-stat-desc w">On the way</div></div><div class="cp-stat-icon"><i class="fa-solid fa-truck"></i></div></div>
        <div class="cp-stat"><div><div class="cp-stat-label">Delivered</div><div class="cp-stat-value"><?php echo number_format($dc); ?></div><div class="cp-stat-desc g">Completed</div></div><div class="cp-stat-icon"><i class="fa-solid fa-circle-check"></i></div></div>
        <div class="cp-stat"><div><div class="cp-stat-label">Active</div><div class="cp-stat-value"><?php echo str_pad($ts - $dc, 2, '0', STR_PAD_LEFT); ?></div><div class="cp-stat-desc b">In progress</div></div><div class="cp-stat-icon"><i class="fa-solid fa-signal"></i></div></div>
      </div>

      <!-- Quick CTA -->
      <div class="cp-cta-card">
        <div class="cp-cta-info">
          <h3>Need to ship a package? 📦</h3>
          <p>Fill in your shipment details and our team will handle the rest. You'll receive your AWB number instantly.</p>
        </div>
        <a class="cp-cta-btn-link" href="<?php echo $new_booking_url; ?>" target="_self">
          <i class="fa-solid fa-plus"></i> Request Booking
        </a>
      </div>

      <!-- Search & Filters -->
      <div class="cp-fb">
        <div class="cp-fs"><i class="fa-solid fa-magnifying-glass"></i><input type="text" id="cp-search" placeholder="Search AWB, consignee, destination..." onkeydown="if(event.key==='Enter')cpLoadShipments(1);"></div>
      </div>
      <div id="cp-shipments-container"></div>
    </div>

    <!-- TAB 2: REQUESTS -->
    <div class="cp-main-content" id="tab-requests">
      <div class="cp-hdr-wrap">
        <h1 class="cp-page-title">Booking Requests</h1>
        <p class="cp-page-sub">Track progress and status updates for your submitted booking requests.</p>
      </div>

      <!-- Filters & Search -->
      <div class="cp-fb" style="flex-wrap: wrap; gap: 12px; margin-bottom: 20px;">
        <div class="cp-fs" style="min-width: 250px;"><i class="fa-solid fa-magnifying-glass"></i><input type="text" id="cp-req-search" placeholder="Search AWB, consignee, city..." onkeydown="if(event.key==='Enter')cpLoadRequests(1);"></div>
        
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

  </main>
</div>

<!-- DETAIL PANEL -->
<div class="cp-do" id="cp-detail-overlay" onclick="if(event.target===this)cpCloseDetail()">
  <div class="cp-dp" id="cp-detail-panel"></div>
</div>

<script>
var cpPage=1, cpSearch='';

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

var cpReqPage=1, cpReqSearch='', cpReqStatus='';

function cpSetRequestStatusFilter(st, btn) {
    document.querySelectorAll('.cp-status-tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    cpReqStatus = st;
    cpLoadRequests(1);
}

function cpLoadRequests(p) {
    cpReqPage = p || 1;
    cpReqSearch = document.getElementById('cp-req-search').value;
    document.getElementById('cp-requests-container').innerHTML = cpSkeleton();
    cpAjax('pe_cp_my_requests', { page: cpReqPage, search: cpReqSearch, status: cpReqStatus }, function(d) {
        if (!d.success) return;
        var r = d.data, h = '';
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
    var panel = document.getElementById('cp-detail-panel');
    panel.innerHTML = '<div style="padding:40px;text-align:center"><div style="width:30px;height:30px;border:3px solid #e5e7eb;border-top-color:#bb0013;border-radius:50%;animation:cp-spin .6s linear infinite;margin:0 auto 16px"></div><p style="color:#94a3b8;font-size:14px">Loading request details...</p></div>';
    document.getElementById('cp-detail-overlay').classList.add('show');
    cpAjax('pe_cp_request_detail', { request_awb: awb }, function(d) {
        if (!d.success) { panel.innerHTML = '<div style="padding:40px;text-align:center;color:#dc2626">Failed to load details</div>'; return; }
        var r = d.data.request, tl = d.data.timeline;
        var stLabel = r.status.charAt(0).toUpperCase() + r.status.slice(1);
        var dotClass = 'bg-' + r.status;
        var stClass = 'st-' + r.status;
        
        var formattedDate = r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
        
        var h = '';
        h += '<div class="cp-dh"><h3><i class="fa-solid fa-clipboard-list"></i> Request ' + r.request_awb + '</h3><button class="cp-dc" onclick="cpCloseDetail()"><i class="fa-solid fa-xmark"></i></button></div>';
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
        if (r.content_description) h += '<div class="cp-df fl"><div class="l">Content Description</div><div class="v">' + r.content_description + '</div></div>';
        if (r.remarks) h += '<div class="cp-df fl"><div class="l">Special Instructions / Remarks</div><div class="v">' + r.remarks + '</div></div>';
        if (r.admin_notes) h += '<div class="cp-df fl" style="border-color:rgba(187,0,19,.15); background:rgba(187,0,19,.02);"><div class="l" style="color:var(--cpred)">Admin Notes</div><div class="v">' + r.admin_notes + '</div></div>';
        h += '</div></div>';
        
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
        h += '<div class="cp-tw"><table class="cp-t"><thead><tr><th>AWB</th><th>Date</th><th>Consignee</th><th>Destination</th><th>Weight</th><th>Status</th></tr></thead><tbody>';
        if (!r.rows.length) h += '<tr><td colspan="7" style="text-align:center;padding:50px;color:var(--cptext3)"><i class="fa-solid fa-inbox" style="font-size:28px;display:block;margin-bottom:10px;opacity:.2"></i>No shipments found</td></tr>';
        r.rows.forEach(function(rw) {
            var stDot = cpGetStatusDot(rw.status);
            h += '<tr onclick="cpShowDetail(\'' + rw.awb + '\')">';
            h += '<td class="awbc">' + rw.awb + '</td>';
            h += '<td style="font-weight:600;color:var(--cptext2)">' + (rw.booking_date || '—') + '</td>';
            h += '<td class="nmc">' + rw.consignee + '</td>';
            h += '<td><i class="fa-solid fa-location-dot" style="color:var(--cptext3);font-size:10px;margin-right:4px"></i>' + rw.destination + '</td>';
            h += '<td style="font-weight:600">' + (rw.weight || '—') + ' kg</td>';
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

// Init
cpLoadShipments(1);
</script>
