import os
import base64
from fastapi import FastAPI, HTTPException, Request
from starlette.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from google.cloud import firestore
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from cryptography.fernet import Fernet

# Load environment variables from .env file
load_dotenv()

print(f"DEBUG: Loaded SECRET_KEY from .env: {os.getenv('SECRET_KEY')}")

app = FastAPI()

# --- CORS Middleware ---
origins = [
    "http://localhost:3000", # React frontend
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Allows all methods
    allow_headers=["*"], # Allows all headers
)

# --- Firestore Client ---
try:
    db = firestore.Client()
    print("Firestore client initialized successfully.")
except Exception as e:
    print(f"CRITICAL: Error initializing Firestore client: {e}")
    db = None

# --- Configuration ---
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
REDIRECT_URI = os.getenv("REDIRECT_URI")
SECRET_KEY = os.getenv("SECRET_KEY")

# --- Encryption ---
# SECRET_KEY must be a 32-byte URL-safe base64-encoded string.
# Generate with: python -c "import base64, os; print(base64.urlsafe_b64encode(os.urandom(32)).decode())"
try:
    if SECRET_KEY:
        f_key = Fernet(SECRET_KEY.encode())
    else:
        f_key = None
        print("CRITICAL: SECRET_KEY is not set. Encryption is disabled.")
except Exception as e:
    f_key = None
    print(f"CRITICAL: Invalid SECRET_KEY. It must be a 32-byte URL-safe base64 string. Error: {e}")

def encrypt_token(token: str) -> str:
    if not token or not f_key: return None
    return f_key.encrypt(token.encode()).decode()

def decrypt_token(encrypted_token: str) -> str:
    if not encrypted_token or not f_key: return None
    return f_key.decrypt(encrypted_token.encode()).decode()

# --- Google OAuth Flow ---
SCOPES = [
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/userinfo.email",
    "openid",
    "https://www.googleapis.com/auth/calendar" # Read/write access to calendars
]

client_config = {
    "web": {
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
    }
} if GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET else None

class BookingRequest(BaseModel):
    publicUrlToken: str
    slotId: str # The startTime of the slot acts as its unique ID
    bookerName: str
    bookerEmail: str


@firestore.transactional
def book_slot_in_transaction(transaction, slots_ref, slot_id):
    """
    Atomically checks and updates a slot's status within a transaction.
    """
    snapshot = slots_ref.get(transaction=transaction)
    if not snapshot.exists:
        raise FileNotFoundError("Slots document not found.")
    
    slots = snapshot.to_dict().get('slots', [])
    slot_found = False
    slot_to_book = None
    for i, slot in enumerate(slots):
        if slot.get('slotId') == slot_id:
            if slot.get('status') != 'available':
                raise ValueError("Slot is no longer available.")
            
            slots[i]['status'] = 'booked'
            slot_found = True
            slot_to_book = slot
            break
    
    if not slot_found:
        raise ValueError("Slot ID not found.")

    transaction.update(slots_ref, {'slots': slots})
    return slot_to_book


@app.post("/api/bookings")
def create_booking(req: BookingRequest):
    if not db:
        raise HTTPException(status_code=500, detail="Firestore client not available.")

    try:
        # Step 1: Find user by public token
        users_ref = db.collection('users')
        query = users_ref.where(filter=firestore.FieldFilter("publicUrlToken", "==", req.publicUrlToken)).limit(1)
        user_results = list(query.stream())
        if not user_results:
            raise HTTPException(status_code=404, detail="User to book with not found.")
        
        host_user_doc = user_results[0]
        host_user_id = host_user_doc.id
        host_user_data = host_user_doc.to_dict()

        # Step 2: Atomically book the slot in Firestore
        slots_ref = db.collection('slots').document(host_user_id)
        transaction = db.transaction()
        booked_slot = book_slot_in_transaction(transaction, slots_ref, req.slotId)

        # Step 3: Create Google Calendar event
        creds = Credentials(
            token=decrypt_token(host_user_data.get('encryptedAccessToken')),
            refresh_token=decrypt_token(host_user_data.get('encryptedRefreshToken')),
            token_uri=client_config['web']['token_uri'],
            client_id=client_config['web']['client_id'],
            client_secret=client_config['web']['client_secret'],
            scopes=SCOPES
        )
        service = build('calendar', 'v3', credentials=creds)
        
        slot_start_time = datetime.fromisoformat(booked_slot['startTime'])
        slot_end_time = datetime.fromisoformat(booked_slot['endTime'])
        event_name = host_user_data.get('slotConfig', {}).get('eventName', 'Meeting')

        event_body = {
            'summary': f"{event_name} ({req.bookerName})",
            'start': {'dateTime': slot_start_time.isoformat(), 'timeZone': str(slot_start_time.tzinfo)},
            'end': {'dateTime': slot_end_time.isoformat(), 'timeZone': str(slot_end_time.tzinfo)},
            'attendees': [
                {'email': req.bookerEmail},
                {'email': host_user_data.get('email')}
            ],
            'conferenceData': {
                'createRequest': {
                    'requestId': f"{req.slotId}-{req.bookerEmail}",
                    'conferenceSolutionKey': {'type': 'hangoutsMeet'}
                }
            },
            'reminders': {'useDefault': True},
        }

        created_event = service.events().insert(calendarId='primary', body=event_body, conferenceDataVersion=1).execute()

        # Step 4: Record the booking
        booking_id = created_event.get('id')
        db.collection('bookings').document(booking_id).set({
            'bookingId': booking_id,
            'hostUserId': host_user_id,
            'slotId': req.slotId,
            'bookerName': req.bookerName,
            'bookerEmail': req.bookerEmail,
            'googleMeetUrl': created_event.get('hangoutLink'),
            'createdAt': firestore.SERVER_TIMESTAMP
        })

        return {"message": "Booking successful!", "event_details": created_event}

    except (FileNotFoundError, ValueError) as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")


class UserRequest(BaseModel):
    user_id: str

# --- API Endpoints ---
@app.post("/api/user/me/slots")
def generate_user_slots(req: UserRequest):
    """
    Generates available time slots for a given user by fetching their Google Calendar.
    """
    if not db:
        raise HTTPException(status_code=500, detail="Firestore client not available.")

    # In a real app, user_id would come from a secure session/JWT, not the request body.
    user_ref = db.collection('users').document(req.user_id)
    user_doc = user_ref.get()

    if not user_doc.exists:
        raise HTTPException(status_code=404, detail="User not found.")

    user_data = user_doc.to_dict()
    
    # Decrypt tokens
    access_token = decrypt_token(user_data.get('encryptedAccessToken'))
    refresh_token = decrypt_token(user_data.get('encryptedRefreshToken'))

    if not access_token:
        raise HTTPException(status_code=400, detail="User has no access token.")

    # Rebuild credentials from stored tokens
    creds = Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri=client_config['web']['token_uri'],
        client_id=client_config['web']['client_id'],
        client_secret=client_config['web']['client_secret'],
        scopes=SCOPES
    )

    try:
        # Build the Google Calendar service
        service = build('calendar', 'v3', credentials=creds)

        # Define the time range for the next 3 weeks
        now = datetime.utcnow()
        time_min = now.isoformat() + 'Z'  # 'Z' indicates UTC time
        time_max = (now + timedelta(days=21)).isoformat() + 'Z'

        free_busy_body = {
            "timeMin": time_min,
            "timeMax": time_max,
            "timeZone": "UTC",
            "items": [{"id": "primary"}] # Check the user's primary calendar
        }

        # --- Step 1: Fetch busy intervals from Google Calendar ---
        results = service.freebusy().query(body=free_busy_body).execute()
        busy_intervals_raw = results['calendars']['primary']['busy']

        # --- Step 2: Define working hours and slot duration ---
        # TODO: Make this configurable per user
        working_hours = {
            'start': time(9, 0), 
            'end': time(17, 0)
        }
        # Weekdays: 0=Monday, 1=Tuesday, ..., 6=Sunday
        working_days = [0, 1, 2, 3, 4] 
        slot_duration = timedelta(minutes=30)
        user_timezone = pytz.timezone('Asia/Tokyo') # TODO: Make this configurable

        # --- Step 3: Parse busy intervals into datetime objects ---
        busy_times = []
        for interval in busy_intervals_raw:
            busy_times.append({
                'start': datetime.fromisoformat(interval['start']),
                'end': datetime.fromisoformat(interval['end'])
            })

        # --- Step 4: Generate all potential slots and filter them ---
        available_slots = []
        today = datetime.now(user_timezone).date()
        for i in range(21): # For the next 3 weeks
            current_day = today + timedelta(days=i)
            
            # Skip non-working days
            if current_day.weekday() not in working_days:
                continue

            # Generate potential slots for the day
            day_start = user_timezone.localize(datetime.combine(current_day, working_hours['start']))
            day_end = user_timezone.localize(datetime.combine(current_day, working_hours['end']))
            
            potential_slot_start = day_start
            while potential_slot_start + slot_duration <= day_end:
                potential_slot_end = potential_slot_start + slot_duration
                
                # Check for overlap with busy times
                is_busy = False
                for busy in busy_times:
                    if potential_slot_start < busy['end'] and potential_slot_end > busy['start']:
                        is_busy = True
                        break
                
                # If not busy and the slot is in the future, add it
                if not is_busy and potential_slot_start > datetime.now(user_timezone):
                    available_slots.append({
                        'slotId': potential_slot_start.isoformat(), # Use start time as unique ID
                        'startTime': potential_slot_start.isoformat(),
                        'endTime': potential_slot_end.isoformat(),
                        'status': 'available'
                    })
                
                potential_slot_start += slot_duration

        # --- Step 5: Save the generated slots to Firestore ---
        slots_data = {
            'userId': req.user_id,
            'slots': available_slots,
            'updatedAt': firestore.SERVER_TIMESTAMP
        }
        db.collection('slots').document(req.user_id).set(slots_data)

        return {
            "message": f"Successfully generated and saved {len(available_slots)} available slots.",
            "user_id": req.user_id,
        }

    except HttpError as error:
        print(f'An error occurred: {error}')
        raise HTTPException(status_code=500, detail=f"Google Calendar API error: {error}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")

@app.get("/api/slots/public/{token}")
def get_public_slots(token: str):
    """
    Fetches available slots for a user via their public URL token.
    NOTE: This requires a Firestore index on the 'publicUrlToken' field.
    """
    if not db:
        raise HTTPException(status_code=500, detail="Firestore client not available.")

    try:
        # Query the users collection to find the user with the matching token
        users_ref = db.collection('users')
        query = users_ref.where(filter=firestore.FieldFilter("publicUrlToken", "==", token)).limit(1)
        results = list(query.stream())

        if not results:
            raise HTTPException(status_code=404, detail="Public booking page not found.")
        
        user_doc = results[0]
        user_id = user_doc.id

        # Fetch the slots for that user
        slots_ref = db.collection('slots').document(user_id)
        slots_doc = slots_ref.get()

        if not slots_doc.exists:
            return {"userName": user_doc.to_dict().get('email'), "slots": []}

        return {
            "userName": user_doc.to_dict().get('email'),
            "slots": slots_doc.to_dict().get('slots', [])
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {e}")


# --- API Endpoints ---
@app.get("/api/auth/login")
def auth_login():
    if not client_config:
        raise HTTPException(status_code=500, detail="Server is not configured for Google OAuth.")
    
    print(f"DEBUG: Using REDIRECT_URI: {REDIRECT_URI}")
    flow = Flow.from_client_config(client_config, scopes=SCOPES, redirect_uri=REDIRECT_URI)
    authorization_url, state = flow.authorization_url(
        access_type='offline', prompt='consent', include_granted_scopes='true')
    
    print(f"DEBUG: Generated Authorization URL: {authorization_url}")
    return {"authorization_url": authorization_url}

@app.get("/api/auth/callback")
def auth_callback(request: Request):
    if not all([client_config, db, f_key]):
        raise HTTPException(status_code=500, detail="Server is not properly configured.")

    flow = Flow.from_client_config(client_config, scopes=SCOPES, redirect_uri=REDIRECT_URI)
    try:
        flow.fetch_token(authorization_response=str(request.url))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch token: {e}")

    credentials = flow.credentials
    try:
        id_info = id_token.verify_oauth2_token(
            credentials.id_token, google_requests.Request(), GOOGLE_CLIENT_ID)
        
        user_id = id_info['sub']
        user_email = id_info.get('email')

        user_data = {
            'userId': user_id,
            'email': user_email,
            'encryptedAccessToken': encrypt_token(credentials.token),
            'updatedAt': firestore.SERVER_TIMESTAMP,
        }
        if credentials.refresh_token:
            user_data['encryptedRefreshToken'] = encrypt_token(credentials.refresh_token)
        
        user_ref = db.collection('users').document(user_id)
        if not user_ref.get().exists:
            user_data['createdAt'] = firestore.SERVER_TIMESTAMP
            user_data['publicUrlToken'] = base64.urlsafe_b64encode(os.urandom(16)).decode()
            user_data['slotConfig'] = {'durationMinutes': 30, 'eventName': 'Meeting'}

        user_ref.set(user_data, merge=True)
        print(f"Successfully saved user data for {user_email} to Firestore.")

    except ValueError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred during data processing: {e}")

    # In a real app, you would redirect the user back to the frontend with a session token.
    return RedirectResponse(url="http://localhost:3000")

# ... (Placeholder endpoints remain the same) ...