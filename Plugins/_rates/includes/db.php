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
          is_manually_modified TINYINT(1) NOT NULL DEFAULT 0,
          modified_at DATETIME DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_vrm_lookup (vendor_id, batch_id, destination, service_code),
          INDEX idx_vrm_zone (vendor_id, batch_id, destination, zone)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        // Ensure is_manually_modified + modified_at columns exist (for tables created before this migration)
        try {
            $cols = $pdo->query("SHOW COLUMNS FROM vendor_rate_matrix LIKE 'is_manually_modified'")->fetchAll();
            if (empty($cols)) {
                $pdo->exec("ALTER TABLE vendor_rate_matrix ADD COLUMN is_manually_modified TINYINT(1) NOT NULL DEFAULT 0, ADD COLUMN modified_at DATETIME DEFAULT NULL");
            }
        } catch (\Throwable $ignored) {}

        // 2. Ensure remote_status column exists in vendor_zone_rows
        $cols = $pdo->query("SHOW COLUMNS FROM vendor_zone_rows LIKE 'remote_status'")->fetchAll();
        if (empty($cols)) {
            $pdo->exec("ALTER TABLE vendor_zone_rows ADD COLUMN remote_status ENUM('YES', 'NO', 'BOTH', 'NONE') NOT NULL DEFAULT 'NONE'");
        }

        // 3. Ensure vendor_worksheets.sheet_type supports 'rate_data' and 'matrix'
        try {
            $pdo->exec("ALTER TABLE vendor_worksheets MODIFY COLUMN sheet_type ENUM('regular','zonewise','zones','country_services','rate_data','matrix','unknown') NOT NULL DEFAULT 'unknown'");
            $pdo->exec("UPDATE vendor_worksheets SET sheet_type = 'rate_data' WHERE sheet_name = 'RATE DATA' AND (sheet_type = '' OR sheet_type = 'unknown')");
            $pdo->exec("INSERT INTO vendor_worksheets (vendor_id, batch_id, sheet_name, sheet_type, row_count, display_order)
                SELECT vzr.vendor_id, vzr.batch_id, 'Postcode Zones', 'zones', COUNT(*), 1
                FROM vendor_zone_rows vzr
                JOIN vendor_worksheets vw ON vzr.vendor_id = vw.vendor_id AND vzr.batch_id = vw.batch_id AND vw.sheet_name = 'RATE DATA'
                WHERE NOT EXISTS (
                    SELECT 1 FROM vendor_worksheets sub 
                    WHERE sub.vendor_id = vzr.vendor_id AND sub.batch_id = vzr.batch_id AND sub.sheet_type = 'zones'
                )
                GROUP BY vzr.vendor_id, vzr.batch_id");
        } catch (\Throwable $ignored) {}

        // 4. Normalize weight_rates keys in vendor_rate_matrix (both '0.5' and '0.5 KG' keys present)
        try {
            $stFix = $pdo->query("SELECT id, weight_rates FROM vendor_rate_matrix WHERE weight_rates IS NOT NULL AND weight_rates != '' AND weight_rates != '{}' LIMIT 500");
            $fixRows = $stFix->fetchAll();
            $updateSt = $pdo->prepare("UPDATE vendor_rate_matrix SET weight_rates = ? WHERE id = ?");
            foreach ($fixRows as $fr) {
                $wr = json_decode($fr['weight_rates'] ?: '{}', true) ?: [];
                $changed = false;
                foreach ($wr as $k => $v) {
                    if (!is_numeric($v)) continue;
                    $cleanK = trim(str_ireplace(['kg', 'kgs'], '', (string)$k));
                    $labelK = $cleanK . ' KG';
                    if (!isset($wr[$cleanK])) { $wr[$cleanK] = (float)$v; $changed = true; }
                    if (!isset($wr[$labelK])) { $wr[$labelK] = (float)$v; $changed = true; }
                }
                if ($changed) {
                    $updateSt->execute([json_encode($wr, JSON_UNESCAPED_UNICODE), $fr['id']]);
                }
            }
        } catch (\Throwable $ignored) {}

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
