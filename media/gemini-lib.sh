#!/usr/bin/env bash
# Shared library for Gemini image tools
# Dependencies: curl, jq, base64

# Configuration
export GEMINI_API_URL="${GEMINI_API_URL:-https://generativelanguage.googleapis.com/v1beta/models}"
export GEMINI_DEFAULT_MODEL="${GEMINI_DEFAULT_MODEL:-gemini-2.5-flash-image}"

# Check GEMINI_API_KEY is set
gemini_check_api_key() {
    if [[ -z "${GEMINI_API_KEY:-}" ]]; then
        gemini_error "GEMINI_API_KEY not set. Export your API key:
  export GEMINI_API_KEY='your-key-here'"
    fi
}

# Check required dependencies are available
gemini_check_deps() {
    local missing=()
    for cmd in curl jq base64; do
        if ! command -v "$cmd" &>/dev/null; then
            missing+=("$cmd")
        fi
    done
    if [[ ${#missing[@]} -gt 0 ]]; then
        gemini_error "Missing dependencies: ${missing[*]}"
    fi
}

# Base64 encode image file (no newlines)
# Usage: gemini_encode_image "/path/to/image.png"
# Returns: base64 string on stdout
gemini_encode_image() {
    local file="$1"
    if [[ ! -f "$file" ]]; then
        gemini_error "File not found: $file"
    fi
    base64 -w0 "$file"
}

# Detect MIME type from file extension
# Usage: gemini_mime_type "/path/to/image.png"
# Returns: MIME type string
gemini_mime_type() {
    local file="$1"
    local ext="${file##*.}"
    case "${ext,,}" in
        png)  echo "image/png" ;;
        jpg|jpeg) echo "image/jpeg" ;;
        gif)  echo "image/gif" ;;
        webp) echo "image/webp" ;;
        *)    echo "application/octet-stream" ;;
    esac
}

# Make API request to Gemini
# Usage: gemini_request "model-name" "json-payload"
# Returns: JSON response body on stdout, exits on error
gemini_request() {
    local model="$1"
    local payload="$2"
    local url="${GEMINI_API_URL}/${model}:generateContent"

    local response http_code body
    response=$(curl -s -w "\n%{http_code}" \
        -H "Content-Type: application/json" \
        -H "x-goog-api-key: ${GEMINI_API_KEY}" \
        -d "$payload" \
        "$url")

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)

    if [[ "$http_code" != "200" ]]; then
        local err_msg
        err_msg=$(echo "$body" | jq -r '.error.message // "Unknown error"' 2>/dev/null || echo "Unknown error")
        gemini_error "API error ($http_code): $err_msg"
    fi

    echo "$body"
}

# Extract base64 image data from response and save to file
# Usage: gemini_save_image "json-response" "/path/to/output.png"
# Returns: nothing, exits on error
gemini_save_image() {
    local response="$1"
    local output="$2"

    local data
    data=$(echo "$response" | jq -r '.candidates[0].content.parts[] | select(.inlineData) | .inlineData.data // empty')

    if [[ -z "$data" ]]; then
        gemini_error "No image data in response"
    fi

    echo "$data" | base64 -d > "$output"
}

# Extract text response from API response (if any)
# Usage: gemini_get_text "json-response"
# Returns: text string or empty
gemini_get_text() {
    local response="$1"
    echo "$response" | jq -r '.candidates[0].content.parts[] | select(.text) | .text // empty'
}

# Show error message and exit
gemini_error() {
    echo "✗ Error: $*" >&2
    exit 1
}

# Show success message
gemini_success() {
    echo "✓ $*"
}
