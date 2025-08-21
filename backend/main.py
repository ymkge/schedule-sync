import os
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
from dotenv import load_dotenv
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from cryptography.fernet import Fernet

# Load environment variables from .env file
load_dotenv()

app = FastAPI()

# --- Configuration ---
# These values are loaded from the .env file.
# Ensure you have created a .env file in the /backend directory.
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
REDIRECT_URI = os.getenv("REDIRECT_URI")
SECRET_KEY = os.getenv("SECRET_KEY")

if not all([GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI, SECRET_KEY]):
    # In a real application, you'd want more robust error handling or logging.
    print("CRITICAL: Missing required environment variables. Please check your .env file.")
    # We don't raise an exception here to allow the app to start for inspection,
    # but endpoints requiring these variables will fail.

# --- Encryption (Placeholder) ---
# In a real app, ensure SECRET_KEY is a securely managed, 32-byte URL-safe base64 key.
# For now, these functions simulate the encryption process.
def encrypt_token(token: str) -> str:
    if not token: return None
    print("INFO: Token encryption is a placeholder.")
    return f"encrypted_{token}"

def decrypt_token(encrypted_token: str) -> str:
    if not encrypted_token: return None
    print("INFO: Token decryption is a placeholder.")
    return encrypted_token.replace("encrypted_", "")

# --- Google OAuth Flow ---
SCOPES = [
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/userinfo.email",
    "openid",
    "https://www.googleapis.com/auth/calendar" # Read/write access to calendars
]

# --- Placeholder Models ---
class BookingRequest(BaseModel):
    slotId: str
    bookerName: str
    bookerEmail: str

# --- API Endpoints ---
@app.get("/")
def read_root():
    return {"message": "Welcome to the Schedule Sync Backend"}

@app.get("/api/auth/login")
def auth_login():
    """
    Generates a Google OAuth 2.0 authorization URL.
    """
    if not all([GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET]):
        raise HTTPException(status_code=500, detail="Server is not configured for Google OAuth.")

    client_config = {
        "web": {
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    }
    
    flow = Flow.from_client_config(client_config, scopes=SCOPES, redirect_uri=REDIRECT_URI)
    
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        prompt='consent',
        include_granted_scopes='true'
    )
    return {"authorization_url": authorization_url}

@app.get("/api/auth/callback")
def auth_callback(request: Request):
    """
    Handles the OAuth 2.0 callback from Google.
    Exchanges the authorization code for tokens.
    """
    # The state parameter should be verified against the one saved in the session
    # to prevent CSRF attacks, but we are omitting that for simplicity here.
    
    # Recreate the flow object with the same configuration as in /login
    client_config = {
        "web": {
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    }
    flow = Flow.from_client_config(client_config, scopes=SCOPES, redirect_uri=REDIRECT_URI)

    try:
        # Use the full URL from the request to fetch the token
        flow.fetch_token(authorization_response=str(request.url))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch token: {e}")

    credentials = flow.credentials
    
    # Encrypt tokens before storing
    access_token_encrypted = encrypt_token(credentials.token)
    refresh_token_encrypted = encrypt_token(credentials.refresh_token)

    # --- TODO: Save to Firestore ---
    # 1. Use the credentials to get user's profile info (e.g., Google ID, email).
    #    (e.g., using google.oauth2.id_token.verify_oauth2_token)
    # 2. Save the encrypted tokens to a 'users' collection in Firestore,
    #    keyed by the user's Google ID.
    
    print(f"Access Token (Encrypted): {access_token_encrypted}")
    print(f"Refresh Token (Encrypted): {refresh_token_encrypted}")

    # For now, we return a success message. In a real app, you would redirect
    # the user back to the frontend with a session token.
    return {
        "message": "Authentication successful. Tokens received and encrypted.",
        "next_steps": "Store tokens in Firestore and create a user session."
    }


@app.post("/api/user/me/slots")
def generate_slots():
    # TODO: Implement slot generation logic
    raise HTTPException(status_code=501, detail="Not Implemented")

@app.get("/api/slots/{user_id}")
def get_slots(user_id: str):
    # TODO: Fetch available slots for a user
    raise HTTPException(status_code=501, detail="Not Implemented")

@app.post("/api/bookings")
def create_booking(booking: BookingRequest):
    # TODO: Implement booking logic with transaction
    print(booking)
    raise HTTPException(status_code=501, detail="Not Implemented")
