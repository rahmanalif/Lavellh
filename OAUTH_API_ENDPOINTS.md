# OAuth 2.0 API Endpoints

Complete list of authentication endpoints for the Lavellh application.

## Base URL
- **Development:** `http://localhost:5100/api/auth`
- **Production:** `https://yourdomain.com/api/auth`

---

## Google OAuth Endpoints

### Initiate Google Login
```http
GET /api/auth/google
```

**Description:** Redirects user to Google login page

**Response:** Redirects to Google OAuth consent screen

---

### Google Callback
```http
GET /api/auth/google/callback
```

**Description:** Google redirects here after authentication

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Authentication successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "fullName": "John Doe",
    "email": "john@example.com",
    "profilePicture": "https://lh3.googleusercontent.com/...",
    "userType": "user",
    "authProvider": "google",
    "isEmailVerified": true
  }
}
```

**Error Response (401 Unauthorized):**
```json
{
  "success": false,
  "message": "Google authentication failed"
}
```

---

## Facebook OAuth Endpoints

### Initiate Facebook Login
```http
GET /api/auth/facebook
```

**Description:** Redirects user to Facebook login page

**Response:** Redirects to Facebook OAuth consent screen

---

### Facebook Callback
```http
GET /api/auth/facebook/callback
```

**Description:** Facebook redirects here after authentication

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Authentication successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "fullName": "Jane Smith",
    "email": "jane@example.com",
    "profilePicture": "https://graph.facebook.com/.../picture",
    "userType": "user",
    "authProvider": "facebook",
    "isEmailVerified": true
  }
}
```

**Error Response (401 Unauthorized):**
```json
{
  "success": false,
  "message": "Facebook authentication failed"
}
```

---

## Apple OAuth Endpoints

### Initiate Apple Login
```http
POST /api/auth/apple
```

**Description:** Initiates Apple Sign In flow

**Response:** Redirects to Apple OAuth consent screen

---

### Apple Callback
```http
POST /api/auth/apple/callback
```

**Description:** Apple redirects here after authentication

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Authentication successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "fullName": "Bob Johnson",
    "email": "bob@privaterelay.appleid.com",
    "profilePicture": null,
    "userType": "user",
    "authProvider": "apple",
    "isEmailVerified": true
  }
}
```

**Error Response (401 Unauthorized):**
```json
{
  "success": false,
  "message": "Apple authentication failed"
}
```

---

## User Profile Endpoint

### Get Current User
```http
GET /api/auth/me
```

**Description:** Get currently authenticated user's profile

**Headers:**
```
Authorization: Bearer {jwt_token}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "fullName": "John Doe",
    "email": "john@example.com",
    "phoneNumber": null,
    "profilePicture": "https://...",
    "userType": "user",
    "authProvider": "google",
    "isEmailVerified": true,
    "isPhoneVerified": false,
    "createdAt": "2025-11-12T10:30:00.000Z"
  }
}
```

**Error Response (401 Unauthorized):**
```json
{
  "success": false,
  "message": "Not authorized to access this route"
}
```

---

## Logout Endpoint

### Logout User
```http
POST /api/auth/logout
```

**Description:** Logout user (client should delete the JWT token)

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Logged out successfully. Please delete your token on the client side."
}
```

---

## JWT Token Structure

The JWT token contains the following payload:

```json
{
  "id": "507f1f77bcf86cd799439011",
  "email": "john@example.com",
  "userType": "user",
  "authProvider": "google",
  "iat": 1699876543,
  "exp": 1700481343
}
```

---

## Using the JWT Token

Include the JWT token in the Authorization header for protected routes:

### Example Request
```javascript
fetch('http://localhost:5100/api/auth/me', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    'Content-Type': 'application/json'
  }
})
```

### Example with Axios
```javascript
axios.get('http://localhost:5100/api/auth/me', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
```

### Example with Fetch
```javascript
const response = await fetch('http://localhost:5100/api/auth/me', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  }
});
const data = await response.json();
```

---

## Authentication Flow

### 1. User Initiates OAuth Login
```
User clicks "Sign in with Google"
  ↓
Browser redirects to: GET /api/auth/google
  ↓
User is redirected to Google login page
```

### 2. User Authenticates with Provider
```
User enters credentials on Google
  ↓
User grants permissions
  ↓
Google redirects back to: GET /api/auth/google/callback
```

### 3. Server Processes Authentication
```
Server receives OAuth callback
  ↓
Server exchanges code for access token
  ↓
Server retrieves user profile from Google
  ↓
Server creates or updates user in database
  ↓
Server generates JWT token
  ↓
Server returns token + user data to client
```

### 4. Client Stores Token
```
Client receives JWT token
  ↓
Client stores token (localStorage, sessionStorage, or cookies)
  ↓
Client includes token in all subsequent API requests
```

---

## Error Codes

| Status Code | Description |
|------------|-------------|
| 200 | Success |
| 401 | Unauthorized (Invalid or missing token) |
| 403 | Forbidden (Valid token but insufficient permissions) |
| 404 | User not found |
| 500 | Server error |

---

## Rate Limiting

Consider implementing rate limiting on authentication endpoints to prevent abuse:

```javascript
// Example rate limit: 5 attempts per minute per IP
POST /api/auth/google - 5 requests/minute
POST /api/auth/facebook - 5 requests/minute
POST /api/auth/apple - 5 requests/minute
```

---

## Security Considerations

1. **HTTPS Only in Production:** Always use HTTPS in production
2. **Token Expiration:** JWT tokens expire after 7 days by default
3. **Secure Storage:** Store tokens securely (httpOnly cookies recommended)
4. **CORS Configuration:** Configure CORS to allow only trusted domains
5. **Refresh Tokens:** Consider implementing refresh tokens for long-lived sessions

---

## Testing with Postman

### 1. Test Google OAuth
1. Open browser
2. Navigate to: `http://localhost:5100/api/auth/google`
3. Complete Google login
4. Copy the returned JWT token

### 2. Test Protected Endpoint
1. Open Postman
2. Create new GET request to: `http://localhost:5100/api/auth/me`
3. Add header: `Authorization: Bearer YOUR_TOKEN_HERE`
4. Send request

---

## Frontend Integration Examples

### React Example
```jsx
const handleGoogleLogin = () => {
  // Redirect to backend OAuth endpoint
  window.location.href = 'http://localhost:5100/api/auth/google';
};

// Handle callback (store token)
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  if (token) {
    localStorage.setItem('authToken', token);
    // Redirect to dashboard or home
  }
}, []);
```

### React Native Example
```jsx
import { WebView } from 'react-native-webview';

const GoogleLoginScreen = () => {
  const handleNavigationStateChange = (navState) => {
    // Check if we're on the callback URL
    if (navState.url.includes('/auth/google/callback')) {
      // Extract token from response
      // Store in AsyncStorage
      // Navigate to home screen
    }
  };

  return (
    <WebView
      source={{ uri: 'http://localhost:5100/api/auth/google' }}
      onNavigationStateChange={handleNavigationStateChange}
    />
  );
};
```

---

## Common Issues

### Issue: "Redirect URI mismatch"
**Solution:** Ensure callback URLs in OAuth provider settings match your .env file exactly

### Issue: "Invalid client"
**Solution:** Double-check your Client ID/App ID in .env file

### Issue: Token not working
**Solution:** Ensure you're including "Bearer " prefix in Authorization header

### Issue: CORS errors
**Solution:** Configure CORS middleware to allow your frontend domain

---

For more details, see [OAUTH_SETUP_GUIDE.md](OAUTH_SETUP_GUIDE.md)
