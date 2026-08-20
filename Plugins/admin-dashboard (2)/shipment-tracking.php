<?php
/*
Plugin Name: Prince Express Tools
Description: Custom plugin for tracking, rate calculator, and inquiry form.
Version: 4.2
Author: Suraj
*/

if (!defined('ABSPATH')) exit;

// ========================================
// ENQUEUE GOOGLE FONTS + FONT AWESOME
// ========================================
function pe_enqueue_assets() {
    wp_enqueue_style('pe-google-fonts', 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap', [], null);
    wp_enqueue_style('pe-font-awesome', 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css', [], '6.5.1');
}
add_action('wp_enqueue_scripts', 'pe_enqueue_assets');

// ========================================
// SHARED DATA — processed once, used by all shortcodes
// ========================================
class PE_Data {
    private static $done = false;
    public static $result = null;
    public static $awb = '';
    public static $status = '';
    public static $tracking = [];
    public static $searched = false;

    public static function init() {
        if (self::$done) return;
        self::$done = true;

        if (!isset($_POST['awb']) || empty(trim($_POST['awb']))) return;
        self::$searched = true;
        global $wpdb;
        self::$awb = sanitize_text_field(trim($_POST['awb']));

        // ── Try AWBENTRY first (new ERP table) ──
        $awb_row = $wpdb->get_row($wpdb->prepare(
            "SELECT a.*,
                    a.AWBID as c_id, CAST(a.AWBNO AS CHAR) as AWBNO_STR,
                    a.CNEENAME as CONSIGNEE, a.DESTNAME as DESTINATION,
                    a.CHARGEWEIGHT as WEIGHT, COALESCE(a.SERVICE, 0) as SERVICE_INT,
                    a.AWBDATE as BOOKINGDATE,
                    a.VENDORAWB1 as VENDORID1, a.VENDORAWB2 as VENDORID2,
                    a.CNEEPHONE1 as PHONE, COALESCE(a.SHOWFWD, 0) as SHOWFWD_INT,
                    COALESCE(a.AUTOTRACK, 0) as API_VAL,
                    a.CARTONS as PIECES
             FROM AWBENTRY a WHERE a.AWBNO = %d", intval(self::$awb)
        ));

        if ($awb_row) {
            // Build consignee-compatible result object from AWBENTRY
            $r = new stdClass();
            $r->c_id        = $awb_row->c_id;
            $r->AWBNO       = $awb_row->AWBNO_STR;
            $r->CONSIGNEE   = $awb_row->CONSIGNEE;
            $r->DESTINATION = $awb_row->DESTINATION;
            $r->WEIGHT      = $awb_row->WEIGHT;
            $r->ACTUALWEIGHT= $awb_row->ACTUALWEIGHT;
            $r->SERVICE     = $awb_row->SERVICE_INT;
            $r->BOOKINGDATE = $awb_row->BOOKINGDATE;
            $r->VENDORID1   = $awb_row->VENDORID1;
            $r->VENDORID2   = $awb_row->VENDORID2;
            $r->PHONE       = $awb_row->PHONE;
            $r->SHOWFWD     = $awb_row->SHOWFWD_INT;
            $r->API         = $awb_row->API_VAL;
            $r->REMARKS     = $awb_row->REMARKS;
            $r->TUSER       = $awb_row->TUSER;
            $r->TPASS       = $awb_row->TPASS;
            $r->ACCODE      = $awb_row->ACCODE;
            $r->APIKEY      = $awb_row->APIKEY;
            $r->PIECES      = $awb_row->PIECES;
            $r->DELIVERYDATE = '';
            $r->DELVTIME     = '';
            $r->RECEIVER     = '';
            $r->STATUS       = '';

            // Auto-create parcel_history "SHIPMENT BOOKED" if none exists
            $has_history = $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM parcel_history WHERE AWBNO = %d", intval(self::$awb)
            ));
            if (!$has_history) {
                $wpdb->insert('parcel_history', [
                    'AWBNO'    => intval(self::$awb),
                    'date'     => !empty($awb_row->BOOKINGDATE) ? $awb_row->BOOKINGDATE : current_time('Y-m-d'),
                    'time'     => current_time('H:i:s'),
                    'activity' => 'SHIPMENT BOOKED',
                    'location' => strtoupper(trim($awb_row->ORIGIN ?: '')),
                ]);
            }

            self::$result = $r;

            // Tracking: vendor APIs if AUTOTRACK=1, else parcel_history
            $api = intval($r->API);
            if ($api == 1) {
                self::$tracking = pe_fetch_tracking($r);
                // pe_fetch_tracking() updates $r->STATUS, $r->DELIVERYDATE, $r->RECEIVER directly
                self::$status = !empty($r->STATUS) ? $r->STATUS : "In Transit";
            } else {
                $rows = $wpdb->get_results($wpdb->prepare(
                    "SELECT * FROM parcel_history WHERE AWBNO = %d ORDER BY date ASC, time ASC", intval(self::$awb)
                ));
                if ($rows) {
                    foreach ($rows as $rw) {
                        // Skip locations that are just numbers (branch codes)
                        $loc = $rw->location ?? '';
                        if (preg_match('/^\d+$/', trim($loc))) $loc = '';
                        self::$tracking[] = [
                            'date' => pe_fdate($rw->date),
                            'time' => !empty($rw->time) ? date("h:i A", strtotime($rw->time)) : '',
                            'location' => $loc,
                            'activity' => $rw->activity ?? ''
                        ];
                    }
                }
                // For non-API tracking, derive status from latest parcel_history activity
                if (!empty(self::$tracking)) {
                    $latest = end(self::$tracking);
                    self::$status = !empty($latest['activity']) ? $latest['activity'] : "In Transit";
                    $r->STATUS = self::$status;
                } else {
                    self::$status = "Booked";
                }
            }

            // Check for delivery date in parcel_history (if not set by vendor API)
            if (empty($r->DELIVERYDATE) || $r->DELIVERYDATE === '0000-00-00') {
                $del_date = $wpdb->get_var($wpdb->prepare(
                    "SELECT date FROM parcel_history WHERE AWBNO = %d AND LOWER(activity) LIKE '%%delivered%%' ORDER BY date DESC LIMIT 1",
                    intval(self::$awb)
                ));
                if ($del_date) {
                    $r->DELIVERYDATE = $del_date;
                }
            }

            // Filter out numeric-only locations from tracking
            foreach (self::$tracking as &$_t) {
                if (preg_match('/^\d+$/', trim($_t['location']))) $_t['location'] = '';
            }
            unset($_t);

            return;
        }

        // ── Fallback: old consignee table for legacy data ──
        self::$result = $wpdb->get_row(
            $wpdb->prepare("SELECT * FROM consignee WHERE AWBNO = %s", self::$awb)
        );
        if (!self::$result) return;

        $r = self::$result;
        self::$status = !empty($r->STATUS) ? $r->STATUS : "In Transit";
        $api = intval($r->API);

        if ($api == 1) {
            self::$tracking = pe_fetch_tracking($r);
            self::$status = !empty($r->STATUS) ? $r->STATUS : "In Transit";
        } else {
            $rows = $wpdb->get_results($wpdb->prepare(
                "SELECT * FROM parcel_history WHERE AWBNO = %s ORDER BY date ASC, time ASC", self::$awb
            ));
            if ($rows) {
                foreach ($rows as $rw) {
                    self::$tracking[] = [
                        'date' => pe_fdate($rw->date),
                        'time' => !empty($rw->time) ? date("h:i A", strtotime($rw->time)) : '',
                        'location' => $rw->location ?? '',
                        'activity' => $rw->activity ?? ''
                    ];
                }
            }
        }
    }
}

// ========================================
// HELPERS
// ========================================
function pe_short_status($status) {
    $s = strtolower(trim($status));
    if (strpos($s,'delivered')!==false) return 'Delivered';
    if (strpos($s,'out for delivery')!==false) return 'Out for Delivery';
    if (strpos($s,'planned')!==false) return 'In Transit';
    if (strpos($s,'departed')!==false) return 'In Transit';
    if (strpos($s,'dispatched')!==false) return 'In Transit';
    if (strpos($s,'in transit')!==false) return 'In Transit';
    if (strpos($s,'arrived')!==false) return 'In Transit';
    if (strpos($s,'processed')!==false) return 'In Transit';
    if (strpos($s,'booked')!==false||strpos($s,'booking')!==false) return 'Booked';
    if (strpos($s,'information received')!==false||strpos($s,'info received')!==false) return 'Booked';
    if (strpos($s,'received')!==false) return 'Received';
    if (strpos($s,'customs')!==false) return 'In Customs';
    if (strpos($s,'held')!==false||strpos($s,'hold')!==false) return 'On Hold';
    if (strpos($s,'return')!==false) return 'Returned';
    if (empty($s)) return 'In Transit';
    return ucwords(strtolower($status));
}

function pe_status_badge_class($status) {
    $short = strtolower(pe_short_status($status));
    if (strpos($short,'deliver')!==false) return 'pe-badge-delivered';
    if (strpos($short,'transit')!==false) return 'pe-badge-transit';
    if (strpos($short,'book')!==false||strpos($short,'received')!==false) return 'pe-badge-booked';
    if (strpos($short,'customs')!==false||strpos($short,'hold')!==false) return 'pe-badge-other';
    return 'pe-badge-transit';
}

function pe_service_name($svc) {
    $m = [0=>'Prince Express Standard',5=>'Prince Express Premium',1001=>'Sain Express',
          1007=>'Prince Express Global',1008=>'Pace Group International',
          1009=>'Sairaj International',1019=>'FlySwift Express'];
    return $m[$svc] ?? 'Prince Express';
}

function pe_fdate($d) {
    if(empty($d)||$d==='0000-00-00') return '';
    return date('M d, Y', strtotime($d));
}

function pe_fdate_long($d) {
    if(empty($d)||$d==='0000-00-00') return '';
    $day = date('j', strtotime($d));
    $suffix = date('S', strtotime($d));
    return $day . $suffix . ' ' . date('F Y', strtotime($d));
}

function pe_title_case($text) {
    return ucwords(strtolower(trim($text)));
}

function pe_city_code($location) {
    if (empty($location)) return '---';
    $codes = [
        'mumbai'=>'BOM','bom'=>'BOM','delhi'=>'DEL','del'=>'DEL','new delhi'=>'DEL','chennai'=>'MAA','maa'=>'MAA','kolkata'=>'CCU','ccu'=>'CCU',
        'bangalore'=>'BLR','blr'=>'BLR','bengaluru'=>'BLR','hyderabad'=>'HYD','hyd'=>'HYD','pune'=>'PNQ','pnq'=>'PNQ',
        'ahmedabad'=>'AMD','amd'=>'AMD','lucknow'=>'LKO','lko'=>'LKO','jaipur'=>'JAI','jai'=>'JAI','goa'=>'GOI','goi'=>'GOI','gox'=>'GOX',
        'surat'=>'SRT','srt'=>'SRT','kochi'=>'COK','cok'=>'COK','indore'=>'IDR','idr'=>'IDR','nagpur'=>'NAG','nag'=>'NAG',
        'vadodara'=>'BDQ','bdq'=>'BDQ','baroda'=>'BDQ','rajkot'=>'RAJ','raj'=>'RAJ','gandhinagar'=>'GNR','gnr'=>'GNR',
        'new zealand'=>'AKL','auckland'=>'AKL','wellington'=>'WLG',
        'toronto'=>'YYZ','canada'=>'YYZ','vancouver'=>'YVR',
        'london'=>'LHR','uk'=>'LHR','united kingdom'=>'LHR',
        'new york'=>'JFK','usa'=>'JFK','u.s.a.'=>'JFK','united states'=>'JFK',
        'los angeles'=>'LAX','chicago'=>'ORD','houston'=>'IAH',
        'dubai'=>'DXB','uae'=>'DXB','abu dhabi'=>'AUH',
        'singapore'=>'SIN','hong kong'=>'HKG','tokyo'=>'NRT','japan'=>'NRT',
        'sydney'=>'SYD','australia'=>'SYD','melbourne'=>'MEL',
        'addis ababa'=>'ADD','ethiopia'=>'ADD','zambia'=>'LUN','lusaka'=>'LUN',
        'nairobi'=>'NBO','kenya'=>'NBO','johannesburg'=>'JNB','south africa'=>'JNB',
        'china'=>'PEK','beijing'=>'PEK','shanghai'=>'PVG',
        'bangkok'=>'BKK','thailand'=>'BKK','kuala lumpur'=>'KUL','malaysia'=>'KUL',
        'doha'=>'DOH','qatar'=>'DOH','riyadh'=>'RUH','saudi arabia'=>'RUH',
        'bahrain'=>'BAH','oman'=>'MCT','muscat'=>'MCT','kuwait'=>'KWI',
        'frankfurt'=>'FRA','germany'=>'FRA','paris'=>'CDG','france'=>'CDG',
        'amsterdam'=>'AMS','netherlands'=>'AMS','italy'=>'FCO','rome'=>'FCO',
    ];
    $city = strtolower(trim(explode(',', $location)[0]));
    if (isset($codes[$city])) return $codes[$city];
    $full = strtolower(trim($location));
    if (isset($codes[$full])) return $codes[$full];
    return strtoupper(substr(preg_replace('/[^a-zA-Z]/', '', $city), 0, 3));
}

function pe_city_name($location) {
    if (empty($location)) return '';
    $raw = strtoupper(trim(explode(',', $location)[0]));
    $code_to_city = [
        'SRT' => 'Surat, Gujarat',
        'BOM' => 'Mumbai',
        'DEL' => 'Delhi',
        'BLR' => 'Bangalore',
        'HYD' => 'Hyderabad',
        'CCU' => 'Kolkata',
        'MAA' => 'Chennai',
        'PNQ' => 'Pune',
        'AMD' => 'Ahmedabad',
        'BDQ' => 'Vadodara',
        'RAJ' => 'Rajkot',
        'GNR' => 'Gandhinagar',
        'LKO' => 'Lucknow',
        'JAI' => 'Jaipur',
        'COK' => 'Kochi',
        'IDR' => 'Indore',
        'NAG' => 'Nagpur',
        'GOI' => 'Goa',
        'GOX' => 'Goa',
        'DXB' => 'Dubai',
        'LHR' => 'London',
        'JFK' => 'New York',
        'ORD' => 'Chicago',
        'LAX' => 'Los Angeles',
        'YYZ' => 'Toronto',
        'YVR' => 'Vancouver',
        'SYD' => 'Sydney',
        'MEL' => 'Melbourne',
        'AKL' => 'Auckland',
        'SIN' => 'Singapore',
        'HKG' => 'Hong Kong',
        'NRT' => 'Tokyo',
        'FRA' => 'Frankfurt',
        'CDG' => 'Paris',
    ];
    if (isset($code_to_city[$raw])) {
        return $code_to_city[$raw];
    }
    return ucwords(strtolower(trim(explode(',', $location)[0])));
}

function pe_country_name($location) {
    if (empty($location)) return '';
    $raw = strtoupper(trim(explode(',', $location)[0]));
    $code_to_country = [
        'SRT' => 'India',
        'BOM' => 'India',
        'DEL' => 'India',
        'BLR' => 'India',
        'HYD' => 'India',
        'CCU' => 'India',
        'MAA' => 'India',
        'PNQ' => 'India',
        'AMD' => 'India',
        'BDQ' => 'India',
        'RAJ' => 'India',
        'GNR' => 'India',
        'LKO' => 'India',
        'JAI' => 'India',
        'COK' => 'India',
        'IDR' => 'India',
        'NAG' => 'India',
        'GOI' => 'India',
        'GOX' => 'India',
        'DXB' => 'UAE',
        'LHR' => 'United Kingdom',
        'JFK' => 'USA',
        'ORD' => 'USA',
        'LAX' => 'USA',
        'YYZ' => 'Canada',
        'YVR' => 'Canada',
        'SYD' => 'Australia',
        'MEL' => 'Australia',
        'AKL' => 'New Zealand',
        'SIN' => 'Singapore',
        'HKG' => 'Hong Kong',
        'NRT' => 'Japan',
        'FRA' => 'Germany',
        'CDG' => 'France',
    ];
    if (isset($code_to_country[$raw])) {
        return $code_to_country[$raw];
    }
    $parts = explode(',', $location);
    if (count($parts) > 1) return trim(end($parts));
    return trim($location);
}

function pe_activity_desc($activity) {
    $a = strtolower($activity);
    if (strpos($a,'delivered')!==false) return 'Package successfully delivered and signed for.';
    if (strpos($a,'out for delivery')!==false) return 'Shipment is with the courier for final delivery.';
    if (strpos($a,'in transit to destination')!==false) return 'Moving towards the local delivery center.';
    if (strpos($a,'in transit')!==false) return 'Shipment is in transit to next facility.';
    if (strpos($a,'released from customs')!==false||strpos($a,'customs clearance')!==false) return 'Customs clearance complete at destination.';
    if (strpos($a,'customs processing')!==false||strpos($a,'customs')!==false) return 'Entry submitted to local customs authorities.';
    if (strpos($a,'flight arrival')!==false||strpos($a,'flight')!==false) return 'Shipment arrived at international airport.';
    if (strpos($a,'arrived at import')!==false) return 'Arrived at import gateway facility.';
    if (strpos($a,'arrived at transit')!==false) return 'Arrived at transit point facility.';
    if (strpos($a,'arrived at export')!==false) return 'Arrived at export gateway facility.';
    if (strpos($a,'arrived')!==false) return 'Shipment arrived at facility.';
    if (strpos($a,'departed')!==false) return 'Shipment has left the facility.';
    if (strpos($a,'processed')!==false) return 'Shipment processed at gateway facility.';
    if (strpos($a,'planned')!==false) return 'Shipment scheduled for next transit point.';
    if (strpos($a,'hub')!==false) return 'Package arrived at local hub facility.';
    if (strpos($a,'information received')!==false||strpos($a,'info received')!==false) return 'Shipment information has been received.';
    if (strpos($a,'booked')!==false||strpos($a,'booking')!==false) return 'Shipment has been booked for dispatch.';
    if (strpos($a,'dispatched')!==false) return 'Shipment has been dispatched from origin.';
    return '';
}

function pe_tl_dot_class($activity) {
    $a = strtolower($activity);
    if (strpos($a,'deliver')!==false) return 'pe-dot-green';
    if (strpos($a,'planned')!==false||strpos($a,'depart')!==false||strpos($a,'dispatched')!==false) return 'pe-dot-red';
    if (strpos($a,'arrived')!==false||strpos($a,'arrival')!==false||strpos($a,'hub')!==false) return 'pe-dot-orange';
    if (strpos($a,'customs')!==false||strpos($a,'released')!==false) return 'pe-dot-dark';
    if (strpos($a,'processed')!==false||strpos($a,'gateway')!==false||strpos($a,'export')!==false) return 'pe-dot-red';
    if (strpos($a,'transit')!==false) return 'pe-dot-red';
    if (strpos($a,'information')!==false||strpos($a,'booked')!==false||strpos($a,'received')!==false) return 'pe-dot-dark';
    return 'pe-dot-red';
}

// Geocoding handled via wp_ajax endpoint (pe_ajax_geocode) — see map shortcode below.

// ========================================
// FETCH API TRACKING
// ========================================
function pe_fetch_tracking($result) {
    $history = [];
    $svc = intval($result->SERVICE);
    $api = intval($result->API);
    if ($api != 1) return $history;

    if ($svc < 1001) {
        global $wpdb;
        $ss = $wpdb->get_row("SELECT * FROM site_setting LIMIT 1");
        $d = json_encode(["username"=>$ss->user_name,"password"=>$ss->licence_key,"order_id"=>$result->AWBNO]);
        $r = wp_remote_post("https://shipway.in/api/getOrderShipmentDetails",['body'=>$d,'headers'=>['Content-Type'=>'text/plain'],'timeout'=>15]);
        if (!is_wp_error($r)) {
            $b = json_decode(wp_remote_retrieve_body($r));
            if (isset($b->status)&&$b->status=="Success"&&isset($b->response->scan)) {
                foreach ($b->response->scan as $s) {
                    $history[] = ['date'=>date("M d, Y",strtotime($s->time)),'time'=>date("h:i A",strtotime($s->time)),
                        'location'=>$s->location??'','activity'=>str_replace(['FedEx','DHL','Aramex','UPS','TNT','Atlantic'],'Agent',$s->status_detail??'')];
                }
                if (isset($b->response->current_status_code)&&$b->response->current_status_code=='DEL') {
                    $result->STATUS='Delivered'; $result->RECEIVER=$b->response->recipient??'';
                    $result->DELIVERYDATE=date('Y-m-d',strtotime($b->response->time??''));
                } elseif (isset($b->response->current_status)) $result->STATUS=$b->response->current_status;
            }
        }
    }
    elseif ($svc==1001) {
        $r = wp_remote_get("https://www.sain.in/api/tracking?awb=".$result->VENDORID1,['timeout'=>15]);
        if (!is_wp_error($r)) {
            $d = json_decode(wp_remote_retrieve_body($r),true);
            if (isset($d['success'])&&isset($d['track_activity'])) {
                foreach ($d['track_activity'] as $act) {
                    foreach ($act as $l) {
                        $history[] = ['date'=>date("M d, Y",strtotime($l['date']??'')),'time'=>date("h:i A",strtotime($l['time']??$l['date']??'')),
                            'location'=>strtoupper($l['location']??''),'activity'=>str_replace(['Sainx','SainX'],'AGENT',$l['description']??'')];
                    }
                }
            }
        }
    }
    elseif ($svc==1009||$svc==1019) {
        $customerCode = !empty($result->ACCODE) ? $result->ACCODE : '1032';
        $url = ($svc==1009)
            ? "http://admin.sairajinternational.online/api/tracking_api/get_tracking_data?company=sairaj-international&customer_code={$customerCode}&tracking_no={$result->VENDORID1}&api_company_id=44"
            : "http://admin.flyswift.net/api/tracking_api/get_tracking_data?api_company_id={$customerCode}&customer_code={$customerCode}&tracking_no={$result->VENDORID1}";
        $r = wp_remote_get($url,['timeout'=>15]);
        if (!is_wp_error($r)) {
            $raw = wp_remote_retrieve_body($r);
            $raw = trim($raw);
            if (substr($raw, 0, 1) === '"' && substr($raw, -1) === '"') {
                $raw = substr($raw, 1, -1);
            }
            $d = json_decode($raw);
            if (is_array($d) && isset($d[0])) {
                $d = $d[0];
            }
            if ($d && isset($d->docket_events) && is_array($d->docket_events)) {
                foreach ($d->docket_events as $s) {
                    $evDate = !empty($s->event_at) ? $s->event_at : (!empty($s->date) ? $s->date : '');
                    $history[] = [
                        'date' => date("M d, Y", strtotime($evDate)),
                        'time' => date("h:i A", strtotime($evDate)),
                        'location' => $s->event_location ?? '',
                        'activity' => str_replace(['FedEx','DHL','Aramex','UPS','TNT','ATLANTIC','atlantic','Atlantic'],'Agent', $s->event_description ?? $s->event_state ?? '')
                    ];
                }
                if (!empty($d->forwarding_no)) {
                    $result->VENDORID2 = $d->forwarding_no;
                }
                if (isset($d->docket_info) && is_array($d->docket_info)) {
                    foreach ($d->docket_info as $info) {
                        if (is_array($info) && count($info) >= 2) {
                            $k = strtolower(trim($info[0]));
                            $v = trim($info[1]);
                            if (strpos($k, 'status') !== false && !empty($v)) $result->STATUS = $v;
                            if (strpos($k, 'delivery date') !== false && !empty($v)) $result->DELIVERYDATE = $v;
                            if (strpos($k, 'receiver name') !== false && !empty($v)) $result->RECEIVER = $v;
                            if (strpos($k, 'forwarding no') !== false && !empty($v) && empty($result->VENDORID2)) $result->VENDORID2 = $v;
                        }
                    }
                }
            }
        }
    }
    elseif ($svc==1007||$svc==1008) {
        $d = json_encode(["UserID"=>$result->TUSER,"Password"=>$result->TPASS,"AWBNo"=>$result->VENDORID1,"Type"=>"A"]);
        $url = ($svc==1007) ? "https://eship.pacificexp.net/api/v1/Tracking/Tracking" : "https://cloud.pacegroupintl.com/api/v1/Tracking/Tracking";
        $r = wp_remote_post($url,['body'=>$d,'headers'=>['Content-Type'=>'application/json'],'timeout'=>15]);
        if (!is_wp_error($r)) {
            $raw = wp_remote_retrieve_body($r);
            $b = json_decode($raw);
            $res = isset($b->Response) ? $b->Response : $b;
            if (isset($res->ErrorDisc) && (strtolower($res->ErrorDisc)=="success" || (isset($res->ResponseCode) && $res->ResponseCode=="RT01") || (isset($res->ErrorCode) && $res->ErrorCode=="0"))) {
                if (isset($res->Events) && is_array($res->Events)) {
                    foreach ($res->Events as $s) {
                        $history[] = ['date'=>date("M d, Y",strtotime($s->EventDate1 ?? $s->EventDate ?? '')),'time'=>date("h:i A",strtotime($s->EventTime1 ?? $s->EventTime ?? '')),
                            'location'=>$s->Location??'','activity'=>str_replace(['FedEx','DHL','Aramex','UPS','TNT','ATLANTIC','atlantic','Atlantic'],'Agent',$s->Status??'')];
                    }
                }
                if (isset($res->Tracking[0])) {
                    $t=$res->Tracking[0];
                    $result->STATUS=$t->Status??$result->STATUS;
                    $result->RECEIVER=$t->ReceiverName??'';
                    $result->DELIVERYDATE=$t->DeliveryDate1??$t->DeliveryDate??$result->DELIVERYDATE;
                    if (!empty($t->VendorAWBNo2)) {
                        $result->VENDORID2 = $t->VendorAWBNo2;
                    } elseif (!empty($t->VendorAWBNo1)) {
                        $result->VENDORID2 = $t->VendorAWBNo1;
                    }
                }
            }
        }
    }
    return $history;
}

// ========================================
// ALL STYLES (v4.1)
// ========================================
function pe_tracking_styles() {
    static $done = false;
    if ($done) return;
    $done = true;
    ?>
    <style>
    /* ===== RESET & BASE ===== */
    .pe-wrap,.pe-history-card,.pe-facts-col{font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;color:#1e293b;line-height:1.6;}
    .pe-wrap *,.pe-wrap *::before,.pe-wrap *::after,
    .pe-history-card *,.pe-history-card *::before,.pe-history-card *::after,
    .pe-facts-col *,.pe-facts-col *::before,.pe-facts-col *::after,
    .pe-map-card *,.pe-map-card *::before,.pe-map-card *::after{box-sizing:border-box;margin:0;padding:0;}

    /* ===== KEYFRAME ANIMATIONS ===== */
    @keyframes pe-fadein{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
    @keyframes pe-fadein-left{from{opacity:0;transform:translateX(-12px)}to{opacity:1;transform:translateX(0)}}
    @keyframes pe-progress-fill{from{width:0}to{width:var(--pe-progress)}}
    @keyframes pe-pulse-dot{0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,0.35)}50%{box-shadow:0 0 0 6px rgba(220,38,38,0)}}
    @keyframes pe-plane-fly{0%{transform:translate(-50%,-50%) translateX(-4px)}50%{transform:translate(-50%,-50%) translateX(4px)}100%{transform:translate(-50%,-50%) translateX(-4px)}}
    @keyframes pe-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
    @keyframes pe-bounce-in{0%{opacity:0;transform:scale(0.85)}60%{transform:scale(1.04)}100%{opacity:1;transform:scale(1)}}
    @keyframes pe-slide-down{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}

    /* ===== SEARCH HERO ===== */
    .pe-hero{
        background:linear-gradient(135deg, #000000 0%, #0e141c 50%, #080e1c 100%);
        border-radius:16px;padding:44px 40px 38px;
        position:relative;overflow:hidden;
    }
    .pe-hero::before{
        content:'';position:absolute;top:-80px;right:-60px;
        width:400px;height:400px;
        background:radial-gradient(circle,rgba(220,38,38,0.08) 0%,transparent 70%);
        pointer-events:none;
    }
    .pe-hero::after{
        content:'';position:absolute;bottom:-60px;left:-40px;
        width:300px;height:300px;
        background:radial-gradient(circle,rgba(220,38,38,0.04) 0%,transparent 70%);
        pointer-events:none;
    }
    .pe-hero h2{color:#fff;font-size:30px;font-weight:800;margin-bottom:8px;position:relative;z-index:1;letter-spacing:-0.3px;}
    .pe-hero p{color:#64748b;font-size:14px;margin-bottom:22px;position:relative;z-index:1;}
    .pe-hero-form{display:flex;max-width:520px;position:relative;z-index:1;}
    .pe-search-wrap{
        flex:1;display:flex;align-items:center;
        background:rgba(255,255,255,0.07);
        border:1px solid rgba(255,255,255,0.12);
        border-radius:10px 0 0 10px;padding:0 16px;
        transition:border-color .2s,background .2s;
    }
    .pe-search-wrap:focus-within{
        background:rgba(255,255,255,0.11);
        border-color:rgba(220,38,38,0.5);
    }
    .pe-search-wrap i{color:#475569;font-size:15px;margin-right:12px;flex-shrink:0;}
    .pe-search-wrap input{
        flex:1;padding:14px 0;background:transparent;border:none;
        color:#fff;font-size:14px;font-family:inherit;outline:none;letter-spacing:0.3px;
    }
    .pe-search-wrap input::placeholder{color:#334155;}
    .pe-hero-form button{
        padding:14px 30px;background:#bb0013;color:#fff;border:none;
        border-radius:0 10px 10px 0;cursor:pointer;font-size:12px;font-weight:800;
        font-family:inherit;letter-spacing:1.2px;white-space:nowrap;transition:background .2s,transform .15s;
    }
    .pe-hero-form button:hover{background:#b91c1c;transform:translateX(1px);}
    .pe-hero-form button:active{transform:scale(0.98);}

    /* ===== RESULT SECTION ===== */
    .pe-result{padding:0;}

    /* ===== RESULT TOP CARD ===== */
    .pe-result-card{
        background:#fff;border-radius:16px;border:1px solid #e2e8f0;
        box-shadow:0 2px 8px rgba(0,0,0,0.05),0 12px 32px rgba(0,0,0,0.04);
        overflow:hidden;
        animation:pe-fadein .4s ease both;
    }
    .pe-result-header{
        padding:28px 32px 24px;
        border-bottom:1px solid #f1f5f9;
        position:relative;
    }
    .pe-result-header::before{
        content:'';position:absolute;top:0;left:0;right:0;height:3px;
        background:linear-gradient(90deg,#dc2626,#ef4444,#dc2626);
    }
    .pe-result-top{display:flex;align-items:center;gap:12px;margin-bottom:14px;}

    .pe-badge{
        display:inline-flex;align-items:center;gap:6px;
        padding:5px 14px;border-radius:6px;
        font-size:10px;font-weight:800;text-transform:uppercase;
        letter-spacing:1.2px;line-height:1.4;
    }
    .pe-badge i{font-size:9px;}
    .pe-badge-transit{background:#dc2626;color:#fff;}
    .pe-badge-delivered{background:#16a34a;color:#fff;}
    .pe-badge-booked{background:#2563eb;color:#fff;}
    .pe-badge-other{background:#f59e0b;color:#0f172a;}

    .pe-updated{
        display:flex;align-items:center;gap:6px;
        color:#94a3b8;font-size:12px;font-weight:500;margin-left:auto;
    }
    .pe-updated-dot{
        width:7px;height:7px;border-radius:50%;
        background:#22c55e;display:inline-block;
        animation:pe-pulse-dot 2s infinite;
    }

    .pe-result-meta{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;}
    .pe-consignee{
        font-size:34px;font-weight:900;color:#0f172a;
        letter-spacing:-0.8px;margin-bottom:6px;line-height:1.15;
        animation:pe-fadein .5s .1s ease both;
    }
    .pe-awb-line{
        display:flex;align-items:center;gap:8px;flex-wrap:wrap;
        font-size:13px;color:#64748b;margin-bottom:0;
        animation:pe-fadein .5s .15s ease both;
    }
    .pe-awb-line .pe-awb-num{color:#dc2626;font-weight:700;font-size:14px;}
    .pe-awb-sep{color:#cbd5e1;}
    .pe-awb-svc{
        background:#f8fafc;border:1px solid #e2e8f0;
        border-radius:4px;padding:2px 8px;
        font-size:11px;font-weight:600;color:#475569;letter-spacing:0.3px;
    }

    .pe-delivery-block{
        text-align:right;flex-shrink:0;
        animation:pe-fadein .5s .2s ease both;
    }
    .pe-delivery-label{
        font-size:10px;font-weight:700;color:#94a3b8;
        text-transform:uppercase;letter-spacing:1.2px;margin-bottom:4px;
    }
    .pe-delivery-date{
        font-size:24px;font-weight:800;color:#0f172a;line-height:1.2;letter-spacing:-0.3px;
    }
    .pe-delivery-date.pe-del-green{color:#16a34a;}

    /* ===== ROUTE BAR (inside result card) ===== */
    .pe-route{
        background:linear-gradient(135deg, #000000 0%, #0e141c 50%, #080e1c 100%);
        padding:22px 32px;
        display:flex;align-items:center;gap:0;
        animation:pe-fadein .5s .25s ease both;
        position:relative;overflow:hidden;
    }
    .pe-route::before{
        content:'';position:absolute;right:0;top:0;bottom:0;width:200px;
        background:radial-gradient(ellipse at right,rgba(220,38,38,0.08),transparent 70%);
        pointer-events:none;
    }
    .pe-route-origin{flex-shrink:0;min-width:64px;}
    .pe-route-code{font-size:28px;font-weight:900;color:#fff;letter-spacing:1px;line-height:1;}
    .pe-route-city{font-size:16px;color:#ecedef;text-transform:uppercase;letter-spacing:0.8px;margin-top:5px;font-weight:600;}
    .pe-route-line-wrap{
        flex:1;margin:0 20px;position:relative;
        display:flex;flex-direction:column;align-items:stretch;gap:8px;
    }
    .pe-route-stops{
        display:flex;justify-content:center;align-items:center;
        font-size:10px;color:#334155;font-weight:600;letter-spacing:0.5px;margin-bottom:-2px;
    }
    .pe-route-line-track{
        position:relative;height:5px;
        background:rgba(255,255,255,0.08);border-radius:2px;overflow:visible;
    }
    .pe-route-progress{
        position:absolute;left:0;top:0;height:100%;
        background:linear-gradient(90deg,#dc2626,#ef4444);
        border-radius:2px;
        --pe-progress:60%;
        width:0;
        animation:pe-progress-fill .8s .6s cubic-bezier(.4,0,.2,1) forwards;
    }
    .pe-route-plane{
        position:absolute;top:50%;transform:translate(-50%,-50%);
        color:#ef4444;font-size:18px;line-height:1;
        filter:drop-shadow(0 0 5px rgba(220,38,38,0.6));
        animation:pe-plane-fly 3s ease-in-out infinite;
        left:var(--pe-plane-pos,60%);
    }
    .pe-route-dest-wrap{
        flex-shrink:0;display:flex;align-items:center;gap:12px;min-width:64px;justify-content:flex-end;
    }
    .pe-route-dest-wrap .pe-route-point{text-align:right;}
    .pe-route-check{
        width:32px;height:32px;background:#22c55e;border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        color:#fff;font-size:14px;flex-shrink:0;
        box-shadow:0 0 0 4px rgba(34,197,94,0.2);
        animation:pe-bounce-in .5s .8s ease both;
    }

    /* ===== STATS ROW (inside result card bottom) ===== */
    .pe-result-stats{
        display:grid;grid-template-columns:repeat(4,1fr);
        border-top:1px solid #f1f5f9;
        animation:pe-fadein .5s .3s ease both;
    }
    .pe-stat-item{
        padding:16px 20px;
        border-right:1px solid #f1f5f9;
        transition:background .15s;
    }
    .pe-stat-item:last-child{border-right:none;}
    .pe-stat-item:hover{background:#fafafa;}
    .pe-stat-label{font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;}
    .pe-stat-value{font-size:13px;font-weight:700;color:#0f172a;}
    .pe-stat-value.green{color:#16a34a;}
    .pe-stat-value.red{color:#dc2626;}

    /* ===== MAP CARD ===== */
    .pe-map-card{
        background:#fff;border-radius:16px;border:1px solid #e2e8f0;
        box-shadow:0 2px 8px rgba(0,0,0,0.05),0 12px 32px rgba(0,0,0,0.04);
        overflow:hidden;
        font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;
        animation:pe-fadein .5s .32s ease both;
    }
    .pe-map-header{
        display:flex;justify-content:space-between;align-items:center;
        padding:20px 28px;border-bottom:1px solid #f1f5f9;
        background:#fafafa;
    }
    .pe-map-header h3{
        font-size:15px;font-weight:800;color:#0f172a;margin:0;
        display:flex;align-items:center;gap:8px;
    }
    .pe-map-header h3 i{color:#dc2626;font-size:14px;}
    .pe-map-stop-count{
        background:#fee2e2;color:#dc2626;
        font-size:11px;font-weight:700;
        padding:3px 9px;border-radius:20px;margin-left:6px;
    }
    .pe-map-legend{display:flex;align-items:center;gap:16px;flex-wrap:wrap;}
    .pe-map-legend-item{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:#64748b;}
    .pe-map-legend-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;}
    .pe-map-legend-line{width:20px;height:2px;background:#dc2626;border-radius:1px;}
    .pe-map-body{position:relative;}
    #pe-shipment-map{width:100%;height:420px;z-index:1;}
    .pe-map-loading{
        position:absolute;inset:0;background:#f8fafc;
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        z-index:5;gap:12px;color:#64748b;font-size:13px;font-weight:600;
        font-family:'Inter',sans-serif;
    }
    .pe-map-loading i{font-size:28px;color:#dc2626;animation:pe-plane-fly 1.5s ease-in-out infinite;}
    .pe-map-no-locations{
        padding:48px 32px;text-align:center;color:#94a3b8;font-size:13px;
        font-family:'Inter',sans-serif;
    }
    .pe-map-no-locations i{font-size:28px;display:block;margin-bottom:12px;opacity:0.3;}
    /* Leaflet popup custom style */
    .pe-map-popup{font-family:'Inter',sans-serif;min-width:160px;}
    .pe-map-popup-act{font-size:12px;font-weight:700;color:#0f172a;margin-bottom:4px;line-height:1.35;}
    .pe-map-popup-loc{font-size:11px;color:#64748b;margin-bottom:3px;}
    .pe-map-popup-time{font-size:11px;color:#94a3b8;}
    .pe-map-popup-badge{
        display:inline-block;margin-top:6px;
        background:#fee2e2;color:#dc2626;
        font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.8px;
        padding:2px 8px;border-radius:4px;
    }
    .pe-map-popup-badge.green{background:#dcfce7;color:#16a34a;}

    /* ===== HISTORY CARD ===== */
    .pe-history-card{
        background:#fff;border-radius:16px;border:1px solid #e2e8f0;
        box-shadow:0 2px 8px rgba(0,0,0,0.05),0 12px 32px rgba(0,0,0,0.04);
        overflow:hidden;
        animation:pe-fadein .5s .35s ease both;
    }
    .pe-history-top{
        display:flex;justify-content:space-between;align-items:center;
        padding:20px 28px;border-bottom:1px solid #f1f5f9;
        background:#fafafa;
    }
    .pe-history-top h3{font-size:15px;font-weight:800;color:#0f172a;margin:0;display:flex;align-items:center;gap:8px;}
    .pe-history-top h3 i{color:#dc2626;font-size:14px;}
    .pe-history-count{
        background:#fee2e2;color:#dc2626;
        font-size:11px;font-weight:700;
        padding:3px 9px;border-radius:20px;
        margin-left:6px;
    }

    /* ===== TIMELINE ===== */
    .pe-tl-container{padding:8px 0 0;}
    .pe-date-group{margin-bottom:0;}
    .pe-date-header{
        font-size:10px;font-weight:700;color:#94a3b8;
        text-transform:uppercase;letter-spacing:1.2px;
        padding:14px 28px 10px;
        background:#fafbfc;border-bottom:1px solid #f8fafc;
        display:flex;align-items:center;gap:8px;
    }
    .pe-date-header::after{content:'';flex:1;height:1px;background:#f1f5f9;margin-left:4px;}
    .pe-tl{position:relative;padding:4px 0 0 0;}
    .pe-tl::before{
        content:'';position:absolute;left:42px;top:0;bottom:0;
        width:2px;background:linear-gradient(to bottom,#dc2626 0%,#fca5a5 100%);
    }
    .pe-tl-item{
        position:relative;
        padding:16px 28px 16px 70px;
        display:flex;justify-content:space-between;align-items:flex-start;gap:16px;
        border-bottom:1px solid #f8fafc;
        transition:background .15s;
        opacity:0;
        animation:pe-fadein-left .3s ease forwards;
    }
    /* .pe-tl-item:hover{background:#fafcff;} */
    .pe-tl-item:last-child{border-bottom:none;}
    .pe-tl-dot{
        position:absolute;left:36px;top:20px;
        width:14px;height:14px;border-radius:50%;
        border:2px solid #fff;z-index:2;flex-shrink:0;
        box-shadow:0 0 0 2px rgba(220,38,38,0.12);
    }
    .pe-tl-dot.latest{animation:pe-pulse-dot 2s infinite;}
    .pe-dot-red{background:#dc2626;}
    .pe-dot-orange{background:#f97316;}
    .pe-dot-green{background:#22c55e;}
    .pe-dot-dark{background:#334155;}
    .pe-dot-blue{background:#2563eb;}
    .pe-tl-body{flex:1;min-width:0;}
    .pe-tl-activity{font-size:13px;font-weight:700;color:#0f172a;line-height:1.35;margin-bottom:3px;}
    .pe-tl-desc{font-size:12px;color:#94a3b8;margin-bottom:5px;line-height:1.55;font-weight:400;}
    .pe-tl-loc{
        display:inline-flex;align-items:center;gap:5px;
        font-size:11px;color:#64748b;letter-spacing:0.2px;
        background:#f8fafc;border:1px solid #f1f5f9;
        border-radius:4px;padding:2px 8px;
    }
    .pe-tl-loc i{color:#22c55e;font-size:9px;}
    .pe-tl-dt{text-align:right;white-space:nowrap;flex-shrink:0;padding-top:1px;}
    .pe-tl-time{font-size:12px;font-weight:600;color:#64748b;}
    .pe-empty{text-align:center;padding:40px 12px;color:#94a3b8;font-size:13px;}
    .pe-empty i{font-size:28px;margin-bottom:12px;display:block;opacity:0.3;}

    /* Hidden items */
    .pe-tl-item.pe-hidden{display:none;}

    /* Show More Button */
    .pe-showmore-wrap{
        padding:16px 28px 20px;
        border-top:1px solid #f1f5f9;
        text-align:center;
    }
    .pe-showmore-btn{
        display:inline-flex;align-items:center;gap:8px;
        background:#f8fafc;border:1px solid #e2e8f0;
        border-radius:8px;padding:10px 24px;
        color:#475569;font-size:12px;font-weight:700;
        font-family:inherit;cursor:pointer;letter-spacing:0.5px;
        text-transform:uppercase;transition:all .2s;
    }
    .pe-showmore-btn:hover{background:#f1f5f9;border-color:#cbd5e1;color:#0f172a;}
    .pe-showmore-btn i{font-size:11px;transition:transform .3s;}
    .pe-showmore-btn.expanded i{transform:rotate(180deg);}
    .pe-showmore-count{color:#dc2626;font-weight:800;}

    /* ===== FACTS CARD (DARK) ===== */
    .pe-facts-col{}
    .pe-facts-card{
        background:linear-gradient(135deg, #000000 0%, #0e141c 50%, #080e1c 100%);
        border-radius:16px;padding:24px 24px 18px;
        border:1px solid rgba(255,255,255,0.07);
        box-shadow:0 2px 8px rgba(0,0,0,0.15),0 12px 32px rgba(0,0,0,0.12);
        animation:pe-fadein .5s .4s ease both;
    }
    .pe-facts-head{
        display:flex;align-items:center;gap:10px;
        margin-bottom:18px;
    }
    .pe-facts-i{
        width:28px;height:28px;
        background:#dc2626;border-radius:6px;
        display:flex;align-items:center;justify-content:center;
        color:#fff;font-size:12px;
    }
    .pe-facts-head h3{font-size:15px;font-weight:800;color:#fff;margin:0;}
    .pe-facts-grid{
        display:grid;grid-template-columns:1fr 1fr;
        gap:0;margin-bottom:0;
    }
    .pe-facts-grid .pe-fg-item{
        padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.06);
    }
    .pe-facts-grid .pe-fg-item:nth-child(odd){padding-right:14px;border-right:1px solid rgba(255,255,255,0.06);}
    .pe-facts-grid .pe-fg-item:nth-child(even){padding-left:14px;}
    .pe-fg-label{font-size:12px;font-weight:700;color:#bebebe;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;}
    .pe-fg-value{font-size:14px;font-weight:700;color:#fff;letter-spacing:0.2px;}
    .pe-fg-value.pe-fg-green{color:#22c55e;}
    .pe-fg-value.pe-fg-red{color:#ef4444;}
    .pe-facts-full{padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.06);}
    .pe-facts-full:last-child{border-bottom:none;padding-bottom:4px;}

    /* Status pill inside facts */
    .pe-facts-status-pill{
        display:inline-flex;align-items:center;gap:6px;
        padding:4px 12px;border-radius:20px;
        font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.8px;
    }
    .pe-facts-status-pill.green{background:rgba(34,197,94,0.15);color:#22c55e;}
    .pe-facts-status-pill.red{background:rgba(220,38,38,0.15);color:#ef4444;}
    .pe-facts-status-pill.blue{background:rgba(37,99,235,0.15);color:#60a5fa;}
    .pe-facts-status-pill i{font-size:9px;}

    /* ===== NOT FOUND ===== */
    .pe-nf{
        background:#fff;border-radius:16px;border:1px solid #e2e8f0;
        padding:60px 32px;text-align:center;margin-top:24px;
        box-shadow:0 2px 8px rgba(0,0,0,0.05);
        animation:pe-fadein .4s ease both;
    }
    .pe-nf-icon{
        width:72px;height:72px;background:#fef2f2;border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        margin:0 auto 18px;font-size:28px;color:#dc2626;
    }
    .pe-nf h3{font-size:22px;font-weight:800;color:#0f172a;margin:0 0 10px;}
    .pe-nf p{color:#64748b;font-size:13px;margin:0 0 6px;}
    .pe-nf strong{color:#0f172a;}

    /* ===== STATE CONTAINERS ===== */
    .default-state,.not-found-state,.result-state{display:none;}
    .default-state.active,.not-found-state.active,.result-state.active{display:block;}

    .pe-search-wrap input:focus{
        background:transparent !important;
        color:#fff !important;
    }
    /* ===== RESPONSIVE ===== */
    @media(max-width:768px){
        .pe-hero{padding:32px 20px 28px;border-radius:12px;}
        .pe-hero h2{font-size:24px;margin-bottom:6px;}
        .pe-hero-form button{padding:12px 18px;font-size:11px;}
        .pe-result-header{padding:20px 20px 18px;}
        .pe-result-meta{flex-direction:column;gap:14px;}
        .pe-delivery-block{text-align:left;}
        .pe-consignee{font-size:26px;}
        .pe-route{padding:18px 20px;}
        .pe-route-code{font-size:20px;}
        .pe-result-stats{grid-template-columns:repeat(2,1fr);}
        .pe-stat-item:nth-child(2){border-right:none;}
        .pe-history-top{padding:16px 20px;}
        .pe-tl-item{padding:14px 20px 14px 58px;}
        .pe-tl::before{left:30px;}
        .pe-tl-dot{left:24px;}
        .pe-facts-card{border-radius:12px;}
        .pe-facts-grid{grid-template-columns:1fr;}
        .pe-facts-grid .pe-fg-item:nth-child(odd){padding-right:0;border-right:none;}
        .pe-facts-grid .pe-fg-item:nth-child(even){padding-left:0;}
        #pe-shipment-map{height:320px;}
        .pe-map-legend{gap:10px;}
    }
    @media(max-width:480px){
        .pe-hero{padding:24px 16px 22px;}
        .pe-hero h2{font-size:20px;}
        .pe-hero-form{flex-direction:column;}
        .pe-search-wrap{border-radius:10px;}
        .pe-hero-form button{border-radius:10px;margin-top:8px;padding:14px;}
        .pe-consignee{font-size:20px;}
        .pe-delivery-date{font-size:18px;}
        .pe-route{padding:16px;}
        .pe-route-code{font-size:16px;}
        .pe-result-stats{grid-template-columns:repeat(2,1fr);}
        .pe-tl-item{flex-direction:column;gap:4px;}
        .pe-tl-dt{text-align:left;}
        .leaflet-container{height:280px !important;}
        .pe-map-header{flex-direction:column;align-items:flex-start;gap:10px;}
        .pe-route-city{font-size:12px !important;}
    }
    </style>
    <?php
}

// ================================================================
//  SHORTCODE: [pe_tracking]
// ================================================================
function pe_tracking_form($atts) {
    $atts = shortcode_atts(['class' => ''], $atts);
    $cls = $atts['class'] ? ' ' . esc_attr($atts['class']) : '';

    PE_Data::init();

    $state = 'default';
    if (PE_Data::$searched) {
        $state = PE_Data::$result ? 'result' : 'not-found';
    }

    ob_start();
    pe_tracking_styles();

    echo '<style>.' . esc_attr($state) . '-state{display:block!important}</style>';

    if (PE_Data::$searched && PE_Data::$awb) {
        $awb_js = json_encode(PE_Data::$awb);
        echo '<script>document.addEventListener("DOMContentLoaded",function(){document.querySelectorAll("input[name=\'awb\']").forEach(function(el){if(!el.value)el.value=' . $awb_js . ';});});</script>';
    }

    if ($state === 'result') {
        $result   = PE_Data::$result;
        $status   = PE_Data::$status;
        $awb      = PE_Data::$awb;
        $short    = pe_short_status($status);
        $badge    = pe_status_badge_class($status);
        $ddate    = pe_fdate_long($result->DELIVERYDATE);
        $svc      = intval($result->SERVICE);
        $svc_name = strtoupper(pe_service_name($svc));
        $is_del   = (strtolower($short) === 'delivered');

        $tracking        = PE_Data::$tracking;
        $dest_loc        = $result->DESTINATION ?? '';
        $dest_lower      = strtolower(trim($dest_loc));
        $dest_city_lower = strtolower(trim(explode(',', $dest_loc)[0]));
        $origin_loc      = '';

        if (!empty($tracking)) {
            $chrono = $tracking;
            usort($chrono, function($a, $b) {
                $ta = strtotime(str_replace(',', '', $a['date'] ?? '') . ' ' . ($a['time'] ?? ''));
                $tb = strtotime(str_replace(',', '', $b['date'] ?? '') . ' ' . ($b['time'] ?? ''));
                return $ta - $tb;
            });
            foreach ($chrono as $t) {
                $loc            = trim($t['location'] ?? '');
                if (empty($loc)) continue;
                $loc_lower      = strtolower($loc);
                $loc_city_lower = strtolower(trim(explode(',', $loc)[0]));
                if ($loc_city_lower === $dest_city_lower) continue;
                if ($loc_lower === $dest_lower) continue;
                if ($dest_city_lower && strpos($loc_lower, $dest_city_lower) !== false) continue;
                $origin_loc = $loc;
                break;
            }
        }

        $origin_code    = pe_city_code($origin_loc);
        $dest_code      = pe_city_code($dest_loc);
        $origin_city    = pe_city_name($origin_loc);
        $origin_country = pe_country_name($origin_loc);
        $dest_city      = pe_city_name($dest_loc);
        $show_route     = !empty($origin_loc) && !empty($dest_loc) && $origin_code !== $dest_code;
        // Smarter progress calculation based on tracking events + status
        $progress = $is_del ? 100 : 50;
        if (!empty($tracking) && !$is_del) {
            $total_events = count($tracking);
            // Analyze tracking activities to determine progress
            $has_departure = false; $has_customs = false; $has_arrival = false;
            foreach ($tracking as $_ev) {
                $_act = strtolower($_ev['activity'] ?? '');
                if (strpos($_act,'depart')!==false || strpos($_act,'dispatched')!==false || strpos($_act,'transit')!==false) $has_departure = true;
                if (strpos($_act,'customs')!==false || strpos($_act,'clearance')!==false) $has_customs = true;
                if (strpos($_act,'arrived')!==false || strpos($_act,'arrival')!==false) $has_arrival = true;
            }
            if ($total_events >= 8) $progress = 80;
            elseif ($total_events >= 5) $progress = 65;
            elseif ($total_events >= 3) $progress = 50;
            elseif ($total_events >= 1) $progress = 30;
            if ($has_customs) $progress = max($progress, 70);
            if ($has_arrival && $has_customs) $progress = max($progress, 80);
        }
        $short_lower = strtolower($short);
        if ($short_lower === 'booked' || $short_lower === 'received') $progress = 10;
        if ($short_lower === 'out for delivery') $progress = 90;

        $bdate = pe_fdate($result->BOOKINGDATE);
        $wkg   = !empty($result->ACTUALWEIGHT) ? $result->ACTUALWEIGHT : (!empty($result->WEIGHT) ? $result->WEIGHT : '');
        ?>
    <div class="pe-wrap<?php echo $cls; ?>">

        <!-- ── SEARCH HERO (always visible) ── -->
        <div class="pe-hero">
            <h2>Track Your Shipment</h2>
            <p>Enter your AWB number to get real-time updates</p>
            <form method="POST" class="pe-hero-form">
                <div class="pe-search-wrap">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <input type="text" name="awb" placeholder="Enter AWB / Tracking number…" value="<?php echo esc_attr($awb); ?>" autocomplete="off" />
                </div>
                <button type="submit"><i class="fa-solid fa-arrow-right" style="margin-right:6px;"></i> TRACK</button>
            </form>
        </div>

        <!-- ── RESULT CARD ── -->
        <div class="pe-result" style="margin-top:24px;">
            <div class="pe-result-card">
                <div class="pe-result-header">
                    <div class="pe-result-top">
                        <div class="pe-badge <?php echo $badge; ?>">
                            <?php if($is_del): ?><i class="fa-solid fa-circle-check"></i><?php else: ?><i class="fa-solid fa-circle-dot"></i><?php endif; ?>
                            <?php echo esc_html(strtoupper($short)); ?>
                        </div>
                        <div class="pe-updated"><span class="pe-updated-dot"></span> Live tracking</div>
                    </div>

                    <div class="pe-result-meta">
                        <div>
                            <div class="pe-consignee"><?php echo esc_html(strtoupper($result->CONSIGNEE)); ?></div>
                            <div class="pe-awb-line">
                                <span class="pe-awb-num">AWB #<?php echo esc_html($awb); ?></span>
                                <span class="pe-awb-sep">&middot;</span>
                                <span class="pe-awb-svc">Prince Express Global</span>
                            </div>
                        </div>
                        <?php if ($ddate): ?>
                        <div class="pe-delivery-block">
                            <div class="pe-delivery-label"><?php echo $is_del ? 'Delivered On' : 'Est. Delivery'; ?></div>
                            <div class="pe-delivery-date<?php echo $is_del ? ' pe-del-green' : ''; ?>"><?php echo esc_html($ddate); ?></div>
                        </div>
                        <?php endif; ?>
                    </div>
                </div>

                <?php if ($show_route): ?>
                <div class="pe-route">
                    <div class="pe-route-origin">
                        <div class="pe-route-code"><?php echo esc_html($origin_code); ?></div>
                        <div class="pe-route-city"><?php
                            echo esc_html(strtoupper($origin_city));
                            if ($origin_country && strtolower($origin_country) !== strtolower($origin_city))
                                echo ', ' . esc_html(strtoupper(substr($origin_country, 0, 2)));
                        ?></div>
                    </div>

                    <div class="pe-route-line-wrap">
                        <div class="pe-route-line-track">
                            <div class="pe-route-progress" style="--pe-progress:<?php echo $progress; ?>%"></div>
                            <?php if (!$is_del): ?>
                            <div class="pe-route-plane" style="--pe-plane-pos:<?php echo $progress; ?>%">
                                <i class="fa-solid fa-plane"></i>
                            </div>
                            <?php endif; ?>
                        </div>
                    </div>

                    <div class="pe-route-dest-wrap">
                        <div class="pe-route-point">
                            <div class="pe-route-code"><?php echo esc_html($dest_code); ?></div>
                            <div class="pe-route-city"><?php echo esc_html(strtoupper($dest_city)); ?></div>
                        </div>
                        <?php if ($is_del): ?>
                        <div class="pe-route-check"><i class="fa-solid fa-check"></i></div>
                        <?php endif; ?>
                    </div>
                </div>
                <?php endif; ?>

                <!-- ── STATS ROW ── -->
                <div class="pe-result-stats">
                    <div class="pe-stat-item">
                        <div class="pe-stat-label">Booking Date</div>
                        <div class="pe-stat-value"><?php echo esc_html($bdate ?: '—'); ?></div>
                    </div>
                    <div class="pe-stat-item">
                        <div class="pe-stat-label">Destination</div>
                        <div class="pe-stat-value"><?php echo esc_html($dest_loc ?: '—'); ?></div>
                    </div>
                    <div class="pe-stat-item">
                        <div class="pe-stat-label">Service</div>
                        <div class="pe-stat-value">Prince Express Global</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <?php } elseif ($state === 'not-found') { ?>
    <div class="pe-wrap<?php echo $cls; ?>">
        <div class="pe-hero">
            <h2>Track Your Shipment</h2>
            <p>Enter your AWB number to get real-time updates</p>
            <form method="POST" class="pe-hero-form">
                <div class="pe-search-wrap">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <input type="text" name="awb" placeholder="Enter AWB / Tracking number…" value="<?php echo esc_attr(PE_Data::$awb); ?>" autocomplete="off" />
                </div>
                <button type="submit"><i class="fa-solid fa-arrow-right" style="margin-right:6px;"></i> TRACK</button>
            </form>
        </div>
        <div class="pe-nf">
            <div class="pe-nf-icon"><i class="fa-solid fa-box-open"></i></div>
            <h3>Shipment Not Found</h3>
            <p>No results for AWB <strong>#<?php echo esc_html(PE_Data::$awb); ?></strong></p>
            <p>Please check your tracking number and try again.</p>
        </div>
    </div>
    <?php } else { ?>
    <div class="pe-wrap<?php echo $cls; ?>">
        <div class="pe-hero">
            <h2>Track Your Shipment</h2>
            <p>Enter your AWB number to get real-time updates</p>
            <form method="POST" class="pe-hero-form">
                <div class="pe-search-wrap">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <input type="text" name="awb" placeholder="Enter AWB / Tracking number…" autocomplete="off" />
                </div>
                <button type="submit"><i class="fa-solid fa-arrow-right" style="margin-right:6px;"></i> TRACK</button>
            </form>
        </div>
    </div>
    <?php }
    return ob_get_clean();
}
add_shortcode('pe_tracking', 'pe_tracking_form');


// ================================================================
//  AJAX GEOCODE PROXY — called by JS, cached in WP transients
// ================================================================
add_action('wp_ajax_pe_geocode', 'pe_ajax_geocode');
add_action('wp_ajax_nopriv_pe_geocode', 'pe_ajax_geocode');
function pe_ajax_geocode() {
    $location = sanitize_text_field(trim($_GET['q'] ?? ''));
    if (empty($location)) { wp_send_json_error(); return; }

    // Normalize location string
    $clean_loc = strtoupper(trim(explode(',', $location)[0]));

    // Pre-mapped high-precision coordinates for all primary courier hub codes & cities
    $known_coords = [
        'SRT'              => ['lat' => 21.170240, 'lng' => 72.831061], // Surat, Gujarat, India
        'SURAT'            => ['lat' => 21.170240, 'lng' => 72.831061],
        'SURAT, GUJARAT'   => ['lat' => 21.170240, 'lng' => 72.831061],
        'BOM'              => ['lat' => 19.076090, 'lng' => 72.877426], // Mumbai, Maharashtra, India
        'MUMBAI'           => ['lat' => 19.076090, 'lng' => 72.877426],
        'DEL'              => ['lat' => 28.613939, 'lng' => 77.209021], // New Delhi, India
        'DELHI'            => ['lat' => 28.613939, 'lng' => 77.209021],
        'NEW DELHI'        => ['lat' => 28.613939, 'lng' => 77.209021],
        'AMD'              => ['lat' => 23.022505, 'lng' => 72.571362], // Ahmedabad, Gujarat, India
        'AHMEDABAD'        => ['lat' => 23.022505, 'lng' => 72.571362],
        'BDQ'              => ['lat' => 22.307159, 'lng' => 73.181219], // Vadodara, Gujarat, India
        'VADODARA'         => ['lat' => 22.307159, 'lng' => 73.181219],
        'BARODA'           => ['lat' => 22.307159, 'lng' => 73.181219],
        'RAJ'              => ['lat' => 22.303894, 'lng' => 70.802160], // Rajkot, Gujarat, India
        'RAJKOT'           => ['lat' => 22.303894, 'lng' => 70.802160],
        'GNR'              => ['lat' => 23.215635, 'lng' => 72.636941], // Gandhinagar, Gujarat, India
        'GANDHINAGAR'      => ['lat' => 23.215635, 'lng' => 72.636941],
        'BLR'              => ['lat' => 12.971599, 'lng' => 77.594563], // Bangalore, Karnataka, India
        'BANGALORE'        => ['lat' => 12.971599, 'lng' => 77.594563],
        'BENGALURU'        => ['lat' => 12.971599, 'lng' => 77.594563],
        'HYD'              => ['lat' => 17.385044, 'lng' => 78.486671], // Hyderabad, Telangana, India
        'HYDERABAD'        => ['lat' => 17.385044, 'lng' => 78.486671],
        'MAA'              => ['lat' => 13.082680, 'lng' => 80.270718], // Chennai, Tamil Nadu, India
        'CHENNAI'          => ['lat' => 13.082680, 'lng' => 80.270718],
        'CCU'              => ['lat' => 22.572646, 'lng' => 88.363895], // Kolkata, West Bengal, India
        'KOLKATA'          => ['lat' => 22.572646, 'lng' => 88.363895],
        'PNQ'              => ['lat' => 18.520430, 'lng' => 73.856744], // Pune, Maharashtra, India
        'PUNE'             => ['lat' => 18.520430, 'lng' => 73.856744],
        'JAI'              => ['lat' => 26.912434, 'lng' => 75.787271], // Jaipur, Rajasthan, India
        'JAIPUR'           => ['lat' => 26.912434, 'lng' => 75.787271],
        'LKO'              => ['lat' => 26.846709, 'lng' => 80.946159], // Lucknow, Uttar Pradesh, India
        'LUCKNOW'          => ['lat' => 26.846709, 'lng' => 80.946159],
        'COK'              => ['lat' => 9.931233, 'lng' => 76.267304], // Kochi, Kerala, India
        'KOCHI'            => ['lat' => 9.931233, 'lng' => 76.267304],
        'IDR'              => ['lat' => 22.719569, 'lng' => 75.857726], // Indore, Madhya Pradesh, India
        'INDORE'           => ['lat' => 22.719569, 'lng' => 75.857726],
        'NAG'              => ['lat' => 21.145800, 'lng' => 79.088155], // Nagpur, Maharashtra, India
        'NAGPUR'           => ['lat' => 21.145800, 'lng' => 79.088155],
        'GOI'              => ['lat' => 15.299326, 'lng' => 74.123996], // Goa, India
        'GOX'              => ['lat' => 15.299326, 'lng' => 74.123996],
        'GOA'              => ['lat' => 15.299326, 'lng' => 74.123996],
        'DXB'              => ['lat' => 25.204849, 'lng' => 55.270783], // Dubai, UAE
        'DUBAI'            => ['lat' => 25.204849, 'lng' => 55.270783],
        'LHR'              => ['lat' => 51.507351, 'lng' => -0.127758], // London, UK
        'LONDON'           => ['lat' => 51.507351, 'lng' => -0.127758],
        'JFK'              => ['lat' => 40.712775, 'lng' => -74.005973], // New York, USA
        'NEW YORK'         => ['lat' => 40.712775, 'lng' => -74.005973],
        'ORD'              => ['lat' => 41.878114, 'lng' => -87.629798], // Chicago, USA
        'CHICAGO'          => ['lat' => 41.878114, 'lng' => -87.629798],
        'LAX'              => ['lat' => 34.052234, 'lng' => -118.243685], // Los Angeles, USA
        'LOS ANGELES'      => ['lat' => 34.052234, 'lng' => -118.243685],
        'YYZ'              => ['lat' => 43.653226, 'lng' => -79.383184], // Toronto, Canada
        'TORONTO'          => ['lat' => 43.653226, 'lng' => -79.383184],
        'YVR'              => ['lat' => 49.282729, 'lng' => -123.120738], // Vancouver, Canada
        'VANCOUVER'        => ['lat' => 49.282729, 'lng' => -123.120738],
        'SYD'              => ['lat' => -33.868820, 'lng' => 151.209296], // Sydney, Australia
        'SYDNEY'           => ['lat' => -33.868820, 'lng' => 151.209296],
        'MEL'              => ['lat' => -37.813628, 'lng' => 144.963058], // Melbourne, Australia
        'MELBOURNE'        => ['lat' => -37.813628, 'lng' => 144.963058],
        'AKL'              => ['lat' => -36.848460, 'lng' => 174.763332], // Auckland, New Zealand
        'AUCKLAND'         => ['lat' => -36.848460, 'lng' => 174.763332],
        'SIN'              => ['lat' => 1.352083, 'lng' => 103.819836], // Singapore
        'SINGAPORE'        => ['lat' => 1.352083, 'lng' => 103.819836],
        'HKG'              => ['lat' => 22.319304, 'lng' => 114.169361], // Hong Kong
        'HONG KONG'        => ['lat' => 22.319304, 'lng' => 114.169361],
        'NRT'              => ['lat' => 35.676192, 'lng' => 139.650311], // Tokyo, Japan
        'TOKYO'            => ['lat' => 35.676192, 'lng' => 139.650311],
        'FRA'              => ['lat' => 50.110922, 'lng' => 8.682127], // Frankfurt, Germany
        'FRANKFURT'        => ['lat' => 50.110922, 'lng' => 8.682127],
        'CDG'              => ['lat' => 48.856614, 'lng' => 2.352222], // Paris, France
        'PARIS'            => ['lat' => 48.856614, 'lng' => 2.352222],
    ];

    $full_key = strtoupper(trim($location));
    if (isset($known_coords[$full_key])) {
        wp_send_json_success($known_coords[$full_key]);
        return;
    }
    if (isset($known_coords[$clean_loc])) {
        wp_send_json_success($known_coords[$clean_loc]);
        return;
    }

    $cache_key = 'pe_geo_v2_' . md5(strtolower($location));
    $cached = get_transient($cache_key);
    if ($cached !== false && is_array($cached) && !empty($cached['lat'])) {
        wp_send_json_success($cached);
        return;
    }

    // Expand search query with full city/country if known
    $search_query = $location;
    $city_expanded = pe_city_name($clean_loc);
    $country_expanded = pe_country_name($clean_loc);
    if (!empty($city_expanded) && $city_expanded !== $clean_loc) {
        $search_query = $city_expanded . ', ' . $country_expanded;
    }

    $url = 'https://nominatim.openstreetmap.org/search?' . http_build_query([
        'q'      => $search_query,
        'format' => 'json',
        'limit'  => 1,
    ]);

    $response = wp_remote_get($url, [
        'timeout' => 10,
        'headers' => ['User-Agent' => 'PrinceExpressPlugin/4.2 (contact@princeexpress.in)'],
    ]);

    if (is_wp_error($response)) {
        set_transient($cache_key, null, HOUR_IN_SECONDS);
        wp_send_json_error(['msg' => 'HTTP error']);
        return;
    }

    $body = json_decode(wp_remote_retrieve_body($response), true);
    if (!empty($body[0]['lat']) && !empty($body[0]['lon'])) {
        $result = ['lat' => floatval($body[0]['lat']), 'lng' => floatval($body[0]['lon'])];
        set_transient($cache_key, $result, WEEK_IN_SECONDS);
        wp_send_json_success($result);
    } else {
        set_transient($cache_key, null, HOUR_IN_SECONDS);
        wp_send_json_error(['msg' => 'Not found: ' . $location]);
    }
}

// ================================================================
//  SHORTCODE: [pe_tracking_map]
//  Interactive Leaflet map — geocodes client-side via AJAX proxy
// ================================================================
function pe_tracking_map_shortcode($atts) {
    $atts = shortcode_atts(['class' => '', 'height' => '420'], $atts);
    $cls    = $atts['class'] ? ' ' . esc_attr($atts['class']) : '';
    $height = intval($atts['height']);
    if ($height < 200) $height = 200;

    PE_Data::init();
    if (!PE_Data::$result) return '';

    $tracking = PE_Data::$tracking;
    $result   = PE_Data::$result;
    $status   = PE_Data::$status;
    $short    = pe_short_status($status);
    $is_del   = (strtolower($short) === 'delivered');

    // ── Build chronological list of unique locations with event data ──
    $chrono = $tracking;
    usort($chrono, function($a, $b) {
        $ta = strtotime(str_replace(',', '', $a['date'] ?? '') . ' ' . ($a['time'] ?? ''));
        $tb = strtotime(str_replace(',', '', $b['date'] ?? '') . ' ' . ($b['time'] ?? ''));
        return $ta - $tb;
    });

    // Group events by location (unique, ordered)
    $unique_locs = [];
    foreach ($chrono as $ev) {
        $loc = trim($ev['location'] ?? '');
        if (empty($loc)) continue;
        $key = strtolower($loc);
        if (!isset($unique_locs[$key])) {
            $unique_locs[$key] = ['location' => $loc, 'events' => []];
        }
        $unique_locs[$key]['events'][] = $ev;
    }

    // Add destination if not already in tracking
    $dest_loc = trim($result->DESTINATION ?? '');
    if (!empty($dest_loc)) {
        $dest_key = strtolower($dest_loc);
        if (!isset($unique_locs[$dest_key])) {
            $unique_locs[$dest_key] = [
                'location' => $dest_loc,
                'events'   => [[
                    'activity' => $is_del ? 'Delivered' : 'Destination',
                    'date'     => $is_del ? pe_fdate($result->DELIVERYDATE) : '',
                    'time'     => '',
                    'location' => $dest_loc,
                ]],
            ];
        }
    }

    $loc_list   = array_values($unique_locs);
    $total_locs = count($loc_list);
    $map_id     = 'pe-map-' . uniqid();
    $ajax_url   = admin_url('admin-ajax.php');

    // Build JS-safe point data (no geocoords yet — fetched client-side)
    $js_points = [];
    foreach ($loc_list as $idx => $pt) {
        $is_first = ($idx === 0);
        $is_last  = ($idx === $total_locs - 1);

        $popup_lines = '';
        foreach ($pt['events'] as $ev) {
            $act  = pe_title_case($ev['activity']);
            $time = ($ev['date'] ?? '') . ($ev['time'] ? ' · ' . $ev['time'] : '');
            $popup_lines .= '<div class="pe-map-popup-act">' . esc_html($act) . '</div>';
            if ($time) $popup_lines .= '<div class="pe-map-popup-time">' . esc_html($time) . '</div>';
        }
        
        $loc_raw = trim($pt['location']);
        $loc_upper = strtoupper($loc_raw);
        if ($loc_upper === 'SRT') {
            $loc_label = 'SURAT, GUJARAT';
        } else {
            $city_exp = pe_city_name($loc_raw);
            $loc_label = (!empty($city_exp) && strlen($loc_raw) <= 4) ? strtoupper($city_exp) : strtoupper($loc_raw);
        }

        $badge_html = '';
        if ($is_last)         $badge_html = '<span class="pe-map-popup-badge ' . ($is_del ? 'green' : '') . '">' . ($is_del ? 'DELIVERED' : 'DESTINATION') . '</span>';
        elseif ($is_first)    $badge_html = '<span class="pe-map-popup-badge">ORIGIN</span>';

        $popup_html = '<div class="pe-map-popup">'
            . '<div class="pe-map-popup-loc"><i class="fa-solid fa-location-dot" style="color:#dc2626;margin-right:4px;"></i>' . esc_html($loc_label) . '</div>'
            . $popup_lines . $badge_html . '</div>';

        $js_points[] = [
            'location' => $pt['location'],
            'popup'    => $popup_html,
            'type'     => $is_first ? 'origin' : ($is_last ? 'dest' : 'transit'),
        ];
    }

    ob_start();
    pe_tracking_styles();
    ?>
    <!-- Leaflet via cdnjs (reliable) -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" crossorigin=""/>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js" crossorigin=""></script>

    <style>
    #<?php echo $map_id; ?>{width:100%;height:<?php echo $height; ?>px;z-index:1;background:#f1f5f9;}
    .pe-map-loading{position:absolute;inset:0;background:#f8fafc;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:10;gap:12px;color:#64748b;font-size:13px;font-weight:600;font-family:'Inter',sans-serif;pointer-events:none;}
    .pe-map-loading i{font-size:28px;color:#dc2626;}
    .pe-map-progress-wrap{width:160px;height:4px;background:#e2e8f0;border-radius:2px;overflow:hidden;}
    .pe-map-progress-bar{height:100%;background:#dc2626;border-radius:2px;width:0;transition:width .3s ease;}
    </style>

    <div class="pe-map-card<?php echo $cls; ?>">
        <div class="pe-map-header">
            <h3>
                <i class="fa-solid fa-map-location-dot"></i>
                Shipment Route Map
                <?php if ($total_locs > 0): ?>
                <span class="pe-map-stop-count" id="<?php echo $map_id; ?>-count">0 stops</span>
                <?php endif; ?>
            </h3>
            <div class="pe-map-legend">
                <div class="pe-map-legend-item"><div class="pe-map-legend-dot" style="background:#22c55e;"></div> Origin</div>
                <div class="pe-map-legend-item"><div class="pe-map-legend-dot" style="background:#dc2626;"></div> Transit</div>
                <div class="pe-map-legend-item"><div class="pe-map-legend-dot" style="background:#2563eb;"></div> Destination</div>
                <div class="pe-map-legend-item"><div class="pe-map-legend-line"></div> Route</div>
            </div>
        </div>
        <div class="pe-map-body" style="position:relative;">
            <div class="pe-map-loading" id="<?php echo $map_id; ?>-loading">
                <i class="fa-solid fa-plane"></i>
                <span id="<?php echo $map_id; ?>-status">Locating stops…</span>
                <div class="pe-map-progress-wrap"><div class="pe-map-progress-bar" id="<?php echo $map_id; ?>-bar"></div></div>
            </div>
            <div id="<?php echo $map_id; ?>"></div>
        </div>
    </div>

    <style>
    .leaflet-popup-content-wrapper{border-radius:10px!important;box-shadow:0 4px 20px rgba(0,0,0,0.15)!important;border:1px solid #e2e8f0!important;padding:0!important;}
    .leaflet-popup-content{margin:12px 14px!important;font-family:'Inter',sans-serif!important;}
    .leaflet-popup-tip-container{margin-top:-1px;}
    .pe-map-popup{font-family:'Inter',sans-serif;min-width:150px;}
    .pe-map-popup-act{font-size:12px;font-weight:700;color:#0f172a;margin-bottom:3px;line-height:1.35;}
    .pe-map-popup-loc{font-size:11px;color:#64748b;margin-bottom:4px;font-weight:600;}
    .pe-map-popup-time{font-size:11px;color:#94a3b8;}
    .pe-map-popup-badge{display:inline-block;margin-top:6px;background:#fee2e2;color:#dc2626;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.8px;padding:2px 8px;border-radius:4px;}
    .pe-map-popup-badge.green{background:#dcfce7;color:#16a34a;}
    </style>

    <script>
    (function(){
        var POINTS   = <?php echo json_encode($js_points); ?>;
        var IS_DEL   = <?php echo $is_del ? 'true' : 'false'; ?>;
        var AJAX_URL = <?php echo json_encode($ajax_url); ?>;
        var MAP_ID   = <?php echo json_encode($map_id); ?>;

        // ── Step 1: geocode all locations sequentially (respect Nominatim 1req/s) ──
        function geocodeAll(points, callback) {
            var results = [];
            var idx     = 0;
            var bar     = document.getElementById(MAP_ID + '-bar');
            var status  = document.getElementById(MAP_ID + '-status');
            var countEl = document.getElementById(MAP_ID + '-count');

            function next() {
                if (idx >= points.length) { callback(results); return; }
                var pt = points[idx];

                // Update progress bar
                var pct = Math.round((idx / points.length) * 100);
                if (bar)    bar.style.width = pct + '%';
                if (status) status.textContent = 'Locating ' + (idx+1) + ' of ' + points.length + '…';

                fetch(AJAX_URL + '?action=pe_geocode&q=' + encodeURIComponent(pt.location))
                    .then(function(r){ return r.json(); })
                    .then(function(data){
                        if (data.success && data.data) {
                            results.push({
                                lat:      data.data.lat,
                                lng:      data.data.lng,
                                popup:    pt.popup,
                                type:     pt.type,
                                location: pt.location,
                            });
                            if (countEl) countEl.textContent = results.length + ' stop' + (results.length !== 1 ? 's' : '');
                        }
                        idx++;
                        // 1 second delay between Nominatim requests to stay within rate limit
                        setTimeout(next, 1100);
                    })
                    .catch(function(){ idx++; setTimeout(next, 1100); });
            }
            next();
        }

        // ── Step 2: render the Leaflet map once all coords are ready ──
        function renderMap(mapPoints) {
            var loadEl = document.getElementById(MAP_ID + '-loading');
            if (loadEl) loadEl.style.display = 'none';

            if (mapPoints.length === 0) {
                var body = document.getElementById(MAP_ID).parentNode;
                body.innerHTML = '<div class="pe-map-no-locations"><i class="fa-solid fa-map" style="font-size:28px;display:block;margin-bottom:12px;opacity:.3;"></i>Location data unavailable for map display.</div>';
                return;
            }

            // Update stop count
            var countEl = document.getElementById(MAP_ID + '-count');
            if (countEl) countEl.textContent = mapPoints.length + ' stop' + (mapPoints.length !== 1 ? 's' : '');

            var map = L.map(MAP_ID, {
                zoomControl:       true,
                attributionControl: true,
                scrollWheelZoom:   false,
            });

            L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
                subdomains:  'abcd',
                maxZoom:     19,
            }).addTo(map);

            var latlngs = mapPoints.map(function(p){ return [p.lat, p.lng]; });

            // Route polyline
            var routeLine = L.polyline(latlngs, {
                color:     '#dc2626',
                weight:    2.5,
                opacity:   0.75,
                dashArray: '8, 5',
            }).addTo(map);

            // Arrow markers on midpoints
            for (var i = 0; i < latlngs.length - 1; i++) {
                var mid  = [(latlngs[i][0]+latlngs[i+1][0])/2, (latlngs[i][1]+latlngs[i+1][1])/2];
                var lat1 = latlngs[i][0]*Math.PI/180, lat2 = latlngs[i+1][0]*Math.PI/180;
                var dLng = (latlngs[i+1][1]-latlngs[i][1])*Math.PI/180;
                var y    = Math.sin(dLng)*Math.cos(lat2);
                var x    = Math.cos(lat1)*Math.sin(lat2) - Math.sin(lat1)*Math.cos(lat2)*Math.cos(dLng);
                var bear = Math.atan2(y,x)*180/Math.PI;
                L.marker(mid, {
                    interactive: false,
                    keyboard:    false,
                    icon: L.divIcon({
                        className:'',
                        html:'<div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:10px solid rgba(220,38,38,0.55);transform:rotate('+bear+'deg);transform-origin:center center;"></div>',
                        iconSize:[10,10], iconAnchor:[5,5],
                    }),
                }).addTo(map);
            }

            // Markers
            var lastMarker = null;
            mapPoints.forEach(function(pt, idx){
                var isFirst = (idx === 0);
                var isLast  = (idx === mapPoints.length - 1);
                var color   = '#dc2626', size = 14, shadow = '0 0 0 3px rgba(220,38,38,0.2)', zOff = 0;

                if (isFirst) { color='#22c55e'; size=16; shadow='0 0 0 4px rgba(34,197,94,0.25)'; zOff=100; }
                if (isLast)  {
                    color  = IS_DEL ? '#22c55e' : '#2563eb';
                    size   = 18;
                    shadow = IS_DEL ? '0 0 0 5px rgba(34,197,94,0.3)' : '0 0 0 5px rgba(37,99,235,0.25)';
                    zOff   = 200;
                }

                var pulse = (isLast && !IS_DEL) ? 'animation:pe-pulse-dot 2s infinite;' : '';
                var html  = '<div style="width:'+size+'px;height:'+size+'px;border-radius:50%;background:'+color+';border:3px solid #fff;box-shadow:'+shadow+',0 2px 6px rgba(0,0,0,0.2);'+pulse+'"></div>';

                var icon = L.divIcon({
                    className:'', html:html,
                    iconSize:[size,size], iconAnchor:[size/2,size/2], popupAnchor:[0,-(size/2+4)],
                });

                var marker = L.marker([pt.lat,pt.lng], {icon:icon, zIndexOffset:zOff}).bindPopup(pt.popup, {maxWidth:220});
                marker.addTo(map);
                if (isLast) lastMarker = marker;
            });

            map.fitBounds(routeLine.getBounds(), { padding:[40,40], maxZoom:8 });
            if (lastMarker) setTimeout(function(){ lastMarker.openPopup(); }, 900);
        }

        // ── Bootstrap: wait for Leaflet, then geocode & render ──
        function boot() {
            if (typeof L === 'undefined') { setTimeout(boot, 150); return; }
            if (POINTS.length === 0) {
                var loadEl = document.getElementById(MAP_ID + '-loading');
                if (loadEl) loadEl.style.display = 'none';
                return;
            }
            geocodeAll(POINTS, renderMap);
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', boot);
        } else {
            boot();
        }
    })();
    </script>
    <?php
    return ob_get_clean();
}
add_shortcode('pe_tracking_map', 'pe_tracking_map_shortcode');


// ================================================================
//  SHORTCODE: [pe_tracking_history class="my-class"]
//  Date-grouped timeline with Show More
// ================================================================
function pe_tracking_history_shortcode($atts) {
    $atts = shortcode_atts(['class' => '', 'show' => '4'], $atts);
    $cls = $atts['class'] ? ' ' . esc_attr($atts['class']) : '';
    $initial_show = max(1, intval($atts['show']));

    PE_Data::init();
    if (!PE_Data::$result) return '';

    $tracking = PE_Data::$tracking;

    ob_start();
    pe_tracking_styles();

    $display = $tracking;
    usort($display, function($a, $b) {
        $ta = strtotime(str_replace(',', '', $a['date']) . ' ' . $a['time']);
        $tb = strtotime(str_replace(',', '', $b['date']) . ' ' . $b['time']);
        return $tb - $ta;
    });
    $grouped = [];
    foreach ($display as $t) {
        $dk = $t['date'] ?: 'Unknown';
        if (!isset($grouped[$dk])) $grouped[$dk] = [];
        $grouped[$dk][] = $t;
    }

    $total_items = count($display);
    $hidden_count = max(0, $total_items - $initial_show);
    $history_id = 'pe-hist-' . uniqid();
    ?>
    <div class="pe-history-card<?php echo $cls; ?>" id="<?php echo $history_id; ?>">
        <div class="pe-history-top">
            <h3>
                <i class="fa-solid fa-route"></i>
                Shipment History
                <?php if ($total_items > 0): ?>
                <span class="pe-history-count"><?php echo $total_items; ?></span>
                <?php endif; ?>
            </h3>
        </div>

        <?php if (!empty($tracking)):
            $item_index = 0;
            foreach ($grouped as $date => $events): ?>
            <div class="pe-date-group">
                <div class="pe-date-header"><?php echo esc_html(strtoupper($date)); ?></div>
                <div class="pe-tl">
                    <?php foreach ($events as $t):
                        $dot_class = pe_tl_dot_class($t['activity']);
                        $desc = pe_activity_desc($t['activity']);
                        $is_latest = ($item_index === 0);
                        $is_hidden = ($item_index >= $initial_show);
                        $delay = min($item_index, 8) * 60;
                    ?>
                    <div class="pe-tl-item<?php echo $is_hidden ? ' pe-hidden' : ''; ?>"
                         style="animation-delay:<?php echo $delay; ?>ms">
                        <div class="pe-tl-dot <?php echo $dot_class; ?><?php echo $is_latest ? ' latest' : ''; ?>"></div>
                        <div class="pe-tl-body">
                            <div class="pe-tl-activity"><?php echo esc_html(pe_title_case($t['activity'])); ?></div>
                            <?php if ($desc): ?>
                            <div class="pe-tl-desc"><?php echo esc_html($desc); ?></div>
                            <?php endif; ?>
                            <?php if (!empty($t['location'])): ?>
                            <div class="pe-tl-loc"><i class="fa-solid fa-location-dot"></i> <?php echo esc_html(strtoupper($t['location'])); ?></div>
                            <?php endif; ?>
                        </div>
                        <div class="pe-tl-dt">
                            <div class="pe-tl-time"><?php echo esc_html($t['time']); ?></div>
                        </div>
                    </div>
                    <?php $item_index++; endforeach; ?>
                </div>
            </div>
            <?php endforeach; ?>

            <?php if ($hidden_count > 0): ?>
            <div class="pe-showmore-wrap" id="<?php echo $history_id; ?>-wrap">
                <button class="pe-showmore-btn" onclick="peToggleHistory('<?php echo $history_id; ?>')">
                    <span class="pe-btn-text">Show <span class="pe-showmore-count"><?php echo $hidden_count; ?></span> More Updates</span>
                    <i class="fa-solid fa-chevron-down"></i>
                </button>
            </div>
            <?php endif; ?>

        <?php else: ?>
        <div class="pe-empty"><i class="fa-solid fa-box-open"></i> Tracking history not available yet.</div>
        <?php endif; ?>
    </div>

    <script>
    function peToggleHistory(id) {
        var card = document.getElementById(id);
        var btn = card.querySelector('.pe-showmore-btn');
        var hidden = card.querySelectorAll('.pe-tl-item.pe-hidden');
        var expanded = btn.classList.contains('expanded');

        if (!expanded) {
            var delay = 0;
            hidden.forEach(function(item) {
                item.style.animationDelay = delay + 'ms';
                item.style.opacity = '0';
                item.classList.remove('pe-hidden');
                void item.offsetWidth;
                item.style.animation = 'none';
                void item.offsetWidth;
                item.style.animation = 'pe-fadein-left .3s ease forwards';
                item.style.animationDelay = delay + 'ms';
                delay += 40;
            });
            btn.classList.add('expanded');
            btn.querySelector('.pe-btn-text').innerHTML = 'Show Less';
        } else {
            var allItems = card.querySelectorAll('.pe-tl-item');
            var initialShow = <?php echo $initial_show; ?>;
            allItems.forEach(function(item, i) {
                if (i >= initialShow) {
                    item.classList.add('pe-hidden');
                }
            });
            btn.classList.remove('expanded');
            btn.querySelector('.pe-btn-text').innerHTML = 'Show <span class="pe-showmore-count"><?php echo $hidden_count; ?></span> More Updates';
            card.scrollIntoView({behavior:'smooth', block:'nearest'});
        }
    }
    </script>
    <?php
    return ob_get_clean();
}
add_shortcode('pe_tracking_history', 'pe_tracking_history_shortcode');


// ================================================================
//  SHORTCODE: [pe_tracking_facts class="my-class"]
//  NOTE: Consignee Name and Weight rows removed per v4.1
// ================================================================
function pe_tracking_facts_shortcode($atts) {
    $atts = shortcode_atts(['class' => ''], $atts);
    $cls = $atts['class'] ? ' ' . esc_attr($atts['class']) : '';

    PE_Data::init();
    if (!PE_Data::$result) return '';

    $result   = PE_Data::$result;
    $status   = PE_Data::$status;
    $short    = pe_short_status($status);
    $is_del   = (strtolower($short) === 'delivered');
    $svc      = intval($result->SERVICE);
    $svc_name = pe_service_name($svc);
    $bdate    = pe_fdate($result->BOOKINGDATE);
    $ddate    = pe_fdate($result->DELIVERYDATE);
    $dest     = $result->DESTINATION ?? '';

    // Status pill class
    $pill_cls = 'red';
    if ($is_del) $pill_cls = 'green';
    elseif (strtolower($short) === 'booked') $pill_cls = 'blue';

    ob_start();
    pe_tracking_styles();
    ?>
    <div class="pe-facts-col<?php echo $cls; ?>">
        <div class="pe-facts-card">
            <div class="pe-facts-head">
                <div class="pe-facts-i"><i class="fa-solid fa-table-cells"></i></div>
                <h3>Shipment Facts</h3>
            </div>

            <div class="pe-facts-grid">
                <div class="pe-fg-item">
                    <div class="pe-fg-label">Booking Date</div>
                    <div class="pe-fg-value"><?php echo esc_html($bdate ?: '—'); ?></div>
                </div>
                <div class="pe-fg-item">
                    <div class="pe-fg-label">Status</div>
                    <div class="pe-fg-value">
                        <span class="pe-facts-status-pill <?php echo $pill_cls; ?>">
                            <?php if($is_del): ?><i class="fa-solid fa-circle-check"></i><?php else: ?><i class="fa-solid fa-circle-dot"></i><?php endif; ?>
                            <?php echo esc_html(strtoupper($short)); ?>
                        </span>
                    </div>
                </div>
                <div class="pe-fg-item">
                    <div class="pe-fg-label">Destination</div>
                    <div class="pe-fg-value"><?php echo esc_html($dest ?: '—'); ?></div>
                </div>
                <div class="pe-fg-item">
                    <div class="pe-fg-label"><?php echo $is_del ? 'Delivery Date' : 'Est. Delivery'; ?></div>
                    <div class="pe-fg-value"><?php echo esc_html($ddate ?: '—'); ?></div>
                </div>
            </div>

            <?php if (!empty($result->VENDORID2) && $result->SHOWFWD==1): ?>
            <div class="pe-facts-full">
                <div class="pe-fg-label">Forwarding No.</div>
                <div class="pe-fg-value">
                    <?php if (!empty($result->REMARKS)): ?>
                    <a href="<?php echo esc_url($result->REMARKS);?>" target="_blank" style="color:#60a5fa;text-decoration:none;">
                        <?php echo esc_html($result->VENDORID2);?> <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:10px;"></i>
                    </a>
                    <?php else: echo esc_html($result->VENDORID2); endif; ?>
                </div>
            </div>
            <?php endif; ?>

        </div>
    </div>
    <?php
    return ob_get_clean();
}
add_shortcode('pe_tracking_facts', 'pe_tracking_facts_shortcode');