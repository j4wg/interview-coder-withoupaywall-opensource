#!/usr/bin/env python3
"""
Simple Gemini API Key Tester
This script tests if your Gemini API key is working correctly.
"""

import requests
import json
import sys

def test_gemini_api_key(api_key):
    """
    Test the Gemini API key with a simple request
    """
    print("🔑 Testing Gemini API Key...")
    print(f"Key: {api_key[:10]}...{api_key[-4:] if len(api_key) > 14 else api_key}")
    print("-" * 50)
    
    # Gemini API endpoint - using 1.5 Pro (more widely available)
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key={api_key}"
    
    # Simple test payload
    payload = {
        "contents": [{
            "parts": [{
                "text": "Say 'Hello! Your API key is working correctly.' in exactly those words."
            }]
        }]
    }
    
    headers = {
        "Content-Type": "application/json"
    }
    
    try:
        print("📡 Sending test request to Gemini API...")
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ SUCCESS! Your API key is working!")
            
            # Parse response
            data = response.json()
            if 'candidates' in data and len(data['candidates']) > 0:
                text_response = data['candidates'][0]['content']['parts'][0]['text']
                print(f"🤖 Gemini Response: {text_response}")
            else:
                print("⚠️  Got 200 but unexpected response format")
                print(f"Response: {json.dumps(data, indent=2)}")
                
        elif response.status_code == 400:
            print("❌ BAD REQUEST (400)")
            print("This usually means:")
            print("  - Invalid API key format")
            print("  - Malformed request")
            try:
                error_data = response.json()
                print(f"Error details: {json.dumps(error_data, indent=2)}")
            except:
                print(f"Raw response: {response.text}")
                
        elif response.status_code == 403:
            print("❌ FORBIDDEN (403)")
            print("This usually means:")
            print("  - Invalid API key")
            print("  - API key doesn't have permission")
            print("  - Gemini API not enabled for your account")
            try:
                error_data = response.json()
                print(f"Error details: {json.dumps(error_data, indent=2)}")
            except:
                print(f"Raw response: {response.text}")
                
        elif response.status_code == 429:
            print("❌ TOO MANY REQUESTS (429)")
            print("You've hit the rate limit. Wait a bit and try again.")
            
        else:
            print(f"❌ UNEXPECTED ERROR ({response.status_code})")
            print(f"Response: {response.text}")
            
    except requests.exceptions.Timeout:
        print("❌ TIMEOUT: Request took too long")
        
    except requests.exceptions.ConnectionError:
        print("❌ CONNECTION ERROR: Can't reach Gemini API")
        print("Check your internet connection")
        
    except Exception as e:
        print(f"❌ UNEXPECTED ERROR: {str(e)}")

def main():
    print("=" * 60)
    print("🧪 GEMINI API KEY TESTER")
    print("=" * 60)
    
    # Get API key from user
    if len(sys.argv) > 1:
        api_key = sys.argv[1]
    else:
        api_key = input("Enter your Gemini API key: ").strip()
    
    if not api_key:
        print("❌ No API key provided!")
        return
    
    if len(api_key) < 10:
        print("❌ API key seems too short. Are you sure it's correct?")
        return
    
    # Test the key
    test_gemini_api_key(api_key)
    
    print("\n" + "=" * 60)
    print("Test completed!")
    print("=" * 60)

if __name__ == "__main__":
    main()
