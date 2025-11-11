# OAuth 2.0 Setup Guide for Lavellh

This guide will help you set up Google, Facebook, and Apple OAuth authentication for your Lavellh application.

## Table of Contents
1. [Google OAuth Setup](#google-oauth-setup)
2. [Facebook OAuth Setup](#facebook-oauth-setup)
3. [Apple OAuth Setup](#apple-oauth-setup)
4. [Testing Your OAuth Implementation](#testing-your-oauth-implementation)

---

## Google OAuth Setup

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a Project** → **New Project**
3. Enter project name (e.g., "Lavellh") and click **Create**

### Step 2: Enable Google+ API

1. In your project, go to **APIs & Services** → **Library**
2. Search for "Google+ API" and click on it
3. Click **Enable**

### Step 3: Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. If prompted, configure the OAuth consent screen:
   - User Type: **External**
   - App name: **Lavellh**
   - User support email: Your email
   - Developer contact: Your email
   - Add scopes: `userinfo.email`, `userinfo.profile`
4. Choose **Web application** as application type
5. Add authorized redirect URIs:
   - Development: `http://localhost:5100/api/auth/google/callback`
   - Production: `https://yourdomain.com/api/auth/google/callback`
6. Click **Create**
7. Copy the **Client ID** and **Client Secret**

### Step 4: Update .env File

```env
GOOGLE_CLIENT_ID=your_actual_google_client_id_here
GOOGLE_CLIENT_SECRET=your_actual_google_client_secret_here
GOOGLE_CALLBACK_URL=http://localhost:5100/api/auth/google/callback
```

---

## Facebook OAuth Setup

### Step 1: Create a Facebook App

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Click **My Apps** → **Create App**
3. Select **Consumer** as the app type
4. Enter app name: **Lavellh**
5. Enter contact email
6. Click **Create App**

### Step 2: Add Facebook Login Product

1. In your app dashboard, click **Add Product**
2. Find **Facebook Login** and click **Set Up**
3. Choose **Web** as the platform
4. Enter your site URL: `http://localhost:5100` (for development)

### Step 3: Configure OAuth Settings

1. Go to **Facebook Login** → **Settings**
2. Add **Valid OAuth Redirect URIs**:
   - Development: `http://localhost:5100/api/auth/facebook/callback`
   - Production: `https://yourdomain.com/api/auth/facebook/callback`
3. Click **Save Changes**

### Step 4: Get App Credentials

1. Go to **Settings** → **Basic**
2. Copy your **App ID** and **App Secret**

### Step 5: Update .env File

```env
FACEBOOK_APP_ID=your_actual_facebook_app_id_here
FACEBOOK_APP_SECRET=your_actual_facebook_app_secret_here
FACEBOOK_CALLBACK_URL=http://localhost:5100/api/auth/facebook/callback
```

### Step 6: Make App Live

1. Toggle the app from **Development** to **Live** mode in the top header
2. You may need to complete App Review for certain permissions

---

## Apple OAuth Setup

Apple Sign In is more complex than Google and Facebook. Here's how to set it up:

### Step 1: Create an App ID

1. Go to [Apple Developer Portal](https://developer.apple.com/account/)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Click **Identifiers** → **+** button
4. Select **App IDs** → **Continue**
5. Select **App** → **Continue**
6. Fill in:
   - Description: **Lavellh**
   - Bundle ID: e.g., `com.yourcompany.lavellh`
7. Enable **Sign in with Apple** capability
8. Click **Continue** → **Register**

### Step 2: Create a Services ID

1. Click **Identifiers** → **+** button
2. Select **Services IDs** → **Continue**
3. Fill in:
   - Description: **Lavellh Web Service**
   - Identifier: e.g., `com.yourcompany.lavellh.service`
4. Enable **Sign in with Apple**
5. Click **Configure** next to Sign in with Apple
6. Primary App ID: Select the App ID you created in Step 1
7. Add domains and return URLs:
   - Domains: `localhost` (development), `yourdomain.com` (production)
   - Return URLs:
     - Development: `http://localhost:5100/api/auth/apple/callback`
     - Production: `https://yourdomain.com/api/auth/apple/callback`
8. Click **Save** → **Continue** → **Register**

### Step 3: Create a Private Key

1. Go to **Keys** → **+** button
2. Enter Key Name: **Lavellh Apple Sign In Key**
3. Enable **Sign in with Apple**
4. Click **Configure** → Select your Primary App ID
5. Click **Save** → **Continue** → **Register**
6. Download the key file (`.p8` file) - **IMPORTANT: You can only download this once!**
7. Note the **Key ID** (10-character string)

### Step 4: Get Your Team ID

1. Go to your [Apple Developer Account](https://developer.apple.com/account/)
2. Your **Team ID** is displayed at the top right (10-character string)

### Step 5: Convert Private Key

The private key needs to be in a specific format. Open the `.p8` file you downloaded:

```
-----BEGIN PRIVATE KEY-----
MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg...
(multiple lines)
...aBCD1234
-----END PRIVATE KEY-----
```

### Step 6: Update .env File

```env
APPLE_SERVICE_ID=com.yourcompany.lavellh.service
APPLE_TEAM_ID=YOUR10CHARTEAMID
APPLE_KEY_ID=YOUR10CHARKEYID
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg...\n-----END PRIVATE KEY-----"
APPLE_CALLBACK_URL=http://localhost:5100/api/auth/apple/callback
```

**Note:** For the private key, replace newlines with `\n` in the .env file, or use a multi-line string if your environment supports it.

---

## Testing Your OAuth Implementation

### Available Endpoints

Once configured, your application will have these OAuth endpoints:

#### Google OAuth
- **Initiate:** `GET http://localhost:5100/api/auth/google`
- **Callback:** `GET http://localhost:5100/api/auth/google/callback`

#### Facebook OAuth
- **Initiate:** `GET http://localhost:5100/api/auth/facebook`
- **Callback:** `GET http://localhost:5100/api/auth/facebook/callback`

#### Apple OAuth
- **Initiate:** `POST http://localhost:5100/api/auth/apple`
- **Callback:** `POST http://localhost:5100/api/auth/apple/callback`

### How to Test

1. **Start your server:**
   ```bash
   npm start
   ```

2. **Test Google OAuth:**
   - Navigate to: `http://localhost:5100/api/auth/google`
   - You'll be redirected to Google login
   - After successful login, you'll receive a JWT token

3. **Test Facebook OAuth:**
   - Navigate to: `http://localhost:5100/api/auth/facebook`
   - You'll be redirected to Facebook login
   - After successful login, you'll receive a JWT token

4. **Test Apple OAuth:**
   - Apple Sign In requires a POST request with specific headers
   - Use a tool like Postman or implement the Sign in with Apple button on your frontend

### Expected Response

On successful authentication, all providers will return:

```json
{
  "success": true,
  "message": "Authentication successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "fullName": "John Doe",
    "email": "john@example.com",
    "profilePicture": "https://...",
    "userType": "user",
    "authProvider": "google",
    "isEmailVerified": true
  }
}
```

### Using the JWT Token

Include the token in subsequent requests:

```javascript
fetch('http://localhost:5100/api/auth/me', {
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN_HERE'
  }
})
```

---

## Frontend Integration Example

### React/React Native Example

```javascript
// Google Sign In
const handleGoogleLogin = () => {
  window.location.href = 'http://localhost:5100/api/auth/google';
};

// Facebook Sign In
const handleFacebookLogin = () => {
  window.location.href = 'http://localhost:5100/api/auth/facebook';
};

// Apple Sign In (requires Apple's JS SDK)
const handleAppleLogin = () => {
  // Use Apple's Sign In JS library
  // Documentation: https://developer.apple.com/documentation/sign_in_with_apple/sign_in_with_apple_js
};
```

---

## Security Best Practices

1. **Never commit your `.env` file** to version control
2. Use different credentials for development and production
3. Enable HTTPS in production
4. Set `secure: true` in session cookies for production
5. Regularly rotate your OAuth secrets
6. Implement rate limiting on authentication endpoints
7. Monitor for suspicious authentication attempts

---

## Troubleshooting

### Common Issues

1. **"Redirect URI mismatch" error:**
   - Ensure the callback URL in your OAuth provider settings exactly matches the one in your `.env` file
   - Check for `http` vs `https` and trailing slashes

2. **"Invalid client" error:**
   - Verify your Client ID/App ID is correct
   - Ensure your app is in "Live" mode (Facebook)

3. **Apple authentication not working:**
   - Ensure the private key format is correct
   - Verify all IDs (Service ID, Team ID, Key ID) are accurate
   - Apple Sign In requires HTTPS in production

4. **Session issues:**
   - Make sure `SESSION_SECRET` is set in your `.env` file
   - Check that express-session is properly configured

---

## Additional Resources

- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Facebook Login Documentation](https://developers.facebook.com/docs/facebook-login)
- [Apple Sign In Documentation](https://developer.apple.com/sign-in-with-apple/)
- [Passport.js Documentation](http://www.passportjs.org/)

---

## Need Help?

If you encounter issues, check:
1. Server logs for detailed error messages
2. Browser console for client-side errors
3. OAuth provider dashboards for configuration issues

Good luck with your OAuth implementation! 🚀
