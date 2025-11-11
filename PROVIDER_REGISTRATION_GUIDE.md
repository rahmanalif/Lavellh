# Provider Registration System - Implementation Guide

## Overview

This guide covers the complete provider registration and login system with **ID card OCR validation**. The system automatically extracts and validates information from government-issued ID cards using Optical Character Recognition (OCR).

---

## Features

### Registration Features
- ✅ Full name, email, password validation
- ✅ ID card front and back photo upload
- ✅ **OCR-based data extraction** from ID cards
- ✅ **Automated validation** of extracted data
- ✅ Age verification (must be 18+)
- ✅ ID expiry date checking
- ✅ Duplicate ID number prevention
- ✅ Optional occupation field
- ✅ Optional reference ID field
- ✅ Real-time image preview
- ✅ Password strength indicator

### Login Features
- ✅ Login with email OR phone number
- ✅ Provider-specific authentication
- ✅ Verification status checking
- ✅ Remember me functionality
- ✅ JWT token-based authentication

### OCR Validation
The system automatically extracts and validates:
- **From Front**: Full name, ID number, date of birth, nationality, gender, issue date, expiry date
- **From Back**: Address, blood group, emergency contact, additional information

---

## Architecture

### New Files Created

#### Backend Files
1. **`src/models/Provider.js`** - Provider data model with ID verification fields
2. **`src/utility/ocrService.js`** - OCR service for ID card processing and validation
3. **`src/middleware/upload.js`** - File upload middleware using Multer
4. **`src/controllers/providerController.js`** - Provider registration, login, and profile management
5. **`src/routes/provider.routes.js`** - API routes for provider endpoints

#### Frontend Files
1. **`public/provider-register.html`** - Provider registration form with file upload
2. **`public/provider-login.html`** - Provider login form

#### Modified Files
1. **`src/routes/index.js`** - Added provider routes
2. **`package.json`** - Added new dependencies

---

## API Endpoints

### Provider Registration
```
POST /api/providers/register
Content-Type: multipart/form-data
```

**Request Body (FormData):**
```javascript
{
  fullName: string (required)
  email: string (required)
  phoneNumber: string (optional)
  password: string (required, min 6 chars)
  confirmPassword: string (required)
  occupation: string (optional)
  referenceId: string (optional)
  idCardFront: file (required, image/jpeg|png|webp, max 5MB)
  idCardBack: file (required, image/jpeg|png|webp, max 5MB)
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Provider registration successful. Your account is pending verification.",
  "data": {
    "user": {
      "id": "user_id",
      "fullName": "John Doe",
      "email": "john@example.com",
      "phoneNumber": "+1234567890",
      "userType": "provider",
      "authProvider": "local"
    },
    "provider": {
      "id": "provider_id",
      "verificationStatus": "pending",
      "occupation": "Plumber",
      "referenceId": "REF123",
      "extractedIdData": {
        "fullName": "JOHN DOE",
        "idNumber": "1234567890",
        "dateOfBirth": "1990-01-01T00:00:00.000Z",
        "nationality": "UNITED STATES"
      }
    },
    "token": "jwt_token_here"
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "ID card validation failed",
  "errors": [
    "Could not extract ID number from ID card",
    "ID card has expired"
  ],
  "extractedData": {
    "front": { ... },
    "back": { ... }
  }
}
```

### Provider Login
```
POST /api/providers/login
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "john@example.com",  // OR phoneNumber
  "password": "password123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "user_id",
      "fullName": "John Doe",
      "email": "john@example.com",
      "phoneNumber": "+1234567890",
      "userType": "provider",
      "isEmailVerified": false,
      "isPhoneVerified": false,
      "profilePicture": null
    },
    "provider": {
      "id": "provider_id",
      "verificationStatus": "pending",
      "occupation": "Plumber",
      "rating": 0,
      "totalReviews": 0,
      "completedJobs": 0,
      "isAvailable": true
    },
    "token": "jwt_token_here"
  }
}
```

### Get Provider Profile
```
GET /api/providers/me
Authorization: Bearer <token>
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "provider": {
      "_id": "provider_id",
      "userId": { ... },
      "idCard": {
        "frontImage": "filename.jpg",
        "backImage": "filename.jpg",
        "idNumber": "1234567890",
        "fullNameOnId": "JOHN DOE",
        "dateOfBirth": "1990-01-01T00:00:00.000Z",
        "nationality": "UNITED STATES",
        "address": "123 Main St, City, State"
      },
      "verificationStatus": "pending",
      "occupation": "Plumber",
      "rating": 4.5,
      "totalReviews": 10,
      "completedJobs": 25
    }
  }
}
```

### Update Provider Profile
```
PUT /api/providers/me
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "occupation": "Senior Plumber",
  "servicesOffered": ["Plumbing", "Pipe Repair", "Installation"],
  "isAvailable": true
}
```

---

## Database Schema

### Provider Model
```javascript
{
  userId: ObjectId (ref: User),
  idCard: {
    frontImage: String,        // Filename of uploaded image
    backImage: String,          // Filename of uploaded image
    idNumber: String,           // Extracted from OCR
    fullNameOnId: String,       // Extracted from OCR
    dateOfBirth: Date,          // Extracted from OCR
    expiryDate: Date,           // Extracted from OCR
    issuedDate: Date,           // Extracted from OCR
    nationality: String,        // Extracted from OCR
    address: String             // Extracted from OCR
  },
  verificationStatus: String,   // 'pending', 'approved', 'rejected'
  idVerifiedAt: Date,
  verificationNotes: String,
  occupation: String,
  referenceId: String,
  servicesOffered: [String],
  rating: Number,
  totalReviews: Number,
  isAvailable: Boolean,
  completedJobs: Number,
  createdAt: Date,
  updatedAt: Date
}
```

---

## OCR Service Details

### How It Works

1. **Image Preprocessing**
   - Convert to grayscale
   - Normalize contrast
   - Sharpen image
   - Resize to optimal dimensions (1200px width)

2. **Text Extraction**
   - Uses Tesseract.js OCR engine
   - Extracts raw text from both sides of ID

3. **Data Parsing**
   - Uses regex patterns to extract specific fields
   - Handles multiple date formats
   - Normalizes extracted data

4. **Validation**
   - Verifies age (must be 18+)
   - Checks ID expiry date
   - Validates ID number format
   - Ensures required fields are present

### Supported ID Card Formats

The OCR service is designed to work with most government-issued ID cards that follow standard formats:
- National ID cards
- Driver's licenses
- Passport cards
- Residence permits

**Note:** Different countries have different ID formats. You may need to adjust the regex patterns in `src/utility/ocrService.js` for your specific country's ID card format.

### Customizing OCR Patterns

To customize for your country's ID format, edit `src/utility/ocrService.js`:

```javascript
// Example: Customize ID number pattern
const idPatterns = [
  /YOUR_CUSTOM_PATTERN_HERE/i,
  /(?:ID\s*(?:NO|NUMBER)?[\s:]*)?(\d{8,20})/i,
];
```

---

## Installation & Setup

### 1. Install Dependencies

The following packages have been installed:
```bash
npm install multer sharp tesseract.js
```

**Dependencies:**
- `multer` - File upload handling
- `sharp` - Image processing and optimization
- `tesseract.js` - OCR engine for text extraction

### 2. Environment Variables

No new environment variables are required. The existing configuration works with the new provider system.

### 3. File Storage

Uploaded ID card images are stored in:
```
uploads/id-cards/
```

This directory is automatically created when the server starts.

**⚠️ Security Note:** Add `/uploads` to your `.gitignore` to prevent committing sensitive ID card images.

### 4. Start the Server

```bash
npm run dev
```

### 5. Access the Frontend

- **Registration:** `http://localhost:5100/provider-register.html`
- **Login:** `http://localhost:5100/provider-login.html`

---

## Testing the System

### Manual Testing Steps

#### 1. Test Provider Registration

1. Navigate to `http://localhost:5100/provider-register.html`
2. Fill in the form:
   - Full Name: John Doe
   - Email: john.doe@example.com
   - Password: password123
   - Confirm Password: password123
   - Upload clear photos of both sides of an ID card
   - (Optional) Occupation: Plumber
   - (Optional) Reference ID: REF123
3. Click "Register as Provider"
4. Check the console for OCR processing logs
5. Verify the response contains extracted data

#### 2. Test Provider Login

1. Navigate to `http://localhost:5100/provider-login.html`
2. Enter email and password
3. Click "Login"
4. Check localStorage for stored token

#### 3. Test API with Postman/cURL

**Registration:**
```bash
curl -X POST http://localhost:5100/api/providers/register \
  -F "fullName=John Doe" \
  -F "email=john.doe@example.com" \
  -F "password=password123" \
  -F "confirmPassword=password123" \
  -F "occupation=Plumber" \
  -F "idCardFront=@/path/to/id-front.jpg" \
  -F "idCardBack=@/path/to/id-back.jpg"
```

**Login:**
```bash
curl -X POST http://localhost:5100/api/providers/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "password": "password123"
  }'
```

**Get Profile:**
```bash
curl -X GET http://localhost:5100/api/providers/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Validation Rules

### Registration Validation

| Field | Rule |
|-------|------|
| Full Name | Required, 2-100 characters |
| Email | Required, valid email format |
| Password | Required, minimum 6 characters |
| Confirm Password | Must match password |
| ID Card Front | Required, image file (JPEG/PNG/WebP), max 5MB |
| ID Card Back | Required, image file (JPEG/PNG/WebP), max 5MB |
| Phone Number | Optional, valid phone format |
| Occupation | Optional, max 100 characters |
| Reference ID | Optional |

### OCR Validation

| Extracted Field | Validation |
|----------------|------------|
| Full Name | Must be present |
| ID Number | Must be present, min 8 characters |
| Date of Birth | Must be present, age must be 18+ |
| Expiry Date | If present, must not be expired |
| Nationality | Optional |
| Address | Optional |

---

## Error Handling

### Common Errors

**1. File Upload Errors**
```json
{
  "success": false,
  "message": "File size is too large. Maximum size is 5MB."
}
```

**2. OCR Processing Errors**
```json
{
  "success": false,
  "message": "Failed to process ID card front image",
  "error": "Image format not supported"
}
```

**3. Validation Errors**
```json
{
  "success": false,
  "message": "ID card validation failed",
  "errors": [
    "Could not extract full name from ID card",
    "Provider must be at least 18 years old",
    "ID card has expired"
  ]
}
```

**4. Duplicate Registration**
```json
{
  "success": false,
  "message": "A provider with this ID number is already registered"
}
```

---

## Security Considerations

### 1. File Upload Security
- ✅ File type validation (only images)
- ✅ File size limit (5MB)
- ✅ Unique filename generation
- ✅ Stored outside public directory

### 2. Data Protection
- ✅ Passwords hashed with bcrypt (12 rounds)
- ✅ JWT token-based authentication
- ✅ Sensitive fields excluded from API responses
- ✅ ID card data encrypted at rest (MongoDB)

### 3. Validation
- ✅ Input sanitization
- ✅ Email/phone uniqueness checks
- ✅ ID number uniqueness checks
- ✅ Age verification
- ✅ Expiry date checking

### 4. Best Practices
- Add `/uploads` to `.gitignore`
- Use HTTPS in production
- Implement rate limiting for registration endpoint
- Add CAPTCHA for registration form
- Implement file virus scanning (optional)
- Use cloud storage (S3, Cloudinary) for production

---

## Production Deployment

### 1. Environment Variables

Update your production `.env`:
```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://...your-production-db...
JWT_SECRET=...very-long-random-secret...
```

### 2. File Storage

For production, consider using cloud storage:

**Option A: AWS S3**
```bash
npm install aws-sdk multer-s3
```

**Option B: Cloudinary**
```bash
npm install cloudinary multer-storage-cloudinary
```

Update `src/middleware/upload.js` to use cloud storage instead of local filesystem.

### 3. OCR Performance

For better OCR performance in production:

**Option A: Google Cloud Vision API** (paid, more accurate)
```bash
npm install @google-cloud/vision
```

**Option B: AWS Textract** (paid, more accurate)
```bash
npm install aws-sdk
```

Update `src/utility/ocrService.js` to use cloud OCR service.

### 4. Security Headers

Add helmet for security headers:
```bash
npm install helmet
```

```javascript
// server.js
const helmet = require('helmet');
app.use(helmet());
```

---

## Future Enhancements

### Recommended Features

1. **Admin Dashboard**
   - View pending provider verifications
   - Approve/reject providers manually
   - View extracted ID card data
   - Edit provider information

2. **Email Notifications**
   - Send verification status updates
   - Welcome email after approval
   - Rejection notification with reason

3. **Document Management**
   - Allow providers to update expired ID cards
   - Store multiple document versions
   - Document expiry reminders

4. **Enhanced OCR**
   - Support for multiple languages
   - Machine learning-based validation
   - Confidence scoring for extracted data
   - Manual review for low-confidence extractions

5. **Verification Workflow**
   - Multi-step verification process
   - Background check integration
   - Reference verification
   - Video call verification

6. **Provider Features**
   - Profile completion percentage
   - Service area selection
   - Availability calendar
   - Portfolio/gallery upload

---

## Troubleshooting

### Issue: OCR Not Extracting Data

**Possible Causes:**
- Image quality too low
- ID card not in English
- Unusual ID card format

**Solutions:**
1. Preprocess image more aggressively
2. Adjust OCR language setting
3. Customize regex patterns for your country
4. Use cloud OCR service (Google Vision, AWS Textract)

### Issue: File Upload Fails

**Possible Causes:**
- File too large
- Wrong file format
- Disk space full

**Solutions:**
1. Check file size limit in `upload.js`
2. Verify allowed MIME types
3. Ensure `/uploads` directory is writable

### Issue: Registration Succeeds but No Data Extracted

**Possible Causes:**
- OCR failed silently
- Validation too strict

**Solutions:**
1. Check server logs for OCR errors
2. Relax validation rules for testing
3. Return raw OCR text in API response for debugging

---

## Support & Contact

For issues or questions:
1. Check server logs: `npm run dev`
2. Enable OCR logging in `ocrService.js`
3. Test with sample ID cards
4. Review API response for validation errors

---

## API Testing Collection

### Postman Collection

```json
{
  "info": {
    "name": "Provider Registration API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Register Provider",
      "request": {
        "method": "POST",
        "url": "http://localhost:5100/api/providers/register",
        "body": {
          "mode": "formdata",
          "formdata": [
            {"key": "fullName", "value": "John Doe", "type": "text"},
            {"key": "email", "value": "john@example.com", "type": "text"},
            {"key": "password", "value": "password123", "type": "text"},
            {"key": "confirmPassword", "value": "password123", "type": "text"},
            {"key": "occupation", "value": "Plumber", "type": "text"},
            {"key": "idCardFront", "type": "file"},
            {"key": "idCardBack", "type": "file"}
          ]
        }
      }
    },
    {
      "name": "Login Provider",
      "request": {
        "method": "POST",
        "url": "http://localhost:5100/api/providers/login",
        "header": [
          {"key": "Content-Type", "value": "application/json"}
        ],
        "body": {
          "mode": "raw",
          "raw": "{\"email\":\"john@example.com\",\"password\":\"password123\"}"
        }
      }
    },
    {
      "name": "Get Provider Profile",
      "request": {
        "method": "GET",
        "url": "http://localhost:5100/api/providers/me",
        "header": [
          {"key": "Authorization", "value": "Bearer {{token}}"}
        ]
      }
    }
  ]
}
```

---

## Conclusion

The provider registration system is now fully implemented with:
- ✅ OCR-based ID card validation
- ✅ Secure file upload
- ✅ Comprehensive validation
- ✅ User-friendly frontend
- ✅ RESTful API
- ✅ JWT authentication

The system is ready for testing and can be extended with additional features as needed.
