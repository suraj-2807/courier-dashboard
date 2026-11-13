<?php
declare(strict_types=1);
// Database connection singleton — extracted from original index.php
// NEVER modify config.php credentials

function db(bool $forceReconnect = false): PDO {
    static $pdo = null;
    if ($forceReconnect || !$pdo) {
        $pdo = null;
        $config = require dirname(__DIR__) . '/config.php';
        $d = $config['db'];
        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_TIMEOUT => 300
        ];
        if (defined('PDO::MYSQL_ATTR_INIT_COMMAND')) {
            $options[PDO::MYSQL_ATTR_INIT_COMMAND] = "SET SESSION wait_timeout=600, interactive_timeout=600";
        }
        $pdo = new PDO(
            "mysql:host={$d['host']};dbname={$d['name']};charset={$d['charset']}",
            $d['user'], $d['pass'],
            $options
        );
        ensureRateMatrixTable($pdo);
    }
    return $pdo;
}

function ensureDbConnection(?PDO &$pdo = null): PDO {
    if ($pdo !== null) {
        try {
            $pdo->query("SELECT 1");
            return $pdo;
        } catch (\Throwable $e) {
            // Connection lost (e.g. 2006 MySQL server has gone away), reconnect below
            $pdo = null;
        }
    }
    $pdo = db(true);
    return $pdo;
}

function ensureRateMatrixTable(?PDO $pdo = null): void {
    static $ensured = false;
    if ($ensured) return;

    try {
        if ($pdo === null) $pdo = db();

        // 1. Ensure vendor_rate_matrix table exists
        $pdo->exec("CREATE TABLE IF NOT EXISTS vendor_rate_matrix (
          id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          batch_id BIGINT UNSIGNED NOT NULL,
          vendor_id BIGINT UNSIGNED NOT NULL,
          vendor_code VARCHAR(100) NOT NULL DEFAULT 'pacific',
          destination VARCHAR(190) NOT NULL,
          state VARCHAR(100) DEFAULT '',
          service_code VARCHAR(100) NOT NULL,
          service_name VARCHAR(190) DEFAULT '',
          zone VARCHAR(80) DEFAULT '',
          postcode_raw TEXT DEFAULT NULL,
          town_city VARCHAR(190) DEFAULT '',
          duty_paid VARCHAR(20) DEFAULT '',
          transit_time VARCHAR(100) DEFAULT '',
          weight_rates JSON NOT NULL,
          min_weight DECIMAL(8,2) DEFAULT 0.50,
          max_weight DECIMAL(8,2) DEFAULT 100.00,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_vrm_lookup (vendor_id, batch_id, destination, service_code),
          INDEX idx_vrm_zone (vendor_id, batch_id, destination, zone)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        // 2. Ensure remote_status column exists in vendor_zone_rows
        $cols = $pdo->query("SHOW COLUMNS FROM vendor_zone_rows LIKE 'remote_status'")->fetchAll();
        if (empty($cols)) {
            $pdo->exec("ALTER TABLE vendor_zone_rows ADD COLUMN remote_status ENUM('YES', 'NO', 'BOTH', 'NONE') NOT NULL DEFAULT 'NONE'");
        }

        $ensured = true;
    } catch (\Throwable $e) {
        // Table or column creation logged
    }
}

function getConfig(): array {
    static $config = null;
    if (!$config) {
        $config = require dirname(__DIR__) . '/config.php';
    }
    return $config;
}
