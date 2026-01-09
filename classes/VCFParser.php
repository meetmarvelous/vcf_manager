<?php
/**
 * VCF Parser Class
 * 
 * Parses VCF (vCard) files supporting versions 2.1, 3.0, and 4.0.
 * Extracts contacts with all standard fields.
 */

declare(strict_types=1);

class VCFParser
{
    private string $rawContent;
    private array $contacts = [];

    /**
     * Parse VCF content from string
     */
    public function parse(string $content): array
    {
        $this->rawContent = $content;
        $this->contacts = [];

        // Normalize line endings
        $content = str_replace(["\r\n", "\r"], "\n", $content);
        
        // IMPORTANT: Handle quoted-printable soft line breaks FIRST
        // Soft line breaks are indicated by = at the end of a line
        // This must be done before standard vCard line unfolding
        $content = preg_replace('/=\n/', '', $content);
        
        // Unfold long lines (lines starting with space/tab are continuations)
        $content = preg_replace('/\n[ \t]/', '', $content);

        // Split into individual vCards
        preg_match_all('/BEGIN:VCARD.*?END:VCARD/is', $content, $matches);

        foreach ($matches[0] as $vcard) {
            $contact = $this->parseVCard($vcard);
            if ($contact !== null) {
                $this->contacts[] = $contact;
            }
        }

        return $this->contacts;
    }

    /**
     * Parse a single vCard block
     */
    private function parseVCard(string $vcard): ?array
    {
        $lines = explode("\n", $vcard);
        $contact = [
            'id' => Security::generateId(),
            'name' => '',
            'firstName' => '',
            'lastName' => '',
            'phones' => [],
            'emails' => [],
            'organization' => '',
            'title' => '',
            'notes' => '',
            'tags' => [],
            'raw' => $vcard,
        ];

        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line) || $line === 'BEGIN:VCARD' || $line === 'END:VCARD') {
                continue;
            }

            $this->parseLine($line, $contact);
        }

        // Validate: must have name or at least one phone
        if (empty($contact['name']) && empty($contact['phones'])) {
            return null;
        }

        // If no name but has phones, use first phone as name
        if (empty($contact['name']) && !empty($contact['phones'])) {
            $contact['name'] = $contact['phones'][0]['value'];
        }

        return $contact;
    }

    /**
     * Parse a single line from vCard
     */
    private function parseLine(string $line, array &$contact): void
    {
        // Split property name from value
        $colonPos = strpos($line, ':');
        if ($colonPos === false) {
            return;
        }

        $propertyPart = substr($line, 0, $colonPos);
        $value = $this->decodeValue(substr($line, $colonPos + 1));

        // Extract property name and parameters
        $semicolonPos = strpos($propertyPart, ';');
        if ($semicolonPos !== false) {
            $property = strtoupper(substr($propertyPart, 0, $semicolonPos));
            $params = $this->parseParameters(substr($propertyPart, $semicolonPos + 1));
        } else {
            $property = strtoupper($propertyPart);
            $params = [];
        }

        switch ($property) {
            case 'FN':
                $contact['name'] = $value;
                break;

            case 'N':
                $parts = explode(';', $value);
                $contact['lastName'] = $parts[0] ?? '';
                $contact['firstName'] = $parts[1] ?? '';
                if (empty($contact['name']) && (!empty($contact['firstName']) || !empty($contact['lastName']))) {
                    $contact['name'] = trim($contact['firstName'] . ' ' . $contact['lastName']);
                }
                break;

            case 'TEL':
                $type = $this->extractType($params);
                $contact['phones'][] = [
                    'value' => Security::sanitizePhone($value),
                    'type' => $type,
                    'normalized' => Security::normalizePhone($value),
                ];
                break;

            case 'EMAIL':
                $type = $this->extractType($params);
                $contact['emails'][] = [
                    'value' => strtolower(trim($value)),
                    'type' => $type,
                ];
                break;

            case 'ORG':
                $contact['organization'] = $value;
                break;

            case 'TITLE':
                $contact['title'] = $value;
                break;

            case 'NOTE':
                $contact['notes'] = $value;
                break;

            case 'CATEGORIES':
                $contact['tags'] = array_map('trim', explode(',', $value));
                break;
        }
    }

    /**
     * Parse parameter string into array
     */
    private function parseParameters(string $paramString): array
    {
        $params = [];
        $parts = explode(';', $paramString);
        
        foreach ($parts as $part) {
            if (strpos($part, '=') !== false) {
                [$key, $val] = explode('=', $part, 2);
                $params[strtoupper($key)] = $val;
            } else {
                // vCard 2.1 style: just TYPE value without key
                $params['TYPE'] = $part;
            }
        }

        return $params;
    }

    /**
     * Extract type from parameters
     */
    private function extractType(array $params): string
    {
        $type = $params['TYPE'] ?? '';
        // Clean up type value
        $type = strtolower(str_replace(['pref,', ',pref'], '', $type));
        return match (true) {
            str_contains($type, 'cell') || str_contains($type, 'mobile') => 'mobile',
            str_contains($type, 'home') => 'home',
            str_contains($type, 'work') => 'work',
            str_contains($type, 'fax') => 'fax',
            default => 'other',
        };
    }

    /**
     * Decode vCard encoded values
     * Handles quoted-printable encoding with proper UTF-8 support for emojis and special characters
     */
    private function decodeValue(string $value): string
    {
        // Check if value contains quoted-printable sequences (=XX hex patterns)
        if (preg_match('/=[0-9A-Fa-f]{2}/', $value)) {
            $decoded = $this->decodeQuotedPrintableUTF8($value);
            if ($decoded !== null && $decoded !== $value) {
                $value = $decoded;
            }
        }

        // Unescape special characters
        $value = str_replace(['\\n', '\\N', '\\,', '\\;', '\\\\'], ["\n", "\n", ',', ';', '\\'], $value);

        return trim($value);
    }

    /**
     * Robust quoted-printable decoder with proper UTF-8 support
     * Handles multi-byte characters like emojis and special fonts correctly
     */
    private function decodeQuotedPrintableUTF8(string $value): ?string
    {
        // First, try PHP's built-in decoder
        $decoded = quoted_printable_decode($value);
        
        // Check if result is valid UTF-8
        if (mb_check_encoding($decoded, 'UTF-8')) {
            return $decoded;
        }
        
        // If built-in fails, use manual decoding
        // This handles cases where the encoding is mixed or partial
        $result = '';
        $bytes = [];
        $len = strlen($value);
        $i = 0;
        
        while ($i < $len) {
            if ($value[$i] === '=' && $i + 2 < $len) {
                $hex = substr($value, $i + 1, 2);
                // Check if it's a valid hex sequence
                if (ctype_xdigit($hex)) {
                    $bytes[] = hexdec($hex);
                    $i += 3;
                    continue;
                }
            }
            
            // Flush any accumulated bytes as UTF-8
            if (!empty($bytes)) {
                $result .= $this->bytesToUTF8($bytes);
                $bytes = [];
            }
            
            // Add regular character
            $result .= $value[$i];
            $i++;
        }
        
        // Flush remaining bytes
        if (!empty($bytes)) {
            $result .= $this->bytesToUTF8($bytes);
        }
        
        return $result;
    }

    /**
     * Convert array of bytes to UTF-8 string
     */
    private function bytesToUTF8(array $bytes): string
    {
        $binary = '';
        foreach ($bytes as $byte) {
            $binary .= chr($byte);
        }
        
        // Try to decode as UTF-8
        $decoded = mb_convert_encoding($binary, 'UTF-8', 'UTF-8');
        
        // If conversion fails or produces empty string, try from common encodings
        if (empty($decoded) || !mb_check_encoding($decoded, 'UTF-8')) {
            // Try ISO-8859-1 (Latin-1) as fallback
            $decoded = mb_convert_encoding($binary, 'UTF-8', 'ISO-8859-1');
        }
        
        return $decoded ?: $binary;
    }

    /**
     * Get count of parsed contacts
     */
    public function getContactCount(): int
    {
        return count($this->contacts);
    }
}
