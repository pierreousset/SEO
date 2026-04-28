<?php
/**
 * Plugin Name: SEO Dashboard
 * Description: Connect your WordPress site to SEO Dashboard for AI-powered meta suggestions and health monitoring.
 * Version: 1.0.0
 * Author: 240 Company
 * License: GPL-2.0-or-later
 */

defined('ABSPATH') || exit;

// --------------- Settings page ---------------

add_action('admin_menu', function () {
    add_options_page('SEO Dashboard', 'SEO Dashboard', 'manage_options', 'seo-dashboard', 'seodash_settings_page');
});

add_action('admin_init', function () {
    register_setting('seodash', 'seodash_api_key');
    register_setting('seodash', 'seodash_url');
});

function seodash_settings_page() {
    ?>
    <div class="wrap">
        <h1>SEO Dashboard</h1>
        <form method="post" action="options.php">
            <?php settings_fields('seodash'); ?>
            <table class="form-table">
                <tr><th>Dashboard URL</th><td><input type="url" name="seodash_url" value="<?php echo esc_attr(get_option('seodash_url', '')); ?>" class="regular-text" placeholder="https://app.yourdomain.com" /></td></tr>
                <tr><th>API Key</th><td><input type="password" name="seodash_api_key" value="<?php echo esc_attr(get_option('seodash_api_key', '')); ?>" class="regular-text" /></td></tr>
            </table>
            <?php submit_button(); ?>
        </form>
    </div>
    <?php
}

// --------------- Helper: API call ---------------

function seodash_api(string $endpoint, array $body = []): array {
    $base = rtrim(get_option('seodash_url', ''), '/');
    $key  = get_option('seodash_api_key', '');
    if (!$base || !$key) return ['error' => 'SEO Dashboard not configured.'];

    $res = wp_remote_post($base . '/api/v1/' . ltrim($endpoint, '/'), [
        'headers' => ['Authorization' => 'Bearer ' . $key, 'Content-Type' => 'application/json'],
        'body'    => wp_json_encode($body),
        'timeout' => 30,
    ]);
    if (is_wp_error($res)) return ['error' => $res->get_error_message()];
    return json_decode(wp_remote_retrieve_body($res), true) ?: ['error' => 'Invalid response'];
}

// --------------- Meta box on edit screens ---------------

add_action('add_meta_boxes', function () {
    add_meta_box('seodash_meta', 'SEO Dashboard', 'seodash_meta_box', ['post', 'page'], 'side', 'high');
});

function seodash_meta_box($post) {
    $url = get_permalink($post);
    ?>
    <div id="seodash-box">
        <p style="margin:0 0 8px"><strong>Page URL:</strong><br><code style="font-size:11px;word-break:break-all"><?php echo esc_html($url); ?></code></p>
        <button type="button" class="button button-primary" id="seodash-suggest" style="width:100%;margin-bottom:8px">Suggest with AI</button>
        <div id="seodash-result" style="display:none">
            <hr>
            <p><strong>Suggested Title:</strong></p>
            <div id="seodash-title" style="background:#f0f0f1;padding:6px 8px;font-size:13px;margin-bottom:4px"></div>
            <button type="button" class="button" id="seodash-apply-title" style="width:100%;margin-bottom:8px">Apply Title</button>
            <p><strong>Suggested Description:</strong></p>
            <div id="seodash-desc" style="background:#f0f0f1;padding:6px 8px;font-size:13px;margin-bottom:4px"></div>
            <button type="button" class="button" id="seodash-apply-desc" style="width:100%;margin-bottom:8px">Apply Description</button>
            <p style="font-size:11px;color:#666"><em id="seodash-reasoning"></em></p>
        </div>
        <div id="seodash-error" style="display:none;color:#d63638;font-size:12px"></div>
    </div>
    <script>
    jQuery(function($){
        $('#seodash-suggest').on('click', function(){
            var btn = $(this).prop('disabled', true).text('Loading...');
            $('#seodash-result, #seodash-error').hide();
            $.post(ajaxurl, {action:'seodash_suggest', url:'<?php echo esc_js($url); ?>', _wpnonce:'<?php echo wp_create_nonce('seodash'); ?>'}, function(r){
                btn.prop('disabled', false).text('Suggest with AI');
                if(r.success){
                    $('#seodash-title').text(r.data.title);
                    $('#seodash-desc').text(r.data.metaDescription);
                    $('#seodash-reasoning').text(r.data.reasoning);
                    $('#seodash-result').show();
                } else {
                    $('#seodash-error').text(r.data).show();
                }
            });
        });
        $('#seodash-apply-title').on('click', function(){
            var t = $('#seodash-title').text();
            // Yoast
            if($('#yoast_wpseo_title').length) $('#yoast_wpseo_title').val(t).trigger('input');
            // RankMath
            if($('#rank_math_title').length) $('#rank_math_title').val(t).trigger('input');
        });
        $('#seodash-apply-desc').on('click', function(){
            var d = $('#seodash-desc').text();
            if($('#yoast_wpseo_metadesc').length) $('#yoast_wpseo_metadesc').val(d).trigger('input');
            if($('#rank_math_description').length) $('#rank_math_description').val(d).trigger('input');
        });
    });
    </script>
    <?php
}

add_action('wp_ajax_seodash_suggest', function () {
    check_ajax_referer('seodash', '_wpnonce');
    $url = sanitize_url($_POST['url'] ?? '');
    if (!$url) wp_send_json_error('Missing URL');
    $res = seodash_api('suggest-meta', ['url' => $url]);
    if (isset($res['error'])) wp_send_json_error($res['error']);
    wp_send_json_success($res);
});

// --------------- Dashboard widget: health score ---------------

add_action('wp_dashboard_setup', function () {
    wp_add_dashboard_widget('seodash_health', 'SEO Health Score', 'seodash_health_widget');
});

function seodash_health_widget() {
    $base = get_option('seodash_url', '');
    $key  = get_option('seodash_api_key', '');
    if (!$base || !$key) { echo '<p>Configure the plugin in <a href="' . admin_url('options-general.php?page=seo-dashboard') . '">Settings &rarr; SEO Dashboard</a>.</p>'; return; }

    $res = wp_remote_get(rtrim($base, '/') . '/api/v1/health-score', [
        'headers' => ['Authorization' => 'Bearer ' . $key],
        'timeout' => 15,
    ]);
    if (is_wp_error($res)) { echo '<p style="color:#d63638">' . esc_html($res->get_error_message()) . '</p>'; return; }
    $data = json_decode(wp_remote_retrieve_body($res), true);
    if (!$data || isset($data['error'])) { echo '<p style="color:#d63638">' . esc_html($data['error'] ?? 'Failed to load') . '</p>'; return; }
    if ($data['score'] === null) { echo '<p>No health score computed yet.</p>'; return; }

    $score = intval($data['score']);
    $color = $score >= 80 ? '#00a32a' : ($score >= 50 ? '#dba617' : '#d63638');
    echo '<div style="text-align:center;padding:16px 0">';
    echo '<div style="font-size:48px;font-weight:700;color:' . $color . '">' . $score . '</div>';
    echo '<div style="color:#646970;font-size:13px">out of 100</div>';
    if (!empty($data['computedAt'])) echo '<div style="color:#a7aaad;font-size:11px;margin-top:8px">Updated ' . esc_html(date('M j, H:i', strtotime($data['computedAt']))) . '</div>';
    echo '</div>';
}
