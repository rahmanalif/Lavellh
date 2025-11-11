# OAuth 2.0 Quick Reference Card

Quick reference for OAuth implementation in Lavellh.

## Environment Variables Needed

```env
# Google
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5100/api/auth/google/callback

# Facebook
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
FACEBOOK_CALLBACK_URL=http://localhost:5100/api/auth/facebook/callback

# Apple
APPLE_SERVICE_ID=your_apple_service_id
APPLE_TEAM_ID=your_apple_team_id
APPLE_KEY_ID=your_apple_key_id
APPLE_PRIVATE_KEY=your_apple_private_key
APPLE_CALLBACK_URL=http://localhost:5100/api/auth/apple/callback

# Session
SESSION_SECRET=your_session_secret
```

## Quick Test URLs

- **Google:** http://localhost:5100/api/auth/google
- **Facebook:** http://localhost:5100/api/auth/facebook
- **Test Page:** Open `test-oauth.html` in browser

## Files Modified/Created

### Created Files
1. `src/config/passport.js` - Passport configuration with all strategies
2. `src/routes/auth.oauth.routes.js` - OAuth authentication routes
3. `OAUTH_SETUP_GUIDE.md` - Detailed setup instructions
4. `OAUTH_API_ENDPOINTS.md` - API documentation
5. `test-oauth.html` - Test page for OAuth
6. `OAUTH_QUICK_REFERENCE.md` - This file

### Modified Files
1. `src/models/User.js` - Added OAuth support fields
2. `src/routes/index.js` - Integrated OAuth routes
3. `server.js` - Added Passport middleware
4. `.env` - Added OAuth credentials

## User Model Changes

New fields added:
- `authProvider` - 'local', 'google', 'facebook', or 'apple'
- `providerId` - OAuth provider's user ID
- `profilePicture` - User's profile picture URL

## How Users Are Created

### Google/Facebook
1. User clicks "Sign in with Google/Facebook"
2. Redirected to provider's login page
3. After authentication, provider sends user data
4. Server checks if user exists by `providerId`
5. If not, checks by email
6. Creates new user or returns existing user
7. Generates JWT token
8. Returns token + user data

### Apple
Similar to Google/Facebook but uses POST instead of GET

## Testing Checklist

- [ ] Install dependencies: `npm install`
- [ ] Configure OAuth credentials in `.env`
- [ ] Start server: `npm start`
- [ ] Open `test-oauth.html` in browser
- [ ] Test Google OAuth
- [ ] Test Facebook OAuth
- [ ] Test Apple OAuth (requires additional setup)
- [ ] Verify JWT token is returned
- [ ] Test `/api/auth/me` endpoint with token

## Frontend Integration

### HTML Button Example
```html
<a href="http://localhost:5100/api/auth/google">
  Sign in with Google
</a>
```

### JavaScript Example
```javascript
// Redirect to OAuth
window.location.href = 'http://localhost:5100/api/auth/google';

// After callback, store token
localStorage.setItem('token', response.token);

// Use token in requests
fetch('/api/auth/me', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  }
});
```

## Common Commands

```bash
# Install dependencies
npm install

# Start server
npm start

# Check logs
# Server will log OAuth attempts and errors
```

## Token Usage

Include in Authorization header:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Troubleshooting Quick Fixes

| Problem | Solution |
|---------|----------|
| Redirect URI mismatch | Check callback URLs match exactly |
| Invalid client | Verify Client ID in .env |
| 404 on callback | Ensure server is running |
| CORS error | Add frontend domain to CORS config |
| Token invalid | Check JWT_SECRET is set |

## Production Checklist

- [ ] Use HTTPS
- [ ] Update callback URLs to production domain
- [ ] Set `NODE_ENV=production`
- [ ] Use secure session cookies
- [ ] Enable rate limiting
- [ ] Set up monitoring
- [ ] Rotate secrets regularly

## Support Links

- [Full Setup Guide](OAUTH_SETUP_GUIDE.md)
- [API Documentation](OAUTH_API_ENDPOINTS.md)
- [Google Console](https://console.cloud.google.com)
- [Facebook Developers](https://developers.facebook.com)
- [Apple Developer](https://developer.apple.com)

---

**Last Updated:** 2025-11-12
