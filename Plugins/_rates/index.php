<?php
declare(strict_types=1);

// Vendor Rate Management Portal — Main Application Router & Shell
// Professional enterprise dashboard architecture

ini_set('log_errors', '1');
ini_set('error_log', __DIR__ . '/storage/php-errors.log');
error_reporting(E_ALL);

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$config = require __DIR__ . '/config.php';
require_once __DIR__ . '/vendor/autoload.php';
require_once __DIR__ . '/includes/db.php';
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/helpers.php';
require_once __DIR__ . '/includes/import.php';
require_once __DIR__ . '/includes/calculator.php';

$pdo = db();

$flashSuccess = $_SESSION['flash_success'] ?? '';
$flashError = $_SESSION['flash_error'] ?? '';
unset($_SESSION['flash_success'], $_SESSION['flash_error']);

// Handle logout
if (isset($_GET['logout'])) {
    $_SESSION = [];
    if (ini_get("session.use_cookies")) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000,
            $params["path"], $params["domain"],
            $params["secure"], $params["httponly"]
        );
    }
    session_destroy();
    header('Location: index.php');
    exit;
}

// Handle login
$loginError = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['login'])) {
    $submittedPass = (string)($_POST['password'] ?? '');
    if (hash_equals((string)$config['admin_password'], $submittedPass)) {
        $_SESSION['rates_admin'] = true;
        header('Location: index.php');
        exit;
    } else {
        $loginError = 'Incorrect administrative password.';
    }
}

// If unauthenticated, show modern login view
if (empty($_SESSION['rates_admin'])) {
?>
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Vendor Rates Portal — Administrator Sign In</title>
    <link rel="stylesheet" href="assets/css/app.css">
</head>
<body>
    <div class="login-wrapper">
        <form class="login-card" method="post" action="index.php">
            <div class="logo-icon">📦</div>
            <h1>Vendor Rates Portal</h1>
            <p class="subtitle">Secure administrative sign in</p>
            
            <?php if ($loginError): ?>
                <div class="alert alert-danger" style="text-align:left; margin-bottom:16px;">
                    ✕ <?= h($loginError) ?>
                </div>
            <?php endif; ?>

            <div class="form-group mb-16" style="text-align:left;">
                <label class="form-label">Admin Password</label>
                <input class="form-control" type="password" name="password" placeholder="Enter admin password" required autofocus>
            </div>

            <button type="submit" name="login" class="btn btn-primary" style="width:100%; padding:13px; font-size:1rem;">
                Sign In to Dashboard →
            </button>

            <p class="text-xs text-muted" style="margin-top:24px;">
                Prince Express Vendor Rate Management System v2.0
            </p>
        </form>
    </div>
</body>
</html>
<?php
    exit;
}

// Handle global file upload
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['upload']) && isset($_FILES['workbook'])) {
    try {
        $uploadResult = processUpload($_POST, $_FILES['workbook']);
        $_SESSION['flash_success'] = '✓ ' . $uploadResult['message'];
        $redirectPage = $_GET['page'] ?? 'dashboard';
        header("Location: index.php?page={$redirectPage}");
        exit;
    } catch (Throwable $e) {
        $flashError = '✕ ' . $e->getMessage();
    }
}

// Routing
$allowedPages = [
    'dashboard' => ['title' => 'Dashboard Overview', 'file' => 'pages/dashboard.php'],
    'vendors' => ['title' => 'Vendor Management', 'file' => 'pages/vendors.php'],
    'vendor_detail' => ['title' => 'Vendor Details', 'file' => 'pages/vendor_detail.php'],
    'vendor_rates' => ['title' => 'Vendor Rates', 'file' => 'pages/rate_management.php'],
    'rate_calculator' => ['title' => 'Rate Calculator', 'file' => 'pages/rate_calculator.php'],
    'rate_management' => ['title' => 'Rate Management & Inline Editor', 'file' => 'pages/rate_management.php'],
    'import_history' => ['title' => 'Import History & Version Control', 'file' => 'pages/import_history.php'],
    'api_docs' => ['title' => 'API Documentation & Sandbox', 'file' => 'pages/api_docs.php'],
    'settings' => ['title' => 'System Settings & Health', 'file' => 'pages/settings.php'],
    'tests' => ['title' => 'Automated Test Suite', 'file' => 'tests/test_suite.php']
];

$page = trim((string)($_GET['page'] ?? ''));
if ($page === '') {
    if (isset($_GET['vendor'])) {
        $page = 'rate_calculator';
    } elseif (isset($_GET['slug'])) {
        $page = 'vendor_detail';
    } else {
        $page = 'dashboard';
    }
}
if (!array_key_exists($page, $allowedPages)) {
    $page = 'dashboard';
}

$pageInfo = $allowedPages[$page];
$pageTitle = $pageInfo['title'];
$pageFile = __DIR__ . '/' . $pageInfo['file'];
?>
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?= h($pageTitle) ?> — Vendor Rates Portal</title>
    <link rel="stylesheet" href="assets/css/app.css?v=<?= filemtime(__DIR__ . '/assets/css/app.css') ?>">
</head>
<body>
<div class="app-layout">
    <!-- Sidebar -->
    <aside class="sidebar">
        <div class="sidebar-brand">
            <div class="brand-icon">📦</div>
            <div>
                <span class="brand-text">Vendor Rates</span>
                <span class="brand-sub">Rate Portal v2.0</span>
            </div>
        </div>

        <nav class="sidebar-nav">
            <div class="nav-section">Overview</div>
            <a href="?page=dashboard" class="nav-link <?= $page === 'dashboard' ? 'active' : '' ?>">
                <span class="nav-icon">📊</span>
                <span>Dashboard</span>
            </a>

            <div class="nav-section">Rates & Vendors</div>
            <a href="?page=vendors" class="nav-link <?= ($page === 'vendors' || $page === 'vendor_detail') ? 'active' : '' ?>">
                <span class="nav-icon">🏢</span>
                <span>Vendors</span>
            </a>
            <a href="?page=rate_calculator" class="nav-link <?= $page === 'rate_calculator' ? 'active' : '' ?>">
                <span class="nav-icon">🧮</span>
                <span>Rate Calculator</span>
            </a>
            <a href="?page=rate_management" class="nav-link <?= $page === 'rate_management' ? 'active' : '' ?>">
                <span class="nav-icon">📝</span>
                <span>Rate Management</span>
            </a>

            <div class="nav-section">Operations</div>
            <a href="?page=import_history" class="nav-link <?= $page === 'import_history' ? 'active' : '' ?>">
                <span class="nav-icon">📁</span>
                <span>Import History</span>
            </a>

            <div class="nav-section">Developer & System</div>
            <a href="?page=api_docs" class="nav-link <?= $page === 'api_docs' ? 'active' : '' ?>">
                <span class="nav-icon">⚡</span>
                <span>REST API Docs</span>
            </a>
            <a href="?page=tests" class="nav-link <?= $page === 'tests' ? 'active' : '' ?>">
                <span class="nav-icon">🧪</span>
                <span>Test Suite</span>
            </a>
            <a href="?page=settings" class="nav-link <?= $page === 'settings' ? 'active' : '' ?>">
                <span class="nav-icon">⚙</span>
                <span>Settings & Health</span>
            </a>
        </nav>

        <div class="sidebar-footer">
            <div class="flex-between">
                <div>
                    <div style="font-weight:600; color:#fff;">Admin User</div>
                    <div class="text-xs text-muted">rates.princeexp.com</div>
                </div>
                <a href="?logout=1" class="btn btn-outline btn-sm" style="color:var(--gray-300); border-color:var(--gray-700);" title="Log out">
                    Log out
                </a>
            </div>
        </div>
    </aside>

    <!-- Main Content Area -->
    <div class="main-content">
        <!-- Top Sticky Header -->
        <header class="top-bar">
            <div style="display:flex; align-items:center; gap:16px;">
                <button class="mobile-toggle btn btn-outline btn-sm" onclick="toggleSidebar()" style="display:none;">☰</button>
                <h1><?= h($pageTitle) ?></h1>
            </div>

            <div class="top-bar-actions">
                <a href="?page=api_docs" class="btn btn-outline btn-sm" style="display:inline-flex; align-items:center; gap:6px;">
                    <span>⚡ API Console</span>
                </a>
                <span class="badge badge-success" style="display:inline-flex; align-items:center; gap:6px;">
                    <span style="width:6px; height:6px; background:#10b981; border-radius:50%; display:inline-block;"></span>
                    Live v2.0
                </span>
                <a href="?logout=1" class="btn btn-outline btn-sm text-danger" style="margin-left:8px;">
                    Log out
                </a>
            </div>
        </header>

        <!-- Page Body -->
        <main class="page-content">
            <?php if ($flashSuccess): ?>
                <div class="alert alert-success mb-20 slide-down">
                    <?= h($flashSuccess) ?>
                </div>
            <?php endif; ?>

            <?php if ($flashError): ?>
                <div class="alert alert-danger mb-20 slide-down">
                    <?= h($flashError) ?>
                </div>
            <?php endif; ?>

            <?php
            if (file_exists($pageFile)) {
                require $pageFile;
            } else {
                echo '<div class="alert alert-danger">Page template not found: ' . h($pageInfo['file']) . '</div>';
            }
            ?>
        </main>
    </div>
</div>

<div id="toast-container" class="toast-container"></div>
<script src="assets/js/app.js"></script>
</body>
</html>
