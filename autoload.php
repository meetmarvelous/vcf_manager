<?php
/**
 * PSR-4 Compatible Autoloader
 */

declare(strict_types=1);

spl_autoload_register(function (string $class): void {
    $prefix = '';
    $baseDir = __DIR__ . '/classes/';
    
    $relativeClass = $class;
    $file = $baseDir . str_replace('\\', '/', $relativeClass) . '.php';
    
    if (file_exists($file)) {
        require $file;
    }
});
