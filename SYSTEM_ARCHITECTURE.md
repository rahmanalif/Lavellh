# Provider Registration System - Architecture

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                           FRONTEND LAYER                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌────────────────────────┐      ┌────────────────────────┐        │
│  │  provider-register.html│      │  provider-login.html   │        │
│  │                        │      │                        │        │
│  │  • Registration Form   │      │  • Login Form          │        │
│  │  • File Upload UI      │      │  • Email/Phone Switch  │        │
│  │  • Image Preview       │      │  • Remember Me         │        │
│  │  • Password Strength   │      │  • Validation          │        │
│  └────────┬───────────────┘      └──────────┬─────────────┘        │
│           │                                  │                       │
└───────────┼──────────────────────────────────┼───────────────────────┘
            │                                  │
            │ FormData (multipart)             │ JSON
            │ POST /api/providers/register     │ POST /api/providers/login
            │                                  │
┌───────────▼──────────────────────────────────▼───────────────────────┐
│                         API LAYER (Express.js)                        │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Routes: src/routes/provider.routes.js                          │ │
│  │                                                                  │ │
│  │  POST   /api/providers/register                                │ │
│  │  POST   /api/providers/login                                   │ │
│  │  GET    /api/providers/me           [Protected]                │ │
│  │  PUT    /api/providers/me           [Protected]                │ │
│  └────────┬─────────────────────────────────────────────────────┬─┘ │
│           │                                                       │   │
│           │ Uses Middleware                                       │   │
│           │                                                       │   │
│  ┌────────▼───────────────┐         ┌────────────────────────────▼┐ │
│  │  upload.js (Multer)    │         │  auth.js (JWT)              │ │
│  │                        │         │                             │ │
│  │  • File validation     │         │  • Token verification       │ │
│  │  • Size limit (5MB)    │         │  • User authentication      │ │
│  │  • Type checking       │         │  • Request protection       │ │
│  │  • Storage config      │         │                             │ │
│  └────────┬───────────────┘         └─────────────────────────────┘ │
│           │                                                           │
│           │ Uploads files to                                          │
│           │                                                           │
│  ┌────────▼───────────────┐                                          │
│  │  uploads/id-cards/     │                                          │
│  │                        │                                          │
│  │  • ID card front       │                                          │
│  │  • ID card back        │                                          │
│  └────────────────────────┘                                          │
│                                                                       │
└───────────┬───────────────────────────────────────────────────────────┘
            │
            │ Controller processes request
            │
┌───────────▼───────────────────────────────────────────────────────────┐
│                    BUSINESS LOGIC LAYER                               │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  Controller: src/controllers/providerController.js              │ │
│  │                                                                  │ │
│  │  registerProvider()                                             │ │
│  │  ├─ Validate input                                              │ │
│  │  ├─ Process ID card images ──────┐                             │ │
│  │  ├─ Check duplicates              │                             │ │
│  │  ├─ Create User & Provider        │                             │ │
│  │  └─ Generate JWT token            │                             │ │
│  │                                   │                             │ │
│  │  loginProvider()                  │                             │ │
│  │  ├─ Find user                     │                             │ │
│  │  ├─ Verify password               │                             │ │
│  │  ├─ Check verification status     │                             │ │
│  │  └─ Generate JWT token            │                             │ │
│  └───────────────────────────────────┼─────────────────────────────┘ │
│                                      │                               │
│                                      │ Calls OCR Service             │
│                                      │                               │
│  ┌───────────────────────────────────▼─────────────────────────────┐ │
│  │  OCR Service: src/utility/ocrService.js                          │ │
│  │                                                                  │ │
│  │  processIdCardFront(imagePath)                                  │ │
│  │  ├─ preprocessImage()              (sharp)                      │ │
│  │  │  ├─ Grayscale conversion                                     │ │
│  │  │  ├─ Normalize contrast                                       │ │
│  │  │  ├─ Sharpen image                                            │ │
│  │  │  └─ Resize to 1200px                                         │ │
│  │  ├─ Tesseract.recognize()          (tesseract.js)               │ │
│  │  ├─ extractFrontData()             (regex parsing)              │ │
│  │  │  ├─ Extract ID number                                        │ │
│  │  │  ├─ Extract full name                                        │ │
│  │  │  ├─ Extract date of birth                                    │ │
│  │  │  ├─ Extract nationality                                      │ │
│  │  │  ├─ Extract gender                                           │ │
│  │  │  └─ Extract issue/expiry dates                               │ │
│  │  └─ validateFrontData()                                         │ │
│  │     ├─ Check age >= 18                                          │ │
│  │     ├─ Check ID not expired                                     │ │
│  │     └─ Verify required fields                                   │ │
│  │                                                                  │ │
│  │  processIdCardBack(imagePath)                                   │ │
│  │  ├─ preprocessImage()                                           │ │
│  │  ├─ Tesseract.recognize()                                       │ │
│  │  ├─ extractBackData()                                           │ │
│  │  │  ├─ Extract address                                          │ │
│  │  │  ├─ Extract blood group                                      │ │
│  │  │  └─ Extract emergency contact                                │ │
│  │  └─ validateBackData()                                          │ │
│  │                                                                  │ │
│  │  verifyIdCardMatch()                                            │ │
│  │  └─ Verify front & back belong to same ID                       │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                       │
└───────────┬───────────────────────────────────────────────────────────┘
            │
            │ Store data in database
            │
┌───────────▼───────────────────────────────────────────────────────────┐
│                       DATA LAYER (MongoDB)                            │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────┐      ┌──────────────────────────────┐  │
│  │  User Collection        │      │  Provider Collection         │  │
│  │  (src/models/User.js)   │      │  (src/models/Provider.js)    │  │
│  │                         │      │                              │  │
│  │  • fullName             │◄─────┤  • userId (ref)              │  │
│  │  • email                │      │  • idCard                    │  │
│  │  • phoneNumber          │      │    ├─ frontImage             │  │
│  │  • password (hashed)    │      │    ├─ backImage              │  │
│  │  • userType: 'provider' │      │    ├─ idNumber               │  │
│  │  • authProvider: 'local'│      │    ├─ fullNameOnId           │  │
│  │  • isEmailVerified      │      │    ├─ dateOfBirth            │  │
│  │  • isPhoneVerified      │      │    ├─ nationality            │  │
│  │  • isActive             │      │    ├─ expiryDate             │  │
│  │  • createdAt            │      │    └─ address                │  │
│  │  • updatedAt            │      │  • verificationStatus        │  │
│  └─────────────────────────┘      │    ('pending'/'approved')    │  │
│                                   │  • occupation                │  │
│                                   │  • referenceId               │  │
│                                   │  • rating                    │  │
│                                   │  • totalReviews              │  │
│                                   │  • completedJobs             │  │
│                                   │  • isAvailable               │  │
│                                   └──────────────────────────────┘  │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow - Registration

```
1. User fills registration form
   └─> Uploads ID card front & back images
       ├─> File validation (type, size)
       └─> Preview shown to user

2. Form submitted to API
   └─> POST /api/providers/register (multipart/form-data)
       ├─> fullName, email, password
       └─> idCardFront, idCardBack files

3. Upload Middleware processes files
   └─> Multer saves files to uploads/id-cards/
       ├─> Validates file type (JPEG/PNG/WebP)
       ├─> Validates file size (max 5MB)
       └─> Generates unique filename

4. Controller processes registration
   └─> providerController.registerProvider()
       ├─> Validates input fields
       ├─> Calls OCR service for both images
       ├─> Validates extracted data
       └─> Checks for duplicates

5. OCR Service processes images
   └─> ocrService.processIdCardFront()
       ├─> Preprocesses image (grayscale, sharpen, resize)
       ├─> Runs Tesseract OCR
       ├─> Extracts structured data (name, ID#, DOB, etc.)
       └─> Validates data (age 18+, not expired)

   └─> ocrService.processIdCardBack()
       ├─> Preprocesses image
       ├─> Runs Tesseract OCR
       ├─> Extracts address, blood group, etc.
       └─> Validates data

6. Data stored in MongoDB
   └─> Create User document (userType: 'provider')
   └─> Create Provider document
       ├─> Links to User via userId
       ├─> Stores ID card filenames
       ├─> Stores extracted OCR data
       └─> Sets verificationStatus: 'pending'

7. JWT token generated
   └─> generateToken({ id, userType })
       └─> Returns token to client

8. Response sent to client
   └─> { success, message, data: { user, provider, token } }
       └─> Frontend stores token in localStorage
           └─> Redirects to provider dashboard
```

---

## Data Flow - Login

```
1. User enters credentials
   └─> Email or Phone + Password

2. Form submitted to API
   └─> POST /api/providers/login (JSON)
       └─> { email, password } OR { phoneNumber, password }

3. Controller processes login
   └─> providerController.loginProvider()
       ├─> Finds User by email/phone + userType: 'provider'
       ├─> Checks if account is active
       ├─> Verifies password (bcrypt.compare)
       ├─> Loads Provider profile
       └─> Checks verification status

4. JWT token generated
   └─> generateToken({ id, userType })

5. Response sent to client
   └─> { success, message, data: { user, provider, token } }
       └─> Frontend stores token in localStorage
           └─> Shows verification status if pending
               └─> Redirects to provider dashboard
```

---

## Security Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Security Layers                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Input Validation                                        │
│     ├─ Frontend: HTML5 validation                          │
│     ├─ Backend: Express validator                          │
│     └─ Database: Mongoose schema validation                │
│                                                             │
│  2. File Upload Security                                    │
│     ├─ File type whitelist (images only)                   │
│     ├─ File size limit (5MB)                               │
│     ├─ Unique filename generation                          │
│     ├─ Storage outside public directory                    │
│     └─ .gitignore to prevent commits                       │
│                                                             │
│  3. Authentication & Authorization                          │
│     ├─ Password hashing: bcrypt (12 rounds)                │
│     ├─ JWT token-based auth                                │
│     ├─ Token expiry (7 days default)                       │
│     └─ Protected routes require Bearer token               │
│                                                             │
│  4. Data Validation                                         │
│     ├─ Email/phone uniqueness                              │
│     ├─ ID number uniqueness                                │
│     ├─ Age verification (18+)                              │
│     ├─ ID expiry checking                                  │
│     └─ Password strength requirements                      │
│                                                             │
│  5. Data Protection                                         │
│     ├─ Passwords not returned in API responses             │
│     ├─ Sensitive fields excluded from queries              │
│     ├─ ID card images stored securely                      │
│     └─ MongoDB encryption at rest                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js 5.1.0
- **Database:** MongoDB with Mongoose 8.19.3
- **Authentication:** JWT (jsonwebtoken 9.0.2)
- **Password Hashing:** bcrypt.js 3.0.3
- **File Upload:** Multer 2.0.2
- **Image Processing:** Sharp 0.34.5
- **OCR Engine:** Tesseract.js 6.0.1

### Frontend
- **HTML5** with semantic markup
- **CSS3** with modern styling (gradients, animations)
- **Vanilla JavaScript** (ES6+)
- **Fetch API** for AJAX requests
- **LocalStorage** for token persistence

### Development
- **nodemon** for auto-restart
- **dotenv** for environment variables

---

## File Structure

```
lavellh/
├── src/
│   ├── models/
│   │   ├── User.js              # User model (existing)
│   │   └── Provider.js          # Provider model (NEW)
│   ├── controllers/
│   │   ├── authController.js    # Auth controller (existing)
│   │   └── providerController.js # Provider controller (NEW)
│   ├── routes/
│   │   ├── index.js             # Main routes (MODIFIED)
│   │   ├── auth.js              # Auth routes (existing)
│   │   └── provider.routes.js   # Provider routes (NEW)
│   ├── middleware/
│   │   ├── auth.js              # JWT middleware (existing)
│   │   └── upload.js            # File upload middleware (NEW)
│   ├── utility/
│   │   ├── jwt.js               # JWT utility (existing)
│   │   ├── emailService.js      # Email service (existing)
│   │   └── ocrService.js        # OCR service (NEW)
│   └── config/
│       ├── database.js          # DB config (existing)
│       └── passport.js          # Passport config (existing)
├── public/
│   ├── provider-register.html   # Registration form (NEW)
│   └── provider-login.html      # Login form (NEW)
├── uploads/                     # File storage (NEW)
│   └── id-cards/               # ID card images
├── server.js                    # Main server file
├── package.json                 # Dependencies
├── .env                         # Environment variables
├── .env.example                 # Environment template
├── .gitignore                   # Git ignore rules (MODIFIED)
├── PROVIDER_REGISTRATION_GUIDE.md  # Complete guide (NEW)
├── IMPLEMENTATION_SUMMARY.md    # Quick reference (NEW)
├── SYSTEM_ARCHITECTURE.md       # This file (NEW)
└── test-provider-setup.js       # Setup test script (NEW)
```

---

## API Error Handling

```
┌─────────────────────────────────────────────────────────────┐
│                     Error Handling Flow                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Client Request                                             │
│      ↓                                                      │
│  ┌──────────────────────────────────────────┐              │
│  │  Express.js Middleware Chain             │              │
│  ├──────────────────────────────────────────┤              │
│  │  1. Body parser                          │              │
│  │  2. Upload middleware (if file upload)   │              │
│  │  3. Auth middleware (if protected)       │              │
│  │  4. Route handler                        │              │
│  └────────┬────────────────────────┬────────┘              │
│           │                        │                        │
│      Success ✓                 Error ✗                     │
│           │                        │                        │
│           ↓                        ↓                        │
│  ┌─────────────────┐    ┌──────────────────────┐          │
│  │  Success        │    │  Error Handler        │          │
│  │  Response       │    │                       │          │
│  │  (200/201)      │    │  • Validation error   │          │
│  │                 │    │  • File upload error  │          │
│  │  {              │    │  • OCR error          │          │
│  │    success: true│    │  • Database error     │          │
│  │    message      │    │  • Auth error         │          │
│  │    data         │    │                       │          │
│  │  }              │    │  Returns:             │          │
│  └─────────────────┘    │  {                    │          │
│                         │    success: false     │          │
│                         │    message            │          │
│                         │    error (optional)   │          │
│                         │    errors (array)     │          │
│                         │  }                    │          │
│                         └──────────────────────┘          │
│                                                             │
│  Common HTTP Status Codes:                                 │
│  • 200 - Success (GET, PUT)                                │
│  • 201 - Created (POST registration)                       │
│  • 400 - Bad Request (validation errors)                   │
│  • 401 - Unauthorized (invalid credentials)                │
│  • 403 - Forbidden (account inactive/rejected)             │
│  • 404 - Not Found (provider not found)                    │
│  • 500 - Internal Server Error                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Deployment Architecture (Recommended)

```
┌─────────────────────────────────────────────────────────────┐
│                     Production Setup                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Frontend (Static Hosting)                                  │
│  ├─ Netlify / Vercel / S3 + CloudFront                     │
│  └─ Serves: provider-register.html, provider-login.html    │
│      │                                                      │
│      │ HTTPS                                                │
│      ↓                                                      │
│  API Server (Node.js)                                       │
│  ├─ AWS EC2 / Google Cloud / DigitalOcean                  │
│  ├─ PM2 for process management                             │
│  ├─ Nginx as reverse proxy                                 │
│  └─ SSL certificate (Let's Encrypt)                        │
│      │                                                      │
│      │ Secure connection                                    │
│      ↓                                                      │
│  Database (MongoDB)                                         │
│  ├─ MongoDB Atlas (cloud)                                  │
│  ├─ Encryption at rest                                     │
│  └─ Automated backups                                      │
│      │                                                      │
│      │                                                      │
│  File Storage (Cloud)                                       │
│  ├─ AWS S3 / Google Cloud Storage / Cloudinary             │
│  ├─ CDN for fast delivery                                  │
│  └─ Automatic image optimization                           │
│      │                                                      │
│      │                                                      │
│  OCR Service (Optional Cloud)                              │
│  ├─ Google Cloud Vision API                                │
│  ├─ AWS Textract                                           │
│  └─ Higher accuracy than Tesseract.js                      │
│                                                             │
│  Monitoring & Logging                                       │
│  ├─ Sentry (error tracking)                                │
│  ├─ LogRocket (session replay)                             │
│  └─ DataDog / New Relic (performance)                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Scalability Considerations

### Current Architecture (MVP)
- ✅ Single server
- ✅ Local file storage
- ✅ Tesseract.js OCR
- ✅ MongoDB connection

### Scale to 1,000 users
- Add load balancer
- Move to cloud storage (S3)
- Implement caching (Redis)
- Database connection pooling

### Scale to 10,000+ users
- Horizontal scaling (multiple servers)
- CDN for static assets
- Message queue for OCR processing (Bull/RabbitMQ)
- Cloud OCR service (Google Vision)
- Database sharding
- Separate microservices for OCR

---

## Conclusion

This architecture provides:
- ✅ Clean separation of concerns
- ✅ Modular and maintainable code
- ✅ Secure authentication flow
- ✅ Scalable file storage
- ✅ Robust error handling
- ✅ Easy to test and deploy

Ready for production with proper cloud services!
