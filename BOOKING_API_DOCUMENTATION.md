# Booking and Appointment API Documentation

## Overview

This system provides two types of booking mechanisms:

1. **Regular Bookings** - For services where `appointmentEnabled = false`
2. **Appointments** - For services where `appointmentEnabled = true`

---

## 🎯 Regular Bookings (appointmentEnabled = false)

Used when a service has a fixed base price and doesn't require specific appointment slots.

### Create a Booking

**Endpoint:** `POST /api/bookings`

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "serviceId": "691a5207a0c0b932f73bf6dc",
  "bookingDate": "2025-01-25",
  "downPayment": 100,
  "userNotes": "Please arrive early in the morning"
}
```

**Validations:**
- `downPayment` must be at least 20% of the service's `basePrice`
- `bookingDate` must be in the future
- Service must have `appointmentEnabled = false`
- Service must be active (`isActive = true`)

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Booking created successfully",
  "data": {
    "_id": "booking_id",
    "userId": "user_id",
    "serviceId": "service_id",
    "providerId": "provider_id",
    "bookingDate": "2025-01-25T00:00:00.000Z",
    "serviceSnapshot": {
      "serviceName": "House cleaning service",
      "servicePhoto": "url_to_photo",
      "basePrice": 120,
      "category": "category_id"
    },
    "downPayment": 100,
    "totalAmount": 120,
    "remainingAmount": 20,
    "paymentStatus": "partial",
    "bookingStatus": "pending",
    "userNotes": "Please arrive early in the morning",
    "user": { ... },
    "service": { ... },
    "provider": { ... }
  }
}
```

### Get My Bookings

**Endpoint:** `GET /api/bookings/my-bookings`

**Authentication:** Required

**Query Parameters:**
- `status` (optional): Filter by status (pending, confirmed, in_progress, completed, cancelled, rejected)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

**Example:** `GET /api/bookings/my-bookings?status=pending&page=1&limit=10`

**Response:**
```json
{
  "success": true,
  "count": 5,
  "total": 25,
  "currentPage": 1,
  "totalPages": 3,
  "data": [ ... ]
}
```

### Get Single Booking

**Endpoint:** `GET /api/bookings/:id`

**Authentication:** Required (Owner only)

### Cancel Booking

**Endpoint:** `PATCH /api/bookings/:id/cancel`

**Authentication:** Required (Owner only)

**Request Body:**
```json
{
  "cancellationReason": "Schedule conflict"
}
```

---

## 📅 Appointments (appointmentEnabled = true)

Used when a service has appointment slots with different durations and prices.

### Create an Appointment

**Endpoint:** `POST /api/appointments`

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "serviceId": "691a5207a0c0b932f73bf6dc",
  "appointmentDate": "2025-01-25",
  "timeSlot": {
    "startTime": "09:00",
    "endTime": "17:00"
  },
  "slotId": "appointment_slot_id_from_service",
  "downPayment": 50,
  "userNotes": "Please confirm the appointment"
}
```

**Field Explanations:**
- `appointmentDate`: The date for the appointment (YYYY-MM-DD format)
- `timeSlot.startTime`: Start time in 24-hour format (HH:MM), e.g., "09:00"
- `timeSlot.endTime`: End time in 24-hour format (HH:MM), e.g., "17:00"
- `slotId`: The ID of the selected appointment slot from the service's `appointmentSlots` array
- `downPayment`: Optional down payment amount
- `userNotes`: Optional notes from the user

**How to get the slotId:**
1. First, fetch the service details: `GET /api/services/691a5207a0c0b932f73bf6dc`
2. Look at the `appointmentSlots` array in the response
3. Each slot has an `_id` field - use that as `slotId`

**Example Service Response:**
```json
{
  "appointmentEnabled": true,
  "appointmentSlots": [
    {
      "_id": "slot_id_1",
      "duration": 2,
      "durationUnit": "hours",
      "price": 120
    },
    {
      "_id": "slot_id_2",
      "duration": 4,
      "durationUnit": "hours",
      "price": 200
    }
  ]
}
```

**Validations:**
- Service must have `appointmentEnabled = true`
- Service must be active
- `slotId` must exist in the service's `appointmentSlots`
- Time slot must not conflict with existing appointments
- `endTime` must be after `startTime`
- `appointmentDate` must be in the future

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Appointment created successfully",
  "data": {
    "_id": "appointment_id",
    "userId": "user_id",
    "serviceId": "service_id",
    "providerId": "provider_id",
    "appointmentDate": "2025-01-25T00:00:00.000Z",
    "timeSlot": {
      "startTime": "09:00",
      "endTime": "17:00"
    },
    "selectedSlot": {
      "duration": 2,
      "durationUnit": "hours",
      "price": 120,
      "slotId": "slot_id"
    },
    "serviceSnapshot": { ... },
    "totalAmount": 120,
    "downPayment": 50,
    "remainingAmount": 70,
    "paymentStatus": "partial",
    "appointmentStatus": "pending",
    "userNotes": "Please confirm the appointment"
  }
}
```

**Error Response (409 Conflict):**
```json
{
  "success": false,
  "message": "This time slot is already booked. Please choose a different time."
}
```

### Get My Appointments

**Endpoint:** `GET /api/appointments/my-appointments`

**Authentication:** Required

**Query Parameters:**
- `status` (optional): Filter by status (pending, confirmed, in_progress, completed, cancelled, rejected, no_show)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

**Example:** `GET /api/appointments/my-appointments?status=confirmed&page=1&limit=10`

### Get Available Slots

**Endpoint:** `GET /api/appointments/available-slots/:serviceId`

**Authentication:** Not required (Public)

**Query Parameters:**
- `date` (required): Date in YYYY-MM-DD format

**Example:** `GET /api/appointments/available-slots/691a5207a0c0b932f73bf6dc?date=2025-01-25`

**Response:**
```json
{
  "success": true,
  "data": {
    "service": {
      "id": "691a5207a0c0b932f73bf6dc",
      "name": "House cleaning service",
      "appointmentSlots": [
        {
          "_id": "slot_id_1",
          "duration": 2,
          "durationUnit": "hours",
          "price": 120
        }
      ]
    },
    "bookedSlots": [
      {
        "startTime": "10:00",
        "endTime": "12:00"
      },
      {
        "startTime": "14:00",
        "endTime": "16:00"
      }
    ],
    "date": "2025-01-25"
  }
}
```

### Get Single Appointment

**Endpoint:** `GET /api/appointments/:id`

**Authentication:** Required (Owner only)

### Cancel Appointment

**Endpoint:** `PATCH /api/appointments/:id/cancel`

**Authentication:** Required (Owner only)

**Request Body:**
```json
{
  "cancellationReason": "Schedule changed"
}
```

---

## 📊 Status Values

### Booking Status
- `pending` - Booking created, awaiting provider confirmation
- `confirmed` - Provider confirmed the booking
- `in_progress` - Service is being provided
- `completed` - Service completed
- `cancelled` - Booking cancelled by user/provider
- `rejected` - Provider rejected the booking

### Appointment Status
- `pending` - Appointment created, awaiting confirmation
- `confirmed` - Provider confirmed the appointment
- `in_progress` - Appointment in progress
- `completed` - Appointment completed
- `cancelled` - Cancelled by user/provider
- `rejected` - Provider rejected the appointment
- `no_show` - User didn't show up

### Payment Status
- `pending` - No payment made
- `partial` - Down payment made
- `completed` - Full payment made
- `refunded` - Payment refunded

---

## 🔐 Authentication

All endpoints (except available slots) require authentication using a Bearer token:

```
Authorization: Bearer <your_jwt_token>
```

---

## 💡 Usage Flow

### For Regular Bookings:

1. **User views services:** `GET /api/services` or `GET /api/services/category/:categoryId`
2. **User selects a service** where `appointmentEnabled = false`
3. **User creates booking:** `POST /api/bookings` with:
   - Service ID
   - Desired date
   - Down payment (≥20% of base price)
   - Optional notes
4. **User views their bookings:** `GET /api/bookings/my-bookings`
5. **User can cancel:** `PATCH /api/bookings/:id/cancel`

### For Appointments:

1. **User views services:** `GET /api/services/:id`
2. **User checks if `appointmentEnabled = true`**
3. **User views available slots:** `GET /api/appointments/available-slots/:serviceId?date=2025-01-25`
4. **User selects an appointment slot** from the service's `appointmentSlots` array
5. **User creates appointment:** `POST /api/appointments` with:
   - Service ID
   - Appointment date
   - Time slot (start and end time)
   - Selected slot ID
   - Optional down payment
   - Optional notes
6. **User views their appointments:** `GET /api/appointments/my-appointments`
7. **User can cancel:** `PATCH /api/appointments/:id/cancel`

---

## 📝 Example Testing with cURL

### Create a Regular Booking:
```bash
curl -X POST http://localhost:5100/api/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "serviceId": "691a5207a0c0b932f73bf6dc",
    "bookingDate": "2025-01-25",
    "downPayment": 100,
    "userNotes": "Morning preferred"
  }'
```

### Create an Appointment:
```bash
curl -X POST http://localhost:5100/api/appointments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "serviceId": "691a5207a0c0b932f73bf6dc",
    "appointmentDate": "2025-01-25",
    "timeSlot": {
      "startTime": "09:00",
      "endTime": "17:00"
    },
    "slotId": "appointment_slot_id",
    "downPayment": 50,
    "userNotes": "Please confirm"
  }'
```

### Get Available Slots:
```bash
curl http://localhost:5100/api/appointments/available-slots/691a5207a0c0b932f73bf6dc?date=2025-01-25
```

---

## 🎨 Mobile UI Flow (Based on Screenshots)

### For Regular Booking (Service without appointments):
**Booking Screen shows:**
- User profile (Tamim Sarkar)
- User location (Dhanmondi, Dhaka 1209)
- Date picker
- Down payment input (with 20% minimum validation)
- Notes textarea
- "Book Now" button

### For Appointment (Service with appointments):
**Appointment Screen shows:**
- User profile
- Service name (from provider's service)
- Date picker
- Provider available time (from appointmentSlots)
- Hour selection (1, 1.5, 2, 2.5, 3, 3.5, 4+ hours)
- Time input (10:20 AM/PM format)
- Price display ($120)
- Notes textarea
- "Create Appointment" button

---

## Database Models

### Booking Model
- userId (User reference)
- serviceId (Service reference)
- providerId (Provider reference)
- bookingDate
- serviceSnapshot (preserved service info)
- downPayment
- totalAmount
- remainingAmount
- paymentStatus
- bookingStatus
- userNotes
- providerNotes

### Appointment Model
- userId (User reference)
- serviceId (Service reference)
- providerId (Provider reference)
- appointmentDate
- timeSlot (startTime, endTime)
- selectedSlot (duration, durationUnit, price, slotId)
- serviceSnapshot
- totalAmount
- downPayment
- remainingAmount
- paymentStatus
- appointmentStatus
- userNotes
- providerNotes
- reminderSent

---

## Notes

1. **Down Payment:** For regular bookings, down payment must be at least 20% of the base price
2. **Time Conflict Detection:** The system automatically checks for appointment conflicts
3. **Service Snapshot:** Service details are preserved in bookings/appointments to maintain data integrity even if the service is modified later
4. **Provider Data:** Provider information is automatically fetched from the service
5. **Validation:** All dates must be in the future
6. **Authorization:** Users can only view/cancel their own bookings/appointments
