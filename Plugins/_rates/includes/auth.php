<?php
declare(strict_types=1);
// Authentication helpers

function requireLogin(): void {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (empty($_SESSION['rates_admin'])) {
        header('Location: index.php?page=login');
        exit;
    }
}

function isLoggedIn(): bool {
    if (session_status() === PHP_SESSION_NONE) session_start();
    return !empty($_SESSION['rates_admin']);
}

function checkApiAuth(): bool {
    $config = getConfig();
    $key = $_SERVER['HTTP_X_API_KEY'] ?? ($_GET['api_key'] ?? '');
    return hash_equals((string)$config['api_key'], (string)$key);
}

function requireApiAuth(): void {
    if (!checkApiAuth()) {
        apiResponse(401, ['success' => false, 'error' => 'Unauthorized. Provide a valid X-API-Key header.']);
    }
}

function requireApiWriteAuth(): void {
    requireApiAuth();
    if ($_SERVER['REQUEST_METHOD'] === 'GET') return;
    // Write operations always require auth (already checked above)
}

function apiResponse(int $status, array $data): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-API-Key');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}
