<?php
declare(strict_types=1);
// Shared helper functions — extracted and expanded from original index.php

function h($v): string {
    return htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8');
}

function slugify(string $s): string {
    $s = strtolower(trim($s));
    $s = preg_replace('/[^a-z0-9]+/', '-', $s);
    return trim($s, '-') ?: 'vendor';
}

function clean($v): ?string {
    if ($v === null) return null;
    $s = trim((string)$v);
    return $s === '' ? null : $s;
}

function numericRate($v): array {
    $raw = clean($v);
    if ($raw === null || in_array(strtolower($raw), ['-', '—', 'n/a', 'na', 'null'], true)) return [null, $raw];
    $n = str_replace([',', '₹', '$'], '', $raw);
    return is_numeric($n) ? [(float)$n, $raw] : [null, $raw];
}

function weightKg(string $label): ?float {
    $s = strtolower(trim($label));
    if (preg_match('/(\d+(?:\.\d+)?)\s*(?:kg|kgs)\s*\+\+?/', $s, $m)) return (float)$m[1];
    if (preg_match('/(\d+(?:\.\d+)?)\s*kg/', $s, $m)) return (float)$m[1];
    if (preg_match('/(\d+(?:\.\d+)?)\s*g(?:ms)?/', $s, $m)) return (float)$m[1] / 1000;
    return null;
}

function isUnavailableRate(?string $rateRaw): bool {
    if ($rateRaw === null) return true;
    return in_array(strtolower(trim($rateRaw)), ['-', '—', 'n/a', 'na', 'null'], true);
}

function formatRate($rate, ?string $rateRaw): string {
    if ($rate === null && $rateRaw !== null) return h($rateRaw); // show dash etc.
    if ($rate === null) return '<span class="rate-blank">—</span>';
    if ((float)$rate === 0.0) return '<span class="rate-zero">0.00</span>';
    return number_format((float)$rate, 2);
}

function getActiveBatchId(PDO $pdo, int $vendorId): ?int {
    $st = $pdo->prepare("SELECT id FROM import_batches WHERE vendor_id = ? AND status = 'active' AND is_latest = 1 ORDER BY id DESC LIMIT 1");
    $st->execute([$vendorId]);
    $id = $st->fetchColumn();
    if ($id) return (int)$id;
    // Fallback: latest active batch
    $st = $pdo->prepare("SELECT id FROM import_batches WHERE vendor_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1");
    $st->execute([$vendorId]);
    $id = $st->fetchColumn();
    return $id ? (int)$id : null;
}

function getVendorBySlug(PDO $pdo, string $slug): ?array {
    $st = $pdo->prepare("SELECT * FROM vendors WHERE slug = ?");
    $st->execute([strtolower($slug)]);
    return $st->fetch() ?: null;
}

function getVendorById(PDO $pdo, int $id): ?array {
    $st = $pdo->prepare("SELECT * FROM vendors WHERE id = ?");
    $st->execute([$id]);
    return $st->fetch() ?: null;
}

function getVendorWorksheets(PDO $pdo, int $vendorId, int $batchId): array {
    $st = $pdo->prepare("SELECT * FROM vendor_worksheets WHERE vendor_id = ? AND batch_id = ? ORDER BY display_order, sheet_name");
    $st->execute([$vendorId, $batchId]);
    return $st->fetchAll();
}

function getVendorCalcConfig(PDO $pdo, int $vendorId): array {
    $st = $pdo->prepare("SELECT config_key, config_value FROM vendor_calc_config WHERE vendor_id = ?");
    $st->execute([$vendorId]);
    $config = [];
    foreach ($st->fetchAll() as $row) {
        $config[$row['config_key']] = $row['config_value'];
    }
    // Defaults
    $defaults = [
        'base_weight_kg' => '0.5',
        'weight_increment_kg' => '0.5',
        'base_weight_label' => '500 Gms',
        'addl_weight_label' => 'Addl 500 Gms',
        'rounding_method' => 'ceil_increment',
        'currency' => 'INR'
    ];
    return array_merge($defaults, $config);
}

function auditLog(PDO $pdo, string $table, int $recordId, string $field, $oldVal, $newVal, string $action = 'update'): void {
    $st = $pdo->prepare("INSERT INTO rate_audit_log (table_name, record_id, field_name, old_value, new_value, action, ip_address) VALUES (?,?,?,?,?,?,?)");
    $st->execute([$table, $recordId, $field, $oldVal !== null ? (string)$oldVal : null, $newVal !== null ? (string)$newVal : null, $action, $_SERVER['REMOTE_ADDR'] ?? null]);
}

function paginationParams(): array {
    $page = max(1, (int)($_GET['pg'] ?? 1));
    $perPage = min(200, max(10, (int)($_GET['per_page'] ?? 50)));
    $offset = ($page - 1) * $perPage;
    return ['page' => $page, 'per_page' => $perPage, 'offset' => $offset];
}

function getDashboardStats(PDO $pdo): array {
    $stats = [];
    $stats['total_vendors'] = (int)$pdo->query("SELECT COUNT(*) FROM vendors")->fetchColumn();
    $stats['active_vendors'] = (int)$pdo->query("SELECT COUNT(*) FROM vendors WHERE is_active = 1")->fetchColumn();
    $stats['active_versions'] = (int)$pdo->query("SELECT COUNT(*) FROM import_batches WHERE status = 'active' AND is_latest = 1")->fetchColumn();
    $stats['total_rate_rows'] = (int)$pdo->query("SELECT COUNT(*) FROM vendor_rate_rows")->fetchColumn();
    $stats['total_zone_rows'] = (int)$pdo->query("SELECT COUNT(*) FROM vendor_zone_rows")->fetchColumn();
    $stats['total_service_rows'] = (int)$pdo->query("SELECT COUNT(*) FROM vendor_country_services")->fetchColumn();
    $stats['recent_uploads'] = $pdo->query("SELECT b.*, v.name as vendor_name FROM import_batches b JOIN vendors v ON v.id = b.vendor_id ORDER BY b.id DESC LIMIT 5")->fetchAll();
    $stats['failed_imports'] = (int)$pdo->query("SELECT COUNT(*) FROM import_batches WHERE status = 'failed'")->fetchColumn();
    $stats['recent_edits'] = $pdo->query("SELECT * FROM rate_audit_log ORDER BY id DESC LIMIT 10")->fetchAll();
    return $stats;
}

function getExcelColName(int $index): string {
    $numeric = $index % 26;
    $letter = chr(65 + $numeric);
    $num2 = intdiv($index, 26);
    if ($num2 > 0) {
        return getExcelColName($num2 - 1) . $letter;
    }
    return $letter;
}

/**
 * Expand a postcode or postcode range string (e.g. "113 to 209", "BT1 to BT94", "FK17 to FK21", "113-209", or comma-separated)
 * into an array of individual postcodes with all in-between numbers included.
 */
function expandPostcodeRange(?string $zipStr): array {
    $zipStr = clean($zipStr);
    if ($zipStr === null) return [];

    // Comma-separated list of entries or ranges
    if (str_contains($zipStr, ',')) {
        $result = [];
        foreach (explode(',', $zipStr) as $part) {
            $expanded = expandPostcodeRange(trim($part));
            foreach ($expanded as $item) {
                $result[] = $item;
            }
        }
        return array_values(array_unique(array_filter($result)));
    }

    // Pattern: [Optional Prefix 1][Number 1] to|- [Optional Prefix 2][Number 2]
    // e.g. "113 to 209", "BT1 to BT94", "FK17 to FK21", "113-209", "00100 to 00105"
    if (preg_match('/^([A-Z\s]*?)(\d+)\s*(?:to|-)\s*([A-Z\s]*?)(\d+)$/i', $zipStr, $m)) {
        $p1 = trim($m[1]);
        $n1Str = $m[2];
        $n1 = (int)$n1Str;
        $p2 = trim($m[3]);
        $n2Str = $m[4];
        $n2 = (int)$n2Str;

        $prefix = $p1 !== '' ? $p1 : $p2;
        if ($n1 <= $n2 && ($n2 - $n1) <= 50000) {
            $padLen = (strlen($n1Str) === strlen($n2Str) && strlen($n1Str) > 1) ? strlen($n1Str) : 0;
            $expanded = [];
            for ($num = $n1; $num <= $n2; $num++) {
                $numStr = $padLen > 0 ? sprintf("%0{$padLen}d", $num) : (string)$num;
                $expanded[] = $prefix !== '' ? "{$prefix}{$numStr}" : $numStr;
            }
            return $expanded;
        }
    }

    return [$zipStr];
}

/**
 * Check if a candidate postcode/state matches a range rule stored as a string (e.g. "113 to 209", "BT1 to BT94")
 */
function matchesPostcodeRangeRule(string $candidate, string $ruleStr): bool {
    $candidate = strtoupper(trim($candidate));
    $ruleStr = strtoupper(trim($ruleStr));
    if ($candidate === '' || $ruleStr === '') return false;
    if ($candidate === $ruleStr) return true;

    $parts = explode(',', $ruleStr);
    foreach ($parts as $part) {
        $part = trim($part);
        if ($part === '') continue;
        if ($candidate === $part) return true;

        if (preg_match('/^([A-Z\s]*?)(\d+)\s*(?:TO|-)\s*([A-Z\s]*?)(\d+)$/i', $part, $m)) {
            $p1 = trim($m[1]);
            $n1 = (int)$m[2];
            $p2 = trim($m[3]);
            $n2 = (int)$m[4];
            $prefix = $p1 !== '' ? $p1 : $p2;

            if (preg_match('/^([A-Z\s]*?)(\d+)$/i', $candidate, $cm)) {
                $cp = trim($cm[1]);
                $cn = (int)$cm[2];
                if ($cp === $prefix && $cn >= $n1 && $cn <= $n2) {
                    return true;
                }
            }
        }
    }
    return false;
}

/**
 * Parse a raw postcode string from RATE DATA Column F that may contain remote area tags:
 * e.g. "600 (NO), 604 (YES/NO), 116 (YES), X1A, BT1 to BT94 (YES)"
 * Returns an array of ['postcode' => string, 'remote_status' => 'NONE'|'YES'|'NO'|'BOTH']
 */
function parsePostcodesWithRemoteTags(?string $raw): array {
    $raw = clean($raw);
    if ($raw === null) return [];

    $results = [];
    $parts = preg_split('/[,;\r\n]+/', $raw);

    foreach ($parts as $part) {
        $part = trim($part);
        if ($part === '') continue;

        // Extract remote tag like (YES), (NO), (YES/NO), (NO/YES), (Y), (N)
        $remoteStatus = 'NONE';
        if (preg_match('/\(\s*(YES\/NO|NO\/YES|YES|NO|Y|N)\s*\)/i', $part, $tm)) {
            $tag = strtoupper(trim($tm[1]));
            if ($tag === 'YES/NO' || $tag === 'NO/YES') {
                $remoteStatus = 'BOTH';
            } elseif ($tag === 'YES' || $tag === 'Y') {
                $remoteStatus = 'YES';
            } elseif ($tag === 'NO' || $tag === 'N') {
                $remoteStatus = 'NO';
            }
            // Strip tag from string
            $part = trim(preg_replace('/\(\s*(YES\/NO|NO\/YES|YES|NO|Y|N)\s*\)/i', '', $part));
        }

        if ($part === '') continue;

        // Check if part is a range (e.g. "113 to 209")
        $expanded = expandPostcodeRange($part);
        if (!empty($expanded)) {
            foreach ($expanded as $pc) {
                $results[] = [
                    'postcode' => trim((string)$pc),
                    'remote_status' => $remoteStatus
                ];
            }
        } else {
            $results[] = [
                'postcode' => $part,
                'remote_status' => $remoteStatus
            ];
        }
    }

    return $results;
}

/**
 * Format raw postcode list for table display with remote status badges
 */
function formatPostcodeDisplayHtml(?string $raw, int $limit = 3, int $rowId = 0, string $destination = '', string $zone = ''): string {
    $raw = clean($raw);
    if ($raw === null) return '<span class="text-muted">—</span>';

    $items = preg_split('/[,;\r\n]+/', $raw);
    $items = array_values(array_filter(array_map('trim', $items), fn($x) => $x !== ''));
    $totalCount = count($items);
    if ($totalCount === 0) return '<span class="text-muted">—</span>';

    $rendered = [];
    $displayItems = array_slice($items, 0, $limit);

    foreach ($displayItems as $item) {
        $cleanItem = $item;
        $remoteTag = '';

        if (preg_match('/\(\s*(YES\/NO|NO\/YES|YES|NO|Y|N)\s*\)/i', $item, $m)) {
            $tag = strtoupper(trim($m[1]));
            $cleanItem = trim(preg_replace('/\(\s*(YES\/NO|NO\/YES|YES|NO|Y|N)\s*\)/i', '', $item));
            if ($tag === 'YES' || $tag === 'Y') {
                $remoteTag = ' <span class="badge" style="font-size:0.6rem;padding:1px 4px;background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;font-weight:700;" title="Remote Area: YES">Remote</span>';
            } elseif ($tag === 'NO' || $tag === 'N') {
                $remoteTag = ' <span class="badge" style="font-size:0.6rem;padding:1px 4px;background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;" title="Remote Area: NO">No</span>';
            } else {
                $remoteTag = ' <span class="badge badge-info" style="font-size:0.6rem;padding:1px 4px;" title="Remote Area: YES/NO">Both</span>';
            }
        }

        $rendered[] = '<span class="pc-chip font-mono text-xs" style="display:inline-flex;align-items:center;gap:3px;background:#f1f5f9;padding:1px 5px;border-radius:4px;border:1px solid #e2e8f0;margin:1px 2px 1px 0;">' . h($cleanItem) . $remoteTag . '</span>';
    }

    $html = implode('', $rendered);

    if ($totalCount > $limit) {
        $remaining = $totalCount - $limit;
        $destLabel = h(trim($destination . ($zone ? " ($zone)" : "")));
        $html .= ' <button type="button" class="btn btn-outline btn-xs" style="padding:1px 6px;font-size:0.7rem;font-weight:600;color:#2563eb;border-color:#93c5fd;background:#eff6ff;" onclick="openPostcodesModal(this)" data-title="' . $destLabel . '" data-id="' . $rowId . '" data-raw="' . h($raw) . '" title="Click to view all ' . $totalCount . ' postcodes">+' . $remaining . ' more</button>';
    }

    return $html;
}
