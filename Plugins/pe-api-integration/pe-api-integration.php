<?php
/*
Plugin Name: PE API Integration
Description: API for receiving shipment data from ERP
Version: 4.1
Author: Suraj
*/

if (!defined('ABSPATH'))
    exit;

// 🌐 CORS Fix — proper REST API approach for InfinityFree/WordPress
add_action('rest_api_init', function () {
    remove_filter('rest_pre_serve_request', 'rest_send_cors_headers');

    add_filter('rest_pre_serve_request', function ($value) {
        $allowed_origins = [
            'https://surajsabu.netlify.app',
            'http://localhost:5173',
            'http://localhost:3000',
        ];

        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

        if (in_array($origin, $allowed_origins)) {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
            header('Access-Control-Allow-Headers: Content-Type, Authorization');
            header('Access-Control-Allow-Credentials: true');
        }

        return $value;
    });
}, 15);

// Handle OPTIONS preflight before WordPress boots
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $allowed = ['https://surajsabu.netlify.app', 'http://localhost:5173', 'http://localhost:3000'];
    if (in_array($origin, $allowed)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization');
        http_response_code(200);
        exit();
    }
}

// 🔐 Change this API key before sharing with ERP agency
define('PE_API_KEY', 'aadil2003suraj2003');

// 🚀 Register API Route
add_action('rest_api_init', function () {
    register_rest_route('pe/v1', '/update-shipment', array(
        'methods' => 'POST',
        'callback' => 'pe_api_update_shipment',
        'permission_callback' => '__return_true',
    ));
});

// ================================================================
//  📦 MAIN API FUNCTION — Handles 4 tables
//  consignee, shipment_admin, shipper_details, shipment_items
//
//  parcel_history is NOT handled here — entries are created
//  manually in the database by the admin.
//
//  PARTIAL UPDATES: Only the fields you send will be updated.
//  Examples:
//    - Send only awbno + showfwd → updates SHOWFWD only
//    - Send only awbno + vendorid1 + vendorid2 → updates vendor IDs only
//    - Send only awbno + shipment_admin.autotrack → updates autotrack only
// ================================================================
function pe_api_update_shipment($request)
{
    global $wpdb;

    $params = $request->get_json_params();

    // 🔐 API Key check
    if (!isset($params['api_key']) || $params['api_key'] !== PE_API_KEY) {
        return new WP_REST_Response([
            'status' => 'error',
            'message' => 'Invalid API Key'
        ], 403);
    }

    $awbno = sanitize_text_field($params['awbno'] ?? '');

    if (!$awbno) {
        return new WP_REST_Response([
            'status' => 'error',
            'message' => 'AWBNO is required'
        ], 400);
    }

    $results = [];

    // ════════════════════════════════════════════
    // 1️⃣  CONSIGNEE TABLE
    //    Only fields sent in the request are updated.
    //    This allows ERP to send partial updates
    //    without overwriting existing consignee data.
    //
    //    Supports individual field updates like:
    //    - showfwd (0=No, 1=Yes)
    //    - vendorid1, vendorid2
    //    - status, delivery_date, receiver, etc.
    // ════════════════════════════════════════════

    // Map of JSON key => [DB column, sanitize type]
    $consignee_field_map = [
        'remarks'            => ['REMARKS',           'text'],
        'booking_date'       => ['BOOKINGDATE',       'text'],
        'destination'        => ['DESTINATION',       'text'],
        'consignee'          => ['CONSIGNEE',         'text'],
        'weight'             => ['WEIGHT',            'float'],
        'service'            => ['SERVICE',           'int'],
        'status'             => ['STATUS',            'text'],
        'delivery_date'      => ['DELIVERYDATE',      'text'],
        'delvtime'           => ['DELVTIME',          'text'],
        'receiver'           => ['RECEIVER',          'text'],
        'vendorid1'          => ['VENDORID1',         'text'],
        'vendorid2'          => ['VENDORID2',         'text'],
        'actualweight'       => ['ACTUALWEIGHT',      'float'],
        'api'                => ['API',               'int'],
        'phone'              => ['PHONE',             'text'],
        'showfwd'            => ['SHOWFWD',           'int'],
        'cstatus'            => ['CSTATUS',           'int'],
        'tuser'              => ['TUSER',             'text'],
        'tpass'              => ['TPASS',              'text'],
        'accode'             => ['ACCODE',            'text'],
        'apikey'             => ['APIKEY',            'text'],
        'pcs'                => ['pcs',               'int'],
        'customer'           => ['customer',          'text'],
        'origin'             => ['origin',            'text'],
        'product'            => ['product',           'text'],
        'consignee_address'  => ['consignee_address', 'text'],
        'consignee_city'     => ['consignee_city',    'text'],
        'consignee_state'    => ['consignee_state',   'text'],
        'consignee_country'  => ['consignee_country', 'text'],
        'consignee_pincode'  => ['consignee_pincode', 'text'],
    ];

    // Build data array with ONLY the fields that were actually sent
    $consignee_data = ['AWBNO' => $awbno];
    foreach ($consignee_field_map as $json_key => $map) {
        if (isset($params[$json_key])) {
            $col  = $map[0];
            $type = $map[1];
            if ($type === 'int')        $consignee_data[$col] = intval($params[$json_key]);
            elseif ($type === 'float')  $consignee_data[$col] = floatval($params[$json_key]);
            else                        $consignee_data[$col] = sanitize_text_field($params[$json_key]);
        }
    }

    $existing = $wpdb->get_row($wpdb->prepare(
        "SELECT c_id FROM consignee WHERE AWBNO = %s",
        $awbno
    ));

    if ($existing) {
        // Only update fields that were sent — existing data stays intact
        $update_data = $consignee_data;
        unset($update_data['AWBNO']);
        if (!empty($update_data)) {
            $res = $wpdb->update('consignee', $update_data, ['AWBNO' => $awbno]);
            $results['consignee'] = ($res !== false) ? 'updated (' . count($update_data) . ' fields)' : 'update_failed: ' . $wpdb->last_error;
        } else {
            $res = true;
            $results['consignee'] = 'no fields to update';
        }
    } else {
        $res = $wpdb->insert('consignee', $consignee_data);
        $results['consignee'] = ($res !== false) ? 'inserted' : 'insert_failed: ' . $wpdb->last_error;
    }

    if ($res === false) {
        return new WP_REST_Response([
            'status' => 'error',
            'message' => 'Consignee operation failed: ' . $wpdb->last_error,
            'details' => $results
        ], 500);
    }

    // ════════════════════════════════════════════
    // 2️⃣  SHIPMENT_ADMIN TABLE
    //    Fields: AWBNO, payment_type, vendor, volume,
    //            Total Amout, autotrack, invoice_no, created_at
    //
    //    PARTIAL UPDATE: Only sent fields are updated.
    //    e.g. send only { "autotrack": "1" } to turn on autotrack
    //    or { "autotrack": "LATER" } to set it to later
    // ════════════════════════════════════════════
    if (!empty($params['shipment_admin'])) {
        $sa = $params['shipment_admin'];

        // Map of JSON key => [DB column, sanitize type]
        $sa_field_map = [
            'payment_type' => ['payment_type', 'text'],
            'vendor'       => ['vendor',       'text'],
            'volume'       => ['volume',       'float'],
            'total_amount' => ['Total Amout',  'float'],
            'autotrack'    => ['autotrack',    'text'],
            'invoice_no'   => ['invoice_no',   'text'],
            'created_at'   => ['created_at',   'text'],
        ];

        // Build data with ONLY the fields that were sent
        $sa_data = ['AWBNO' => $awbno];
        foreach ($sa_field_map as $json_key => $map) {
            if (isset($sa[$json_key])) {
                $col  = $map[0];
                $type = $map[1];
                if ($type === 'float')  $sa_data[$col] = floatval($sa[$json_key]);
                else                    $sa_data[$col] = sanitize_text_field($sa[$json_key]);
            }
        }

        $existing_sa = $wpdb->get_row($wpdb->prepare(
            "SELECT id FROM shipment_admin WHERE AWBNO = %s", $awbno
        ));

        if ($existing_sa) {
            $upd = $sa_data;
            unset($upd['AWBNO']);
            if (!empty($upd)) {
                $res = $wpdb->update('shipment_admin', $upd, ['AWBNO' => $awbno]);
                $results['shipment_admin'] = ($res !== false) ? 'updated (' . count($upd) . ' fields)' : 'update_failed: ' . $wpdb->last_error;
            } else {
                $results['shipment_admin'] = 'no fields to update';
            }
        } else {
            // On insert, set defaults for missing fields
            if (!isset($sa_data['created_at'])) $sa_data['created_at'] = current_time('mysql');
            $res = $wpdb->insert('shipment_admin', $sa_data);
            $results['shipment_admin'] = ($res !== false) ? 'inserted' : 'insert_failed: ' . $wpdb->last_error;
        }
    }

    // ════════════════════════════════════════════
    // 3️⃣  SHIPPER_DETAILS TABLE
    //    Fields: AWBNO, name, address, city,
    //            state, pincode, phone
    //    PARTIAL UPDATE supported.
    // ════════════════════════════════════════════
    if (!empty($params['shipper'])) {
        $sh = $params['shipper'];

        $sh_field_map = [
            'name'    => ['name',    'text'],
            'address' => ['address', 'text'],
            'city'    => ['city',    'text'],
            'state'   => ['state',   'text'],
            'pincode' => ['pincode', 'text'],
            'phone'   => ['phone',   'text'],
        ];

        $sh_data = ['AWBNO' => $awbno];
        foreach ($sh_field_map as $json_key => $map) {
            if (isset($sh[$json_key])) {
                $sh_data[$map[0]] = sanitize_text_field($sh[$json_key]);
            }
        }

        $existing_sh = $wpdb->get_row($wpdb->prepare(
            "SELECT id FROM shipper_details WHERE AWBNO = %s", $awbno
        ));

        if ($existing_sh) {
            $upd = $sh_data;
            unset($upd['AWBNO']);
            if (!empty($upd)) {
                $res = $wpdb->update('shipper_details', $upd, ['AWBNO' => $awbno]);
                $results['shipper_details'] = ($res !== false) ? 'updated (' . count($upd) . ' fields)' : 'update_failed: ' . $wpdb->last_error;
            } else {
                $results['shipper_details'] = 'no fields to update';
            }
        } else {
            $res = $wpdb->insert('shipper_details', $sh_data);
            $results['shipper_details'] = ($res !== false) ? 'inserted' : 'insert_failed: ' . $wpdb->last_error;
        }
    }

    // ════════════════════════════════════════════
    // 4️⃣  SHIPMENT_ITEMS TABLE
    //    Fields: AWBNO, description, qty, unit
    //    When items are sent, old items are deleted
    //    and new list is inserted fresh.
    // ════════════════════════════════════════════
    $items_inserted = 0;
    if (!empty($params['items']) && is_array($params['items'])) {
        $wpdb->delete('shipment_items', ['AWBNO' => $awbno]);

        foreach ($params['items'] as $item) {
            $item_data = [
                'AWBNO'       => $awbno,
                'description' => sanitize_text_field($item['description'] ?? ''),
                'qty'         => intval($item['qty'] ?? 0),
                'unit'        => sanitize_text_field($item['unit'] ?? ''),
            ];

            $res = $wpdb->insert('shipment_items', $item_data);
            if ($res !== false) $items_inserted++;
        }
        $results['shipment_items'] = $items_inserted . ' items inserted';
    }

    // ════════════════════════════════════════════
    // 5️⃣  PARCEL_HISTORY TABLE
    //    AWBNO column is INT — must use intval().
    //    Auto-creates "SHIPMENT BOOKED" on new booking.
    //    Also supports custom history entries via API.
    //    Fields: AWBNO (int), date, time, activity, location
    // ════════════════════════════════════════════

    // Auto-create "SHIPMENT BOOKED" when a new consignee is inserted
    if (isset($results['consignee']) && $results['consignee'] === 'inserted') {
        $booking_date = sanitize_text_field($params['booking_date'] ?? '');
        $origin_city  = sanitize_text_field($params['origin'] ?? '');

        $history_data = [
            'AWBNO'    => intval($awbno),
            'date'     => !empty($booking_date) ? $booking_date : current_time('Y-m-d'),
            'time'     => current_time('H:i:s'),
            'activity' => 'SHIPMENT BOOKED',
            'location' => !empty($origin_city) ? strtoupper($origin_city) : '',
        ];

        $res = $wpdb->insert('parcel_history', $history_data);
        $results['parcel_history'] = ($res !== false)
            ? 'SHIPMENT BOOKED entry created'
            : 'insert_failed: ' . $wpdb->last_error;
    }

    // Allow ERP to push additional history entries
    if (!empty($params['parcel_history']) && is_array($params['parcel_history'])) {
        $history_count = 0;
        foreach ($params['parcel_history'] as $entry) {
            $h_data = [
                'AWBNO'    => intval($awbno),
                'date'     => sanitize_text_field($entry['date'] ?? current_time('Y-m-d')),
                'time'     => sanitize_text_field($entry['time'] ?? current_time('H:i:s')),
                'activity' => sanitize_text_field($entry['activity'] ?? ''),
                'location' => sanitize_text_field($entry['location'] ?? ''),
            ];

            $res = $wpdb->insert('parcel_history', $h_data);
            if ($res !== false) $history_count++;
        }
        $results['parcel_history_custom'] = $history_count . ' history entries added';
    }

    return new WP_REST_Response([
        'status'  => 'success',
        'awbno'   => $awbno,
        'message' => 'Shipment data processed successfully.',
        'details' => $results
    ], 200);
}