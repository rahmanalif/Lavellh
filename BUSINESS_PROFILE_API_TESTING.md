# Business Profile API Testing Guide - Postman

## ⚡ Quick Start
1. ✅ Make sure your server is running (`node server.js` or `npm start`)
2. ✅ Open Postman
3. ✅ Follow the steps below in order
4. ✅ Replace `YOUR_TOKEN_HERE` with actual token from login
5. ✅ Replace `YOUR_CATEGORY_ID` with actual category IDs

---

## 🔄 Testing Workflow (Follow This Order!)

```
1. Login → Get Token
2. Get Categories → Copy Category IDs
3. Check Profile → See if hasProfile is false
4. CREATE Profile (POST) → First time setup
5. Get Profile → Verify creation
6. UPDATE Profile (PUT) → Modify data
7. Delete Photos → Remove specific photos
```

---

## 🔐 STEP 1: Login to Get Token

### Postman Setup:
- **Method:** `POST`
- **URL:** `http://localhost:3000/api/business-owners/login`

### Headers Tab:
```
Content-Type: application/json
```

### Body Tab:
- Select: **raw**
- Select: **JSON**
- Paste this:

```json
{
  "email": "businessowner@example.com",
  "password": "password123"
}
```

### Click "Send" Button

### Expected Response (200 OK):
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "email": "..."
  }
}
```

### ⚠️ IMPORTANT:
**Copy the entire `token` value (the long string) - you'll need it for ALL subsequent requests!**

**Pro Tip:** In Postman, you can save this token as an environment variable:
1. Create new environment called "Business API"
2. Add variable: `auth_token` = paste your token here
3. Then use `{{auth_token}}` in Authorization headers

---

## 📋 STEP 2: Get Available Categories

### Postman Setup:
- **Method:** `GET`
- **URL:** `http://localhost:3000/api/categories`

### Authorization Tab:
- **Type:** Bearer Token
- **Token:** Paste your token from Step 1 (or use `{{auth_token}}`)

### Headers Tab:
```
(No additional headers needed - Authorization is set in Auth tab)
```

### Body Tab:
- Select: **none**

### Click "Send" Button

### Expected Response (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "_id": "65a1b2c3d4e5f6g7h8i9j0k1",
      "name": "Beauty & Spa",
      "slug": "beauty-spa",
      "icon": "https://..."
    },
    {
      "_id": "65a1b2c3d4e5f6g7h8i9j0k2",
      "name": "Hair Salon",
      "slug": "hair-salon",
      "icon": "https://..."
    },
    {
      "_id": "65a1b2c3d4e5f6g7h8i9j0k3",
      "name": "Makeup Artist",
      "slug": "makeup-artist",
      "icon": "https://..."
    }
  ]
}
```

### ⚠️ IMPORTANT:
**Copy 2-3 `_id` values - you'll use them when creating your business profile!**

Example category IDs to copy:
- `65a1b2c3d4e5f6g7h8i9j0k1`
- `65a1b2c3d4e5f6g7h8i9j0k2`

---

## 🏢 STEP 3: Check Current Business Profile

### Postman Setup:
- **Method:** `GET`
- **URL:** `http://localhost:3000/api/business-owners/business-profile`

### Authorization Tab:
- **Type:** Bearer Token
- **Token:** Paste your token from Step 1

### Headers Tab:
```
(No additional headers needed)
```

### Body Tab:
- Select: **none**

### Click "Send" Button

**Expected Response (No Profile Created Yet):**
```json
{
  "success": true,
  "data": {
    "businessProfile": null,
    "hasProfile": false
  }
}
```

**Expected Response (Profile Already Created):**
```json
{
  "success": true,
  "data": {
    "businessProfile": {
      "coverPhoto": "https://...",
      "name": "Amazing Beauty Salon",
      "categories": [...],
      "location": "123 Main Street...",
      "about": "...",
      "photos": [...]
    },
    "hasProfile": true
  }
}
```

---

## ➕ STEP 4: CREATE Business Profile (First Time - POST)

### ⚠️ CRITICAL: This creates your profile for the FIRST TIME ONLY!

### Postman Setup:
- **Method:** `POST`  ⚠️ **POST not PUT!**
- **URL:** `http://localhost:3000/api/business-owners/business-profile`

### Authorization Tab:
- **Type:** Bearer Token
- **Token:** Paste your token from Step 1

### Headers Tab:
```
Content-Type: application/json
```

### Body Tab:
- Select: **raw**
- Select: **JSON**
- Paste this (⚠️ Replace category IDs with real ones from Step 2):

```json
{
  "name": "Amazing Beauty Salon & Spa",
  "categories": ["YOUR_CATEGORY_ID_1", "YOUR_CATEGORY_ID_2"],
  "location": "123 Main Street, New York, NY 10001",
  "about": "We offer the best beauty services in town with experienced professionals and premium products."
}
```

### Example with Real IDs:
```json
{
  "name": "Glamour Beauty Studio",
  "categories": ["65a1b2c3d4e5f6g7h8i9j0k1", "65a1b2c3d4e5f6g7h8i9j0k2"],
  "location": "456 Beauty Avenue, Los Angeles, CA 90001",
  "about": "Premium beauty services including hair styling, makeup, and spa treatments. 10+ years of experience."
}
```

### Click "Send" Button

### 📝 Required Fields:
- ✅ `name` - Business display name (string)
- ✅ `categories` - Array of category IDs (at least 1 required)
- ✅ `location` - Business location (string)

### 📝 Optional Fields:
- `about` - Business description (string)

**Expected Response:**
```json
{
  "success": true,
  "message": "Business profile created successfully",
  "data": {
    "businessProfile": {
      "coverPhoto": null,
      "name": "Amazing Beauty Salon & Spa",
      "categories": [
        {
          "_id": "65a1b2c3d4e5f6g7h8i9j0k1",
          "name": "Beauty & Spa",
          "slug": "beauty-spa"
        }
      ],
      "location": "123 Main Street, New York, NY 10001",
      "about": "We offer the best beauty services...",
      "photos": []
    }
  }
}
```

**❌ Error if Already Created:**
```json
{
  "success": false,
  "message": "Business profile already exists. Use PUT method to update."
}
```

---

## ✏️ STEP 5: UPDATE Business Profile (Text Fields Only - PUT)

### ⚠️ IMPORTANT: Only use this AFTER creating profile with POST in Step 4!

### Postman Setup:
- **Method:** `PUT`  ⚠️ **PUT not POST!**
- **URL:** `http://localhost:3000/api/business-owners/business-profile`

### Authorization Tab:
- **Type:** Bearer Token
- **Token:** Paste your token from Step 1

### Headers Tab:
```
Content-Type: application/json
```

### Body Tab:
- Select: **raw**
- Select: **JSON**
- Paste this (change any field you want to update):

```json
{
  "name": "Updated Beauty Salon & Spa",
  "categories": ["65a1b2c3d4e5f6g7h8i9j0k1", "65a1b2c3d4e5f6g7h8i9j0k2"],
  "location": "456 New Address, New York, NY 10002",
  "about": "Updated description - We offer premium beauty services with over 15 years of experience!"
}
```

### Click "Send" Button

### Expected Response (200 OK):
```json
{
  "success": true,
  "message": "Business profile updated successfully",
  "data": {
    "businessProfile": {
      "coverPhoto": null,
      "name": "Updated Beauty Salon & Spa",
      "categories": [
        {
          "_id": "65a1b2c3d4e5f6g7h8i9j0k1",
          "name": "Beauty & Spa",
          "slug": "beauty-spa"
        },
        {
          "_id": "65a1b2c3d4e5f6g7h8i9j0k2",
          "name": "Hair Salon",
          "slug": "hair-salon"
        }
      ],
      "location": "456 New Address, New York, NY 10002",
      "about": "Updated description - We offer premium beauty services...",
      "photos": []
    }
  }
}
```

### ❌ Common Error (if you didn't create profile first):
```json
{
  "success": false,
  "message": "Business profile does not exist. Use POST method to create it first."
}
```

**💡 Tip:** You can update just ONE field at a time. For example, to only change the name:
```json
{
  "name": "New Business Name"
}
```

---

## 📸 STEP 6: CREATE Business Profile with Cover Photo (POST with Files)

### ⚠️ This is an ALTERNATIVE to Step 4 - Use this if you want to upload photos during creation

### Postman Setup:
- **Method:** `POST`
- **URL:** `http://localhost:3000/api/business-owners/business-profile`

### Authorization Tab:
- **Type:** Bearer Token
- **Token:** Paste your token from Step 1

### Headers Tab:
```
⚠️ DO NOT add Content-Type header!
Postman will set it automatically for form-data
```

### Body Tab:
- Select: **form-data** ⚠️ **NOT raw or JSON!**
- Add these fields:

| KEY | TYPE | VALUE |
|-----|------|-------|
| `coverPhoto` | **File** | Click "Select Files" and choose an image |
| `businessPhotos` | **File** | Click "Select Files" and choose image 1 |
| `businessPhotos` | **File** | Click "Select Files" and choose image 2 |
| `name` | **Text** | Glamour Beauty Studio |
| `location` | **Text** | 123 Main Street, New York, NY 10001 |
| `about` | **Text** | Premium beauty services... |
| `categories` | **Text** | ["65a1b2c3d4e5f6g7h8i9j0k1", "65a1b2c3d4e5f6g7h8i9j0k2"] |

### 📝 IMPORTANT Notes:
1. **Categories format:** Must be a JSON array string like: `["id1", "id2"]`
2. **Multiple photos:** Add multiple rows with same key name `businessPhotos`
3. **File types:** Use JPG, PNG (keep under 5MB each)

### Visual Guide for form-data:
```
Row 1: coverPhoto     | File | [Select Files button]
Row 2: businessPhotos | File | [Select Files button]
Row 3: businessPhotos | File | [Select Files button]
Row 4: name           | Text | Glamour Beauty Studio
Row 5: categories     | Text | ["65a1b2c3d4e5f6g7h8i9j0k1"]
Row 6: location       | Text | 123 Main St...
Row 7: about          | Text | Premium services...
```

### Click "Send" Button

**Expected Response:**
```json
{
  "success": true,
  "message": "Business profile updated successfully",
  "data": {
    "businessProfile": {
      "coverPhoto": "https://res.cloudinary.com/your-cloud/image/upload/v1234567890/business-profiles/covers/abc123.jpg",
      "name": "Amazing Beauty Salon & Spa",
      "categories": [...],
      "location": "123 Main Street, New York, NY 10001",
      "about": "We offer the best beauty services...",
      "photos": []
    }
  }
}
```

---

## 🖼️ STEP 7: UPDATE Business Profile - Add More Photos (PUT)

### Postman Setup:
- **Method:** `PUT`
- **URL:** `http://localhost:3000/api/business-owners/business-profile`

### Authorization Tab:
- **Type:** Bearer Token
- **Token:** Paste your token from Step 1

### Headers Tab:
```
⚠️ DO NOT add Content-Type header!
```

### Body Tab:
- Select: **form-data**
- Add these fields:

| KEY | TYPE | VALUE |
|-----|------|-------|
| `businessPhotos` | **File** | Click "Select Files" - image 1 |
| `businessPhotos` | **File** | Click "Select Files" - image 2 |
| `businessPhotos` | **File** | Click "Select Files" - image 3 |

### 📝 IMPORTANT Notes:
- Photos will be **ADDED** to existing photos (not replaced)
- You can add up to 10 photos total
- To add multiple photos, create multiple rows with the same key `businessPhotos`

### Optional: You can also update text fields at the same time:

| KEY | TYPE | VALUE |
|-----|------|-------|
| `businessPhotos` | **File** | image1.jpg |
| `businessPhotos` | **File** | image2.jpg |
| `name` | **Text** | Updated Business Name |
| `about` | **Text** | Updated description |

### Click "Send" Button

**Expected Response:**
```json
{
  "success": true,
  "message": "Business profile updated successfully",
  "data": {
    "businessProfile": {
      "coverPhoto": "https://...",
      "name": "Amazing Beauty Salon & Spa",
      "categories": [...],
      "location": "123 Main Street, New York, NY 10001",
      "about": "We offer the best beauty services...",
      "photos": [
        "https://res.cloudinary.com/your-cloud/image/upload/.../photo1.jpg",
        "https://res.cloudinary.com/your-cloud/image/upload/.../photo2.jpg",
        "https://res.cloudinary.com/your-cloud/image/upload/.../photo3.jpg"
      ]
    }
  }
}
```

---

## 🗑️ STEP 8: Delete a Business Photo

### Postman Setup:
- **Method:** `DELETE`
- **URL:** `http://localhost:3000/api/business-owners/business-profile/photos/0`

### ⚠️ IMPORTANT: 
Replace `0` in the URL with the index of the photo you want to delete:
- `0` = First photo
- `1` = Second photo
- `2` = Third photo
- etc.

### Examples:
- Delete first photo: `.../photos/0`
- Delete second photo: `.../photos/1`
- Delete third photo: `.../photos/2`

### Authorization Tab:
- **Type:** Bearer Token
- **Token:** Paste your token from Step 1

### Headers Tab:
```
(No headers needed)
```

### Body Tab:
- Select: **none**

### Click "Send" Button

**Expected Response:**
```json
{
  "success": true,
  "message": "Business photo deleted successfully",
  "data": {
    "photos": [
      "https://res.cloudinary.com/your-cloud/image/upload/.../photo2.jpg",
      "https://res.cloudinary.com/your-cloud/image/upload/.../photo3.jpg"
    ]
  }
}
```

---

## 📊 BONUS: Complete Create Example (All Fields + Files at Once)

### The Ultimate Test - Create profile with everything in one request!

### Postman Setup:
- **Method:** `POST`
- **URL:** `http://localhost:3000/api/business-owners/business-profile`

### Authorization Tab:
- **Type:** Bearer Token
- **Token:** Your token

### Headers Tab:
```
(No headers - let Postman handle it)
```

### Body Tab:
- Select: **form-data**
- Add ALL these fields:

| KEY | TYPE | VALUE |
|-----|------|-------|
| `coverPhoto` | **File** | Select a beautiful cover image |
| `businessPhotos` | **File** | Interior photo 1 |
| `businessPhotos` | **File** | Interior photo 2 |
| `businessPhotos` | **File** | Service photo 1 |
| `businessPhotos` | **File** | Team photo |
| `name` | **Text** | Luxury Beauty Spa & Wellness Center |
| `categories` | **Text** | ["YOUR_CAT_ID_1", "YOUR_CAT_ID_2", "YOUR_CAT_ID_3"] |
| `location` | **Text** | 456 Spa Boulevard, Los Angeles, CA 90001 |
| `about` | **Text** | Premium spa services with organic products. We specialize in facials, massages, hair treatments, and wellness therapies. Over 10 years serving the community! |

### Click "Send" Button

### Expected: 201 Created with full profile data including all uploaded image URLs!

---

## 📊 BONUS: Complete Update Example (All Fields + Files)

### Update everything at once - cover photo, business photos, and all text fields!

### Postman Setup:
- **Method:** `PUT` ⚠️ **Must have created profile first with POST!**
- **URL:** `http://localhost:3000/api/business-owners/business-profile`

### Authorization Tab:
- **Type:** Bearer Token
- **Token:** Your token

### Headers Tab:
```
(No headers - let Postman handle it)
```

### Body Tab:
- Select: **form-data**
- Add ALL these fields:

| KEY | TYPE | VALUE |
|-----|------|-------|
| `coverPhoto` | **File** | New cover photo (replaces old one) |
| `businessPhotos` | **File** | Additional photo 1 (adds to existing) |
| `businessPhotos` | **File** | Additional photo 2 (adds to existing) |
| `businessPhotos` | **File** | Additional photo 3 (adds to existing) |
| `name` | **Text** | Updated Luxury Spa & Wellness |
| `categories` | **Text** | ["YOUR_CAT_ID_1", "YOUR_CAT_ID_2"] |
| `location` | **Text** | 789 New Location Blvd, Miami, FL 33101 |
| `about` | **Text** | Completely updated description of your amazing business! |

### Click "Send" Button

### Expected: 200 OK with updated profile data!

---

## 🔍 Testing Checklist

### ✅ Basic Tests:
- [ ] Login and get authentication token
- [ ] Get business profile (should return `hasProfile: false`)
- [ ] **Create** profile with POST (text fields only)
- [ ] Try to create again (should fail - already exists)
- [ ] Get profile again (should return `hasProfile: true`)
- [ ] **Update** profile with PUT (change name or location)

### ✅ File Upload Tests:
- [ ] Create profile with cover photo (POST with form-data)
- [ ] Create profile with multiple business photos
- [ ] Update profile - upload new cover photo (should replace old one)
- [ ] Update profile - add more business photos (should append to existing)
- [ ] Verify photos appear in GET request

### ✅ Category Tests:
- [ ] Create profile with single category
- [ ] Create profile with multiple categories
- [ ] Update profile to change categories
- [ ] Try to create without categories (should fail)
- [ ] Verify categories are populated with names in response

### ✅ Photo Management Tests:
- [ ] Delete first photo (index 0)
- [ ] Delete middle photo
- [ ] Delete last photo
- [ ] Try deleting with invalid index (should fail)

### ✅ REST Compliance Tests:
- [ ] Try to PUT without creating first (should fail)
- [ ] Try to POST after already created (should fail)
- [ ] POST returns 201 status code
- [ ] PUT returns 200 status code

### ✅ Update Tests:
- [ ] Update only name field (PUT)
- [ ] Update only location field (PUT)
- [ ] Replace cover photo (old one should be deleted)
- [ ] Add more photos to existing ones (PUT)

### ✅ Error Tests:
- [ ] Try POST without authentication token (should fail with 401)
- [ ] Try POST with invalid token (should fail with 401)
- [ ] Try POST without required fields (should fail with 400)
- [ ] Try PUT before creating profile (should fail with 400)
- [ ] Try POST after profile exists (should fail with 400)
- [ ] Try deleting photo with index -1 (should fail)
- [ ] Try deleting photo with index 999 (should fail)

---

## 🚨 Common Issues & Solutions

### Issue: "Unauthorized" or 401 Error
**Solution:** Make sure you're including the Bearer token in the Authorization header

### Issue: "Business profile already exists. Use PUT method to update."
**Solution:** You've already created the profile. Use PUT endpoint instead of POST

### Issue: "Business profile does not exist. Use POST method to create it first."
**Solution:** You need to create the profile first using POST before you can update it

### Issue: Categories not showing
**Solution:** Make sure category IDs exist in your database. Run the categories endpoint first to get valid IDs

### Issue: Photos not uploading
**Solution:** 
- Remove `Content-Type: application/json` header when uploading files
- Use `form-data` body type, not JSON
- Make sure file size is reasonable (< 10MB recommended)

### Issue: "Invalid photo index"
**Solution:** Photo indices start at 0. If you have 3 photos, valid indices are 0, 1, 2

### Issue: Categories format error with form-data
**Solution:** When using form-data, categories must be a JSON string:
```
["id1", "id2"]
```
Not:
```
id1, id2
```

### Issue: "At least one category is required"
**Solution:** Make sure you're sending categories as an array with at least one category ID

---

## 📌 Quick Reference - All Endpoints

| Method | Endpoint | Purpose | When to Use |
|--------|----------|---------|-------------|
| `GET` | `/api/business-owners/business-profile` | Get business profile | Check if profile exists or view current data |
| `POST` | `/api/business-owners/business-profile` | **Create** business profile | **First time only** - Initialize profile |
| `PUT` | `/api/business-owners/business-profile` | **Update** business profile | After profile is created - modify existing data |
| `DELETE` | `/api/business-owners/business-profile/photos/:photoIndex` | Delete a photo | Remove specific business photo |

### 🔄 Typical Workflow:
1. **Login** → Get auth token
2. **GET** profile → Check if `hasProfile` is false
3. **POST** profile → Create it for the first time (required: name, categories, location)
4. **PUT** profile → Update any field or add more photos
5. **DELETE** photo → Remove unwanted photos

---

## 💡 Pro Tips

1. **Test incrementally**: Start with text fields, then add photos one by one
2. **Save your token**: Store it in a Postman environment variable for easy reuse
3. **Check responses**: Always verify the response data matches what you sent
4. **Use small images**: For faster testing, use images under 1-2MB
5. **Categories array**: When using JSON body, categories is an array. When using form-data, it's a JSON string

---

Happy Testing! 🚀
