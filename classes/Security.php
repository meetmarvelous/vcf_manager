<?php
/**
 * Security Utility Class
 * 
 * Provides input validation, output escaping, and security helpers.
 */

declare(strict_types=1);

class Security
{
    /**
     * Sanitize string input - removes null bytes and trims whitespace
     */
    public static function sanitizeString(?string $input): string
    {
        if ($input === null) {
            return '';
        }
        // Remove null bytes and trim
        return trim(str_replace("\0", '', $input));
    }

    /**
     * Escape output for HTML context - prevents XSS
     */
    public static function escapeHtml(?string $input): string
    {
        if ($input === null) {
            return '';
        }
        return htmlspecialchars($input, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }

    /**
     * Escape output for JavaScript context
     */
    public static function escapeJs(?string $input): string
    {
        if ($input === null) {
            return '';
        }
        return json_encode($input, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP);
    }

    /**
     * Validate email address
     */
    public static function validateEmail(?string $email): bool
    {
        if ($email === null || $email === '') {
            return false;
        }
        return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
    }

    /**
     * Validate and sanitize phone number
     * Keeps only digits, plus sign, and common separators
     */
    public static function sanitizePhone(?string $phone): string
    {
        if ($phone === null) {
            return '';
        }
        // Keep digits, plus, spaces, dashes, parentheses
        return preg_replace('/[^\d+\-\s\(\)]/', '', $phone);
    }

    /**
     * Normalize phone number for comparison
     * Strips all non-digit characters except leading plus
     */
    public static function normalizePhone(?string $phone): string
    {
        if ($phone === null || $phone === '') {
            return '';
        }
        $phone = trim($phone);
        $hasPlus = str_starts_with($phone, '+');
        $digits = preg_replace('/\D/', '', $phone);
        return $hasPlus ? '+' . $digits : $digits;
    }

    /**
     * Validate file upload for VCF
     */
    public static function validateVCFUpload(array $file): array
    {
        $errors = [];

        // Check for upload errors
        if ($file['error'] !== UPLOAD_ERR_OK) {
            $errors[] = self::getUploadErrorMessage($file['error']);
            return $errors;
        }

        // Check file size
        if ($file['size'] > MAX_UPLOAD_SIZE) {
            $errors[] = 'File size exceeds maximum allowed (' . (MAX_UPLOAD_SIZE / 1024 / 1024) . 'MB)';
        }

        // Check extension
        $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if (!in_array($extension, ALLOWED_EXTENSIONS, true)) {
            $errors[] = 'Invalid file extension. Only .vcf files are allowed.';
        }

        // Validate file content starts with valid VCF marker
        $handle = fopen($file['tmp_name'], 'r');
        if ($handle) {
            $header = fread($handle, 100);
            fclose($handle);
            if (stripos($header, 'BEGIN:VCARD') === false) {
                $errors[] = 'File does not appear to be a valid VCF file.';
            }
        }

        return $errors;
    }

    /**
     * Get human-readable upload error message
     */
    private static function getUploadErrorMessage(int $errorCode): string
    {
        return match ($errorCode) {
            UPLOAD_ERR_INI_SIZE => 'File exceeds server upload limit.',
            UPLOAD_ERR_FORM_SIZE => 'File exceeds form upload limit.',
            UPLOAD_ERR_PARTIAL => 'File was only partially uploaded.',
            UPLOAD_ERR_NO_FILE => 'No file was uploaded.',
            UPLOAD_ERR_NO_TMP_DIR => 'Server configuration error: missing temp folder.',
            UPLOAD_ERR_CANT_WRITE => 'Server error: failed to write file.',
            UPLOAD_ERR_EXTENSION => 'Upload blocked by server extension.',
            default => 'Unknown upload error.',
        };
    }

    /**
     * Generate a unique ID for contacts
     */
    public static function generateId(): string
    {
        return bin2hex(random_bytes(16));
    }

    /**
     * Rate limiting check (simple session-based)
     */
    public static function checkRateLimit(string $action, int $maxAttempts = 10, int $windowSeconds = 60): bool
    {
        $key = 'rate_limit_' . $action;
        $now = time();

        if (!isset($_SESSION[$key])) {
            $_SESSION[$key] = ['count' => 0, 'window_start' => $now];
        }

        // Reset window if expired
        if ($now - $_SESSION[$key]['window_start'] > $windowSeconds) {
            $_SESSION[$key] = ['count' => 0, 'window_start' => $now];
        }

        $_SESSION[$key]['count']++;

        return $_SESSION[$key]['count'] <= $maxAttempts;
    }
}
