<?php
declare(strict_types=1);

// Shared API Middleware
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-API-Key, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once dirname(__DIR__) . '/includes/db.php';
require_once dirname(__DIR__) . '/includes/helpers.php';
require_once dirname(__DIR__) . '/includes/auth.php';

function apiRespond(int $status, array $data): never {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function getJsonInput(): array {
    $raw = file_get_contents('php://input');
    if (empty($raw)) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Authenticate API key or active admin session
$isAuthenticated = !empty($_SESSION['rates_admin']);

if (!$isAuthenticated) {
    $config = getConfig();
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    $bearerKey = '';
    if (preg_match('/Bearer\s+(\S+)/i', $authHeader, $m)) {
        $bearerKey = $m[1];
    }
    $key = $_SERVER['HTTP_X_API_KEY'] ?? ($_GET['api_key'] ?? $bearerKey);
    if (!hash_equals((string)$config['api_key'], (string)$key)) {
        apiRespond(401, ['ok' => false, 'error' => 'Unauthorized. Provide a valid X-API-Key header, Authorization Bearer token, or api_key parameter.']);
    }
}
