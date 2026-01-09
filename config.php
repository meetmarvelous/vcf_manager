<?php
/**
 * VCF Contact Manager - Configuration
 * 
 * Security-first configuration for production deployment.
 * All sensitive operations require proper session and CSRF validation.
 */

declare(strict_types=1);

// Error reporting (disable display in production)
error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');

// Session configuration (must be set before session_start)
ini_set('session.cookie_httponly', '1');
ini_set('session.cookie_samesite', 'Strict');
ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');

// Start session if not already started
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Regenerate session ID periodically for security
if (!isset($_SESSION['created'])) {
    $_SESSION['created'] = time();
} elseif (time() - $_SESSION['created'] > 1800) {
    // Regenerate session ID every 30 minutes
    session_regenerate_id(true);
    $_SESSION['created'] = time();
}

// Application constants
define('APP_NAME', 'VCF Contact Manager');
define('APP_VERSION', '1.0.0');
define('MAX_UPLOAD_SIZE', 10 * 1024 * 1024); // 10MB
define('ALLOWED_EXTENSIONS', ['vcf']);
define('ALLOWED_MIME_TYPES', ['text/vcard', 'text/x-vcard', 'text/directory']);

// Directory paths
define('ROOT_PATH', __DIR__);
define('CLASSES_PATH', ROOT_PATH . '/classes');
define('UPLOADS_PATH', ROOT_PATH . '/uploads');

// Ensure uploads directory exists
if (!is_dir(UPLOADS_PATH)) {
    mkdir(UPLOADS_PATH, 0755, true);
}

// Initialize contacts storage in session if not exists
if (!isset($_SESSION['vcf_files'])) {
    $_SESSION['vcf_files'] = [];
}

if (!isset($_SESSION['contacts'])) {
    $_SESSION['contacts'] = [];
}

// CSRF Token management
function generateCSRFToken(): string {
    if (!isset($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function validateCSRFToken(?string $token): bool {
    if ($token === null || !isset($_SESSION['csrf_token'])) {
        return false;
    }
    return hash_equals($_SESSION['csrf_token'], $token);
}

// JSON response helper
function jsonResponse(array $data, int $statusCode = 200): void {
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('X-XSS-Protection: 1; mode=block');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// Error response helper
function errorResponse(string $message, int $statusCode = 400): void {
    jsonResponse(['success' => false, 'error' => $message], $statusCode);
}

// Success response helper  
function successResponse(array $data = []): void {
    jsonResponse(array_merge(['success' => true], $data));
}
