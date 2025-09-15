import os
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import jwt
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"

# This will look for a token in the "Authorization: Bearer <token>" header
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token") 

def get_current_user(token: str = Depends(oauth2_scheme)):
    """
    Decodes the JWT token to get the user ID.
    
    Args:
        token: The JWT token from the Authorization header.
        
    Returns:
        The user ID (sub) from the token payload.
        
    Raises:
        HTTPException: If the token is invalid or expired.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        if SECRET_KEY is None:
            raise ValueError("SECRET_KEY is not set in the environment.")
            
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], leeway=10) # Add 10-second leeway for clock skew
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        return user_id
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.PyJWTError:
        raise credentials_exception
    except ValueError as e:
        # Handle the case where SECRET_KEY is not set
        print(f"CRITICAL: Error during token decoding - {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server configuration error",
        )

