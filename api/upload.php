<?php
/**
 * VCF Upload API Endpoint
 * 
 * Handles secure file upload with validation and parsing.
 * POST: Upload VCF file(s)
 */

declare(strict_types=1);

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../autoload.php';

// Only accept POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    errorResponse('Method not allowed', 405);
}

// Rate limiting
if (!Security::checkRateLimit('upload', 20, 60)) {
    errorResponse('Too many upload requests. Please wait.', 429);
}

// CSRF validation
$csrfToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? $_POST['csrf_token'] ?? null;
if (!validateCSRFToken($csrfToken)) {
    errorResponse('Invalid security token. Please refresh the page.', 403);
}

// Check for file upload or text paste
$uploadedFiles = [];

// Handle file upload
if (!empty($_FILES['vcf_files'])) {
    $files = $_FILES['vcf_files'];
    
    // Normalize to array format for multiple files
    if (!is_array($files['name'])) {
        $files = [
            'name' => [$files['name']],
            'tmp_name' => [$files['tmp_name']],
            'error' => [$files['error']],
            'size' => [$files['size']],
            'type' => [$files['type']],
        ];
    }

    for ($i = 0; $i < count($files['name']); $i++) {
        $file = [
            'name' => $files['name'][$i],
            'tmp_name' => $files['tmp_name'][$i],
            'error' => $files['error'][$i],
            'size' => $files['size'][$i],
            'type' => $files['type'][$i],
        ];

        // Validate file
        $errors = Security::validateVCFUpload($file);
        if (!empty($errors)) {
            errorResponse('File "' . Security::escapeHtml($file['name']) . '": ' . implode(', ', $errors));
        }

        // Read file content
        $content = file_get_contents($file['tmp_name']);
        if ($content === false) {
            errorResponse('Failed to read uploaded file.');
        }

        $uploadedFiles[] = [
            'name' => $file['name'],
            'content' => $content,
        ];
    }
}

// Handle VCF text paste
if (!empty($_POST['vcf_text'])) {
    $vcfText = Security::sanitizeString($_POST['vcf_text']);
    
    if (stripos($vcfText, 'BEGIN:VCARD') === false) {
        errorResponse('Pasted text does not appear to be valid VCF format.');
    }

    $uploadedFiles[] = [
        'name' => 'Pasted Contacts ' . date('Y-m-d H:i'),
        'content' => $vcfText,
    ];
}

if (empty($uploadedFiles)) {
    errorResponse('No VCF files or text provided.');
}

// Parse all files
$parser = new VCFParser();
$manager = new ContactManager();
$results = [];

foreach ($uploadedFiles as $file) {
    try {
        $contacts = $parser->parse($file['content']);
        
        if (empty($contacts)) {
            $results[] = [
                'filename' => $file['name'],
                'success' => false,
                'error' => 'No valid contacts found in file.',
            ];
            continue;
        }

        $fileId = $manager->addFile($file['name'], $contacts);
        
        $results[] = [
            'filename' => $file['name'],
            'success' => true,
            'fileId' => $fileId,
            'contactCount' => count($contacts),
        ];
    } catch (Exception $e) {
        $results[] = [
            'filename' => $file['name'],
            'success' => false,
            'error' => 'Failed to parse file: ' . $e->getMessage(),
        ];
    }
}

successResponse([
    'files' => $results,
    'totalFiles' => $manager->getFiles(),
    'totalContacts' => $manager->getTotalContactCount(),
]);
