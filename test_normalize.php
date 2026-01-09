<?php
// Test script to verify Contact class name normalization

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/autoload.php';

// Create test contacts
$contact1 = Contact::fromArray(['name' => 'Mrs Adegboyega']);
$contact2 = Contact::fromArray(['name' => 'Mr Adegboyega']);

$n1 = $contact1->getNormalizedName();
$n2 = $contact2->getNormalizedName();

echo "Testing Contact::getNormalizedName():\n";
echo "Original: 'Mrs Adegboyega' -> Normalized: '$n1'\n";
echo "Original: 'Mr Adegboyega' -> Normalized: '$n2'\n";
echo "Are they equal? " . ($n1 === $n2 ? 'YES (BUG - should not match!)' : 'NO (CORRECT - different names)') . "\n";
